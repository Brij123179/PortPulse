import time
from collections import defaultdict
from threading import Lock
from typing import Dict, List, Tuple
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.logging import logger

# In-memory sliding window rate limiter
# Maps (client_ip, bucket_name) -> list of Unix timestamps
_rate_limit_lock = Lock()
_rate_limit_store: Dict[Tuple[str, str], List[float]] = defaultdict(list)

# Rate limits: (max_requests, window_seconds)
RATE_LIMIT_RULES = {
    "chat": (25, 60),          # Ask AI RAG endpoints: 25 req/min
    "auto_sync": (15, 60),     # Solver / Auto-Sync endpoints: 15 req/min
    "auth": (10, 60),          # Authentication endpoints: 10 req/min
    "default": (120, 60),      # Standard endpoints: 120 req/min
}


def _get_bucket(path: str) -> str:
    path_lower = path.lower()
    if "/api/v1/chat" in path_lower:
        return "chat"
    if "/optimiser/auto-solve" in path_lower or "/ingestion/sync" in path_lower or "/ingestion/generate" in path_lower:
        return "auto_sync"
    if "/api/v1/auth/token" in path_lower or "/api/v1/auth/login" in path_lower or "/api/v1/auth/mfa" in path_lower:
        return "auth"
    return "default"


class RateLimiterMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Ignore OPTIONS or static/docs
        if request.method == "OPTIONS" or request.url.path in ["/docs", "/redoc", "/api/v1/openapi.json"]:
            return await call_next(request)

        # Extract client IP
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        else:
            client_ip = request.client.host if request.client else "127.0.0.1"

        bucket = _get_bucket(request.url.path)
        max_reqs, window_secs = RATE_LIMIT_RULES.get(bucket, RATE_LIMIT_RULES["default"])
        now = time.time()

        with _rate_limit_lock:
            key = (client_ip, bucket)
            timestamps = _rate_limit_store[key]
            # Prune expired timestamps outside sliding window
            cutoff = now - window_secs
            _rate_limit_store[key] = [t for t in timestamps if t > cutoff]
            current_count = len(_rate_limit_store[key])

            if current_count >= max_reqs:
                logger.warning(f"Rate limit exceeded for IP {client_ip} on bucket '{bucket}' ({current_count}/{max_reqs})")
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "detail": f"Rate limit exceeded for {bucket}. Max {max_reqs} requests per {window_secs}s.",
                        "bucket": bucket,
                        "retry_after": int(window_secs)
                    },
                    headers={"Retry-After": str(int(window_secs))}
                )

            _rate_limit_store[key].append(now)

        response = await call_next(request)
        return response


class CSRFProtectionMiddleware(BaseHTTPMiddleware):
    """
    Guards state-changing endpoints (POST, PUT, DELETE, PATCH) against Cross-Site Request Forgery.
    Accepts requests that provide either:
    1. A valid Authorization Bearer header (REST API token auth inherently immune to browser cookie CSRF)
    2. An X-Requested-With header (e.g. XMLHttpRequest or fetch)
    3. An X-CSRF-Token header
    """
    SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
    EXEMPT_PATHS = {
        "/api/v1/auth/token",
        "/api/v1/auth/login",
        "/api/v1/auth/mfa",
        "/api/v1/auth/register",
        "/docs",
        "/redoc",
        "/api/v1/openapi.json"
    }

    async def dispatch(self, request: Request, call_next):
        if request.method in self.SAFE_METHODS:
            return await call_next(request)

        # Exempt paths such as initial login / docs
        if any(request.url.path.startswith(p) for p in self.EXEMPT_PATHS):
            return await call_next(request)

        # Check for CSRF prevention tokens or headers
        auth_header = request.headers.get("Authorization", "")
        has_bearer = auth_header.startswith("Bearer ") and len(auth_header) > 10
        has_ajax = request.headers.get("X-Requested-With") in ["XMLHttpRequest", "fetch", "PortPulseApp"]
        has_csrf_token = bool(request.headers.get("X-CSRF-Token"))

        if not (has_bearer or has_ajax or has_csrf_token):
            logger.warning(f"CSRF validation failed for {request.method} {request.url.path} from {request.client}")
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "detail": "CSRF verification failed. State-changing requests must include Authorization Bearer header or X-Requested-With header."
                }
            )

        return await call_next(request)
