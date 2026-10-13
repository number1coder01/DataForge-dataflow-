-- =============================================================================
-- PHASE 7: LOOKER STUDIO — DASHBOARD-OPTIMIZED VIEWS
-- =============================================================================
-- These Athena VIEWS flatten & simplify the Gold tables for Looker Studio.
-- Each view = one data source in Looker Studio. Simple and clean.
--
-- Run these in Athena AFTER Phase 5 tables are created.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- VIEW 1: Dashboard Overview — Single-row KPIs + yearly trends
-- Used for: KPI scorecards + trend line chart
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW placement_db.v_dashboard_overview AS
SELECT
    year,
    total_students,
    total_placed                                        AS total_offers,
    total_students - total_placed                       AS not_placed,
    placement_rate_pct,
    avg_salary,
    median_salary,
    avg_cgpa,
    avg_dsa_rating,
    avg_readiness_score
FROM placement_db.gold_yearly_trends;


-- ─────────────────────────────────────────────────────────────────────────────
-- VIEW 2: Department Analysis — Branch-level breakdown
-- Used for: Department bar charts, comparison tables
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW placement_db.v_department_analysis AS
SELECT
    year,
    branch                                              AS department,
    total_students,
    total_placed,
    placement_rate_pct,
    avg_package                                         AS avg_salary_lpa,
    avg_cgpa,
    avg_readiness                                       AS readiness_score
FROM placement_db.gold_branch_placement;


-- ─────────────────────────────────────────────────────────────────────────────
-- VIEW 3: Salary Insights — Package distribution for placed students
-- Used for: Salary bar charts, box-plot style visuals
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW placement_db.v_salary_insights AS
SELECT
    branch                                              AS department,
    count                                               AS placed_students,
    avg_salary,
    median_salary,
    min_salary,
    max_salary,
    p25_salary,
    p75_salary,
    ROUND(p75_salary - p25_salary, 2)                   AS salary_spread
FROM placement_db.gold_package_distribution;


-- ─────────────────────────────────────────────────────────────────────────────
-- VIEW 4: Skills & Academic Analysis — Unified skill gap view
-- Used for: CGPA, DSA, tech stack, domain charts
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW placement_db.v_skill_analysis AS
SELECT
    analysis_type,
    category,
    total_students,
    placed_count,
    placement_rate_pct,
    avg_salary_placed
FROM placement_db.gold_skill_gap;


-- ─────────────────────────────────────────────────────────────────────────────
-- VIEW 5: Experience Impact — Internships & projects
-- Used for: Internship impact charts
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW placement_db.v_experience_impact AS
SELECT
    analysis_type,
    category,
    total_students,
    placed_count,
    placement_rate_pct,
    avg_salary,
    avg_readiness_score
FROM placement_db.gold_internship_impact;


-- ─────────────────────────────────────────────────────────────────────────────
-- VIEW 6: RFP Segments — Summary for pie/donut chart
-- Used for: Segmentation pie chart, segment comparison
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW placement_db.v_rfp_summary AS
SELECT
    rfp_segment,
    COUNT(*)                                            AS student_count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2)  AS pct_of_total,
    SUM(placed)                                         AS placed_count,
    ROUND(100.0 * SUM(placed) / COUNT(*), 2)            AS placement_rate_pct,
    ROUND(AVG(CASE WHEN placed = 1 THEN package_lpa END), 2) AS avg_salary,
    ROUND(AVG(cgpa), 2)                                 AS avg_cgpa,
    ROUND(AVG(placement_readiness_score), 2)            AS avg_readiness
FROM placement_db.gold_rfp_segmentation
GROUP BY rfp_segment;


-- ─────────────────────────────────────────────────────────────────────────────
-- VIEW 7: At-Risk Students — For drill-down table
-- Used for: At-Risk Students table in dashboard
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW placement_db.v_at_risk_students AS
SELECT
    student_id,
    year,
    branch                                              AS department,
    cgpa,
    internships,
    internship_type,
    rfp_score,
    rfp_segment,
    placement_readiness_score                           AS readiness_score,
    CASE
        WHEN rfp_score <= 4 THEN 'Critical'
        WHEN rfp_score <= 6 THEN 'Warning'
        ELSE 'Monitor'
    END                                                 AS risk_level
FROM placement_db.gold_rfp_segmentation
WHERE rfp_segment = 'Low Potential'
  AND placed = 0;


-- ─────────────────────────────────────────────────────────────────────────────
-- VIEW 8: Data Quality — For data quality panel
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW placement_db.v_data_quality AS
SELECT
    column_name,
    null_count_before,
    null_pct_before,
    null_count_after,
    null_pct_after,
    ROUND(null_pct_before - null_pct_after, 2)          AS improvement_pct
FROM placement_db.gold_data_quality
WHERE null_count_before > 0;


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY ALL VIEWS
-- ─────────────────────────────────────────────────────────────────────────────

-- Quick test each view:
SELECT * FROM placement_db.v_dashboard_overview;
SELECT * FROM placement_db.v_department_analysis LIMIT 10;
SELECT * FROM placement_db.v_salary_insights;
SELECT * FROM placement_db.v_skill_analysis LIMIT 10;
SELECT * FROM placement_db.v_experience_impact LIMIT 10;
SELECT * FROM placement_db.v_rfp_summary;
SELECT * FROM placement_db.v_at_risk_students LIMIT 10;
SELECT * FROM placement_db.v_data_quality;
