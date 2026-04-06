import React from 'react';

export default function Skeleton({
  width = '100%',
  height = '20px',
  rounded = 'rounded-lg',
  className = '',
}) {
  return (
    <div
      className={`animate-pulse bg-neutral-200 ${rounded} ${className}`}
      style={{ width, height }}
    />
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`card p-4 space-y-3 ${className}`}>
      <Skeleton height="16px" width="60%" />
      <Skeleton height="24px" width="80%" />
      <Skeleton height="12px" width="40%" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-4 p-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height="14px" width={`${100 / cols}%`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 p-3 border-t border-neutral-100">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} height="16px" width={`${100 / cols}%`} />
          ))}
        </div>
      ))}
    </div>
  );
}
