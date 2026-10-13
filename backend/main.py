import os
import traceback
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from routers import auth, datasets, jobs, dashboard

# ── App Configuration ──

app = FastAPI(
    title="DataFlow API",
    docs_url="/api/docs" if os.getenv("ENABLE_DOCS", "false").lower() == "true" else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if os.getenv("ENABLE_DOCS", "false").lower() == "true" else None,
)

# ── CORS Configuration ──

ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "").split(",") if os.getenv("CORS_ORIGINS") else []

# In development, allow localhost origins
if not ALLOWED_ORIGINS:
    ALLOWED_ORIGINS = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]
    # If a CloudFront domain is set, add it
    cf_domain = os.getenv("CLOUDFRONT_DOMAIN")
    if cf_domain:
        ALLOWED_ORIGINS.append(f"https://{cf_domain}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    max_age=3600,
)

# ── Security Headers Middleware ──

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses."""
    response = await call_next(request)

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Pragma"] = "no-cache"

    # Strict CSP for API responses
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"

    return response


# ── Global Exception Handler ──

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions and return sanitized error responses.
    Never expose stack traces or AWS internals to the client.
    """
    # Log the full traceback server-side for debugging
    print(f"[ERROR] Unhandled exception on {request.method} {request.url.path}:")
    traceback.print_exc()

    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred. Please try again later."},
    )


# ── Register Routers ──

app.include_router(auth.router)
app.include_router(datasets.router)
app.include_router(jobs.router)
app.include_router(dashboard.router)


@app.get("/")
def read_root():
    return {"message": "DataFlow API", "status": "healthy"}


# ── Mangum Lambda Adapter ──
handler = Mangum(app)
