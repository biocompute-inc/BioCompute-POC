from __future__ import annotations

import shutil
from b2a_adapter import run_b2a_pipeline
from compare_utils import compare_plaintext_vs_ascii

from sqlalchemy import func, distinct
import datetime as dt
import uuid
from pathlib import Path

from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, Request, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from fastapi.responses import FileResponse

from db import init_db, get_db
from settings import get_settings
from models import User, File as DbFile, Job, Notification, JobEvent
from auth_utils import (
    hash_password, verify_password, create_session,
    set_session_cookie, clear_session_cookie,
    get_current_user, require_role
)
from file_convert import convert_to_base64_plaintext
from ot2_adapter import generate_ot2_protocol
from byte_text_codec import raw_bytes_to_decimal_text
from b2a_normalize import write_recovered_file, B2ANormalizationError
from byte_compare import compare_files_bytewise



settings = get_settings()

app = FastAPI(title="BioCompute POC Backend")

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
from sqlalchemy import func

ACTIVE_JOB_STATUSES = {"PROTOCOL_READY", "BAM_UPLOADED", "DECODING"}

def _choose_scientist_least_loaded(db: Session) -> User | None:
    scientists = db.query(User).filter(User.role == "scientist", User.is_active == True).all()  # noqa: E712
    if not scientists:
        return None

    # Count active assigned jobs per scientist
    rows = (
        db.query(Job.assigned_to, func.count(Job.id))
        .filter(Job.assigned_to.isnot(None))
        .filter(Job.status.in_(list(ACTIVE_JOB_STATUSES)))
        .group_by(Job.assigned_to)
        .all()
    )
    counts = {sid: cnt for (sid, cnt) in rows}

    # Pick the scientist with minimum active jobs
    return min(scientists, key=lambda s: counts.get(s.id, 0))

def _auto_assign_job(db: Session, job: Job, actor_user_id: int):
    """
    Assign job to a scientist automatically once protocol is ready.
    """
    if job.assigned_to is not None:
        return  # already assigned

    chosen = _choose_scientist_least_loaded(db)
    if chosen is None:
        # No scientists exist: log event and keep job unassigned
        db.add(JobEvent(
            job_id=job.id,
            created_by=actor_user_id,
            event_type="ASSIGNMENT_SKIPPED",
            message="No active scientist accounts found; job not assigned",
            created_at=_utcnow(),
        ))
        db.commit()
        return

    job.assigned_to = chosen.id
    job.claimed_at = _utcnow()  # optional: record assignment time
    job.updated_at = _utcnow()

    db.add(JobEvent(
        job_id=job.id,
        created_by=actor_user_id,
        event_type="ASSIGNED",
        message=f"Auto-assigned to scientist {chosen.email}",
        created_at=_utcnow(),
    ))

    db.add(Notification(
        recipient_user_id=chosen.id,
        job_id=job.id,
        type="JOB_ASSIGNED",
        title="New job assigned",
        message=f"Job {job.id} is ready. Download protocol and run sequencing, then upload BAM.",
        is_read=False,
        created_at=_utcnow(),
    ))

    db.commit()

def _mark_job_done_free_scientist(db: Session, job: Job):
    """
    When job completes, scientist is automatically freed because BUSY/FREE is computed.
    No DB change needed except job status already updated.
    """
    job.updated_at = _utcnow()
    db.commit()


@app.on_event("startup")
def startup():
    settings.artifacts_dir.mkdir(parents=True, exist_ok=True)
    init_db()

def _utcnow():
    return dt.datetime.utcnow()

def _notify_all_scientists_and_admins(db: Session, job_id: str, title: str, message: str, ntype: str):
    recipients = db.query(User).filter(User.is_active == True, User.role.in_(["scientist", "admin"])).all()  # noqa: E712
    for u in recipients:
        db.add(Notification(
            recipient_user_id=u.id,
            job_id=job_id,
            type=ntype,
            title=title,
            message=message,
            is_read=False,
            created_at=_utcnow(),
        ))
    db.commit()

@app.get("/")
def root():
    return {"ok": True, "message": "BioCompute POC backend is running. Go to /docs"}

# ---------------- AUTH ----------------

@app.post("/auth/register")
def register(payload: dict, db: Session = Depends(get_db)):
    """
    Payload: { "email": "...", "password": "...", "role": "user|scientist|admin" (optional) }
    For POC: allow role set during registration to speed testing.
    """
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    role = "user"
    display_name = (payload.get("display_name") or "").strip() or None

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
    return {"id": u.id, "email": u.email, "role": u.role}

@app.post("/auth/login")
def login(payload: dict, response: Response, db: Session = Depends(get_db)):
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

@app.post("/auth/logout")
def logout(response: Response):
    clear_session_cookie(response)
    return {"ok": True}

@app.get("/auth/me")
def me(request: Request, db: Session = Depends(get_db)):
    u = get_current_user(db, request)
    return {"id": u.id, "email": u.email, "role": u.role, "display_name": u.display_name}

@app.post("/auth/profile")
def update_profile(payload: dict, request: Request, db: Session = Depends(get_db)):
    u = get_current_user(db, request)

    display_name = (payload.get("display_name") or "").strip() or None
    u.display_name = display_name
    db.commit()

    return {"ok": True, "display_name": u.display_name}

# ---------------- ADMIN USERS ----------------
@app.post("/admin/users")
def create_user_admin(
    payload: dict,
    request: Request,
    db: Session = Depends(get_db)
):
    admin = get_current_user(db, request)
    if admin.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    role = (payload.get("role") or "").strip().lower()
    display_name = (payload.get("display_name") or "").strip() or None

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

@app.get("/admin/analytics/users")
def admin_users_analytics(request: Request, db: Session = Depends(get_db)):
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
    file_map = {r.user_id: {"total_files": int(r.total_files), "total_storage": int(r.total_storage)} for r in file_rows}

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
        out.append({
            "user_id": u.id,
            "email": u.email,
            "display_name": u.display_name,
            "total_files": agg["total_files"],
            "total_storage_bytes": agg["total_storage"],
            "total_retrievals": retrieval_map.get(u.id, 0),
        })
    return out

@app.get("/admin/analytics/staff")
def admin_staff_analytics(request: Request, db: Session = Depends(get_db)):
    admin = get_current_user(db, request)
    if admin.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # active assigned jobs per scientist
    active_rows = (
        db.query(Job.assigned_to.label("sid"), func.count(Job.id).label("active_jobs"))
        .filter(Job.assigned_to.isnot(None))
        .filter(Job.status.in_(list(ACTIVE_JOB_STATUSES)))
        .group_by(Job.assigned_to)
        .all()
    )
    active_map = {r.sid: int(r.active_jobs) for r in active_rows}

    staff = db.query(User).filter(User.role.in_(["scientist", "admin"]), User.is_active == True).all()  # noqa: E712

    out = []
    for s in staff:
        active_jobs = active_map.get(s.id, 0)
        status = "BUSY" if (s.role == "scientist" and active_jobs > 0) else "FREE"
        if s.role == "admin":
            status = "N/A"
        out.append({
            "user_id": s.id,
            "email": s.email,
            "display_name": s.display_name,
            "role": s.role,
            "status": status,
            "active_jobs": active_jobs if s.role == "scientist" else None,
        })

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


# ---------------- NOTIFICATIONS ----------------

@app.get("/notifications")
def list_notifications(request: Request, db: Session = Depends(get_db)):
    u = get_current_user(db, request)

    items = db.query(Notification).filter(
        Notification.recipient_user_id == u.id
    ).order_by(Notification.created_at.desc()).limit(50).all()

    return [{
        "id": n.id,
        "job_id": n.job_id,
        "type": n.type,
        "title": n.title,
        "message": n.message,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    } for n in items]

@app.post("/notifications/{notif_id}/read")
def read_notification(notif_id: int, request: Request, db: Session = Depends(get_db)):
    u = get_current_user(db, request)
    n = db.query(Notification).filter(Notification.id == notif_id, Notification.recipient_user_id == u.id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")

    n.is_read = True
    n.read_at = _utcnow()
    db.commit()
    return {"ok": True}

# ---------------- JOBS ----------------

@app.post("/jobs/from-file")
def create_job_from_file(
    request: Request,
    upload: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    u = get_current_user(db, request)

    # 1) Create IDs
    job_id = str(uuid.uuid4())
    file_id = str(uuid.uuid4())

    # 2) Create artifact dirs
    job_dir = settings.artifacts_dir / job_id
    input_dir = job_dir / "input"
    derived_dir = job_dir / "derived"
    proto_dir = job_dir / "protocol"

    input_dir.mkdir(parents=True, exist_ok=True)
    derived_dir.mkdir(parents=True, exist_ok=True)
    proto_dir.mkdir(parents=True, exist_ok=True)

    # 3) Save uploaded file to disk
    raw_path = input_dir / (upload.filename or "uploaded.bin")
    raw_bytes = upload.file.read()
    raw_path.write_bytes(raw_bytes)

    plaintext_path = derived_dir / "plaintext_decimal.txt"

    # 4) Create DB rows (file + job)
    db_file = DbFile(
        id=file_id,
        user_id=u.id,
        original_filename=upload.filename,
        content_type=upload.content_type,
        size_bytes=len(raw_bytes),
        storage_path=str(raw_path),
        conversion_status="PENDING",
        created_at=_utcnow(),
    )
    db.add(db_file)

    job = Job(
        id=job_id,
        created_by=u.id,
        file_id=file_id,            # IMPORTANT: link job to file if your schema has it
        status="CREATED",
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db.add(job)

    db.add(JobEvent(
        job_id=job_id,
        created_by=u.id,
        event_type="CREATED",
        message="Job created",
        created_at=_utcnow(),
    ))

    db.commit()

    # 5) Convert uploaded file -> decimal-per-line plaintext (NO Base64, NO hashes)
    try:
        raw_bytes_to_decimal_text(raw_path, plaintext_path)

        # store plaintext path only (no sha, no checksums)
        db_file.plaintext_path = str(plaintext_path)
        db_file.conversion_status = "SUCCESS"
        db_file.conversion_error = None

        job.plaintext_path = str(plaintext_path)
        job.status = "PROTOCOL_GENERATING"
        job.updated_at = _utcnow()

        db.add(JobEvent(
            job_id=job_id,
            created_by=u.id,
            event_type="CONVERTED",
            message="Converted uploaded file to decimal-per-line plaintext",
            created_at=_utcnow(),
        ))

        db.commit()

    except Exception as e:
        db_file.conversion_status = "FAILED"
        db_file.conversion_error = str(e)

        job.status = "FAILED"
        job.error_code = "CONVERSION_FAILED"
        job.error_message = str(e)
        job.updated_at = _utcnow()

        db.add(JobEvent(
            job_id=job_id,
            created_by=u.id,
            event_type="FAILED",
            message=f"Conversion failed: {e}",
            created_at=_utcnow(),
        ))
        db.commit()

        raise HTTPException(status_code=500, detail=f"Conversion failed: {e}")


    # 6) Generate OT-2 protocol using official script CLI
    try:
        generated_protocol_path = generate_ot2_protocol(
            ot2_repo_dir=settings.ot2_repo_dir,
            input_file_path=plaintext_path,
            out_dir=proto_dir,
            temp_vol_ul=1.0,
        )

        job.protocol_path = str(generated_protocol_path)
        job.status = "PROTOCOL_READY"
        job.updated_at = _utcnow()

        db.add(JobEvent(
            job_id=job_id,
            created_by=u.id,
            event_type="PROTOCOL_READY",
            message=f"Protocol generated: {generated_protocol_path.name}",
            created_at=_utcnow(),
        ))
        db.commit()
        _auto_assign_job(db, job=job, actor_user_id=u.id)

        # _notify_all_scientists_and_admins(
        #     db=db,
        #     job_id=job_id,
        #     title="New Job Ready for Lab",
        #     message=f"Job {job_id} is ready. Protocol generated: {generated_protocol_path.name}",
        #     ntype="PROTOCOL_READY",
        # )

    except Exception as e:
        job.status = "FAILED"
        job.error_code = "PROTOCOL_FAILED"
        job.error_message = str(e)
        job.updated_at = _utcnow()

        db.add(JobEvent(
            job_id=job_id,
            created_by=u.id,
            event_type="FAILED",
            message=f"Protocol generation failed: {e}",
            created_at=_utcnow(),
        ))
        db.commit()

        raise HTTPException(status_code=500, detail=f"Protocol generation failed: {e}")

    # 7) Return
    return {
        "job_id": job_id,
        "file_id": file_id,
        "status": job.status,
        "protocol_download_url": f"/jobs/{job_id}/protocol",
    }

@app.get("/jobs")
def list_jobs(request: Request, db: Session = Depends(get_db)):
    u = get_current_user(db, request)

    q = db.query(Job).order_by(Job.created_at.desc())
    if u.role == "user":
        q = q.filter(Job.created_by == u.id)

    jobs = q.limit(50).all()
    return [{
        "id": j.id,
        "status": j.status,
        "created_at": j.created_at.isoformat() if j.created_at else None,
        "protocol_download_url": f"/jobs/{j.id}/protocol" if j.protocol_path else None,
        "error_message": j.error_message,
    } for j in jobs]

@app.get("/jobs/{job_id}")
def get_job(job_id: str, request: Request, db: Session = Depends(get_db)):
    u = get_current_user(db, request)
    j = db.query(Job).filter(Job.id == job_id).first()
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")

    # Access control: user only sees own jobs
    if u.role == "user" and j.created_by != u.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    events = db.query(JobEvent).filter(JobEvent.job_id == job_id).order_by(JobEvent.created_at.asc()).all()

    return {
        "id": j.id,
        "status": j.status,
        "created_by": j.created_by,
        "assigned_to": j.assigned_to,
        "plaintext_path": j.plaintext_path,
        "protocol_download_url": f"/jobs/{j.id}/protocol" if j.protocol_path else None,
        "error_code": j.error_code,
        "error_message": j.error_message,
        "created_at": j.created_at.isoformat() if j.created_at else None,
        "updated_at": j.updated_at.isoformat() if j.updated_at else None,
        "events": [{
            "event_type": e.event_type,
            "message": e.message,
            "created_at": e.created_at.isoformat() if e.created_at else None
        } for e in events]
    }

from fastapi.responses import FileResponse

@app.get("/jobs/{job_id}/protocol")
def download_protocol(job_id: str, request: Request, db: Session = Depends(get_db)):
    u = get_current_user(db, request)

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # allow owner or scientist/admin
    if job.created_by != u.id and u.role not in {"scientist", "admin"}:
        raise HTTPException(status_code=403, detail="Forbidden")

    if not job.protocol_path:
        raise HTTPException(status_code=400, detail="Protocol not generated yet")

    return FileResponse(path=job.protocol_path, filename=Path(job.protocol_path).name)


@app.post("/jobs/{job_id}/bam")
def upload_bam(job_id: str, request: Request, bam: UploadFile = File(...), db: Session = Depends(get_db)):
    u = get_current_user(db, request)
    require_role(u, {"scientist", "admin"})

    j = db.query(Job).filter(Job.id == job_id).first()
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    if not j.plaintext_path or not j.protocol_path:
        raise HTTPException(status_code=400, detail="Job is not ready for BAM upload (missing plaintext/protocol).")

    job_dir = settings.artifacts_dir / job_id
    bam_dir = job_dir / "bam"
    b2a_dir = job_dir / "b2a"
    results_dir = job_dir / "results"
    bam_dir.mkdir(parents=True, exist_ok=True)

    bam_path = bam_dir / (bam.filename or "input.bam")
    with bam_path.open("wb") as f:
        shutil.copyfileobj(bam.file, f)

    # Update job state
    j.bam_path = str(bam_path)
    j.status = "DECODING"
    j.updated_at = _utcnow()
    db.add(JobEvent(job_id=job_id, created_by=u.id, event_type="BAM_UPLOADED",
                    message=f"BAM uploaded: {bam_path.name}", created_at=_utcnow()))
    db.commit()

    try:
        ascii_out = run_b2a_pipeline(
            git_bash_path=settings.git_bash_path,
            b2a_repo_dir=settings.b2a_repo_dir,
            bam_path=bam_path,
            reference_fasta=settings.b2a_reference_fasta,
            out_dir=b2a_dir,
            bitwidth=settings.b2a_bitwidth,
        )

        j.ascii_path = str(ascii_out)
        db.add(JobEvent(job_id=job_id, created_by=u.id, event_type="B2A_DONE",
                        message=f"B2A produced: {ascii_out.name}", created_at=_utcnow()))
        db.commit()

        summary_path = results_dir / "compare_summary.json"
        summary = compare_plaintext_vs_ascii(
            plaintext_path=Path(j.plaintext_path),
            ascii_path=ascii_out,
            out_summary_path=summary_path,
        )

        j.result_summary_json_path = str(summary_path)
        j.match = bool(summary["match"])
        j.status = "COMPLETED" if j.match else "FAILED"
        j.error_code = None if j.match else "MISMATCH"
        j.error_message = None if j.match else "Mismatch: B2A output does not match plaintext (after normalization)."
        j.updated_at = _utcnow()

        db.add(JobEvent(job_id=job_id, created_by=u.id, event_type="COMPLETED" if j.match else "FAILED",
                        message="Job comparison finished", created_at=_utcnow()))
        db.commit()
        _mark_job_done_free_scientist(db, j)

        # Notify the job owner
        owner = db.query(User).filter(User.id == j.created_by).first()
        if owner:
            db.add(Notification(
                recipient_user_id=owner.id,
                job_id=job_id,
                type="JOB_COMPLETED" if j.match else "JOB_FAILED",
                title="Job completed" if j.match else "Job failed",
                message=f"Job {job_id} finished. Result: {'MATCH' if j.match else 'MISMATCH'}",
                is_read=False,
                created_at=_utcnow(),
            ))
            db.commit()

        return {
            "job_id": job_id,
            "status": j.status,
            "match": j.match,
            "summary": summary,
        }

    except Exception as e:
        j.status = "FAILED"
        j.error_code = "B2A_FAILURE"
        j.error_message = str(e)
        j.updated_at = _utcnow()
        db.add(JobEvent(job_id=job_id, created_by=u.id, event_type="FAILED",
                        message=f"Decoding failed: {e}", created_at=_utcnow()))
        db.commit()
        raise HTTPException(status_code=500, detail=f"Decoding failed: {e}")

@app.post("/jobs/{job_id}/complete")
def mark_job_complete(job_id: str, request: Request, db: Session = Depends(get_db)):
    u = get_current_user(db, request)
    require_role(u, {"scientist", "admin"})

    j = db.query(Job).filter(Job.id == job_id).first()
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")

    if u.role == "scientist" and j.assigned_to != u.id:
        raise HTTPException(status_code=403, detail="Not assigned to this job")

    if j.status in {"COMPLETED", "FAILED"}:
        return {"job_id": j.id, "status": j.status}

    if j.status not in {"PROTOCOL_READY", "BAM_UPLOADED"}:
        raise HTTPException(status_code=400, detail="Job is not ready to be marked complete")

    j.status = "COMPLETED"
    j.match = None
    j.error_code = None
    j.error_message = None
    j.updated_at = _utcnow()

    db.add(JobEvent(
        job_id=job_id,
        created_by=u.id,
        event_type="COMPLETED_MANUAL",
        message="Job marked completed by scientist",
        created_at=_utcnow(),
    ))
    db.commit()

    owner = db.query(User).filter(User.id == j.created_by).first()
    if owner:
        db.add(Notification(
            recipient_user_id=owner.id,
            job_id=job_id,
            type="JOB_COMPLETED",
            title="Job completed",
            message=f"Job {job_id} was marked completed by the lab.",
            is_read=False,
            created_at=_utcnow(),
        ))
        db.commit()

    return {"job_id": j.id, "status": j.status}
    
@app.get("/dashboard/summary")
def dashboard_summary(request: Request, db: Session = Depends(get_db)):
    u = get_current_user(db, request)

    total_files = db.query(func.count(DbFile.id)).filter(DbFile.user_id == u.id).scalar() or 0
    total_storage = db.query(func.coalesce(func.sum(DbFile.size_bytes), 0)).filter(DbFile.user_id == u.id).scalar() or 0

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

@app.get("/dashboard/files")
def dashboard_files(request: Request, db: Session = Depends(get_db)):
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
        rows.append({
            "file_id": f.id,
            "file_name": f.original_filename or "uploaded.bin",
            "uploaded_at": f.created_at.isoformat() if f.created_at else None,
            "size_bytes": f.size_bytes or 0,
            "status": latest_job.status if latest_job else f.conversion_status,
            "job_id": latest_job.id if latest_job else None,
        })

    return rows

@app.get("/scientist/jobs")
def scientist_jobs(request: Request, db: Session = Depends(get_db)):
    s = get_current_user(db, request)
    if s.role not in {"scientist", "admin"}:
        raise HTTPException(status_code=403, detail="Scientist/admin access required")

    jobs = (
        db.query(Job)
        .filter(Job.assigned_to == s.id)
        .order_by(Job.created_at.desc())
        .limit(200)
        .all()
    )

    out = []
    for j in jobs:
        out.append({
            "id": j.id,
            "status": j.status,
            "created_at": j.created_at.isoformat() if j.created_at else None,
            "file_id": j.file_id,
            "protocol_download_url": f"/jobs/{j.id}/protocol" if j.protocol_path else None,
            "match": j.match,
        })
    return out
