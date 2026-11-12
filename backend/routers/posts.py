"""文章的五组接口：列表 / 详情 / 新建 / 更新 / 删除。

每个函数的「套路」都一样，看懂一个就看懂全部：
  1. 参数里声明要什么（路径里的 slug、查询参数 category、请求体 payload）
  2. 用 db（会话）去查 / 去改
  3. return 什么，前端就收到什么；出错就 raise HTTPException，FastAPI 会变成对应的状态码

响应状态码速查：200 成功 / 201 新建成功 / 401 没登录或 token 无效 / 404 没找到 / 409 冲突（比如 slug 撞了）/ 422 数据不合法

🔒 哪些接口要登录？
  读（GET 列表、GET 详情）→ 公开，谁都能看。理由：博客本来就是给人看的。
  写（POST / PUT / DELETE）→ 必须登录。理由：改内容的能力不能谁都有。
  做法就是在函数的参数里加一句 `current_user: models.User = Depends(get_current_user)`。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from security import get_current_user, read_optional_user

router = APIRouter(prefix="/api/posts", tags=["文章"])


def _get_or_404(db: Session, slug: str) -> models.Post:
    """按 slug 取一篇文章，取不到就 404。抽出来给三个接口复用。"""

    post = db.scalar(select(models.Post).where(models.Post.slug == slug))
    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"没有找到 slug 为「{slug}」的文章，先确认地址拼对了没",
        )
    return post


def _ensure_slug_free(db: Session, slug: str, *, except_id: int | None = None) -> None:
    """确认这个 slug 没被别人占用，占了就 409。

    为什么不用等数据库报错？因为数据库只会丢给你一句
    「UNIQUE constraint failed: posts.slug」，新手根本看不懂。
    先自己查一遍，就能回一句人话：slug 被谁占了、怎么改。
    """

    stmt = select(models.Post).where(models.Post.slug == slug)
    if except_id is not None:  # 更新时要把「自己」排除掉，否则自己跟自己算重复
        stmt = stmt.where(models.Post.id != except_id)
    if db.scalar(stmt) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"slug「{slug}」已经被别的文章占用了，换一个吧（比如加个日期后缀：{slug}-2）",
        )


# ---------------------------------------------------------------- 查：列表
@router.get("", response_model=list[schemas.PostRead], summary="文章列表（游客只看已发布）")
def list_posts(
    request: Request,
    category: str | None = Query(default=None, description="只看某个分类，例如 AI；不传就返回全部"),
    include_drafts: bool = Query(
        default=False,
        description="是否连草稿一起返回。只有登录的人传这个才有效果，游客传了也会被忽略",
    ),
    db: Session = Depends(get_db),
):
    """按发布日期倒序返回，最新的在最前面。

    order_by 写了两个：先按 published_at 倒序，日期相同再按 id 倒序，
    保证「同一天发的两篇」顺序也是稳定的（否则每次查询顺序可能不一样）。

    🔒 草稿过滤：默认只返回已发布的。
       后台要连草稿一起看，就传 ?include_drafts=true 并带上 token。
       注意这里是「游客传了也不给」而不是「游客传了就报错」：
       公开接口没必要因为一个参数回 401，静默降级更稳妥，
       真正的边界是下面那句 where —— 它才是决定谁能看到什么的地方。
    """

    viewer = read_optional_user(request, db)

    stmt = select(models.Post).order_by(
        models.Post.published_at.desc(), models.Post.id.desc()
    )
    if category:
        stmt = stmt.where(models.Post.category == category)
    if not (include_drafts and viewer is not None):
        stmt = stmt.where(models.Post.is_draft.is_(False))
    return db.scalars(stmt).all()


# ---------------------------------------------------------------- 查：详情
@router.get("/{slug}", response_model=schemas.PostRead, summary="按 slug 看一篇文章")
def get_post(slug: str, request: Request, db: Session = Depends(get_db)):
    """游客能看已发布的；草稿对游客表现为「不存在」。

    为什么草稿要回 404 而不是 403（无权限）？
      403 等于告诉对方「这里确实有一篇草稿，只是不给你看」——
      这本身就是信息泄露（能猜出你在写什么标题、什么时候在写）。
      404 让草稿在游客眼里和没写过一样。
    """

    post = _get_or_404(db, slug)

    if post.is_draft and read_optional_user(request, db) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"没有找到 slug 为「{slug}」的文章，先确认地址拼对了没",
        )

    return post


# ---------------------------------------------------------------- 增
@router.post("", response_model=schemas.PostRead, status_code=201, summary="新建一篇文章（🔒 需登录）")
def create_post(
    payload: schemas.PostCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """payload 已经过 Pydantic 校验，能走到这里的都是干净数据。

    能走到函数体里，说明 get_current_user 已经成功放行 —— 也就是「这个人确实登录了」。
    我们这里用不到 current_user 的具体内容，但它存在这件事本身就是权限凭证。
    （以后想记「谁写的」，就把 current_user.username 存到文章表里。）
    """

    _ensure_slug_free(db, payload.slug)

    # model_dump() 把 schema 变成字典，正好可以直接喂给模型类
    post = models.Post(**payload.model_dump())
    db.add(post)
    try:
        db.commit()
    except IntegrityError:
        # 兜底：万一有人在同一瞬间插了同一个 slug，数据库层的唯一索引会拒绝。
        # 回滚是必须的 —— 出错后会话里残留的脏状态不清理，后面所有操作都会报错。
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"slug「{payload.slug}」已经被占用了，换一个吧",
        )

    # refresh：把库里自动生成的值（id、created_at）读回来，否则返回的这两个字段是空的
    db.refresh(post)
    return post


# ---------------------------------------------------------------- 改
@router.put("/{slug}", response_model=schemas.PostRead, summary="按 slug 更新文章（🔒 需登录）")
def update_post(
    slug: str,
    payload: schemas.PostUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """只改你传上来的字段。

    exclude_unset=True 的作用：只保留「请求里真的出现过」的字段。
    这样你只想改标题时，content、tags 这些不会被意外清空。
    """

    post = _get_or_404(db, slug)
    data = payload.model_dump(exclude_unset=True)

    if "slug" in data and data["slug"] != post.slug:
        _ensure_slug_free(db, data["slug"], except_id=post.id)

    # 传 null 视为「这次不改」——否则手滑把 tags 传成 null，写库时会撞 NOT NULL 变成 500。
    # 唯一例外是 published_at：它本来就允许为空，要能显式清掉。
    nullable = {"published_at"}
    for field, value in data.items():
        if value is None and field not in nullable:
            continue
        setattr(post, field, value)

    db.commit()
    db.refresh(post)
    return post


# ---------------------------------------------------------------- 删
@router.delete("/{slug}", summary="按 slug 删除文章（🔒 需登录）")
def delete_post(
    slug: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """真删（不是打个删除标记）。删完再查同一个 slug 就是 404。"""

    post = _get_or_404(db, slug)
    db.delete(post)
    db.commit()
    return {"message": "已删除", "slug": slug}
