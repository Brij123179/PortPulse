from datetime import datetime
from typing import Optional, Union
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
from app.core.auth import UserRole


class UserLoginRequest(BaseModel):
    username: str = Field(..., min_length=2)
    password: str = Field(..., min_length=3)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    role: str
    is_active: bool
    created_at: Optional[datetime] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int
    user: UserResponse
    mfa_required: bool = False


class MfaChallengeResponse(BaseModel):
    mfa_required: bool = True
    mfa_token: str
    mfa_method: str = "TOTP_AUTHENTICATOR"
    message: str = "Two-Factor Authentication required for privileged operational role."
    demo_code: str = "849201"
    user: UserResponse


class MfaVerifyRequest(BaseModel):
    mfa_token: str
    code: str = Field(..., min_length=6, max_length=6)


class UserCreateRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=4)
    role: str = Field("shift_supervisor", description="admin, terminal_manager, vessel_planner, shift_supervisor")

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        valid_roles = {r.value for r in UserRole}
        if v.lower() not in valid_roles:
            raise ValueError(f"Role must be one of: {', '.join(sorted(valid_roles))}")
        return v.lower()


class AdminApprovalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    request_type: str
    requested_by: str
    target_username: str
    target_email: str
    target_role: str
    status: str
    approved_by: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None


class AdminApprovalPendingResponse(BaseModel):
    status: str
    approval_id: int
    message: str
    target_username: str
    target_role: str


TokenResponse.model_rebuild()
MfaChallengeResponse.model_rebuild()
