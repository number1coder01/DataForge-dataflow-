import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import type {
  Dataset,
  Job,
  SchemaMetadata,
  ProfileMetadata,
  QualityMetadata,
  TransformLogMetadata,
} from '../lib/types';
import { usePolling } from '../hooks/usePolling';
import { PipelineTimeline } from '../components/pipeline/PipelineTimeline';
import { SchemaTable } from '../components/metadata/SchemaTable';
import { ProfileCards } from '../components/metadata/ProfileCards';
import { QualityReport } from '../components/metadata/QualityReport';
import { AutoDashboard } from '../components/dashboard/AutoDashboard';
import {
  ArrowLeft,
  Activity,
  Layers,
  BarChart3,
  ShieldCheck,
  LayoutDashboard,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';

type TabType = 'pipeline' | 'schema' | 'profile' | 'quality' | 'dashboard';

export const DatasetDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabType>('pipeline');
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [datasetLoading, setDatasetLoading] = useState<boolean>(true);
  const [datasetError, setDatasetError] = useState<string | null>(null);

  // Metadata states
  const [schema, setSchema] = useState<SchemaMetadata | null>(null);
  const [profile, setProfile] = useState<ProfileMetadata | null>(null);
  const [quality, setQuality] = useState<QualityMetadata | null>(null);
  const [transformLog, setTransformLog] = useState<TransformLogMetadata | null>(null);
  const [metadataLoading, setMetadataLoading] = useState<boolean>(false);

  // Load dataset detail
  const loadDataset = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.getDataset(id);
      setDataset(data);
      return data;
    } catch (err: any) {
      setDatasetError(err.message || 'Failed to load dataset details');
      return null;
    } finally {
      setDatasetLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDataset();
  }, [loadDataset]);

  // Polling for latest job of this dataset
  const fetchLatestJob = useCallback(async (): Promise<Job | null> => {
    if (!id) return null;
    try {
      const jobs = await api.getDatasetJobs(id);
      if (jobs && jobs.length > 0) {
        return jobs[0]; // Most recent job
      }
      return null;
    } catch (err) {
      return null;
    }
  }, [id]);

  const {
    data: currentJob,
    isPolling,
    refetch: refetchJob,
  } = usePolling<Job | null>(fetchLatestJob, {
    interval: 2000,
    enabled: true,
    shouldStop: (job) => job?.status === 'SUCCESS' || job?.status === 'FAILED',
    onSuccess: (job) => {
      // If job just completed, refresh dataset details & metadata
      if (job?.status === 'SUCCESS') {
        loadDataset();
      }
    },
  });

  // Load metadata when switching to metadata tabs or when job succeeds
  const loadMetadata = useCallback(async () => {
    if (!id) return;
    setMetadataLoading(true);
    try {
      const [sData, pData, qData, tData] = await Promise.allSettled([
        api.getSchema(id),
        api.getProfile(id),
        api.getQuality(id),
        api.getTransformLog(id),
      ]);

      if (sData.status === 'fulfilled') setSchema(sData.value);
      if (pData.status === 'fulfilled') setProfile(pData.value);
      if (qData.status === 'fulfilled') setQuality(qData.value);
      if (tData.status === 'fulfilled') setTransformLog(tData.value);
    } catch (err) {
      console.error('Error fetching metadata:', err);
    } finally {
      setMetadataLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (activeTab !== 'pipeline' || dataset?.status === 'READY') {
      loadMetadata();
    }
  }, [activeTab, dataset?.status, loadMetadata]);

  if (datasetLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-3" />
        <p className="text-sm">Loading dataset details...</p>
      </div>
    );
  }

  if (datasetError || !dataset) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">Dataset Not Found</h3>
        <p className="text-slate-400 text-sm mb-6">{datasetError || 'Could not find this dataset.'}</p>
        <Link
          to="/datasets"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Datasets
        </Link>
      </div>
    );
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '—';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/datasets')}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-white">{dataset.name}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold
                  ${dataset.status === 'READY' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : ''}
                  ${dataset.status === 'PROCESSING' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30 animate-pulse' : ''}
                  ${dataset.status === 'FAILED' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : ''}
                  ${dataset.status === 'UPLOADED' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : ''}
                `}
              >
                {dataset.status}
              </span>
            </div>
            <span className="font-mono text-xs text-slate-400 block mt-0.5">
              ID: {dataset.dataset_id}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              loadDataset();
              refetchJob();
              loadMetadata();
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Dataset Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block">File Size</span>
          <span className="text-base font-bold font-mono text-white mt-1 block">
            {formatFileSize(dataset.file_size_bytes)}
          </span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block">Row Count</span>
          <span className="text-base font-bold font-mono text-emerald-400 mt-1 block">
            {dataset.row_count ? dataset.row_count.toLocaleString() : 'Processing...'}
          </span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block">Detected Columns</span>
          <span className="text-base font-bold font-mono text-cyan-400 mt-1 block">
            {dataset.column_count ? `${dataset.column_count} cols` : 'Processing...'}
          </span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block">Glue / Athena Table</span>
          <span className="text-xs font-mono font-semibold text-purple-300 mt-1 block truncate">
            {dataset.athena_table || 'Pending registration'}
          </span>
        </div>
      </div>

      {/* Main Tab Controls */}
      <div className="border-b border-slate-800">
        <nav className="flex items-center gap-2 -mb-px">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-semibold transition-all duration-200 ${
              activeTab === 'pipeline'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Activity className="w-4 h-4" />
            Live Pipeline
            {isPolling && (
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping ml-1" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('schema')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-semibold transition-all duration-200 ${
              activeTab === 'schema'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Layers className="w-4 h-4" />
            Schema
            {schema && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {Object.keys(schema).length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-semibold transition-all duration-200 ${
              activeTab === 'profile'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Profiling
          </button>

          <button
            onClick={() => setActiveTab('quality')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-semibold transition-all duration-200 ${
              activeTab === 'quality'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Quality Audit
            {quality && quality.total_issues > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {quality.total_issues} issues
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-semibold transition-all duration-200 ${
              activeTab === 'dashboard'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-cyan-400" />
            Dashboard
            {dataset.status === 'READY' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-medium">
                Auto
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Active Tab Content */}
      <div>
        {activeTab === 'pipeline' && (
          <div>
            {currentJob ? (
              <PipelineTimeline job={currentJob} isPolling={isPolling} />
            ) : (
              <div className="p-12 text-center bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-400">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
                <h4 className="text-base font-semibold text-white">Initializing ETL Pipeline...</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Connecting to orchestrator and listening for job updates.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'schema' && (
          <SchemaTable schema={schema || {}} isLoading={metadataLoading} />
        )}

        {activeTab === 'profile' && (
          <ProfileCards profile={profile || {}} schema={schema || {}} isLoading={metadataLoading} />
        )}

        {activeTab === 'quality' && (
          <QualityReport
            quality={quality || { issues: [], total_issues: 0 }}
            transformLog={transformLog}
            isLoading={metadataLoading}
          />
        )}

        {activeTab === 'dashboard' && (
          <AutoDashboard
            datasetId={dataset.dataset_id}
            schema={schema || {}}
            profile={profile || {}}
          />
        )}
      </div>
    </div>
  );
};
