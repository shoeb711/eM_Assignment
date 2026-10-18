// Display helpers - one consistent format everywhere.

const money = new Intl.NumberFormat('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const moneyExact = new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatAED(value, { exact = false } = {}) {
  if (value === null || value === undefined) return '—';
  return `AED ${(exact ? moneyExact : money).format(value)}`;
}

// 1250000 -> "AED 1.25M", 45000 -> "AED 45K"
export function formatAEDShort(value) {
  if (value === null || value === undefined) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `AED ${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `AED ${Math.round(value / 1_000)}K`;
  return `AED ${Math.round(value)}`;
}

export function formatPct(value) {
  if (value === null || value === undefined) return 'n/a';
  return `${Number(value).toFixed(1)}%`;
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// 'IN_PROGRESS' -> 'In progress'
export function humanize(value) {
  if (!value) return '';
  const text = value.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
