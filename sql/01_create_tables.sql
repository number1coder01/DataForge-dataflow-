-- =============================================================================
-- PHASE 5: GLUE CATALOG — MANUAL DDL (NO CRAWLERS)
-- =============================================================================
-- Run these statements in Amazon Athena Query Editor, IN ORDER.
-- Region: ap-south-1 | Bucket: kaartik-placement-pipeline-dev
-- 
-- WHY MANUAL DDL?
--   Glue Crawlers cost ~$0.44/DPU-hour per run.
--   Manual DDL = $0.00 forever. Same result, zero cost.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Create the Database
-- ─────────────────────────────────────────────────────────────────────────────

CREATE DATABASE IF NOT EXISTS placement_db
COMMENT 'University Placement Prediction Pipeline - Data Lake'
LOCATION 's3://kaartik-placement-pipeline-dev/';


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Silver Table — Cleaned Placement Data (Partitioned by Year)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTERNAL TABLE IF NOT EXISTS placement_db.silver_placement (
    student_id          INT         COMMENT 'Unique student identifier',
    month               INT         COMMENT 'Placement month (1-12)',
    tenth_percentage    DOUBLE      COMMENT '10th grade percentage (0-100)',
    twelfth_percentage  DOUBLE      COMMENT '12th grade percentage (0-100)',
    cgpa                DOUBLE      COMMENT 'College CGPA (0-10)',
    branch              STRING      COMMENT 'Engineering branch (CSE/IT/ECE/ME/EEE/CE)',
    dsa_rating          INT         COMMENT 'DSA platform rating',
    problems_solved     INT         COMMENT 'Coding problems solved count',
    contest_count       INT         COMMENT 'Contest participation count',
    internships         INT         COMMENT 'Number of internships (0-3)',
    internship_type     STRING      COMMENT 'MNC / Startup / No Internship',
    projects            INT         COMMENT 'Number of projects',
    project_level       STRING      COMMENT 'Basic / Intermediate / Advanced',
    primary_domain      STRING      COMMENT 'AI/ML, Web Dev, Data Science, Systems, Core, No Domain',
    tech_stack          STRING      COMMENT 'Primary technology (Python, React, etc.)',
    skill_count         INT         COMMENT 'Total skill count',
    mock_interviews     INT         COMMENT 'Mock interview count',
    weekly_study_hours  INT         COMMENT 'Weekly study hours',
    placed              INT         COMMENT '0 = Not Placed, 1 = Placed',
    package_lpa         DOUBLE      COMMENT 'Package in LPA (0.0 if not placed)',
    placement_readiness_score DOUBLE COMMENT 'Composite readiness score (0-100)',
    cgpa_bucket         STRING      COMMENT 'CGPA range bucket for analysis',
    dsa_bucket          STRING      COMMENT 'DSA rating range bucket for analysis'
)
PARTITIONED BY (year INT)
STORED AS PARQUET
LOCATION 's3://kaartik-placement-pipeline-dev/silver/placement_data/'
TBLPROPERTIES (
    'parquet.compression' = 'SNAPPY',
    'classification' = 'parquet'
);

-- Load all partitions automatically
MSCK REPAIR TABLE placement_db.silver_placement;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Gold Tables — Pre-Aggregated Analytics
-- ─────────────────────────────────────────────────────────────────────────────

-- 3a. Yearly Trends
CREATE EXTERNAL TABLE IF NOT EXISTS placement_db.gold_yearly_trends (
    year                    INT,
    total_students          INT,
    total_placed            INT,
    avg_salary              DOUBLE,
    median_salary           DOUBLE,
    avg_cgpa                DOUBLE,
    avg_dsa_rating          DOUBLE,
    avg_readiness_score     DOUBLE,
    placement_rate_pct      DOUBLE
)
STORED AS PARQUET
LOCATION 's3://kaartik-placement-pipeline-dev/gold/yearly_trends/'
TBLPROPERTIES ('parquet.compression' = 'SNAPPY');


-- 3b. Placement Rate by Branch
CREATE EXTERNAL TABLE IF NOT EXISTS placement_db.gold_branch_placement (
    year                INT,
    branch              STRING,
    total_students      INT,
    total_placed        INT,
    avg_package         DOUBLE,
    avg_cgpa            DOUBLE,
    avg_readiness       DOUBLE,
    placement_rate_pct  DOUBLE
)
STORED AS PARQUET
LOCATION 's3://kaartik-placement-pipeline-dev/gold/placement_rate_by_branch/'
TBLPROPERTIES ('parquet.compression' = 'SNAPPY');


-- 3c. Package Distribution
CREATE EXTERNAL TABLE IF NOT EXISTS placement_db.gold_package_distribution (
    branch          STRING,
    count           INT,
    avg_salary      DOUBLE,
    median_salary   DOUBLE,
    min_salary      DOUBLE,
    max_salary      DOUBLE,
    p25_salary      DOUBLE,
    p75_salary      DOUBLE
)
STORED AS PARQUET
LOCATION 's3://kaartik-placement-pipeline-dev/gold/package_distribution/'
TBLPROPERTIES ('parquet.compression' = 'SNAPPY');


-- 3d. Skill Gap Analysis
CREATE EXTERNAL TABLE IF NOT EXISTS placement_db.gold_skill_gap (
    analysis_type       STRING  COMMENT 'cgpa_bucket / dsa_bucket / tech_stack / domain',
    category            STRING  COMMENT 'The bucket or category value',
    total_students      INT,
    placed_count        INT,
    placement_rate_pct  DOUBLE,
    avg_salary_placed   DOUBLE
)
STORED AS PARQUET
LOCATION 's3://kaartik-placement-pipeline-dev/gold/skill_gap_analysis/'
TBLPROPERTIES ('parquet.compression' = 'SNAPPY');


-- 3e. Internship Impact
CREATE EXTERNAL TABLE IF NOT EXISTS placement_db.gold_internship_impact (
    analysis_type           STRING  COMMENT 'internship_count / internship_type / project_level',
    category                STRING,
    total_students          INT,
    placed_count            INT,
    placement_rate_pct      DOUBLE,
    avg_salary              DOUBLE,
    avg_readiness_score     DOUBLE
)
STORED AS PARQUET
LOCATION 's3://kaartik-placement-pipeline-dev/gold/internship_impact/'
TBLPROPERTIES ('parquet.compression' = 'SNAPPY');


-- 3f. RFP Segmentation (student-level detail)
CREATE EXTERNAL TABLE IF NOT EXISTS placement_db.gold_rfp_segmentation (
    student_id                  INT,
    year                        INT,
    branch                      STRING,
    cgpa                        DOUBLE,
    internships                 INT,
    internship_type             STRING,
    placed                      INT,
    package_lpa                 DOUBLE,
    r_score                     INT     COMMENT 'Recency: MNC=3, Startup=2, None=1',
    f_score                     INT     COMMENT 'Frequency: internship count + 1',
    p_score                     INT     COMMENT 'Performance: CGPA bucket 1-4',
    rfp_score                   INT     COMMENT 'Composite R+F+P (3-12)',
    rfp_segment                 STRING  COMMENT 'High/Medium/Low Potential',
    placement_readiness_score   DOUBLE
)
STORED AS PARQUET
LOCATION 's3://kaartik-placement-pipeline-dev/gold/rfp_segmentation/'
TBLPROPERTIES ('parquet.compression' = 'SNAPPY');


-- 3g. Data Quality Metrics
CREATE EXTERNAL TABLE IF NOT EXISTS placement_db.gold_data_quality (
    column_name         STRING,
    null_count_before   INT,
    null_pct_before     DOUBLE,
    null_count_after    INT,
    null_pct_after      DOUBLE
)
STORED AS PARQUET
LOCATION 's3://kaartik-placement-pipeline-dev/gold/data_quality/'
TBLPROPERTIES ('parquet.compression' = 'SNAPPY');


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Verify All Tables
-- ─────────────────────────────────────────────────────────────────────────────

-- Check tables exist
SHOW TABLES IN placement_db;

-- Check Silver partitions loaded
SHOW PARTITIONS placement_db.silver_placement;

-- Quick row count
SELECT 'silver_placement' AS tbl, COUNT(*) AS rows FROM placement_db.silver_placement
UNION ALL
SELECT 'gold_yearly_trends', COUNT(*) FROM placement_db.gold_yearly_trends
UNION ALL
SELECT 'gold_branch_placement', COUNT(*) FROM placement_db.gold_branch_placement
UNION ALL
SELECT 'gold_package_distribution', COUNT(*) FROM placement_db.gold_package_distribution
UNION ALL
SELECT 'gold_skill_gap', COUNT(*) FROM placement_db.gold_skill_gap
UNION ALL
SELECT 'gold_internship_impact', COUNT(*) FROM placement_db.gold_internship_impact
UNION ALL
SELECT 'gold_rfp_segmentation', COUNT(*) FROM placement_db.gold_rfp_segmentation
UNION ALL
SELECT 'gold_data_quality', COUNT(*) FROM placement_db.gold_data_quality;
