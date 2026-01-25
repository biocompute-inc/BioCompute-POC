from __future__ import annotations
import datetime as dt
from sqlalchemy import (
    Column, Integer, String, DateTime, Boolean, Text, ForeignKey
)
from sqlalchemy.orm import relationship

from db import Base

def now_utc():
    return dt.datetime.utcnow()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    display_name = Column(String, nullable=True)
    role = Column(String, nullable=False, default="user")  # user | scientist | admin
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=now_utc)
    last_login_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)

class File(Base):
    __tablename__ = "files"

    id = Column(String, primary_key=True)  # UUID
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    original_filename = Column(String, nullable=True)
    content_type = Column(String, nullable=True)
    size_bytes = Column(Integer, nullable=True)
    sha256 = Column(String, nullable=True)

    storage_path = Column(String, nullable=False)

    # Conversion to plaintext (Base64)
    plaintext_path = Column(String, nullable=True)
    plaintext_sha256 = Column(String, nullable=True)
    conversion_status = Column(String, default="PENDING")  # PENDING | SUCCESS | FAILED
    conversion_error = Column(Text, nullable=True)

    created_at = Column(DateTime, default=now_utc)

    uploader = relationship("User")

class Job(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True)  # UUID
    file_id = Column(String, ForeignKey("files.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    claimed_at = Column(DateTime, nullable=True)

    status = Column(String, default="CREATED")  # see statuses below

    plaintext_path = Column(String, nullable=True)
    protocol_path = Column(String, nullable=True)

    bam_path = Column(String, nullable=True)
    ascii_path = Column(String, nullable=True)

    match = Column(Boolean, nullable=True)
    result_summary_json_path = Column(String, nullable=True)

    error_code = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=now_utc)
    updated_at = Column(DateTime, default=now_utc)

    file = relationship("File")
    creator = relationship("User", foreign_keys=[created_by])
    recovered_raw_path = Column(String, nullable=True)
    recovered_size_bytes = Column(Integer, nullable=True)
    first_mismatch_offset = Column(Integer, nullable=True)
    original_size_bytes = Column(Integer, nullable=True)  # optional but useful


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    recipient_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    job_id = Column(String, ForeignKey("jobs.id"), nullable=True)

    type = Column(String, nullable=False)  # JOB_CREATED | PROTOCOL_READY | ...
    title = Column(String, nullable=True)
    message = Column(Text, nullable=True)

    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=now_utc)
    read_at = Column(DateTime, nullable=True)

    recipient = relationship("User")
    job = relationship("Job")

class JobEvent(Base):
    __tablename__ = "job_events"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String, ForeignKey("jobs.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    event_type = Column(String, nullable=False)  # CREATED | CONVERTED | PROTOCOL_READY | ...
    message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=now_utc)

    job = relationship("Job")
    actor = relationship("User")

class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True)  # session token
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    created_at = Column(DateTime, default=now_utc)
    expires_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)

    user = relationship("User")

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    token_hash = Column(String, nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=now_utc, index=True)
    requested_ip = Column(String, nullable=True)
    requested_ua = Column(Text, nullable=True)

    user = relationship("User")


class RateLimitEvent(Base):
    __tablename__ = "rate_limit_events"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, nullable=False, index=True)  # "fp:ip:..." or "fp:email:..."
    created_at = Column(DateTime, default=now_utc, index=True)