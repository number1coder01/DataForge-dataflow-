import React, { useState, useEffect, useCallback } from 'react';
import { fetchApi } from '../lib/api';
import type { Dataset } from '../lib/types';
import { FileUpload } from '../components/upload/FileUpload';

export const DatasetsPage: React.FC = () => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const loadDatasets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi('/api/datasets');
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

  const handleDelete = async (datasetId: string) => {
    if (!window.confirm('Are you sure you want to delete this dataset?')) return;
    try {
      await fetchApi(`/api/datasets/${datasetId}`, { method: 'DELETE' });
      loadDatasets();
    } catch (err: any) {
      alert(err.message || 'Failed to delete dataset');
    }
  };

  return (
    <div className="p-8 text-left w-full max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-text-h m-0">Datasets</h1>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="px-4 py-2 bg-accent text-white font-medium rounded hover:bg-opacity-90"
        >
          {showUpload ? 'Cancel Upload' : '+ New Dataset'}
        </button>
      </div>

      {showUpload && (
        <div className="mb-10 bg-bg border border-border rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Upload New Dataset</h2>
          <FileUpload onUploadSuccess={handleUploadSuccess} />
        </div>
      )}

      {error && (
        <div className="text-red-500 bg-red-50 p-4 rounded mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-text">Loading datasets...</div>
      ) : datasets.length === 0 ? (
        <div className="text-center py-16 bg-bg border border-border rounded-xl">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-xl font-medium text-text-h mb-2">No datasets yet</h3>
          <p className="text-text mb-6">Upload your first CSV file to get started</p>
          <button
            onClick={() => setShowUpload(true)}
            className="px-6 py-2 bg-accent text-white font-medium rounded hover:bg-opacity-90"
          >
            Upload CSV
          </button>
        </div>
      ) : (
        <div className="bg-bg border border-border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-social-bg border-b border-border text-sm uppercase text-text font-medium">
                <th className="p-4">Name</th>
                <th className="p-4">Status</th>
                <th className="p-4">Size</th>
                <th className="p-4">Created</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((dataset) => (
                <tr key={dataset.dataset_id} className="border-b border-border last:border-0 hover:bg-social-bg/50">
                  <td className="p-4 font-medium text-text-h">{dataset.name}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs rounded-full font-medium
                      ${dataset.status === 'READY' ? 'bg-green-100 text-green-800' : ''}
                      ${dataset.status === 'FAILED' ? 'bg-red-100 text-red-800' : ''}
                      ${dataset.status === 'UPLOADED' || dataset.status === 'PROCESSING' ? 'bg-blue-100 text-blue-800' : ''}
                    `}>
                      {dataset.status}
                    </span>
                  </td>
                  <td className="p-4 text-text">
                    {dataset.file_size_bytes 
                      ? `${(dataset.file_size_bytes / (1024 * 1024)).toFixed(2)} MB` 
                      : '-'}
                  </td>
                  <td className="p-4 text-text text-sm">
                    {new Date(dataset.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => handleDelete(dataset.dataset_id)}
                      className="text-red-500 hover:text-red-700 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
