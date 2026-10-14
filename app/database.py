from __future__ import annotations

import os
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


def make_engine(database_url: str | None = None):
    url = database_url or os.getenv("SENTINEL_DATABASE_URL", "sqlite:///./sentinel_x.db")
    kwargs = {"connect_args": {"check_same_thread": False}} if url.startswith("sqlite") else {}
    return create_engine(url, future=True, **kwargs)


def session_factory(engine):
    return sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    # The production app installs this factory on app.state and replaces this dependency.
    from .main import SessionLocal

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
