import os
import re
from datetime import datetime, timedelta, timezone
import jwt
import bcrypt

# ── Security Configuration ──

# JWT secret MUST be set via env var in production; fail loudly if not
_env_secret = os.getenv("JWT_SECRET")
if not _env_secret and os.getenv("AWS_EXECUTION_ENV"):
    # Running inside Lambda without a secret — this is a hard error
    raise RuntimeError("JWT_SECRET environment variable is required in production")
JWT_SECRET = _env_secret or "dev-only-secret-do-not-use-in-prod"
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "24"))

# ── Password Policy ──

MIN_PASSWORD_LENGTH = 8
PASSWORD_PATTERN = re.compile(
    r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;:\'",.<>?/`~]).{8,128}$'
)

ALLOWED_FILE_EXTENSIONS = {".csv"}
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB
MAX_FILENAME_LENGTH = 255
FILENAME_SANITIZE_PATTERN = re.compile(r'[^\w\s\-.]')  # Only allow word chars, spaces, dashes, dots

# SQL blocklist — these keywords are forbidden ANYWHERE in user-supplied SQL
SQL_BLOCKED_KEYWORDS = [
    "DROP", "DELETE", "INSERT", "UPDATE", "ALTER", "CREATE",
    "TRUNCATE", "GRANT", "REVOKE", "EXEC", "EXECUTE", "CALL",
    "MERGE", "REPLACE", "LOAD", "COPY", "UNLOAD",
]


def validate_password_strength(password: str) -> str | None:
    """Validate password meets security requirements. Returns error message or None."""
    if len(password) < MIN_PASSWORD_LENGTH:
        return f"Password must be at least {MIN_PASSWORD_LENGTH} characters long"
    if len(password) > 128:
        return "Password must be at most 128 characters long"
    if not PASSWORD_PATTERN.match(password):
        return "Password must contain at least one uppercase, one lowercase, one digit, and one special character"
    return None


def validate_filename(filename: str) -> str | None:
    """Validate and sanitize filename. Returns error message or None."""
    if not filename or len(filename) > MAX_FILENAME_LENGTH:
        return f"Filename must be between 1 and {MAX_FILENAME_LENGTH} characters"

    # Check extension
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_FILE_EXTENSIONS:
        allowed = ", ".join(ALLOWED_FILE_EXTENSIONS)
        return f"Only {allowed} files are allowed"

    # Check for path traversal attacks
    if ".." in filename or "/" in filename or "\\" in filename:
        return "Invalid filename — path traversal detected"

    # Check for null bytes
    if "\x00" in filename:
        return "Invalid filename"

    return None


def validate_file_size(file_size: int) -> str | None:
    """Validate file size is within limits. Returns error message or None."""
    if file_size <= 0:
        return "File size must be greater than 0"
    if file_size > MAX_FILE_SIZE_BYTES:
        max_mb = MAX_FILE_SIZE_BYTES // (1024 * 1024)
        return f"File too large (max {max_mb}MB)"
    return None


def validate_sql_safety(sql: str) -> str | None:
    """Check SQL for dangerous operations. Returns error message or None."""
    if not sql or not sql.strip():
        return "SQL query is required"

    if len(sql) > 10_000:
        return "SQL query too long (max 10,000 characters)"

    sql_upper = sql.strip().upper()

    # Must start with SELECT (only read queries allowed)
    if not sql_upper.startswith("SELECT"):
        return "Only SELECT queries are allowed"

    # Check for blocked keywords ANYWHERE in the query (covers subqueries)
    for keyword in SQL_BLOCKED_KEYWORDS:
        # Use word boundary matching to avoid false positives
        pattern = r'\b' + keyword + r'\b'
        if re.search(pattern, sql_upper):
            return f"Blocked SQL operation: {keyword}"

    # Block semicolons (multi-statement injection)
    if ";" in sql:
        return "Multi-statement queries are not allowed"

    # Block UNION-based injection attempts
    if re.search(r'\bUNION\b', sql_upper):
        return "UNION queries are not allowed"

    # Block system/information_schema access
    if re.search(r'\b(INFORMATION_SCHEMA|PG_CATALOG|SYS\.|SYSTEM\.)\b', sql_upper):
        return "Access to system tables is not allowed"

    return None


def sanitize_error_message(error: Exception) -> str:
    """Strip AWS internals from error messages before sending to client."""
    msg = str(error)

    # Strip AWS account IDs (12-digit numbers)
    msg = re.sub(r'\b\d{12}\b', '[REDACTED]', msg)

    # Strip ARNs
    msg = re.sub(r'arn:aws:[^\s"\']+', '[ARN_REDACTED]', msg)

    # Strip S3 bucket names if they look internal
    msg = re.sub(r's3://[^\s"\']+', '[S3_REDACTED]', msg)

    # Strip access key IDs
    msg = re.sub(r'AKIA[0-9A-Z]{16}', '[KEY_REDACTED]', msg)

    # Strip secret keys (long base64-like)
    msg = re.sub(r'(?<=\s)[A-Za-z0-9/+=]{40}(?=\s|$)', '[SECRET_REDACTED]', msg)

    # Strip request IDs
    msg = re.sub(r'RequestId:\s*[\w-]+', 'RequestId: [REDACTED]', msg)

    # If the message is extremely long, truncate
    if len(msg) > 500:
        msg = msg[:500] + "..."

    return msg


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
    })
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        # Verify token type
        if payload.get("type") != "access":
            return None
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.PyJWTError:
        return None
