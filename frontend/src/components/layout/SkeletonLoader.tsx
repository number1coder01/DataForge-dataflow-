import React from 'react';

/**
 * Reusable skeleton shimmer block
 */
const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`skeleton-shimmer rounded-xl ${className}`}
    aria-hidden="true"
  />
);

/**
 * Table skeleton — mimics the datasets/pipeline runs table
 */
export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 6,
}) => (
  <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-xl animate-fade-in">
    {/* Header */}
    <div className="bg-[var(--color-bg-elevated)] border-b border-[var(--color-border)] flex gap-4 px-4 py-4">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-3 flex-1" />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, r) => (
      <div
        key={r}
        className="flex gap-4 px-4 py-4 border-b border-[var(--color-border-subtle)]"
      >
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton
            key={c}
            className="h-3 flex-1"
            style={{ animationDelay: `${(r * cols + c) * 60}ms` } as React.CSSProperties}
          />
        ))}
      </div>
    ))}
  </div>
);

/**
 * Card grid skeleton — mimics KPI cards / summary cards
 */
export const CardGridSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-in">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 rounded-2xl"
      >
        <Skeleton className="h-3 w-20 mb-3" />
        <Skeleton className="h-6 w-16" />
      </div>
    ))}
  </div>
);

/**
 * Page-level skeleton with header + cards + table
 */
export const PageSkeleton: React.FC = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
    {/* Page header */}
    <div className="flex items-center justify-between">
      <div>
        <Skeleton className="h-6 w-40 mb-2" />
        <Skeleton className="h-3 w-64" />
      </div>
      <Skeleton className="h-10 w-36 rounded-xl" />
    </div>

    <CardGridSkeleton />
    <TableSkeleton />
  </div>
);

/**
 * Detail page skeleton
 */
export const DetailSkeleton: React.FC = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
    {/* Back button + title */}
    <div className="flex items-center gap-3">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <div>
        <Skeleton className="h-7 w-60 mb-2" />
        <Skeleton className="h-3 w-40" />
      </div>
    </div>

    <CardGridSkeleton />

    {/* Tabs */}
    <div className="flex gap-2 border-b border-[var(--color-border)] pb-0">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-28 rounded-t-xl" />
      ))}
    </div>

    {/* Content area */}
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  </div>
);

export { Skeleton };
