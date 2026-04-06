import React from 'react';

const sizes = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-[3px]',
  lg: 'w-12 h-12 border-4',
};

export default function Spinner({ size = 'md', className = '' }) {
  return (
    <div
      className={`
        animate-spin rounded-full
        border-primary/20 border-t-primary
        ${sizes[size] || sizes.md}
        ${className}
      `}
    />
  );
}
