from typing import Any, Optional
from pydantic import BaseModel, Field


class StandardErrorResponse(BaseModel):
    """Structured error format matching 05_backend.md §5."""
    error_code: str = Field(..., description="Unique error code classification")
    message: str = Field(..., description="Human-readable error explanation")
    correlation_id: str = Field(..., description="Request tracing correlation ID")
    details: Optional[Any] = None


class SuccessResponse(BaseModel):
    status: str = "success"
    message: str
    correlation_id: Optional[str] = None
    data: Optional[Any] = None
