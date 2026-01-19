from __future__ import annotations
from pathlib import Path

def to_wsl_path(p: Path) -> str:
    p = p.resolve()
    s = str(p)
    drive = s[0].lower()          # D -> d
    rest = s[2:].replace("\\", "/")  # remove "D:" then normalize slashes
    return f"/mnt/{drive}{rest}"
