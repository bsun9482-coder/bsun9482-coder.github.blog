"""数据库表的模型定义 —— ORM 的核心就在这个文件里。

四张表：posts（文章）、users（能登录后台的人）、journals（日记）、photos（相册）。

ORM 是什么？一句话：**用写类的方式来操作数据库表**。

不用 ORM 时，你得自己手写 SQL 字符串：
    SELECT * FROM posts WHERE slug = 'hello'
用 ORM 之后，你写的是 Python：
    db.scalar(select(Post).where(Post.slug == "hello"))

为什么「定义一个类 = 建一张表」？
  类名 / __tablename__  →  表名（posts）
  类属性 title / content →  表的列名
  属性的类型（str / int / date）→  列的类型（VARCHAR / INTEGER / DATE）
  Mapped[int] 这类注解是 SQLAlchemy 2.x 的写法：既给你编辑器的自动补全，
  也让 SQLAlchemy 知道该建什么类型的列。

所以下面这个 Post 类，就等价于一句：
    CREATE TABLE posts (id INTEGER PRIMARY KEY, title VARCHAR(200), ...)
—— 表结构你只描述一次，剩下用 Python 对象增删改查，不用再拼 SQL。
"""

from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from database import Base

class Post(Base):
    """一篇文章。"""

    __tablename__ = "posts"

    # 主键：每行数据的唯一编号，不用你填，数据库自动 +1。
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # 标题、地址里的短名、摘要
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    # unique=True：这一列不允许重复，数据库层面就挡住；index=True：给它建索引，按 slug 查更快
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    description: Mapped[str] = mapped_column(String(500), default="")

    # Text 是不限长的字符串，适合放 Markdown 正文
    content: Mapped[str] = mapped_column(Text, default="")

    category: Mapped[str] = mapped_column(String(50), default="未分类", index=True)

    # JSON 列：SQLite 会把它存成 JSON 文本，读出来自动还原成 Python 的 list[str]
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)

    reading_minutes: Mapped[int] = mapped_column(Integer, default=1)

    is_draft: Mapped[bool] = mapped_column(Boolean, default=False)

    # 发布日期可以为空（草稿可能还没定发布日期）
    published_at: Mapped[date | None] = mapped_column(Date, nullable=True)

    # 自动时间戳：server_default 是「插入时由数据库填当前时间」，
    # onupdate 是「每次更新这行时自动刷新」—— 这两个字段永远不用你手动赋值。
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


class User(Base):
    """一个能登录后台的人（现在只需要管理员一个角色）。

    为什么密码列叫 password_hash 而不是 password？
      因为库里**绝对不存明文密码**。存的是「哈希值」：一串看起来像乱码的字符。
        明文      : admin123
        哈希之后  : $2b$12$KIXQJ8...（60 个字符）

    为什么不能存明文？
      数据库文件（app.db）是可以被拷走的。一旦明文泄露，别人拿着这串字符
      去别家网站试一遍，很可能就把你其他账号也登了（人习惯复用密码）。
      哈希之后即使整个库泄露，对方也**无法反推出**原密码 —— 见 security.py 里的解释。

    哈希是不可逆的：不能「解密」。验证密码的方式不是「解出来比对」，
    而是「把用户这次输入的密码用同一套规则再算一次哈希，看结果是否一致」。
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # unique=True：用户名不能重名，数据库层面直接挡住
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)

    # bcrypt 算出来的哈希固定 60 个字符，留 255 是为了以后换算法不用改表
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Journal(Base):
    """一则日记。

    和 Post 的区别，一句话：**结构简单到只剩「什么时候写的、写了什么、心情如何」**。
    没有标题、没有 slug、没有分类标签、没有草稿态 —— 因为日记本来就是碎念，
    不该逼你为两句话想标题和地址。

    三个字段各有一个需要解释的地方：

    ① content 用 Text（不限长），但 schema 里限制 5000 字。
       数据库不限制是留余地（以后想放宽不用改表），接口限制是防手滑粘一整本书进来。

    ② mood 可以为空：写日记不一定有心情标签，硬填就成了负担。

    ③ ⚠️ created_at 用 **Python 侧的 datetime.now（服务器本地时间）**，
       而不是 Post 那种 server_default=func.now()。
       为什么这里不一样？因为 SQLite 的 CURRENT_TIMESTAMP 给的是 **UTC**：
       你在北京时间 00:30 写的日记，库里会存成前一天 16:30，
       按日期分组/显示出来就成了「昨天写的」—— 对日记这种「按日子排」的东西是硬伤。
       存本地时间就没有这个换算问题，代价是库里存的时间不带时区信息（个人博客够用了）。
    """

    __tablename__ = "journals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    content: Mapped[str] = mapped_column(Text, nullable=False)

    mood: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # default=datetime.now（注意没有括号）：传函数本身，SQLAlchemy 在每次插入时才调用它。
    # 写成 datetime.now() 就变成「模块导入的那一刻」，所有日记时间会一模一样。
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, nullable=False, index=True
    )


class Photo(Base):
    """相册里的一张照片。

    和 Post 的关系，一句话：**文章的内容在库里（正文是文字），照片的内容在磁盘上
    （正文是一个文件），库里这行只负责「怎么描述它、按什么顺序摆」**。

    所以核心那一列是 filename —— 它指向 backend/uploads/photos/ 下的真实文件。
    其余几列都是「给人看的」：叫什么名字、归哪个分类、排第几。

    三处值得解释的地方：

    ① filename 存的是**我们起的名**（uuid + 扩展名），不是用户传上来的原名。
       原因见 images.py 的长注释：原名能被伪造成 ../../.env，绝不能进磁盘路径。
       用户的原名现在只用来当 alt 文案，连库都不进 —— 它在写盘那一刻就没用了。
       unique=True：同一张图不许被登记两次（文件名是 uuid，撞名概率可以忽略，
       这个约束主要是防「手滑把同一行插两遍」）。

    ② owner_id 用外键指向 users.id：照片是「谁传的」。
       现在后台只有一个管理员，这一列看起来多余，但它让「以后多个人一起写」
       不需要改表结构 —— 加权限判断时只要看这一列。外键也让数据库帮你兜住
       「引用了一个不存在的用户」这种脏数据。

    ③ created_at 用 server_default=func.now()（和 Post 一致，SQLite 里给的是 **UTC**），
       和 Journal 那条 deliberately 存本地时间的选择**不一样**。
       为什么这里可以存 UTC？因为日记是「按日子分组显示」的，差 8 小时会把
       北京时间的凌晨算成前一天；照片的时间只用来做「排序号相同时的次要排序」，
       差 8 小时不影响谁在前谁在后，所以按规格用 UTC、和文章表保持同一套。
    """

    __tablename__ = "photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # 磁盘上的真实文件名（uuid 起的），同时是「这张照片的身份」
    filename: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )

    # 标题可以为空字符串：相册里大多照片不需要标题，硬填反而没人填
    title: Mapped[str] = mapped_column(String(200), default="")

    # 分类加索引：相册页最常用的动作就是「按分类筛」，走索引不用全表扫
    category: Mapped[str] = mapped_column(String(50), default="日常", index=True)

    # 排序号：越小越靠前。默认 0，也就是「不特意排」时大家并列，
    # 并列时再由 created_at 决定先后（新的在前）。
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # 外键：users.id。nullable=False 表示「不允许存在没有主人的照片」
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
