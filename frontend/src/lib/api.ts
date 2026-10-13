import type {
  Dataset,
  Job,
  SchemaMetadata,
  ProfileMetadata,
  QualityMetadata,
  TransformLogMetadata,
  DashboardConfig,
  ChartQueryResult,
} from './types';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const fetchApi = async <T = any>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
    }
    const errorData = await response.json().catch(() => ({}));
    let errorMessage = 'API request failed';
    if (typeof errorData.detail === 'string') {
      errorMessage = errorData.detail;
    } else if (Array.isArray(errorData.detail)) {
      errorMessage = errorData.detail
        .map((item: any) => {
          if (typeof item === 'string') return item;
          const msg = item.msg || item.message || JSON.stringify(item);
          return msg.replace(/^Value error,\s*/i, '');
        })
        .join('. ');
    } else if (errorData.message) {
      errorMessage = String(errorData.message);
    }
    throw new Error(errorMessage);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
};

export const api = {
  // Datasets
  getDatasets: () => fetchApi<Dataset[]>('/api/datasets'),
  getDataset: (id: string) => fetchApi<Dataset>(`/api/datasets/${id}`),
  deleteDataset: (id: string) => fetchApi<void>(`/api/datasets/${id}`, { method: 'DELETE' }),

  // Jobs
  getAllJobs: () => fetchApi<Job[]>('/api/jobs'),
  getJob: (jobId: string) => fetchApi<Job>(`/api/jobs/${jobId}`),
  getDatasetJobs: (datasetId: string) => fetchApi<Job[]>(`/api/jobs/dataset/${datasetId}`),

  // Metadata
  getSchema: (datasetId: string) => fetchApi<SchemaMetadata>(`/api/datasets/${datasetId}/schema`),
  getProfile: (datasetId: string) => fetchApi<ProfileMetadata>(`/api/datasets/${datasetId}/profile`),
  getQuality: (datasetId: string) => fetchApi<QualityMetadata>(`/api/datasets/${datasetId}/quality`),
  getTransformLog: (datasetId: string) => fetchApi<TransformLogMetadata>(`/api/datasets/${datasetId}/transform-log`),

  // Dashboard
  getDashboard: (datasetId: string) => fetchApi<DashboardConfig>(`/api/datasets/${datasetId}/dashboard`),
  queryDashboardChart: (datasetId: string, sql: string) =>
    fetchApi<ChartQueryResult>(`/api/datasets/${datasetId}/dashboard/query`, {
      method: 'POST',
      body: JSON.stringify({ sql }),
    }),
};
