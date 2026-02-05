from __future__ import annotations

import datetime as dt
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session as OrmSession

from auth.service import (
    _rate_limit,
    _safe_rm_tree,
    _utcnow,
    hash_reset_token,
    make_reset_token,
    reset_expires_at,
    send_password_reset_email,
)
from auth_utils import (
    clear_session_cookie,
    create_session,
    get_current_user,
    hash_password,
    set_session_cookie,
    verify_password,
)
from db import get_db
from models import (
    File as DbFile,
    Job,
    JobEvent,
    Notification,
    PasswordResetToken,
    Session as DbSession,
    User,
)
from settings import get_settings

router = APIRouter(prefix="/auth")
settings = get_settings()


@router.post("/register")
def register(payload: dict, db: OrmSession = Depends(get_db)):
    """
    Payload: { "email": "...", "password": "...", "role": "user|scientist|admin" (optional) }
    For POC: allow role set during registration to speed testing.
    """
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    role = "user"
    display_name = payload.get("display_name") or payload.get("displayName") or None
    if display_name:
        display_name = display_name.strip()

    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 chars")
    if len(password) > 24:
        raise HTTPException(status_code=400, detail="Password too long (max 24 chars)")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    u = User(
        email=email,
        password_hash=hash_password(password),
        role=role,
        display_name=display_name,
        created_at=_utcnow(),
        is_active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return {"id": u.id, "email": u.email, "role": u.role, "display_name": u.display_name}


@router.post("/login")
def login(payload: dict, response: Response, db: OrmSession = Depends(get_db)):
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    u = db.query(User).filter(User.email == email, User.is_active == True).first()  # noqa: E712
    if not u or not verify_password(password, u.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_session(db, user_id=u.id)
    set_session_cookie(response, token)

    u.last_login_at = _utcnow()
    db.commit()

    return {"id": u.id, "email": u.email, "role": u.role, "display_name": u.display_name}


@router.post("/logout")
def logout(response: Response):
    clear_session_cookie(response)
    return {"ok": True}


# ---------------------------
# AUTH: Forgot / Reset Password
# ---------------------------

@router.post("/forgot-password")
def forgot_password(payload: dict, request: Request, db: OrmSession = Depends(get_db)):
    """
    Payload: { "email": "..." }
    Always returns {ok:true} even if email doesn't exist.
    Rate-limited per IP + per email.
    """
    email = (payload.get("email") or "").strip().lower()
    ip = request.client.host if request.client else "unknown"

    # Rate limits (tweak as needed)
    # Per IP: 10 / 10 minutes
    if not _rate_limit(db, f"fp:ip:{ip}", max_hits=10, window_seconds=600):
        return {"ok": True}

    # Per email: 3 / 15 minutes (only if email looks valid)
    if email and "@" in email:
        if not _rate_limit(db, f"fp:email:{email}", max_hits=3, window_seconds=900):
            return {"ok": True}

    # Do NOT leak existence of account
    if not email or "@" not in email:
        return {"ok": True}

    u = db.query(User).filter(User.email == email, User.is_active == True).first()  # noqa: E712
    if not u:
        return {"ok": True}

    raw_token = make_reset_token()

    db.add(
        PasswordResetToken(
            user_id=u.id,
            token_hash=hash_reset_token(raw_token),
            expires_at=reset_expires_at(),
            used_at=None,
            created_at=dt.datetime.utcnow(),
            requested_ip=ip,
            requested_ua=request.headers.get("user-agent"),
        )
    )
    db.commit()

    reset_link = f"{settings.frontend_base_url}/reset-password?token={raw_token}"
    send_password_reset_email(u.email, reset_link)

    return {"ok": True}


@router.post("/reset-password/validate")
def validate_reset(payload: dict, db: OrmSession = Depends(get_db)):
    """
    Payload: { "token": "..." }
    Returns { ok: true/false }
    """
    token = payload.get("token") or ""
    if not token:
        return {"ok": False}

    token_hash = hash_reset_token(token)
    row = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
        )
        .first()
    )

    if not row:
        return {"ok": False}
    if row.expires_at < dt.datetime.utcnow():
        return {"ok": False}

    return {"ok": True}


@router.post("/reset-password")
def reset_password(payload: dict, db: OrmSession = Depends(get_db)):
    """
    Payload: { "token": "...", "new_password": "..." }
    """
    token = payload.get("token") or ""
    new_password = payload.get("new_password") or ""

    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 chars")
    if len(new_password) > 24:
        raise HTTPException(status_code=400, detail="Password too long (max 24 chars)")
    if not token or len(token) < 10:
        raise HTTPException(status_code=400, detail="Invalid token")

    token_hash = hash_reset_token(token)

    row = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
        )
        .first()
    )

    if not row:
        raise HTTPException(status_code=400, detail="Invalid or used token")
    if row.expires_at < dt.datetime.utcnow():
        raise HTTPException(status_code=400, detail="Token expired")

    u = db.query(User).filter(User.id == row.user_id, User.is_active == True).first()  # noqa: E712
    if not u:
        raise HTTPException(status_code=400, detail="Invalid token")

    # update password
    u.password_hash = hash_password(new_password)

    # mark token used (one-time)
    row.used_at = dt.datetime.utcnow()

    # revoke all active sessions for this user (recommended)
    db.query(DbSession).filter(
        DbSession.user_id == u.id,
        DbSession.revoked_at.is_(None),
    ).update({DbSession.revoked_at: dt.datetime.utcnow()}, synchronize_session=False)

    db.commit()
    return {"ok": True}


@router.post("/delete-account")
def delete_account(request: Request, response: Response, db: OrmSession = Depends(get_db)):
    u = get_current_user(db, request)

    # 1) Collect related rows first (before deletion)
    user_files = db.query(DbFile).filter(DbFile.user_id == u.id).all()
    user_jobs = db.query(Job).filter(Job.created_by == u.id).all()

    # 2) Remove disk artifacts (best-effort)
    # - uploaded raw files
    for f in user_files:
        try:
            p = Path(f.storage_path)
            if p.exists() and p.is_file():
                p.unlink()
        except Exception:
            pass

    # - job folders
    for j in user_jobs:
        try:
            job_dir = settings.artifacts_dir / j.id
            _safe_rm_tree(job_dir)
        except Exception:
            pass

    # 3) Delete DB rows connected to user
    # order matters due to foreign keys
    db.query(JobEvent).filter(JobEvent.created_by == u.id).delete(synchronize_session=False)
    db.query(Notification).filter(Notification.recipient_user_id == u.id).delete(synchronize_session=False)
    db.query(DbSession).filter(DbSession.user_id == u.id).delete(synchronize_session=False)

    # Jobs created by user
    for j in user_jobs:
        db.query(JobEvent).filter(JobEvent.job_id == j.id).delete(synchronize_session=False)
        db.query(Notification).filter(Notification.job_id == j.id).delete(synchronize_session=False)
    db.query(Job).filter(Job.created_by == u.id).delete(synchronize_session=False)

    # Files uploaded by user
    db.query(DbFile).filter(DbFile.user_id == u.id).delete(synchronize_session=False)

    # 4) Soft delete the user account
    u.is_active = False
    u.deleted_at = _utcnow()

    # optional: anonymize email to allow re-register same email later
    u.email = f"deleted_{u.id}_{int(_utcnow().timestamp())}@deleted.local"
    u.display_name = None
    u.password_hash = "deleted"

    db.commit()

    # 5) Clear cookie/session
    clear_session_cookie(response)

    return {"ok": True}


@router.get("/me")
def me(request: Request, db: OrmSession = Depends(get_db)):
    u = get_current_user(db, request)
    return {"id": u.id, "email": u.email, "role": u.role, "display_name": u.display_name}


@router.post("/profile")
def update_profile(payload: dict, request: Request, db: OrmSession = Depends(get_db)):
    u = get_current_user(db, request)

    display_name = (payload.get("display_name") or "").strip() or None
    u.display_name = display_name
    db.commit()

    return {"ok": True, "display_name": u.display_name}
