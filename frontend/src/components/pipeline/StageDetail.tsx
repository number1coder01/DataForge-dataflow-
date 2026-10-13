import React from 'react';
import type { StageInfo, StageStatus } from '../../lib/types';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  Layers,
  ArrowRight,
  Database,
  ShieldAlert,
  FileSpreadsheet,
} from 'lucide-react';

interface StageDetailProps {
  stageKey: string;
  stageName: string;
  stageDescription: string;
  stageInfo?: StageInfo;
  defaultOpen?: boolean;
}

export const StageDetail: React.FC<StageDetailProps> = ({
  stageKey,
  stageName,
  stageDescription,
  stageInfo,
}) => {
  const status: StageStatus = stageInfo?.status || 'PENDING';

  const formatDuration = (ms?: number) => {
    if (ms === undefined || ms === null) return '—';
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Completed
          </span>
        );
      case 'RUNNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            In Progress
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <AlertCircle className="w-3.5 h-3.5" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-slate-700/80 transition-all duration-200">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-3">
            <h4 className="text-base font-semibold text-slate-100">{stageName}</h4>
            {getStatusBadge()}
          </div>
          <p className="text-xs text-slate-400 mt-1">{stageDescription}</p>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/50">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Duration: <strong className="text-slate-200 font-mono">{formatDuration(stageInfo?.duration_ms)}</strong></span>
          </div>

          {stageInfo?.updated_at && (
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/50">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{new Date(stageInfo.updated_at).toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Stage Specific Insights */}
      {stageInfo && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-3 border-t border-slate-800/80 text-xs">
          {stageKey === 'schema_detection' && stageInfo.columns !== undefined && (
            <div className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/40 flex items-center gap-2.5">
              <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
              <div>
                <span className="text-slate-400 block">Detected Schema</span>
                <span className="font-semibold text-slate-200">{stageInfo.columns} Columns</span>
              </div>
            </div>
          )}

          {stageKey === 'transformation' && (
            <>
              {stageInfo.rows_before !== undefined && stageInfo.rows_after !== undefined && (
                <div className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/40 flex items-center gap-2.5">
                  <FileSpreadsheet className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div>
                    <span className="text-slate-400 block">Row Cleansing Impact</span>
                    <span className="font-semibold text-slate-200 flex items-center gap-1">
                      {stageInfo.rows_before.toLocaleString()}
                      <ArrowRight className="w-3 h-3 text-slate-500 inline" />
                      {stageInfo.rows_after.toLocaleString()} rows
                    </span>
                  </div>
                </div>
              )}
              {stageInfo.rows_before !== undefined && stageInfo.rows_after !== undefined && (
                <div className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/40 flex items-center gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="text-slate-400 block">Duplicates Removed</span>
                    <span className="font-semibold text-amber-300">
                      {(stageInfo.rows_before - stageInfo.rows_after).toLocaleString()} rows
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {stageKey === 'data_profiling' && stageInfo.row_count !== undefined && (
            <div className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/40 flex items-center gap-2.5">
              <Layers className="w-4 h-4 text-purple-400 shrink-0" />
              <div>
                <span className="text-slate-400 block">Cleaned Dataset Size</span>
                <span className="font-semibold text-slate-200">{stageInfo.row_count.toLocaleString()} rows</span>
              </div>
            </div>
          )}

          {stageKey === 'catalog_registration' && stageInfo.table_name && (
            <div className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/40 flex items-center gap-2.5 col-span-full md:col-span-2">
              <Database className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-slate-400 block">Glue Catalog Table</span>
                <code className="font-mono text-emerald-300 font-semibold">{stageInfo.table_name}</code>
              </div>
            </div>
          )}

          {stageInfo.error && (
            <div className="col-span-full bg-rose-950/40 border border-rose-900/50 p-3 rounded-lg text-rose-300">
              <span className="font-semibold block mb-1">Stage Error:</span>
              <pre className="font-mono text-[11px] whitespace-pre-wrap">{stageInfo.error}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
