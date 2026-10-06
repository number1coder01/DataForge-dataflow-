import pandas as pd

def _is_date_parseable(series: pd.Series) -> bool:
    try:
        # Check if more than 80% are parsable dates
        parsed = pd.to_datetime(series, errors='coerce', format='mixed')
        return parsed.notna().mean() > 0.8
    except:
        return False

def detect_schema(df: pd.DataFrame) -> dict:
    """Infer column types without domain assumptions."""
    schema = {}
    for col in df.columns:
        col_data = df[col].dropna()
        if len(col_data) == 0:
            schema[col] = {"type": "unknown", "null_pct": 1.0}
            continue

        null_pct = df[col].isnull().mean()

        # Try numeric
        numeric = pd.to_numeric(col_data, errors='coerce')
        if numeric.notna().mean() > 0.9:
            schema[col] = {"type": "numeric", "null_pct": round(null_pct, 4)}
            continue

        # Try datetime
        if _is_date_parseable(col_data.sample(min(100, len(col_data)))):
            schema[col] = {"type": "datetime", "null_pct": round(null_pct, 4)}
            continue

        # Try boolean
        unique_lower = set(col_data.astype(str).str.lower().unique())
        if unique_lower.issubset({'true','false','yes','no','1','0','t','f','y','n'}):
            schema[col] = {"type": "boolean", "null_pct": round(null_pct, 4)}
            continue

        # Categorical vs String (low cardinality = categorical)
        cardinality = col_data.nunique() / len(col_data)
        if cardinality < 0.05:  # <5% unique values
            schema[col] = {"type": "categorical", "null_pct": round(null_pct, 4)}
        else:
            schema[col] = {"type": "string", "null_pct": round(null_pct, 4)}

    return schema
