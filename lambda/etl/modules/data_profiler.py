import pandas as pd
import numpy as np

def generate_profile(df: pd.DataFrame, schema: dict) -> dict:
    """Compute basic statistics for each column based on inferred type."""
    profile = {}
    
    for col, meta in schema.items():
        col_type = meta["type"]
        col_data = df[col].dropna()
        
        if len(col_data) == 0:
            profile[col] = {"missing_count": len(df)}
            continue
            
        stats = {
            "missing_count": int(df[col].isnull().sum()),
            "unique_count": int(col_data.nunique()),
        }
        
        if col_type == "numeric":
            numeric_data = pd.to_numeric(col_data, errors='coerce').dropna()
            if len(numeric_data) > 0:
                stats.update({
                    "min": float(numeric_data.min()),
                    "max": float(numeric_data.max()),
                    "mean": float(numeric_data.mean()),
                    "std": float(numeric_data.std()) if len(numeric_data) > 1 else 0.0,
                    "q25": float(numeric_data.quantile(0.25)),
                    "median": float(numeric_data.median()),
                    "q75": float(numeric_data.quantile(0.75))
                })
        elif col_type in ["categorical", "boolean"]:
            value_counts = col_data.value_counts().head(10)
            stats["top_values"] = [{"value": str(k), "count": int(v)} for k, v in value_counts.items()]
            
        profile[col] = stats
        
    return profile
