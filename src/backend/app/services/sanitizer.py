"""Input/output sanitization for AI and ML outputs (Phase 7)."""
import re
from typing import Any, Dict


def strip_markdown_decorations(text: str) -> str:
    """
    Remove all markdown clutter (*, #, **, etc.) from AI outputs,
    transforming headers and bullets into clean plain text and unicode bullet points (•).
    """
    if not text:
        return ""
    # Convert header lines like ### Header to clean plain text
    text = re.sub(r'(?m)^[ \t]*#{1,6}[ \t]*', '', text)
    # Convert bullet points with * or - to unicode bullet •
    text = re.sub(r'(?m)^[ \t]*[\*\-][ \t]+', '• ', text)
    # Remove bold/italic asterisks: ***text***, **text**, *text*
    text = re.sub(r'\*{1,3}(.*?)\*{1,3}', r'\1', text)
    # Remove bold/italic underscores: ___text___, __text__, _text_
    text = re.sub(r'_{1,3}(.*?)_{1,3}', r'\1', text)
    # Strip any remaining stray * and #
    text = text.replace('*', '').replace('#', '')
    # Clean up redundant spaces on each line
    lines = [line.rstrip() for line in text.splitlines()]
    text = '\n'.join(lines)
    # Normalize excessive newlines
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def sanitize_ai_response(text: str) -> str:
    """Sanitize AI/LLM generated text to prevent XSS and injection and strip markdown clutter."""
    if not text:
        return ""
    # Strip dangerous HTML tags
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<iframe[^>]*>.*?</iframe>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
    # Remove event handlers
    text = re.sub(r'\bon\w+\s*=', '', text, flags=re.IGNORECASE)
    # Remove javascript: protocol
    text = re.sub(r'javascript:', '', text, flags=re.IGNORECASE)
    # Remove data: URIs
    text = re.sub(r'data:\s*text/html', '', text, flags=re.IGNORECASE)
    # Strip markdown symbols (*, #, etc.)
    text = strip_markdown_decorations(text)
    # Trim length
    if len(text) > 5000:
        text = text[:5000] + '\n\n[Response truncated]'
    return text.strip()


def clamp_confidence(value: float) -> float:
    """Clamp confidence/probability values to [0.0, 1.0]."""
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return 0.5


def clamp_percentage(value: float) -> float:
    """Clamp percentage values to [0.0, 100.0]."""
    try:
        return max(0.0, min(100.0, float(value)))
    except (TypeError, ValueError):
        return 0.0


def sanitize_positive_number(value: float, default: float = 0.0) -> float:
    """Ensure numeric value is non-negative."""
    try:
        return max(0.0, float(value))
    except (TypeError, ValueError):
        return default


def sanitize_ml_output(data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate and sanitize ML model output dictionaries."""
    sanitized = {}
    for key, value in data.items():
        if isinstance(value, str):
            sanitized[key] = sanitize_ai_response(value)
        elif isinstance(value, (int, float)):
            if 'confidence' in key or 'probability' in key:
                sanitized[key] = clamp_confidence(value)
            elif 'pct' in key or 'percent' in key:
                sanitized[key] = clamp_percentage(value)
            elif 'cost' in key or 'usd' in key or 'hours' in key:
                sanitized[key] = sanitize_positive_number(value)
            else:
                sanitized[key] = value
        elif isinstance(value, dict):
            sanitized[key] = sanitize_ml_output(value)
        elif isinstance(value, list):
            sanitized[key] = [
                sanitize_ml_output(item) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            sanitized[key] = value
    return sanitized


def validate_entity_id(entity_id: str, prefix: str = "") -> str:
    """Validate entity ID format (alphanumeric with hyphens)."""
    if not entity_id:
        return ""
    cleaned = re.sub(r'[^a-zA-Z0-9_\-.]', '', str(entity_id))
    if prefix and not cleaned.startswith(prefix):
        return ""
    return cleaned[:50]
