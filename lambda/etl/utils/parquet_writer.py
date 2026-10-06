import pandas as pd
import io
import boto3

s3_client = boto3.client('s3')

def write_parquet(df: pd.DataFrame, bucket: str, key: str):
    """Write DataFrame to S3 as Parquet."""
    out_buffer = io.BytesIO()
    df.to_parquet(out_buffer, index=False, engine='pyarrow')
    
    s3_client.put_object(
        Bucket=bucket,
        Key=key,
        Body=out_buffer.getvalue()
    )
