from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict
import subprocess


@dataclass
class OT2Config:
    host: str = "OT2_IP_HERE"  # TODO: e.g. "169.254.x.x"
    user: str = "root"         # TODO: confirm username (often root)
    ssh_key_path: str = r"C:\PATH\TO\SSH\KEY"  # TODO: e.g. r"C:\Users\work\.ssh\id_rsa"
    remote_dir: str = "/data/user_storage/protocols"  # safe place to store protocols
    # Command to run on robot after upload:
    # Use opentrons_execute with full remote path.
    run_cmd_template: str = 'opentrons_execute "{remote_path}"'


def push_protocol_placeholder(protocol_path: Path, job_id: str) -> Dict[str, str]:
    """
    Placeholder: does NOT contact OT-2.
    Use this for now so your POC works without robot details.
    """
    if not protocol_path.exists():
        raise RuntimeError(f"Protocol file not found: {protocol_path}")

    return {
        "ok": "true",
        "mode": "placeholder",
        "message": "Protocol push simulated (no OT-2 connection yet)",
        "job_id": job_id,
        "protocol_file": protocol_path.name,
        "todo": "Fill OT2Config and uncomment SSH code in ot2_client.py/app.py",
    }


# ---------------------------
# REAL SSH LOGIC (COMMENTED)
# ---------------------------
# This logic uses Windows OpenSSH client (ssh/scp) via subprocess.
# It avoids extra Python deps (paramiko), and is easy to run on Windows.
#
# Requirements (when you enable):
# - Windows has OpenSSH client installed (Settings -> Optional Features)
# - You can run: ssh -i <key> root@<ip> "echo hi"
#
# def push_and_run_protocol_ssh(protocol_path: Path, job_id: str, cfg: OT2Config) -> Dict[str, str]:
#     if not protocol_path.exists():
#         raise RuntimeError(f"Protocol file not found: {protocol_path}")
#
#     remote_path = f"{cfg.remote_dir.rstrip('/')}/{job_id}.py"
#
#     # 1) Create remote dir
#     mkdir_cmd = [
#         "ssh",
#         "-i", cfg.ssh_key_path,
#         f"{cfg.user}@{cfg.host}",
#         f'mkdir -p "{cfg.remote_dir}"'
#     ]
#     r = subprocess.run(mkdir_cmd, capture_output=True, text=True)
#     if r.returncode != 0:
#         raise RuntimeError(f"SSH mkdir failed: {r.stderr.strip()}")
#
#     # 2) Copy file
#     scp_cmd = [
#         "scp",
#         "-i", cfg.ssh_key_path,
#         str(protocol_path),
#         f"{cfg.user}@{cfg.host}:{remote_path}"
#     ]
#     r = subprocess.run(scp_cmd, capture_output=True, text=True)
#     if r.returncode != 0:
#         raise RuntimeError(f"SCP failed: {r.stderr.strip()}")
#
#     # 3) Run protocol
#     run_cmd = cfg.run_cmd_template.format(remote_path=remote_path)
#     exec_cmd = [
#         "ssh",
#         "-i", cfg.ssh_key_path,
#         f"{cfg.user}@{cfg.host}",
#         run_cmd
#     ]
#     r = subprocess.run(exec_cmd, capture_output=True, text=True)
#     # Note: opentrons_execute can take time; for non-blocking use nohup/background later
#
#     return {
#         "ok": "true" if r.returncode == 0 else "false",
#         "mode": "ssh",
#         "job_id": job_id,
#         "remote_path": remote_path,
#         "stdout_tail": (r.stdout or "")[-4000:],
#         "stderr_tail": (r.stderr or "")[-4000:],
#         "exit_code": str(r.returncode),
#     }
