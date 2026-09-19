import re
import html
from typing import Optional


# Patterns for detecting SQL injection and XSS attempts
SQLI_PATTERN = re.compile(
    r"(\b(UNION(\s+ALL)?|SELECT|INSERT|DELETE|UPDATE|DROP|ALTER|EXEC|EXECUTE)\b|--|\/\*|\*\/|;|\bOR\b\s+['\d\w]+\s*=\s*['\d\w]+)",
    re.IGNORECASE
)
SCRIPT_PATTERN = re.compile(
    r"(<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>|javascript:|onload\s*=|onerror\s*=|onclick\s*=|<iframe|<object|<embed)",
    re.IGNORECASE
)


def sanitize_input_text(text: Optional[str], max_len: int = 1000) -> str:
    """
    Sanitizes user-provided string inputs by:
    1. Trimming whitespace.
    2. Enforcing max length to prevent buffer/payload bloat.
    3. Stripping dangerous HTML/script tags.
    4. Escaping HTML entities for safe persistence.
    """
    if not text:
        return ""
    
    cleaned = text.strip()[:max_len]
    # Remove executable script constructs
    cleaned = SCRIPT_PATTERN.sub("", cleaned)
    # Escape HTML special characters
    return html.escape(cleaned, quote=True)


def check_sqli_threat(text: Optional[str]) -> bool:
    """
    Returns True if suspicious SQL syntax or injection patterns are detected.
    """
    if not text:
        return False
    return bool(SQLI_PATTERN.search(text))
