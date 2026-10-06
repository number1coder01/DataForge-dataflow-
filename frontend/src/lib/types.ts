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
}
