"""相册的四组接口：列表 / 单张 / 上传 / 改描述 / 删除（共五个）。

地址前缀 /api/photos，和文章（/api/posts）、日记（/api/journals）保持同一套规矩：
    读（GET 列表、GET 单张）→ 公开，谁都能看
    写（POST / PUT / DELETE）→ 必须登录（Depends(get_current_user)）

和别的模块唯一的实质区别，是这里的「内容」有两个家：
    · 照片文件本身 → 磁盘 backend/uploads/photos/xxx.jpg（由 StaticFiles 直接对外）
    · 描述信息（标题/分类/排序）→ 数据库 photos 表
所以上传要写两处，删除也要清两处。两边不一致就会出现「库里有记录、图打不开」
或者「磁盘有图、相册里看不见」—— 下面每一步都在防这两种情况。

⚠️ 关于状态码：这个模块的校验失败**统一回 400**（按本模块的接口约定），
   而 /api/upload 那个接口回的是 415（类型不对）/ 413（太大）。
   两处语义都成立，只是口径不同；如果以后想统一，改这几个 raise 的 status_code 即可。
"""

from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import images
import models
import schemas
from config import PHOTO_DIR
from database import get_db
from security import get_current_user

router = APIRouter(prefix="/api/photos", tags=["相册"])

DEFAULT_CATEGORY = "日常"


def _photo_path(filename: str) -> Path:
    """把数据库里的文件名翻译成磁盘路径。

    为什么要套一层 Path(...).name？
      filename 是我们自己用 uuid 起的，理论上永远干净；但这条数据是从库里读出来的，
      万一有人手工改过库（把某个文件的 filename 改成 "../../.env"），
      直接拼接就会让删除操作跑到相册目录外面去。
      这不是过度防御 —— 一个「能删任意文件」的接口只要存在一次，后果就没法收拾。
    """

    return PHOTO_DIR / Path(filename).name


def _get_or_404(db: Session, photo_id: int) -> models.Photo:
    """按 id 取一张照片，取不到就 404（三个接口共用，省得各写一遍）。"""

    photo = db.scalar(select(models.Photo).where(models.Photo.id == photo_id))
    if photo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"没有找到 id 为 {photo_id} 的照片，可能已经被删掉了",
        )
    return photo


# ---------------------------------------------------------------- 查：列表
@router.get(
    "",
    response_model=list[schemas.PhotoOut],
    summary="照片列表（公开）",
)
def list_photos(
    category: str | None = Query(
        default=None,
        description="只看某个分类，例如 风景；不传就返回全部",
    ),
    db: Session = Depends(get_db),
):
    """按「排序号升序 → 拍摄时间新的在前」返回。

    为什么排序规则是这两个：
      · sort_order 是人工摆位置的唯一手段，它是主角，所以升序排在最前；
      · 大量照片的 sort_order 都是默认的 0（并列），这时得有个稳定的次序，
        否则刷新一次顺序就变。用 created_at 倒序是直觉选择：刚传的排前面。
      · 最后再挂一个 id 倒序兜底：同一秒传的两张，created_at 完全相同时靠它定序，
        保证「每次请求的顺序都一样」（可复现，截图和测试才靠得住）。
    """

    stmt = select(models.Photo).order_by(
        models.Photo.sort_order.asc(),
        models.Photo.created_at.desc(),
        models.Photo.id.desc(),
    )

    # 分类过滤：去掉前后空格再比，免得 ?category= 后面多一个空格就查不到东西
    keyword = (category or "").strip()
    if keyword:
        stmt = stmt.where(models.Photo.category == keyword)

    return db.scalars(stmt).all()


# ---------------------------------------------------------------- 查：单张
@router.get(
    "/{photo_id}",
    response_model=schemas.PhotoOut,
    summary="看一张照片（公开）",
)
def get_photo(photo_id: int, db: Session = Depends(get_db)):
    """取一张。id 不存在就是 404 —— 删掉之后再查同一个 id 会走到这里。"""

    return _get_or_404(db, photo_id)


# ---------------------------------------------------------------- 增：上传
@router.post(
    "",
    response_model=schemas.PhotoOut,
    status_code=201,
    summary="上传一张照片（🔒 需登录）",
)
async def create_photo(
    file: UploadFile = File(..., description="图片文件，支持 jpg / png / webp / gif，最大 5 MB"),
    title: str = Form(default="", max_length=200, description="照片标题，可以留空"),
    category: str = Form(default=DEFAULT_CATEGORY, max_length=50, description="分类，默认 日常"),
    sort_order: int = Form(default=0, ge=0, le=9999, description="排序号，越小越靠前"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """收一个文件 + 三个描述字段，校验、存盘、写库、回记录。

    校验顺序和 /api/upload 一致，是刻意这么排的 —— **先看类型，再看大小**：
      类型不对的文件（比如 200 MB 的视频）在第 32 个字节就能拒绝，
      不用把 200 MB 全读进内存才发现它不合格。

    为什么先写文件再写库？
      反过来的话（先写库后写文件），一旦写盘失败就会留下一条「指向不存在的图」
      的脏记录，相册页上就是一个永远加载不出来的灰块。
      而「文件写成功了、库写失败」只需要把那一个文件删掉就能回滚，
      所以这里在 except 里做了补偿删除。
    """

    # ① 空文件：连 32 字节都读不到，说明用户压根没选东西（或选了空文件）
    head = await file.read(images.SNIFF_BYTES)
    if not head:
        await file.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="这个文件是空的（0 字节）。是不是选错了，选成了一个空文件？",
        )

    # ② 认格式：只看文件头魔数，不相信浏览器自称的类型（见 images.py 的长注释）
    sniffed = images.sniff_extension(head)
    if sniffed is None:
        await file.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "这不是一张能用的图片。只支持 jpg / png / webp / gif 四种格式。"
                "如果你的文件确实是图，可能它只是改了后缀名（比如把 .webp 改成 .jpg），"
                "请用看图软件另存成真正的 png 或 jpg 再试。"
            ),
        )
    extension, _content_type = sniffed

    # ③ 边读边数：读满上限还没结束就停下，不把整个大文件吞进内存
    total = len(head)
    chunks = [head]
    while True:
        chunk = await file.read(images.CHUNK_SIZE)
        if not chunk:
            break
        total += len(chunk)
        if total > images.MAX_UPLOAD_BYTES:
            await file.close()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"图片太大了：上限 {images.human_size(images.MAX_UPLOAD_BYTES)}，"
                    f"你这张已经超过它了。"
                    "先用看图软件 / 截图工具压缩一下，或者把尺寸缩小到 1600 像素宽左右再传。"
                ),
            )
        chunks.append(chunk)
    await file.close()

    # ④ 起名字 + 写盘。file.filename 一个字都不参与路径 —— 它只当 alt 文案，连库都不进
    filename = images.safe_filename(extension)
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    target = PHOTO_DIR / filename
    target.write_bytes(b"".join(chunks))

    # ⑤ 写库。描述字段在这里顺手清洗：分类留空就回到默认值，标题只去空格
    photo = models.Photo(
        filename=filename,
        title=title.strip(),
        category=category.strip() or DEFAULT_CATEGORY,
        sort_order=sort_order,
        owner_id=current_user.id,
    )
    db.add(photo)
    try:
        db.commit()
    except IntegrityError:
        # 补偿：库没写成，磁盘上那张图就不该留着（否则永远没人能访问到它）
        db.rollback()
        target.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="这张照片没能存进数据库（文件名重复），请重试一次",
        )

    # refresh：把库里自动生成的值（id、created_at）读回来，否则返回体里这两项是空的
    db.refresh(photo)
    return photo


# ---------------------------------------------------------------- 改：描述
@router.put(
    "/{photo_id}",
    response_model=schemas.PhotoOut,
    summary="改照片标题 / 分类 / 排序（🔒 需登录）",
)
def update_photo(
    photo_id: int,
    payload: schemas.PhotoUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """只改传上来的字段。照片本身（文件）不动 —— 换图请删了重传。

    传 null 视为「这次不改」：这三列在库里都是 NOT NULL，
    真把 null 写进去会撞约束变成 500，不如一律跳过。
    """

    photo = _get_or_404(db, photo_id)
    data = payload.model_dump(exclude_unset=True)

    for field, value in data.items():
        if value is None:
            continue
        # 分类允许改成空字符串吗？不允许 —— 空分类的照片在筛选栏里点不出来
        if field == "category" and not str(value).strip():
            continue
        setattr(photo, field, value)

    db.commit()
    db.refresh(photo)
    return photo


# ---------------------------------------------------------------- 删
@router.delete("/{photo_id}", summary="删一张照片（🔒 需登录）")
def delete_photo(
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """先删数据库记录，再删磁盘文件。

    顺序为什么是「先库后文件」：
      反过来的话，万一删库失败，记录还在、图已经没了 —— 相册页上出现一个
      永远加载不出来的坏格子，而且你没法通过接口修它（只能手工登服务器）。
      先删库则最坏情况是「多出一个没人引用的文件」，占点磁盘、但不影响页面。

    文件不存在不报错（missing_ok=True）：可能是之前手工删过、或者被清理脚本扫走了。
    用户要的结果是「这张照片没了」，那个结果此时已经达成。
    """

    photo = _get_or_404(db, photo_id)
    path = _photo_path(photo.filename)

    db.delete(photo)
    db.commit()

    path.unlink(missing_ok=True)

    return {"message": "已删除", "id": photo_id}
