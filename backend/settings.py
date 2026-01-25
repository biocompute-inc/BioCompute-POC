from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
import os
from dotenv import load_dotenv

load_dotenv()

@dataclass(frozen=True)
class Settings:
    ot2_repo_dir: Path
    b2a_repo_dir: Path
    artifacts_dir: Path
    session_secret: str
    git_bash_path: Path
    db_url: str
    b2a_reference_fasta = Path(os.getenv("B2A_REFERENCE_FASTA", ""))
    b2a_bitwidth = int(os.getenv("B2A_BITWIDTH", "8"))
    frontend_base_url: str
    reset_token_ttl_minutes: int

def get_settings() -> Settings:
    ot2_repo = Path(os.getenv("OT2_REPO_DIR", "../tools/OT2-BRICK-MIX-PROTOCOLS")).resolve()
    b2a_repo = Path(os.getenv("B2A_REPO_DIR", "../tools/B2A")).resolve()
    artifacts = Path(os.getenv("ARTIFACTS_DIR", "../artifacts")).resolve()
    secret = os.getenv("SESSION_SECRET", "dev-secret-change-me")
    bash = Path(os.getenv("GIT_BASH_PATH", "C:/Program Files/Git/bin/bash.exe"))

    db_path = Path(__file__).parent / "poc.db"
    db_url = f"sqlite:///{db_path.as_posix()}"

    return Settings(
        ot2_repo_dir=ot2_repo,
        b2a_repo_dir=b2a_repo,
        artifacts_dir=artifacts,
        session_secret=secret,
        git_bash_path=bash,
        db_url=db_url,
        frontend_base_url=os.getenv("FRONTEND_BASE_URL", "http://localhost:3000"),
        reset_token_ttl_minutes=int(os.getenv("RESET_TOKEN_TTL_MINUTES", "30")),
    )
