import React from 'react';

const variantStyles = {
  success: 'bg-success-light text-success',
  warning: 'bg-warning-light text-warning',
  danger: 'bg-danger-light text-danger',
  info: 'bg-primary-light text-primary',
  neutral: 'bg-neutral-100 text-neutral-600',
  critical: 'bg-red-100 text-red-800',
};

export default function Badge({
  children,
  variant = 'neutral',
  dot = false,
  className = '',
}) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-0.5
        text-xs font-medium rounded-full whitespace-nowrap
        ${variantStyles[variant] || variantStyles.neutral}
        ${className}
      `}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full bg-current`} />
      )}
      {children}
    </span>
  );
}
