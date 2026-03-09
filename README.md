# BioCompute OT-2 + B2A POC

End-to-end proof-of-concept integrating:
- User file upload
- Plaintext conversion
- OT-2 protocol generation
- Wet-lab sequencing
- BAM decoding via B2A
- Result comparison and verification

## Roles
- **User**: uploads file, views job status and results
- **Scientist/Admin**: runs OT-2 protocol, uploads BAM, completes job

## High-level Flow
1. User uploads file
2. Backend converts file → plaintext (Base64)
3. OT-2 protocol generated
4. Scientist/Admin notified
5. Protocol run on OT-2 + sequencing
6. BAM uploaded
7. B2A converts BAM → ASCII
8. Backend compares ASCII vs plaintext
9. Job marked SUCCESS / FAILED

## Tech Stack
- **Backend**: FastAPI + SQLAlchemy + Uvicorn (port 8000)
- **Frontend**: Next.js 16 + React 19 + Tailwind (port 3000)
- **Auth**: Cookie-based sessions
- **Lab Automation**: Opentrons OT-2
- **Sequencing Decode**: B2A (via Conda `modkit_env`)
- **Database**: PostgreSQL (or SQLite for local dev)
- **Containerisation**: Docker + Docker Compose

## Project Structure
```
biocompute-poc/
├── backend/          # FastAPI app + Alembic migrations
├── frontend/         # Next.js frontend
│   └── poc-frontend/
├── tools/            # Git submodules (B2A, OT2 protocols, references)
└── artifacts/        # Job outputs (git-ignored)
```

---

## Cloning (required before anything else)

```bash
git clone https://github.com/biocompute-inc/BioCompute-POC.git
cd BioCompute-POC
git submodule update --init --recursive
```

The following submodules are **mandatory** — skipping this step will break pipeline execution:
- `tools/OT2-BRICK-MIX-PROTOCOLS`
- `tools/B2A`
- `tools/references`

---

## Environment Files

Create the two `.env` files before starting any service.

### `backend/.env`
```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
SESSION_SECRET=change-me-to-a-long-random-string
FRONTEND_BASE_URL=http://localhost:3000
RESET_TOKEN_TTL_MINUTES=30

# Optional — defaults work inside the container
OT2_REPO_DIR=/app/tools/OT2-BRICK-MIX-PROTOCOLS
B2A_REPO_DIR=/app/tools/B2A
ARTIFACTS_DIR=/app/artifacts
B2A_REFERENCE_FASTA=/app/tools/references/reference.fasta
B2A_BITWIDTH=8
```

### `frontend/poc-frontend/.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

> **Note:** `DATABASE_URL` is required. The backend will refuse to start without it.

---

## Running with Docker (Recommended)

Docker Compose starts both the backend (FastAPI) and the frontend (Next.js) together. Instructions differ slightly per platform.

### Linux

Install Docker Engine and the Compose plugin if you haven't already:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER   # allows running docker without sudo (re-login after)
```

Start the stack from the repo root:

```bash
docker compose up --build
```

To run in the background:

```bash
docker compose up --build -d
```

To stop:

```bash
docker compose down
```

---

### Windows

**Option A — Docker Desktop (easiest)**

1. Download and install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/).
2. During installation, enable the **WSL 2 backend** (recommended over Hyper-V).
3. Open **Docker Desktop** and wait until it shows "Engine running".
4. Open a terminal (PowerShell, Command Prompt, or Windows Terminal) at the repo root:

```powershell
docker compose up --build
```

**Option B — WSL 2 only (no Docker Desktop)**

If you are already running the project inside WSL 2 (Ubuntu/Debian), follow the Linux instructions above inside your WSL terminal. Docker installed inside WSL 2 works identically to native Linux.

**Windows-specific notes:**
- The backend Dockerfile automatically fixes Windows-style line endings (`\r\n → \n`) in shell scripts via `sed`, so you do not need to do this manually.
- Volume mounts use Linux paths inside the container regardless of your host OS — this is handled automatically by Docker Desktop.
- If you cloned on Windows and see script errors, run `git config --global core.autocrlf input` before cloning next time.

---

### macOS

1. Install [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/) (Apple Silicon or Intel).
2. Open Docker Desktop and wait for the engine to start.
3. In a terminal at the repo root:

```bash
docker compose up --build
```

---

### Raspberry Pi (ARM64)

The Raspberry Pi runs on ARM64 (aarch64). Most images used in this project have ARM64 variants, but there are a few things to be aware of.

**Supported: Raspberry Pi 4 / 5 running 64-bit Raspberry Pi OS (Bookworm)**

Install Docker:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # re-login after this
```

Install the Compose plugin:

```bash
sudo apt install -y docker-compose-plugin
```

Start the stack:

```bash
docker compose up --build
```

**ARM64 caveats:**

| Component | ARM64 status |
|-----------|-------------|
| `node:20-alpine` (frontend) | Native ARM64 image available — works out of the box |
| `continuumio/miniconda3` (backend) | The `latest` tag **may not have an ARM64 variant**. If the build fails, replace the base image in `backend/DockerFile` with `mambaorg/micromamba:latest` or use the `linux/arm64` platform flag shown below |

If `continuumio/miniconda3` fails on ARM, edit the first line of `backend/DockerFile`:

```dockerfile
# Replace this:
FROM continuumio/miniconda3:latest

# With this (ARM64-compatible):
FROM mambaorg/micromamba:latest
```

Alternatively, force Docker to emulate `linux/amd64`:

```bash
docker compose build --platform linux/amd64
docker compose up
```

> Emulation via QEMU works but is significantly slower. Building natively with an ARM64-compatible image is preferred.

**Raspberry Pi 3 (32-bit OS):** Not recommended. The B2A pipeline (`ont-modkit`) requires 64-bit and will fail on a 32-bit OS image.

---

## Verifying the Stack

Once `docker compose up` completes, open:

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |

---

## Running Locally (Without Docker)

### Backend

Requires Python 3.10+.

```bash
cd backend
python -m venv venv

# Linux / macOS / WSL
source venv/bin/activate

# Windows (PowerShell)
.\venv\Scripts\Activate.ps1

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

- Database tables are created automatically on first run.
- For SQLite (quick local test), set `DATABASE_URL=sqlite:///./dev.db` in `backend/.env`.

### Frontend

Requires Node.js 18+.

```bash
cd frontend/poc-frontend
npm install
npm run dev
```

---

## Using the App

1. Start the backend on port 8000.
2. Start the frontend on port 3000.
3. As a **User**: upload a file to create a job.
4. As a **Scientist/Admin**: download the OT-2 protocol, run sequencing, and upload the resulting BAM file.
5. View the comparison result in the job detail view.

---

## Useful Docker Commands

```bash
# Rebuild a single service after code changes
docker compose up --build backend

# View logs for a specific service
docker compose logs -f backend
docker compose logs -f frontend

# Open a shell inside the running backend container
docker exec -it poc_backend bash

# Stop and remove containers + volumes
docker compose down -v
```

test
