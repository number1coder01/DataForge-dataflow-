import json
import urllib.parse
from orchestrator import run_etl_pipeline

def lambda_handler(event, context):
    """
    AWS Lambda handler for the ETL pipeline.
    Triggered by S3 PUT events in the bronze bucket.
    """
    print("Received event:", json.dumps(event))
    
    # Check if this is an S3 event
    if 'Records' not in event:
        # Check if it's a direct invocation
        if 'bucket' in event and 'key' in event and 'dataset_id' in event:
            run_etl_pipeline(event['bucket'], event['key'], event['dataset_id'])
            return {'statusCode': 200, 'body': 'ETL pipeline completed successfully.'}
        return {'statusCode': 400, 'body': 'Invalid event format.'}
        
    for record in event['Records']:
        bucket = record['s3']['bucket']['name']
        key = urllib.parse.unquote_plus(record['s3']['object']['key'], encoding='utf-8')
        
        # Extract dataset_id from key (e.g., bronze/datasets/{dataset_id}/raw.csv)
        try:
            parts = key.split('/')
            if len(parts) >= 3 and parts[0] == 'bronze' and parts[1] == 'datasets':
                dataset_id = parts[2]
                run_etl_pipeline(bucket, key, dataset_id)
            else:
                print(f"Skipping key {key} as it doesn't match expected pattern.")
        except Exception as e:
            print(f"Error processing {key} from bucket {bucket}. Event: {json.dumps(event)}")
            print(e)
            raise e
            
    return {
        'statusCode': 200,
        'body': json.dumps('ETL processing initiated/completed successfully.')
    }
