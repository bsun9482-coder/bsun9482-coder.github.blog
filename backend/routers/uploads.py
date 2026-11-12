"""图片上传：POST /api/upload（写）+ GET /api/uploads（列出已上传的）。

一句话说清「图片是怎么从浏览器到服务器的」：

    浏览器                          后端
    ──────                          ────
    用户选文件
      ↓
    包成 multipart/form-data  ──▶   ① 先过登录这道门（没有 token 直接 401）
    （正文里混着「文件字节 + 文件名 + 自称的类型」）
                                    ② 看文件开头 32 个字节，认不出图片格式 → 415
                                    ③ 一路往下读，读满 5 MB 还没结束 → 413
                                    ④ 用 uuid 起个名字，写进 backend/uploads/
                                    ⑤ 回一个网址：/uploads/xxx.jpg
      ◀── { url: "/uploads/xxx.jpg", ... }
    把 url 写进 Markdown：![名字](/uploads/xxx.jpg)

两个接口的分工和老规矩一致：读的可以公开，写的一定要登录。

⚠️ 注意 GET /api/uploads 我加了登录保护（虽然任务里说「可选」）：
   它列的是「你这台机器上有哪些图」，属于后台信息，没理由对游客开放。
   而图片文件本身（/uploads/xxx.jpg）是公开的 —— 文章正文里的图，读者当然要能看。
"""

from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

import images
import models
import schemas
from config import UPLOAD_DIR, UPLOAD_URL_PATH
from database import get_db
from security import get_current_user

router = APIRouter(tags=["图片上传"])


def _existing_uploads() -> list[Path]:
    """把上传目录里的图片列出来（只认白名单扩展名，别的东西一律不看）。

    为什么要过滤？
      那个目录是磁盘上的普通文件夹，可能混进 .DS_Store、说明.txt、甚至你手动放的
      备份文件。列表接口只该说「有哪些图」，不该把目录里的一切都抖出来。
    """

    if not UPLOAD_DIR.is_dir():
        return []
    allowed = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    return [
        item
        for item in UPLOAD_DIR.iterdir()
        if item.is_file() and item.suffix.lower() in allowed
    ]


# ---------------------------------------------------------------- 增：上传一张
@router.post(
    "/api/upload",
    response_model=schemas.UploadRead,
    status_code=201,
    summary="上传一张图片（🔒 需登录）",
)
async def upload_image(
    file: UploadFile = File(..., description="图片文件，支持 jpg / png / webp / gif，最大 5 MB"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """收一个文件，校验，存盘，回网址。

    为什么这个函数是 async def 而别的接口是 def？
      UploadFile.read() 是异步的（文件可能来自网络/spool 目录，读的时候要让出控制权）。
      只要函数体里出现 await，函数就必须声明成 async。

    校验顺序是刻意安排的 —— 先看「类型」再看「大小」：
      类型不对的文件（比如一个 200 MB 的视频）在第 32 个字节就能拒绝，
      不用把 200 MB 全读进内存再发现它不合格。
    """

    # ① 空文件：连 32 字节都读不到，说明用户压根没选东西（或选了空文件）
    head = await file.read(images.SNIFF_BYTES)
    if not head:
        await file.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="这个文件是空的（0 字节）。是不是选错了，选成了一个空文件？",
        )

    # ② 认格式：认不出就是 415（Unsupported Media Type，语义上正好是「类型不支持」）
    sniffed = images.sniff_extension(head)
    if sniffed is None:
        await file.close()
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                "这不是一张能用的图片。只支持 jpg / png / webp / gif 四种格式。"
                "如果你的文件确实是图，可能它只是改了后缀名（比如把 .webp 改成 .jpg），"
                "请用看图软件另存成真正的 png 或 jpg 再试。"
            ),
        )
    extension, content_type = sniffed

    # ③ 边读边数：读满上限还没结束就停下，不用把整个大文件吞进内存
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
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail=(
                    f"图片太大了：上限 {images.human_size(images.MAX_UPLOAD_BYTES)}，"
                    f"你这张已经超过它了。"
                    "先用看图软件 / 截图工具压缩一下，或者把尺寸缩小到 1600 像素宽左右再传。"
                ),
            )
        chunks.append(chunk)
    await file.close()

    # ④ 起名字 + 写盘。注意：file.filename 一个字都不参与路径（见 images.py 的长注释）
    filename = images.safe_filename(extension)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    (UPLOAD_DIR / filename).write_bytes(b"".join(chunks))

    return {
        "filename": filename,
        "url": f"{UPLOAD_URL_PATH}/{filename}",
        "size": total,
        "content_type": content_type,
        "original_name": images.display_name(file.filename),
    }


# ---------------------------------------------------------------- 查：已上传的图片
@router.get(
    "/api/uploads",
    response_model=list[schemas.UploadedFileInfo],
    summary="已上传的图片列表（🔒 需登录，最新在前）",
)
def list_uploads(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """给编辑器用：想知道「之前传过哪些图」，免得同一张图反复上传。

    排序按文件的修改时间倒序 —— 刚传的在最前面。
    """

    files = sorted(_existing_uploads(), key=lambda p: p.stat().st_mtime, reverse=True)
    return [
        {
            "filename": item.name,
            "url": f"{UPLOAD_URL_PATH}/{item.name}",
            "size": item.stat().st_size,
            "uploaded_at": datetime.fromtimestamp(item.stat().st_mtime),
        }
        for item in files
    ]
