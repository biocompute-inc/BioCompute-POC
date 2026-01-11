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
- Backend: FastAPI + SQLite
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
## Clone Repo
```bash
git clone https://github.com/biocompute-inc/BioCompute-POC.git
cd BioCompute-POC
git submodule update --init --recursive
```
- External lab automation and decoding tools are included as pinned Git submodules to ensure reproducibility.

## Setup (Local)
```bash
git clone https://github.com/biocompute-inc/BioCompute-POC.git
cd biocompute-poc/backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app:app --reload
```
