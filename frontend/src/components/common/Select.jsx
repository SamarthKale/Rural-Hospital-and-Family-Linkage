import React from 'react';

const Select = React.forwardRef(({
  label,
  error,
  options = [],
  placeholder = 'Select...',
  className = '',
  id,
  ...props
}, ref) => {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-neutral-700 mb-1">
          {label}
        </label>
      )}
      <select
        id={selectId}
        ref={ref}
        className={`input-base appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%2364748B" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>')] bg-no-repeat bg-[right_0.75rem_center] pr-10 ${error ? 'border-danger focus:ring-danger/30 focus:border-danger' : ''}`}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-xs text-danger">{error}</p>
      )}
    </div>
  );
});

Select.displayName = 'Select';
export default Select;
