from __future__ import annotations

from fastapi import APIRouter

from jobs import service as jobs_service

# Author - Naveen M, for BioCompute, PoC - Version 0.0.1
# This file defines the API routes for job-related operations, such as creating jobs from uploaded files, listing jobs, retrieving job details, uploading BAM files, marking jobs as complete, and more.
# Each route is associated with a corresponding service function in jobs/service.py that implements the business logic for that operation. 
# These routes are used by the frontend to interact with the backend for all job-related functionality, and they require authentication to ensure that only authorized users can access and manage their jobs.

router = APIRouter()

router.post("/jobs/from-file")(jobs_service.create_job_from_file)
router.get("/jobs")(jobs_service.list_jobs)
router.get("/jobs/{job_id}")(jobs_service.get_job)
router.get("/jobs/{job_id}/plaintext")(jobs_service.download_plaintext)
router.get("/jobs/{job_id}/protocol")(jobs_service.download_protocol)
router.get("/jobs/{job_id}/protocols")(jobs_service.list_job_protocols)
router.get("/jobs/{job_id}/protocol/{filename}")(jobs_service.download_protocol_by_name)
router.post("/jobs/{job_id}/bam")(jobs_service.upload_bam)
router.post("/jobs/{job_id}/complete")(jobs_service.mark_job_complete)
router.delete("/jobs/{job_id}", status_code=204)(jobs_service.delete_job)
router.get("/scientist/jobs")(jobs_service.scientist_jobs)
router.get("/protocols")(jobs_service.list_protocols)
router.post("/jobs/{job_id}/generate-protocol")(jobs_service.generate_protocol_for_job)
router.post("/jobs/{job_id}/push-to-ot2")(jobs_service.push_to_ot2)
router.get("/jobs/{job_id}/events")(jobs_service.job_events)