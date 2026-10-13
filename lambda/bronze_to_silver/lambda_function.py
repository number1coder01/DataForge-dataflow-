"""
===============================================================================
LAMBDA 1: BRONZE → SILVER
===============================================================================
University Placement Pipeline — Data Cleaning & Transformation

Trigger:  S3 PUT event on bronze/placement_data/ OR manual invocation
Runtime:  Python 3.12 + AWS SDK for Pandas Layer
Memory:   512 MB
Timeout:  180 seconds (3 minutes)

What it does:
  1. Reads ALL CSV files from bronze/placement_data/
  2. Handles schema variations (renamed cols, missing cols, extra cols)
  3. Cleans data (nulls, duplicates, case, whitespace, typos, ranges)
  4. Engineers features (placement_readiness_score)
  5. Computes data quality metrics → gold/data_quality/
  6. Tracks processed files → bronze/metadata/processed_files.json
  7. Writes clean Parquet partitioned by year → silver/placement_data/

Cost: $0.00 (< 5 invocations, < 60s each, 512MB)
===============================================================================
"""

import json
import boto3
import io
import logging
from datetime import datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ─── Configuration ───────────────────────────────────────────────────────────

BUCKET = 'kaartik-placement-pipeline-dev'
BRONZE_PREFIX = 'bronze/placement_data/'
SILVER_PREFIX = 'silver/placement_data/'
GOLD_PREFIX = 'gold/'
METADATA_KEY = 'bronze/metadata/processed_files.json'

# Standard column schema (our target)
STANDARD_COLUMNS = [
    'student_id', 'year', 'month', 'tenth_percentage', 'twelfth_percentage',
    'cgpa', 'branch', 'dsa_rating', 'problems_solved', 'contest_count',
    'internships', 'internship_type', 'projects', 'project_level',
    'primary_domain', 'tech_stack', 'skill_count', 'mock_interviews',
    'weekly_study_hours', 'placed', 'package_lpa'
]

# Column rename mapping (handles schema variant 3)
COLUMN_RENAME_MAP = {
    'sid': 'student_id',
    'gpa': 'cgpa',
    'tenth_pct': 'tenth_percentage',
    'twelfth_pct': 'twelfth_percentage',
    'study_hrs': 'weekly_study_hours',
    'mock_intv': 'mock_interviews',
    'probs_solved': 'problems_solved',
    'contests': 'contest_count',
    'skills': 'skill_count',
    'salary_lpa': 'package_lpa'
}

# ─── Standardization Maps ────────────────────────────────────────────────────

BRANCH_STANDARDIZE = {
    'cse': 'CSE', 'c.s.e': 'CSE', 'computer science': 'CSE',
    'it': 'IT', 'i.t': 'IT', 'info tech': 'IT',
    'ece': 'ECE', 'e.c.e': 'ECE',
    'me': 'ME', 'mech': 'ME',
    'eee': 'EEE', 'e.e.e': 'EEE',
    'ce': 'CE', 'civil': 'CE',
}

TECH_STANDARDIZE = {
    'python': 'Python', 'PYTHON': 'Python',
    'react': 'React', 'REACT': 'React',
    'node': 'Node', 'NODE': 'Node', 'nodejs': 'Node', 'node.js': 'Node',
    'javascript': 'JavaScript', 'JAVASCRIPT': 'JavaScript', 'js': 'JavaScript',
    'tensorflow': 'TensorFlow', 'TENSORFLOW': 'TensorFlow', 'tensor_flow': 'TensorFlow',
    'c++': 'C++', 'cpp': 'C++', 'CPP': 'C++',
    'java': 'Java', 'JAVA': 'Java',
    'rust': 'Rust', 'RUST': 'Rust',
    'r': 'R',
}

INTERNSHIP_STANDARDIZE = {
    'no internship': 'No Internship', 'no_internship': 'No Internship',
    'none': 'No Internship', 'n/a': 'No Internship', 'na': 'No Internship',
    '-': 'No Internship',
    'mnc': 'MNC', 'm.n.c': 'MNC', 'multi national': 'MNC',
    'startup': 'Startup', 'start-up': 'Startup', 'start up': 'Startup',
}

PROJECT_LEVEL_STANDARDIZE = {
    'basic': 'Basic', 'BASIC': 'Basic', 'basci': 'Basic',
    'intermediate': 'Intermediate', 'INTERMEDIATE': 'Intermediate',
    'intermdiate': 'Intermediate', 'inter': 'Intermediate',
    'advanced': 'Advanced', 'ADVANCED': 'Advanced', 'advnaced': 'Advanced',
    'adv': 'Advanced',
}

DOMAIN_STANDARDIZE = {
    'ai/ml': 'AI/ML', 'ai_ml': 'AI/ML', 'aiml': 'AI/ML',
    'machine learning': 'AI/ML', 'artificial intelligence': 'AI/ML',
    'web dev': 'Web Dev', 'web development': 'Web Dev',
    'webdev': 'Web Dev', 'web_dev': 'Web Dev',
    'data science': 'Data Science', 'datascience': 'Data Science',
    'data_science': 'Data Science', 'ds': 'Data Science',
    'systems': 'Systems', 'system': 'Systems', 'sys': 'Systems',
    'core': 'Core', 'CORE': 'Core', 'core eng': 'Core',
    'no domain': 'No Domain', 'none': 'No Domain',
    'n/a': 'No Domain', '-': 'No Domain', 'undecided': 'No Domain',
}

PLACED_TRUE_VALUES = {'1', '1.0', 'yes', 'true'}
PLACED_FALSE_VALUES = {'0', '0.0', 'no', 'false'}


def lambda_handler(event, context):
    """Main Lambda handler"""
    import pandas as pd
    import pyarrow as pa
    import pyarrow.parquet as pq

    s3 = boto3.client('s3')
    start_time = datetime.utcnow()
    logger.info(f"=== Bronze → Silver ETL started at {start_time.isoformat()} ===")

    # ── Step 1: Get list of files & check for incremental processing ──
    processed_files = _load_processed_metadata(s3)
    csv_files = _list_bronze_csvs(s3)

    new_files = [f for f in csv_files if f not in processed_files]
    if not new_files:
        logger.info("No new files to process. Exiting.")
        return {'statusCode': 200, 'body': 'No new files to process.'}

    logger.info(f"Found {len(new_files)} new file(s) to process: {new_files}")

    # ── Step 2: Read & merge all new CSV files ──
    dfs = []
    file_schemas = {}
    for file_key in new_files:
        df, schema_info = _read_and_normalize_schema(s3, file_key)
        dfs.append(df)
        file_schemas[file_key] = schema_info
        logger.info(f"  Read {file_key}: {len(df)} rows, schema: {schema_info['type']}")

    raw_df = pd.concat(dfs, ignore_index=True)
    raw_row_count = len(raw_df)
    logger.info(f"Total raw rows after merge: {raw_row_count}")

    # ── Step 3: Data Quality — BEFORE cleaning ──
    quality_before = _compute_quality_metrics(raw_df, stage='before_cleaning')

    # ── Step 4: Clean the data ──
    df = _clean_data(raw_df)
    clean_row_count = len(df)

    # ── Step 5: Feature Engineering ──
    df = _engineer_features(df)

    # ── Step 6: Data Quality — AFTER cleaning ──
    quality_after = _compute_quality_metrics(df, stage='after_cleaning')

    # ── Step 7: Write quality report to Gold ──
    quality_report = {
        'run_timestamp': start_time.isoformat(),
        'files_processed': new_files,
        'raw_rows': raw_row_count,
        'clean_rows': clean_row_count,
        'rows_removed': raw_row_count - clean_row_count,
        'removal_rate_pct': round(100 * (raw_row_count - clean_row_count) / raw_row_count, 2),
        'file_schemas': file_schemas,
        'quality_before': quality_before,
        'quality_after': quality_after
    }
    _write_quality_report(s3, quality_report)

    # Also write quality metrics as Parquet for Athena
    _write_quality_parquet(s3, quality_before, quality_after, pd)

    # ── Step 8: Write Parquet partitioned by year ──
    years_written = _write_silver_parquet(s3, df, pd, pa, pq)

    # ── Step 9: Update processed files metadata ──
    processed_files.extend(new_files)
    _save_processed_metadata(s3, processed_files)

    duration = (datetime.utcnow() - start_time).total_seconds()
    result = {
        'statusCode': 200,
        'body': {
            'files_processed': len(new_files),
            'raw_rows': raw_row_count,
            'clean_rows': clean_row_count,
            'rows_removed': raw_row_count - clean_row_count,
            'years_written': years_written,
            'duration_seconds': round(duration, 2),
            'quality_summary': {
                'null_pct_before': quality_before['overall_null_pct'],
                'null_pct_after': quality_after['overall_null_pct'],
                'duplicate_pct_before': quality_before['duplicate_pct'],
                'duplicate_pct_after': quality_after['duplicate_pct'],
            }
        }
    }
    logger.info(f"=== ETL completed in {duration:.2f}s === Result: {json.dumps(result)}")
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def _list_bronze_csvs(s3):
    """List all CSV files in bronze/placement_data/"""
    response = s3.list_objects_v2(Bucket=BUCKET, Prefix=BRONZE_PREFIX)
    files = []
    for obj in response.get('Contents', []):
        key = obj['Key']
        if key.endswith('.csv'):
            files.append(key)
    return files


def _load_processed_metadata(s3):
    """Load list of already-processed files from metadata JSON"""
    try:
        response = s3.get_object(Bucket=BUCKET, Key=METADATA_KEY)
        data = json.loads(response['Body'].read().decode('utf-8'))
        return data.get('processed_files', [])
    except s3.exceptions.NoSuchKey:
        return []
    except Exception:
        return []


def _save_processed_metadata(s3, processed_files):
    """Save processed files list to S3 metadata"""
    data = {
        'processed_files': processed_files,
        'last_updated': datetime.utcnow().isoformat()
    }
    s3.put_object(
        Bucket=BUCKET,
        Key=METADATA_KEY,
        Body=json.dumps(data, indent=2),
        ContentType='application/json'
    )
    logger.info(f"Updated processed metadata: {len(processed_files)} files tracked")


def _read_and_normalize_schema(s3, file_key):
    """Read a CSV and normalize its schema to match STANDARD_COLUMNS"""
    import pandas as pd

    response = s3.get_object(Bucket=BUCKET, Key=file_key)
    df = pd.read_csv(io.BytesIO(response['Body'].read()), dtype=str)

    original_cols = list(df.columns)
    schema_type = 'standard'

    # Step 1: Rename known column aliases
    renamed = {}
    for old_name, new_name in COLUMN_RENAME_MAP.items():
        if old_name in df.columns:
            renamed[old_name] = new_name
            schema_type = 'renamed'
    if renamed:
        df = df.rename(columns=renamed)

    # Step 2: Drop extra columns not in standard schema
    extra_cols = [c for c in df.columns if c not in STANDARD_COLUMNS]
    if extra_cols:
        df = df.drop(columns=extra_cols)
        schema_type = 'extra_columns' if schema_type == 'standard' else schema_type

    # Step 3: Add missing columns with NaN
    missing_cols = [c for c in STANDARD_COLUMNS if c not in df.columns]
    if missing_cols:
        for col in missing_cols:
            df[col] = None
        schema_type = 'missing_columns' if schema_type == 'standard' else f"{schema_type}+missing"

    # Step 4: Reorder to standard
    df = df[STANDARD_COLUMNS]

    schema_info = {
        'type': schema_type,
        'original_columns': original_cols,
        'renamed': renamed if renamed else None,
        'extra_dropped': extra_cols if extra_cols else None,
        'missing_added': missing_cols if missing_cols else None,
        'row_count': len(df)
    }

    return df, schema_info


def _clean_data(df):
    """Master cleaning function — applies all cleaning steps in order"""
    import pandas as pd
    import numpy as np

    logger.info("Starting data cleaning pipeline...")

    # ── 1. Strip whitespace from ALL string columns ──
    for col in df.columns:
        if df[col].dtype == object:
            df[col] = df[col].str.strip()

    # ── 2. Convert numeric columns ──
    numeric_cols = {
        'student_id': 'Int64', 'year': 'Int64', 'month': 'Int64',
        'tenth_percentage': 'float64', 'twelfth_percentage': 'float64',
        'cgpa': 'float64', 'dsa_rating': 'Int64',
        'problems_solved': 'Int64', 'contest_count': 'Int64',
        'internships': 'Int64', 'projects': 'Int64',
        'skill_count': 'Int64', 'mock_interviews': 'Int64',
        'weekly_study_hours': 'Int64', 'package_lpa': 'float64'
    }
    for col, dtype in numeric_cols.items():
        df[col] = pd.to_numeric(df[col], errors='coerce')
        if dtype == 'Int64':
            df[col] = df[col].astype('Int64')

    # ── 3. Standardize 'placed' column (Yes/No/TRUE/FALSE → 0/1) ──
    def normalize_placed(val):
        if pd.isna(val):
            return pd.NA
        s = str(val).strip().lower()
        if s in PLACED_TRUE_VALUES:
            return 1
        elif s in PLACED_FALSE_VALUES:
            return 0
        else:
            return pd.NA

    df['placed'] = df['placed'].apply(normalize_placed).astype('Int64')

    # ── 4. Standardize categorical columns ──
    df['branch'] = df['branch'].apply(
        lambda x: _standardize_value(x, BRANCH_STANDARDIZE, valid={'CSE','IT','ECE','ME','EEE','CE'})
    )
    df['tech_stack'] = df['tech_stack'].apply(
        lambda x: _standardize_value(x, TECH_STANDARDIZE,
                                     valid={'Python','React','Node','JavaScript','TensorFlow','C++','Java','Rust','R','No Skill'})
    )
    df['internship_type'] = df['internship_type'].apply(
        lambda x: _standardize_value(x, INTERNSHIP_STANDARDIZE,
                                     valid={'No Internship','MNC','Startup'})
    )
    df['project_level'] = df['project_level'].apply(
        lambda x: _standardize_value(x, PROJECT_LEVEL_STANDARDIZE,
                                     valid={'Basic','Intermediate','Advanced'})
    )
    df['primary_domain'] = df['primary_domain'].apply(
        lambda x: _standardize_value(x, DOMAIN_STANDARDIZE,
                                     valid={'AI/ML','Web Dev','Data Science','Systems','Core','No Domain'})
    )

    # ── 5. Range validation — clamp or nullify invalid values ──
    # CGPA: valid 0-10
    df.loc[df['cgpa'] > 10, 'cgpa'] = pd.NA
    df.loc[df['cgpa'] < 0, 'cgpa'] = pd.NA

    # Percentages: valid 0-100
    df.loc[df['tenth_percentage'] > 100, 'tenth_percentage'] = pd.NA
    df.loc[df['tenth_percentage'] < 0, 'tenth_percentage'] = pd.NA
    df.loc[df['twelfth_percentage'] > 100, 'twelfth_percentage'] = pd.NA
    df.loc[df['twelfth_percentage'] < 0, 'twelfth_percentage'] = pd.NA

    # DSA rating: valid 0-3000
    df.loc[df['dsa_rating'] < 0, 'dsa_rating'] = pd.NA

    # Study hours: valid 0-80
    df.loc[df['weekly_study_hours'] < 0, 'weekly_study_hours'] = pd.NA
    df.loc[df['weekly_study_hours'] > 80, 'weekly_study_hours'] = pd.NA

    # Year: valid 2020-2030
    df.loc[(df['year'] < 2020) | (df['year'] > 2030), 'year'] = pd.NA

    # Month: valid 1-12
    df.loc[(df['month'] < 1) | (df['month'] > 12), 'month'] = pd.NA

    # ── 6. Impute critical nulls ──
    # CGPA: fill with median by branch
    for branch in df['branch'].dropna().unique():
        mask = (df['branch'] == branch) & (df['cgpa'].isna())
        median_val = df.loc[df['branch'] == branch, 'cgpa'].median()
        if pd.notna(median_val):
            df.loc[mask, 'cgpa'] = round(median_val, 2)

    # DSA rating: fill with median
    median_dsa = df['dsa_rating'].median()
    df['dsa_rating'] = df['dsa_rating'].fillna(int(median_dsa) if pd.notna(median_dsa) else 1200)

    # Package: if placed=0, package should be 0.0
    df.loc[df['placed'] == 0, 'package_lpa'] = 0.0

    # Package: if placed=1 but package is null, fill with median of placed students
    median_pkg = df.loc[df['placed'] == 1, 'package_lpa'].median()
    df.loc[(df['placed'] == 1) & (df['package_lpa'].isna()), 'package_lpa'] = median_pkg

    # ── 7. Remove duplicates (keep first occurrence by student_id) ──
    before_dedup = len(df)
    df = df.drop_duplicates(subset=['student_id'], keep='first')
    logger.info(f"Removed {before_dedup - len(df)} duplicate rows")

    # ── 8. Drop rows with null student_id or year (can't partition without year) ──
    df = df.dropna(subset=['student_id', 'year'])
    df['year'] = df['year'].astype(int)
    df['student_id'] = df['student_id'].astype(int)

    logger.info(f"Cleaning complete: {len(df)} rows remaining")
    return df


def _standardize_value(val, mapping, valid):
    """Standardize a categorical value using the mapping dict"""
    import pandas as pd
    if pd.isna(val):
        return None
    val_stripped = str(val).strip()
    val_lower = val_stripped.lower()

    # Direct match with valid values (case-sensitive)
    if val_stripped in valid:
        return val_stripped

    # Lookup in mapping
    if val_lower in mapping:
        return mapping[val_lower]

    # Fuzzy: check if any valid value is contained
    for v in valid:
        if v.lower() == val_lower:
            return v

    return None  # Unknown → null (will be handled later)


def _engineer_features(df):
    """Create derived features for analytics"""
    import pandas as pd
    import numpy as np

    logger.info("Engineering features...")

    # ── placement_readiness_score (0-100 composite score) ──
    # Weighted combination of normalized factors:
    #   CGPA (25%) + DSA (20%) + Internships (20%) + Projects (15%) + Skills (10%) + Contests (10%)

    def safe_normalize(series, min_val=None, max_val=None):
        """Min-max normalize a series to 0-1"""
        mn = min_val if min_val is not None else series.min()
        mx = max_val if max_val is not None else series.max()
        if mx == mn:
            return pd.Series(0.5, index=series.index)
        return ((series - mn) / (mx - mn)).clip(0, 1)

    # Normalize each component
    cgpa_norm = safe_normalize(df['cgpa'].fillna(0), 0, 10)
    dsa_norm = safe_normalize(df['dsa_rating'].fillna(0), 0, 2200)
    intern_norm = safe_normalize(df['internships'].fillna(0), 0, 3)
    projects_norm = safe_normalize(df['projects'].fillna(0), 0, 5)
    skills_norm = safe_normalize(df['skill_count'].fillna(0), 0, 10)
    contests_norm = safe_normalize(df['contest_count'].fillna(0), 0, 50)

    # Weighted composite
    df['placement_readiness_score'] = (
        cgpa_norm * 25 +
        dsa_norm * 20 +
        intern_norm * 20 +
        projects_norm * 15 +
        skills_norm * 10 +
        contests_norm * 10
    ).round(2)

    # ── CGPA bucket for analysis ──
    df['cgpa_bucket'] = pd.cut(
        df['cgpa'],
        bins=[0, 6.0, 7.0, 8.0, 9.0, 10.0],
        labels=['<6.0', '6.0-7.0', '7.0-8.0', '8.0-9.0', '9.0-10.0'],
        include_lowest=True
    ).astype(str)
    df.loc[df['cgpa_bucket'] == 'nan', 'cgpa_bucket'] = 'Unknown'

    # ── DSA bucket ──
    df['dsa_bucket'] = pd.cut(
        df['dsa_rating'].fillna(0),
        bins=[0, 1000, 1400, 1800, 2200, 3000],
        labels=['<1000', '1000-1400', '1400-1800', '1800-2200', '2200+'],
        include_lowest=True
    ).astype(str)

    logger.info(f"Features engineered. Score range: {df['placement_readiness_score'].min()} - {df['placement_readiness_score'].max()}")
    return df


def _compute_quality_metrics(df, stage):
    """Compute data quality metrics for a dataframe"""
    import pandas as pd

    total_rows = len(df)
    total_cells = total_rows * len(df.columns)

    # Null analysis
    null_counts = {}
    for col in df.columns:
        n = df[col].isna().sum()
        if hasattr(df[col], 'str'):
            # Also count empty strings as nulls
            n += (df[col] == '').sum()
        null_counts[col] = int(n)

    total_nulls = sum(null_counts.values())

    # Duplicate analysis
    dup_count = 0
    if 'student_id' in df.columns:
        dup_count = int(df['student_id'].duplicated().sum())

    # Invalid value detection
    invalid = {}
    try:
        cgpa_numeric = pd.to_numeric(df['cgpa'], errors='coerce')
        invalid['cgpa_gt_10'] = int((cgpa_numeric > 10).sum())
        invalid['cgpa_lt_0'] = int((cgpa_numeric < 0).sum())
    except Exception:
        pass
    try:
        dsa_numeric = pd.to_numeric(df['dsa_rating'], errors='coerce')
        invalid['dsa_negative'] = int((dsa_numeric < 0).sum())
    except Exception:
        pass
    try:
        tenth = pd.to_numeric(df['tenth_percentage'], errors='coerce')
        invalid['tenth_gt_100'] = int((tenth > 100).sum())
    except Exception:
        pass

    return {
        'stage': stage,
        'total_rows': total_rows,
        'total_cells': total_cells,
        'total_nulls': total_nulls,
        'overall_null_pct': round(100 * total_nulls / total_cells, 2) if total_cells > 0 else 0,
        'null_counts_per_column': null_counts,
        'duplicate_student_ids': dup_count,
        'duplicate_pct': round(100 * dup_count / total_rows, 2) if total_rows > 0 else 0,
        'invalid_values': invalid
    }


def _write_quality_report(s3, report):
    """Write quality report as JSON to gold/data_quality/"""
    key = f"{GOLD_PREFIX}data_quality/quality_report.json"
    s3.put_object(
        Bucket=BUCKET,
        Key=key,
        Body=json.dumps(report, indent=2, default=str),
        ContentType='application/json'
    )
    logger.info(f"Quality report written to s3://{BUCKET}/{key}")


def _write_quality_parquet(s3, before, after, pd):
    """Write quality metrics as Parquet for Athena querying"""
    metrics = []
    for col, count in before['null_counts_per_column'].items():
        metrics.append({
            'column_name': col,
            'null_count_before': count,
            'null_pct_before': round(100 * count / before['total_rows'], 2) if before['total_rows'] > 0 else 0,
            'null_count_after': after['null_counts_per_column'].get(col, 0),
            'null_pct_after': round(100 * after['null_counts_per_column'].get(col, 0) / after['total_rows'], 2) if after['total_rows'] > 0 else 0,
        })

    df_metrics = pd.DataFrame(metrics)
    buffer = io.BytesIO()
    df_metrics.to_parquet(buffer, index=False, engine='pyarrow')
    buffer.seek(0)

    key = f"{GOLD_PREFIX}data_quality/column_quality.parquet"
    s3.put_object(Bucket=BUCKET, Key=key, Body=buffer.getvalue())
    logger.info(f"Quality Parquet written to s3://{BUCKET}/{key}")


def _write_silver_parquet(s3, df, pd, pa, pq):
    """Write cleaned data as Parquet, partitioned by year"""
    years = sorted(df['year'].unique())
    logger.info(f"Writing Silver Parquet for years: {years}")

    for year in years:
        year_df = df[df['year'] == year].copy()

        # Convert to Parquet in-memory
        buffer = io.BytesIO()
        year_df.to_parquet(buffer, index=False, engine='pyarrow', compression='snappy')
        buffer.seek(0)

        key = f"{SILVER_PREFIX}year={int(year)}/data.parquet"
        s3.put_object(Bucket=BUCKET, Key=key, Body=buffer.getvalue())
        logger.info(f"  Written {len(year_df)} rows to s3://{BUCKET}/{key}")

    return [int(y) for y in years]
