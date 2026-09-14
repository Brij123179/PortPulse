from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
from app.core.auth import UserRole


class UserLoginRequest(BaseModel):
    username: str = Field(..., min_length=2)
    password: str = Field(..., min_length=3)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int
    user: "UserResponse"


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


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    role: str
    is_active: bool
    created_at: Optional[datetime] = None


TokenResponse.model_rebuild()
