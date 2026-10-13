"""
===============================================================================
LAMBDA 2: SILVER → GOLD
===============================================================================
University Placement Pipeline — Aggregation & Analytics

Trigger:  Manual invocation (after bronze→silver completes)
Runtime:  Python 3.12 + AWS SDK for Pandas Layer
Memory:   512 MB
Timeout:  180 seconds (3 minutes)

What it does:
  1. Reads ALL Parquet from silver/placement_data/
  2. Computes Gold aggregation tables:
     - yearly_trends (placement rate, avg salary, total offers)
     - placement_rate_by_branch (department-wise breakdown)
     - package_distribution (salary stats by branch)
     - skill_gap_analysis (CGPA, DSA, tech stack impact)
     - internship_impact (internship type/count vs outcomes)
     - rfp_segmentation (Recency/Frequency/Performance scoring)
  3. Writes each as Parquet to gold/{table_name}/

Cost: $0.00 (1 invocation, < 30s, 512MB)
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
SILVER_PREFIX = 'silver/placement_data/'
GOLD_PREFIX = 'gold/'


def lambda_handler(event, context):
    """Main Lambda handler"""
    import pandas as pd
    import numpy as np

    s3 = boto3.client('s3')
    start_time = datetime.utcnow()
    logger.info(f"=== Silver → Gold aggregation started at {start_time.isoformat()} ===")

    # ── Step 1: Read all Silver Parquet files ──
    df = _read_all_silver(s3, pd)
    logger.info(f"Loaded {len(df)} rows from Silver layer")

    # Only analyze placed-status-known students
    df_known = df[df['placed'].notna()].copy()
    df_placed = df_known[df_known['placed'] == 1].copy()

    # ── Step 2: Compute Gold Tables ──
    tables_written = []

    # 2a. Yearly Trends
    yearly = _compute_yearly_trends(df_known, pd)
    _write_gold_table(s3, yearly, 'yearly_trends')
    tables_written.append('yearly_trends')

    # 2b. Placement Rate by Branch
    branch = _compute_branch_placement(df_known, pd)
    _write_gold_table(s3, branch, 'placement_rate_by_branch')
    tables_written.append('placement_rate_by_branch')

    # 2c. Package Distribution
    package = _compute_package_distribution(df_placed, pd, np)
    _write_gold_table(s3, package, 'package_distribution')
    tables_written.append('package_distribution')

    # 2d. Skill Gap Analysis
    skills = _compute_skill_gap(df_known, pd)
    _write_gold_table(s3, skills, 'skill_gap_analysis')
    tables_written.append('skill_gap_analysis')

    # 2e. Internship Impact
    internship = _compute_internship_impact(df_known, df_placed, pd)
    _write_gold_table(s3, internship, 'internship_impact')
    tables_written.append('internship_impact')

    # 2f. RFP Segmentation
    rfp = _compute_rfp_segmentation(df_known, pd, np)
    _write_gold_table(s3, rfp, 'rfp_segmentation')
    tables_written.append('rfp_segmentation')

    duration = (datetime.utcnow() - start_time).total_seconds()
    result = {
        'statusCode': 200,
        'body': {
            'total_rows_processed': len(df),
            'tables_written': tables_written,
            'duration_seconds': round(duration, 2)
        }
    }
    logger.info(f"=== Gold aggregation completed in {duration:.2f}s === {json.dumps(result)}")
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# GOLD TABLE COMPUTATIONS
# ═══════════════════════════════════════════════════════════════════════════════

def _compute_yearly_trends(df, pd):
    """
    Gold Table: yearly_trends
    KPIs: Placement Rate, Average Salary, Median Salary, Total Offers per year
    """
    yearly = df.groupby('year').agg(
        total_students=('student_id', 'count'),
        total_placed=('placed', 'sum'),
        avg_salary=('package_lpa', lambda x: x[df.loc[x.index, 'placed'] == 1].mean()),
        median_salary=('package_lpa', lambda x: x[df.loc[x.index, 'placed'] == 1].median()),
        avg_cgpa=('cgpa', 'mean'),
        avg_dsa_rating=('dsa_rating', 'mean'),
        avg_readiness_score=('placement_readiness_score', 'mean')
    ).reset_index()

    yearly['placement_rate_pct'] = (100 * yearly['total_placed'] / yearly['total_students']).round(2)

    # Round float columns
    for col in ['avg_salary', 'median_salary', 'avg_cgpa', 'avg_dsa_rating', 'avg_readiness_score']:
        yearly[col] = yearly[col].round(2)

    logger.info(f"yearly_trends: {len(yearly)} rows")
    return yearly


def _compute_branch_placement(df, pd):
    """
    Gold Table: placement_rate_by_branch
    KPI: Department-wise placement percentage
    """
    branch = df.groupby(['year', 'branch']).agg(
        total_students=('student_id', 'count'),
        total_placed=('placed', 'sum'),
        avg_package=('package_lpa', lambda x: x[df.loc[x.index, 'placed'] == 1].mean()),
        avg_cgpa=('cgpa', 'mean'),
        avg_readiness=('placement_readiness_score', 'mean')
    ).reset_index()

    branch['placement_rate_pct'] = (100 * branch['total_placed'] / branch['total_students']).round(2)
    branch['avg_package'] = branch['avg_package'].round(2)
    branch['avg_cgpa'] = branch['avg_cgpa'].round(2)
    branch['avg_readiness'] = branch['avg_readiness'].round(2)

    logger.info(f"placement_rate_by_branch: {len(branch)} rows")
    return branch


def _compute_package_distribution(df_placed, pd, np):
    """
    Gold Table: package_distribution
    KPIs: Salary stats by branch (avg, median, min, max, p25, p75)
    """
    pkg = df_placed.groupby('branch').agg(
        count=('package_lpa', 'count'),
        avg_salary=('package_lpa', 'mean'),
        median_salary=('package_lpa', 'median'),
        min_salary=('package_lpa', 'min'),
        max_salary=('package_lpa', 'max'),
        p25_salary=('package_lpa', lambda x: np.percentile(x.dropna(), 25)),
        p75_salary=('package_lpa', lambda x: np.percentile(x.dropna(), 75)),
    ).reset_index()

    # Round all
    for col in pkg.columns:
        if col not in ('branch', 'count'):
            pkg[col] = pkg[col].round(2)

    # Add salary buckets distribution
    salary_buckets = df_placed.copy()
    salary_buckets['salary_bucket'] = pd.cut(
        salary_buckets['package_lpa'],
        bins=[0, 5, 8, 10, 12, 15, 100],
        labels=['<5 LPA', '5-8 LPA', '8-10 LPA', '10-12 LPA', '12-15 LPA', '15+ LPA'],
        include_lowest=True
    )
    bucket_dist = salary_buckets.groupby(['branch', 'salary_bucket'], observed=True).size().reset_index(name='count')

    logger.info(f"package_distribution: {len(pkg)} rows (+ {len(bucket_dist)} bucket rows)")
    # Combine into one — add bucket_dist as separate file
    return pkg


def _compute_skill_gap(df, pd):
    """
    Gold Table: skill_gap_analysis
    KPIs: CGPA vs placement, DSA impact, tech stack rankings, domain analysis
    """
    rows = []

    # 1. CGPA bucket analysis
    for bucket in df['cgpa_bucket'].dropna().unique():
        subset = df[df['cgpa_bucket'] == bucket]
        if len(subset) > 0:
            rows.append({
                'analysis_type': 'cgpa_bucket',
                'category': str(bucket),
                'total_students': len(subset),
                'placed_count': int(subset['placed'].sum()),
                'placement_rate_pct': round(100 * subset['placed'].mean(), 2),
                'avg_salary_placed': round(subset.loc[subset['placed'] == 1, 'package_lpa'].mean(), 2)
                    if subset['placed'].sum() > 0 else 0,
            })

    # 2. DSA bucket analysis
    for bucket in df['dsa_bucket'].dropna().unique():
        subset = df[df['dsa_bucket'] == bucket]
        if len(subset) > 0:
            rows.append({
                'analysis_type': 'dsa_bucket',
                'category': str(bucket),
                'total_students': len(subset),
                'placed_count': int(subset['placed'].sum()),
                'placement_rate_pct': round(100 * subset['placed'].mean(), 2),
                'avg_salary_placed': round(subset.loc[subset['placed'] == 1, 'package_lpa'].mean(), 2)
                    if subset['placed'].sum() > 0 else 0,
            })

    # 3. Tech stack analysis
    for tech in df['tech_stack'].dropna().unique():
        subset = df[df['tech_stack'] == tech]
        if len(subset) >= 10:  # Only if meaningful sample
            rows.append({
                'analysis_type': 'tech_stack',
                'category': tech,
                'total_students': len(subset),
                'placed_count': int(subset['placed'].sum()),
                'placement_rate_pct': round(100 * subset['placed'].mean(), 2),
                'avg_salary_placed': round(subset.loc[subset['placed'] == 1, 'package_lpa'].mean(), 2)
                    if subset['placed'].sum() > 0 else 0,
            })

    # 4. Domain analysis
    for domain in df['primary_domain'].dropna().unique():
        subset = df[df['primary_domain'] == domain]
        if len(subset) >= 10:
            rows.append({
                'analysis_type': 'domain',
                'category': domain,
                'total_students': len(subset),
                'placed_count': int(subset['placed'].sum()),
                'placement_rate_pct': round(100 * subset['placed'].mean(), 2),
                'avg_salary_placed': round(subset.loc[subset['placed'] == 1, 'package_lpa'].mean(), 2)
                    if subset['placed'].sum() > 0 else 0,
            })

    result = pd.DataFrame(rows)
    logger.info(f"skill_gap_analysis: {len(result)} rows")
    return result


def _compute_internship_impact(df, df_placed, pd):
    """
    Gold Table: internship_impact
    KPIs: Internship count & type vs placement rate and salary
    """
    rows = []

    # By internship count
    for count in sorted(df['internships'].dropna().unique()):
        subset = df[df['internships'] == count]
        placed_subset = subset[subset['placed'] == 1]
        rows.append({
            'analysis_type': 'internship_count',
            'category': str(int(count)),
            'total_students': len(subset),
            'placed_count': int(subset['placed'].sum()),
            'placement_rate_pct': round(100 * subset['placed'].mean(), 2),
            'avg_salary': round(placed_subset['package_lpa'].mean(), 2) if len(placed_subset) > 0 else 0,
            'avg_readiness_score': round(subset['placement_readiness_score'].mean(), 2),
        })

    # By internship type
    for itype in df['internship_type'].dropna().unique():
        subset = df[df['internship_type'] == itype]
        placed_subset = subset[subset['placed'] == 1]
        rows.append({
            'analysis_type': 'internship_type',
            'category': itype,
            'total_students': len(subset),
            'placed_count': int(subset['placed'].sum()),
            'placement_rate_pct': round(100 * subset['placed'].mean(), 2),
            'avg_salary': round(placed_subset['package_lpa'].mean(), 2) if len(placed_subset) > 0 else 0,
            'avg_readiness_score': round(subset['placement_readiness_score'].mean(), 2),
        })

    # By project level
    for level in df['project_level'].dropna().unique():
        subset = df[df['project_level'] == level]
        placed_subset = subset[subset['placed'] == 1]
        rows.append({
            'analysis_type': 'project_level',
            'category': level,
            'total_students': len(subset),
            'placed_count': int(subset['placed'].sum()),
            'placement_rate_pct': round(100 * subset['placed'].mean(), 2),
            'avg_salary': round(placed_subset['package_lpa'].mean(), 2) if len(placed_subset) > 0 else 0,
            'avg_readiness_score': round(subset['placement_readiness_score'].mean(), 2),
        })

    result = pd.DataFrame(rows)
    logger.info(f"internship_impact: {len(result)} rows")
    return result


def _compute_rfp_segmentation(df, pd, np):
    """
    Gold Table: rfp_segmentation
    Adapted RFM model → RFP (Recency / Frequency / Performance)

    R (Recency)    = internship_type proximity: MNC=3, Startup=2, None=1
    F (Frequency)  = internships count: 0→1, 1→2, 2→3, 3→4
    P (Performance) = cgpa buckets: <6.5→1, 6.5-7.5→2, 7.5-8.5→3, >8.5→4
    """
    rfp = df.copy()

    # R score: Internship type quality
    recency_map = {'MNC': 3, 'Startup': 2, 'No Internship': 1}
    rfp['r_score'] = rfp['internship_type'].map(recency_map).fillna(1).astype(int)

    # F score: Internship frequency
    rfp['f_score'] = (rfp['internships'].fillna(0) + 1).clip(1, 4).astype(int)

    # P score: CGPA performance
    def perf_score(cgpa):
        if pd.isna(cgpa):
            return 2  # Default middle
        if cgpa < 6.5:
            return 1
        elif cgpa < 7.5:
            return 2
        elif cgpa < 8.5:
            return 3
        else:
            return 4

    rfp['p_score'] = rfp['cgpa'].apply(perf_score)

    # Composite RFP score (3-12 range)
    rfp['rfp_score'] = rfp['r_score'] + rfp['f_score'] + rfp['p_score']

    # Segment labels
    def segment_label(score):
        if score >= 10:
            return 'High Potential'
        elif score >= 7:
            return 'Medium Potential'
        else:
            return 'Low Potential'

    rfp['rfp_segment'] = rfp['rfp_score'].apply(segment_label)

    # Aggregate by segment
    segment_summary = rfp.groupby('rfp_segment').agg(
        student_count=('student_id', 'count'),
        placed_count=('placed', 'sum'),
        placement_rate_pct=('placed', lambda x: round(100 * x.mean(), 2)),
        avg_salary=('package_lpa', lambda x: round(x[rfp.loc[x.index, 'placed'] == 1].mean(), 2)),
        avg_cgpa=('cgpa', lambda x: round(x.mean(), 2)),
        avg_readiness=('placement_readiness_score', lambda x: round(x.mean(), 2)),
        avg_rfp_score=('rfp_score', lambda x: round(x.mean(), 2)),
    ).reset_index()

    # Also save individual student scores for drill-down
    student_rfp = rfp[['student_id', 'year', 'branch', 'cgpa', 'internships',
                        'internship_type', 'placed', 'package_lpa',
                        'r_score', 'f_score', 'p_score', 'rfp_score',
                        'rfp_segment', 'placement_readiness_score']].copy()

    logger.info(f"rfp_segmentation summary: {len(segment_summary)} segments")
    logger.info(f"Segment distribution:\n{segment_summary[['rfp_segment', 'student_count', 'placement_rate_pct']].to_string()}")

    # We'll write both — summary and detail
    return student_rfp  # Full detail for Athena flexibility


# ═══════════════════════════════════════════════════════════════════════════════
# UTILITY FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def _read_all_silver(s3, pd):
    """Read all Parquet files from Silver layer"""
    response = s3.list_objects_v2(Bucket=BUCKET, Prefix=SILVER_PREFIX)
    dfs = []

    for obj in response.get('Contents', []):
        key = obj['Key']
        if key.endswith('.parquet'):
            # Extract year from partition path
            year = None
            parts = key.split('/')
            for p in parts:
                if p.startswith('year='):
                    year = int(p.split('=')[1])

            resp = s3.get_object(Bucket=BUCKET, Key=key)
            df = pd.read_parquet(io.BytesIO(resp['Body'].read()))

            # Add year if not in dataframe (it's in the partition path)
            if year and 'year' not in df.columns:
                df['year'] = year

            dfs.append(df)
            logger.info(f"  Read {key}: {len(df)} rows")

    if not dfs:
        raise ValueError("No Parquet files found in Silver layer!")

    return pd.concat(dfs, ignore_index=True)


def _write_gold_table(s3, df, table_name):
    """Write a DataFrame as Parquet to gold/{table_name}/data.parquet"""
    buffer = io.BytesIO()
    df.to_parquet(buffer, index=False, engine='pyarrow', compression='snappy')
    buffer.seek(0)

    key = f"{GOLD_PREFIX}{table_name}/data.parquet"
    s3.put_object(Bucket=BUCKET, Key=key, Body=buffer.getvalue())
    logger.info(f"Gold table written: s3://{BUCKET}/{key} ({len(df)} rows)")
