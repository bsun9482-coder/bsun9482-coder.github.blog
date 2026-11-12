"""图片上传的两道关卡：这真的是图片吗？存成什么名字？

这个文件不碰数据库、不碰路由，只做两件纯函数的事，方便单独测试。

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
真想连坏图一起查，得用 Pillow 解析一遍（本项目暂时不装这个依赖）。

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
