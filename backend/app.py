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

    plaintext_path = derived_dir / "plaintext.txt"

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

    # 5) Convert uploaded file -> Base64 plaintext
    try:
        plaintext_sha, raw_sha = convert_to_base64_plaintext(raw_path, plaintext_path)

        db_file.sha256 = raw_sha
        db_file.plaintext_path = str(plaintext_path)
        db_file.plaintext_sha256 = plaintext_sha
        db_file.conversion_status = "SUCCESS"
        db_file.conversion_error = None

        job.plaintext_path = str(plaintext_path)
        job.status = "PROTOCOL_GENERATING"
        job.updated_at = _utcnow()

        db.add(JobEvent(
            job_id=job_id,
            created_by=u.id,
            event_type="CONVERTED",
            message="Converted uploaded file to Base64 plaintext",
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

        _notify_all_scientists_and_admins(
            db=db,
            job_id=job_id,
            title="New Job Ready for Lab",
            message=f"Job {job_id} is ready. Protocol generated: {generated_protocol_path.name}",
            ntype="PROTOCOL_READY",
        )

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
            out_dir=b2a_dir,
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
