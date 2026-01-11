from __future__ import annotations
from pathlib import Path
import hashlib
import subprocess
import time

def _hash_to_word5(text: str) -> str:
    # Deterministic 5-letter A–Z word derived from plaintext
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    letters = []
    for i in range(5):
        letters.append(chr(ord("A") + (digest[i] % 26)))
    return "".join(letters)

def generate_ot2_protocol_from_plaintext(
    ot2_repo_dir: Path,
    plaintext_path: Path,
    out_protocol_path: Path,
    brick_stock_ul: float = 20,
    transfer_vol_ul: float = 2,
) -> str:
    """
    Calls OT2 generator repo and writes a protocol file for the job.
    Returns the 5-letter derived word used to generate protocol.
    """
    if not ot2_repo_dir.exists():
        raise FileNotFoundError(f"OT2 repo not found: {ot2_repo_dir}")

    builder = ot2_repo_dir / "build_brick_mix_py.py"
    if not builder.exists():
        raise FileNotFoundError(f"OT2 builder not found: {builder}")

    # Output folder in repo per their structure
    repo_out_dir = ot2_repo_dir / "BRICK MIX PROTOCOLS"
    repo_out_dir.mkdir(parents=True, exist_ok=True)

    plaintext = plaintext_path.read_text(encoding="utf-8")
    word5 = _hash_to_word5(plaintext)

    before = time.time()
    cmd = [
        "python",
        str(builder),
        "--word", word5,
        "--brick-stock", str(brick_stock_ul),
        "--transfer-vol", str(transfer_vol_ul),
    ]

    proc = subprocess.run(
        cmd,
        cwd=str(ot2_repo_dir),
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            "OT2 generator failed.\n"
            f"STDOUT:\n{proc.stdout}\n\nSTDERR:\n{proc.stderr}"
        )

    # Find newest .py created after run
    candidates = sorted(
        [p for p in repo_out_dir.glob("*.py") if p.stat().st_mtime >= before - 1],
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not candidates:
        # fallback: any .py in output dir
        candidates = sorted(repo_out_dir.glob("*.py"), key=lambda p: p.stat().st_mtime, reverse=True)

    if not candidates:
        raise RuntimeError(f"OT2 generator ran but no protocol produced in: {repo_out_dir}")

    generated = candidates[0]

    # Copy to job artifact location
    out_protocol_path.write_text(generated.read_text(encoding="utf-8"), encoding="utf-8")
    return word5
