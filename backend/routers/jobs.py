from fastapi import APIRouter, HTTPException, Depends
from routers.auth import get_current_user
from database import get_job, get_jobs_by_dataset, get_jobs_by_user, get_dataset

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("")
def list_user_jobs(user: dict = Depends(get_current_user)):
    """List all ETL jobs for the current user — scoped to user_id from JWT."""
    jobs = get_jobs_by_user(user["user_id"])

    # Enrich each job with dataset name for display
    dataset_cache = {}
    for job in jobs:
        did = job.get("dataset_id")
        if did and did not in dataset_cache:
            ds = get_dataset(did)
            # Only include dataset name if user owns it (should always be true for their jobs)
            if ds and ds.get("user_id") == user["user_id"]:
                dataset_cache[did] = ds.get("name", "Unknown")
            else:
                dataset_cache[did] = "Unknown"
        job["dataset_name"] = dataset_cache.get(did, "Unknown")

    jobs.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return jobs


@router.get("/{job_id}")
def get_job_detail(job_id: str, user: dict = Depends(get_current_user)):
    """Get a specific job detail — enforces user ownership."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Primary check: job belongs to user
    if job.get("user_id") != user["user_id"]:
        # Fallback: check dataset ownership
        dataset = get_dataset(job.get("dataset_id"))
        if not dataset or dataset.get("user_id") != user["user_id"]:
            # Return 404 to prevent enumeration
            raise HTTPException(status_code=404, detail="Job not found")

    # Enrich with dataset name
    dataset = get_dataset(job.get("dataset_id"))
    if dataset and dataset.get("user_id") == user["user_id"]:
        job["dataset_name"] = dataset.get("name", "Unknown")

    return job


@router.get("/dataset/{dataset_id}")
def list_dataset_jobs(dataset_id: str, user: dict = Depends(get_current_user)):
    """List all jobs for a dataset — enforces dataset ownership."""
    dataset = get_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if dataset["user_id"] != user["user_id"]:
        # Return 404 to prevent enumeration
        raise HTTPException(status_code=404, detail="Dataset not found")

    jobs = get_jobs_by_dataset(dataset_id)
    for job in jobs:
        job["dataset_name"] = dataset.get("name", "Unknown")
    jobs.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return jobs
