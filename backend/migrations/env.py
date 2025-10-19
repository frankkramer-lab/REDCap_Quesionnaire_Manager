import os
import sys
from logging.config import fileConfig
from alembic import context
from sqlalchemy import engine_from_config, pool
from dotenv import load_dotenv

# Pfad zur Projektbasis (ein Verzeichnis über migrations/)
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(BASE_DIR)

# .env laden
load_dotenv(dotenv_path=os.path.join(BASE_DIR, '.env'))

# Alembic-Konfiguration laden
config = context.config
config.set_main_option("sqlalchemy.url", os.getenv("DATABASE_URL"))

# Logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 🔁 Modelle direkt importieren, um sie zu registrieren
from backend.extensions import db
from backend.dbmodels.user import User
from backend.dbmodels.form_models import Form, Section, Question
from backend.dbmodels.imported_csv import ImportedCSV
from backend.dbmodels.custom_form import CustomForm, CustomSection, CustomQuestion

# ❗ Ziel-Metadaten setzen – automatisch aus db
target_metadata = db.metadata

# Alembic-Setup
def run_migrations_offline():
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
