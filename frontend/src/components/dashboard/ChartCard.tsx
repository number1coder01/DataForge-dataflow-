import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  PieChart as PieIcon,
  Code2,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Layers,
  ChevronDown,
  Loader2,
  CircleDot,
} from 'lucide-react';
import type {
  ChartRecommendation,
  ChartType,
  SchemaMetadata,
  ProfileMetadata,
} from '../../lib/types';
import { api } from '../../lib/api';

interface ChartCardProps {
  datasetId: string;
  recommendation: ChartRecommendation;
  schema: SchemaMetadata;
  profile: ProfileMetadata;
  activeFilters?: Record<string, string>;
}

const PALETTE = [
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#ec4899', // pink
  '#6366f1', // indigo
  '#14b8a6', // teal
];

export const ChartCard: React.FC<ChartCardProps> = ({
  datasetId,
  recommendation,
  schema,
  profile,
  activeFilters = {},
}) => {
  const [chartType, setChartType] = useState<ChartType>(recommendation.chart_type);
  const [xCol, setXCol] = useState<string>(recommendation.x_column);
  const [yCol, setYCol] = useState<string>(recommendation.y_column);
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAthenaLive, setIsAthenaLive] = useState<boolean>(false);
  const [showSql, setShowSql] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(false);

  // Available column lists for dimension swapping
  const allColumns = useMemo(() => Object.keys(schema || {}), [schema]);

  // Generate fallback data from profile if Athena is not configured or query fails
  const generateFallbackData = useMemo(() => {
    return () => {
      const xMeta = schema[xCol] || {};
      const yProfile = profile[yCol] || {};

      // If X is categorical, use top_values from profile
      const xProfile = profile[xCol] || {};
      if (xMeta.type === 'categorical' && xProfile.top_values && xProfile.top_values.length > 0) {
        return xProfile.top_values.slice(0, 10).map((tv, idx) => ({
          [xCol]: tv.value,
          [yCol]: Number(tv.count) * (yProfile.mean ? Math.round(yProfile.mean / 5) : 1) + (idx * 12),
        }));
      }

      // If X is datetime, generate recent date buckets
      if (xMeta.type === 'datetime') {
        const baseDate = new Date();
        const baseVal = yProfile.mean || 100;
        return Array.from({ length: 12 }, (_, i) => {
          const d = new Date(baseDate);
          d.setDate(d.getDate() - (11 - i) * 3);
          const variance = Math.sin(i / 1.5) * (yProfile.std || baseVal * 0.25);
          return {
            [xCol]: d.toISOString().split('T')[0],
            [yCol]: Math.max(0, Math.round(baseVal + variance)),
          };
        });
      }

      // If numeric vs numeric (scatter)
      if (xMeta.type === 'numeric') {
        const xBase = xProfile.mean || 50;
        const yBase = yProfile.mean || 75;
        return Array.from({ length: 25 }, () => ({
          [xCol]: Math.round(xBase + (Math.random() - 0.5) * (xProfile.std || 20) * 2),
          [yCol]: Math.round(yBase + (Math.random() - 0.5) * (yProfile.std || 25) * 2),
        }));
      }

      // Generic fallback
      return [
        { [xCol]: 'Group A', [yCol]: 45 },
        { [xCol]: 'Group B', [yCol]: 82 },
        { [xCol]: 'Group C', [yCol]: 56 },
        { [xCol]: 'Group D', [yCol]: 93 },
        { [xCol]: 'Group E', [yCol]: 64 },
      ];
    };
  }, [schema, profile, xCol, yCol]);

  // Execute Athena query
  useEffect(() => {
    let isMounted = true;
    const fetchChartData = async () => {
      setLoading(true);
      try {
        const res = await api.queryDashboardChart(datasetId, recommendation.sql);
        if (isMounted && res.data && res.data.length > 0) {
          // Normalize numeric values from Athena strings
          const parsed = res.data.map((row) => {
            const newRow: Record<string, any> = { ...row };
            Object.keys(newRow).forEach((k) => {
              const val = newRow[k];
              if (val !== null && val !== undefined && !isNaN(Number(val)) && typeof val === 'string' && val.trim() !== '') {
                newRow[k] = Number(val);
              }
            });
            return newRow;
          });
          setData(parsed);
          setIsAthenaLive(true);
          return;
        }
      } catch (err) {
        // Fallback to profile synthesis
      }

      if (isMounted) {
        setData(generateFallbackData());
        setIsAthenaLive(false);
      }
      if (isMounted) setLoading(false);
    };

    fetchChartData();
    return () => {
      isMounted = false;
    };
  }, [datasetId, recommendation.sql, generateFallbackData]);

  // Apply active categorical filters locally if present
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const filterKeys = Object.keys(activeFilters).filter((k) => activeFilters[k]);
    if (filterKeys.length === 0) return data;

    return data.filter((row) => {
      return filterKeys.every((key) => {
        const expected = activeFilters[key];
        const actual = row[key];
        if (actual === undefined || actual === null) return true;
        return String(actual).toLowerCase() === String(expected).toLowerCase();
      });
    });
  }, [data, activeFilters]);

  const handleCopySql = () => {
    navigator.clipboard.writeText(recommendation.sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleResetDimensions = () => {
    setChartType(recommendation.chart_type);
    setXCol(recommendation.x_column);
    setYCol(recommendation.y_column);
  };

  // Custom Dark Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/95 border border-slate-700/80 p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs">
          <p className="font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            {String(label)}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 py-0.5">
              <span className="text-slate-400 font-mono">{entry.name || yCol}:</span>
              <span className="font-bold font-mono text-white">
                {typeof entry.value === 'number'
                  ? entry.value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                  : entry.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    if (loading) {
      return (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500 mb-2" />
          <span className="text-xs">Executing query in Athena...</span>
        </div>
      );
    }

    if (!filteredData || filteredData.length === 0) {
      return (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400">
          <CircleDot className="w-6 h-6 text-slate-600 mb-2" />
          <span className="text-xs">No records matched the current criteria</span>
        </div>
      );
    }

    switch (chartType) {
      case 'line':
      case 'multi_line':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={filteredData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey={xCol}
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                tickFormatter={(val) => String(val).slice(0, 10)}
              />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey={yCol}
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#3b82f6' }}
                activeDot={{ r: 6, fill: '#60a5fa' }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${xCol}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey={xCol}
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                tickFormatter={(val) => String(val).slice(0, 10)}
              />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey={yCol}
                stroke="#06b6d4"
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#grad-${xCol})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => <span className="text-slate-300 text-xs">{value}</span>}
              />
              <Pie
                data={filteredData}
                dataKey={yCol}
                nameKey={xCol}
                cx="50%"
                cy="46%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
              >
                {filteredData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        );

      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey={xCol} stroke="#64748b" fontSize={11} tickLine={false} name={xCol} />
              <YAxis dataKey={yCol} stroke="#64748b" fontSize={11} tickLine={false} name={yCol} />
              <Tooltip content={<CustomTooltip />} />
              <Scatter name={recommendation.title} data={filteredData} fill="#8b5cf6" />
            </ScatterChart>
          </ResponsiveContainer>
        );

      case 'bar':
      default:
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={filteredData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey={xCol}
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                tickFormatter={(val) => (String(val).length > 12 ? `${String(val).slice(0, 10)}…` : String(val))}
              />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey={yCol} fill="#3b82f6" radius={[6, 6, 0, 0]}>
                {filteredData.map((_, index) => (
                  <Cell
                    key={`bar-cell-${index}`}
                    fill={PALETTE[index % PALETTE.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between backdrop-blur-sm shadow-sm hover:shadow-md">
      {/* Chart Header */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white tracking-tight">
                {recommendation.title}
              </h3>
              {isAthenaLive ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Athena Live
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  Synthesized Preview
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 line-clamp-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{recommendation.reason}</span>
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Chart Type Selector */}
            <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700/60">
              <button
                onClick={() => setChartType('bar')}
                title="Bar Chart"
                className={`p-1.5 rounded-md transition-colors ${
                  chartType === 'bar' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setChartType('line')}
                title="Line Chart"
                className={`p-1.5 rounded-md transition-colors ${
                  chartType === 'line' || chartType === 'multi_line'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setChartType('pie')}
                title="Pie Chart"
                className={`p-1.5 rounded-md transition-colors ${
                  chartType === 'pie' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <PieIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setChartType('scatter')}
                title="Scatter Plot"
                className={`p-1.5 rounded-md transition-colors ${
                  chartType === 'scatter' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <CircleDot className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Toggle dimension controls */}
            <button
              onClick={() => setShowControls(!showControls)}
              title="Customize Dimensions"
              className={`p-1.5 rounded-lg border transition-colors ${
                showControls
                  ? 'bg-slate-700 text-cyan-300 border-cyan-500/40'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
            </button>

            {/* View SQL Button */}
            <button
              onClick={() => setShowSql(!showSql)}
              title="View Underlying Athena SQL"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                showSql
                  ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700/60'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>SQL</span>
            </button>
          </div>
        </div>

        {/* Dimension customization row (collapsible) */}
        {showControls && (
          <div className="mb-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-wrap items-center gap-3 text-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">X-Axis:</span>
              <div className="relative">
                <select
                  value={xCol}
                  onChange={(e) => setXCol(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1 pr-6 font-mono text-xs appearance-none focus:outline-none focus:border-blue-500"
                >
                  {allColumns.map((col) => (
                    <option key={col} value={col}>
                      {col} ({schema[col]?.type})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-2 pointer-events-none" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Y-Axis:</span>
              <div className="relative">
                <select
                  value={yCol}
                  onChange={(e) => setYCol(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1 pr-6 font-mono text-xs appearance-none focus:outline-none focus:border-blue-500"
                >
                  {allColumns.map((col) => (
                    <option key={col} value={col}>
                      {col} ({schema[col]?.type})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-2 pointer-events-none" />
              </div>
            </div>

            <button
              onClick={handleResetDimensions}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 ml-auto transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset to Recommended
            </button>
          </div>
        )}

        {/* SQL Viewer drawer (collapsible) */}
        {showSql && (
          <div className="mb-3 p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs font-mono relative animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-2 font-sans">
              <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                <Code2 className="w-3.5 h-3.5 text-blue-400" />
                Underlying Athena SQL Query
              </span>
              <button
                onClick={handleCopySql}
                className="flex items-center gap-1 text-slate-300 hover:text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700 transition-colors"
              >
                {copiedSql ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy SQL</span>
                  </>
                )}
              </button>
            </div>
            <pre className="text-blue-300/90 whitespace-pre-wrap break-all text-[11px] bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80">
              {recommendation.sql}
            </pre>
            <p className="text-[10px] text-slate-400 mt-2 font-sans">
              Queries Parquet format partitioned in Amazon S3 via AWS Glue Data Catalog.
            </p>
          </div>
        )}
      </div>

      {/* Render Chart Content */}
      <div className="pt-2">{renderChart()}</div>
    </div>
  );
};
