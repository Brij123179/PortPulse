import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.core.logging import logger, correlation_id_ctx
from app.core.database import engine, Base, SessionLocal
from app.models.entities import User, Berth
from app.services.ingestion import PortDataGenerator
from app.routers import auth, ingestion, master_data, status as status_router, forecast, optimiser, audit, csv_data, compat_api, chat


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initializes tables and seeds initial synthetic dataset on startup if DB empty."""
    logger.info("Initializing PortPulse database schema...")
    Base.metadata.create_all(bind=engine)

    # Check if database has data, seed if empty
    db = SessionLocal()
    try:
        user_count = db.query(User).count()
        berth_count = db.query(Berth).count()
        if user_count == 0 or berth_count == 0:
            logger.info("Database is empty. Seeding initial synthetic data (F-101/F-102/F-103)...")
            generator = PortDataGenerator(seed=settings.PORTPULSE_SYNTHETIC_SEED)
            stats = generator.generate_all(
                db,
                vessel_count=settings.PORTPULSE_SYNTHETIC_VESSELS,
                berth_count=settings.PORTPULSE_SYNTHETIC_BERTHS,
                historical_days=365,
                clear_existing=False
            )
            logger.info(f"Database seeded with {stats}")
        else:
            logger.info(f"Database ready with {berth_count} berths and {user_count} users.")

        # Train and initialize Gradient Boosting ML Prediction Models (F-201/F-202/F-203)
        try:
            from app.services.ml.risk_engine import risk_engine
            risk_engine.initialize_models(db)
            logger.info("ML Prediction Models initialized and fitted successfully.")
        except Exception as mle:
            logger.warning(f"Could not fit ML models on startup: {mle}")
    finally:
        db.close()

    yield
    logger.info("PortPulse backend shutting down cleanly.")


app = FastAPI(
    title="PortPulse API",
    description="Container Congestion Predictor & Port Operations Optimiser (IBM BoB AI Hackathon 2026 - L1)",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/api/v1/openapi.json"
)

# CORS Middleware (Supports local dev and Vercel cloud deployments)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Security Headers Middleware (SECURITY.md §1)
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response


# Correlation ID Middleware (FR-X2)
@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    corr_id = request.headers.get("X-Correlation-ID") or f"pp-{uuid.uuid4().hex[:12]}"
    token = correlation_id_ctx.set(corr_id)
    try:
        response = await call_next(request)
        response.headers["X-Correlation-ID"] = corr_id
        return response
    finally:
        correlation_id_ctx.reset(token)


# Structured Error Handlers (05_backend.md §5)
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    corr_id = correlation_id_ctx.get() or "unknown"
    logger.warning(
        f"HTTP error {exc.status_code}: {exc.detail}",
        extra={"extra_data": {"path": request.url.path, "status_code": exc.status_code}}
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error_code": f"HTTP_{exc.status_code}",
            "message": exc.detail,
            "correlation_id": corr_id,
        },
        headers={"X-Correlation-ID": corr_id}
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    corr_id = correlation_id_ctx.get() or "unknown"
    errors = exc.errors()
    message = "Request validation error"
    if errors:
        first = errors[0]
        message = f"Field '{'.'.join(str(loc) for loc in first.get('loc', []))}': {first.get('msg')}"

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error_code": "VALIDATION_ERROR",
            "message": message,
            "correlation_id": corr_id,
            "details": str(errors)
        },
        headers={"X-Correlation-ID": corr_id}
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    corr_id = correlation_id_ctx.get() or "unknown"
    logger.error(
        f"Unhandled internal error: {str(exc)}",
        exc_info=True,
        extra={"extra_data": {"path": request.url.path}}
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error_code": "INTERNAL_SERVER_ERROR",
            "message": "An unexpected server error occurred. Please refer to correlation_id for tracing.",
            "correlation_id": corr_id,
        },
        headers={"X-Correlation-ID": corr_id}
    )


# Healthcheck
@app.get("/health", tags=["Health"])
def healthcheck():
    return {
        "status": "healthy",
        "service": "portpulse-backend",
        "version": "1.0.0",
        "correlation_id": correlation_id_ctx.get() or "healthcheck"
    }


# Include Routers
app.include_router(auth.router)
app.include_router(ingestion.router)
app.include_router(master_data.router)
app.include_router(status_router.router)
app.include_router(forecast.router)
app.include_router(optimiser.router)
app.include_router(audit.router)
app.include_router(csv_data.router)
app.include_router(compat_api.router)
app.include_router(chat.router)
