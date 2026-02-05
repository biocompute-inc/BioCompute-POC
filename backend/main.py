from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import init_db
from settings import get_settings

from admin.router import router as admin_router
from auth.router import router as auth_router
from dashboard.router import router as dashboard_router
from jobs.router import router as jobs_router
from notifications.router import router as notifications_router

settings = get_settings()

app = FastAPI(title="BioCompute POC Backend")

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


app.include_router(auth_router)
app.include_router(jobs_router)
app.include_router(admin_router)
app.include_router(notifications_router)
app.include_router(dashboard_router)
