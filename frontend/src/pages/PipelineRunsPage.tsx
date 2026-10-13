import React, { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Job, JobStatus } from '../lib/types';
import { usePolling } from '../hooks/usePolling';
import { PipelineTimeline } from '../components/pipeline/PipelineTimeline';
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
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            SUCCESS
          </span>
        );
      case 'RUNNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            RUNNING
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <AlertCircle className="w-3.5 h-3.5" />
            FAILED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
            <Clock className="w-3.5 h-3.5" />
            PENDING
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Pipeline Executions</h1>
            {isPolling && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-cyan-950/40 text-cyan-400 border border-cyan-800/40 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                Live Polling
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Monitor and inspect execution history for all ETL pipeline jobs.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Runs
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block">Total Pipeline Runs</span>
          <span className="text-xl font-bold font-mono text-white mt-1 block">{stats.total}</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block">Active Running</span>
          <span className="text-xl font-bold font-mono text-blue-400 mt-1 block">{stats.running}</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block">Successful Runs</span>
          <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">{stats.success}</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block">Failed Executions</span>
          <span className="text-xl font-bold font-mono text-rose-400 mt-1 block">{stats.failed}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Dataset Name or Job ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              statusFilter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => setStatusFilter('RUNNING')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              statusFilter === 'RUNNING' ? 'bg-blue-600 text-white' : 'text-blue-400 hover:text-blue-300'
            }`}
          >
            Running ({stats.running})
          </button>
          <button
            onClick={() => setStatusFilter('SUCCESS')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              statusFilter === 'SUCCESS' ? 'bg-emerald-600 text-white' : 'text-emerald-400 hover:text-emerald-300'
            }`}
          >
            Success ({stats.success})
          </button>
          <button
            onClick={() => setStatusFilter('FAILED')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              statusFilter === 'FAILED' ? 'bg-rose-600 text-white' : 'text-rose-400 hover:text-rose-300'
            }`}
          >
            Failed ({stats.failed})
          </button>
        </div>
      </div>

      {/* Table or Empty State */}
      {loading && jobList.length === 0 ? (
        <div className="p-16 text-center text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-sm">Loading execution history...</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="p-16 text-center bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-400">
          <Activity className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <h4 className="text-base font-semibold text-slate-200">No pipeline executions found</h4>
          <p className="text-xs text-slate-500 mt-1">
            Upload a dataset to trigger your first automated ETL run.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800/60 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Job ID</th>
                  <th className="py-3.5 px-4">Dataset</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Stages</th>
                  <th className="py-3.5 px-4">Duration</th>
                  <th className="py-3.5 px-4">Created</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredJobs.map((job) => {
                  const isExpanded = expandedJobId === job.job_id;
                  const stages = job.stages || {};
                  const successStages = Object.values(stages).filter((s) => s.status === 'SUCCESS').length;

                  return (
                    <React.Fragment key={job.job_id}>
                      <tr className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-300">
                          #{job.job_id.slice(0, 8)}
                        </td>
                        <td className="py-3.5 px-4">
                          <Link
                            to={`/datasets/${job.dataset_id}`}
                            className="font-medium text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1.5"
                          >
                            {job.dataset_name || 'Dataset'}
                            <ExternalLink className="w-3 h-3 text-slate-500" />
                          </Link>
                        </td>
                        <td className="py-3.5 px-4">{getStatusBadge(job.status)}</td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-slate-300">
                            {successStages} / 7 completed
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-400">
                          {formatDuration(job.duration_ms)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400">
                          {new Date(job.created_at).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => setExpandedJobId(isExpanded ? null : job.job_id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                          >
                            <span>{isExpanded ? 'Hide Timeline' : 'View Timeline'}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Execution Timeline Drawer */}
                      {isExpanded && (
                        <tr className="bg-slate-950/60">
                          <td colSpan={7} className="p-6">
                            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-inner">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                  <Activity className="w-4 h-4 text-blue-400" />
                                  Execution Timeline for #{job.job_id}
                                </h4>
                                <Link
                                  to={`/datasets/${job.dataset_id}`}
                                  className="text-xs text-blue-400 hover:underline flex items-center gap-1"
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
