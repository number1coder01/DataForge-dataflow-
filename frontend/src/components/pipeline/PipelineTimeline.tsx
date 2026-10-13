import React, { useState } from 'react';
import type { Job, StageStatus } from '../../lib/types';
import { StageDetail } from './StageDetail';
import {
  FileText,
  Search,
  ShieldCheck,
  Wand2,
  BarChart3,
  Database,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface StageDefinition {
  key: string;
  name: string;
  shortName: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PIPELINE_STAGES: StageDefinition[] = [
  {
    key: 'load_data',
    name: '1. Load Raw CSV',
    shortName: 'Load Data',
    description: 'Streams raw CSV dataset from Bronze S3 bucket into memory',
    icon: FileText,
  },
  {
    key: 'schema_detection',
    name: '2. Schema Detection',
    shortName: 'Schema',
    description: 'Infers data types (numeric, datetime, categorical, string) statistically',
    icon: Search,
  },
  {
    key: 'quality_check',
    name: '3. Quality Checks',
    shortName: 'Quality',
    description: 'Scans for duplicates, null ratios, outliers (IQR), and mixed types',
    icon: ShieldCheck,
  },
  {
    key: 'transformation',
    name: '4. Data Transformation',
    shortName: 'Transform',
    description: 'Sanitizes column names, trims strings, removes duplicates, and casts types',
    icon: Wand2,
  },
  {
    key: 'data_profiling',
    name: '5. Data Profiling',
    shortName: 'Profiling',
    description: 'Computes descriptive statistics (min, max, mean, quantiles) and distributions',
    icon: BarChart3,
  },
  {
    key: 'parquet_conversion',
    name: '6. Parquet & Metadata',
    shortName: 'Parquet',
    description: 'Writes optimized columnar Parquet and metadata JSON files to Silver S3',
    icon: Layers,
  },
  {
    key: 'catalog_registration',
    name: '7. Glue Catalog',
    shortName: 'Glue Catalog',
    description: 'Registers database and table schema in AWS Glue Data Catalog for Athena SQL',
    icon: Database,
  },
];

interface PipelineTimelineProps {
  job: Job;
  isPolling?: boolean;
}

export const PipelineTimeline: React.FC<PipelineTimelineProps> = ({ job, isPolling }) => {
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [allExpanded, setAllExpanded] = useState<boolean>(true);

  const stages = job.stages || {};

  // Calculate progress
  const completedStagesCount = PIPELINE_STAGES.filter(
    (s) => stages[s.key]?.status === 'SUCCESS'
  ).length;
  const progressPercent = Math.round((completedStagesCount / PIPELINE_STAGES.length) * 100);

  const formatTotalDuration = () => {
    if (job.duration_ms) {
      return (job.duration_ms / 1000).toFixed(2) + ' s';
    }
    if (job.created_at && job.completed_at) {
      const diff = new Date(job.completed_at).getTime() - new Date(job.created_at).getTime();
      return (diff / 1000).toFixed(2) + ' s';
    }
    return null;
  };

  const getStageStatus = (key: string): StageStatus => {
    return stages[key]?.status || 'PENDING';
  };

  const getNodeStyles = (status: StageStatus) => {
    switch (status) {
      case 'SUCCESS':
        return {
          ring: 'border-emerald-500 bg-emerald-950/60 text-emerald-400 shadow-emerald-900/30 shadow-md',
          line: 'bg-emerald-500',
          badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        };
      case 'RUNNING':
        return {
          ring: 'border-blue-500 bg-blue-950/60 text-blue-400 ring-4 ring-blue-500/20 animate-pulse shadow-blue-900/40 shadow-lg',
          line: 'bg-gradient-to-r from-emerald-500 to-blue-500',
          badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
        };
      case 'FAILED':
        return {
          ring: 'border-rose-500 bg-rose-950/60 text-rose-400 shadow-rose-900/40 shadow-md',
          line: 'bg-rose-500',
          badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        };
      default:
        return {
          ring: 'border-slate-800 bg-slate-900/80 text-slate-500',
          line: 'bg-slate-800',
          badge: 'bg-slate-800 text-slate-500 border-slate-700',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Summary Card */}
      <div className="bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div
          className={`absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none transition-all duration-700
            ${job.status === 'SUCCESS' ? 'bg-emerald-500' : ''}
            ${job.status === 'RUNNING' ? 'bg-blue-500' : ''}
            ${job.status === 'FAILED' ? 'bg-rose-500' : ''}
          `}
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                Pipeline Execution
              </span>
              {isPolling && (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded-full animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  Live Polling (2s)
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold text-white mt-1 flex items-center gap-2">
              Job <span className="font-mono text-slate-300 text-sm">#{job.job_id.slice(0, 8)}</span>
              {job.dataset_name && (
                <span className="text-sm font-normal text-slate-400">
                  for <strong className="text-slate-200">{job.dataset_name}</strong>
                </span>
              )}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs">
              <span className="text-slate-400">Status: </span>
              <strong
                className={`ml-1 font-semibold
                  ${job.status === 'SUCCESS' ? 'text-emerald-400' : ''}
                  ${job.status === 'RUNNING' ? 'text-blue-400' : ''}
                  ${job.status === 'FAILED' ? 'text-rose-400' : ''}
                  ${job.status === 'PENDING' ? 'text-slate-400' : ''}
                `}
              >
                {job.status}
              </strong>
            </div>

            {formatTotalDuration() && (
              <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs">
                <span className="text-slate-400">Total Time: </span>
                <strong className="text-slate-200 font-mono ml-1">{formatTotalDuration()}</strong>
              </div>
            )}

            <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs font-mono text-slate-400">
              {new Date(job.created_at).toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Progress: {completedStagesCount} of {PIPELINE_STAGES.length} stages completed</span>
            <span className="font-mono font-semibold text-slate-300">{progressPercent}%</span>
          </div>
          <div className="h-2.5 w-full bg-slate-800/90 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out
                ${job.status === 'FAILED' ? 'bg-gradient-to-r from-emerald-500 to-rose-500' : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500'}
              `}
              style={{ width: `${job.status === 'SUCCESS' ? 100 : Math.max(progressPercent, 5)}%` }}
            />
          </div>
        </div>

        {job.error_message && (
          <div className="mt-4 p-4 rounded-xl bg-rose-950/50 border border-rose-900 text-rose-300 flex items-start gap-3 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold block mb-0.5">Pipeline Execution Failed</strong>
              <p className="font-mono text-rose-200">{job.error_message}</p>
            </div>
          </div>
        )}
      </div>

      {/* Visual Stepper Progression Bar */}
      <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 shadow-md">
        <h4 className="text-sm font-semibold text-slate-300 mb-6 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-400" />
          Stage Progression Flow
        </h4>

        {/* Horizontal timeline on desktop */}
        <div className="hidden lg:grid grid-cols-7 gap-2 relative">
          {PIPELINE_STAGES.map((stage, idx) => {
            const status = getStageStatus(stage.key);
            const style = getNodeStyles(status);
            const stageInfo = stages[stage.key];
            const isSelected = selectedStage === stage.key;

            return (
              <div
                key={stage.key}
                onClick={() => setSelectedStage(isSelected ? null : stage.key)}
                className={`group flex flex-col items-center text-center cursor-pointer transition-all duration-200 relative p-3 rounded-xl
                  ${isSelected ? 'bg-slate-800/90 ring-1 ring-blue-500/50' : 'hover:bg-slate-800/40'}
                `}
              >
                {/* Connecting line between stages */}
                {idx < PIPELINE_STAGES.length - 1 && (
                  <div
                    className={`absolute top-7 left-1/2 w-full h-0.5 -z-0 transition-colors duration-300
                      ${stages[PIPELINE_STAGES[idx + 1].key]?.status === 'SUCCESS' || status === 'SUCCESS'
                        ? 'bg-emerald-500/50'
                        : 'bg-slate-800'}
                    `}
                  />
                )}

                {/* Node icon circle */}
                <div
                  className={`w-9 h-9 rounded-full border-2 flex items-center justify-center mb-2 z-10 transition-transform duration-200 group-hover:scale-105
                    ${style.ring}
                  `}
                >
                  {status === 'SUCCESS' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : status === 'RUNNING' ? (
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  ) : status === 'FAILED' ? (
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                  ) : (
                    <stage.icon className="w-4 h-4 text-slate-500" />
                  )}
                </div>

                {/* Stage short name */}
                <span className="text-xs font-medium text-slate-200 block truncate w-full">
                  {stage.shortName}
                </span>

                {/* Duration or status subtext */}
                <span className="text-[10px] text-slate-400 font-mono mt-1">
                  {stageInfo?.duration_ms !== undefined
                    ? `${stageInfo.duration_ms}ms`
                    : status}
                </span>
              </div>
            );
          })}
        </div>

        {/* Mobile / Tablet vertical list */}
        <div className="lg:hidden space-y-3">
          {PIPELINE_STAGES.map((stage) => {
            const status = getStageStatus(stage.key);
            const style = getNodeStyles(status);
            const stageInfo = stages[stage.key];

            return (
              <div
                key={stage.key}
                onClick={() => setSelectedStage(selectedStage === stage.key ? null : stage.key)}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 cursor-pointer hover:bg-slate-800/70"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full border flex items-center justify-center ${style.ring}`}>
                    {status === 'SUCCESS' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : status === 'RUNNING' ? (
                      <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                    ) : status === 'FAILED' ? (
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                    ) : (
                      <stage.icon className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold text-slate-200">{stage.name}</h5>
                    <span className="text-[10px] text-slate-400">{stage.description}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${style.badge}`}>
                    {status}
                  </span>
                  {stageInfo?.duration_ms !== undefined && (
                    <span className="block text-[10px] font-mono text-slate-400 mt-0.5">
                      {stageInfo.duration_ms} ms
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stage Breakdown Details */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-semibold text-white">Execution Stage Details</h4>
          <button
            onClick={() => {
              if (selectedStage) {
                setSelectedStage(null);
              } else {
                setAllExpanded(!allExpanded);
              }
            }}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/60 transition-colors"
          >
            {selectedStage ? 'Show All Stages' : allExpanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" /> Collapse
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" /> Expand All
              </>
            )}
          </button>
        </div>

        <div className="space-y-3">
          {PIPELINE_STAGES.filter((s) => !selectedStage || s.key === selectedStage).map((stage) => (
            <StageDetail
              key={stage.key}
              stageKey={stage.key}
              stageName={stage.name}
              stageDescription={stage.description}
              stageInfo={stages[stage.key]}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
