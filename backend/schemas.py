"""请求 / 响应的「数据形状」+ 校验规则（Pydantic）。

为什么要单独一层 schema，而不是直接用 models.Post？
  两者管的不是一回事：
    · models.Post   —— 管**数据库里怎么存**（有哪些列、什么类型、默认值、索引）
    · schema        —— 管**接口收什么、还什么**（必填还是选填、长度多少、格式对不对）

它们分家的两个好处：
  1. 校验发生在进数据库之前。浏览器只要少传了 title、或者 reading_minutes 传成 -5，
     Pydantic 立刻拦下来，返回 422 和具体哪一项不对，根本不会碰到数据库。
  2. 响应用 PostRead 明确列出字段，等于一份诚实的接口说明（/docs 里能看到），
     也不会因为以后给表加了内部字段就意外泄露出去。

四个 schema 的分工：
  PostBase   —— 公共字段，避免四个类里复制粘贴
  PostCreate —— 新建时要填的（slug 必填）
  PostUpdate —— 更新时的（全部选填，只改你传了的字段）
  PostRead   —— 返回给前端的（多出 id 和两个时间戳）
"""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from config import PHOTO_URL_PATH


class PostBase(BaseModel):
    """公共字段。Field(...) 里的参数就是校验规则和 /docs 里的说明文字。"""

    title: str = Field(min_length=1, max_length=200, description="文章标题，不能为空")
    description: str = Field(default="", max_length=500, description="一句话摘要")
    content: str = Field(default="", description="Markdown 正文")
    category: str = Field(default="未分类", max_length=50, description="分类，例如 前端 / AI")
    tags: list[str] = Field(default_factory=list, description="标签数组，例如 [\"python\", \"入门\"]")
    reading_minutes: int = Field(default=1, ge=1, le=600, description="预计阅读分钟数，至少 1")
    is_draft: bool = Field(default=False, description="是否草稿")
    published_at: date | None = Field(default=None, description="发布日期，格式 2026-11-12")

    # 前后空格是最常见的输入事故（复制粘贴带空格），进库前统一清掉。
    @field_validator("title", "category", mode="before")
    @classmethod
    def _strip_text(cls, v):
        return v.strip() if isinstance(v, str) else v

    # 标签也顺手清理：去掉空格、丢掉空字符串，["  python ", ""] → ["python"]
    @field_validator("tags")
    @classmethod
    def _clean_tags(cls, v: list[str]) -> list[str]:
        return [t.strip() for t in v if isinstance(t, str) and t.strip()]


class PostCreate(PostBase):
    """新建文章：slug 必填，且只能是字母 / 数字 / 连字符 / 下划线。"""

    slug: str = Field(
        min_length=1,
        max_length=200,
        pattern=r"^[A-Za-z0-9_-]+$",
        description="地址里的短名，全站唯一；只能用英文、数字、- 和 _，例如 hello-world",
    )


class PostUpdate(BaseModel):
    """更新文章：所有字段都选填。

    只改你传上来的字段 —— 没传的保持原样。
    实现上靠 model_dump(exclude_unset=True)：它能区分「你没传」和「你传了 null」。
    """

    title: str | None = Field(default=None, min_length=1, max_length=200)
    slug: str | None = Field(default=None, min_length=1, max_length=200, pattern=r"^[A-Za-z0-9_-]+$")
    description: str | None = Field(default=None, max_length=500)
    content: str | None = None
    category: str | None = Field(default=None, max_length=50)
    tags: list[str] | None = None
    reading_minutes: int | None = Field(default=None, ge=1, le=600)
    is_draft: bool | None = None
    published_at: date | None = None

    @field_validator("title", "category", mode="before")
    @classmethod
    def _strip_text(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("tags")
    @classmethod
    def _clean_tags(cls, v):
        if v is None:
            return v
        return [t.strip() for t in v if isinstance(t, str) and t.strip()]


class PostRead(PostBase):
    """返回给前端的样子：在公共字段基础上，多出 id 和两个自动时间戳。"""

    # from_attributes=True：允许「用一个数据库对象」直接变成本 schema
    # （否则 Pydantic 只认字典，不认 Post 对象）。
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------- 日记
class JournalBase(BaseModel):
    """日记的公共字段：只有「写了什么」和「什么心情」两样。

    为什么不像文章那样拆一堆字段？
      因为日记的定位是「两三句话」：逼用户填标题、想 slug、选分类，
      结果就是他不写了。字段少是**故意的**，不是偷懒。

    content 的 min_length=1 有个前置动作：下面的校验器先把前后空格去掉，
    所以「只敲了几个空格」也会被判为空 → 422。这条是新手最常踩的坑之一。
    """

    content: str = Field(
        min_length=1,
        max_length=5000,
        description="日记正文，纯文本；几句话就行，空行分段",
    )
    mood: str | None = Field(
        default=None,
        max_length=20,
        description="心情，可空；例如「不错」「卡住」「降温」",
    )

    @field_validator("content", mode="before")
    @classmethod
    def _strip_content(cls, v):
        return v.strip() if isinstance(v, str) else v

    # 心情留空时统一存 null，而不是空字符串 —— 否则前端要同时判 "" 和 null 两种「没有」
    @field_validator("mood", mode="before")
    @classmethod
    def _clean_mood(cls, v):
        if not isinstance(v, str):
            return v
        text = v.strip()
        return text or None


class JournalCreate(JournalBase):
    """新建日记。字段和公共字段完全一致，单开一个类是为了和 PostCreate 对称、以后好加字段。"""


class JournalUpdate(BaseModel):
    """更新日记：全部选填（只改你传了的字段）。

    注意这里**不能**直接继承 JournalBase —— 那个类要求 content 必填，
    而「只改心情不碰正文」是合法操作。
    """

    content: str | None = Field(default=None, min_length=1, max_length=5000)
    mood: str | None = Field(default=None, max_length=20)

    @field_validator("content", mode="before")
    @classmethod
    def _strip_content(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("mood", mode="before")
    @classmethod
    def _clean_mood(cls, v):
        if not isinstance(v, str):
            return v
        text = v.strip()
        return text or None


class JournalRead(JournalBase):
    """返回给前端的样子：多一个 id 和写入时间。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


# ---------------------------------------------------------------- 登录相关
class LoginRequest(BaseModel):
    """登录只收两个字段。

    注意这里**没有**任何长度下限以外的手续 —— 密码规则故意写得松，
    因为校验密码对不对不是 schema 的活，是去数据库比对哈希的活。
    这里只管「你确实填了东西」。
    """

    username: str = Field(min_length=1, max_length=50, description="用户名")
    password: str = Field(min_length=1, max_length=128, description="密码（明文，只在这一刻存在于内存里）")

    @field_validator("username", mode="before")
    @classmethod
    def _strip_username(cls, v):
        # 用户名前后带空格是最常见的手滑（手机输入法自动加空格）
        return v.strip() if isinstance(v, str) else v


class TokenResponse(BaseModel):
    """登录成功后返回的东西。

    access_token 是主角，其余三项是给人看的：
      token_type —— 固定 "bearer"，意思是「用的时候前面加 Bearer 一个空格」
      expires_in —— 多少秒后过期，前端可以据此提前提醒「该重新登录了」
      username   —— 方便你在界面上显示「当前登录：admin」
    """

    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="多少秒后过期")
    username: str


class UserRead(BaseModel):
    """返回用户信息时**绝对不能**带 password_hash —— 这就是单开一个 schema 的意义。

    如果偷懒直接返回 models.User，那串哈希会一起吐给前端，
    虽然哈希不能反推密码，但泄露出去毫无必要，还会被人拿去离线爆破。
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    created_at: datetime


# ---------------------------------------------------------------- 图片上传
class UploadRead(BaseModel):
    """上传成功后回给前端的东西 —— 前端只需要 url 那一项，其余是给人看的。

    url        ✅ 主角：直接写进 Markdown 的 ![](...) 里
    filename   磁盘上的真实文件名（uuid 起的，改了它等于换一张图）
    size       字节数，前端可以显示「这张图 240 KB」
    content_type 服务器**自己认出来**的类型（不是浏览器自称的那个）
    original_name 你上传时的文件名，只用来当 alt 文案（"截图 2026-11-13.png"）
    """

    filename: str
    url: str = Field(description="图片网址，例如 /uploads/3f2b9c...jpg")
    size: int = Field(description="字节数")
    content_type: str = Field(description="服务器按文件内容认出来的 MIME 类型")
    original_name: str = Field(description="上传时的原始文件名，仅用于展示")


class UploadedFileInfo(BaseModel):
    """GET /api/uploads 里的一项：编辑器挑图时用。"""

    filename: str
    url: str
    size: int
    uploaded_at: datetime


# ---------------------------------------------------------------- 相册
# 相册只做「改描述」这一种写操作 —— 照片本身是上传时就定死的，改图等于换一张。
# 所以这里没有 PhotoCreate：新建走 multipart 表单（文件 + 三个字段），
# 表单字段在路由里用 Form(...) 声明，不走请求体 schema。
class PhotoUpdate(BaseModel):
    """更新一张照片的描述：标题、分类、排序号，三个都选填。

    只改你传上来的字段（靠 model_dump(exclude_unset=True)），
    只想改标题时不会把分类和排序号一起清掉。
    """

    title: str | None = Field(default=None, max_length=200, description="照片标题，可以留空")
    category: str | None = Field(default=None, max_length=50, description="分类，例如 日常 / 学习 / 风景")
    sort_order: int | None = Field(
        default=None, ge=0, le=9999, description="排序号，越小越靠前"
    )

    @field_validator("title", "category", mode="before")
    @classmethod
    def _strip_text(cls, v):
        return v.strip() if isinstance(v, str) else v


class PhotoOut(BaseModel):
    """返回给前端的照片样子。

    url 是**算出来的**，不是数据库里的列：
      磁盘上叫 3f2b9c.jpg，对外地址就是 /uploads/photos/3f2b9c.jpg。
      这层换算写在这里（而不是让前端自己拼），是为了以后改存储目录时
      只需要动 config.py 一个常量，前端一行都不用改。

    filename 用 exclude=True：它对接口使用者没有意义（url 已经能拿到图了），
    但算 url 又必须读到它 —— 所以留在模型里、不进 JSON。
    （`orm_mode` 是 Pydantic v1 的叫法，v2 改名成 from_attributes，作用一样：
      允许「一个数据库对象」直接变成本 schema。）
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    category: str
    sort_order: int
    created_at: datetime
    filename: str = Field(exclude=True, description="磁盘文件名，仅内部使用，不返回给前端")

    @computed_field(description="图片地址，例如 /uploads/photos/3f2b9c.jpg")
    @property
    def url(self) -> str:
        return f"{PHOTO_URL_PATH}/{self.filename}"
