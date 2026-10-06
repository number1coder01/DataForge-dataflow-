# DataFlow

DataFlow is a production-style, dataset-agnostic, serverless data analytics platform.

## Core Flow
UPLOAD → PROCESS → MONITOR → QUERY → VISUALIZE

## Technology Stack
- **Frontend**: React + TypeScript + Vite, Tailwind CSS, Recharts, Monaco Editor
- **Backend**: Python FastAPI + Mangum
- **AWS Infrastructure**: S3, CloudFront, API Gateway, Lambda, DynamoDB, Glue Catalog, Athena, CloudWatch

## Architecture
- **API**: API Gateway HTTP API routing to a FastAPI Lambda function.
- **ETL**: AWS Lambda runs modular Python pipeline for schema detection, profiling, quality checks, and Parquet conversion.
- **Storage**: S3 (Bronze, Silver, Metadata) + DynamoDB (Users, Datasets, Jobs)
- **Analytics**: AWS Athena querying Parquet data stored in S3, defined by Glue Catalog.

## Phases
This repository follows a multi-phase implementation plan.
