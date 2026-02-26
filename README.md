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
2. Backend converts file -> plaintext (Base64)
3. OT-2 protocol generated
4. Scientist/Admin notified
5. Protocol run on OT-2 + sequencing
6. BAM uploaded
7. B2A converts BAM -> ASCII
8. Backend compares ASCII vs plaintext
9. Job marked SUCCESS / FAILED

## Tech Stack
- Backend: FastAPI + SQLAlchemy
- Auth: Cookie-based sessions
- Frontend: Next.js (POC)
- Lab Automation: Opentrons OT-2
- Sequencing Decode: B2A
- OS: Windows-friendly

## Project Structure
```md
biocompute-poc/
backend/
frontend/
tools/
artifacts/ # ignored by git
```

## Prerequisites
- Git (with submodules support)
- Python 3.10+ and `pip`
- Node.js 18+ and `npm`
- Git Bash (Windows) if you plan to run the OT-2 scripts locally
- Optional: Postgres if you do not want SQLite

## Clone the Repo
```bash
git clone https://github.com/biocompute-inc/BioCompute-POC.git
cd BioCompute-POC
git submodule update --init --recursive
```

Submodules are required for:
- `tools/OT2-BRICK-MIX-PROTOCOLS`
- `tools/B2A`
- `tools/references`

If `git submodule update --init --recursive` is skipped, protocol generation and BAM decoding will fail.

## Backend Setup (Local)
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

Start the API:
```bash
uvicorn app:app --reload --port 8000
```

Notes:
- On first run the database tables are created automatically.
- If you prefer Postgres, set `DATABASE_URL` accordingly (the app supports SQLite and Postgres).

## Frontend Setup (Local)
```bash
cd frontend/poc-frontend
npm install
npm run dev
```

## Using the App (Local POC)
1. Start the backend on port 8000.
2. Start the frontend on port 3000.
3. As a User, upload a file and create a job.
4. As a Scientist/Admin, download the OT-2 protocol, run sequencing, and upload the BAM.
5. View the comparison result in the job detail view.
