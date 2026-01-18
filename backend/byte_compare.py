from __future__ import annotations
from pathlib import Path
from typing import Optional, Tuple

def compare_files_bytewise(original_path: Path, recovered_path: Path) -> Tuple[bool, Optional[int]]:
    a = original_path.read_bytes()
    b = recovered_path.read_bytes()

    min_len = min(len(a), len(b))
    for i in range(min_len):
        if a[i] != b[i]:
            return False, i

    if len(a) != len(b):
        return False, min_len

    return True, None
