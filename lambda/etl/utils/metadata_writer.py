import boto3
import json
import decimal

s3_client = boto3.client('s3')

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, decimal.Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

def write_metadata(data: dict, bucket: str, key: str):
    """Write dict to S3 as JSON."""
    s3_client.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(data, cls=DecimalEncoder),
        ContentType='application/json'
    )
