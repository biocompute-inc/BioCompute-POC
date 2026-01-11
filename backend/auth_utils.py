from __future__ import annotations
import datetime as dt
import secrets
from typing import Optional

from passlib.context import CryptContext
from fastapi import HTTPException, Response, Request
from sqlalchemy.orm import Session

from models import User, Session as DbSession

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

SESSION_COOKIE_NAME = "poc_session"

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)

def create_session(db: Session, user_id: int, days_valid: int = 7) -> str:
    token = secrets.token_urlsafe(32)
    expires = dt.datetime.utcnow() + dt.timedelta(days=days_valid)

    s = DbSession(
        id=token,
        user_id=user_id,
        created_at=dt.datetime.utcnow(),
        expires_at=expires,
        revoked_at=None,
    )
    db.add(s)
    db.commit()
    return token

def set_session_cookie(resp: Response, token: str):
    # HttpOnly cookie => JS can't read it; browser auto-sends it.
    resp.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,  # set True behind HTTPS later
        max_age=7 * 24 * 3600,
    )

def clear_session_cookie(resp: Response):
    resp.delete_cookie(SESSION_COOKIE_NAME)

def get_current_user(db: Session, request: Request) -> User:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Not logged in")

    s = db.query(DbSession).filter(DbSession.id == token).first()
    if not s or s.revoked_at is not None:
        raise HTTPException(status_code=401, detail="Invalid session")

    if s.expires_at and s.expires_at < dt.datetime.utcnow():
        raise HTTPException(status_code=401, detail="Session expired")

    user = db.query(User).filter(User.id == s.user_id, User.is_active == True).first()  # noqa: E712
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def require_role(user: User, allowed: set[str]):
    if user.role not in allowed:
        raise HTTPException(status_code=403, detail="Forbidden (role)")
