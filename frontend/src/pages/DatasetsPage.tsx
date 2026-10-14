import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Dataset } from '../lib/types';
import { FileUpload } from '../components/upload/FileUpload';
import { TableSkeleton, CardGridSkeleton } from '../components/layout/SkeletonLoader';
import {
  Database,
  Plus,
  Trash2,
  Loader2,
  Activity,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Upload,
  X,
} from 'lucide-react';

export const DatasetsPage: React.FC = () => {
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const loadDatasets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDatasets();
      setDatasets(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load datasets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDatasets();
  }, [loadDatasets]);

  const handleUploadSuccess = () => {
    setShowUpload(false);
    loadDatasets();
  };

  const handleDelete = async (e: React.MouseEvent, datasetId: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this dataset? This will remove all Bronze raw data and Silver Parquet outputs.')) {
      return;
    }
    try {
      await api.deleteDataset(datasetId);
      loadDatasets();
    } catch (err: any) {
      alert(err.message || 'Failed to delete dataset');
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '—';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'READY':
        return {
          backgroundColor: 'var(--color-success-bg)',
          color: 'var(--color-success)',
          border: '1px solid var(--color-success-border)',
        };
      case 'PROCESSING':
        return {
          backgroundColor: 'var(--color-info-bg)',
          color: 'var(--color-info)',
          border: '1px solid var(--color-info-border)',
        };
      case 'FAILED':
        return {
          backgroundColor: 'var(--color-error-bg)',
          color: 'var(--color-error)',
          border: '1px solid var(--color-error-border)',
        };
      case 'UPLOADED':
        return {
          backgroundColor: 'var(--color-warning-bg)',
          color: 'var(--color-warning)',
          border: '1px solid var(--color-warning-border)',
        };
      default:
        return {};
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold flex items-center gap-2.5"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <Database className="w-6 h-6" style={{ color: 'var(--color-accent-primary)' }} />
            Datasets
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Upload CSV files to automatically trigger the schema inference and ETL processing pipeline.
          </p>
        </div>

        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg transition-all duration-200"
          style={
            showUpload
              ? {
                  backgroundColor: 'var(--color-bg-elevated)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                }
              : {
                  background: 'linear-gradient(135deg, var(--color-accent-gradient-from), var(--color-accent-gradient-to))',
                  color: 'white',
                  boxShadow: '0 4px 15px var(--color-accent-glow)',
                  border: 'none',
                }
          }
        >
          {showUpload ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showUpload ? 'Cancel Upload' : 'Upload New CSV'}
        </button>
      </div>

      {/* Upload Drawer Component */}
      {showUpload && (
        <div
          className="rounded-2xl p-6 shadow-xl animate-fade-in-scale glass-card"
        >
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            <Upload className="w-4 h-4 inline-block mr-2" style={{ color: 'var(--color-accent-primary)' }} />
            Upload Raw Dataset
          </h3>
          <p className="text-xs mb-6" style={{ color: 'var(--color-text-secondary)' }}>
            Files are streamed directly to AWS S3 Bronze storage and will trigger the automated ETL pipeline asynchronously.
          </p>
          <FileUpload onUploadSuccess={handleUploadSuccess} />
        </div>
      )}

      {error && (
        <div
          className="p-4 rounded-xl text-xs flex items-center gap-2 animate-fade-in"
          style={{
            backgroundColor: 'var(--color-error-bg)',
            border: '1px solid var(--color-error-border)',
            color: 'var(--color-error)',
          }}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Datasets Table */}
      {loading ? (
        <div className="space-y-6">
          <CardGridSkeleton count={4} />
          <TableSkeleton rows={4} cols={6} />
        </div>
      ) : datasets.length === 0 ? (
        <div
          className="p-16 text-center rounded-2xl border animate-fade-in-up"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{
              backgroundColor: 'var(--color-accent-glow)',
              border: '1px solid var(--color-border)',
            }}
          >
            <FileSpreadsheet className="w-8 h-8" style={{ color: 'var(--color-accent-primary)' }} />
          </div>
          <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
            No datasets uploaded yet
          </h3>
          <p className="text-xs mb-6" style={{ color: 'var(--color-text-secondary)' }}>
            Upload any CSV file to begin automated profiling, quality checks, and Athena SQL indexing.
          </p>
          <button
            onClick={() => setShowUpload(true)}
            className="px-4 py-2.5 rounded-xl text-white text-xs font-semibold inline-flex items-center gap-2 shadow-lg"
            style={{
              background: 'linear-gradient(135deg, var(--color-accent-gradient-from), var(--color-accent-gradient-to))',
              boxShadow: '0 4px 15px var(--color-accent-glow)',
            }}
          >
            <Plus className="w-4 h-4" />
            Upload CSV Now
          </button>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden shadow-xl glass-card"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr
                  className="border-b text-xs font-semibold uppercase tracking-wider"
                  style={{
                    backgroundColor: 'var(--color-bg-elevated)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  <th className="py-3.5 px-4">Dataset Name</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">File Size</th>
                  <th className="py-3.5 px-4">Rows / Columns</th>
                  <th className="py-3.5 px-4">Uploaded</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {datasets.map((dataset, i) => (
                  <tr
                    key={dataset.dataset_id}
                    onClick={() => navigate(`/datasets/${dataset.dataset_id}`)}
                    className="cursor-pointer transition-colors group animate-fade-in"
                    style={{
                      borderBottom: '1px solid var(--color-border-subtle)',
                      animationDelay: `${i * 50}ms`,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <FileSpreadsheet
                          className="w-4 h-4 transition-colors"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        />
                        <div>
                          <span
                            className="font-semibold block transition-colors"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {dataset.name}
                          </span>
                          <span
                            className="text-[10px] block mt-0.5"
                            style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}
                          >
                            {dataset.dataset_id.slice(0, 8)}...
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          dataset.status === 'PROCESSING' ? 'animate-pulse' : ''
                        }`}
                        style={getStatusStyle(dataset.status)}
                      >
                        {dataset.status === 'PROCESSING' && (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        )}
                        {dataset.status === 'READY' && (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        {dataset.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                      {formatFileSize(dataset.file_size_bytes)}
                    </td>

                    <td className="py-3.5 px-4" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                      {dataset.row_count ? (
                        <span>
                          {dataset.row_count.toLocaleString()} rows
                          {dataset.column_count ? ` • ${dataset.column_count} cols` : ''}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Processing...</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4" style={{ color: 'var(--color-text-secondary)' }}>
                      {new Date(dataset.created_at).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/datasets/${dataset.dataset_id}`);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors"
                          style={{
                            backgroundColor: 'var(--color-accent-glow)',
                            color: 'var(--color-accent-primary)',
                            border: '1px solid var(--color-accent-glow)',
                          }}
                        >
                          <Activity className="w-3 h-3" />
                          View Details
                        </button>

                        <button
                          onClick={(e) => handleDelete(e, dataset.dataset_id)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: 'var(--color-text-muted)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--color-error)';
                            e.currentTarget.style.backgroundColor = 'var(--color-error-bg)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--color-text-muted)';
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          title="Delete Dataset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
