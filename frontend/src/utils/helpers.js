/**
 * Format a date string to DD/MM/YYYY
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Calculate age from date of birth or estimated age
 */
export function calculateAge(dob, estimatedAge) {
  if (estimatedAge) return `~${estimatedAge} yrs`;
  if (!dob) return '—';
  const today = new Date();
  const birth = new Date(dob);
  let years = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    years--;
  }

  if (years < 1) {
    const months = (today.getFullYear() - birth.getFullYear()) * 12 +
      (today.getMonth() - birth.getMonth());
    if (months < 1) {
      const days = Math.floor((today - birth) / 86400000);
      return `${days} days`;
    }
    return `${months} mo`;
  }
  return `${years} yrs`;
}

/**
 * Calculate gestational age in weeks from LMP or EDD
 */
export function gestationalWeeks(lmpDate, eddDate) {
  if (!lmpDate && !eddDate) return null;

  const today = new Date();
  let lmp;

  if (lmpDate) {
    lmp = new Date(lmpDate);
  } else if (eddDate) {
    // EDD is LMP + 280 days, so LMP = EDD - 280 days
    lmp = new Date(eddDate);
    lmp.setDate(lmp.getDate() - 280);
  }

  const diffMs = today - lmp;
  const weeks = Math.floor(diffMs / (7 * 86400000));
  const days = Math.floor((diffMs % (7 * 86400000)) / 86400000);

  return { weeks, days, display: `${weeks}w ${days}d` };
}

/**
 * Days from now to a date
 */
export function daysAgo(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - d) / 86400000);
}

/**
 * Severity to color class mapping
 */
export function severityColor(severity) {
  switch (severity) {
    case 'critical': return 'danger';
    case 'high': return 'warning';
    case 'medium': return 'info';
    case 'low': return 'neutral';
    default: return 'neutral';
  }
}

/**
 * Risk level to badge variant
 */
export function riskBadgeVariant(level) {
  switch (level) {
    case 'critical': return 'danger';
    case 'high': return 'danger';
    case 'medium': return 'warning';
    case 'low': return 'success';
    default: return 'neutral';
  }
}

/**
 * Pregnancy status display
 */
export function pregnancyStatusDisplay(status) {
  const map = {
    registered: 'Registered',
    anc_ongoing: 'ANC Ongoing',
    delivered: 'Delivered',
    complicated: 'Complicated',
    terminated: 'Terminated',
  };
  return map[status] || status;
}

/**
 * Truncate text
 */
export function truncate(str, len = 50) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '…' : str;
}
