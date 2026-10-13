import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Dataset } from '../lib/types';
import { FileUpload } from '../components/upload/FileUpload';
import {
  Database,
  Plus,
  Trash2,
  Loader2,
  Activity,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Database className="w-6 h-6 text-blue-400" />
            Datasets
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Upload CSV files to automatically trigger the schema inference and ETL processing pipeline.
          </p>
        </div>

        <button
          onClick={() => setShowUpload(!showUpload)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg transition-all duration-200 ${
            showUpload
              ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/20'
          }`}
        >
          <Plus className="w-4 h-4" />
          {showUpload ? 'Cancel Upload' : 'Upload New CSV'}
        </button>
      </div>

      {/* Upload Drawer Component */}
      {showUpload && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-sm font-semibold text-white mb-2">Upload Raw Dataset</h3>
          <p className="text-xs text-slate-400 mb-6">
            Files are streamed directly to AWS S3 Bronze storage and will trigger the automated ETL pipeline asynchronously.
          </p>
          <FileUpload onUploadSuccess={handleUploadSuccess} />
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-900 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Datasets Table */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-sm">Loading your datasets...</p>
        </div>
      ) : datasets.length === 0 ? (
        <div className="p-16 text-center bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-400">
          <FileSpreadsheet className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white mb-1">No datasets uploaded yet</h3>
          <p className="text-xs text-slate-400 mb-6">
            Upload any CSV file to begin automated profiling, quality checks, and Athena SQL indexing.
          </p>
          <button
            onClick={() => setShowUpload(true)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Upload CSV Now
          </button>
        </div>
      ) : (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800/60 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Dataset Name</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">File Size</th>
                  <th className="py-3.5 px-4">Rows / Columns</th>
                  <th className="py-3.5 px-4">Uploaded</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {datasets.map((dataset) => (
                  <tr
                    key={dataset.dataset_id}
                    onClick={() => navigate(`/datasets/${dataset.dataset_id}`)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <FileSpreadsheet className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors" />
                        <div>
                          <span className="font-semibold text-slate-100 group-hover:text-blue-400 transition-colors block">
                            {dataset.name}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">
                            {dataset.dataset_id.slice(0, 8)}...
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold
                          ${dataset.status === 'READY' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : ''}
                          ${dataset.status === 'PROCESSING' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30 animate-pulse' : ''}
                          ${dataset.status === 'FAILED' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : ''}
                          ${dataset.status === 'UPLOADED' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : ''}
                        `}
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

                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {formatFileSize(dataset.file_size_bytes)}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {dataset.row_count ? (
                        <span>
                          {dataset.row_count.toLocaleString()} rows
                          {dataset.column_count ? ` • ${dataset.column_count} cols` : ''}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">Processing...</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(dataset.created_at).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/datasets/${dataset.dataset_id}`);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600/15 text-blue-400 border border-blue-500/30 hover:bg-blue-600/25 transition-colors"
                        >
                          <Activity className="w-3 h-3" />
                          View Details
                        </button>

                        <button
                          onClick={(e) => handleDelete(e, dataset.dataset_id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
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
