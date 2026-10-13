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

JOBS_TABLE_NAME = os.getenv('JOBS_TABLE_NAME', 'dataflow-jobs')
try:
    jobs_table = dynamodb.Table(JOBS_TABLE_NAME)
except Exception:
    jobs_table = None

def get_iso_time():
    return datetime.utcnow().isoformat() + "Z"

def update_job_stage(job_id: str, stage_name: str, status: str, duration_ms: int = None, extra_data: dict = None):
    if not jobs_table: return
    
    stage_data = {
        "status": status,
        "updated_at": get_iso_time()
    }
    if duration_ms is not None:
        stage_data["duration_ms"] = duration_ms
    if extra_data:
        stage_data.update(extra_data)
        
    update_expr = "SET stages.#st = :sd, updated_at = :ua"
    expr_names = {"#st": stage_name}
    expr_vals = {":sd": stage_data, ":ua": get_iso_time()}
    
    try:
        jobs_table.update_item(
            Key={'job_id': job_id},
            UpdateExpression=update_expr,
            ExpressionAttributeNames=expr_names,
            ExpressionAttributeValues=expr_vals
        )
    except Exception as e:
        print(f"Error updating job stage {stage_name}: {e}")

def update_job_status(job_id: str, status: str, error_message: str = None):
    if not jobs_table: return
    update_expr = "SET #st = :st, updated_at = :ua"
    expr_names = {"#st": "status"}
    expr_vals = {":st": status, ":ua": get_iso_time()}
    
    if status in ["SUCCESS", "FAILED"]:
        update_expr += ", completed_at = :ca"
        expr_vals[":ca"] = get_iso_time()
        
    if error_message:
        update_expr += ", error_message = :err"
        expr_vals[":err"] = error_message

    try:
        jobs_table.update_item(
            Key={'job_id': job_id},
            UpdateExpression=update_expr,
            ExpressionAttributeNames=expr_names,
            ExpressionAttributeValues=expr_vals
        )
    except Exception as e:
        print(f"Error updating job status: {e}")

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

def run_etl_pipeline(bucket: str, raw_key: str, dataset_id: str, user_id: str = "unknown"):
    """Orchestrates the ETL pipeline for a given raw CSV file."""
    import uuid
    import time
    job_id = str(uuid.uuid4())
    
    print(f"[ORCHESTRATOR] Starting ETL pipeline. job_id={job_id}, dataset_id={dataset_id}, user_id={user_id}")
    print(f"[ORCHESTRATOR] JOBS_TABLE_NAME={JOBS_TABLE_NAME}, jobs_table={jobs_table}")
    
    if jobs_table:
        try:
            jobs_table.put_item(Item={
                "job_id": job_id,
                "dataset_id": dataset_id,
                "user_id": user_id,
                "status": "RUNNING",
                "created_at": get_iso_time(),
                "updated_at": get_iso_time(),
                "stages": {}
            })
            print(f"[ORCHESTRATOR] [OK] Job record created successfully: {job_id}")
        except Exception as e:
            print(f"[ORCHESTRATOR] [FAIL] Could not create job record: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
    else:
        print("[ORCHESTRATOR] [FAIL] jobs_table is None - cannot create job record!")

    try:
        update_dataset_status(dataset_id, "PROCESSING")
        
        # 1. Load Data
        print(f"Loading data from s3://{bucket}/{raw_key}")
        t0 = time.time()
        response = s3_client.get_object(Bucket=bucket, Key=raw_key)
        raw_bytes = response['Body'].read()
        
        # Try multiple encodings — many real-world CSVs are not UTF-8
        encodings_to_try = ['utf-8', 'utf-8-sig', 'euc-kr', 'cp949', 'latin-1']
        df = None
        used_encoding = None
        for enc in encodings_to_try:
            try:
                df = pd.read_csv(io.BytesIO(raw_bytes), encoding=enc)
                used_encoding = enc
                print(f"[ORCHESTRATOR] CSV decoded successfully with encoding: {enc}")
                break
            except (UnicodeDecodeError, UnicodeError):
                print(f"[ORCHESTRATOR] Encoding {enc} failed, trying next...")
                continue
        
        if df is None:
            # Final fallback: force UTF-8 with replacement characters
            df = pd.read_csv(io.BytesIO(raw_bytes), encoding='utf-8', errors='replace')
            used_encoding = 'utf-8 (with replacements)'
            print(f"[ORCHESTRATOR] Used fallback encoding: {used_encoding}")
        
        update_job_stage(job_id, "load_data", "SUCCESS", int((time.time()-t0)*1000), {"encoding": used_encoding})
        
        # 2. Schema Detection
        print("Detecting schema...")
        t0 = time.time()
        schema = detect_schema(df)
        update_job_stage(job_id, "schema_detection", "SUCCESS", int((time.time()-t0)*1000), {"columns": len(schema.get("columns", []))})
        
        # 3. Quality Checks
        print("Running quality checks...")
        t0 = time.time()
        quality = run_quality_checks(df, schema)
        update_job_stage(job_id, "quality_check", "SUCCESS", int((time.time()-t0)*1000))
        
        # 4. Transform
        print("Applying transformations...")
        t0 = time.time()
        df_clean, transform_log = transform(df, schema)
        update_job_stage(job_id, "transformation", "SUCCESS", int((time.time()-t0)*1000), {"rows_before": len(df), "rows_after": len(df_clean)})
        
        # 5. Data Profiling
        print("Generating profile...")
        t0 = time.time()
        profile = generate_profile(df_clean, schema)
        update_job_stage(job_id, "data_profiling", "SUCCESS", int((time.time()-t0)*1000), {"row_count": len(df_clean)})
        
        # 6. Write Data & Metadata
        print("Writing to S3...")
        t0 = time.time()
        silver_prefix = f"silver/datasets/{dataset_id}"
        parquet_key = f"{silver_prefix}/data.parquet"
        
        write_parquet(df_clean, bucket, parquet_key)
        write_metadata(schema, bucket, f"{silver_prefix}/schema.json")
        write_metadata(profile, bucket, f"{silver_prefix}/profile.json")
        write_metadata(quality, bucket, f"{silver_prefix}/quality.json")
        write_metadata(transform_log, bucket, f"{silver_prefix}/transform_log.json")
        update_job_stage(job_id, "parquet_conversion", "SUCCESS", int((time.time()-t0)*1000))
        
        # 7. Register in Glue
        print("Registering with Glue catalog...")
        t0 = time.time()
        database_name = "dataflow_silver"
        table_name = f"dataset_{dataset_id.replace('-', '_')}"
        s3_path = f"s3://{bucket}/{silver_prefix}/"
        register_table(database_name, table_name, schema, s3_path)
        update_job_stage(job_id, "catalog_registration", "SUCCESS", int((time.time()-t0)*1000), {"table_name": table_name})
        
        # 8. Update DynamoDB
        update_dataset_status(dataset_id, "READY", {
            "s3_silver_key": parquet_key,
            "row_count": len(df_clean),
            "column_count": len(df_clean.columns),
            "athena_database": database_name,
            "athena_table": table_name
        })
        
        update_job_status(job_id, "SUCCESS")
        
        print("ETL pipeline completed successfully.")
        return True
        
    except Exception as e:
        print(f"ETL pipeline failed: {e}")
        update_dataset_status(dataset_id, "FAILED")
        update_job_status(job_id, "FAILED", str(e))
        raise e
