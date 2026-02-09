from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from fastapi import Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session as OrmSession

from auth.service import _utcnow
from auth_utils import get_current_user, require_role
from b2a_adapter import run_b2a_pipeline
from compare_utils import compare_plaintext_vs_ascii
from db import get_db
from jobs.assign import _auto_assign_job, _mark_job_done_free_scientist
from models import File as DbFile
from models import Job
from models import JobEvent
from models import Notification
from models import User
from ot2_adapter import generate_ot2_protocol
from settings import get_settings
from ot2_client import OT2Config, push_protocol_placeholder

settings = get_settings()

ALLOWED_DELETE_STATUSES = {"stored", "retrieved", "failed", "completed"}

# Author - Naveen M, for BioCompute, PoC - Version 0.0.1 <Future Authors can add whatever they have done and add the name as co-author>
# This file contains the main service functions for handling job-related operations, such as creating jobs from uploaded files, listing jobs, retrieving job details, uploading BAM files, marking jobs as complete, and deleting jobs.
# The create_job_from_file function handles the entire flow of receiving an uploaded file, saving it, generating a protocol, and updating the job status accordingly.
# The upload_bam function processes the uploaded BAM file, runs the B2A pipeline, compares results, and updates the job status based on the outcome.
# The mark_job_complete function allows scientists to manually mark a job as complete, while the delete_job function handles the deletion of jobs and associated data with proper access control and status checks.
# TODO: Write the Generate OT-2 protocol as a seperate funtion so the scientist can generate whatever the protocol they want from tools/OT2-BRICK-MIX-PROTOCOLS and then upload the protocol instead of generating it from the plaintext. This will allow more flexibility for the scientists to use their own protocol and also to test the same plaintext with different protocols. The current implementation is simplified for the POC to demonstrate the full flow, but in a real system we would want to allow more flexibility and control for the scientists in the lab.

def _notify_all_scientists_and_admins(
    db: OrmSession, job_id: str, title: str, message: str, ntype: str
):
    recipients = (
        db.query(User)
        .filter(User.is_active == True, User.role.in_(["scientist", "admin"]))  # noqa: E712
        .all()
    )
    for u in recipients:
        db.add(
            Notification(
                recipient_user_id=u.id,
                job_id=job_id,
                type=ntype,
                title=title,
                message=message,
                is_read=False,
                created_at=_utcnow(),
            )
        )
    db.commit()


def create_job_from_file(
    request: Request,
    upload: UploadFile = File(...),
    db: OrmSession = Depends(get_db),
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

    plaintext_path = raw_path  # input_dir / "plaintext_decimal.txt"

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
        file_id=file_id,  # IMPORTANT: link job to file if your schema has it
        status="CREATED",
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db.add(job)

    db.add(
        JobEvent(
            job_id=job_id,
            created_by=u.id,
            event_type="CREATED",
            message="Job created",
            created_at=_utcnow(),
        )
    )

    db.commit()

    db_file.plaintext_path = str(plaintext_path)
    db_file.conversion_status = "SUCCESS"
    db_file.conversion_error = None

    job.plaintext_path = str(plaintext_path)
    job.status = "PROTOCOL_GENERATING"
    job.updated_at = _utcnow()

    # 5) Generate OT-2 protocol using official script CLI
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

        db.add(
            JobEvent(
                job_id=job_id,
                created_by=u.id,
                event_type="PROTOCOL_READY",
                message=f"Protocol generated: {generated_protocol_path.name}",
                created_at=_utcnow(),
            )
        )
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

        db.add(
            JobEvent(
                job_id=job_id,
                created_by=u.id,
                event_type="FAILED",
                message=f"Protocol generation failed: {e}",
                created_at=_utcnow(),
            )
        )
        db.commit()

        raise HTTPException(status_code=500, detail=f"Protocol generation failed: {e}")

    # 7) Return
    return {
        "job_id": job_id,
        "file_id": file_id,
        "status": job.status,
        "protocol_download_url": f"/jobs/{job_id}/protocol",
        "plaintext_path_download_url": f"/jobs/{job_id}/plaintext",
    }


def list_jobs(request: Request, db: OrmSession = Depends(get_db)):
    u = get_current_user(db, request)

    q = db.query(Job).order_by(Job.created_at.desc())
    if u.role == "user":
        q = q.filter(Job.created_by == u.id)

    jobs = q.limit(50).all()
    return [
        {
            "id": j.id,
            "status": j.status,
            "created_at": j.created_at.isoformat() if j.created_at else None,
            "protocol_download_url": f"/jobs/{j.id}/protocol" if j.protocol_path else None,
            "plaintext_path_download_url": f"/jobs/{j.id}/plaintext",
            "error_message": j.error_message,
        }
        for j in jobs
    ]


def get_job(job_id: str, request: Request, db: OrmSession = Depends(get_db)):
    u = get_current_user(db, request)
    j = db.query(Job).filter(Job.id == job_id).first()
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")

    # Access control: user only sees own jobs
    if u.role == "user" and j.created_by != u.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    events = (
        db.query(JobEvent)
        .filter(JobEvent.job_id == job_id)
        .order_by(JobEvent.created_at.asc())
        .all()
    )

    return {
        "id": j.id,
        "status": j.status,
        "created_by": j.created_by,
        "assigned_to": j.assigned_to,
        "file_id": j.file_id,
        "original_filename": j.file.original_filename if j.file else None,
        "plaintext_path": j.plaintext_path,
        "protocol_download_url": f"/jobs/{j.id}/protocol" if j.protocol_path else None,
        "plaintext_path_download_url": f"/jobs/{j.id}/plaintext",
        "error_code": j.error_code,
        "error_message": j.error_message,
        "created_at": j.created_at.isoformat() if j.created_at else None,
        "updated_at": j.updated_at.isoformat() if j.updated_at else None,
        "events": [
            {
                "event_type": e.event_type,
                "message": e.message,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in events
        ],
    }


def download_plaintext(job_id: str, request: Request, db: OrmSession = Depends(get_db)):
    u = get_current_user(db, request)

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # allow owner or scientist/admin
    if job.created_by != u.id and u.role not in {"scientist", "admin"}:
        raise HTTPException(status_code=403, detail="Forbidden")

    if not job.plaintext_path:
        raise HTTPException(status_code=400, detail="Plaintext not generated yet")

    # Use the stored input filename (from input_dir) for download name
    download_name = Path(job.plaintext_path).name

    return FileResponse(path=job.plaintext_path, filename=download_name)


def download_protocol(job_id: str, request: Request, db: OrmSession = Depends(get_db)):
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


def upload_bam(
    job_id: str, request: Request, bam: UploadFile = File(...), db: OrmSession = Depends(get_db)
):
    u = get_current_user(db, request)
    require_role(u, {"scientist", "admin"})

    j = db.query(Job).filter(Job.id == job_id).first()
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    if not j.plaintext_path or not j.protocol_path:
        raise HTTPException(
            status_code=400, detail="Job is not ready for BAM upload (missing plaintext/protocol)."
        )

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
    db.add(
        JobEvent(
            job_id=job_id,
            created_by=u.id,
            event_type="BAM_UPLOADED",
            message=f"BAM uploaded: {bam_path.name}",
            created_at=_utcnow(),
        )
    )
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
        print("DEBUG ASCII PATH:", ascii_out)
        print("DEBUG ASCII SIZE:", Path(ascii_out).stat().st_size)
        print(
            "DEBUG ASCII CONTENT PREVIEW:",
            Path(ascii_out).read_text(encoding="utf-8", errors="ignore")[:50],
        )

        j.ascii_path = str(ascii_out)
        db.add(
            JobEvent(
                job_id=job_id,
                created_by=u.id,
                event_type="B2A_DONE",
                message=f"B2A produced: {ascii_out.name}",
                created_at=_utcnow(),
            )
        )
        db.commit()

        results_dir.mkdir(parents=True, exist_ok=True)
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
        j.error_message = (
            None if j.match else "Mismatch: B2A output does not match plaintext (after normalization)."
        )
        j.updated_at = _utcnow()

        db.add(
            JobEvent(
                job_id=job_id,
                created_by=u.id,
                event_type="COMPLETED" if j.match else "FAILED",
                message="Job comparison finished",
                created_at=_utcnow(),
            )
        )
        db.commit()
        _mark_job_done_free_scientist(db, j)

        # Notify the job owner
        owner = db.query(User).filter(User.id == j.created_by).first()
        if owner:
            db.add(
                Notification(
                    recipient_user_id=owner.id,
                    job_id=job_id,
                    type="JOB_COMPLETED" if j.match else "JOB_FAILED",
                    title="Job completed" if j.match else "Job failed",
                    message=f"Job {job_id} finished. Result: {'MATCH' if j.match else 'MISMATCH'}",
                    is_read=False,
                    created_at=_utcnow(),
                )
            )
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
        db.add(
            JobEvent(
                job_id=job_id,
                created_by=u.id,
                event_type="FAILED",
                message=f"Decoding failed: {e}",
                created_at=_utcnow(),
            )
        )
        db.commit()
        raise HTTPException(status_code=500, detail=f"Decoding failed: {e}")


def mark_job_complete(job_id: str, request: Request, db: OrmSession = Depends(get_db)):
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

    db.add(
        JobEvent(
            job_id=job_id,
            created_by=u.id,
            event_type="COMPLETED_MANUAL",
            message="Job marked completed by scientist",
            created_at=_utcnow(),
        )
    )
    db.commit()

    owner = db.query(User).filter(User.id == j.created_by).first()
    if owner:
        db.add(
            Notification(
                recipient_user_id=owner.id,
                job_id=job_id,
                type="JOB_COMPLETED",
                title="Job completed",
                message=f"Job {job_id} was marked completed by the lab.",
                is_read=False,
                created_at=_utcnow(),
            )
        )
        db.commit()

    return {"job_id": j.id, "status": j.status}


def delete_job(job_id: str, request: Request, db: OrmSession = Depends(get_db)):
    u = get_current_user(db, request)

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # owner or admin
    if job.created_by != u.id and getattr(u, "role", None) != "admin":
        raise HTTPException(status_code=403, detail="Not allowed")

    status = (job.status or "").strip().lower()
    if status not in ALLOWED_DELETE_STATUSES:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Job cannot be deleted while status is '{job.status}'. Allowed: STORED / RETRIEVED / FAILED."
            ),
        )

    # fetch linked file
    db_file = db.query(DbFile).filter(DbFile.id == job.file_id).first()

    # ---- DB deletes (order matters with SQLite FKs) ----
    db.query(JobEvent).filter(JobEvent.job_id == job_id).delete(synchronize_session=False)
    db.query(Notification).filter(Notification.job_id == job_id).delete(synchronize_session=False)

    db.delete(job)
    if db_file:
        db.delete(db_file)

    db.commit()

    # ---- filesystem cleanup (best effort; don't fail request) ----
    try:
        # delete artifacts directory for the job
        job_dir = settings.artifacts_dir / job_id
        if job_dir.exists():
            shutil.rmtree(job_dir)

        # delete stored file paths if they exist (optional, but usually wanted)
        if db_file and db_file.storage_path:
            p = Path(db_file.storage_path)
            if p.exists():
                p.unlink()

        # plaintext path (if separate file)
        if db_file and db_file.plaintext_path:
            p = Path(db_file.plaintext_path)
            if p.exists():
                p.unlink()

        # any recovered path / ascii paths etc stored on job (they're inside artifacts usually)
        # if you store them elsewhere, you can unlink them here too.
    except Exception:
        pass

    return


def scientist_jobs(request: Request, db: OrmSession = Depends(get_db)):
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
        out.append(
            {
                "id": j.id,
                "status": j.status,
                "created_at": j.created_at.isoformat() if j.created_at else None,
                "file_id": j.file_id,
                "protocol_download_url": f"/jobs/{j.id}/protocol" if j.protocol_path else None,
                "match": j.match,
            }
        )
    return out

def push_to_ot2(job_id: str, request: Request, db: OrmSession = Depends(get_db)):
    u = get_current_user(db, request)
    require_role(u, {"scientist", "admin"})

    j = db.query(Job).filter(Job.id == job_id).first()
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    if not j.protocol_path:
        raise HTTPException(status_code=400, detail="Protocol not generated yet")

    protocol_path = Path(j.protocol_path)
    if not protocol_path.exists():
        raise HTTPException(status_code=400, detail=f"Protocol missing: {protocol_path}")

    # record push requested
    j.status = "PUSH_REQUESTED"
    j.updated_at = _utcnow()
    db.add(JobEvent(
        job_id=job_id,
        created_by=u.id,
        event_type="PUSH_REQUESTED",
        message="Scientist clicked Push to Opentrons",
        created_at=_utcnow(),
    ))
    db.commit()

    try:
        # ---- PLACEHOLDER (WORKS NOW) ----
        result = push_protocol_placeholder(protocol_path=protocol_path, job_id=job_id)

        # ---- REAL SSH (ENABLE LATER) ----
        # cfg = OT2Config(
        #     host=j.ot2_host or settings.ot2_host,               # TODO: store in settings/job
        #     user=settings.ot2_ssh_user,                          # TODO
        #     ssh_key_path=str(settings.ot2_ssh_key_path),         # TODO
        #     remote_dir=settings.ot2_protocol_dir,                # TODO
        #     run_cmd_template=settings.ot2_run_cmd_template,      # TODO
        # )
        # result = push_and_run_protocol_ssh(protocol_path=protocol_path, job_id=job_id, cfg=cfg)

        j.status = "PUSHED_TO_OT2"
        j.updated_at = _utcnow()
        db.add(JobEvent(
            job_id=job_id,
            created_by=u.id,
            event_type="PUSHED_TO_OT2",
            message="Protocol push done (placeholder)",
            created_at=_utcnow(),
        ))
        db.commit()

        return result

    except Exception as e:
        j.status = "FAILED"
        j.error_code = "OT2_PUSH_FAILED"
        j.error_message = str(e)
        j.updated_at = _utcnow()
        db.add(JobEvent(
            job_id=job_id,
            created_by=u.id,
            event_type="FAILED",
            message=f"OT-2 push failed: {e}",
            created_at=_utcnow(),
        ))
        db.commit()
        raise HTTPException(status_code=500, detail=f"OT-2 push failed: {e}")
    
def job_events(job_id: str, request: Request, db: OrmSession = Depends(get_db)):
    u = get_current_user(db, request)

    j = db.query(Job).filter(Job.id == job_id).first()
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")

    # basic access: creator OR scientist/admin
    if u.role == "user" and j.created_by != u.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    evs = (
        db.query(JobEvent)
        .filter(JobEvent.job_id == job_id)
        .order_by(JobEvent.created_at.asc())
        .all()
    )

    return [
        {
            "event_type": e.event_type,
            "message": e.message,
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "created_by": e.created_by,
        }
        for e in evs
    ]
