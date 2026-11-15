"""站点 / 作者资料：一张表、一条记录、三个接口。

    GET  /api/profile           读资料 —— 公开（页面上那块「关于我」本来就是给访客看的）
    PUT  /api/profile           改文字（名字 / 副标题 / 签名 / 城市）—— 🔒 需登录
    POST /api/profile/avatar     传头像 —— 🔒 需登录，multipart

和老规矩一致：读的公开、写的必须登录（Depends(get_current_user)）。

这个模块和相册模块（photos.py）像是一对孪生兄弟，差别只有三条：

① 没有 id 参数。整张表只有 id=1 那一行，地址里写 id 反而是个假接口
   （/api/profile/2 永远 404，等于告诉调用者「这里有多个」）。
② 上传头像时**顺手删掉旧头像**。相册是「一张一条记录」，删了才删文件；
   头像是「一行里存一个文件名」，换新头像 = 旧文件立刻变成孤儿，
   不清就会在 uploads/avatars/ 里越堆越多（每次换头像留一个）。
③ 校验失败统一回 400（不是 /api/upload 那套 415 / 413）——
   跟相册模块的口径保持一致：同一个「上传图片」的动作，两处不该给出不同的状态码语义。
"""

import logging
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import images
import models
import schemas
from config import AVATAR_DIR
from database import get_db
from security import get_current_user

router = APIRouter(prefix="/api/profile", tags=["站点资料"])

logger = logging.getLogger(__name__)

# 这一行永远是它。写成常量而不是在三个函数里各写一遍 1 —— 数字 1 散落在代码里
# 是最难搜的那种「魔法值」，哪天要改（虽然不该改）会漏掉一处。
PROFILE_ID = 1

# 默认值 = 当前线上正在用的那套。只在「表里还没有这一行」时用一次（见 _get_or_create），
# 之后以数据库里的值为准 —— 后台改过之后，这里的常量就跟线上无关了。
DEFAULT_PROFILE = {
    "name": "旺仔冰子",
    "subtitle": "（恩师萧氏）",
    "bio": "泪水打湿猪脚饭，发誓要挣100万",
    "location": "济南",
}


def _get_or_create(db: Session) -> models.SiteProfile:
    """取 id=1 那一行；没有就建一行默认值。

    为什么「读接口」也带写的能力（没有就建）：
      这样「资料不存在」这个状态在接口层面根本不会出现，前端永远拿到一个完整对象。
      而如果读接口在空表时返回 404，前端就得处理 404 和「字段是 null」两套情况，
      多出来的分支一点价值都没有。

    为什么这个兜底建行和启动时那次建行**都留着**（main.lifespan 里也有一份）：
      启动时那次管「正常情况」；这里管「有人手工把那一行删了 / 从老库恢复了一个空表」。
      两处都只碰 id=1，谁先跑都不会插出第二行。
    """

    profile = db.get(models.SiteProfile, PROFILE_ID)
    if profile is not None:
        return profile

    profile = models.SiteProfile(id=PROFILE_ID, **DEFAULT_PROFILE)
    db.add(profile)
    try:
        db.commit()
    except IntegrityError:
        # 极小概率：两个请求同时发现「没有这一行」，都想插。数据库唯一约束挡掉后一个，
        # 这时这一行其实已经存在了，回滚再读一次就对了（不要报错给用户）。
        db.rollback()
        profile = db.get(models.SiteProfile, PROFILE_ID)
        if profile is None:
            raise
        return profile

    db.refresh(profile)
    logger.info("site_profile 原本没有 id=%s 那一行，已按默认值建好", PROFILE_ID)
    return profile


def _avatar_path(filename: str) -> Path:
    """库里的头像文件名 → 磁盘路径。

    套一层 Path(...).name：filename 是我们用 uuid 起的，理论上永远干净，
    但它是从库里读出来的 —— 万一被手工改成 "../../.env"，
    直接拼接就会让「删旧头像」跑到 avatars 目录外面去。和 photos._photo_path 同理。
    """

    return AVATAR_DIR / Path(filename).name


# ---------------------------------------------------------------- 查
@router.get("", response_model=schemas.ProfileOut, summary="读取站点资料（公开）")
def get_profile(db: Session = Depends(get_db)):
    """游客也能读 —— 首页 / 博客页那块「关于我」用的就是这份。"""

    return _get_or_create(db)


# ---------------------------------------------------------------- 改：文字
@router.put("", response_model=schemas.ProfileOut, summary="更新站点资料（🔒 需登录）")
def update_profile(
    payload: schemas.ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """只改传上来的字段（exclude_unset=True 区分「没传」和「传了 null」）。

    传 null 的两种含义，按字段分开处理：
      · subtitle / bio / location —— 传 null 是**有意义的**：把这项清空。
        （这三列在库里本来就允许 NULL，写 null 不会撞约束。）
      · name —— 传 null 视为「这次不改」。名字是必填的，真写进去会撞 NOT NULL 变成 500。
    """

    profile = _get_or_create(db)
    data = payload.model_dump(exclude_unset=True)

    nullable = {"subtitle", "bio", "location"}
    for field, value in data.items():
        if value is None and field not in nullable:
            continue
        setattr(profile, field, value)

    # 哪怕这次一个字段都没改也 commit：SQLAlchemy 发现没有任何列变化时不会发 UPDATE，
    # 所以 updated_at 也不会被刷 —— 这正好是我们要的（「没改」不该显示成「刚更新过」）。
    db.commit()
    db.refresh(profile)
    return profile


# ---------------------------------------------------------------- 改：头像
@router.post(
    "/avatar",
    response_model=schemas.ProfileOut,
    summary="上传 / 更换头像（🔒 需登录）",
)
async def upload_avatar(
    file: UploadFile = File(..., description="图片文件，支持 jpg / png / webp / gif，最大 5 MB"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """收一张图，校验、存盘、把文件名写进 id=1 那一行，回整个资料。

    前三步（空文件 / 认格式 / 数大小）和 /api/upload、/api/photos 一模一样，
    都是复用 images.py 里那套：只看文件头魔数，不信浏览器自称的类型；
    边读边数，超了就停，不把整个文件吞进内存。

    为什么接 async def：函数体里有 await file.read()，只要出现 await 就必须 async。

    写盘和写库的顺序、以及失败时的补偿，都见下面注释。
    """

    # ① 空文件：连 32 字节都读不到，说明压根没选东西（或选了空文件）
    head = await file.read(images.SNIFF_BYTES)
    if not head:
        await file.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="这个文件是空的（0 字节）。是不是选错了，选成了一个空文件？",
        )

    # ② 认格式：只认 jpg / png / webp / gif（svg 故意不收，它本质是能执行脚本的 XML）
    sniffed = images.sniff_extension(head)
    if sniffed is None:
        await file.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "这不是一张能用的头像图片。只支持 jpg / png / webp / gif 四种格式。"
                "如果你的文件确实是图，可能它只是改了后缀名（比如把 .webp 改成 .jpg），"
                "请用看图软件另存成真正的 png 或 jpg 再试。"
            ),
        )
    extension, _content_type = sniffed

    # ③ 边读边数：读满上限还没结束就停下
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
                    f"头像图片太大了：上限 {images.human_size(images.MAX_UPLOAD_BYTES)}，"
                    f"你这张已经超过它了。"
                    "头像在页面上最大也就显示 80 像素，先用看图软件缩到 400 像素见方再传。"
                ),
            )
        chunks.append(chunk)
    await file.close()

    # ④ 起名字 + 写文件。注意 file.filename 一个字都不参与路径（见 images.py 的长注释）。
    #    目录不存在就建 —— main.py 启动时也建过一次，这里再建一次是为了
    #    「服务运行期间有人把 avatars/ 目录删了」这种情况，免得上传直接 500。
    filename = images.safe_filename(extension)
    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    target = AVATAR_DIR / filename
    target.write_bytes(b"".join(chunks))

    # ⑤ 写库。先记下旧文件名，等新记录提交成功后才有资格删
    #    （万一 commit 失败，旧头像还得继续用 —— 提前删就等于把用户的头像弄丢了）。
    profile = _get_or_create(db)
    old_filename = profile.avatar
    profile.avatar = filename
    try:
        db.commit()
    except Exception:
        # 补偿：库没写成，磁盘上这个新文件就不该留着（它没有任何地方引用）
        db.rollback()
        target.unlink(missing_ok=True)
        raise

    db.refresh(profile)

    # ⑥ 清旧头像。放在提交之后、且吞掉异常：
    #    新头像已经生效了，这时删旧文件失败（权限、被占用）不该让整个请求报错 ——
    #    最坏结果只是 avatars/ 里多一个没人引用的文件，用户要的结果已经达成。
    if old_filename and old_filename != filename:
        try:
            _avatar_path(old_filename).unlink(missing_ok=True)
        except OSError:
            logger.warning("旧头像删不掉，先留着了：%s", old_filename, exc_info=True)

    logger.info(
        "头像已更新：%s → %s（%s，%s 字节）",
        old_filename or "（无）",
        filename,
        _content_type,
        total,
    )
    return profile
