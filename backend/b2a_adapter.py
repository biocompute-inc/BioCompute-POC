from __future__ import annotations
from pathlib import Path
import subprocess

def run_b2a_pipeline(
    git_bash_path: Path,
    b2a_repo_dir: Path,
    bam_path: Path,
    reference_fasta: Path,
    out_dir: Path,
    bitwidth: int = 8,
) -> Path:
    """
    Runs B2A run_pipeline.sh <bam> <ref_fasta> [bitwidth]
    Writes logs to out_dir and returns the produced ASCII output path.
    """
    out_dir.mkdir(parents=True, exist_ok=True)

    script = b2a_repo_dir / "run_pipeline.sh"
    if not script.exists():
        raise FileNotFoundError(f"B2A script not found: {script}")

    if not reference_fasta.exists():
        raise FileNotFoundError(f"Reference FASTA not found: {reference_fasta}")

    stdout_log = out_dir / "b2a_stdout.log"
    stderr_log = out_dir / "b2a_stderr.log"

    bam_path = bam_path.resolve()
    reference_fasta = reference_fasta.resolve()
    b2a_repo_dir = b2a_repo_dir.resolve()

    cmd = [
        str(git_bash_path),
        "-lc",
        f'cd "{b2a_repo_dir}" && bash "{script}" "{bam_path}" "{reference_fasta}" "{bitwidth}"'
    ]

    proc = subprocess.run(cmd, capture_output=True, text=True)

    stdout_log.write_text(proc.stdout or "")
    stderr_log.write_text(proc.stderr or "")

    if proc.returncode != 0:
        raise RuntimeError(
            "B2A pipeline failed.\n"
            f"cmd: {cmd}\n"
            f"stdout(log): {stdout_log}\n"
            f"stderr(log): {stderr_log}\n"
            f"stderr tail:\n{(proc.stderr or '')[-1200:]}"
        )

    # Find produced ASCII output in out_dir (adjust if your pipeline names it differently)
    candidates = sorted(out_dir.glob("*.txt"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not candidates:
        candidates = sorted(out_dir.glob("*.ascii"), key=lambda p: p.stat().st_mtime, reverse=True)

    if not candidates:
        raise RuntimeError(
            f"B2A finished but no ASCII output found in {out_dir}. "
            f"Check logs: {stdout_log} {stderr_log}"
        )

    return candidates[0]
