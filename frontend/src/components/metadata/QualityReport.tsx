import React, { useState, useMemo } from 'react';
import type { QualityMetadata, TransformLogMetadata } from '../../lib/types';
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  Sparkles,
  Search,
} from 'lucide-react';

interface QualityReportProps {
  quality: QualityMetadata;
  transformLog?: TransformLogMetadata | null;
  isLoading?: boolean;
}

export const QualityReport: React.FC<QualityReportProps> = ({
  quality,
  transformLog,
  isLoading,
}) => {
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const issues = quality?.issues || [];

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      const matchesSeverity = severityFilter === 'all' || issue.severity === severityFilter;
      const target = (issue.column || issue.type || '').toLowerCase();
      const matchesSearch = target.includes(searchTerm.toLowerCase());
      return matchesSeverity && matchesSearch;
    });
  }, [issues, severityFilter, searchTerm]);

  // Compute a 0-100 Data Quality Health Score
  const qualityScore = useMemo(() => {
    if (!issues || issues.length === 0) return 100;
    let deductions = 0;
    for (const issue of issues) {
      if (issue.severity === 'critical') deductions += 20;
      else if (issue.severity === 'warning') deductions += 8;
      else deductions += 2;
    }
    return Math.max(0, 100 - deductions);
  }, [issues]);

  const severityCounts = useMemo(() => {
    const critical = issues.filter((i) => i.severity === 'critical').length;
    const warning = issues.filter((i) => i.severity === 'warning').length;
    const info = issues.filter((i) => i.severity === 'info').length;
    return { critical, warning, info };
  }, [issues]);

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">Evaluating dataset quality audit results...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Quality Health Score & Before/After Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quality Score Card */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                Data Quality Health
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold
                  ${qualityScore >= 85 ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : ''}
                  ${qualityScore >= 60 && qualityScore < 85 ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : ''}
                  ${qualityScore < 60 ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : ''}
                `}
              >
                {qualityScore >= 85 ? 'Healthy' : qualityScore >= 60 ? 'Needs Attention' : 'Critical Issues'}
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-5xl font-extrabold text-white tracking-tight">{qualityScore}</span>
              <span className="text-slate-500 text-sm font-semibold">/ 100</span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Based on statistical checks for duplicate records, null saturation, IQR outliers, and type consistency.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-6 pt-4 border-t border-slate-800 text-center">
            <div className="bg-rose-950/20 border border-rose-900/30 p-2 rounded-xl">
              <span className="text-[10px] text-rose-400 block font-semibold">Critical</span>
              <span className="text-base font-bold text-rose-300 font-mono">{severityCounts.critical}</span>
            </div>
            <div className="bg-amber-950/20 border border-amber-900/30 p-2 rounded-xl">
              <span className="text-[10px] text-amber-400 block font-semibold">Warnings</span>
              <span className="text-base font-bold text-amber-300 font-mono">{severityCounts.warning}</span>
            </div>
            <div className="bg-blue-950/20 border border-blue-900/30 p-2 rounded-xl">
              <span className="text-[10px] text-blue-400 block font-semibold">Info</span>
              <span className="text-base font-bold text-blue-300 font-mono">{severityCounts.info}</span>
            </div>
          </div>
        </div>

        {/* Before / After Transformation Impact */}
        <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-semibold text-slate-100">
                Transformation Remediation Impact (Before & After)
              </h4>
            </div>
            <p className="text-xs text-slate-400">
              Generic ETL engine actions applied automatically to produce clean, query-ready Silver Parquet.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-5">
              <div className="bg-slate-800/50 border border-slate-700/60 p-3.5 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Raw Records</span>
                <span className="text-xl font-bold font-mono text-slate-200 mt-1 block">
                  {transformLog?.rows_before !== undefined
                    ? transformLog.rows_before.toLocaleString()
                    : '—'}
                </span>
                <span className="text-[10px] text-slate-500">Source Bronze CSV</span>
              </div>

              <div className="bg-slate-800/50 border border-slate-700/60 p-3.5 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Cleaned Records</span>
                <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">
                  {transformLog?.rows_after !== undefined
                    ? transformLog.rows_after.toLocaleString()
                    : '—'}
                </span>
                <span className="text-[10px] text-emerald-500/80">Silver Parquet Output</span>
              </div>

              <div className="bg-slate-800/50 border border-slate-700/60 p-3.5 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Deduplicated Rows</span>
                <span className="text-xl font-bold font-mono text-amber-400 mt-1 block">
                  {transformLog?.rows_removed !== undefined
                    ? transformLog.rows_removed.toLocaleString()
                    : '—'}
                </span>
                <span className="text-[10px] text-amber-500/80">Exact duplicates dropped</span>
              </div>
            </div>
          </div>

          {/* Automated Remediation List */}
          {transformLog?.actions && transformLog.actions.length > 0 && (
            <div className="pt-3 border-t border-slate-800 flex flex-wrap gap-2 text-xs">
              <span className="text-slate-400 text-[11px] font-medium self-center mr-1">
                Remediations Applied:
              </span>
              {transformLog.actions.map((act, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 bg-slate-800/80 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-lg text-[11px] font-mono"
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  {act.action.replace(/_/g, ' ')}
                  {act.column && <span className="text-slate-400 font-sans">({act.column})</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Issues Filter & List */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-200">
              Audit Findings ({filteredIssues.length})
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter by column or type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setSeverityFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  severityFilter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSeverityFilter('critical')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  severityFilter === 'critical' ? 'bg-rose-600 text-white' : 'text-rose-400 hover:text-rose-300'
                }`}
              >
                Critical ({severityCounts.critical})
              </button>
              <button
                onClick={() => setSeverityFilter('warning')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  severityFilter === 'warning' ? 'bg-amber-600 text-white' : 'text-amber-400 hover:text-amber-300'
                }`}
              >
                Warning ({severityCounts.warning})
              </button>
              <button
                onClick={() => setSeverityFilter('info')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  severityFilter === 'info' ? 'bg-blue-600 text-white' : 'text-blue-400 hover:text-blue-300'
                }`}
              >
                Info ({severityCounts.info})
              </button>
            </div>
          </div>
        </div>

        {filteredIssues.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-400 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            No issues match the selected filters.
          </div>
        ) : (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800/80 shadow-md">
            {filteredIssues.map((issue, idx) => {
              const isCrit = issue.severity === 'critical';
              const isWarn = issue.severity === 'warning';

              return (
                <div
                  key={idx}
                  className="p-4 hover:bg-slate-800/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {isCrit ? (
                        <AlertOctagon className="w-4 h-4 text-rose-400" />
                      ) : isWarn ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Info className="w-4 h-4 text-blue-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200 capitalize">
                          {issue.type.replace(/_/g, ' ')}
                        </span>
                        {issue.column && (
                          <span className="font-mono text-cyan-300 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded text-[11px]">
                            {issue.column}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-[11px] mt-1">
                        {issue.type === 'nulls' && `Null rate is ${issue.pct}% of column values.`}
                        {issue.type === 'duplicates' && `Detected ${issue.count} identical duplicate rows across the dataset.`}
                        {issue.type === 'outliers' && `Detected ${issue.count} numerical outliers using the statistical ${issue.method || 'IQR'} method.`}
                        {issue.type === 'empty_strings' && `Found ${issue.count} whitespace-only / empty string cells.`}
                        {issue.type === 'mixed_types' && `Mixed data types detected (numeric ratio: ${(issue.numeric_ratio! * 100).toFixed(0)}%).`}
                        {issue.type === 'whitespace' && `Found ${issue.count} string entries with untrimmed leading or trailing whitespace.`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider
                        ${isCrit ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : ''}
                        ${isWarn ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : ''}
                        ${!isCrit && !isWarn ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : ''}
                      `}
                    >
                      {issue.severity}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
