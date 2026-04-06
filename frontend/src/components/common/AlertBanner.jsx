import React, { useState } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

const variants = {
  info: {
    bg: 'bg-primary-light border-primary/30',
    text: 'text-primary-dark',
    icon: Info,
  },
  warning: {
    bg: 'bg-warning-light border-warning/30',
    text: 'text-amber-800',
    icon: AlertTriangle,
  },
  danger: {
    bg: 'bg-danger-light border-danger/30',
    text: 'text-red-800',
    icon: AlertCircle,
  },
  success: {
    bg: 'bg-success-light border-success/30',
    text: 'text-green-800',
    icon: CheckCircle,
  },
};

export default function AlertBanner({
  children,
  variant = 'info',
  dismissable = true,
  className = '',
  onDismiss,
}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const v = variants[variant] || variants.info;
  const Icon = v.icon;

  const handleDismiss = () => {
    setDismissed(true);
    if (onDismiss) onDismiss();
  };

  return (
    <div className={`flex items-start gap-3 px-4 py-3 border rounded-lg ${v.bg} ${className}`}>
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${v.text}`} />
      <div className={`flex-1 text-sm ${v.text}`}>
        {children}
      </div>
      {dismissable && (
        <button onClick={handleDismiss} className={`shrink-0 p-0.5 rounded ${v.text} opacity-60 hover:opacity-100`}>
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
