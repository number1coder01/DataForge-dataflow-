from pydantic import BaseModel, field_validator
from typing import Optional


class UploadUrlRequest(BaseModel):
    filename: str
    file_size: int

    @field_validator('filename')
    @classmethod
    def validate_filename(cls, v: str) -> str:
        from utils import validate_filename
        error = validate_filename(v)
        if error:
            raise ValueError(error)
        return v.strip()

    @field_validator('file_size')
    @classmethod
    def validate_size(cls, v: int) -> int:
        from utils import validate_file_size
        error = validate_file_size(v)
        if error:
            raise ValueError(error)
        return v


class UploadUrlResponse(BaseModel):
    upload_url: str
    dataset_id: str


class DatasetCreate(BaseModel):
    dataset_id: str
    filename: str

    @field_validator('dataset_id')
    @classmethod
    def validate_dataset_id(cls, v: str) -> str:
        import re
        # Must be a valid UUID format
        uuid_pattern = re.compile(
            r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
            re.IGNORECASE,
        )
        if not uuid_pattern.match(v):
            raise ValueError("Invalid dataset ID format")
        return v

    @field_validator('filename')
    @classmethod
    def validate_filename(cls, v: str) -> str:
        from utils import validate_filename
        error = validate_filename(v)
        if error:
            raise ValueError(error)
        return v.strip()


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
