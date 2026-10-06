import boto3
from botocore.exceptions import ClientError

glue_client = boto3.client('glue')

def get_glue_type(schema_type: str) -> str:
    """Map our schema types to Glue/Athena types."""
    mapping = {
        "numeric": "double",
        "datetime": "timestamp",
        "boolean": "boolean",
        "categorical": "string",
        "string": "string",
        "unknown": "string"
    }
    return mapping.get(schema_type, "string")

def register_table(database: str, table_name: str, schema: dict, s3_path: str):
    """Register the Parquet file as an Athena/Glue table."""
    columns = [
        {"Name": col_name, "Type": get_glue_type(col_info["type"])}
        for col_name, col_info in schema.items()
    ]
    
    table_input = {
        "Name": table_name,
        "StorageDescriptor": {
            "Columns": columns,
            "Location": s3_path,
            "InputFormat": "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat",
            "OutputFormat": "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat",
            "SerdeInfo": {
                "SerializationLibrary": "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe",
            }
        },
        "TableType": "EXTERNAL_TABLE",
        "Parameters": {
            "classification": "parquet"
        }
    }
    
    try:
        # Create database if it doesn't exist
        try:
            glue_client.get_database(Name=database)
        except ClientError as e:
            if e.response['Error']['Code'] == 'EntityNotFoundException':
                glue_client.create_database(DatabaseInput={'Name': database})
            else:
                raise
                
        # Create or update table
        try:
            glue_client.get_table(DatabaseName=database, Name=table_name)
            glue_client.update_table(DatabaseName=database, TableInput=table_input)
        except ClientError as e:
            if e.response['Error']['Code'] == 'EntityNotFoundException':
                glue_client.create_table(DatabaseName=database, TableInput=table_input)
            else:
                raise
                
    except Exception as e:
        print(f"Error registering table in Glue: {e}")
        raise
