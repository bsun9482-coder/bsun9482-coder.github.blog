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

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# 数据库文件的位置：backend/data/app.db
# Path(__file__) 是「当前这个文件」，.parent 是它所在的 backend/ 目录。
DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)  # 目录不存在就建出来（exist_ok=True：已存在不报错）
DB_PATH = DATA_DIR / "app.db"

# sqlite:/// 后面跟文件路径。as_posix() 把 Windows 的反斜杠换成正斜杠，
# 免得路径里的 \ 被当成转义字符。
# check_same_thread=False：SQLite 默认只允许「创建它的那个线程」使用它，
# 而 FastAPI 处理请求时可能换线程，所以这里要放开这个限制。
engine = create_engine(
    f"sqlite:///{DB_PATH.as_posix()}",
    connect_args={"check_same_thread": False},
)

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
