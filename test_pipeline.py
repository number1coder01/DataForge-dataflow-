import requests, json, boto3

API = 'http://localhost:8000/api'
BUCKET = 'dataflow-platform-kaart'
DATASET_ID = '9044c70f-0064-4d1e-a58d-14eefef1cb57'

# Login
r = requests.post(f'{API}/auth/login', json={'email':'phase5test@dataflow.com','password':'Test1234!'})
token = r.json()['access_token']
H = {'Authorization': f'Bearer {token}'}
print('Authenticated OK')

# Re-invoke Lambda on the already-uploaded file
lc = boto3.client('lambda', region_name='ap-south-1')
payload = {
    'bucket': BUCKET,
    'key': f'bronze/datasets/{DATASET_ID}/raw.csv',
    'dataset_id': DATASET_ID
}
print('Invoking dataflow-etl on 50,500 row CSV...')
resp = lc.invoke(FunctionName='dataflow-etl', InvocationType='RequestResponse', LogType='Tail', Payload=json.dumps(payload))
result = json.loads(resp['Payload'].read())
func_err = resp.get('FunctionError')

print('Status:', result.get('statusCode'))
body = result.get('body', result)
if isinstance(body, dict):
    print('Body:', json.dumps(body, indent=2))
else:
    print('Body:', body)

if func_err:
    import base64
    log = base64.b64decode(resp.get('LogResult', '')).decode('utf-8')
    print('FUNCTION ERROR:', func_err)
    print(log[-3000:])
else:
    r = requests.get(f'{API}/datasets/{DATASET_ID}', headers=H)
    ds = r.json()
    print('\n=== FINAL DATASET STATE ===')
    print(f'Status:   {ds["status"]}')
    print(f'Rows:     {ds.get("row_count")}')
    print(f'Columns:  {ds.get("column_count")}')
    print(f'Silver:   {ds.get("s3_silver_key")}')
    print(f'Athena:   {ds.get("athena_database")}.{ds.get("athena_table")}')
    
    print('\nFetching schema.json from S3...')
    r2 = requests.get(f'{API}/datasets/{DATASET_ID}/schema', headers=H)
    print('Schema:', json.dumps(r2.json(), indent=2))
    
    print('\nFetching quality.json from S3...')
    r3 = requests.get(f'{API}/datasets/{DATASET_ID}/quality', headers=H)
    q = r3.json()
    print(f'Total issues: {q.get("total_issues")}')
    for issue in q.get('issues', [])[:5]:
        print(' -', issue)
