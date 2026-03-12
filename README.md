# BioCompute OT-2 + B2A POC

End-to-end proof-of-concept that encodes a file into DNA, runs it through an Opentrons OT-2 liquid-handler, sequences the result, and verifies the decoded output matches the original.

## How It Works

1. **User** uploads a file → backend converts it to a Base64 plaintext representation
2. Backend generates an OT-2 liquid-handling protocol
3. **Scientist** is notified, downloads the protocol, and runs it on the OT-2
4. Sequencing is performed and the resulting BAM file is uploaded
5. B2A decodes the BAM → ASCII
6. Backend compares ASCII vs original plaintext → job marked **SUCCESS** or **FAILED**

## Roles

| Role | What they can do |
|------|-----------------|
| **User** | Upload files, create jobs, view status and results |
| **Scientist** | Download protocols, upload BAM files, mark jobs complete |
| **Admin** | Everything above, plus manage users and view analytics |

## Tech Stack

- **Backend**: FastAPI + SQLAlchemy + Uvicorn (port 8000)
- **Frontend**: Next.js + React + Tailwind CSS (port 3000)
- **Reverse proxy**: nginx (port 80, internal only)
- **Auth**: Session cookies (HttpOnly, SameSite=Lax) + CSRF double-submit
- **Lab Automation**: Opentrons OT-2
- **Sequencing Decode**: B2A (runs inside a Conda `modkit_env` environment)
- **Database**: PostgreSQL (production) / SQLite (local dev)
- **Containerisation**: Docker + Docker Compose
- **Production tunnel**: Cloudflare Tunnel (optional, `prod` profile)

## Project Structure

```
BioCompute-POC/
├── backend/               # FastAPI app, Alembic migrations, services
├── frontend/
│   └── poc-frontend/      # Next.js app (App Router)
├── tools/                 # Git submodules
│   ├── B2A/               # BAM-to-ASCII decoder
│   ├── OT2-BRICK-MIX-PROTOCOLS/   # OT-2 protocol scripts
│   └── references/        # Reference FASTA for B2A
├── artifacts/             # Job outputs — git-ignored, auto-created
├── docker-compose.yml
├── docker-compose.override.yml   # Adds port 80:80 and frontend hot-reload for local dev
└── nginx.conf
```

---

## 1. Clone the Repository

```bash
git clone https://github.com/biocompute-inc/BioCompute-POC.git
cd BioCompute-POC
git submodule update --init --recursive
```

> **Required.** Skipping the submodule step will break the B2A pipeline and protocol generation.

---

## 2. Create Environment Files

### `backend/.env`

```env
# --- Required ---
DATABASE_URL=postgresql://user:password@host:5432/dbname
SESSION_SECRET=change-me-to-a-long-random-string-min-32-chars

# --- Recommended ---
FRONTEND_BASE_URL=http://localhost:3000
RESET_TOKEN_TTL_MINUTES=30
ALLOWED_ORIGINS=http://localhost:3000
SECURE_COOKIES=false       # set to true in production (HTTPS only)

# --- Optional (these defaults work inside Docker) ---
OT2_REPO_DIR=/app/tools/OT2-BRICK-MIX-PROTOCOLS
B2A_REPO_DIR=/app/tools/B2A
ARTIFACTS_DIR=/app/artifacts
B2A_REFERENCE_FASTA=/app/tools/references/reference.fasta
B2A_BITWIDTH=8
```

For **local dev with SQLite** (no Postgres needed):

```env
DATABASE_URL=sqlite:///./dev.db
```

### `frontend/poc-frontend/.env.local`

```env
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

> In production behind nginx the frontend uses a relative `/api` path via the reverse proxy. For local dev, point directly at the backend port.

---

## 3. Running the Stack

### Option A — Docker Compose (recommended for all platforms)

This is the standard way to run the project. One command starts nginx, the backend, and the frontend:

```bash
docker compose up --build
```

Docker Compose automatically picks up `docker-compose.override.yml` when it exists, which adds port `80:80` on nginx and enables frontend hot-reload via volume mounts.

To run in the background:

```bash
docker compose up --build -d
```

To stop everything:

```bash
docker compose down
```

Once running, open:

| Service | URL |
|---------|-----|
| App (via nginx) | http://localhost |
| Frontend direct | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Swagger docs | http://localhost:8000/docs |

---

### Option B — Local Development (no Docker)

Use this when you want faster iteration without container rebuilds.

#### Backend

Requires **Python 3.10+**.

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate          # Linux / macOS / WSL
# .\venv\Scripts\Activate.ps1     # Windows PowerShell

pip install -r requirements.txt

# Run with auto-reload
uvicorn main:app --reload --port 8000
```

- Database tables are created automatically on first start.
- The B2A pipeline (`modkit_env`) is managed by Conda inside the container. Running it locally requires Conda/Miniconda installed and `tools/B2A` cloned.

#### Frontend

Requires **Node.js 18+**.

```bash
cd frontend/poc-frontend
npm install
npm run dev
```

The dev server starts on http://localhost:3000 with hot-reload enabled.

---

## 4. Platform-Specific Notes

### Linux

Install Docker and the Compose plugin if you haven't already:

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER   # log out and back in after this
```

Then run from the repo root:

```bash
docker compose up --build
```

---

### Windows

**Docker Desktop (recommended)**

1. Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) with the **WSL 2 backend** enabled.
2. Open Docker Desktop and wait for "Engine running".
3. In PowerShell / Windows Terminal at the repo root:

```powershell
docker compose up --build
```

**WSL 2 only (no Docker Desktop)**

If you're developing inside a WSL 2 Ubuntu/Debian distro, follow the Linux instructions above inside your WSL terminal — it works identically.

**Windows-specific notes:**
- The backend Dockerfile strips Windows line endings (`\r\n → \n`) from shell scripts automatically via `sed`. You don't need to do this manually.
- If you cloned on Windows and still see line-ending errors, run `git config --global core.autocrlf input` and re-clone.

---

### macOS

1. Install [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/) (Apple Silicon or Intel).
2. Start Docker Desktop and wait for the engine.
3. From the repo root:

```bash
docker compose up --build
```

---

### Raspberry Pi (ARM64)

**Supported hardware:** Raspberry Pi 4 or 5 running **64-bit Raspberry Pi OS (Bookworm)**. The B2A pipeline requires a 64-bit OS — 32-bit images will not work.

#### Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out and back in after this
sudo apt install -y docker-compose-plugin
```

#### Start the stack

```bash
docker compose up --build
```

#### ARM64 compatibility

| Image | ARM64 status |
|-------|-------------|
| `node:20-alpine` (frontend) | ✅ Native ARM64 — works out of the box |
| `continuumio/miniconda3` (backend) | ⚠️ May not have an ARM64 variant on older tags |

If the backend build fails with a platform error, edit the first line of `backend/DockerFile`:

```dockerfile
# Replace:
FROM continuumio/miniconda3:latest

# With (ARM64-compatible):
FROM mambaorg/micromamba:latest
```

Alternatively, force QEMU emulation (slower but always works):

```bash
docker compose build --platform linux/amd64
docker compose up
```

---

## 5. Production Deployment (Cloudflare Tunnel)

Production uses a Cloudflare Tunnel to expose the app without opening inbound ports. The tunnel runs as an extra Docker service under the `prod` profile.

Add to `backend/.env`:

```env
TUNNEL_TOKEN=your-cloudflare-tunnel-token
SECURE_COOKIES=true
ALLOWED_ORIGINS=https://your-domain.com
FRONTEND_BASE_URL=https://your-domain.com
```

Start with the `prod` profile to include the tunnel container:

```bash
TUNNEL_TOKEN=your-token docker compose --profile prod up --build -d
```

> The nginx service does **not** expose port 80 to the host in this mode — traffic comes in through the Cloudflare edge only.

---

## 6. Useful Commands

```bash
# Rebuild and restart a single service
docker compose up --build backend

# Tail logs for a service
docker compose logs -f backend
docker compose logs -f frontend

# Open a shell inside the running backend container
docker exec -it poc_backend bash

# Run a one-off Alembic migration
docker exec -it poc_backend bash -c "cd /app && alembic upgrade head"

# Stop containers and remove volumes
docker compose down -v
```

---

## 7. First-Time Admin Setup

The database starts empty with no users. Create the first admin account via the backend API directly:

```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"yourpassword","role":"admin","display_name":"Admin"}'
```

Or use the Swagger UI at http://localhost:8000/docs → `POST /auth/register`.