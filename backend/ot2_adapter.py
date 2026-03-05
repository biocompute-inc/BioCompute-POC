from __future__ import annotations

import shutil
from pathlib import Path
import subprocess
import sys

# ---------------------------------------------------------------------------
# Protocol registry – displayed to the scientist when choosing a protocol
# ---------------------------------------------------------------------------
PROTOCOL_CHOICES: list[dict] = [
    {
        "key": "brick_mix_sa_ot2",
        "label": "Brick Mix + SA OT-2",
        "description": "Full Brick Mix + Self-Assembly OT-2 protocol (cross-platform default)",
    },
    {
        "key": "asym_pcr",
        "label": "ASYM PCR",
        "description": "Asymmetric PCR static protocol — no file encoding",
    },
    {
        "key": "bm_sa_builder",
        "label": "BM SA Builder (Linux)",
        "description": "Brick Mix + Self-Assembly builder — Linux compatible",
    },
    {
        "key": "build_brick_mix",
        "label": "Build Brick Mix",
        "description": "Generates a brick-mix protocol from input word/file stem",
    },
    {
        "key": "sa_builder_07",
        "label": "SA Builder 07",
        "description": "Self-Assembly-only builder v0.7",
    },
]

VALID_PROTOCOL_KEYS: set[str] = {p["key"] for p in PROTOCOL_CHOICES}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _run_script(cmd: list[str], cwd: str, label: str) -> subprocess.CompletedProcess:
    proc = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(
            f"{label} script failed.\n"
            f"cmd: {' '.join(cmd)}\n"
            f"stdout:\n{proc.stdout}\n"
            f"stderr:\n{proc.stderr}\n"
        )
    return proc


def _newest_py(out_dir: Path, proc: subprocess.CompletedProcess) -> Path:
    """Return the most recently written .py in out_dir, or raise."""
    py_files = sorted(
        out_dir.glob("*.py"), key=lambda p: p.stat().st_mtime, reverse=True
    )
    if not py_files:
        raise RuntimeError(
            "Script succeeded but no .py file found in output directory.\n"
            f"stdout:\n{proc.stdout}\n"
            f"stderr:\n{proc.stderr}\n"
        )
    return py_files[0]


# ---------------------------------------------------------------------------
# Individual protocol generators
# ---------------------------------------------------------------------------

def _gen_brick_mix_sa_ot2(
    ot2_repo_dir: Path,
    input_file_path: Path,
    out_dir: Path,
    temp_vol_ul: float,
    output_filename: str | None = None,
) -> Path:
    """winUser/brickMixAndSAOT2.py -- the original generator."""
    script = ot2_repo_dir / "scripts" / "winUser" / "brickMixAndSAOT2.py"
    if not script.exists():
        raise FileNotFoundError(f"Script not found: {script}")

    out_dir.mkdir(parents=True, exist_ok=True)

    # Distinctive filename: BrickMix_SA_OT2_Default_<stem>.py
    stem = input_file_path.stem[:40].replace(" ", "_") or "input"
    out_name = output_filename or f"BrickMix_SA_OT2_Default_{stem}.py"

    cmd = [
        sys.executable, str(script),
        "--file", str(input_file_path),
        "--outdir", str(out_dir),
        "--temp-vol", str(temp_vol_ul),
        "--output", out_name,
    ]

    proc = _run_script(cmd, cwd=str(ot2_repo_dir), label="brickMixAndSAOT2")
    return _newest_py(out_dir, proc)


def _gen_asym_pcr(ot2_repo_dir: Path, out_dir: Path) -> Path:
    """ASYM_PCR.py is a static protocol – copy it with a fresh timestamp."""
    script = ot2_repo_dir / "scripts" / "ASYM_PCR.py"
    if not script.exists():
        raise FileNotFoundError(f"Script not found: {script}")

    out_dir.mkdir(parents=True, exist_ok=True)
    dest = out_dir / "ASYM_PCR.py"
    # Use shutil.copy (no metadata) so the dest gets the current mtime, not the
    # source file's commit-era mtime that copy2 would preserve.
    shutil.copy(script, dest)
    dest.touch()  # ensure mtime is exactly now
    return dest


def _gen_bm_sa_builder(
    ot2_repo_dir: Path,
    input_file_path: Path,
    out_dir: Path,
    temp_vol_ul: float,
) -> Path:
    """scripts/BM_SA_builder.py – brick mix + SA (Linux native)."""
    script = ot2_repo_dir / "scripts" / "BM_SA_builder.py"
    if not script.exists():
        raise FileNotFoundError(f"Script not found: {script}")

    out_dir.mkdir(parents=True, exist_ok=True)

    # Distinctive filename: BM_SA_Builder_Linux_<stem>.py
    stem = input_file_path.stem[:40].replace(" ", "_") or "input"
    out_name = f"BM_SA_Builder_Linux_{stem}.py"

    cmd = [
        sys.executable, str(script),
        "--file", str(input_file_path),
        "--outdir", str(out_dir),
        "--temp-vol", str(temp_vol_ul),
        "--output", out_name,
    ]
    proc = _run_script(cmd, cwd=str(ot2_repo_dir / "scripts"), label="BM_SA_builder")
    return _newest_py(out_dir, proc)


def _gen_build_brick_mix(
    ot2_repo_dir: Path,
    input_file_path: Path,
    out_dir: Path,
) -> Path:
    """scripts/build_brick_mix_py.py – encodes a word into a brick-mix protocol."""
    script = ot2_repo_dir / "scripts" / "build_brick_mix_py.py"
    if not script.exists():
        raise FileNotFoundError(f"Script not found: {script}")

    # Use the input filename stem as the encoding word
    word = input_file_path.stem[:40] or "input"
    out_dir.mkdir(parents=True, exist_ok=True)

    # Distinctive filename: Build_BrickMix_<stem>.py
    dest = out_dir / f"Build_BrickMix_{word.upper()}.py"

    cmd = [
        sys.executable, str(script),
        "--word", word,
        "--template", "BRICK_MIX_38_TIMES.py",
        "--output", str(dest),
    ]
    _run_script(cmd, cwd=str(ot2_repo_dir / "scripts"), label="build_brick_mix_py")
    if not dest.exists():
        raise RuntimeError(f"build_brick_mix_py did not produce expected file: {dest}")
    return dest


def _gen_sa_builder_07(
    ot2_repo_dir: Path,
    input_file_path: Path,
    out_dir: Path,
    temp_vol_ul: float,
) -> Path:
    """scripts/SA_builder_07.py – self-assembly-only builder."""
    script = ot2_repo_dir / "scripts" / "SA_builder_07.py"
    if not script.exists():
        raise FileNotFoundError(f"Script not found: {script}")

    out_dir.mkdir(parents=True, exist_ok=True)

    # Distinctive filename: SA_Builder07_<stem>.py
    stem = input_file_path.stem[:40].replace(" ", "_") or "input"
    out_name = f"SA_Builder07_{stem}.py"

    cmd = [
        sys.executable, str(script),
        "--file", str(input_file_path),
        "--outdir", str(out_dir),
        "--temp-vol", str(temp_vol_ul),
        "--output", out_name,
    ]
    proc = _run_script(cmd, cwd=str(ot2_repo_dir / "scripts"), label="SA_builder_07")
    return _newest_py(out_dir, proc)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_ot2_protocol(
    ot2_repo_dir: Path,
    input_file_path: Path,
    out_dir: Path,
    temp_vol_ul: float = 1.0,
    output_filename: str | None = None,
) -> Path:
    """
    Original single-protocol entry-point (brick_mix_sa_ot2).
    Kept for backward-compatibility with create_job_from_file.
    """
    return _gen_brick_mix_sa_ot2(
        ot2_repo_dir, input_file_path, out_dir, temp_vol_ul, output_filename
    )


def generate_ot2_protocol_by_key(
    protocol_key: str,
    ot2_repo_dir: Path,
    input_file_path: Path,
    out_dir: Path,
    temp_vol_ul: float = 1.0,
) -> Path:
    """
    Dispatch to the correct protocol generator based on *protocol_key*.

    Valid keys (see PROTOCOL_CHOICES for full list):
        brick_mix_sa_ot2, asym_pcr, bm_sa_builder, build_brick_mix, sa_builder_07
    """
    if protocol_key not in VALID_PROTOCOL_KEYS:
        raise ValueError(
            f"Unknown protocol key {protocol_key!r}. "
            f"Valid keys: {sorted(VALID_PROTOCOL_KEYS)}"
        )

    if protocol_key == "brick_mix_sa_ot2":
        return _gen_brick_mix_sa_ot2(ot2_repo_dir, input_file_path, out_dir, temp_vol_ul)
    if protocol_key == "asym_pcr":
        return _gen_asym_pcr(ot2_repo_dir, out_dir)
    if protocol_key == "bm_sa_builder":
        return _gen_bm_sa_builder(ot2_repo_dir, input_file_path, out_dir, temp_vol_ul)
    if protocol_key == "build_brick_mix":
        return _gen_build_brick_mix(ot2_repo_dir, input_file_path, out_dir)
    if protocol_key == "sa_builder_07":
        return _gen_sa_builder_07(ot2_repo_dir, input_file_path, out_dir, temp_vol_ul)

    # Unreachable – kept for type-checking completeness
    raise ValueError(f"Unhandled protocol key: {protocol_key!r}")
