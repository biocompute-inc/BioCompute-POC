from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session as OrmSession

from auth.service import _utcnow
from auth_utils import get_current_user, hash_password
from db import get_db
from models import File as DbFile
from models import Job
from models import User

router = APIRouter()

# Author - Naveen M, for BioCompute, PoC - Version 0.0.1
# This file contains admin-specific routes for user management and analytics. It includes endpoints for creating users and viewing analytics about users and staff. Access to these endpoints is restricted to users with the admin role.
# It requires admin role.
# This is helps admin to create special users like scientists and also to view analytics about users and staff.

@router.post("/admin/users") #Admin route to create a new user (scientist or admin)
def create_user_admin(payload: dict, request: Request, db: OrmSession = Depends(get_db)):
    admin = get_current_user(db, request)
    if admin.role != "admin": #If the user is not an admin, raise a 403 error
        raise HTTPException(status_code=403, detail="Admin access required")

    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    role = (payload.get("role") or "").strip().lower()
    display_name = payload.get("display_name") or payload.get("displayName") or None

    if display_name:
        display_name = display_name.strip()
    if role not in {"scientist", "admin"}:
        raise HTTPException(status_code=400, detail="Invalid role")

    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email")

    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password too short")

    if len(password) > 24:
        raise HTTPException(status_code=400, detail="Password too long (max 24 chars)")
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

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

    return {
        "id": u.id,
        "email": u.email,
        "role": u.role,
        "display_name": u.display_name,
    }


@router.get("/admin/analytics/users") #Admin route to get analytics about users, including total files, storage, and retrievals. Accessible only by admins.
def admin_users_analytics(request: Request, db: OrmSession = Depends(get_db)):
    admin = get_current_user(db, request)
    if admin.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    file_rows = (
        db.query(
            DbFile.user_id.label("user_id"),
            func.count(DbFile.id).label("total_files"),
            func.coalesce(func.sum(DbFile.size_bytes), 0).label("total_storage"),
        )
        .group_by(DbFile.user_id)
        .all()
    )
    file_map = {
        r.user_id: {"total_files": int(r.total_files), "total_storage": int(r.total_storage)}
        for r in file_rows
    }

    retrieval_rows = (
        db.query(Job.created_by.label("user_id"), func.count(Job.id).label("total_retrievals"))
        .filter(Job.ascii_path.isnot(None))
        .group_by(Job.created_by)
        .all()
    )
    retrieval_map = {r.user_id: int(r.total_retrievals) for r in retrieval_rows}

    users = db.query(User).filter(User.role == "user").order_by(User.created_at.desc()).all()

    out = []
    for u in users:
        agg = file_map.get(u.id, {"total_files": 0, "total_storage": 0})
        out.append(
            {
                "user_id": u.id,
                "email": u.email,
                "display_name": u.display_name,
                "total_files": agg["total_files"],
                "total_storage_bytes": agg["total_storage"],
                "total_retrievals": retrieval_map.get(u.id, 0),
            }
        )
    return out


@router.get("/admin/analytics/staff") #Admin route to get analytics about staff (scientists and admins), including their current status (busy/free) based on active jobs. Accessible only by admins.
def admin_staff_analytics(request: Request, db: OrmSession = Depends(get_db)):
    admin = get_current_user(db, request)
    if admin.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    active_rows = (
        db.query(Job.assigned_to.label("sid"), func.count(Job.id).label("active_jobs"))
        .filter(Job.assigned_to.isnot(None))
        .filter(Job.status.in_(["PROTOCOL_READY", "BAM_UPLOADED", "DECODING"]))
        .group_by(Job.assigned_to)
        .all()
    )
    active_map = {r.sid: int(r.active_jobs) for r in active_rows}

    staff = (
        db.query(User)
        .filter(User.role.in_(["scientist", "admin"]), User.is_active == True)  # noqa: E712
        .all()
    )

    out = []
    for s in staff:
        active_jobs = active_map.get(s.id, 0)
        status = "BUSY" if (s.role == "scientist" and active_jobs > 0) else "FREE"
        if s.role == "admin":
            status = "ADMIN"
        out.append(
            {
                "user_id": s.id,
                "email": s.email,
                "display_name": s.display_name,
                "role": s.role,
                "status": status,
                "active_jobs": active_jobs if s.role == "scientist" else None,
            }
        )

    # summary counts for dashboard cards
    total_scientists = len([x for x in out if x["role"] == "scientist"])
    busy_scientists = len([x for x in out if x["role"] == "scientist" and x["status"] == "BUSY"])
    free_scientists = len([x for x in out if x["role"] == "scientist" and x["status"] == "FREE"])

    return {
        "summary": {
            "total_scientists": total_scientists,
            "busy_scientists": busy_scientists,
            "free_scientists": free_scientists,
        },
        "staff": out,
    }
