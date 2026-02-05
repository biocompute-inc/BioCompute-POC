from __future__ import annotations

import datetime as dt
import hashlib
import secrets
import shutil
import smtplib
from email.message import EmailMessage
from pathlib import Path

from sqlalchemy.orm import Session as OrmSession

from models import RateLimitEvent
from settings import get_settings

settings = get_settings()


def _utcnow():
    return dt.datetime.utcnow()


def _safe_rm_tree(p: Path):
    try:
        if p.exists() and p.is_dir():
            shutil.rmtree(p, ignore_errors=True)
    except Exception:
        pass


def send_password_reset_email(to_email: str, reset_link: str):
    """
    If SMTP is not configured, prints the link (dev friendly).
    If configured, sends a simple email.
    """
    if not getattr(settings, "smtp_host", None) or not getattr(settings, "smtp_from", None):
        print("PASSWORD RESET LINK:", reset_link)
        return

    msg = EmailMessage()
    msg["Subject"] = "Reset your password"
    msg["From"] = settings.smtp_from
    msg["To"] = to_email
    msg.set_content(
        f"Use this link to reset your password (expires in {settings.reset_token_ttl_minutes} minutes):\n\n"
        f"{reset_link}\n"
    )

    use_tls = bool(getattr(settings, "smtp_use_tls", True))
    host = settings.smtp_host
    port = int(getattr(settings, "smtp_port", 587))
    user = getattr(settings, "smtp_user", None)
    pwd = getattr(settings, "smtp_password", None)

    if use_tls:
        with smtplib.SMTP(host, port) as s:
            s.starttls()
            if user and pwd:
                s.login(user, pwd)
            s.send_message(msg)
    else:
        with smtplib.SMTP(host, port) as s:
            if user and pwd:
                s.login(user, pwd)
            s.send_message(msg)


# ---------------------------
# Token helpers
# ---------------------------

def make_reset_token() -> str:
    return secrets.token_urlsafe(32)


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def reset_expires_at() -> dt.datetime:
    ttl = int(getattr(settings, "reset_token_ttl_minutes", 30))
    return dt.datetime.utcnow() + dt.timedelta(minutes=ttl)


# ---------------------------
# Rate limiting helper
# ---------------------------

def _rate_limit(db: OrmSession, key: str, max_hits: int, window_seconds: int) -> bool:
    """
    Returns True if allowed, False if rate-limited.
    DB-backed so it survives restarts (POC-safe).
    """
    now = dt.datetime.utcnow()
    window_start = now - dt.timedelta(seconds=window_seconds)

    # prune old rows for this key
    db.query(RateLimitEvent).filter(
        RateLimitEvent.key == key,
        RateLimitEvent.created_at < window_start,
    ).delete(synchronize_session=False)
    db.commit()

    cnt = db.query(RateLimitEvent).filter(
        RateLimitEvent.key == key,
        RateLimitEvent.created_at >= window_start,
    ).count()

    if cnt >= max_hits:
        return False

    db.add(RateLimitEvent(key=key, created_at=now))
    db.commit()
    return True
