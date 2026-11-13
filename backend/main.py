"""FastAPI 应用的入口：把各个零件组装起来。

这个文件只做四件事，不写具体业务：
  1. 启动时自动建表（create_all）
  2. 挂上五组路由：文章（/api/posts）、日记（/api/journals）、相册（/api/photos）、
     图片上传（/api/upload）、登录（/api/auth）
  3. 把上传目录挂成静态文件（/uploads/xxx.jpg 直接能打开）
  4. 把「数据不合法」的报错翻译成人话
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

import models  # noqa: F401  ⚠️ 这个 import 不能删：只有导入过模型类，
#                            SQLAlchemy 才知道有 posts / users / journals / photos 这四张表，
#                            create_all 才建得出来
from config import PHOTO_DIR, UPLOAD_DIR, UPLOAD_URL_PATH, settings
from database import Base, engine
from routers import auth, journals, photos, posts, uploads


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：yield 之前是「启动时」，之后是「关闭时」。

    建表就放在启动时做一次。create_all 的行为要理解清楚：
      · 表不存在 → 建出来
      · 表已存在 → 什么都不做（**不会**清空你已有的数据）
      · 想加/改列 → 它不会帮你改，那需要 Alembic 这类迁移工具（我们这一步先不上）
    """

    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="博客后端（最小版）",
    version="0.6.0",
    lifespan=lifespan,
    description=(
        "文章、日记、相册的增删改查 + 图片上传 + 登录鉴权。\n\n"
        "**怎么用**：\n"
        "1. 先用命令行创建一个管理员账号（见 backend/create_admin.py）\n"
        "2. 点右上角 **Authorize** 按钮，在弹窗里直接填用户名和密码\n"
        "3. 点 Authorize → Close。Swagger 会自动拿 token 并保存好，你不需要复制任何东西\n"
        "4. 之后所有 🔒 标记的接口（新建 / 更新 / 删除 / 上传图片）才能用\n\n"
        "读接口（列表、详情）不需要登录。"
    ),
)

# ---------------------------------------------------------------- 跨域白名单
# 把 .env 里那串逗号分隔的域名拆成列表（顺手清掉空格和空项，避免手写 .env 时多打一个逗号
# 导致整条配置失效）。
# 部署形态是前后端同域名，靠 nginx 转发，正常情况下根本不会触发跨域 ——
# 这一层是「防呆」：以后前端换了域名而忘记配置时，报错会出现在这里，而不是玄学地全站接口挂掉。
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(posts.router)
app.include_router(journals.router)
app.include_router(photos.router)
app.include_router(uploads.router)
app.include_router(auth.router)

# ---------------------------------------------------------------- 静态图片
# 这一行让 /uploads/xxx.jpg 变成一个「能直接在浏览器打开」的网址。
#
# StaticFiles 干的事很朴素：把网址映射到磁盘目录。
#   请求 /uploads/3f2b9c.jpg  →  读 backend/uploads/3f2b9c.jpg  →  原样吐回去
# 它自带两件重要的保护：
#   · 会挡掉 ../ 这类路径穿越（请求 /uploads/../../.env 不会让你读到配置）
#   · 按扩展名给出正确的 Content-Type（浏览器才知道这是张图，而不是下载一个文件）
#
# ⚠️ 两个执行顺序上的坑：
#   ① 目录必须先存在。StaticFiles 一启动就会 check_dir，目录不在直接启动失败，
#      所以上面那行 mkdir 不能省，也不能挪到 mount 之后。
#   ② mount 的地址不能和已有路由撞。我们选 /uploads 而不是 /api/uploads，
#      就是为了让「图片文件」和「接口」在地址上一眼能分清：
#          /api/*      → 返回 JSON 的接口（要经过函数处理）
#          /uploads/*  → 直接返回文件（不经过任何函数）
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
# 相册的子目录也提前建好（缺了也不致命 —— 上传时会再 mkdir 一次，
# 但提前建出来，第一次启动就能在资源管理器里看到这个位置）
PHOTO_DIR.mkdir(parents=True, exist_ok=True)
app.mount(
    UPLOAD_URL_PATH,
    StaticFiles(directory=UPLOAD_DIR),
    name="uploads",
)


@app.exception_handler(RequestValidationError)
async def on_validation_error(request: Request, exc: RequestValidationError):
    """把 Pydantic 的英文报错整理成「哪一项 → 什么问题」的中文清单。

    默认的 422 响应是一大坨嵌套 JSON，新手很难看出到底哪填错了。
    这里统一改成 {detail, problems}：problems 一行一条，直接照着改就行。
    """

    problems: list[str] = []
    for err in exc.errors():
        # loc 形如 ("body", "title")，去掉 "body" 只留字段名
        field = ".".join(str(x) for x in err["loc"] if x != "body") or "请求体"
        problems.append(f"{field}：{err['msg']}")

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": f"提交的数据有问题，共 {len(problems)} 处，请逐条检查",
            "problems": problems,
        },
    )


@app.get("/", summary="根路由")
def read_root():
    """浏览器直接打开 http://127.0.0.1:8000 就会走到这里。"""
    return {"message": "后端跑起来了"}


@app.get("/api/health", summary="健康检查")
def health_check():
    """给部署脚本 / 监控看的「我还活着」信号。"""
    return {"status": "ok"}
