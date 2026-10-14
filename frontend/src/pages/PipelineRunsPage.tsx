import React, { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Job, JobStatus } from '../lib/types';
import { usePolling } from '../hooks/usePolling';
import { PipelineTimeline } from '../components/pipeline/PipelineTimeline';
import { TableSkeleton, CardGridSkeleton } from '../components/layout/SkeletonLoader';
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';

export const PipelineRunsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    return await api.getAllJobs();
  }, []);

  const {
    data: jobs,
    loading,
    isPolling,
    refetch,
  } = usePolling<Job[]>(fetchJobs, {
    interval: 3000,
    enabled: true,
    shouldStop: (jobList) => !jobList?.some((j) => j.status === 'RUNNING' || j.status === 'PENDING'),
  });

  const jobList = jobs || [];

  const filteredJobs = useMemo(() => {
    return jobList.filter((job) => {
      const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        job.job_id.toLowerCase().includes(term) ||
        (job.dataset_name && job.dataset_name.toLowerCase().includes(term)) ||
        job.dataset_id.toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [jobList, statusFilter, searchTerm]);

  const stats = useMemo(() => {
    const total = jobList.length;
    const running = jobList.filter((j) => j.status === 'RUNNING').length;
    const success = jobList.filter((j) => j.status === 'SUCCESS').length;
    const failed = jobList.filter((j) => j.status === 'FAILED').length;
    return { total, running, success, failed };
  }, [jobList]);

  const formatDuration = (ms?: number) => {
    if (ms === undefined || ms === null) return '—';
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  };

  const getStatusBadge = (status: JobStatus) => {
    const styles: Record<string, { bg: string; color: string; border: string }> = {
      SUCCESS: { bg: 'var(--color-success-bg)', color: 'var(--color-success)', border: 'var(--color-success-border)' },
      RUNNING: { bg: 'var(--color-info-bg)', color: 'var(--color-info)', border: 'var(--color-info-border)' },
      FAILED: { bg: 'var(--color-error-bg)', color: 'var(--color-error)', border: 'var(--color-error-border)' },
      PENDING: { bg: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)', border: 'var(--color-border)' },
    };
    const s = styles[status] || styles.PENDING;
    const icons: Record<string, React.ReactNode> = {
      SUCCESS: <CheckCircle2 className="w-3.5 h-3.5" />,
      RUNNING: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
      FAILED: <AlertCircle className="w-3.5 h-3.5" />,
      PENDING: <Clock className="w-3.5 h-3.5" />,
    };

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${status === 'RUNNING' ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}
      >
        {icons[status]}
        {status}
      </span>
    );
  };

  const filterButtons: { key: string; label: string; count: number; activeColor: string }[] = [
    { key: 'all', label: 'All', count: stats.total, activeColor: 'var(--color-text-primary)' },
    { key: 'RUNNING', label: 'Running', count: stats.running, activeColor: 'var(--color-info)' },
    { key: 'SUCCESS', label: 'Success', count: stats.success, activeColor: 'var(--color-success)' },
    { key: 'FAILED', label: 'Failed', count: stats.failed, activeColor: 'var(--color-error)' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Pipeline Executions</h1>
            {isPolling && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono animate-pulse"
                style={{
                  backgroundColor: 'var(--color-info-bg)',
                  color: 'var(--color-info)',
                  border: '1px solid var(--color-info-border)',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: 'var(--color-info)' }} />
                Live Polling
              </span>
            )}
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Monitor and inspect execution history for all ETL pipeline jobs.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors self-start sm:self-auto"
          style={{
            backgroundColor: 'var(--color-bg-elevated)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Runs
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-children">
        <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
          <span className="text-xs block" style={{ color: 'var(--color-text-secondary)' }}>Total Pipeline Runs</span>
          <span className="text-xl font-bold mt-1 block" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{stats.total}</span>
        </div>
        <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
          <span className="text-xs block" style={{ color: 'var(--color-text-secondary)' }}>Active Running</span>
          <span className="text-xl font-bold mt-1 block" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-info)' }}>{stats.running}</span>
        </div>
        <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
          <span className="text-xs block" style={{ color: 'var(--color-text-secondary)' }}>Successful Runs</span>
          <span className="text-xl font-bold mt-1 block" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-success)' }}>{stats.success}</span>
        </div>
        <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
          <span className="text-xs block" style={{ color: 'var(--color-text-secondary)' }}>Failed Executions</span>
          <span className="text-xl font-bold mt-1 block" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-error)' }}>{stats.failed}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="Search by Dataset Name or Job ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl pl-9 pr-3 py-2 text-xs outline-none transition-all"
            style={{
              backgroundColor: 'var(--color-bg-input)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--color-border-focus)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
          />
        </div>

        <div
          className="flex items-center gap-1 p-1 rounded-xl border text-xs w-full sm:w-auto"
          style={{ backgroundColor: 'var(--color-bg-input)', borderColor: 'var(--color-border)' }}
        >
          {filterButtons.map((btn) => (
            <button
              key={btn.key}
              onClick={() => setStatusFilter(btn.key)}
              className="px-3 py-1.5 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: statusFilter === btn.key ? 'var(--color-bg-elevated)' : 'transparent',
                color: statusFilter === btn.key ? btn.activeColor : 'var(--color-text-tertiary)',
              }}
            >
              {btn.label} ({btn.count})
            </button>
          ))}
        </div>
      </div>

      {/* Table or Empty State */}
      {loading && jobList.length === 0 ? (
        <TableSkeleton rows={4} cols={7} />
      ) : filteredJobs.length === 0 ? (
        <div
          className="p-16 text-center rounded-2xl border animate-fade-in-up"
          style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'var(--color-accent-glow)', border: '1px solid var(--color-border)' }}
          >
            <Activity className="w-7 h-7" style={{ color: 'var(--color-accent-primary)' }} />
          </div>
          <h4 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>No pipeline executions found</h4>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Upload a dataset to trigger your first automated ETL run.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden shadow-xl glass-card">
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
                  <th className="py-3.5 px-4">Job ID</th>
                  <th className="py-3.5 px-4">Dataset</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Stages</th>
                  <th className="py-3.5 px-4">Duration</th>
                  <th className="py-3.5 px-4">Created</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {filteredJobs.map((job, i) => {
                  const isExpanded = expandedJobId === job.job_id;
                  const stages = job.stages || {};
                  const successStages = Object.values(stages).filter((s) => s.status === 'SUCCESS').length;

                  return (
                    <React.Fragment key={job.job_id}>
                      <tr
                        className="transition-colors animate-fade-in"
                        style={{
                          borderBottom: '1px solid var(--color-border-subtle)',
                          animationDelay: `${i * 40}ms`,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td className="py-3.5 px-4 font-medium" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                          #{job.job_id.slice(0, 8)}
                        </td>
                        <td className="py-3.5 px-4">
                          <Link
                            to={`/datasets/${job.dataset_id}`}
                            className="font-medium flex items-center gap-1.5 hover:underline"
                            style={{ color: 'var(--color-accent-primary)' }}
                          >
                            {job.dataset_name || 'Dataset'}
                            <ExternalLink className="w-3 h-3" style={{ color: 'var(--color-text-muted)' }} />
                          </Link>
                        </td>
                        <td className="py-3.5 px-4">{getStatusBadge(job.status)}</td>
                        <td className="py-3.5 px-4" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                          {successStages} / 7 completed
                        </td>
                        <td className="py-3.5 px-4" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                          {formatDuration(job.duration_ms)}
                        </td>
                        <td className="py-3.5 px-4" style={{ color: 'var(--color-text-secondary)' }}>
                          {new Date(job.created_at).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => setExpandedJobId(isExpanded ? null : job.job_id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                            style={{
                              backgroundColor: 'var(--color-bg-elevated)',
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text-primary)',
                            }}
                          >
                            <span>{isExpanded ? 'Hide Timeline' : 'View Timeline'}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Execution Timeline Drawer */}
                      {isExpanded && (
                        <tr style={{ backgroundColor: 'var(--color-bg-primary)' }}>
                          <td colSpan={7} className="p-6">
                            <div
                              className="rounded-2xl p-6 shadow-inner animate-fade-in-scale glass-card"
                            >
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                                  <Activity className="w-4 h-4" style={{ color: 'var(--color-accent-primary)' }} />
                                  Execution Timeline for #{job.job_id}
                                </h4>
                                <Link
                                  to={`/datasets/${job.dataset_id}`}
                                  className="text-xs hover:underline flex items-center gap-1"
                                  style={{ color: 'var(--color-accent-primary)' }}
                                >
                                  Open Dataset View <ArrowRight className="w-3 h-3" />
                                </Link>
                              </div>
                              <PipelineTimeline job={job} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
