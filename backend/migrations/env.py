from logging.config import fileConfig
import os
import sys
from alembic import context
from sqlalchemy import engine_from_config
from sqlalchemy import pool

# このパスを追加することで、appモジュールをインポートできるようになります
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.database import Base
from app.models import *  # 全てのモデルをインポート

# Alembic Config オブジェクトを取得
config = context.config

# ログの設定
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section)
    if "DATABASE_URL" in os.environ:
        configuration["sqlalchemy.url"] = os.environ["DATABASE_URL"]
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
