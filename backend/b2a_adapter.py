from __future__ import annotations
from pathlib import Path
import shutil
import subprocess
import ast

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

    # 1. Sanitize the script line endings natively in Python (bulletproof)
    try:
        script_text = script.read_text(encoding="utf-8")
        if "\r" in script_text:
            script.write_text(script_text.replace("\r", ""), encoding="utf-8")
    except Exception as e:
        print(f"Warning: Could not sanitize run_pipeline.sh line endings: {e}")

    # 2. Force executable permissions
    script.chmod(0o755)

    # 3. Call Conda directly using a clean argument list
    cmd = [
        "/opt/conda/bin/conda", 
        "run", 
        "-n", "modkit_env",
        "bash", 
        "./run_pipeline.sh",
        str(bam_path),
        str(reference_fasta),
        str(bitwidth)
    ]

    # Run the process explicitly inside the B2A directory
    proc = subprocess.run(cmd, cwd=str(b2a_repo_dir), capture_output=True, text=True)

    # Write logs
    stdout_log.write_text(proc.stdout or "", encoding="utf-8", errors="ignore")
    stderr_log.write_text(proc.stderr or "", encoding="utf-8", errors="ignore")

    if proc.returncode != 0:
        tail_stdout = (proc.stdout or '')[-1200:]
        tail_stderr = (proc.stderr or '')[-1200:]
        raise RuntimeError(
            f"B2A pipeline failed in Docker (exit={proc.returncode}).\n"
            f"Check logs: {stdout_log} and {stderr_log}\n"
            f"cmd: {cmd}\n"
            f"stdout_tail:\n{tail_stdout}\n"
            f"stderr_tail:\n{tail_stderr}\n"
        )

    ascii_logs_dir = b2a_repo_dir / "ASCII_logs"

    if not ascii_logs_dir.exists():
        raise RuntimeError("B2A finished but ASCII_logs directory not found in repo.")

    ascii_logs = sorted(
        ascii_logs_dir.glob("ASCII_Log_*.log"),
        key=lambda p: p.stat().st_mtime,
        reverse=True
    )

    if not ascii_logs:
        raise RuntimeError("B2A finished but no ASCII output log was produced.")

    latest_log = ascii_logs[0]
    lines = latest_log.read_text(encoding="utf-8", errors="ignore").splitlines()
    ascii_line = None
    for line in lines:
        if line.startswith("ASCII characters:"):
            ascii_line = line
            break
            
    if not ascii_line:
        raise RuntimeError("B2A log does not contain 'ASCII characters' line.")
    
    # Parse the list into a clean string
    # Example: ASCII characters: ['E', 'p', 'i', 'B']
    prefix = "ASCII characters:"
    raw_list = ascii_line[len(prefix):].strip()
    chars = ast.literal_eval(raw_list)   # ['E','p','i','B']
    clean_chars = []
    for c in chars:
        if isinstance(c, bytes):
            clean_chars.append(c.decode("latin-1"))
        else:
            clean_chars.append(c)
    decoded_str = "".join(chars)

    # WRITE CLEAN FILE — THIS MUST BE THE ONLY WRITE
    final_ascii = out_dir / "decoded_ascii.txt"
    final_ascii.write_text(decoded_str, encoding="utf-8")

    # DEBUG PROOF
    print("PIPELINE WRITING DECODED ASCII:", final_ascii)
    print("PIPELINE DECODED CONTENT:", decoded_str)

    return final_ascii
#    # Find newest output text file under out_dir or B2A repo logs folder
#     candidates = sorted(out_dir.rglob("*.txt"), key=lambda p: p.stat().st_mtime, reverse=True)
#     if candidates:
#         return candidates[0]

#     # fallback: search under B2A repo for most recent ASCII log/output
#     repo_logs = (b2a_repo_dir / "logs")
#     if repo_logs.exists():
#         candidates = sorted(repo_logs.rglob("*.log"), key=lambda p: p.stat().st_mtime, reverse=True)
#         if candidates:
#             return candidates[0]

#     raise RuntimeError("B2A finished but no ASCII output file was found. Check stdout/stderr logs.")
