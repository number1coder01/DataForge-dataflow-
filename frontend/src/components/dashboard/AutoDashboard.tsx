import React, { useState, useEffect, useCallback } from 'react';
import type {
  DashboardConfig,
  SchemaMetadata,
  ProfileMetadata,
} from '../../lib/types';
import { api } from '../../lib/api';
import { KPICards } from './KPICards';
import { ChartCard } from './ChartCard';
import {
  Sparkles,
  Filter,
  RefreshCw,
  X,
  Loader2,
  AlertCircle,
  Database,
  BarChart3,
} from 'lucide-react';

interface AutoDashboardProps {
  datasetId: string;
  schema: SchemaMetadata;
  profile: ProfileMetadata;
}

export const AutoDashboard: React.FC<AutoDashboardProps> = ({
  datasetId,
  schema,
  profile,
}) => {
  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  const loadDashboardConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDashboard(datasetId);
      setConfig(data);
    } catch (err: any) {
      setError(err.message || 'Failed to generate automatic dashboard.');
    } finally {
      setLoading(false);
    }
  }, [datasetId]);

  useEffect(() => {
    loadDashboardConfig();
  }, [loadDashboardConfig]);

  const handleFilterChange = (column: string, value: string) => {
    setActiveFilters((prev) => {
      const updated = { ...prev };
      if (!value) {
        delete updated[column];
      } else {
        updated[column] = value;
      }
      return updated;
    });
  };

  const handleClearFilters = () => {
    setActiveFilters({});
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-3" />
        <h4 className="text-sm font-semibold text-white">Analyzing Schema & Generating Visualizations</h4>
        <p className="text-xs text-slate-400 mt-1">
          Evaluating column distributions, temporal trends, and correlation pairs...
        </p>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-400">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h4 className="text-base font-semibold text-white">Dashboard Generation Notice</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto mb-4">
          {error || 'Could not load visualization recommendations for this dataset.'}
        </p>
        <button
          onClick={loadDashboardConfig}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Analysis
        </button>
      </div>
    );
  }

  const activeFilterCount = Object.keys(activeFilters).length;

  return (
    <div className="space-y-6">
      {/* Dashboard Sub-header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/40 border border-slate-800/80 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-md shadow-blue-500/20 text-white">
            <Sparkles className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">
                Automatic Visualizations
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                {config.recommendations.length} charts auto-generated
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Derived from statistical profiling, temporal fields, and category cardinality.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadDashboardConfig}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Charts
          </button>
        </div>
      </div>

      {/* KPI Metric Summary Row */}
      {config.kpis && config.kpis.length > 0 && (
        <KPICards kpis={config.kpis} />
      )}

      {/* Categorical Filter Bar */}
      {config.filters && config.filters.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
              <span>Interactive Filters</span>
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300">
                  {activeFilterCount} active
                </span>
              )}
            </div>
            {activeFilterCount > 0 && (
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 transition-colors"
              >
                <X className="w-3 h-3" />
                Clear Filters
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {config.filters.map((filter) => (
              <div key={filter.column} className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-medium">{filter.label}:</span>
                <select
                  value={activeFilters[filter.column] || ''}
                  onChange={(e) => handleFilterChange(filter.column, e.target.value)}
                  className="bg-slate-800/90 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value="">All {filter.label}s</option>
                  {filter.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Charts Grid */}
      {config.recommendations && config.recommendations.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {config.recommendations.map((rec, index) => (
            <ChartCard
              key={`${rec.chart_type}-${rec.x_column}-${rec.y_column}-${index}`}
              datasetId={datasetId}
              recommendation={rec}
              schema={schema}
              profile={profile}
              activeFilters={activeFilters}
            />
          ))}
        </div>
      ) : (
        <div className="p-12 text-center bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-400">
          <BarChart3 className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-white">No Direct Visualizations Recommended</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            The dataset schema does not contain recognizable numeric or temporal dimensions suitable for automated charting.
          </p>
        </div>
      )}

      {/* Athena Table Reference Footer */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-4 px-1">
        <div className="flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-purple-400" />
          <span>Athena Source:</span>
          <span className="font-mono text-slate-400">{config.athena_database}.{config.athena_table}</span>
        </div>
        <span>Powered by AWS Athena, Glue & Parquet columnar storage</span>
      </div>
    </div>
  );
};
