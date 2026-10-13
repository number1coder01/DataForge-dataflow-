export interface User {
  user_id: string;
  email: string;
  name: string;
}

export interface Dataset {
  dataset_id: string;
  user_id: string;
  name: string;
  status: 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED';
  created_at: string;
  updated_at: string;
  file_size_bytes?: number;
  row_count?: number;
  column_count?: number;
  s3_bronze_key?: string;
  s3_silver_key?: string;
  athena_table?: string;
  athena_database?: string;
}

export type StageStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';

export interface StageInfo {
  status: StageStatus;
  updated_at?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  columns?: number;
  row_count?: number;
  rows_before?: number;
  rows_after?: number;
  table_name?: string;
  error?: string;
  [key: string]: any;
}

export type JobStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';

export interface Job {
  job_id: string;
  dataset_id: string;
  dataset_name?: string;
  user_id: string;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  duration_ms?: number;
  error_message?: string;
  stages?: Record<string, StageInfo>;
}

export type ColumnType = 'numeric' | 'datetime' | 'boolean' | 'categorical' | 'string' | 'unknown';

export interface ColumnSchema {
  type: ColumnType;
  null_pct: number;
}

export type SchemaMetadata = Record<string, ColumnSchema>;

export interface ColumnProfile {
  missing_count: number;
  unique_count?: number;
  min?: number;
  max?: number;
  mean?: number;
  std?: number;
  median?: number;
  q25?: number;
  q75?: number;
  top_values?: { value: string; count: number }[];
}

export type ProfileMetadata = Record<string, ColumnProfile>;

export interface QualityIssue {
  column?: string;
  type: 'duplicates' | 'nulls' | 'outliers' | 'empty_strings' | 'mixed_types' | 'whitespace' | string;
  count?: number;
  pct?: number;
  severity: 'critical' | 'warning' | 'info';
  numeric_ratio?: number;
  method?: string;
}

export interface QualityMetadata {
  issues: QualityIssue[];
  total_issues: number;
}

export interface TransformAction {
  action: string;
  changes?: Record<string, string>;
  column?: string;
  rows_removed?: number;
}

export interface TransformLogMetadata {
  actions: TransformAction[];
  rows_before: number;
  rows_after: number;
  rows_removed: number;
}

// ── Dashboard Types ──

export type ChartType = 'line' | 'bar' | 'scatter' | 'pie' | 'multi_line' | 'area';

export interface ChartRecommendation {
  chart_type: ChartType;
  title: string;
  x_column: string;
  y_column: string;
  group_column?: string;
  reason: string;
  sql: string;
}

export interface DashboardKPI {
  label: string;
  value: number;
  format: 'number' | 'decimal' | 'percentage';
  icon: string;
}

export interface DashboardFilter {
  column: string;
  label: string;
  options: string[];
}

export interface DashboardConfig {
  dataset_id: string;
  dataset_name: string;
  athena_database: string;
  athena_table: string;
  recommendations: ChartRecommendation[];
  kpis: DashboardKPI[];
  filters: DashboardFilter[];
}

export interface ChartQueryResult {
  sql: string;
  row_count: number;
  data: Record<string, any>[];
}

