from __future__ import annotations
from pathlib import Path
import base64
import hashlib

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def convert_to_base64_plaintext(raw_file_path: Path, plaintext_out_path: Path) -> tuple[str, str]:
    """
    Returns (plaintext_sha256, raw_sha256)
    """
    raw_bytes = raw_file_path.read_bytes()
    raw_sha = hashlib.sha256(raw_bytes).hexdigest()

    b64 = base64.b64encode(raw_bytes).decode("ascii")
    plaintext_out_path.write_text(b64, encoding="utf-8")

    plaintext_sha = hashlib.sha256(b64.encode("utf-8")).hexdigest()
    return plaintext_sha, raw_sha
