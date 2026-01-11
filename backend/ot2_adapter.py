from __future__ import annotations
from pathlib import Path
import subprocess
import sys

def generate_ot2_protocol(
    ot2_repo_dir: Path,
    input_file_path: Path,
    out_dir: Path,
    temp_vol_ul: float = 1.0,
    output_filename: str | None = None,
) -> Path:
    """
    Generates an OT-2 protocol using:
      scripts/winUser/brickMixAndSAOT2.py --file <input> --outdir <outdir> --temp-vol <x>

    Returns the generated protocol .py file path.
    """
    script = ot2_repo_dir / "scripts" / "winUser" / "brickMixAndSAOT2.py"
    if not script.exists():
        raise FileNotFoundError(f"OT2 generator script not found: {script}")

    out_dir.mkdir(parents=True, exist_ok=True)

    cmd = [
        sys.executable,
        str(script),
        "--file", str(input_file_path),
        "--outdir", str(out_dir),
        "--temp-vol", str(temp_vol_ul),
    ]

    if output_filename:
        cmd += ["--output", output_filename]

    proc = subprocess.run(
        cmd,
        cwd=str(ot2_repo_dir),
        capture_output=True,
        text=True,
    )

    if proc.returncode != 0:
        raise RuntimeError(
            "Protocol generation failed.\n"
            f"cmd: {' '.join(cmd)}\n"
            f"stdout:\n{proc.stdout}\n"
            f"stderr:\n{proc.stderr}\n"
        )

    # Find newest .py in out_dir (generator writes BRICK_MIX_<...>.py)
    py_files = sorted(out_dir.glob("*.py"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not py_files:
        raise RuntimeError(
            "Protocol generation succeeded but no .py file found in output directory.\n"
            f"stdout:\n{proc.stdout}\n"
            f"stderr:\n{proc.stderr}\n"
        )

    return py_files[0]
