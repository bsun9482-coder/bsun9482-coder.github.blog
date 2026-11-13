"""配置：把「不该写死在代码里」的东西读到一处。

为什么要有这一层？
  SECRET_KEY 这种东西，写死在代码里就跟着代码进了 git —— 谁看到仓库谁就能伪造 token。
  所以它必须放在一个**不入库**的文件里（就是 backend/.env），代码只负责「读出来」。

.env 长这样（一行一个 KEY=VALUE）：
  SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  ALGORITHM=HS256
  ACCESS_TOKEN_EXPIRE_MINUTES=60

pydantic-settings 干的事：把这三行读成下面这个 Settings 对象的三个属性，
顺便帮你做类型转换（字符串 "60" → 整数 60）和校验（SECRET_KEY 少于 16 位直接报错）。
"""

from pathlib import Path

from pydantic import Field, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ 目录（本文件所在目录），用来拼出 .env 的绝对路径
BASE_DIR = Path(__file__).resolve().parent

# ---------------------------------------------------------------- 上传目录
# 图片存在哪、网页上从哪个地址能访问到。
#
# 为什么用「绝对路径」而不是相对路径 "uploads"？
#   相对路径是相对于「你敲命令时所在的目录」。在 backend/ 里启动 uvicorn，
#   它指向 backend/uploads；在仓库根目录启动，它就变成 <仓库根>/uploads，
#   同一份代码在两种地方启动会存进两个目录，找图时能让人怀疑人生。
#   Path(__file__).resolve().parent 永远指向 backend/，跟你在哪启动无关。
#
# 为什么目录名和网址路径分开写？
#   UPLOAD_DIR 是磁盘上的位置（可以随便改，比如挪到别的盘）；
#   UPLOAD_URL_PATH 是网页上的前缀（改了所有已发布文章的图片地址都会失效）。
#   两者含义不同，所以不合成一个变量。
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_URL_PATH = "/uploads"

# ---------------------------------------------------------------- 相册目录
# 相册的照片单独放一层子目录，不跟文章插图混在一起。
#
# 为什么只加子目录、不加挂载点？
#   上面那个 UPLOAD_DIR 已经整个挂成 /uploads 了，StaticFiles 会连子目录一起serve，
#   所以 backend/uploads/photos/a.jpg 自动就能用 /uploads/photos/a.jpg 打开 ——
#   不需要为相册再 mount 一次（多挂一次反而会和 /uploads 抢同一段地址）。
#
# 好处是删库/清空相册时，直接对这个目录下手就行，不会误伤文章的插图。
PHOTO_DIR = UPLOAD_DIR / "photos"
PHOTO_URL_PATH = f"{UPLOAD_URL_PATH}/photos"


class Settings(BaseSettings):
    # env_file 指向 backend/.env；extra="ignore" 表示 .env 里多写了没用的键也不报错
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # 签 token 用的密钥。换一把密钥 = 之前发出去的所有 token 立刻全部失效。
    secret_key: str = Field(min_length=16, description="JWT 签名密钥，至少 16 位")
    algorithm: str = Field(default="HS256", description="签名算法")
    access_token_expire_minutes: int = Field(default=60, ge=1, description="token 多少分钟后过期")

    # ---------------------------------------------------------- 允许跨域的来源
    # 部署形态是「前端和后端同一个域名」（nginx 把 /api 转给后端），所以浏览器的
    # 同源策略压根不会触发跨域检查 —— 这一项在正常情况下用不上。
    # 留它是因为两件事：
    #   ① 万一以后前端换到别的域名（比如 www 和裸域分成两个 site），忘了配会导致接口全挂，
    #      而报错信息长这样：「已阻止跨源请求」—— 新手很难联想到是后端配置。
    #   ② 别人拿浏览器从自己网页上直接调你的写接口时，浏览器会因为「响应里没有允许它的
    #      Access-Control-Allow-Origin」而读不到结果。
    # ⚠️ 它挡不住服务器之间的直连（curl / Python 脚本照样能调），真正的门锁是登录 token。
    # 多个来源用英文逗号分隔。
    cors_origins: str = Field(
        default="https://learnailab.cn,https://www.learnailab.cn",
        description="允许跨域的前端来源，逗号分隔",
    )


try:
    settings = Settings()
except ValidationError as exc:
    # 默认报错是一坨英文 ValidationError，新手看不懂。这里翻译成「缺什么、怎么办」。
    missing = ", ".join(str(e["loc"][0]) for e in exc.errors())
    raise SystemExit(
        "\n启动失败：缺少配置项 " + missing + "\n"
        "怎么修：把 backend/.env.example 复制一份改名成 backend/.env，\n"
        "        然后把 SECRET_KEY 换成一串你自己的随机字符（至少 16 位）。\n"
        "为什么：SECRET_KEY 是用来给登录凭证签名的密钥，绝不能写进代码、更不能进 git。\n"
    ) from exc
