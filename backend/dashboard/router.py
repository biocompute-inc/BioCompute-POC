from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func
from sqlalchemy.orm import Session as OrmSession

from auth_utils import get_current_user
from db import get_db
from models import File as DbFile
from models import Job

router = APIRouter()

# Author - Naveen M, for BioCompute, PoC - Version 0.0.1
# This file contains routes for the user dashboard, including endpoints to get a summary of the user's activity and a list of their uploaded files.
# The dashboard summary includes total files, total storage used, and total retrievals (jobs that reached B2A output).
# The files endpoint returns a list of the user's uploaded files along with their status and associated job information.
# These routes require authentication and use the current user's information to query the database for relevant data.

@router.get("/")
def root():
    return {"ok": True, "message": "BioCompute POC backend is running. Go to /docs"}


@router.get("/dashboard/summary")
def dashboard_summary(request: Request, db: OrmSession = Depends(get_db)):
    u = get_current_user(db, request)

    total_files = db.query(func.count(DbFile.id)).filter(DbFile.user_id == u.id).scalar() or 0
    total_storage = (
        db.query(func.coalesce(func.sum(DbFile.size_bytes), 0))
        .filter(DbFile.user_id == u.id)
        .scalar()
        or 0
    )

    # "Retrievals" in POC = jobs that reached B2A output (ascii_path present)
    total_retrievals = (
        db.query(func.count(Job.id))
        .filter(Job.created_by == u.id, Job.ascii_path.isnot(None))
        .scalar()
        or 0
    )

    return {
        "display_name": u.display_name,
        "total_files": int(total_files),
        "total_storage_bytes": int(total_storage),
        "total_retrievals": int(total_retrievals),
    }


@router.get("/dashboard/files")
def dashboard_files(request: Request, db: OrmSession = Depends(get_db)):
    u = get_current_user(db, request)

    files = (
        db.query(DbFile)
        .filter(DbFile.user_id == u.id)
        .order_by(DbFile.created_at.desc())
        .limit(200)
        .all()
    )

    rows = []
    for f in files:
        latest_job = (
            db.query(Job)
            .filter(Job.file_id == f.id)
            .order_by(Job.created_at.desc())
            .first()
        )
        rows.append(
            {
                "file_id": f.id,
                "file_name": f.original_filename or "uploaded.bin",
                "uploaded_at": f.created_at.isoformat() if f.created_at else None,
                "size_bytes": f.size_bytes or 0,
                "status": latest_job.status if latest_job else f.conversion_status,
                "job_id": latest_job.id if latest_job else None,
            }
        )

    return rows
