from __future__ import annotations
from pathlib import Path

def raw_bytes_to_decimal_text(raw_path: Path, out_text_path: Path) -> None:
    """
    Deterministic, reversible representation:
    Each original byte written as decimal 0..255 on its own line.
    ASCII-only output.
    """
    data = raw_path.read_bytes()
    out_text_path.parent.mkdir(parents=True, exist_ok=True)
    with out_text_path.open("w", encoding="ascii", newline="\n") as f:
        for b in data:
            f.write(str(b))
            
