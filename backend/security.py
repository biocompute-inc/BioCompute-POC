"""
security.py — HTTP security middleware for BioCompute POC backend.

Provides two Starlette middlewares:

  SecurityHeadersMiddleware
    Injects the standard defensive headers (X-Frame-Options, HSTS, CSP, etc.)
    on every outbound response.

  CSRFMiddleware
    Double-submit cookie pattern:
      1. On every *safe* (GET / HEAD / OPTIONS) request the middleware checks
         whether the browser already has a `csrf_token` cookie.  If not, a
         fresh random token is attached to the response so that JavaScript
         can read it later.
      2. On every *state-changing* request (POST / PUT / PATCH / DELETE) the
         middleware compares the `X-CSRF-Token` request header against the
         value stored in the `csrf_token` cookie.  A mismatch returns 403
         before the request ever reaches a route handler.

Notes
-----
* The csrf_token cookie is intentionally **not** HttpOnly so that the
  frontend JavaScript can read it and echo it back as a header.
* SECURE_COOKIES env-var controls whether the `Secure` flag is set on the
  cookie (set it to "true" in production behind HTTPS/Cloudflare).
"""

from __future__ import annotations

import os
import secrets

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CSRF_COOKIE_NAME = "csrf_token"
CSRF_HEADER_NAME = "X-CSRF-Token"

_SAFE_METHODS: frozenset[str] = frozenset({"GET", "HEAD", "OPTIONS"})

# Paths that are always exempt from CSRF validation
# (the endpoint that *delivers* the token doesn't need the token yet)
_CSRF_EXEMPT_PATHS: frozenset[str] = frozenset({"/csrf-token"})

_SECURE_COOKIES: bool = os.getenv("SECURE_COOKIES", "false").lower() == "true"


# ---------------------------------------------------------------------------
# CSRF Middleware
# ---------------------------------------------------------------------------

class CSRFMiddleware(BaseHTTPMiddleware):
    """Double-submit cookie CSRF protection."""

    async def dispatch(self, request: Request, call_next):
        if request.method in _SAFE_METHODS or request.url.path in _CSRF_EXEMPT_PATHS:
            response = await call_next(request)

            # Seed the cookie on the very first safe request so that JS has
            # a token available before the user submits any form.
            if not request.cookies.get(CSRF_COOKIE_NAME):
                token = secrets.token_urlsafe(32)
                response.set_cookie(
                    CSRF_COOKIE_NAME,
                    token,
                    httponly=False,           # JS MUST be able to read this
                    samesite="lax",
                    secure=_SECURE_COOKIES,
                    max_age=7 * 24 * 3600,
                    path="/",
                )

            return response

        # --- State-changing request: validate ---
        header_token: str = request.headers.get(CSRF_HEADER_NAME, "")
        cookie_token: str = request.cookies.get(CSRF_COOKIE_NAME, "")

        if not header_token or not cookie_token:
            return Response(
                content='{"detail":"CSRF token missing"}',
                status_code=403,
                media_type="application/json",
            )

        if not secrets.compare_digest(
            header_token.encode("utf-8"),
            cookie_token.encode("utf-8"),
        ):
            return Response(
                content='{"detail":"CSRF token mismatch"}',
                status_code=403,
                media_type="application/json",
            )

        return await call_next(request)


# ---------------------------------------------------------------------------
# Security Headers Middleware
# ---------------------------------------------------------------------------

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds defensive HTTP headers to every response."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        h = response.headers

        # Prevent MIME-type sniffing
        h.setdefault("X-Content-Type-Options", "nosniff")

        # Deny framing (clickjacking protection) — CSP also covers this via
        # frame-ancestors, but belt-and-suspenders is good here.
        h.setdefault("X-Frame-Options", "DENY")

        # Legacy XSS filter (still honoured by some older browsers)
        h.setdefault("X-XSS-Protection", "1; mode=block")

        # Limit referrer leakage
        h.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")

        # Restrict browser feature access
        h.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=(), payment=()",
        )

        # HSTS — enforces HTTPS for 1 year; includeSubDomains is conservative
        # but correct when the entire deployment is behind Cloudflare Tunnel.
        # Nginx / Cloudflare will also add this at the edge.
        h.setdefault(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains",
        )

        # Prevent sensitive API responses from being cached by proxies / CDN
        if request.url.path.startswith("/auth"):
            h.setdefault("Cache-Control", "no-store")
            h.setdefault("Pragma", "no-cache")

        return response
