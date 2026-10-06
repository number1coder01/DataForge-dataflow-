import pandas as pd
import re

def transform(df: pd.DataFrame, schema: dict) -> tuple[pd.DataFrame, dict]:
    """Apply generic transformations. Record every change."""
    log = {"actions": [], "rows_before": len(df)}

    # 1. Normalize column names (lowercase, underscores)
    original_cols = list(df.columns)
    df.columns = [re.sub(r'[^a-z0-9_]', '_', str(col).strip().lower().replace(' ', '_')) for col in df.columns]
    
    # Update schema with new column names
    new_schema = {}
    for old_col, new_col in zip(original_cols, df.columns):
        if old_col in schema:
            new_schema[new_col] = schema[old_col]
    schema.clear()
    schema.update(new_schema)
    
    if list(df.columns) != original_cols:
        log["actions"].append({"action": "normalize_column_names", "changes": dict(zip(original_cols, df.columns))})

    # 2. Trim all string values
    for col in df.select_dtypes(include=['object']).columns:
        df[col] = df[col].apply(lambda x: x.strip() if isinstance(x, str) else x)
    log["actions"].append({"action": "trim_strings"})

    # 3. Parse dates
    for col, meta in schema.items():
        if meta["type"] == "datetime":
            df[col] = pd.to_datetime(df[col], errors='coerce', format='mixed')
            log["actions"].append({"action": "parse_date", "column": col})

    # 4. Remove exact duplicate rows
    before = len(df)
    df = df.drop_duplicates()
    removed = before - len(df)
    if removed > 0:
        log["actions"].append({"action": "remove_duplicates", "rows_removed": removed})

    # 5. Convert numeric columns
    for col, meta in schema.items():
        if meta["type"] == "numeric":
            df[col] = pd.to_numeric(df[col], errors='coerce')
            log["actions"].append({"action": "cast_numeric", "column": col})

    log["rows_after"] = len(df)
    log["rows_removed"] = log["rows_before"] - log["rows_after"]

    return df, log
