from __future__ import annotations
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from settings import get_settings

settings = get_settings()


connect_args = {}
if settings.db_url.startswith("sqlite"):
    # required for SQLite + FastAPI
    connect_args["check_same_thread"] = False

engine = create_engine(settings.db_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def init_db():
    from models import (
        User, File, Job, Notification, JobEvent, Session, PasswordResetToken, RateLimitEvent  # noqa
    )
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
