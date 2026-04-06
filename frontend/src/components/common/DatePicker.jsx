import React from 'react';
import { formatDate } from '../../utils/helpers';

const DatePicker = React.forwardRef(({
  label,
  error,
  className = '',
  id,
  displayValue,
  ...props
}, ref) => {
  const pickerId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor={pickerId} className="block text-sm font-medium text-neutral-700 mb-1">
          {label}
        </label>
      )}
      <input
        id={pickerId}
        ref={ref}
        type="date"
        className={`input-base ${error ? 'border-danger focus:ring-danger/30 focus:border-danger' : ''}`}
        {...props}
      />
      {displayValue && (
        <p className="mt-0.5 text-xs text-neutral-500">{formatDate(displayValue)}</p>
      )}
      {error && (
        <p className="mt-1 text-xs text-danger">{error}</p>
      )}
    </div>
  );
});

DatePicker.displayName = 'DatePicker';
export default DatePicker;
