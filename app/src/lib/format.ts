export function formatUSD(value: number): string {
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function formatUSDPrecise(value: number): string {
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatILS(value: number): string {
  return '₪' + value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function formatPercent(value: number): string {
  return value.toFixed(1) + '%';
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function daysSince(dateStr: string): number {
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return Infinity;
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
}

export interface Staleness {
  days: number;
  level: 'fresh' | 'aging' | 'stale' | 'unknown';
  label: string;
  badgeColor: string;
}

export function priceStaleness(lastPriced: string | undefined): Staleness {
  if (!lastPriced) {
    return { days: Infinity, level: 'unknown', label: 'no timestamp', badgeColor: 'bg-zinc-500/20 text-zinc-400' };
  }
  const days = daysSince(lastPriced);
  if (days <= 1) return { days, level: 'fresh', label: 'today', badgeColor: 'bg-emerald-500/10 text-emerald-400/80' };
  if (days <= 14) return { days, level: 'fresh', label: `${days}d ago`, badgeColor: 'bg-zinc-500/10 text-zinc-400' };
  if (days <= 45) return { days, level: 'aging', label: `${days}d ago`, badgeColor: 'bg-amber-500/20 text-amber-400' };
  return { days, level: 'stale', label: `${days}d stale`, badgeColor: 'bg-red-500/20 text-red-400' };
}

export function pnlColor(value: number): string {
  if (value > 0) return 'text-emerald-400';
  if (value < 0) return 'text-red-400';
  return 'text-zinc-400';
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  brokerage:   'brokerage',
  retirement:  'pension',
  hishtalmut:  'קרן השתלמות',
  crypto:      'crypto',
};

export function accountTypeLabel(type: string): string {
  return ACCOUNT_TYPE_LABELS[type] ?? type;
}

export function accountTypeBadgeColor(type: string): string {
  switch (type) {
    case 'brokerage':  return 'bg-blue-500/20 text-blue-400';
    case 'retirement': return 'bg-purple-500/20 text-purple-400';
    case 'hishtalmut': return 'bg-teal-500/20 text-teal-400';
    case 'crypto':     return 'bg-amber-500/20 text-amber-400';
    default:           return 'bg-zinc-500/20 text-zinc-400';
  }
}
