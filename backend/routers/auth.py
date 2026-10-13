from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from models.auth import UserRegister, UserLogin, Token, UserResponse
from utils import get_password_hash, verify_password, create_access_token, decode_access_token
from database import get_user_by_email, create_user, get_user_by_id

router = APIRouter(prefix="/api/auth", tags=["auth"])
security = HTTPBearer()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Validate JWT and extract current user identity."""
    token = credentials.credentials

    # Reject obviously malformed tokens early
    if not token or len(token) > 4096:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload["sub"]

    # Verify user still exists and is active
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.get("status") != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    return {"user_id": user_id, "email": payload.get("email")}


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user: UserRegister):
    """Register a new user — Pydantic model validates password strength and email format."""
    # Check for existing email (constant-time comparison not needed here since we're checking existence)
    existing_user = get_user_by_email(user.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    hashed_password = get_password_hash(user.password)
    new_user = create_user(user.email, hashed_password, user.name)

    if not new_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )

    return UserResponse(
        user_id=new_user["user_id"],
        email=new_user["email"],
        name=new_user["display_name"]
    )


@router.post("/login", response_model=Token)
def login(user: UserLogin):
    """Authenticate user — returns JWT on success."""
    email_clean = user.email.strip().lower()
    db_user = get_user_by_email(email_clean)

    # Fallback to un-lowercased email if an older DynamoDB entry had uppercase
    if not db_user and user.email != email_clean:
        db_user = get_user_by_email(user.email)

    if not db_user:
        print(f"[AUTH] Login failed: User '{user.email}' not found in dataflow-users table.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not verify_password(user.password, db_user["password_hash"]):
        print(f"[AUTH] Login failed: Incorrect password provided for '{user.email}'.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # Check user is active
    if db_user.get("status") != "ACTIVE":
        print(f"[AUTH] Login rejected: Account for '{user.email}' is deactivated.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    print(f"[AUTH] Login successful for '{user.email}' (user_id: {db_user['user_id']})")
    access_token = create_access_token(
        data={"sub": db_user["user_id"], "email": db_user["email"]}
    )

    return {"access_token": access_token, "token_type": "bearer"}
