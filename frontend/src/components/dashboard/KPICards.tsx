import React from 'react';
import type { DashboardKPI } from '../../lib/types';
import {
  Database,
  Hash,
  TrendingUp,
  Layers,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';

interface KPICardsProps {
  kpis: DashboardKPI[];
}

export const KPICards: React.FC<KPICardsProps> = ({ kpis }) => {
  if (!kpis || kpis.length === 0) return null;

  const getKPIIcon = (iconName: string) => {
    switch (iconName) {
      case 'rows':
        return <Database className="w-4 h-4 text-cyan-400" />;
      case 'columns':
        return <Layers className="w-4 h-4 text-indigo-400" />;
      case 'average':
        return <TrendingUp className="w-4 h-4 text-emerald-400" />;
      case 'max':
        return <ArrowUpRight className="w-4 h-4 text-amber-400" />;
      case 'unique':
        return <Sparkles className="w-4 h-4 text-purple-400" />;
      default:
        return <Hash className="w-4 h-4 text-blue-400" />;
    }
  };

  const formatValue = (value: number, format: 'number' | 'decimal' | 'percentage') => {
    if (value === undefined || value === null) return '—';
    if (format === 'decimal') {
      return Number(value).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    }
    if (format === 'percentage') {
      return `${(Number(value) * 100).toFixed(1)}%`;
    }
    return Number(value).toLocaleString();
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
      {kpis.map((kpi, index) => (
        <div
          key={index}
          className="relative group overflow-hidden bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-4 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/5 backdrop-blur-sm"
        >
          {/* Subtle gradient glow */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-2xl group-hover:from-blue-500/20 transition-all pointer-events-none" />

          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400 tracking-wide truncate max-w-[80%]">
              {kpi.label}
            </span>
            <div className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/50">
              {getKPIIcon(kpi.icon)}
            </div>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono tracking-tight text-white">
              {formatValue(kpi.value, kpi.format)}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Auto-computed metric</span>
          </div>
        </div>
      ))}
    </div>
  );
};
