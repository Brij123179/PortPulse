from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import (
    verify_password, create_access_token, get_current_user,
    require_roles, UserRole, CurrentUser, get_password_hash
)
from app.models.entities import User
from app.schemas.auth import UserLoginRequest, TokenResponse, UserResponse, UserCreateRequest
from app.config import settings

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication & RBAC"])


@router.post("/login", response_model=TokenResponse)
def login(request: UserLoginRequest, db: Session = Depends(get_db)):
    """Logs in with username and password, returning a signed JWT access token."""
    user = db.query(User).filter(User.username == request.username).first()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User account is inactive")

    access_token = create_access_token(
        data={"sub": user.username, "role": user.role, "user_id": user.id}
    )
    user_resp = UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at
    )
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in_minutes=settings.PORTPULSE_ACCESS_TOKEN_EXPIRE_MINUTES,
        user=user_resp
    )


@router.get("/me", response_model=CurrentUser)
def get_me(current_user: CurrentUser = Depends(get_current_user)):
    """Returns profile and role permissions for the currently authenticated caller."""
    return current_user


@router.post("/register", response_model=UserResponse)
def register_user(
    req: UserCreateRequest,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_roles([UserRole.ADMIN]))
):
    """Admin-only user provisioning endpoint."""
    existing = db.query(User).filter((User.username == req.username) | (User.email == req.email)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username or email already registered")

    user = User(
        username=req.username,
        email=req.email,
        hashed_password=get_password_hash(req.password),
        role=req.role.lower(),
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
