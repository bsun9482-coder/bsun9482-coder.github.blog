"""建管理员账号的命令行小工具。

怎么用（在 backend 目录下，用虚拟环境里的 python 执行）：

    python create_admin.py admin 你的密码
    python create_admin.py admin              ← 不写密码，会让你在终端里盲输两次（更安全，不会留在命令历史里）
    python create_admin.py admin 新密码 --force ← 账号已存在时，用它改密码

它做的事非常简单，只有三步：
    1. 建表（如果还没建过）—— 这样你不用先启动服务也能建账号
    2. 把密码变成哈希（绝不存明文）
    3. 写进 users 表

为什么不做一个「注册接口」？
  这个站只有一个作者，公开的注册接口等于把门开着。管理员账号本来就该
  由「能登服务器的人」手工创建 —— 创建账号这件事本身就是权限。
"""

import argparse
import getpass
import sys
from pathlib import Path

# 让脚本在任意目录下执行都能 import 到 backend 里的模块
sys.path.insert(0, str(Path(__file__).resolve().parent))

import models  # noqa: E402  （E402 = import 不在文件最顶端，这里是有意为之）
from database import Base, SessionLocal, engine  # noqa: E402
from security import hash_password  # noqa: E402

MIN_PASSWORD_LEN = 8


def main() -> int:
    parser = argparse.ArgumentParser(description="创建一个能登录后台的管理员账号")
    parser.add_argument("username", help="用户名，例如 admin")
    parser.add_argument("password", nargs="?", help="密码；不写的话会提示你盲输（推荐）")
    parser.add_argument("--force", action="store_true", help="账号已存在时覆盖它的密码")
    args = parser.parse_args()

    username = args.username.strip()
    if not username:
        print("✗ 用户名不能为空白")
        return 1

    password = args.password
    if password is None:
        # getpass 输入时屏幕上不显示字符，是命令行里输密码的标准做法
        password = getpass.getpass("请输入密码（输入时不显示）：")
        if password != getpass.getpass("再输一次确认："):
            print("✗ 两次输入不一致")
            return 1

    if len(password) < MIN_PASSWORD_LEN:
        print(f"✗ 密码至少 {MIN_PASSWORD_LEN} 位。别用 123456 —— 这个库一旦泄露，弱密码等于没锁。")
        return 1

    try:
        password_hash = hash_password(password)
    except ValueError as exc:
        print(f"✗ {exc}")
        return 1

    # 建表：create_all 只建「不存在」的表，已有数据一行都不会动，可以放心重复执行
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        existing = db.query(models.User).filter(models.User.username == username).first()

        if existing is not None and not args.force:
            print(f"✗ 用户名「{username}」已经存在了。")
            print(f"  想改它的密码： python create_admin.py {username} 新密码 --force")
            return 1

        if existing is not None:
            existing.password_hash = password_hash
            db.commit()
            print(f"✓ 已重置「{username}」的密码（用户 id={existing.id}）")
            return 0

        user = models.User(username=username, password_hash=password_hash)
        db.add(user)
        db.commit()
        db.refresh(user)

    print(f"✓ 管理员账号已创建：{username}（id={user.id}）")
    print("  库里存的是哈希，不是明文 —— 所以这个密码请你自己记好，找不回来。")
    print("  接下来：启动服务 → 打开 /docs → POST /api/auth/login 用这个账号换 token。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
