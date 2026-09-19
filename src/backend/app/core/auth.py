from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import List, Optional
from fastapi import Depends, HTTPException, Security, status, Header, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pydantic import BaseModel
import bcrypt
import secrets
from app.config import settings

security_bearer = HTTPBearer(auto_error=False)

ALGORITHM = "HS256"


class UserRole(str, Enum):
    ADMIN = "admin"
    TERMINAL_MANAGER = "terminal_manager"
    VESSEL_PLANNER = "vessel_planner"
    SHIFT_SUPERVISOR = "shift_supervisor"
    VIEWER = "viewer"


class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[UserRole] = None
    user_id: Optional[int] = None


class CurrentUser(BaseModel):
    id: int
    username: str
    email: str
    role: UserRole


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return secrets.compare_digest(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    try:
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")
    except Exception:
        return f"hashed_{password}"


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    to_encode.setdefault("type", "access")
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.PORTPULSE_ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.PORTPULSE_SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_mfa_challenge_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    to_encode["type"] = "mfa_pending"
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=5)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.PORTPULSE_SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    token: Optional[str] = Query(None, description="JWT token for direct browser links"),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    x_user_id: Optional[int] = Header(None, alias="X-User-Id"),
    x_username: Optional[str] = Header(None, alias="X-User-Name"),
) -> CurrentUser:
    """
    Authenticates user via JWT Bearer token (from header or query parameter).
    For local development and testing convenience, also accepts X-User-Role header or defaults to shift_supervisor if no token provided.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    raw_token = auth.credentials if (auth and auth.credentials) else token
    if raw_token:
        try:
            payload = jwt.decode(raw_token, settings.PORTPULSE_SECRET_KEY, algorithms=[ALGORITHM])
            token_type = payload.get("type", "access")
            if token_type == "mfa_pending":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="MFA challenge token cannot be used for API access. Complete MFA verification first.",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            username: str = payload.get("sub")
            role_str: str = payload.get("role")
            user_id: int = payload.get("user_id", 1)
            if username is None or role_str is None:
                raise credentials_exception
            try:
                role = UserRole(role_str)
            except ValueError:
                raise credentials_exception
            return CurrentUser(id=user_id, username=username, email=f"{username}@portpulse.local", role=role)
        except JWTError:
            raise credentials_exception

    # Dev / test header/navigation bypass (only permitted in non-production environments when enabled)
    allow_bypass = settings.PORTPULSE_DEV_AUTH_BYPASS and (settings.PORTPULSE_ENV in ("development", "test"))
    if allow_bypass:
        role_candidate = x_user_role or "shift_supervisor"
        try:
            role = UserRole(role_candidate.lower())
            return CurrentUser(
                id=x_user_id or 1,
                username=x_username or f"dev_{role.value}",
                email=f"{role.value}@portpulse.local",
                role=role
            )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role in X-User-Role: {x_user_role}"
            )

    # In production or when unauthenticated without valid token/headers:
    raise credentials_exception


def require_roles(*allowed_roles_args):
    """Server-side RBAC dependency ensuring the authenticated user possesses an allowed role."""
    flat_roles = []
    for arg in allowed_roles_args:
        if isinstance(arg, (list, tuple, set)):
            flat_roles.extend(arg)
        else:
            flat_roles.append(arg)

    converted_roles = []
    for r in flat_roles:
        if isinstance(r, UserRole):
            converted_roles.append(r)
        elif isinstance(r, str):
            try:
                converted_roles.append(UserRole(r.lower()))
            except ValueError:
                pass

    def role_checker(current_user: CurrentUser = Depends(get_current_user)):
        if current_user.role not in converted_roles:
            req_roles_str = ", ".join([r.value for r in converted_roles])
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Role '{current_user.role.value}' does not possess permissions for this endpoint. Required roles: [{req_roles_str}]."
            )
        return current_user
    return role_checker
