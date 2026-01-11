from __future__ import annotations
from pathlib import Path
import shutil
import subprocess
import time

def run_b2a_pipeline(
    git_bash_path: Path,
    b2a_repo_dir: Path,
    bam_path: Path,
    out_dir: Path,
) -> Path:
    """
    Runs B2A run_pipeline.sh using Git Bash.
    Copies BAM into B2A repo root (per common bash-script expectations),
    then collects the newest ASCII-like output into out_dir.

    Returns: path to detected ASCII output file.
    """
    if not git_bash_path.exists():
        raise FileNotFoundError(f"Git Bash not found at: {git_bash_path}")

    run_script = b2a_repo_dir / "run_pipeline.sh"
    if not run_script.exists():
        raise FileNotFoundError(f"B2A run_pipeline.sh not found: {run_script}")

    out_dir.mkdir(parents=True, exist_ok=True)

    # Copy BAM into B2A repo root for simplest compatibility
    work_bam = b2a_repo_dir / bam_path.name
    shutil.copy2(bam_path, work_bam)

    before = time.time()

    # Run: bash run_pipeline.sh
    proc = subprocess.run(
        [str(git_bash_path), str(run_script)],
        cwd=str(b2a_repo_dir),
        capture_output=True,
        text=True,
        check=False,
    )

    # Always save logs for debugging
    (out_dir / "b2a_stdout.log").write_text(proc.stdout or "", encoding="utf-8")
    (out_dir / "b2a_stderr.log").write_text(proc.stderr or "", encoding="utf-8")

    if proc.returncode != 0:
        raise RuntimeError("B2A pipeline failed. Check b2a_stdout.log / b2a_stderr.log in artifacts.")

    # Heuristic: find newest output file created after run (excluding bam)
    candidates = []
    for f in b2a_repo_dir.rglob("*"):
        if not f.is_file():
            continue
        if f.name == work_bam.name:
            continue
        if f.stat().st_mtime >= before - 1:
            candidates.append(f)

    # Prefer text-like outputs
    preferred_ext = {".txt", ".tsv", ".csv", ".out"}
    preferred = [c for c in candidates if c.suffix.lower() in preferred_ext]
    preferred.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)

    chosen = preferred[0] if preferred else (candidates[0] if candidates else None)
    if chosen is None:
        raise RuntimeError("B2A ran but no output file was detected. Check logs.")

    # Copy chosen output to artifacts for job
    ascii_out = out_dir / chosen.name
    shutil.copy2(chosen, ascii_out)

    # Cleanup copied bam
    try:
        work_bam.unlink()
    except OSError:
        pass

    return ascii_out
