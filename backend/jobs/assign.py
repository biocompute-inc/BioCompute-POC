from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session as OrmSession

from auth.service import _utcnow
from models import Job
from models import JobEvent
from models import Notification
from models import User

ACTIVE_JOB_STATUSES = {"PROTOCOL_READY", "BAM_UPLOADED", "DECODING"}

# Author - Naveen M, for BioCompute, PoC - Version 0.0.1
# This file contains helper functions for automatically assigning jobs to scientists and marking them as done.
# The _choose_scientist_least_loaded function selects the scientist with the fewest active jobs to assign new work to, while the _auto_assign_job function handles the logic of assigning a job to a scientist and creating the necessary database entries for tracking the assignment and notifying the scientist.
# The _mark_job_done_free_scientist function is called when a job is marked as done, allowing the system to update the job status and free up the scientist for new assignments.


def _choose_scientist_least_loaded(db: OrmSession) -> User | None:
    scientists = (
        db.query(User).filter(User.role == "scientist", User.is_active == True).all()  # noqa: E712
    )
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


def _auto_assign_job(db: OrmSession, job: Job, actor_user_id: int):
    """
    Assign job to a scientist automatically once protocol is ready.
    """
    if job.assigned_to is not None:
        return  # already assigned

    chosen = _choose_scientist_least_loaded(db)
    if chosen is None:
        # No scientists exist: log event and keep job unassigned
        db.add(
            JobEvent(
                job_id=job.id,
                created_by=actor_user_id,
                event_type="ASSIGNMENT_SKIPPED",
                message="No active scientist accounts found; job not assigned",
                created_at=_utcnow(),
            )
        )
        db.commit()
        return

    job.assigned_to = chosen.id
    job.claimed_at = _utcnow()  # optional: record assignment time
    job.updated_at = _utcnow()

    db.add(
        JobEvent(
            job_id=job.id,
            created_by=actor_user_id,
            event_type="ASSIGNED",
            message=f"Auto-assigned to scientist {chosen.email}",
            created_at=_utcnow(),
        )
    )

    db.add(
        Notification(
            recipient_user_id=chosen.id,
            job_id=job.id,
            type="JOB_ASSIGNED",
            title="New job assigned",
            message=(
                f"Job {job.id} is ready. Download protocol and run sequencing, then upload BAM."
            ),
            is_read=False,
            created_at=_utcnow(),
        )
    )

    db.commit()


def _mark_job_done_free_scientist(db: OrmSession, job: Job):
    """
    When job completes, scientist is automatically freed because BUSY/FREE is computed.
    No DB change needed except job status already updated.
    """
    job.updated_at = _utcnow()
    db.commit()
