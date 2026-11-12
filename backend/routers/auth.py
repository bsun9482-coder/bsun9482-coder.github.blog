"""登录相关的接口：换 token、看我是谁。

前缀 /api/auth，三个接口：
  POST /api/auth/login  —— 交 JSON（给程序 / 前端用）
  POST /api/auth/token  —— 交表单（专门给 /docs 右上角的 Authorize 按钮用）
  GET  /api/auth/me     —— 带着 token 问「我是谁」（主要是给你调试用的）

为什么要有两个登录接口？它们查密码的逻辑**完全一样**，只差「收数据的格式」：
  · login 收 JSON —— 前端 fetch 时最顺手的格式
  · token 收表单 —— 这是 OAuth2 标准规定的格式，Swagger 的 Authorize 按钮只会发这一种。
    有了它，Authorize 按钮就能自己帮你登录，你连 token 长什么样都不用看到。
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

import models
import schemas
from config import settings
from database import get_db
from security import create_access_token, get_current_user, verify_password

router = APIRouter(prefix="/api/auth", tags=["登录"])


def _authenticate(db: Session, username: str, password: str) -> models.User:
    """校验用户名密码，不对就 401。两个登录接口共用这一段，避免查出两套逻辑。

    这里有一个安全细节值得记住：**用户名不存在、密码不对，回的是同一句话、
    同一个状态码**。

    为什么不分开报「用户不存在」/「密码不对」？
      因为分开报等于免费帮攻击者做一件事：试用户名。
      他拿一堆用户名来试，只要提示不同，就能筛出「哪些用户名是真的存在」，
      接下来只需要专心爆破这些账号的密码。
      统一成一句含糊的话，他就只能一个个硬试。
    """

    user = db.scalar(select(models.User).where(models.User.username == username))

    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码不对，请重新输入",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def _token_response(user: models.User) -> schemas.TokenResponse:
    """把「签发一张 token」这件事收在这里，两个登录接口都调它。"""

    return schemas.TokenResponse(
        access_token=create_access_token(user.username),
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,  # 配置是分钟，返回值统一用秒
        username=user.username,
    )


@router.post("/login", response_model=schemas.TokenResponse, summary="登录换取 token（JSON 版）")
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    """给前端 / 脚本用的版本，请求体是一段 JSON：

        {"username": "admin", "password": "你的密码"}
    """

    user = _authenticate(db, payload.username, payload.password)
    return _token_response(user)


@router.post("/token", response_model=schemas.TokenResponse, summary="登录换取 token（表单版，给 Authorize 按钮用）")
def login_form(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """/docs 右上角 Authorize 按钮点 Authorize 时，Swagger 会自动调这个接口。

    「表单」和「JSON」的区别只在传输格式：
      表单（本接口）  username=admin&password=xxx   ← 像老式网页表单那样一行一行拼
      JSON（上一个）  {"username": "admin", ...}

    你不需要手工调这个接口，它是被 Authorize 按钮调用。
    """

    user = _authenticate(db, form.username, form.password)
    return _token_response(user)


@router.get("/me", response_model=schemas.UserRead, summary="看当前登录的是谁（调试用）")
def read_me(current_user: models.User = Depends(get_current_user)):
    """带 token 请求一下就返回自己的信息。

    这个接口本身没什么业务价值，但它是**验证 token 最快的方式**：
    不用新建数据、不用改库，只 GET 一下就知道「登录到底生效了没有」。
    401 就说明 token 有问题，200 就说明整条链路通了。
    """

    return current_user
