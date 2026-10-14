import boto3
import json
import os
import uuid
from fastapi import APIRouter, HTTPException, status, Depends
from botocore.exceptions import ClientError
from models.dataset import (
    UploadUrlRequest,
    UploadUrlResponse,
    DatasetCreate,
    DatasetResponse,
)
from routers.auth import get_current_user
from database import (
    create_dataset,
    get_datasets_by_user,
    get_dataset,
    delete_dataset_record,
)
from utils import sanitize_error_message, MAX_FILE_SIZE_BYTES

router = APIRouter(prefix="/api/datasets", tags=["datasets"])

S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "dataflow-platform-kaart")
AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
s3_client = boto3.client("s3", region_name=AWS_REGION)


@router.post("/upload-url", response_model=UploadUrlResponse)
def generate_upload_url(
    request: UploadUrlRequest, user: dict = Depends(get_current_user)
):
    """Generate a presigned S3 upload URL with content-length constraints."""
    dataset_id = str(uuid.uuid4())
    s3_key = f"bronze/datasets/{dataset_id}/raw.csv"

    # Pydantic model already validates filename and file_size via utils validators

    try:
        presigned_url = s3_client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": S3_BUCKET_NAME,
                "Key": s3_key,
                "ContentType": "text/csv",
            },
            ExpiresIn=300,
        )
    except Exception as e:
        # Don't leak AWS internals
        print(f"[ERROR] Failed to generate presigned URL: {sanitize_error_message(e)}")
        raise HTTPException(
            status_code=500, detail="Failed to generate upload URL. Please try again."
        )

    return UploadUrlResponse(upload_url=presigned_url, dataset_id=dataset_id)


@router.post("", response_model=DatasetResponse, status_code=status.HTTP_201_CREATED)
def create_new_dataset(request: DatasetCreate, user: dict = Depends(get_current_user)):
    """Create a dataset record after file upload and trigger ETL pipeline."""
    user_id = user["user_id"]

    # Pydantic model validates dataset_id is UUID and filename is safe

    # Verify file actually exists in S3 and check size
    try:
        s3_key = f"bronze/datasets/{request.dataset_id}/raw.csv"
        response = s3_client.head_object(Bucket=S3_BUCKET_NAME, Key=s3_key)
        file_size = response["ContentLength"]

        # Server-side file size enforcement
        if file_size > MAX_FILE_SIZE_BYTES:
            # Delete the oversized file
            try:
                s3_client.delete_object(Bucket=S3_BUCKET_NAME, Key=s3_key)
            except Exception:
                pass
            raise HTTPException(
                status_code=400,
                detail=f"Uploaded file exceeds maximum size of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB",
            )

        # Verify Content-Type header from S3
        content_type = response.get("ContentType", "")
        if (
            content_type
            and "csv" not in content_type.lower()
            and "text" not in content_type.lower()
        ):
            raise HTTPException(
                status_code=400,
                detail="Invalid file type. Only CSV files are accepted.",
            )

    except ClientError:
        raise HTTPException(
            status_code=404,
            detail="File not found in storage. Please upload the file first.",
        )

    dataset = create_dataset(request.dataset_id, user_id, request.filename, file_size)
    if not dataset:
        raise HTTPException(status_code=500, detail="Failed to create dataset record")

    # Trigger ETL Lambda async
    try:
        lambda_client = boto3.client("lambda", region_name=AWS_REGION)
        payload = {
            "bucket": S3_BUCKET_NAME,
            "key": s3_key,
            "dataset_id": request.dataset_id,
            "user_id": user_id,
        }
        lambda_client.invoke(
            FunctionName=os.getenv("ETL_LAMBDA_NAME", "dataflow-etl"),
            InvocationType="Event",  # Async execution
            Payload=json.dumps(payload),
        )
    except Exception as e:
        # Log internally but don't expose to user
        print(f"[WARN] ETL Lambda invocation failed: {sanitize_error_message(e)}")

    return DatasetResponse(**dataset)


@router.get("", response_model=list[DatasetResponse])
def list_datasets(user: dict = Depends(get_current_user)):
    """List datasets owned by the authenticated user."""
    user_id = user["user_id"]
    datasets = get_datasets_by_user(user_id)
    # Sort by created_at desc
    datasets.sort(key=lambda x: x["created_at"], reverse=True)
    return [DatasetResponse(**d) for d in datasets]


@router.get("/{dataset_id}", response_model=DatasetResponse)
def get_dataset_detail(dataset_id: str, user: dict = Depends(get_current_user)):
    """Get dataset detail — enforces ownership check."""
    dataset = get_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if dataset["user_id"] != user["user_id"]:
        # Return 404 instead of 403 to prevent user enumeration
        raise HTTPException(status_code=404, detail="Dataset not found")

    return DatasetResponse(**dataset)


@router.delete("/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dataset(dataset_id: str, user: dict = Depends(get_current_user)):
    """Delete a dataset — enforces ownership check and cleans up S3."""
    dataset = get_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if dataset["user_id"] != user["user_id"]:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Delete from DynamoDB
    delete_dataset_record(dataset_id)

    # Clean up S3 objects (bronze + silver)
    try:
        prefixes = [
            f"bronze/datasets/{dataset_id}/",
            f"silver/datasets/{dataset_id}/",
        ]
        for prefix in prefixes:
            objects = s3_client.list_objects_v2(Bucket=S3_BUCKET_NAME, Prefix=prefix)
            if "Contents" in objects:
                delete_keys = [{"Key": obj["Key"]} for obj in objects["Contents"]]
                if delete_keys:
                    s3_client.delete_objects(
                        Bucket=S3_BUCKET_NAME, Delete={"Objects": delete_keys}
                    )
    except Exception as e:
        # Log but don't fail the deletion
        print(f"[WARN] S3 cleanup failed: {sanitize_error_message(e)}")

    return None


def _get_metadata_from_s3(dataset_id: str, file_type: str, user_id: str):
    """Load metadata JSON with ownership enforcement and error sanitization."""
    dataset = get_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if dataset["user_id"] != user_id:
        # Return 404 to prevent enumeration
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Validate file_type to prevent path traversal in S3 key
    allowed_types = {"schema", "profile", "quality", "transform_log"}
    if file_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid metadata type")

    key = f"silver/datasets/{dataset_id}/{file_type}.json"
    try:
        response = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key=key)
        return json.loads(response["Body"].read().decode("utf-8"))
    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchKey":
            raise HTTPException(
                status_code=404, detail=f"{file_type} metadata not yet available"
            )
        # Sanitize AWS error before exposing
        raise HTTPException(status_code=500, detail="Failed to retrieve metadata")


@router.get("/{dataset_id}/schema")
def get_dataset_schema(dataset_id: str, user: dict = Depends(get_current_user)):
    return _get_metadata_from_s3(dataset_id, "schema", user["user_id"])


@router.get("/{dataset_id}/profile")
def get_dataset_profile(dataset_id: str, user: dict = Depends(get_current_user)):
    return _get_metadata_from_s3(dataset_id, "profile", user["user_id"])


@router.get("/{dataset_id}/quality")
def get_dataset_quality(dataset_id: str, user: dict = Depends(get_current_user)):
    return _get_metadata_from_s3(dataset_id, "quality", user["user_id"])


@router.get("/{dataset_id}/transform-log")
def get_dataset_transform_log(dataset_id: str, user: dict = Depends(get_current_user)):
    return _get_metadata_from_s3(dataset_id, "transform_log", user["user_id"])
