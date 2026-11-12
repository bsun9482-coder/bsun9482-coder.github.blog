"""把 content/resources/*.mdx 这些「写在文件里的文章」导进 SQLite。

为什么需要这一步？
  现在这个站有两套数据源：
    · 前台 /resources  → 读 src/content 里的 .mdx 文件（构建时被扫成一份清单）
    · 后台 /admin      → 读 FastAPI + SQLite
  也就是说：你在后台看到的 3 篇，和前台显示的 2 篇，是两个世界。
  要让「以后统一从数据库读」，第一件事就是把旧文章搬进库 —— 搬进去之后
  前台才有东西可读。

frontmatter 是什么？
  .mdx 文件开头夹在两行 `---` 中间的那一小段 YAML，比如：

      ---
      title: AI 使用提示词卡
      date: "2026-11-02"
      tags:
        - 提示词
      ---
      ## 第一章 …
      正文……

  它存的是「文章的元数据」（标题、日期、标签……），下面才是正文。
  为什么要单独一段？因为正文是给人读的 Markdown，混进元数据就没法写了；
  分开之后，程序只读上面那段，渲染只读下面那段。

⚠️ 这个脚本**只读** .mdx，绝不修改、更不删除原文件。
   原文件留着就是备份：万一迁移出错、或者你想回退，把库清掉重跑一遍就行。
   脚本里所有写操作都只发生在 backend/data/app.db 上。

怎么跑（在任意目录都行，用后端那个虚拟环境的 python）：

    python backend/import_mdx.py                 ← 正常迁移：库里没有的新增，有的跳过
    python backend/import_mdx.py --dry-run       ← 只演练，不写库（先看会发生什么）
    python backend/import_mdx.py --update        ← 库里有同 slug 的，用文件内容覆盖它
    python backend/import_mdx.py --dir 别的目录   ← 换一个来源目录

重复运行是安全的：靠 slug 去重（slug 就是文件名去掉 .mdx），
所以跑十遍库里的文章数也不会变多。
"""

import argparse
import re
import sys
from datetime import date, datetime
from pathlib import Path

# 让脚本在任意目录下执行都能 import 到 backend 里的模块
BACKEND_DIR = Path(__file__).resolve().parent
REPO_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

import frontmatter  # noqa: E402  （E402 = import 不在文件最顶端，这里是有意为之）
import models  # noqa: E402
import yaml  # noqa: E402  （frontmatter 的依赖，装它会一起带上，不用单独装）
from database import Base, SessionLocal, engine  # noqa: E402

# 和前台 getReadingMinutes() 同一口径：中文按字、西文按词，每 300 算一分钟。
# 为什么要对齐？同一篇文章在前后台显示「30 分钟 / 42 分钟」会让人以为数据错了。
CHARS_PER_MINUTE = 300

DEFAULT_CATEGORY = "未分类"
DEFAULT_READING_MINUTES = 1

# 只留「看得见的字」，给阅读时长估算用（正式阅读时长优先用 frontmatter 里写的）
_MD_PATTERNS = [
    (re.compile(r"```[\s\S]*?```"), " "),        # 整块代码
    (re.compile(r"`[^`]*`"), " "),               # 行内代码
    (re.compile(r"!\[[^\]]*\]\([^)]*\)"), " "),  # 图片
    (re.compile(r"\[([^\]]*)\]\([^)]*\)"), r"\1"),  # 链接只留文字
    (re.compile(r"<[^>]+>"), " "),               # HTML / JSX 标签
    (re.compile(r"[*_>#|~-]"), " "),             # 各种 Markdown 记号
]


def strip_markdown(text: str) -> str:
    """去掉 Markdown 记号，只留能读的字。"""
    for pattern, repl in _MD_PATTERNS:
        text = pattern.sub(repl, text)
    return re.sub(r"\s+", " ", text).strip()


def estimate_reading_minutes(content: str) -> int:
    text = strip_markdown(content)
    chinese = len(re.findall(r"[\u3400-\u9fff]", text))
    latin = len(re.findall(r"[a-zA-Z0-9_]+", text))
    return max(DEFAULT_READING_MINUTES, -(-(chinese + latin) // CHARS_PER_MINUTE))


def to_date(value) -> tuple[date | None, str | None]:
    """把各种写法的日期统一成 date。返回 (日期, 警告)。

    会遇到这三种：
      · YAML 里写成 `date: "2026-11-02"` → 字符串
      · 写成 `date: 2026-11-02`（不加引号）→ PyYAML 直接解析成 date 对象
      · 写成 `date: 2026-11-02T10:00:00` 或 `2026/11/02` → 得自己兜
    认不出来就返回 None 并给一句警告 —— 别让一整篇因为日期格式怪就迁不进去。
    """
    if value is None or value == "":
        return None, None
    if isinstance(value, datetime):
        return value.date(), None
    if isinstance(value, date):
        return value, None

    text = str(value).strip()
    try:
        # fromisoformat 认 2026-11-02 和 2026-11-02T10:00:00
        return datetime.fromisoformat(text.replace("/", "-")).date(), None
    except ValueError:
        pass

    matched = re.search(r"(\d{4})\D{0,2}(\d{1,2})\D{0,2}(\d{1,2})", text)
    if matched:
        year, month, day = matched.groups()
        try:
            return date(int(year), int(month), int(day)), None
        except ValueError:
            pass

    return None, f"日期认不出来（{text!r}），已存成「未定」"


def to_int(value, default: int) -> int:
    if value is None or value == "":
        return default
    try:
        number = int(float(str(value).strip()))
    except (TypeError, ValueError):
        return default
    return number if number >= 1 else default


def to_bool(value) -> bool:
    """草稿开关。YAML 的 true/false 已经是布尔；有人写成 "true" 字符串也算。"""
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {"true", "yes", "1", "y", "是", "草稿"}


def normalize_tags(value) -> list[str]:
    """tags 可能是列表，也可能被人写成 "a, b" 一行。两种都收，顺手去重去空。"""
    if value is None:
        return []
    if isinstance(value, str):
        pieces = re.split(r"[,，]", value)
    elif isinstance(value, (list, tuple, set)):
        pieces = list(value)
    else:
        pieces = [value]

    seen: list[str] = []
    for piece in pieces:
        tag = str(piece).strip()
        if tag and tag not in seen:
            seen.append(tag)
    return seen


def explain_yaml_error(exc: Exception) -> str:
    """把 PyYAML 的英文异常翻成能照着改的中文。

    为什么值得单独写一段：这段报错的读者就是「第一次写 frontmatter 的人」。
    原文大概是 `while parsing a flow sequence ... did not find expected ',' or ']'`，
    它既不说是哪个文件（外层会补），也不说人话。翻译之后能直接照着定位。
    """
    mark = getattr(exc, "problem_mark", None)
    problem = getattr(exc, "problem", "") or str(exc)
    where = f"第 {mark.line + 1} 行第 {mark.column + 1} 列附近：" if mark else ""

    hints = {
        "expected ',' or ']'": "方括号 [ ] 没配对，或者列表项之间少了逗号",
        "expected ',' or '}'": "花括号 { } 没配对，或者键值之间少了逗号",
        "expected <block end>": "缩进不一致（YAML 用缩进表示层级，只能空格不能 Tab）",
        "could not find expected ':'": "某一行少了冒号（键和值之间要有一个英文冒号加空格）",
        "found character '\\t'": "用了 Tab 缩进，YAML 只认空格",
        "mapping values are not allowed here": "冒号写多了，或者值里出现了没加引号的冒号",
    }
    for key, friendly in hints.items():
        if key in problem:
            return f"frontmatter 的 YAML 写坏了 —— {where}{friendly}"

    return f"frontmatter 的 YAML 写坏了 —— {where}{problem}"


def build_fields(path: Path) -> tuple[dict, list[str]]:
    """读一个 .mdx，翻成 Post 表能用的字段。返回 (字段, 警告列表)。

    只处理「缺字段」和「格式怪」，不吞掉真正的读文件错误 ——
    文件打不开、YAML 写坏了，都由调用方捕获并记成失败。
    """
    warnings: list[str] = []

    # frontmatter.load 会把文件拆成两块：.metadata 是上面那段 YAML，
    # .content 是去掉 frontmatter 之后的正文（正是我们要存进 content 列的东西）
    #
    # ⚠️ YAML 写坏时它抛的是 PyYAML 的英文异常（"while parsing a flow sequence…
    # did not find expected ',' or ']'"），新手看不懂。这里翻译成人话再说，
    # 并保住「第几行」——没有行号，在一百行的 frontmatter 里根本找不到错在哪。
    try:
        parsed = frontmatter.load(path)
    except yaml.YAMLError as exc:
        raise ValueError(explain_yaml_error(exc)) from exc

    meta = parsed.metadata or {}

    if not meta:
        warnings.append("没有 frontmatter，标题只能退回用文件名")

    # ---------- slug：文件名去掉 .mdx ----------
    slug = path.stem

    # ---------- 标题（必填，缺了就退回文件名，绝不空白） ----------
    title = str(meta.get("title") or "").strip() or slug
    # 没有 frontmatter 时上面已经提示过了，别再补一条几乎一样的话
    if meta and not str(meta.get("title") or "").strip():
        warnings.append(f"缺 title，用文件名「{slug}」代替")

    # ---------- 描述 / 分类 ----------
    description = str(meta.get("description") or "").strip()
    category = str(meta.get("category") or "").strip() or DEFAULT_CATEGORY

    # ---------- 正文 ----------
    content = parsed.content.strip()
    if not content:
        warnings.append("正文是空的")

    # ---------- 阅读时长：先看 frontmatter，没写就按字数估 ----------
    raw_minutes = meta.get("readingMinutes", meta.get("reading_minutes"))
    if raw_minutes is None:
        reading_minutes = estimate_reading_minutes(content)
        warnings.append(f"缺 readingMinutes，按正文估成 {reading_minutes} 分钟")
    else:
        reading_minutes = to_int(raw_minutes, DEFAULT_READING_MINUTES)
        if str(raw_minutes).strip() and reading_minutes == DEFAULT_READING_MINUTES:
            warnings.append(f"readingMinutes 不是正整数（{raw_minutes!r}），已按 1 分钟处理")

    # ---------- 日期 ----------
    published_at, date_warning = to_date(meta.get("date", meta.get("published_at")))
    if date_warning:
        warnings.append(date_warning)

    # ---------- 草稿 ----------
    is_draft = to_bool(meta.get("draft", meta.get("is_draft")))

    # ---------- 长度上限提醒（表里 title 200 / description 500 / category 50） ----------
    if len(title) > 200:
        warnings.append(f"标题 {len(title)} 字，超过 200 的上限，后台编辑时会被驳回")
    if len(description) > 500:
        warnings.append(f"描述 {len(description)} 字，超过 500 的上限，后台编辑时会被驳回")
    if len(category) > 50:
        warnings.append(f"分类 {len(category)} 字，超过 50 的上限，后台编辑时会被驳回")

    fields = {
        "title": title,
        "slug": slug,
        "description": description,
        "content": content,
        "category": category,
        "tags": normalize_tags(meta.get("tags")),
        "reading_minutes": reading_minutes,
        "is_draft": is_draft,
        "published_at": published_at,
    }
    return fields, warnings


def main() -> int:
    parser = argparse.ArgumentParser(
        description="把 content/resources 下的 .mdx 文章导进 SQLite（只读源文件，不修改不删除）"
    )
    parser.add_argument(
        "--dir",
        default=str(REPO_ROOT / "content" / "resources"),
        help="MDX 所在目录，默认 content/resources",
    )
    parser.add_argument(
        "--update",
        action="store_true",
        help="库里已有同 slug 的文章时，用文件内容覆盖它（默认是跳过）",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="只演练不写库：看看会发生什么，最后统一回滚",
    )
    args = parser.parse_args()

    source_dir = Path(args.dir).resolve()
    if not source_dir.is_dir():
        print(f"✗ 找不到目录：{source_dir}")
        print("  检查一下 --dir 后面的路径，或者确认自己在仓库根目录下执行。")
        return 1

    files = sorted(source_dir.glob("*.mdx"))
    if not files:
        print(f"✗ 目录里没有 .mdx 文件：{source_dir}")
        return 1

    # 建表：create_all 只建「不存在」的表，已有数据一行都不动，可以放心重复执行
    Base.metadata.create_all(bind=engine)

    created = updated = skipped = failed = 0
    failures: list[tuple[str, str]] = []

    print(f"来源目录：{source_dir}")
    print(f"找到 {len(files)} 个 .mdx 文件" + ("（演练模式，不写库）" if args.dry_run else ""))
    print()

    with SessionLocal() as db:
        for index, path in enumerate(files, start=1):
            print(f"[{index}/{len(files)}] {path.name}")
            try:
                fields, warnings = build_fields(path)

                existing = (
                    db.query(models.Post)
                    .filter(models.Post.slug == fields["slug"])
                    .first()
                )

                print(
                    f"      slug={fields['slug']}  日期={fields['published_at'] or '未定'}  "
                    f"分类={fields['category']}  标签={len(fields['tags'])} 个  "
                    f"阅读={fields['reading_minutes']} 分钟  草稿={'是' if fields['is_draft'] else '否'}"
                )
                print(
                    f"      标题={fields['title']}  "
                    f"正文 {len(fields['content'])} 字 / 描述 {len(fields['description'])} 字"
                )

                if existing is not None and not args.update:
                    skipped += 1
                    print(f"      → 跳过：库里已有同 slug 的文章（id={existing.id}）")
                elif existing is not None:
                    for key, value in fields.items():
                        setattr(existing, key, value)
                    db.flush()
                    updated += 1
                    print(f"      → 已更新（id={existing.id}）")
                else:
                    post = models.Post(**fields)
                    db.add(post)
                    db.flush()  # flush 拿到自增 id；真正落盘要等最后的 commit
                    created += 1
                    print(f"      → 已新建（id={post.id}）")

                for warning in warnings:
                    print(f"      ⚠ {warning}")

            except Exception as exc:  # noqa: BLE001
                # 单篇失败不能拖垮整批：记下来，继续下一篇，最后统一汇报。
                # ValueError 是我们自己翻译过的人话，直接显示；
                # 其余异常保留类型名，方便我以后排查。
                failed += 1
                reason = (
                    str(exc)
                    if isinstance(exc, ValueError)
                    else f"{type(exc).__name__}: {exc}"
                )
                failures.append((path.name, reason))
                print(f"      ✗ 失败：{reason}")
            print()

        if args.dry_run:
            db.rollback()
            print("演练结束，已回滚 —— 数据库一个字节都没变。")
        else:
            db.commit()

        total = db.query(models.Post).count()
        drafts = db.query(models.Post).filter(models.Post.is_draft.is_(True)).count()

    print(
        f"===== 新建 {created} 篇，更新 {updated} 篇，跳过 {skipped} 篇，失败 {failed} 篇 ====="
    )
    print(f"数据库现在共 {total} 篇文章（其中草稿 {drafts} 篇）")

    if failed:
        print("\n失败明细（其余文章已经成功写入）：")
        for name, reason in failures:
            print(f"  ✗ {name} → {reason}")
        print("\n常见原因：frontmatter 的 YAML 写坏了（少个引号、缩进不一致），")
        print("或者文件被别的程序占用。修好对应的 .mdx 再跑一次即可，")
        print("已经成功的那些会被跳过，不会重复导入。")
        return 1

    if skipped and not args.update:
        print(
            f"\n提示：有 {skipped} 篇因为库里已存在同 slug 被跳过。"
            "想让文件内容覆盖库里那份，加 --update 再跑一次。"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
