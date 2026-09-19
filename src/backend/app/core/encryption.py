"""Data Protection & Symmetric Authenticated Encryption at Rest (AES-128-CBC + HMAC-SHA256).

Uses Fernet symmetric authenticated cryptography with PBKDF2 key derivation.
"""
import base64
import json
from typing import Any, Dict, Optional
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from app.config import settings
from app.core.logging import logger

# Static salt for deterministic key derivation from secret key (or env key)
_KDF_SALT = b"portpulse_enterprise_data_protection_salt_2026"


def _derive_fernet_key(secret: str) -> bytes:
    """Derives a url-safe base64-encoded 32-byte Fernet key from the configured secret."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=_KDF_SALT,
        iterations=100_000,
    )
    key = kdf.derive(secret.encode("utf-8"))
    return base64.urlsafe_b64encode(key)


# Initialize singleton Fernet cipher
try:
    _raw_key = getattr(settings, "PORTPULSE_ENCRYPTION_KEY", None) or settings.PORTPULSE_SECRET_KEY
    _FERNET_KEY = _derive_fernet_key(_raw_key)
    _cipher = Fernet(_FERNET_KEY)
except Exception as exc:
    logger.error(f"Failed to initialize encryption cipher: {exc}")
    # Fallback temporary key for safety
    _cipher = Fernet(Fernet.generate_key())


def encrypt_field(plaintext: Optional[str]) -> Optional[str]:
    """Encrypts a string field using authenticated AES-128-CBC with HMAC-SHA256.
    
    Returns base64 ciphertext with 'enc::' prefix for identification.
    """
    if plaintext is None:
        return None
    if not isinstance(plaintext, str):
        plaintext = str(plaintext)
    if plaintext.startswith("enc::"):
        # Already encrypted
        return plaintext
    try:
        encrypted = _cipher.encrypt(plaintext.encode("utf-8")).decode("utf-8")
        return f"enc::{encrypted}"
    except Exception as exc:
        logger.warning(f"Field encryption failed: {exc}")
        return plaintext


def decrypt_field(ciphertext: Optional[str]) -> Optional[str]:
    """Decrypts a previously encrypted field string."""
    if ciphertext is None:
        return None
    if not isinstance(ciphertext, str) or not ciphertext.startswith("enc::"):
        # Not encrypted
        return ciphertext
    try:
        raw_token = ciphertext[len("enc::"):]
        decrypted = _cipher.decrypt(raw_token.encode("utf-8")).decode("utf-8")
        return decrypted
    except Exception as exc:
        logger.warning(f"Field decryption failed: {exc}")
        return "[ENCRYPTED_DATA_DECRYPTION_ERROR]"


def encrypt_dict(data: Dict[str, Any], sensitive_keys: Optional[set] = None) -> Dict[str, Any]:
    """Selectively encrypts sensitive keys within a dictionary."""
    if sensitive_keys is None:
        sensitive_keys = {
            "contractual_priority_rules", "notes", "email",
            "hashed_password", "cargo_details", "charterparty_rate"
        }
    encrypted = {}
    for k, v in data.items():
        if k in sensitive_keys and isinstance(v, str):
            encrypted[k] = encrypt_field(v)
        elif isinstance(v, dict):
            encrypted[k] = encrypt_dict(v, sensitive_keys)
        else:
            encrypted[k] = v
    return encrypted


def decrypt_dict(data: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively decrypts any encrypted fields in a dictionary."""
    decrypted = {}
    for k, v in data.items():
        if isinstance(v, str) and v.startswith("enc::"):
            decrypted[k] = decrypt_field(v)
        elif isinstance(v, dict):
            decrypted[k] = decrypt_dict(v)
        elif isinstance(v, list):
            decrypted[k] = [
                decrypt_dict(item) if isinstance(item, dict)
                else decrypt_field(item) if isinstance(item, str) and item.startswith("enc::")
                else item
                for item in v
            ]
        else:
            decrypted[k] = v
    return decrypted
