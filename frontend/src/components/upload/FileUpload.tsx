import React, { useState } from 'react';
import { fetchApi } from '../../lib/api';
import {
  UploadCloud,
  FileSpreadsheet,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface FileUploadProps {
  onUploadSuccess: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUploadSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const validateFile = (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv') && selectedFile.type !== 'text/csv') {
      setError('Only CSV files are allowed');
      return false;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('File too large (max 50MB)');
      return false;
    }
    return true;
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selectedFile = e.dataTransfer.files[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
      }
    }
  };

  const uploadFile = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      // 1. Get presigned URL
      const { upload_url, dataset_id } = await fetchApi('/api/datasets/upload-url', {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          file_size: file.size,
        }),
      });

      // 2. Upload directly to S3 with upload progress tracking
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            setProgress(percentComplete);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.response);
          } else {
            reject(new Error(`S3 direct upload failed (HTTP ${xhr.status}: ${xhr.statusText || 'Error'})`));
          }
        };
        xhr.onerror = () => reject(new Error('S3 direct upload failed (Network or CORS error)'));

        xhr.open('PUT', upload_url);
        xhr.setRequestHeader('Content-Type', 'text/csv');
        xhr.send(file);
      });

      // 3. Notify backend that upload is complete & trigger async ETL Lambda
      await fetchApi('/api/datasets', {
        method: 'POST',
        body: JSON.stringify({
          dataset_id,
          filename: file.name,
        }),
      });

      setFile(null);
      setProgress(100);
      onUploadSuccess();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200
          ${
            isDragging
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
          }
          ${uploading ? 'opacity-60 pointer-events-none' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="hidden"
          id="file-upload"
          disabled={uploading}
        />
        <label htmlFor="file-upload" className="cursor-pointer block">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-4">
            {file ? (
              <FileSpreadsheet className="w-7 h-7" />
            ) : (
              <UploadCloud className="w-7 h-7" />
            )}
          </div>
          <h3 className="text-base font-semibold text-white mb-1">
            {file ? file.name : 'Drag and drop your CSV file here'}
          </h3>
          <p className="text-xs text-slate-400">
            {file
              ? `${(file.size / (1024 * 1024)).toFixed(2)} MB • Ready to stream to S3 Bronze`
              : 'or browse from your computer (max 50MB)'}
          </p>
        </label>

        {error && (
          <div className="mt-4 text-xs font-semibold text-rose-400 bg-rose-950/40 border border-rose-900 p-3 rounded-xl flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {file && !uploading && (
          <button
            onClick={uploadFile}
            className="mt-6 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all"
          >
            Start Ingestion & Trigger ETL
          </button>
        )}

        {uploading && (
          <div className="mt-6 w-full max-w-xs mx-auto space-y-2">
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                Streaming to S3...
              </span>
              <span className="font-mono font-semibold text-slate-200">{progress}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
