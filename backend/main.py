from __future__ import annotations

import secrets

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from db import init_db
from security import CSRFMiddleware, CSRF_COOKIE_NAME, SecurityHeadersMiddleware
from settings import get_settings

from admin.router import router as admin_router
from auth.router import router as auth_router
from dashboard.router import router as dashboard_router
from jobs.router import router as jobs_router
from notifications.router import router as notifications_router

settings = get_settings()

app = FastAPI(title="BioCompute POC Backend")

# ---------------------------------------------------------------------------
# Middleware stack (evaluated in LIFO — last added = outermost wrapper)
# ---------------------------------------------------------------------------

# 1. Security headers on every response (innermost)
app.add_middleware(SecurityHeadersMiddleware)

# 2. CSRF double-submit cookie validation for state-changing requests
app.add_middleware(CSRFMiddleware)

# 3. CORS — must be outermost so browser OPTIONS preflights get CORS headers
#    even on rejected requests (e.g. 403 from CSRF middleware).
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.allowed_origins),
    allow_credentials=True,
    # Explicit list — avoid wildcard when credentials are in play.
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    # Content-Type + X-CSRF-Token are the only non-simple headers we need.
    allow_headers=["Content-Type", "X-CSRF-Token"],
    expose_headers=["X-CSRF-Token"],
)


# ---------------------------------------------------------------------------
# CSRF token delivery endpoint
# ---------------------------------------------------------------------------

@app.get("/csrf-token")
def get_csrf_token(request: Request):
    """
    Returns the current CSRF token so the frontend can prime the cookie
    before the first state-changing request.  The CSRFMiddleware will also
    set the cookie automatically on the first GET /auth/me call, so this
    endpoint is mainly used as a fallback.
    """
    existing = request.cookies.get(CSRF_COOKIE_NAME)
    return JSONResponse({"csrf_token": existing or secrets.token_urlsafe(32)})


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

@app.on_event("startup")
def startup():
    settings.artifacts_dir.mkdir(parents=True, exist_ok=True)
    init_db()


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(auth_router)
app.include_router(jobs_router)
app.include_router(admin_router)
app.include_router(notifications_router)
app.include_router(dashboard_router)
