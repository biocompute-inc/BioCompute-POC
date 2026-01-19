from __future__ import annotations
from pathlib import Path
import subprocess
from wsl_paths import to_wsl_path

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

    b2a_repo_wsl = to_wsl_path(b2a_repo_dir)
    bam_wsl = to_wsl_path(bam_path)
    ref_wsl = to_wsl_path(reference_fasta)

    cmd = [
        "wsl",
        "bash",
        "-lc",
        f'cd "{b2a_repo_wsl}" && bash "./run_pipeline.sh" "{bam_wsl}" "{ref_wsl}" "{bitwidth}"'
    ]

    proc = subprocess.run(cmd, capture_output=True, text=True)

    stdout_log.write_text(proc.stdout or "")
    stderr_log.write_text(proc.stderr or "")

    if proc.returncode != 0:
        raise RuntimeError(
            f"B2A pipeline failed in WSL (exit={proc.returncode}). "
            f"Check logs: {stdout_log} and {stderr_log}"
            f"cmd: {cmd}\n"
            f"stdout(log): {stdout_log}\n"
            f"stderr(log): {stderr_log}\n"
            f"stderr tail:\n{(proc.stderr or '')[-1200:]}"
        )

   # Find newest output text file under out_dir or B2A repo logs folder
    candidates = sorted(out_dir.rglob("*.txt"), key=lambda p: p.stat().st_mtime, reverse=True)
    if candidates:
        return candidates[0]

    # fallback: search under B2A repo for most recent ASCII log/output
    repo_logs = (b2a_repo_dir / "logs")
    if repo_logs.exists():
        candidates = sorted(repo_logs.rglob("*.log"), key=lambda p: p.stat().st_mtime, reverse=True)
        if candidates:
            return candidates[0]

    raise RuntimeError("B2A finished but no ASCII output file was found. Check stdout/stderr logs.")
