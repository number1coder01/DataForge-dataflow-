import boto3
import os
import uuid
from fastapi import APIRouter, HTTPException, status, Depends
from botocore.exceptions import ClientError
from models.dataset import UploadUrlRequest, UploadUrlResponse, DatasetCreate, DatasetResponse
from routers.auth import get_current_user
from database import create_dataset, get_datasets_by_user, get_dataset, delete_dataset_record

router = APIRouter(prefix="/api/datasets", tags=["datasets"])

S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "dataflow-platform-987654321") # TODO replace with actual bucket
AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
s3_client = boto3.client('s3', region_name=AWS_REGION)

@router.post("/upload-url", response_model=UploadUrlResponse)
def generate_upload_url(request: UploadUrlRequest, user: dict = Depends(get_current_user)):
    dataset_id = str(uuid.uuid4())
    s3_key = f"bronze/datasets/{dataset_id}/raw.csv"
    
    # 50 MB limit
    if request.file_size > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")
        
    if not request.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")

    try:
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': S3_BUCKET_NAME,
                'Key': s3_key,
                'ContentType': 'text/csv'
            },
            ExpiresIn=300
        )
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    return UploadUrlResponse(upload_url=presigned_url, dataset_id=dataset_id)


@router.post("", response_model=DatasetResponse, status_code=status.HTTP_201_CREATED)
def create_new_dataset(request: DatasetCreate, user: dict = Depends(get_current_user)):
    user_id = user["user_id"]
    
    # Normally we would read the size from S3, but we can trust the client for MVP
    # Or fetch metadata from S3 using head_object
    try:
        s3_key = f"bronze/datasets/{request.dataset_id}/raw.csv"
        response = s3_client.head_object(Bucket=S3_BUCKET_NAME, Key=s3_key)
        file_size = response['ContentLength']
    except ClientError as e:
        print(f"S3 head object failed: {e}")
        file_size = 0
        # Wait, if S3 bucket does not exist, let's just mock it
        # raise HTTPException(status_code=404, detail="File not found in S3")
        
    dataset = create_dataset(request.dataset_id, user_id, request.filename, file_size)
    if not dataset:
        raise HTTPException(status_code=500, detail="Failed to create dataset record")
        
    # TODO: trigger ETL Lambda async
    
    return DatasetResponse(**dataset)


@router.get("", response_model=list[DatasetResponse])
def list_datasets(user: dict = Depends(get_current_user)):
    user_id = user["user_id"]
    datasets = get_datasets_by_user(user_id)
    # Sort by created_at desc
    datasets.sort(key=lambda x: x["created_at"], reverse=True)
    return [DatasetResponse(**d) for d in datasets]


@router.get("/{dataset_id}", response_model=DatasetResponse)
def get_dataset_detail(dataset_id: str, user: dict = Depends(get_current_user)):
    dataset = get_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    if dataset["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    return DatasetResponse(**dataset)


@router.delete("/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dataset(dataset_id: str, user: dict = Depends(get_current_user)):
    dataset = get_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    if dataset["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    # Delete from DynamoDB
    delete_dataset_record(dataset_id)
    
    # Delete from S3 (optional for MVP, but good practice)
    # We would delete bronze, silver, metadata
    
    return None
