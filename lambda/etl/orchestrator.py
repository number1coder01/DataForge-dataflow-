import os
import io
import boto3
import pandas as pd
from datetime import datetime

from modules.schema_detector import detect_schema
from modules.data_profiler import generate_profile
from modules.quality_engine import run_quality_checks
from modules.transform_engine import transform
from utils.parquet_writer import write_parquet
from utils.metadata_writer import write_metadata
from utils.catalog_registrar import register_table

s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb', region_name=os.getenv('AWS_REGION', 'ap-south-1'))

DATASETS_TABLE_NAME = os.getenv('DATASETS_TABLE_NAME', 'dataflow-datasets')
try:
    datasets_table = dynamodb.Table(DATASETS_TABLE_NAME)
except Exception:
    datasets_table = None

def update_dataset_status(dataset_id: str, status: str, updates: dict = None):
    if not datasets_table: return
    
    update_expr = "SET #st = :st, updated_at = :ua"
    expr_names = {"#st": "status"}
    expr_vals = {":st": status, ":ua": datetime.utcnow().isoformat() + "Z"}
    
    if updates:
        for k, v in updates.items():
            update_expr += f", {k} = :{k}"
            expr_vals[f":{k}"] = v
            
    try:
        datasets_table.update_item(
            Key={'dataset_id': dataset_id},
            UpdateExpression=update_expr,
            ExpressionAttributeNames=expr_names,
            ExpressionAttributeValues=expr_vals
        )
    except Exception as e:
        print(f"Error updating dataset status: {e}")

def run_etl_pipeline(bucket: str, raw_key: str, dataset_id: str):
    """Orchestrates the ETL pipeline for a given raw CSV file."""
    try:
        update_dataset_status(dataset_id, "PROCESSING")
        
        # 1. Load Data
        print(f"Loading data from s3://{bucket}/{raw_key}")
        response = s3_client.get_object(Bucket=bucket, Key=raw_key)
        df = pd.read_csv(io.BytesIO(response['Body'].read()))
        
        # 2. Schema Detection
        print("Detecting schema...")
        schema = detect_schema(df)
        
        # 3. Quality Checks
        print("Running quality checks...")
        quality = run_quality_checks(df, schema)
        
        # 4. Transform
        print("Applying transformations...")
        df_clean, transform_log = transform(df, schema)
        
        # 5. Data Profiling
        print("Generating profile...")
        profile = generate_profile(df_clean, schema)
        
        # 6. Write Data & Metadata
        print("Writing to S3...")
        silver_prefix = f"silver/datasets/{dataset_id}"
        parquet_key = f"{silver_prefix}/data.parquet"
        
        write_parquet(df_clean, bucket, parquet_key)
        write_metadata(schema, bucket, f"{silver_prefix}/schema.json")
        write_metadata(profile, bucket, f"{silver_prefix}/profile.json")
        write_metadata(quality, bucket, f"{silver_prefix}/quality.json")
        write_metadata(transform_log, bucket, f"{silver_prefix}/transform_log.json")
        
        # 7. Register in Glue
        print("Registering with Glue catalog...")
        database_name = "dataflow_silver"
        table_name = f"dataset_{dataset_id.replace('-', '_')}"
        s3_path = f"s3://{bucket}/{silver_prefix}/"
        register_table(database_name, table_name, schema, s3_path)
        
        # 8. Update DynamoDB
        update_dataset_status(dataset_id, "READY", {
            "s3_silver_key": parquet_key,
            "row_count": len(df_clean),
            "column_count": len(df_clean.columns),
            "athena_database": database_name,
            "athena_table": table_name
        })
        
        print("ETL pipeline completed successfully.")
        return True
        
    except Exception as e:
        print(f"ETL pipeline failed: {e}")
        update_dataset_status(dataset_id, "FAILED")
        raise e
