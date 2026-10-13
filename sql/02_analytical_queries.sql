-- =============================================================================
-- PHASE 6: ATHENA ANALYTICAL QUERIES — PLACEMENT KPIs
-- =============================================================================
-- Run in Athena Query Editor after Phase 5 tables are created.
-- All queries use partition pruning and target Gold/Silver optimally.
--
-- COST: Each Silver query scans ~1-3 MB (Parquet + partitions)
--       Each Gold query scans ~1-50 KB (pre-aggregated)
--       Free tier = 1 TB/month. We'll use < 50 MB total.
-- =============================================================================


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 1: CORE METRICS (from Gold — near-zero scan cost)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────
-- Q1: Overall Placement KPIs (all years)
-- Scans: ~2 KB (gold table)
-- ──────────────────────────────────────────────────
SELECT
    year,
    total_students,
    total_placed                                    AS total_offers,
    placement_rate_pct,
    avg_salary,
    median_salary,
    avg_readiness_score
FROM placement_db.gold_yearly_trends
ORDER BY year;


-- ──────────────────────────────────────────────────
-- Q2: Department-wise Placement Rate
-- Scans: ~3 KB
-- ──────────────────────────────────────────────────
SELECT
    branch,
    SUM(total_students)                             AS total_students,
    SUM(total_placed)                               AS total_placed,
    ROUND(100.0 * SUM(total_placed) / SUM(total_students), 2) AS overall_placement_pct,
    ROUND(AVG(avg_package), 2)                      AS avg_package_lpa
FROM placement_db.gold_branch_placement
GROUP BY branch
ORDER BY overall_placement_pct DESC;


-- ──────────────────────────────────────────────────
-- Q3: Package Distribution by Branch
-- Scans: ~1 KB
-- ──────────────────────────────────────────────────
SELECT
    branch,
    count                                           AS placed_students,
    avg_salary,
    median_salary,
    min_salary,
    max_salary,
    p25_salary,
    p75_salary,
    ROUND(p75_salary - p25_salary, 2)               AS iqr_spread
FROM placement_db.gold_package_distribution
ORDER BY median_salary DESC;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 2: ANALYTICAL INSIGHTS (from Gold — near-zero scan cost)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────
-- Q4: CGPA vs Placement Correlation
-- Shows: Higher CGPA = better placement & salary?
-- ──────────────────────────────────────────────────
SELECT
    category                                        AS cgpa_range,
    total_students,
    placed_count,
    placement_rate_pct,
    avg_salary_placed
FROM placement_db.gold_skill_gap
WHERE analysis_type = 'cgpa_bucket'
ORDER BY category;


-- ──────────────────────────────────────────────────
-- Q5: Top Tech Stacks for Placement
-- Shows: Which technologies give best placement odds?
-- ──────────────────────────────────────────────────
SELECT
    category                                        AS tech_stack,
    total_students,
    placed_count,
    placement_rate_pct,
    avg_salary_placed
FROM placement_db.gold_skill_gap
WHERE analysis_type = 'tech_stack'
ORDER BY placement_rate_pct DESC;


-- ──────────────────────────────────────────────────
-- Q6: Domain-wise Placement Analysis
-- Shows: Which primary domains lead to better outcomes?
-- ──────────────────────────────────────────────────
SELECT
    category                                        AS domain,
    total_students,
    placed_count,
    placement_rate_pct,
    avg_salary_placed
FROM placement_db.gold_skill_gap
WHERE analysis_type = 'domain'
ORDER BY placement_rate_pct DESC;


-- ──────────────────────────────────────────────────
-- Q7: DSA Rating Impact on Placement
-- Shows: Does DSA practice correlation with placement?
-- ──────────────────────────────────────────────────
SELECT
    category                                        AS dsa_range,
    total_students,
    placed_count,
    placement_rate_pct,
    avg_salary_placed
FROM placement_db.gold_skill_gap
WHERE analysis_type = 'dsa_bucket'
ORDER BY category;


-- ──────────────────────────────────────────────────
-- Q8: Internship Count vs Placement
-- Shows: More internships = better outcomes?
-- ──────────────────────────────────────────────────
SELECT
    category                                        AS internship_count,
    total_students,
    placed_count,
    placement_rate_pct,
    avg_salary,
    avg_readiness_score
FROM placement_db.gold_internship_impact
WHERE analysis_type = 'internship_count'
ORDER BY CAST(category AS INTEGER);


-- ──────────────────────────────────────────────────
-- Q9: MNC vs Startup vs No Internship
-- Shows: Internship TYPE matters more than count?
-- ──────────────────────────────────────────────────
SELECT
    category                                        AS internship_type,
    total_students,
    placed_count,
    placement_rate_pct,
    avg_salary,
    avg_readiness_score
FROM placement_db.gold_internship_impact
WHERE analysis_type = 'internship_type'
ORDER BY placement_rate_pct DESC;


-- ──────────────────────────────────────────────────
-- Q10: Project Level Impact
-- ──────────────────────────────────────────────────
SELECT
    category                                        AS project_level,
    total_students,
    placed_count,
    placement_rate_pct,
    avg_salary
FROM placement_db.gold_internship_impact
WHERE analysis_type = 'project_level'
ORDER BY placement_rate_pct DESC;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 3: ADVANCED ANALYTICS (from Silver — uses partitions)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────
-- Q11: Salary Bucket Distribution
-- Scans: ~1 MB (all Silver partitions, but Parquet columnar)
-- ──────────────────────────────────────────────────
SELECT
    CASE
        WHEN package_lpa = 0        THEN 'Not Placed'
        WHEN package_lpa < 5        THEN '< 5 LPA'
        WHEN package_lpa < 8        THEN '5-8 LPA'
        WHEN package_lpa < 10       THEN '8-10 LPA'
        WHEN package_lpa < 12       THEN '10-12 LPA'
        WHEN package_lpa < 15       THEN '12-15 LPA'
        ELSE '15+ LPA'
    END AS salary_bucket,
    COUNT(*)                        AS student_count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) AS pct_of_total
FROM placement_db.silver_placement
GROUP BY 1
ORDER BY
    CASE
        WHEN package_lpa = 0        THEN 0
        WHEN package_lpa < 5        THEN 1
        WHEN package_lpa < 8        THEN 2
        WHEN package_lpa < 10       THEN 3
        WHEN package_lpa < 12       THEN 4
        WHEN package_lpa < 15       THEN 5
        ELSE 6
    END;


-- ──────────────────────────────────────────────────
-- Q12: Skill Demand vs Supply (Top 10 tech stacks)
-- Which skills are most common vs which pay best?
-- Scans: ~1 MB
-- ──────────────────────────────────────────────────
SELECT
    tech_stack,
    COUNT(*)                                            AS total_students,
    SUM(CASE WHEN placed = 1 THEN 1 ELSE 0 END)        AS placed_count,
    ROUND(100.0 * SUM(CASE WHEN placed=1 THEN 1 ELSE 0 END) / COUNT(*), 2)
                                                        AS placement_rate_pct,
    ROUND(AVG(CASE WHEN placed=1 THEN package_lpa END), 2)
                                                        AS avg_salary_placed,
    ROUND(AVG(placement_readiness_score), 2)            AS avg_readiness
FROM placement_db.silver_placement
WHERE tech_stack IS NOT NULL
GROUP BY tech_stack
HAVING COUNT(*) >= 50
ORDER BY placement_rate_pct DESC;


-- ──────────────────────────────────────────────────
-- Q13: CGPA vs Placement Probability (detailed)
-- Shows placement probability at each CGPA level
-- Uses partition pruning: specific year
-- Scans: ~300 KB (one partition)
-- ──────────────────────────────────────────────────
SELECT
    cgpa_bucket,
    COUNT(*)                                            AS students,
    SUM(placed)                                         AS placed,
    ROUND(100.0 * SUM(placed) / COUNT(*), 2)            AS placement_pct,
    ROUND(AVG(CASE WHEN placed=1 THEN package_lpa END), 2) AS avg_salary,
    ROUND(AVG(dsa_rating), 0)                           AS avg_dsa,
    ROUND(AVG(internships), 2)                          AS avg_internships
FROM placement_db.silver_placement
WHERE year = 2024                                       -- ✅ Partition pruning!
GROUP BY cgpa_bucket
ORDER BY cgpa_bucket;


-- ──────────────────────────────────────────────────
-- Q14: Internship vs Placement Correlation (detailed)
-- Cross-tabulation of internship count × type
-- Scans: ~1 MB
-- ──────────────────────────────────────────────────
SELECT
    internships,
    internship_type,
    COUNT(*)                                            AS students,
    SUM(placed)                                         AS placed,
    ROUND(100.0 * SUM(placed) / COUNT(*), 2)            AS placement_pct,
    ROUND(AVG(CASE WHEN placed=1 THEN package_lpa END), 2) AS avg_salary
FROM placement_db.silver_placement
WHERE internship_type IS NOT NULL
GROUP BY internships, internship_type
ORDER BY internships, internship_type;


-- ──────────────────────────────────────────────────
-- Q15: Year-over-Year Placement Trend with Growth
-- Shows year-on-year improvement/decline
-- Scans: ~2 KB (gold table)
-- ──────────────────────────────────────────────────
SELECT
    year,
    total_students,
    total_placed,
    placement_rate_pct,
    avg_salary,
    LAG(placement_rate_pct) OVER (ORDER BY year)        AS prev_year_rate,
    ROUND(placement_rate_pct - LAG(placement_rate_pct) OVER (ORDER BY year), 2)
                                                        AS rate_change_pct,
    LAG(avg_salary) OVER (ORDER BY year)                AS prev_year_salary,
    ROUND(avg_salary - LAG(avg_salary) OVER (ORDER BY year), 2)
                                                        AS salary_change_lpa
FROM placement_db.gold_yearly_trends
ORDER BY year;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 4: RFP SEGMENTATION (Advanced)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────
-- Q16: RFP Segment Summary
-- High/Medium/Low Potential student distribution
-- Scans: ~5 KB (gold table)
-- ──────────────────────────────────────────────────
SELECT
    rfp_segment,
    COUNT(*)                                            AS student_count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2)  AS pct_of_total,
    SUM(placed)                                         AS placed_count,
    ROUND(100.0 * SUM(placed) / COUNT(*), 2)            AS placement_rate_pct,
    ROUND(AVG(CASE WHEN placed=1 THEN package_lpa END), 2) AS avg_salary,
    ROUND(AVG(cgpa), 2)                                 AS avg_cgpa,
    ROUND(AVG(placement_readiness_score), 2)            AS avg_readiness
FROM placement_db.gold_rfp_segmentation
GROUP BY rfp_segment
ORDER BY
    CASE rfp_segment
        WHEN 'High Potential' THEN 1
        WHEN 'Medium Potential' THEN 2
        WHEN 'Low Potential' THEN 3
    END;


-- ──────────────────────────────────────────────────
-- Q17: RFP Segment by Branch
-- Which departments have most High Potential students?
-- Scans: ~5 KB
-- ──────────────────────────────────────────────────
SELECT
    branch,
    rfp_segment,
    COUNT(*)                                            AS student_count,
    ROUND(100.0 * SUM(placed) / COUNT(*), 2)            AS placement_rate_pct,
    ROUND(AVG(rfp_score), 2)                            AS avg_rfp_score
FROM placement_db.gold_rfp_segmentation
WHERE branch IS NOT NULL
GROUP BY branch, rfp_segment
ORDER BY branch,
    CASE rfp_segment
        WHEN 'High Potential' THEN 1
        WHEN 'Medium Potential' THEN 2
        WHEN 'Low Potential' THEN 3
    END;


-- ──────────────────────────────────────────────────
-- Q18: At-Risk Students (for dashboard panel)
-- Low RFP score + not yet placed
-- Scans: ~5 KB
-- ──────────────────────────────────────────────────
SELECT
    student_id,
    branch,
    cgpa,
    internships,
    internship_type,
    rfp_score,
    rfp_segment,
    placement_readiness_score
FROM placement_db.gold_rfp_segmentation
WHERE rfp_segment = 'Low Potential'
  AND placed = 0
ORDER BY rfp_score ASC, placement_readiness_score ASC
LIMIT 50;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 5: DATA QUALITY VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────
-- Q19: Data Quality Before vs After Cleaning
-- Scans: ~1 KB
-- ──────────────────────────────────────────────────
SELECT
    column_name,
    null_count_before,
    null_pct_before,
    null_count_after,
    null_pct_after,
    ROUND(null_pct_before - null_pct_after, 2)          AS improvement_pct
FROM placement_db.gold_data_quality
WHERE null_count_before > 0
ORDER BY null_pct_before DESC;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 6: COST VALIDATION QUERIES
-- ═══════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────
-- Q20: Partition Pruning Test — Single Year
-- This should scan ONLY ~300 KB (one partition)
-- Check "Data scanned" in query results!
-- ──────────────────────────────────────────────────
SELECT
    branch,
    COUNT(*)                    AS students,
    SUM(placed)                 AS placed,
    ROUND(AVG(package_lpa), 2)  AS avg_package
FROM placement_db.silver_placement
WHERE year = 2024                   -- ✅ Scans only year=2024 partition
GROUP BY branch
ORDER BY placed DESC;


-- ──────────────────────────────────────────────────
-- Q21: Full Scan Test (for comparison)
-- This scans ALL partitions — compare with Q20
-- ──────────────────────────────────────────────────
SELECT
    year,
    branch,
    COUNT(*)                    AS students,
    SUM(placed)                 AS placed
FROM placement_db.silver_placement
GROUP BY year, branch
ORDER BY year, branch;


-- ──────────────────────────────────────────────────
-- Q22: CSV vs Parquet Comparison
-- Run this on Silver (Parquet) and compare scan size
-- with what a CSV table would scan. Parquet typically
-- reduces scan by 80-90% because of columnar storage.
-- ──────────────────────────────────────────────────
-- Just check the "Data scanned" value for Q20 vs Q21
-- Q20 (1 partition): should be ~200-400 KB
-- Q21 (all partitions): should be ~1-2 MB
-- Raw CSV equivalent: would be ~5 MB
-- Savings: ~75-90%
