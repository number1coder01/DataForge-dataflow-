import pandas as pd

def run_quality_checks(df: pd.DataFrame, schema: dict) -> dict:
    """Detect quality issues using statistical methods, NOT domain rules."""
    issues = []

    # 1. Duplicate rows
    dup_count = df.duplicated().sum()
    if dup_count > 0:
        issues.append({"type": "duplicates", "count": int(dup_count), "severity": "warning"})

    # 2. Null analysis per column
    for col in df.columns:
        null_pct = df[col].isnull().mean()
        if null_pct > 0:
            severity = "critical" if null_pct > 0.5 else "warning" if null_pct > 0.1 else "info"
            issues.append({"column": col, "type": "nulls", "pct": round(null_pct * 100, 2), "severity": severity})

    # 3. Statistical outliers (IQR method)
    for col, meta in schema.items():
        if meta["type"] == "numeric":
            numeric_data = pd.to_numeric(df[col], errors='coerce').dropna()
            if len(numeric_data) > 0:
                q1 = numeric_data.quantile(0.25)
                q3 = numeric_data.quantile(0.75)
                iqr = q3 - q1
                if iqr > 0:
                    outlier_mask = (numeric_data < q1 - 1.5 * iqr) | (numeric_data > q3 + 1.5 * iqr)
                    outlier_count = outlier_mask.sum()
                    if outlier_count > 0:
                        issues.append({"column": col, "type": "outliers", "count": int(outlier_count),
                                       "severity": "info", "method": "IQR"})

    # 4. Empty strings
    for col in df.select_dtypes(include=['object']).columns:
        empty = (df[col].astype(str).str.strip() == '').sum()
        if empty > 0:
            issues.append({"column": col, "type": "empty_strings", "count": int(empty), "severity": "warning"})

    # 5. Mixed types in string columns
    for col in df.select_dtypes(include=['object']).columns:
        non_null = df[col].dropna()
        if len(non_null) > 0:
            numeric_ratio = pd.to_numeric(non_null, errors='coerce').notna().mean()
            if 0.1 < numeric_ratio < 0.9:
                issues.append({"column": col, "type": "mixed_types", "numeric_ratio": round(numeric_ratio, 2),
                               "severity": "warning"})

    # 6. Whitespace issues
    for col in df.select_dtypes(include=['object']).columns:
        non_null = df[col].dropna().astype(str)
        leading_trailing = (non_null != non_null.str.strip()).sum()
        if leading_trailing > 0:
            issues.append({"column": col, "type": "whitespace", "count": int(leading_trailing), "severity": "info"})

    return {"issues": issues, "total_issues": len(issues)}
