from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UploadUrlRequest(BaseModel):
    filename: str
    file_size: int

class UploadUrlResponse(BaseModel):
    upload_url: str
    dataset_id: str

class DatasetCreate(BaseModel):
    dataset_id: str
    filename: str

class DatasetResponse(BaseModel):
    dataset_id: str
    user_id: str
    name: str
    status: str
    created_at: str
    updated_at: str
    file_size_bytes: Optional[int] = None
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    s3_bronze_key: Optional[str] = None
    s3_silver_key: Optional[str] = None
    athena_table: Optional[str] = None
    athena_database: Optional[str] = None
