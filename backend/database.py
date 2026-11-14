"""数据库连接的三个角色：引擎、会话、基类。

先把三个名词说清楚（后面每个文件都会用到）：

  1. SQLite：一个「数据库就是一个文件」的小型数据库。所有表和数据都装在
     backend/data/app.db 这一个文件里 —— 把它拷走，就等于把整个库拷走了。
     不需要装服务端、不需要账号密码，特别适合练手和小项目。

  2. 引擎 engine：负责和这个文件打交道的「那根管子」。全项目只需要一根，
     所以在这里创建一次，别的文件都来 import 它。

  3. 会话 Session：一次数据库操作的「工作台」。你从库里读数据、改数据，
     都是先放到会话里；只有 commit() 之后才真正写进文件。
     每个请求开一个会话，用完关掉（见下面的 get_db）。
"""

from pathlib import Path
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# 数据库文件的位置：默认 backend/data/app.db
# Path(__file__) 是「当前这个文件」，.parent 是它所在的 backend/ 目录。
DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)  # 目录不存在就建出来（exist_ok=True：已存在不报错）
DB_PATH = DATA_DIR / "app.db"

# ---------------------------------------------------------------- 数据库地址
# 为什么不直接写死成 DB_PATH？
#   写死的话，「把库放到别的盘」「生产用另一个目录」都得改代码。改代码意味着改完要重新
#   提交、重新部署，而换路径本身只是运维操作，不该动代码。
#   所以留一个出口：环境变量 DATABASE_URL 有值就用它，没值才用上面那个默认路径。
#
#   部署到服务器时一般留空（默认就是 backend/data/app.db）；
#   只有在「数据要放到 /var/lib/blog 这种系统目录」时才在 .env 里写一行：
#     DATABASE_URL=sqlite:////var/lib/blog/app.db
#   ⚠️ 注意是四个斜杠：sqlite:// 是固定前缀，第三个斜杠后面跟的是「绝对路径 /var/...」。
DATABASE_URL = os.environ.get("DATABASE_URL") or f"sqlite:///{DB_PATH.as_posix()}"

# SQLite 才需要的两个额外设置：
#   check_same_thread=False  SQLite 默认只允许「创建它的那个线程」用，而 FastAPI 处理请求时
#                            可能换线程，所以要放开这个限制
# 换成 MySQL/PostgreSQL 时这段自动跳过（它们没有这个限制，传进去反而报错）。
CONNECT_ARGS = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

# 如果 DATABASE_URL 指到一个还不存在的目录（比如 /var/lib/blog/），先把目录建好，
# 否则 SQLite 打开文件时会报 "unable to open database file"——那个报错完全不提「目录不存在」。
if DATABASE_URL.startswith("sqlite:///"):
    _db_file = Path(DATABASE_URL[len("sqlite:///") :])
    if str(_db_file) != ":memory:":
        _db_file.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(DATABASE_URL, connect_args=CONNECT_ARGS)

# 会话工厂：每调用一次 SessionLocal() 就得到一个会话。
# expire_on_commit=False：commit 之后对象里的字段仍然可读，方便直接返回给前端。
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """所有「表」的父类。

    SQLAlchemy 靠这个父类把「Python 类」和「数据库表」对应起来：
    你写 class Post(Base)，它就知道了「Post 对应一张表」。
    """


def get_db():
    """每个请求拿一个会话，请求结束自动关闭。

    这个函数是一个「依赖」：路由里写 db: Session = Depends(get_db)，
    FastAPI 就会在调用你的函数之前先执行它、把会话递进来，结束时收尾。
    好处是不用每个接口都写一遍 try/finally 关闭连接。
    """

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ================================================================ 补列（穷人版迁移）
# 先说清楚这件事为什么必须做：
#
#   create_all 只会「建缺失的表」，**从来不管已存在表里少了哪些列**。
#   所以你在 models.py 给 Photo 加一个 thumb_filename 之后：
#     · 全新的空库 → 建表时就带着这一列，一切正常
#     · 已经跑过半年的老库 → 表已经存在，create_all 直接跳过
#       ⇒ 数据库里根本没有这一列，但代码里每次 SELECT 都会带上它
#       ⇒ 每次查相册都 500（OperationalError: no such column）
#   而本地库和线上库**一定是两个不同的文件**，本地测通了不代表线上不会炸。
#
# 正规解法是 Alembic（生成迁移脚本、可按版本升/降级）。这个项目不上它，理由很实际：
#   十几张表、一个作者、没有并行分支，为「加一列」引入一套带版本目录的工具体系
#   （每次改表都要 generate + 手改 + commit 一个脚本）收益抵不过成本。
#
# 这里的替代方案只有 30 行，覆盖「加列」这一种最常见的改表动作：
#   启动时拿「代码里定义的列」和「库里真实的列」对一遍，缺哪个就 ALTER TABLE 补上。
# ⚠️ 它能做的只有 ADD COLUMN。改名、删列、改类型、加约束，一律不做（那种改动老老实实
#    手写 SQL，或者到时候再上 Alembic）。宁可功能少，也不要一个会悄悄改坏数据的迁移器。
def run_migrations(metadata=None) -> list[str]:
    """把「模型里有、库里没有」的列补上，返回补了哪些（形如 photos.thumb_filename）。

    什么都不缺时返回空列表 —— 正常启动就是这个结果，可以放心地每次启动都跑。
    """

    from sqlalchemy import inspect

    metadata = Base.metadata if metadata is None else metadata
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    added: list[str] = []

    for table in metadata.sorted_tables:
        # 表不存在 ⇒ create_all 刚刚按最新定义建过，不需要补
        if table.name not in existing_tables:
            continue

        have = {column["name"] for column in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name in have:
                continue
            sql = _add_column_sql(table.name, column)
            with engine.begin() as conn:
                conn.exec_driver_sql(sql)
            added.append(f"{table.name}.{column.name}")

    return added


def _add_column_sql(table_name: str, column) -> str:
    """拼一条 ALTER TABLE ... ADD COLUMN。

    两个刻意的取舍：

    ① **不加 NOT NULL**（即使模型里写了 nullable=False）。
       SQLite 不允许给已有行加一个「必填但没值」的列 —— 加 NOT NULL 必须同时给 DEFAULT，
       而一个编出来的默认值（比如空字符串）会污染历史数据，还可能悄悄绕过模型里的约束。
       补出来的列一律可空，由接口层（Pydantic schema）继续负责「写进去的值必须合法」。
       这就是「数据库先宽容、代码守严格」，比反过来安全得多。

    ② 有标量默认值就带上 DEFAULT，让老数据也有个合理值（比如 sort_order 补 0）。
       带函数的默认值（func.now() / datetime.now）跳过 —— SQLite 的 ADD COLUMN 只认常量。
    """

    type_sql = column.type.compile(dialect=engine.dialect)
    sql = f'ALTER TABLE "{table_name}" ADD COLUMN "{column.name}" {type_sql}'

    default = column.default
    if default is not None and getattr(default, "is_scalar", False):
        value = default.arg
        # bool 要落成 0/1，不能写 True/False（老版本 SQLite 不认这两个字面量）
        if isinstance(value, bool):
            sql += f" DEFAULT {int(value)}"
        elif isinstance(value, (int, float)):
            sql += f" DEFAULT {value}"
        elif isinstance(value, str):
            # 单引号转义：DEFAULT 'a''b' 是 SQL 里写字符串的标准方式
            escaped = value.replace("'", "''")
            sql += f" DEFAULT '{escaped}'"

    return sql
