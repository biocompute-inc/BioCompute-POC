from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session as OrmSession

from auth.service import _utcnow
from auth_utils import get_current_user
from db import get_db
from models import Notification

router = APIRouter()


@router.get("/notifications")
def list_notifications(request: Request, db: OrmSession = Depends(get_db)):
    u = get_current_user(db, request)

    items = (
        db.query(Notification)
        .filter(Notification.recipient_user_id == u.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )

    return [
        {
            "id": n.id,
            "job_id": n.job_id,
            "type": n.type,
            "title": n.title,
            "message": n.message,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in items
    ]


@router.post("/notifications/{notif_id}/read")
def read_notification(notif_id: int, request: Request, db: OrmSession = Depends(get_db)):
    u = get_current_user(db, request)
    n = (
        db.query(Notification)
        .filter(Notification.id == notif_id, Notification.recipient_user_id == u.id)
        .first()
    )
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")

    n.is_read = True
    n.read_at = _utcnow()
    db.commit()
    return {"ok": True}
