from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict


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


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    role: str
    is_active: bool
    created_at: Optional[datetime] = None


TokenResponse.model_rebuild()
