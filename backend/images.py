"""图片上传的三道关卡：这真的是图片吗？存成什么名字？顺手缩一张小的。

这个文件不碰数据库、不碰路由，只做纯函数的事，方便单独测试。

⚠️ 第 44 轮起装了 Pillow，但**校验仍然只靠魔数**（下面第一大段说的理由不变）。
   Pillow 只用来做缩略图那件事（见文件末尾）。为什么不顺手用它校验「图有没有坏」：
   解析整张图比看 32 个字节慢两个数量级，而坏图在生成缩略图那一步本来就会抛异常，
   我们会把那张图标记成「没有缩略图」并照常入库 —— 校验的收益抵不过多等的那几百毫秒。

----------------------------------------------------------- 一、为什么不能只看 Content-Type？

浏览器上传文件时，会在请求里附一句话：「这个文件是 image/png」。
但那句话是**客户端自己说的**，任何人写几行脚本都能把 .exe 说成 image/png。
所以「看一眼它自称的类型就信」等于没校验。

真正靠得住的证据在文件**内容**里：每种图片格式的头几个字节是固定的，
这几十年不变的字节叫「魔数」（magic number）：

    PNG   89 50 4E 47 0D 0A 1A 0A       （开头就是 \\x89PNG\\r\\n\\x1a\\n）
    JPEG  FF D8 FF                       （几乎所有 .jpg 都以这三个字节开头）
    GIF   "GIF87a" 或 "GIF89a"           （ASCII 明文，很好认）
    WEBP  "RIFF" + 4 字节长度 + "WEBP"   （RIFF 是容器格式，里面装的才是 WEBP）

把木马改名成 cat.jpg，前三个字节对不上 FF D8 FF，这里就 415 挡回去了。
代价是这种方式只认「格式对不对」，不认「图有没有坏」——
坏图不会在这里被拦下，而是在生成缩略图时抛异常（那边会兜住，见文件末尾）。

----------------------------------------------------------- 二、为什么文件名必须自己起？

客户端传上来的文件名是**不可信输入**，直接拿来用有三个坑：

① 撞名
   你和三个月前的你（或另一个同事）都传了 avatar.png，后一张会把前一张覆盖掉。
   文章里那张旧图的地址还在，但内容已经换了 —— 这种 bug 极难发现。

② 路径穿越（这个最危险）
   文件名可以被伪造成 "../../../.env" 或 "..\\..\\backend\\.env"。
   如果代码写成 open(UPLOAD_DIR / filename)，它就会真的往上传目录**外面**写，
   轻则覆盖配置，重则覆盖代码文件。这类攻击叫 path traversal。

③ 可执行后缀
   "shell.php.jpg"、"a.jsp" 这类名字在某些服务器配置下会被**当成程序执行**。
   所以扩展名绝不能从用户给的名字里取。

对策一句话：**名字只由我们生成，用户给的名字只用来做展示（alt 文案），
一个字符都不参与磁盘路径。**
具体做法是 uuid4().hex（32 个十六进制字符，重复概率低到可以忽略）+ 从魔数**推出来**的扩展名。
"""

from pathlib import Path
from uuid import uuid4

# ---------------------------------------------------------------- 大小上限
# 5 MB。挑这个数的理由：手机上随手拍的截图/照片通常在 0.5–4 MB，
# 5 MB 能覆盖绝大多数「想往文章里插一张图」的场景；
# 再大就该先压缩了（原图直接塞进网页，读者加载会很难受）。
MAX_UPLOAD_BYTES = 5 * 1024 * 1024

# 一次性读多少字节。8 KB 是磁盘一个块的大小量级，属于「不大不小」的常规选择。
CHUNK_SIZE = 8 * 1024

# 只看前 32 字节就够判断所有格式了（WEBP 需要看到第 12 字节）
SNIFF_BYTES = 32


def human_size(size: int) -> str:
    """把字节数说成人话：5242880 → "5.0 MB"。

    报错信息里写「5242880 字节」没人看得懂，写「5.0 MB」才有意义。
    """

    if size < 1024:
        return f"{size} 字节"
    if size < 1024 * 1024:
        return f"{size / 1024:.1f} KB"
    return f"{size / (1024 * 1024):.1f} MB"


def sniff_extension(head: bytes) -> tuple[str, str] | None:
    """看文件开头几个字节，判断它到底是什么格式。

    返回 (扩展名, MIME 类型)，例如 (".png", "image/png")；
    认不出来就返回 None —— 调用处据此回 415。

    为什么只认这四种？
      这四种浏览器都原生支持，插进文章里读者一定能看到。
      svg 故意不收：svg 本质是「能写脚本的 XML」，传上来再被当图片打开，
      等于给站点开了一个 XSS 后门（这次不做，是因为拦它比支持它重要）。
    """

    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png", "image/png"

    # JPEG 的前三个字节。第 4 个字节通常也是 0xE0/0xE1 之类，但没必要那么严。
    if head.startswith(b"\xff\xd8\xff"):
        return ".jpg", "image/jpeg"

    if head.startswith(b"GIF87a") or head.startswith(b"GIF89a"):
        return ".gif", "image/gif"

    # WEBP：RIFF 容器，偏移 8 处写着真正的格式名
    if len(head) >= 12 and head.startswith(b"RIFF") and head[8:12] == b"WEBP":
        return ".webp", "image/webp"

    return None


def safe_filename(extension: str) -> str:
    """生成一个「不会撞、也没法被伪造」的文件名：uuid + 扩展名。

    例：3f2b9c...（32 位）+.jpg → 3f2b9c8e4d1a4f6b9c0d2e4a6b8c0d1e.jpg
    """

    return f"{uuid4().hex}{extension}"


# ---------------------------------------------------------------- 缩略图
# 缩略图宽度定 480：相册格子最宽 220 像素，手机 2 倍屏需要 440，
# 480 留了一点余量。再宽就是浪费流量，再窄在 2 倍屏上会糊。
THUMB_MAX_WIDTH = 480

# 缩略图统一存 webp：同画质下比 jpg 小 25–35%，而现在的浏览器全都支持。
THUMB_QUALITY = 82


def thumb_filename(filename: str) -> str:
    """原图名 → 缩略图名：3f2b9c.jpg → 3f2b9c_thumb.webp

    这里只是「起名字的规矩」，真正有没有这张图由 `photos.thumb_filename` 那一列说了算：
    写库时存的就是这个函数算出来的名字，读的时候不重算。
    为什么不读的时候按规矩现推？因为「有个文件在那」是个事实，不该藏进命名约定里 ——
    缩略图生成失败时这一列是 NULL，现推就会推到一个不存在的地址上去。
    """

    stem = Path(filename).stem
    return f"{stem}_thumb.webp"


def make_thumbnail(source: Path, target: Path, max_width: int = THUMB_MAX_WIDTH) -> None:
    """把 source 缩成 max_width 宽的小图写到 target。

    三件容易出错、这里都处理了的事：

    ① EXIF 方向
       手机竖着拍的照片，像素其实是横着存的，靠 EXIF 里一个「旋转 90 度」的标记
       让看图软件摆正。不处理的话，相册里的缩略图会躺倒 —— 而原图打开却是正的。

    ② 颜色模式
       webp 只认 RGB / RGBA。png 常见的那种调色板图（P 模式）、灰度图（L 模式）
       直接存会抛异常，所以先统一转一遍。

    ③ 不放大小图
       原图比 480 还窄时（比如一个 200 像素宽的小图标），不该被"放大"成 480 ——
       放大只会变糊、还更占空间。所以只缩不放。

    这个函数失败时由调用方决定怎么办（我们那边是「记一条 warning、缩略图留空」），
    不让一张坏图把整个上传流程炸掉。
    """

    from PIL import Image, ImageOps

    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image)

        width, height = image.size
        if width > max_width:
            new_height = round(height * max_width / width)
            image = image.resize((max_width, new_height), Image.LANCZOS)

        has_alpha = image.mode in ("RGBA", "LA") or (
            image.mode == "P" and "transparency" in image.info
        )
        image = image.convert("RGBA" if has_alpha else "RGB")

        image.save(target, format="WEBP", quality=THUMB_QUALITY, method=4)


def display_name(raw_name: str | None) -> str:
    """用户给的文件名，只留最后一段，纯粹拿来当图片的 alt 文案。

    Path(...).name 会把 "a/b/c.png" 和 "..\\..\\x.png" 都削成 "x.png"，
    这样即使它带着路径，也进不了我们的磁盘路径。
    """

    if not raw_name:
        return "图片"
    name = Path(raw_name.replace("\\", "/")).name.strip()
    # 留一点长度余量，避免有人传一个 5000 字符的名字把页面撑坏
    return name[:120] or "图片"
