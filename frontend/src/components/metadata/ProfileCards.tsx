import React, { useState, useMemo } from 'react';
import type { ProfileMetadata, SchemaMetadata } from '../../lib/types';
import {
  BarChart3,
  Search,
  Hash,
  Tag,
} from 'lucide-react';

interface ProfileCardsProps {
  profile: ProfileMetadata;
  schema?: SchemaMetadata;
  isLoading?: boolean;
}

export const ProfileCards: React.FC<ProfileCardsProps> = ({ profile, schema, isLoading }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'numeric' | 'categorical'>('all');

  const entries = useMemo(() => {
    return Object.entries(profile || {}).map(([colName, stats]) => {
      const colSchema = schema?.[colName];
      const type = colSchema?.type || (stats.mean !== undefined ? 'numeric' : 'categorical');
      return {
        name: colName,
        type,
        stats,
      };
    });
  }, [profile, schema]);

  const filteredEntries = useMemo(() => {
    return entries.filter((col) => {
      const matchesSearch = col.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType =
        filterType === 'all' ||
        (filterType === 'numeric' && col.type === 'numeric') ||
        (filterType === 'categorical' && (col.type === 'categorical' || col.type === 'boolean' || col.type === 'string'));
      return matchesSearch && matchesType;
    });
  }, [entries, searchTerm, filterType]);

  const summary = useMemo(() => {
    const totalCols = entries.length;
    const numericCols = entries.filter((e) => e.type === 'numeric').length;
    const catCols = entries.filter((e) => e.type === 'categorical' || e.type === 'boolean').length;
    const totalMissing = entries.reduce((acc, curr) => acc + (curr.stats.missing_count || 0), 0);
    return { totalCols, numericCols, catCols, totalMissing };
  }, [entries]);

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">Computing statistical profiling metrics...</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="p-12 text-center text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800">
        <BarChart3 className="w-10 h-10 text-slate-500 mx-auto mb-3" />
        <h4 className="text-base font-semibold text-slate-200">No profile statistics available</h4>
        <p className="text-xs text-slate-500 mt-1">
          Profile data is created during the data profiling pipeline stage.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profiling Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block">Profiled Columns</span>
          <span className="text-xl font-bold text-white mt-1 block">{summary.totalCols}</span>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block">Numeric Summaries</span>
          <span className="text-xl font-bold text-emerald-400 mt-1 block">{summary.numericCols}</span>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block">Categorical Distributions</span>
          <span className="text-xl font-bold text-purple-400 mt-1 block">{summary.catCols}</span>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block">Total Missing Cells</span>
          <span className="text-xl font-bold text-amber-400 mt-1 block">
            {summary.totalMissing.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search column..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterType === 'all'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Columns ({entries.length})
          </button>
          <button
            onClick={() => setFilterType('numeric')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterType === 'numeric'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Numeric ({summary.numericCols})
          </button>
          <button
            onClick={() => setFilterType('categorical')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterType === 'categorical'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Categorical ({summary.catCols})
          </button>
        </div>
      </div>

      {/* Column Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredEntries.map(({ name, type, stats }) => {
          const isNumeric = stats.mean !== undefined;
          const hasTopValues = stats.top_values && stats.top_values.length > 0;

          return (
            <div
              key={name}
              className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 hover:border-slate-700/80 transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded-md bg-slate-800 text-slate-400">
                        {isNumeric ? <Hash className="w-3.5 h-3.5 text-emerald-400" /> : <Tag className="w-3.5 h-3.5 text-purple-400" />}
                      </span>
                      <h4 className="text-sm font-semibold font-mono text-slate-100">{name}</h4>
                    </div>
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider mt-1 block">
                      {type}
                    </span>
                  </div>

                  <div className="flex flex-col items-end text-xs">
                    <span className="text-slate-400">
                      Uniques: <strong className="text-slate-200">{stats.unique_count ?? '—'}</strong>
                    </span>
                    <span className={`text-[11px] ${stats.missing_count > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                      Missing: {stats.missing_count ?? 0}
                    </span>
                  </div>
                </div>

                {/* Numeric Statistics Grid */}
                {isNumeric && (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-xs">
                    <div className="bg-slate-800/40 p-2 rounded-lg border border-slate-700/30">
                      <span className="text-slate-500 text-[10px] block">Mean</span>
                      <span className="font-mono font-semibold text-slate-200">
                        {stats.mean !== undefined ? stats.mean.toFixed(2) : '—'}
                      </span>
                    </div>
                    <div className="bg-slate-800/40 p-2 rounded-lg border border-slate-700/30">
                      <span className="text-slate-500 text-[10px] block">Median</span>
                      <span className="font-mono font-semibold text-slate-200">
                        {stats.median !== undefined ? stats.median.toFixed(2) : '—'}
                      </span>
                    </div>
                    <div className="bg-slate-800/40 p-2 rounded-lg border border-slate-700/30">
                      <span className="text-slate-500 text-[10px] block">Std Dev</span>
                      <span className="font-mono font-semibold text-slate-200">
                        {stats.std !== undefined ? stats.std.toFixed(2) : '—'}
                      </span>
                    </div>
                    <div className="bg-slate-800/40 p-2 rounded-lg border border-slate-700/30">
                      <span className="text-slate-500 text-[10px] block">Min</span>
                      <span className="font-mono font-semibold text-emerald-400">
                        {stats.min !== undefined ? stats.min.toFixed(2) : '—'}
                      </span>
                    </div>
                    <div className="bg-slate-800/40 p-2 rounded-lg border border-slate-700/30">
                      <span className="text-slate-500 text-[10px] block">Max</span>
                      <span className="font-mono font-semibold text-emerald-400">
                        {stats.max !== undefined ? stats.max.toFixed(2) : '—'}
                      </span>
                    </div>
                    <div className="bg-slate-800/40 p-2 rounded-lg border border-slate-700/30">
                      <span className="text-slate-500 text-[10px] block">Q25 - Q75 (IQR)</span>
                      <span className="font-mono font-semibold text-slate-300 text-[11px]">
                        {stats.q25 !== undefined && stats.q75 !== undefined
                          ? `${stats.q25.toFixed(1)} - ${stats.q75.toFixed(1)}`
                          : '—'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Categorical Top Values Distribution */}
                {hasTopValues && (
                  <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Top Values Distribution
                    </span>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {stats.top_values!.map((item, idx) => {
                        const maxCount = stats.top_values![0].count || 1;
                        const pct = Math.round((item.count / maxCount) * 100);

                        return (
                          <div key={idx} className="space-y-0.5">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-300 font-mono truncate max-w-[180px]">
                                {item.value || '<empty>'}
                              </span>
                              <span className="text-slate-400 font-mono">
                                {item.count.toLocaleString()}
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
