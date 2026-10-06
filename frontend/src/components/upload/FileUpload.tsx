import React, { useState, useCallback } from 'react';
import { fetchApi } from '../../lib/api';

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

      // 2. Upload directly to S3 (using XMLHttpRequest for progress, or fetch if progress not strictly needed)
      // We will use XMLHttpRequest for precise progress
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
            reject(new Error('S3 upload failed'));
          }
        };
        xhr.onerror = () => reject(new Error('S3 upload failed'));

        xhr.open('PUT', upload_url);
        xhr.setRequestHeader('Content-Type', 'text/csv');
        xhr.send(file);
      });

      // 3. Notify backend that upload is complete and create dataset record
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
    <div className="w-full max-w-2xl mx-auto p-6">
      <div 
        className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors
          ${isDragging ? 'border-accent bg-accent-bg' : 'border-border bg-bg'}
          ${uploading ? 'opacity-50 pointer-events-none' : ''}
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
        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="text-4xl mb-4 text-text">📁</div>
          <h3 className="text-xl font-medium text-text-h mb-2">
            {file ? file.name : 'Drag & drop your CSV file here'}
          </h3>
          <p className="text-sm text-text">
            {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : 'or click to browse (max 50MB)'}
          </p>
        </label>
        
        {error && (
          <div className="mt-4 text-red-500 text-sm font-medium bg-red-50 dark:bg-red-900/20 p-3 rounded">
            {error}
          </div>
        )}

        {file && !uploading && (
          <button
            onClick={uploadFile}
            className="mt-6 px-6 py-2 bg-accent text-white font-medium rounded hover:bg-opacity-90 transition-opacity"
          >
            Upload Dataset
          </button>
        )}

        {uploading && (
          <div className="mt-6 w-full max-w-xs mx-auto">
            <div className="h-2 w-full bg-border rounded overflow-hidden">
              <div 
                className="h-full bg-accent transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm text-text mt-2">Uploading... {progress}%</p>
          </div>
        )}
      </div>
    </div>
  );
};
