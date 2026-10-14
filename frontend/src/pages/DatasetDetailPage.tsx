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
import { DetailSkeleton } from '../components/layout/SkeletonLoader';
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
    return <DetailSkeleton />;
  }

  if (datasetError || !dataset) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center animate-fade-in">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)' }}
        >
          <AlertCircle className="w-10 h-10" style={{ color: 'var(--color-error)' }} />
        </div>
        <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>Dataset Not Found</h3>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>{datasetError || 'Could not find this dataset.'}</p>
        <Link
          to="/datasets"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-semibold"
          style={{ background: 'linear-gradient(135deg, var(--color-accent-gradient-from), var(--color-accent-gradient-to))' }}
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

  const getStatusStyle = (status: string): React.CSSProperties => {
    switch (status) {
      case 'READY':
        return { backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', border: '1px solid var(--color-success-border)' };
      case 'PROCESSING':
        return { backgroundColor: 'var(--color-info-bg)', color: 'var(--color-info)', border: '1px solid var(--color-info-border)' };
      case 'FAILED':
        return { backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)', border: '1px solid var(--color-error-border)' };
      case 'UPLOADED':
        return { backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)', border: '1px solid var(--color-warning-border)' };
      default:
        return {};
    }
  };

  const tabItems: { key: TabType; icon: React.ReactNode; label: string; badge?: React.ReactNode }[] = [
    {
      key: 'pipeline',
      icon: <Activity className="w-4 h-4" />,
      label: 'Live Pipeline',
      badge: isPolling ? <span className="w-2 h-2 rounded-full animate-ping ml-1" style={{ backgroundColor: 'var(--color-info)' }} /> : undefined,
    },
    {
      key: 'schema',
      icon: <Layers className="w-4 h-4" />,
      label: 'Schema',
      badge: schema ? (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}
        >
          {Object.keys(schema).length}
        </span>
      ) : undefined,
    },
    {
      key: 'profile',
      icon: <BarChart3 className="w-4 h-4" />,
      label: 'Profiling',
    },
    {
      key: 'quality',
      icon: <ShieldCheck className="w-4 h-4" />,
      label: 'Quality Audit',
      badge: quality && quality.total_issues > 0 ? (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)', border: '1px solid var(--color-warning-border)' }}
        >
          {quality.total_issues} issues
        </span>
      ) : undefined,
    },
    {
      key: 'dashboard',
      icon: <LayoutDashboard className="w-4 h-4" style={{ color: 'var(--color-info)' }} />,
      label: 'Dashboard',
      badge: dataset.status === 'READY' ? (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
          style={{ backgroundColor: 'var(--color-info-bg)', color: 'var(--color-info)', border: '1px solid var(--color-info-border)' }}
        >
          Auto
        </span>
      ) : undefined,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/datasets')}
            className="p-2 rounded-xl border transition-colors"
            style={{
              backgroundColor: 'var(--color-bg-elevated)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{dataset.name}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${dataset.status === 'PROCESSING' ? 'animate-pulse' : ''}`}
                style={getStatusStyle(dataset.status)}
              >
                {dataset.status}
              </span>
            </div>
            <span className="text-xs block mt-0.5" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)' }}>
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
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors"
            style={{
              backgroundColor: 'var(--color-bg-elevated)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Dataset Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-children">
        <div
          className="p-4 rounded-xl border"
          style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}
        >
          <span className="text-xs block" style={{ color: 'var(--color-text-secondary)' }}>File Size</span>
          <span className="text-base font-bold mt-1 block" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
            {formatFileSize(dataset.file_size_bytes)}
          </span>
        </div>

        <div
          className="p-4 rounded-xl border"
          style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}
        >
          <span className="text-xs block" style={{ color: 'var(--color-text-secondary)' }}>Row Count</span>
          <span className="text-base font-bold mt-1 block" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-success)' }}>
            {dataset.row_count ? dataset.row_count.toLocaleString() : 'Processing...'}
          </span>
        </div>

        <div
          className="p-4 rounded-xl border"
          style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}
        >
          <span className="text-xs block" style={{ color: 'var(--color-text-secondary)' }}>Detected Columns</span>
          <span className="text-base font-bold mt-1 block" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-info)' }}>
            {dataset.column_count ? `${dataset.column_count} cols` : 'Processing...'}
          </span>
        </div>

        <div
          className="p-4 rounded-xl border"
          style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}
        >
          <span className="text-xs block" style={{ color: 'var(--color-text-secondary)' }}>Glue / Athena Table</span>
          <span className="text-xs font-semibold mt-1 block truncate" style={{ fontFamily: 'var(--font-mono)', color: '#c084fc' }}>
            {dataset.athena_table || 'Pending registration'}
          </span>
        </div>
      </div>

      {/* Main Tab Controls */}
      <div className="border-b" style={{ borderColor: 'var(--color-border)' }}>
        <nav className="flex items-center gap-1 -mb-px overflow-x-auto">
          {tabItems.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-semibold transition-all duration-200 whitespace-nowrap"
              style={
                activeTab === tab.key
                  ? {
                      borderColor: 'var(--color-accent-primary)',
                      color: 'var(--color-accent-primary)',
                      backgroundColor: 'var(--color-accent-glow)',
                    }
                  : {
                      borderColor: 'transparent',
                      color: 'var(--color-text-secondary)',
                    }
              }
            >
              {tab.icon}
              {tab.label}
              {tab.badge}
            </button>
          ))}
        </nav>
      </div>

      {/* Active Tab Content */}
      <div className="animate-fade-in" key={activeTab}>
        {activeTab === 'pipeline' && (
          <div>
            {currentJob ? (
              <PipelineTimeline job={currentJob} isPolling={isPolling} />
            ) : (
              <div
                className="p-12 text-center rounded-2xl border"
                style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}
              >
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: 'var(--color-accent-primary)' }} />
                <h4 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Initializing ETL Pipeline...</h4>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
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
