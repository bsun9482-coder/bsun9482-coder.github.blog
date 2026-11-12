"""日记的四组接口：列表 / 新建 / 更新 / 删除。

和 posts.py 完全同一套骨架（看那边注释能看懂九成），只有三处不一样：

① 地址里用 **id** 而不是 slug
   文章需要 slug，因为它要被别的网站链接、要在地址栏里好看；
   日记没有详情页、不需要被外部引用，用自增 id 最简单。

② 没有草稿概念
   日记写出来就是给自己看的，不存在「先存着不发」。想删就删，想改就改。

③ 没有 include_drafts 这种参数
   读接口对所有人开放，写接口必须登录 —— 边界只有这一条。

响应状态码照旧：200 成功 / 201 新建成功 / 401 没登录 / 404 没找到 / 422 数据不合法
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from security import get_current_user

router = APIRouter(prefix="/api/journals", tags=["日记"])


def _get_or_404(db: Session, journal_id: int) -> models.Journal:
    """按 id 取一则日记，取不到就 404。

    为什么不直接 db.get(models.Journal, journal_id)？
    那样取不到的返回值是 None，你还得在三个接口里各写一遍 if None: raise。
    收在这里，三个接口都只写一句 `journal = _get_or_404(db, journal_id)`。
    """

    journal = db.scalar(select(models.Journal).where(models.Journal.id == journal_id))
    if journal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"没有找到 id 为 {journal_id} 的日记，可能已经被删掉了",
        )
    return journal


# ---------------------------------------------------------------- 查：列表
@router.get("", response_model=list[schemas.JournalRead], summary="日记列表（公开，最新在前）")
def list_journals(db: Session = Depends(get_db)):
    """按时间倒序返回，最新的在最前面 —— 日记页是「时间线」，从今天往回看。

    order_by 写了两个，理由和文章列表一样：
      同一天写了好几条时，只按 created_at 排，顺序可能不稳定（秒级相同就会乱），
      再按 id 倒序兜一层，保证每次刷新顺序都一样。
    """

    stmt = select(models.Journal).order_by(
        models.Journal.created_at.desc(), models.Journal.id.desc()
    )
    return db.scalars(stmt).all()


# ---------------------------------------------------------------- 增
@router.post(
    "",
    response_model=schemas.JournalRead,
    status_code=201,
    summary="写一则日记（🔒 需登录）",
)
def create_journal(
    payload: schemas.JournalCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """只做两件事：把校验干净的数据存进去，再把「数据库补上的字段」读回来。

    created_at 不用你传 —— 模型里的 default=datetime.now 会在插入的那一刻填好。
    db.refresh() 就是「插完之后把这一行重新读一遍」，否则返回体里 id 和 created_at 是空的。
    """

    journal = models.Journal(**payload.model_dump())
    db.add(journal)
    db.commit()
    db.refresh(journal)
    return journal


# ---------------------------------------------------------------- 改
@router.put(
    "/{journal_id}",
    response_model=schemas.JournalRead,
    summary="改一则日记（🔒 需登录）",
)
def update_journal(
    journal_id: int,
    payload: schemas.JournalUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """只改你传上来的字段（exclude_unset=True 区分「没传」和「传了 null」）。

    两个细节：
      · content 传 null 视为「这次不改」—— 空正文没有意义，真删要删整条。
      · mood 传 null 是**有意义的**：意思是「把心情标签清掉」。
        所以 nullable 集合里只放 mood。
    """

    journal = _get_or_404(db, journal_id)
    data = payload.model_dump(exclude_unset=True)

    nullable = {"mood"}
    for field, value in data.items():
        if value is None and field not in nullable:
            continue
        setattr(journal, field, value)

    db.commit()
    db.refresh(journal)
    return journal


# ---------------------------------------------------------------- 删
@router.delete("/{journal_id}", summary="删一则日记（🔒 需登录）")
def delete_journal(
    journal_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """真删。删完再查同一个 id 就是 404。"""

    journal = _get_or_404(db, journal_id)
    db.delete(journal)
    db.commit()
    return {"message": "已删除", "id": journal_id}
