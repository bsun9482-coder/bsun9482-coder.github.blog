"""安全相关的三件事，全在这一个文件里：

  1. 密码哈希   hash_password / verify_password
  2. 签发 token  create_access_token
  3. 验证 token  get_current_user（这是个「依赖」，接口里写 Depends(get_current_user) 就能用）

---------------------------------------------------------------- 先讲清楚两个概念

【一】密码为什么不能存明文？「哈希」到底是什么？

哈希就是一个「只能往前、不能回头」的计算：
    密码  ──算一次──▶  一串乱码（哈希值）
    密码  ◀──对不起，算不回去──  一串乱码

它跟「加密」不一样。加密是把门锁上、有钥匙就能开；哈希是把纸塞进碎纸机，
没人能拼回原样。所以库里存的只是那堆碎纸。

那怎么验证「你输的密码对不对」？
  不是解开碎纸，而是：把你这次输的密码**也丢进同一台碎纸机**，
  比较两堆碎纸是否一模一样。一样 → 密码正确。

为什么还要「加盐」（salt）？
  同样的密码，碎纸机每次都掺一点不同的随机佐料，所以：
    admin123 → $2b$12$KIXQJ8...（第一次）
    admin123 → $2b$12$9fLpQ2...（第二次，完全不同）
  这样做的好处：坏人没法预先算好一张「常见密码 → 哈希值」的大表来反查。
  这个佐料就藏在哈希串本身里，所以验证时不需要你额外记任何东西。

（bcrypt 还有个故意设计：算一次要花 0.1 秒左右。你觉得慢，但攻击者想爆破
 几亿次就得花几年 —— 慢是它的优点，不是缺点。）

【二】JWT 是什么？为什么说它是「通行证」？

登录成功后，服务器发给你一张字符串（token）。之后每个写操作请求都带上它，
服务器一看签名是真的、没过期，就放行。

它长这样，三段用点隔开：
    eyJhbGciOiJIUzI1NiJ9 . eyJzdWIiOiJhZG1pbiIsImV4cCI6MTc2...} . 4mQ9x7...
    └── 头部：用什么算法签的 ─┘ └── 内容：我是谁、什么时候过期 ─┘ └─ 签名 ─┘

关键在于第三段「签名」：
  它是用服务器手里的 SECRET_KEY 对前两段算出来的指纹。
  别人可以随便改前两段（把 sub 改成别人的用户名），但**没有 SECRET_KEY
  就算不出对应的签名**，服务器一验就发现对不上，直接拒绝。
  所以这张通行证既不用存数据库（服务器不需要记「我发过哪些」），又改不了。

也因为前两段是「可读但不可改」的，所以 token 里绝不放密码这类秘密 ——
它只是 base64 编码，不是加密，任何人拿去都能看到内容。
"""

from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import ExpiredSignatureError, JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.orm import Session

import models
from config import settings
from database import get_db

# ---------------------------------------------------------------- 密码哈希
# CryptContext 是「密码处理器」：schemes 里写用哪个算法，deprecated="auto" 意思是
# 以后有更强算法时，旧哈希还能验、新密码自动用新的（现在只有一个 bcrypt，用不上）。
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# bcrypt 的硬限制：只认前 72 个字节。超了不同版本行为不一样（新版直接报错，
# 老版悄悄截断），为了不踩这个坑，我们自己先拦住并回一句人话。
MAX_PASSWORD_BYTES = 72


def hash_password(plain: str) -> str:
    """明文密码 → 哈希值（60 个字符）。存库只存这个返回值。"""

    if len(plain.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError(f"密码太长了（超过 {MAX_PASSWORD_BYTES} 字节，一个汉字算 3 个），请缩短一点")
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """这次输入的密码，和库里那堆碎纸是不是同一个来源。

    注意：它返回 True / False，**不会**抛异常，所以调用处不用担心密码错就崩。
    """

    try:
        return pwd_context.verify(plain, hashed)
    except ValueError:
        # 库里那条哈希格式坏了（比如手工改过库）也会走到这里，
        # 这种情况一律当「密码不对」处理，不要让服务 500。
        return False


# ---------------------------------------------------------------- 签发 token
def create_access_token(username: str) -> str:
    """把「我是谁 + 什么时候过期」签成一张通行证。

    三个字段：
      sub —— subject，这里放用户名（标准字段名，前端解码时认这个）
      exp —— 过期时间。**JWT 库会自动检查它**，过了这个点 decode 直接报错，
             不需要我们自己比时间（自己写容易踩时区坑）。
      iat —— issued at，签发时间，方便以后排查「这个 token 是哪天发的」。
    """

    now = datetime.now(timezone.utc)
    payload = {
        "sub": username,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    # 用 SECRET_KEY 签名。密钥只在这个时刻和验证那一刻用到，绝不外传。
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


# ---------------------------------------------------------------- 验证 token
# OAuth2PasswordBearer 干的事和 HTTPBearer 差不多：从请求头 Authorization: Bearer xxx
# 里把 xxx 抠出来。区别在 /docs 的 Authorize 按钮上，这一点很关键：
#   · HTTPBearer     → 按钮点开是「一个输入框，让你粘贴 token」（要手工复制 147 个字符，容易抄错）
#   · OAuth2PasswordBearer → 按钮点开是「用户名 + 密码两个框」，点 Authorize 后
#                            **Swagger 自己去调 tokenUrl 换 token 并存在浏览器里**，你完全不用碰 token。
#   所以第二种对新手友好得多。tokenUrl 指向下面那个表单版登录接口 /api/auth/token。
# auto_error=False：没带 token 时**不**让 FastAPI 自己回 403（那串英文不好懂），
# 而是把 None 交给我们，由我们回一句中文 401。
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/token",
    auto_error=False,
    description="点右上角 Authorize，直接填用户名和密码即可，不需要手动复制 token",
)


def _unauthorized(message: str) -> HTTPException:
    """401 统一出口。

    ⚠️ 一定要带 WWW-Authenticate 头：这是 HTTP 规范的要求，
    少了它有些客户端（包括部分 Swagger 版本）不会认为「需要重新认证」。
    """

    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=message,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    """接口里写 current_user = Depends(get_current_user)，就等于「必须先登录才能进」。

    执行顺序（这是「依赖」最反直觉、也最需要理解的一点）：
      请求进来 → 先跑这个函数 → 只有它正常 return，你的接口函数才会被执行；
      它一 raise，接口函数一行都不会跑，直接返回 401。

    三种失败情况分开报，用户才知道该干嘛：
      没带 token    → 401「还没登录」
      token 伪造/坏 → 401「凭证无效」
      token 过期    → 401「登录过期了，请重新登录」
    """

    if not token:
        raise _unauthorized("还没登录：点右上角 Authorize，填用户名和密码，点 Authorize 按钮即可")

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except ExpiredSignatureError:
        # 过期是单独一类异常，必须放在 JWTError 前面捕获（它是 JWTError 的子类，
        # 顺序写反就永远只会看到「凭证无效」这句笼统的提示）。
        raise _unauthorized("登录已过期，请重新登录拿一个新 token")
    except JWTError:
        raise _unauthorized("凭证无效：token 被改过、或者不是这台服务器签发的")

    username = payload.get("sub")
    if not username:
        raise _unauthorized("凭证无效：token 里没有用户信息")

    # 为什么签了名还要回数据库查一次？
    #   因为「这个用户可能已经被删了」。只验签名的话，删掉用户后他手里的 token
    #   在过期前仍然有效。多查一次的成本很低（主键索引），换来的是「删人即失效」。
    user = db.scalar(select(models.User).where(models.User.username == username))
    if user is None:
        raise _unauthorized(f"账号「{username}」已经不存在了，请重新登录")

    return user


def read_optional_user(request: Request, db: Session) -> models.User | None:
    """「顺便问一句」版的身份识别：带了有效 token 就返回用户，否则返回 None，**从不报错**。

    什么时候需要它？
      同一个接口要区分两种人。比如文章列表：
        游客   → 只给已发布的
        作者   → 连草稿一起给
      这时候不能用 get_current_user（它会拦下游客），也不该做两个接口。

    ⚠️ 为什么参数是 Request 而不是 Depends(oauth2_scheme)？
      因为 FastAPI 会把「依赖里用到的安全方案」写进 /docs 的接口说明。
      如果这里也挂 oauth2_scheme，那 /docs 会给「文章列表」加一把锁，
      让人误以为它必须登录才能调 —— 而它其实是公开的。
      改成自己读请求头，/docs 就只在这接口真的需要登录时才画锁。
      代价是多五行解析，换来的是接口文档不说谎。

    用法（注意它是个普通函数，调用处要自己传 db）：
        user = read_optional_user(request, db)
    """

    header = request.headers.get("Authorization", "")
    if not header.lower().startswith("bearer "):
        return None

    token = header[7:].strip()  # 去掉 "Bearer " 这 7 个字符
    if not token:
        return None

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        # 过期、伪造、乱写 —— 这里一律当「没登录」处理，不报错。
        return None

    username = payload.get("sub")
    if not username:
        return None

    return db.scalar(select(models.User).where(models.User.username == username))
