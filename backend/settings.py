from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
import os
from dotenv import load_dotenv

load_dotenv()

@dataclass(frozen=True)
class Settings:
    # 1. Fields WITHOUT defaults go first
    ot2_repo_dir: Path
    b2a_repo_dir: Path
    artifacts_dir: Path
    session_secret: str
    git_bash_path: Path
    db_url: str
    frontend_base_url: str
    reset_token_ttl_minutes: int

    # 2. Fields WITH defaults go last
    b2a_reference_fasta: Path = Path(os.getenv("B2A_REFERENCE_FASTA", "/app/tools/references/reference.fasta"))
    b2a_bitwidth: int = int(os.getenv("B2A_BITWIDTH", "8"))

def get_settings() -> Settings:
    # Use absolute paths starting with /app (your Docker WORKDIR)
    ot2_repo = Path(os.getenv("OT2_REPO_DIR", "/tools/OT2-BRICK-MIX-PROTOCOLS")).resolve()
    b2a_repo = Path(os.getenv("B2A_REPO_DIR", "/tools/B2A")).resolve()
    artifacts = Path(os.getenv("ARTIFACTS_DIR", "/artifacts")).resolve()
    
    secret = os.getenv("SESSION_SECRET", "dev-secret-change-me")
    
    # Change to standard Linux bash path!
    bash = Path(os.getenv("GIT_BASH_PATH", "/bin/bash"))

    db_url = os.getenv("DATABASE_URL", "")
    if not db_url:
        raise RuntimeError("DATABASE_URL is not set")
        
        

    # if not ot2_repo.is_absolute():
    #     ot2_repo = Path("/app") / ot2_repo
    # if not b2a_repo.is_absolute():
    #     b2a_repo = Path("/app") / b2a_repo
    # if not artifacts.is_absolute():
    #     artifacts = Path("/app") / artifacts

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