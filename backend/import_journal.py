"""把 content/journal/*.mdx 这些「写在文件里的日记」导进 SQLite。

和 import_mdx.py 是同一个套路，只是字段少得多（日记只有 date / mood / 正文）。
先看那份脚本顶部的说明也能看懂九成，这里只讲**不一样的地方**：

① 去重靠「日期 + 内容」，不是靠文件名
   文章有 slug（文件名就是唯一标识），日记没有。
   所以判断「这条是不是已经导过」要比两样东西：
     · 这则日记的日期
     · 这则日记的正文（去掉首尾空白后逐字比较）
   为什么不能只比日期？因为同一天可能写两条（早上一条、晚上一条）。
   为什么不能只比内容？因为两天的日记内容有可能写得一模一样（比如都是「今天很累」）。
   两者一起比就够稳了。

② 时间怎么落库
   日记表只有 created_at 一个时间列。文件里给的是 **日期**（2026-10-28），没有时分秒。
   脚本统一把它补成**当天中午 12:00**，理由：
     · 存 00:00 的话，任何时区换算都可能把它挪到前一天；
     · 中午 12 点在 ±12 小时内怎么算都还是同一天，最不容易出错。
   这和「后台手写日记用当前时间」并不冲突：那批是真实发生时刻，这批只知道日期。

③ 空正文的条目会跳过
   文章空正文还能当占位，日记正文为空就是纯噪音（列表里会出现一张空卡）。

⚠️ 只读 .mdx，绝不修改、不删除原文件。原文件留着就是备份。

怎么跑（在任意目录都行，用后端那个虚拟环境的 python）：

    python backend/import_journal.py              ← 正常迁移：库里没有的新增，有的跳过
    python backend/import_journal.py --dry-run    ← 只演练，不写库
    python backend/import_journal.py --update     ← 库里已有同一条的，用文件内容覆盖它
    python backend/import_journal.py --dir 别的目录
"""

import argparse
import sys
from datetime import date, datetime, time
from pathlib import Path

# 让脚本在任意目录下执行都能 import 到 backend 里的模块
BACKEND_DIR = Path(__file__).resolve().parent
REPO_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

import frontmatter  # noqa: E402
import models  # noqa: E402
import yaml  # noqa: E402
from database import Base, SessionLocal, engine  # noqa: E402
from import_mdx import explain_yaml_error, to_date  # noqa: E402

# 没有 date 的日记退回用什么日期？用文件名的修改时间猜不可靠，直接报失败更诚实。
MAX_CONTENT_CHARS = 5000


def build_fields(path: Path) -> tuple[dict, list[str]]:
    """读一个 .mdx，翻成 Journal 表能用的字段。返回 (字段, 警告列表)。

    日记的 frontmatter 只有两个键：
        date: "2026-11-09"
        mood: "降温"
    """

    warnings: list[str] = []

    try:
        parsed = frontmatter.load(path)
    except yaml.YAMLError as exc:
        raise ValueError(explain_yaml_error(exc)) from exc

    meta = parsed.metadata or {}

    content = parsed.content.strip()
    if not content:
        raise ValueError("正文是空的 —— 日记只有一句话也不能没有正文")

    if len(content) > MAX_CONTENT_CHARS:
        warnings.append(
            f"正文 {len(content)} 字，超过接口上限 {MAX_CONTENT_CHARS}，"
            "已入库但之后在后台编辑保存时会被驳回"
        )

    # ---------- 日期 ----------
    # to_date 是文章脚本里的同一个函数：认 date 对象、"2026-11-02"、"2026/11/02"、"2026年11月2日"
    parsed_date, date_warning = to_date(meta.get("date", meta.get("created_at")))
    if date_warning:
        warnings.append(date_warning)
    if parsed_date is None:
        # 没有日期就没法排序、也没法去重。这类文件跳过比瞎猜一个日期好。
        raise ValueError("frontmatter 里没有可用的 date（格式应为 2026-11-09，要带引号）")

    # ---------- 心情 ----------
    raw_mood = meta.get("mood")
    mood = str(raw_mood).strip() if raw_mood is not None else ""
    if not mood:
        mood = None
    elif len(mood) > 20:
        warnings.append(f"心情「{mood}」超过 20 字，已截断")
        mood = mood[:20]

    fields = {
        "content": content,
        "mood": mood,
        # 当天中午 12:00（见文件头 ② 的解释）
        "created_at": datetime.combine(parsed_date, time(12, 0)),
    }
    return fields, warnings


def find_existing(db, fields: dict):
    """「日期 + 内容」都对得上，就算同一条。

    created_at 存的是当天 12:00，所以用 [当天 00:00, 次日 00:00) 这个区间比日期，
    而不是拿 created_at 和 12:00 做等值比较 —— 以后你要是把某条改成别的时间点，
    这条去重规则不该因此失效。
    """

    day: date = fields["created_at"].date()
    start = datetime.combine(day, time.min)
    end = datetime.combine(day, time.max)

    return (
        db.query(models.Journal)
        .filter(
            models.Journal.created_at >= start,
            models.Journal.created_at <= end,
            models.Journal.content == fields["content"],
        )
        .first()
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="把 content/journal 下的 .mdx 日记导进 SQLite（只读源文件，不修改不删除）"
    )
    parser.add_argument(
        "--dir",
        default=str(REPO_ROOT / "content" / "journal"),
        help="MDX 所在目录，默认 content/journal",
    )
    parser.add_argument(
        "--update",
        action="store_true",
        help="库里已有同一条（同日期同正文）时，用文件内容覆盖它的心情",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="只演练不写库：最后统一回滚",
    )
    args = parser.parse_args()

    source_dir = Path(args.dir).resolve()
    if not source_dir.is_dir():
        print(f"✗ 找不到目录：{source_dir}")
        return 1

    files = sorted(source_dir.glob("*.mdx"))
    if not files:
        print(f"✗ 目录里没有 .mdx 文件：{source_dir}")
        return 1

    # 建表：create_all 只建「不存在」的表。日记表是这轮新加的，第一次跑就会建出来。
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
                existing = find_existing(db, fields)

                print(
                    f"      日期={fields['created_at'].date()}  "
                    f"心情={fields['mood'] or '（无）'}  "
                    f"正文 {len(fields['content'])} 字"
                )

                if existing is not None and not args.update:
                    skipped += 1
                    print(f"      → 跳过：库里已有同一天、同正文的那条（id={existing.id}）")
                elif existing is not None:
                    existing.mood = fields["mood"]
                    db.flush()
                    updated += 1
                    print(f"      → 已更新心情（id={existing.id}）")
                else:
                    journal = models.Journal(**fields)
                    db.add(journal)
                    db.flush()
                    created += 1
                    print(f"      → 已新建（id={journal.id}）")

                for warning in warnings:
                    print(f"      ⚠ {warning}")

            except Exception as exc:  # noqa: BLE001
                # 单条失败不拖垮整批（和文章脚本同一套容错策略）
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

        total = db.query(models.Journal).count()

    print(f"===== 新建 {created} 条，更新 {updated} 条，跳过 {skipped} 条，失败 {failed} 条 =====")
    print(f"数据库现在共 {total} 条日记")

    if failed:
        print("\n失败明细（其余日记已经成功写入）：")
        for name, reason in failures:
            print(f"  ✗ {name} → {reason}")
        print("\n修好对应的 .mdx 再跑一次即可，已经成功的那些会被跳过，不会重复导入。")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
