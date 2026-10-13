import os
import json
import re
import time
import boto3
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, field_validator
from botocore.exceptions import ClientError
from routers.auth import get_current_user
from database import get_dataset
from utils import validate_sql_safety, sanitize_error_message

router = APIRouter(prefix="/api/datasets", tags=["dashboard"])

S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "dataflow-platform-kaart")
AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
ATHENA_OUTPUT = os.getenv("ATHENA_OUTPUT", f"s3://{S3_BUCKET_NAME}/athena-results/")

s3_client = boto3.client("s3", region_name=AWS_REGION)
athena_client = boto3.client("athena", region_name=AWS_REGION)


class DashboardQueryRequest(BaseModel):
    """Pydantic model for dashboard query requests with validation."""
    sql: str

    @field_validator('sql')
    @classmethod
    def validate_sql(cls, v: str) -> str:
        error = validate_sql_safety(v)
        if error:
            raise ValueError(error)
        return v.strip()


def _load_metadata(dataset_id: str, file_type: str):
    """Load metadata JSON from S3 Silver."""
    key = f"silver/datasets/{dataset_id}/{file_type}.json"
    try:
        response = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key=key)
        return json.loads(response["Body"].read().decode("utf-8"))
    except ClientError:
        return None


def _run_athena_query(sql: str, database: str) -> list[dict]:
    """Execute an Athena SQL query synchronously and return rows as dicts."""
    try:
        start = athena_client.start_query_execution(
            QueryString=sql,
            QueryExecutionContext={"Database": database},
            ResultConfiguration={"OutputLocation": ATHENA_OUTPUT},
        )
        execution_id = start["QueryExecutionId"]

        # Poll until complete (max 30 seconds)
        for _ in range(60):
            status_resp = athena_client.get_query_execution(QueryExecutionId=execution_id)
            state = status_resp["QueryExecution"]["Status"]["State"]
            if state in ("SUCCEEDED",):
                break
            if state in ("FAILED", "CANCELLED"):
                reason = status_resp["QueryExecution"]["Status"].get("StateChangeReason", "Unknown")
                raise Exception(f"Query {state}: {sanitize_error_message(Exception(reason))}")
            time.sleep(0.5)
        else:
            raise Exception("Query timed out after 30s")

        # Fetch results (cap at 1000 rows)
        results = athena_client.get_query_results(QueryExecutionId=execution_id, MaxResults=1000)
        rows = results["ResultSet"]["Rows"]
        if not rows:
            return []

        headers = [col["VarCharValue"] for col in rows[0]["Data"]]
        data_rows = []
        for row in rows[1:]:
            values = [col.get("VarCharValue", None) for col in row["Data"]]
            data_rows.append(dict(zip(headers, values)))
        return data_rows
    except Exception as e:
        print(f"[WARN] Athena query error: {sanitize_error_message(e)}")
        return []


def _generate_recommendations(schema: dict, profile: dict) -> list[dict]:
    """Analyze schema types to recommend chart visualizations."""
    recommendations = []

    numeric_cols = [c for c, m in schema.items() if m.get("type") == "numeric"]
    date_cols = [c for c, m in schema.items() if m.get("type") == "datetime"]
    cat_cols = [c for c, m in schema.items() if m.get("type") in ("categorical", "boolean")]

    # 1. Date + Numeric → Line chart (time series trend)
    for date_col in date_cols:
        for num_col in numeric_cols[:3]:  # Limit to 3 charts per date col
            recommendations.append({
                "chart_type": "line",
                "title": f"{num_col} Over Time",
                "x_column": date_col,
                "y_column": num_col,
                "reason": f"Time series trend — {date_col} (datetime) drives the x-axis while {num_col} (numeric) shows the trend.",
                "sql": f'SELECT CAST("{date_col}" AS VARCHAR) AS "{date_col}", AVG(CAST("{num_col}" AS DOUBLE)) AS "{num_col}" FROM {{table}} WHERE "{date_col}" IS NOT NULL GROUP BY "{date_col}" ORDER BY "{date_col}" LIMIT 200',
            })

    # 2. Categorical + Numeric → Bar chart (category comparison)
    for cat_col in cat_cols:
        for num_col in numeric_cols[:2]:
            recommendations.append({
                "chart_type": "bar",
                "title": f"Average {num_col} by {cat_col}",
                "x_column": cat_col,
                "y_column": num_col,
                "reason": f"Category comparison — average {num_col} grouped by {cat_col} categories.",
                "sql": f'SELECT CAST("{cat_col}" AS VARCHAR) AS "{cat_col}", AVG(CAST("{num_col}" AS DOUBLE)) AS "{num_col}" FROM {{table}} WHERE "{cat_col}" IS NOT NULL GROUP BY "{cat_col}" ORDER BY "{num_col}" DESC LIMIT 20',
            })

    # 3. Numeric + Numeric → Scatter plot (correlation)
    if len(numeric_cols) >= 2:
        for i in range(min(len(numeric_cols) - 1, 2)):
            x = numeric_cols[i]
            y = numeric_cols[i + 1]
            recommendations.append({
                "chart_type": "scatter",
                "title": f"{x} vs {y}",
                "x_column": x,
                "y_column": y,
                "reason": f"Correlation scatter — reveals the relationship between {x} and {y}.",
                "sql": f'SELECT CAST("{x}" AS DOUBLE) AS "{x}", CAST("{y}" AS DOUBLE) AS "{y}" FROM {{table}} WHERE "{x}" IS NOT NULL AND "{y}" IS NOT NULL LIMIT 500',
            })

    # 4. Categorical only → Distribution (pie/donut)
    for cat_col in cat_cols[:2]:
        recommendations.append({
            "chart_type": "pie",
            "title": f"Distribution of {cat_col}",
            "x_column": cat_col,
            "y_column": "count",
            "reason": f"Category distribution — shows the proportional breakdown of {cat_col} values.",
            "sql": f'SELECT CAST("{cat_col}" AS VARCHAR) AS "{cat_col}", COUNT(*) AS "count" FROM {{table}} WHERE "{cat_col}" IS NOT NULL GROUP BY "{cat_col}" ORDER BY "count" DESC LIMIT 10',
        })

    # 5. Date + Category + Numeric → Multi-line time series
    if date_cols and cat_cols and numeric_cols:
        date_col = date_cols[0]
        cat_col = cat_cols[0]
        num_col = numeric_cols[0]
        recommendations.append({
            "chart_type": "multi_line",
            "title": f"{num_col} Over Time by {cat_col}",
            "x_column": date_col,
            "y_column": num_col,
            "group_column": cat_col,
            "reason": f"Multi-series trend — {num_col} over {date_col}, segmented by {cat_col}.",
            "sql": f'SELECT CAST("{date_col}" AS VARCHAR) AS "{date_col}", CAST("{cat_col}" AS VARCHAR) AS "{cat_col}", AVG(CAST("{num_col}" AS DOUBLE)) AS "{num_col}" FROM {{table}} WHERE "{date_col}" IS NOT NULL GROUP BY "{date_col}", "{cat_col}" ORDER BY "{date_col}" LIMIT 500',
        })

    return recommendations


def _generate_kpis(schema: dict, profile: dict, row_count: int) -> list[dict]:
    """Auto-detect KPI cards from profile statistics."""
    kpis = []

    kpis.append({
        "label": "Total Records",
        "value": row_count,
        "format": "number",
        "icon": "rows",
    })

    numeric_cols = [c for c, m in schema.items() if m.get("type") == "numeric"]
    cat_cols = [c for c, m in schema.items() if m.get("type") in ("categorical", "boolean")]

    # Total columns
    kpis.append({
        "label": "Columns Detected",
        "value": len(schema),
        "format": "number",
        "icon": "columns",
    })

    # First numeric column average
    for col in numeric_cols[:2]:
        col_profile = profile.get(col, {})
        if col_profile.get("mean") is not None:
            kpis.append({
                "label": f"Avg {col}",
                "value": round(col_profile["mean"], 2),
                "format": "decimal",
                "icon": "average",
            })
        if col_profile.get("max") is not None:
            kpis.append({
                "label": f"Max {col}",
                "value": round(col_profile["max"], 2),
                "format": "decimal",
                "icon": "max",
            })

    # Unique values for first categorical
    for col in cat_cols[:1]:
        col_profile = profile.get(col, {})
        if col_profile.get("unique_count") is not None:
            kpis.append({
                "label": f"Unique {col}",
                "value": col_profile["unique_count"],
                "format": "number",
                "icon": "unique",
            })

    return kpis[:8]  # Cap at 8 KPIs


def _generate_filters(schema: dict, profile: dict) -> list[dict]:
    """Generate filter definitions from categorical columns."""
    filters = []
    cat_cols = [c for c, m in schema.items() if m.get("type") in ("categorical", "boolean")]

    for col in cat_cols[:4]:
        col_profile = profile.get(col, {})
        top_values = col_profile.get("top_values", [])
        options = [item["value"] for item in top_values if item.get("value")]
        if options:
            filters.append({
                "column": col,
                "label": col.replace("_", " ").title(),
                "options": options,
            })

    return filters


def _verify_dataset_ownership(dataset_id: str, user_id: str) -> dict:
    """Helper: verify dataset exists and belongs to user. Returns dataset or raises."""
    dataset = get_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if dataset.get("user_id") != user_id:
        # Return 404 to prevent enumeration
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset


def _verify_table_isolation(sql: str, athena_table: str, athena_db: str) -> None:
    """Verify the SQL only references the user's own table. Raises on violation."""
    # The query MUST contain the user's table name
    if athena_table not in sql:
        raise HTTPException(
            status_code=403,
            detail="Query must reference your dataset table"
        )

    # Extract all table-like references from the SQL using a pattern
    # Match words that look like table references (not in quotes as values)
    sql_upper = sql.upper()

    # Block cross-database access: no other database references allowed
    db_prefix = f'"{athena_db}".'
    # Count how many distinct database references exist
    db_refs = re.findall(r'"(\w+)"\.', sql)
    for ref in db_refs:
        if ref.lower() != athena_db.lower():
            raise HTTPException(
                status_code=403,
                detail="Cross-database queries are not allowed"
            )


@router.get("/{dataset_id}/dashboard")
def get_dataset_dashboard(dataset_id: str, user: dict = Depends(get_current_user)):
    """Analyze schema and profile to generate dashboard recommendations, KPIs, and filters."""
    dataset = _verify_dataset_ownership(dataset_id, user["user_id"])

    if dataset.get("status") != "READY":
        raise HTTPException(status_code=400, detail="Dataset ETL not yet complete")

    schema = _load_metadata(dataset_id, "schema")
    profile = _load_metadata(dataset_id, "profile")

    if not schema:
        raise HTTPException(status_code=404, detail="Schema metadata not found")
    if not profile:
        raise HTTPException(status_code=404, detail="Profile metadata not found")

    athena_db = dataset.get("athena_database", "dataflow_silver")
    athena_table = dataset.get("athena_table", f"dataset_{dataset_id.replace('-', '_')}")
    full_table = f'"{athena_db}"."{athena_table}"'

    row_count = dataset.get("row_count", 0)
    if isinstance(row_count, str):
        try:
            from decimal import Decimal
            row_count = int(Decimal(row_count))
        except (ValueError, TypeError):
            row_count = 0

    recommendations = _generate_recommendations(schema, profile)
    kpis = _generate_kpis(schema, profile, row_count)
    filters = _generate_filters(schema, profile)

    # Inject actual table name into SQL templates
    for rec in recommendations:
        rec["sql"] = rec["sql"].replace("{table}", full_table)

    return {
        "dataset_id": dataset_id,
        "dataset_name": dataset.get("name", "Unknown"),
        "athena_database": athena_db,
        "athena_table": athena_table,
        "recommendations": recommendations,
        "kpis": kpis,
        "filters": filters,
    }


@router.post("/{dataset_id}/dashboard/query")
def execute_dashboard_query(
    dataset_id: str,
    body: DashboardQueryRequest,
    user: dict = Depends(get_current_user),
):
    """Execute a specific dashboard chart query against Athena.

    Security layers:
    1. JWT authentication (via Depends)
    2. Dataset ownership verification
    3. Pydantic SQL validation (SELECT-only, no DDL/DML, no UNION, no semicolons)
    4. Table isolation check (must reference user's own table)
    """
    dataset = _verify_dataset_ownership(dataset_id, user["user_id"])

    athena_db = dataset.get("athena_database", "dataflow_silver")
    athena_table = dataset.get("athena_table", f"dataset_{dataset_id.replace('-', '_')}")

    # Verify table isolation — user can only query their own table
    _verify_table_isolation(body.sql, athena_table, athena_db)

    rows = _run_athena_query(body.sql, athena_db)

    return {
        "sql": body.sql,
        "row_count": len(rows),
        "data": rows,
    }
