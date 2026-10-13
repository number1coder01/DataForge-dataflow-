import React, { useState, useMemo } from 'react';
import type { SchemaMetadata, ColumnType } from '../../lib/types';
import {
  Layers,
  Search,
  Hash,
  Calendar,
  ToggleLeft,
  Tag,
  Type,
  HelpCircle,
  CheckCircle,
} from 'lucide-react';

interface SchemaTableProps {
  schema: SchemaMetadata;
  isLoading?: boolean;
}

export const SchemaTable: React.FC<SchemaTableProps> = ({ schema, isLoading }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const entries = useMemo(() => {
    return Object.entries(schema || {}).map(([colName, meta]) => ({
      name: colName,
      type: meta.type,
      null_pct: meta.null_pct,
    }));
  }, [schema]);

  const filteredEntries = useMemo(() => {
    return entries.filter((col) => {
      const matchesSearch = col.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || col.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [entries, searchTerm, typeFilter]);

  const stats = useMemo(() => {
    const total = entries.length;
    const numericCount = entries.filter((e) => e.type === 'numeric').length;
    const dateCount = entries.filter((e) => e.type === 'datetime').length;
    const catCount = entries.filter((e) => e.type === 'categorical').length;
    const cleanColumns = entries.filter((e) => e.null_pct === 0).length;
    return { total, numericCount, dateCount, catCount, cleanColumns };
  }, [entries]);

  const getTypeBadge = (type: ColumnType) => {
    switch (type) {
      case 'numeric':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Hash className="w-3 h-3" />
            Numeric (Float/Int)
          </span>
        );
      case 'datetime':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <Calendar className="w-3 h-3" />
            Datetime (ISO)
          </span>
        );
      case 'boolean':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <ToggleLeft className="w-3 h-3" />
            Boolean
          </span>
        );
      case 'categorical':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
            <Tag className="w-3 h-3" />
            Categorical
          </span>
        );
      case 'string':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300 border border-slate-600">
            <Type className="w-3 h-3" />
            String (Text)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
            <HelpCircle className="w-3 h-3" />
            Unknown
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">Loading inferred schema...</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="p-12 text-center text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800">
        <Layers className="w-10 h-10 text-slate-500 mx-auto mb-3" />
        <h4 className="text-base font-semibold text-slate-200">No schema metadata found</h4>
        <p className="text-xs text-slate-500 mt-1">
          The pipeline may still be processing or failed before schema detection.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Stat Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block">Total Columns</span>
          <span className="text-xl font-bold text-white mt-1 block">{stats.total}</span>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block">Numeric Columns</span>
          <span className="text-xl font-bold text-emerald-400 mt-1 block">{stats.numericCount}</span>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block">Categorical / Dates</span>
          <span className="text-xl font-bold text-purple-400 mt-1 block">
            {stats.catCount + stats.dateCount}
          </span>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block">100% Non-Null Columns</span>
          <span className="text-xl font-bold text-cyan-400 mt-1 block">{stats.cleanColumns}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search column names..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400 hidden sm:inline">Type:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 w-full sm:w-auto"
          >
            <option value="all">All Types ({entries.length})</option>
            <option value="numeric">Numeric ({stats.numericCount})</option>
            <option value="categorical">Categorical ({stats.catCount})</option>
            <option value="datetime">Datetime ({stats.dateCount})</option>
            <option value="string">String</option>
            <option value="boolean">Boolean</option>
          </select>
        </div>
      </div>

      {/* Schema Table */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/60 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">#</th>
                <th className="py-3.5 px-4">Column Name</th>
                <th className="py-3.5 px-4">Inferred Type</th>
                <th className="py-3.5 px-4">Null Percentage</th>
                <th className="py-3.5 px-4 text-right">Completeness</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredEntries.map((col, idx) => {
                const nullPctFormatted = (col.null_pct * 100).toFixed(1);
                const completeness = (100 - col.null_pct * 100).toFixed(1);

                return (
                  <tr key={col.name} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 text-slate-500 font-mono">{idx + 1}</td>
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-200">
                      {col.name}
                    </td>
                    <td className="py-3.5 px-4">{getTypeBadge(col.type)}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              col.null_pct > 0.3
                                ? 'bg-rose-500'
                                : col.null_pct > 0.05
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(col.null_pct * 100, 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-slate-400">{nullPctFormatted}%</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {col.null_pct === 0 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                          <CheckCircle className="w-3.5 h-3.5" /> 100%
                        </span>
                      ) : (
                        <span className="text-slate-300 font-mono">{completeness}%</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
