from __future__ import annotations

from fastapi import APIRouter

from jobs import service as jobs_service

router = APIRouter()

router.post("/jobs/from-file")(jobs_service.create_job_from_file)
router.get("/jobs")(jobs_service.list_jobs)
router.get("/jobs/{job_id}")(jobs_service.get_job)
router.get("/jobs/{job_id}/plaintext")(jobs_service.download_plaintext)
router.get("/jobs/{job_id}/protocol")(jobs_service.download_protocol)
router.post("/jobs/{job_id}/bam")(jobs_service.upload_bam)
router.post("/jobs/{job_id}/complete")(jobs_service.mark_job_complete)
router.delete("/jobs/{job_id}", status_code=204)(jobs_service.delete_job)
router.get("/scientist/jobs")(jobs_service.scientist_jobs)
