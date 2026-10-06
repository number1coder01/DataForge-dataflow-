import os
import boto3
from botocore.exceptions import ClientError
import uuid
from datetime import datetime

# Initialize DynamoDB resource
# When deployed to Lambda, it will use the execution role's credentials.
# Locally, it will use your default AWS profile.
dynamodb = boto3.resource(
    'dynamodb',
    region_name=os.getenv('AWS_REGION', 'ap-south-1')
)

USERS_TABLE_NAME = os.getenv('USERS_TABLE_NAME', 'dataflow-users')

try:
    users_table = dynamodb.Table(USERS_TABLE_NAME)
except Exception:
    users_table = None

def get_user_by_email(email: str):
    try:
        # We query the GSI "email-index"
        response = users_table.query(
            IndexName='email-index',
            KeyConditionExpression=boto3.dynamodb.conditions.Key('email').eq(email)
        )
        items = response.get('Items', [])
        if items:
            return items[0]
        return None
    except ClientError as e:
        print(f"Error getting user by email: {e}")
        return None

def create_user(email: str, password_hash: str, name: str):
    user_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + "Z"
    
    item = {
        'user_id': user_id,
        'email': email,
        'password_hash': password_hash,
        'display_name': name,
        'created_at': now,
        'updated_at': now,
        'status': 'ACTIVE'
    }
    
    try:
        users_table.put_item(Item=item)
        return item
    except ClientError as e:
        print(f"Error creating user: {e}")
        return None

def get_user_by_id(user_id: str):
    try:
        response = users_table.get_item(Key={'user_id': user_id})
        return response.get('Item')
    except ClientError as e:
        print(f"Error getting user by id: {e}")
        return None

DATASETS_TABLE_NAME = os.getenv('DATASETS_TABLE_NAME', 'dataflow-datasets')
try:
    datasets_table = dynamodb.Table(DATASETS_TABLE_NAME)
except Exception:
    datasets_table = None

def create_dataset(dataset_id: str, user_id: str, filename: str, file_size_bytes: int):
    now = datetime.utcnow().isoformat() + "Z"
    item = {
        'dataset_id': dataset_id,
        'user_id': user_id,
        'name': filename,
        'status': 'UPLOADED',
        'created_at': now,
        'updated_at': now,
        'file_size_bytes': file_size_bytes,
        's3_bronze_key': f"bronze/datasets/{dataset_id}/raw.csv"
    }
    
    try:
        datasets_table.put_item(Item=item)
        return item
    except ClientError as e:
        print(f"Error creating dataset: {e}")
        return None

def get_datasets_by_user(user_id: str):
    try:
        response = datasets_table.query(
            IndexName='user_id-index',
            KeyConditionExpression=boto3.dynamodb.conditions.Key('user_id').eq(user_id)
        )
        return response.get('Items', [])
    except ClientError as e:
        print(f"Error getting datasets by user: {e}")
        return []

def get_dataset(dataset_id: str):
    try:
        response = datasets_table.get_item(Key={'dataset_id': dataset_id})
        return response.get('Item')
    except ClientError as e:
        print(f"Error getting dataset: {e}")
        return None

def delete_dataset_record(dataset_id: str):
    try:
        datasets_table.delete_item(Key={'dataset_id': dataset_id})
        return True
    except ClientError as e:
        print(f"Error deleting dataset: {e}")
        return False
