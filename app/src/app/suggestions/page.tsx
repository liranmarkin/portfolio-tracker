import { getPortfolio, getTransactions, getTargets } from '@/lib/data';
import { formatUSD } from '@/lib/format';
import type { PortfolioData } from '@/lib/types';

export const dynamic = 'force-dynamic';

// ─── Suggestion types ────────────────────────────────────────────────────────
type Priority = 'high' | 'medium' | 'low';
type SuggestionCategory = 'rebalance' | 'risk' | 'action' | 'info';

interface Suggestion {
  priority: Priority;
  category: SuggestionCategory;
  title: string;
  detail: string;
  amount?: string;
}

// ─── Analysis ────────────────────────────────────────────────────────────────
function analyzePorfolio(portfolio: PortfolioData, targets: { allocations: Record<string, number>; tickers: Record<string, string> }): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const rate = portfolio.exchange_rate.usd_to_ils;
  const total = portfolio.total_value_usd;
  const TARGETS = targets.allocations;

  // Build category actuals
  const actual: Record<string, number> = {};
  const pendingSells: { ticker: string; account: string; value: number }[] = [];

  for (const [accId, account] of Object.entries(portfolio.accounts)) {
    for (const [ticker, holding] of Object.entries(account.holdings)) {
      const cat = targets.tickers[ticker] ?? (ticker.includes('FUND') ? 'Cash' : 'Other');
      const usdValue = holding.currency === 'ILS' ? holding.value / rate : holding.value;
      actual[cat] = (actual[cat] || 0) + usdValue;

      if (holding.pending_sell) {
        pendingSells.push({ ticker, account: account.name, value: usdValue });
      }
    }
  }

  // 1. Pending sell actions
  for (const ps of pendingSells) {
    suggestions.push({
      priority: 'high',
      category: 'action',
      title: `Pending sell: ${ps.ticker} @ ${ps.account}`,
      detail: `You have a pending sell order for ${ps.ticker}. Confirm execution and update holdings + transactions once filled.`,
      amount: formatUSD(ps.value),
    });
  }

  // 2. Allocation gaps
  for (const [cat, targetFrac] of Object.entries(TARGETS)) {
    if (targetFrac === 0) continue;
    const targetPct = parseFloat((targetFrac * 100).toFixed(1));
    const actualPct = ((actual[cat] || 0) / total) * 100;
    const diffPct = actualPct - targetPct;
    const diffUsd = (actual[cat] || 0) - (total * targetFrac);

    if (diffPct < -5) {
      suggestions.push({
        priority: diffPct < -10 ? 'high' : 'medium',
        category: 'rebalance',
        title: `Underweight: ${cat} (${actualPct.toFixed(1)}% vs ${targetPct}% target)`,
        detail: `You're ${Math.abs(diffPct).toFixed(1)}% below target. Consider buying more ${cat} exposure.`,
        amount: `${formatUSD(Math.abs(diffUsd))} to add`,
      });
    } else if (diffPct > 5) {
      suggestions.push({
        priority: diffPct > 10 ? 'high' : 'medium',
        category: 'rebalance',
        title: `Overweight: ${cat} (${actualPct.toFixed(1)}% vs ${targetPct}% target)`,
        detail: `You're ${diffPct.toFixed(1)}% above target. Consider trimming ${cat} exposure.`,
        amount: `${formatUSD(diffUsd)} to trim`,
      });
    }
  }

  // 3. Single asset concentration risk (>15% in one non-index ticker)
  const tickerValues: Record<string, number> = {};
  for (const account of Object.values(portfolio.accounts)) {
    for (const [ticker, holding] of Object.entries(account.holdings)) {
      const usdValue = holding.currency === 'ILS' ? holding.value / rate : holding.value;
      tickerValues[ticker] = (tickerValues[ticker] || 0) + usdValue;
    }
  }
  // Index/diversified tickers — skip concentration check (they ARE the diversification)
  const indexTickers = new Set(Object.keys(targets.tickers));
  for (const [ticker, val] of Object.entries(tickerValues)) {
    const pct = (val / total) * 100;
    if (pct > 15 && !indexTickers.has(ticker)) {
      suggestions.push({
        priority: pct > 25 ? 'high' : 'medium',
        category: 'risk',
        title: `Concentration risk: ${ticker} is ${pct.toFixed(1)}% of portfolio`,
        detail: `Single-stock/asset concentration above 15% increases idiosyncratic risk. Consider reducing ${ticker} position.`,
        amount: formatUSD(val),
      });
    }
  }

  // 4. Cash drag (too much cash)
  const cashPct = ((actual['Cash'] || 0) / total) * 100;
  const cashTargetFrac = TARGETS['Cash'] || 0.15;
  const cashTargetPct = cashTargetFrac * 100;
  if (cashPct > cashTargetPct + 5) {
    suggestions.push({
      priority: 'medium',
      category: 'rebalance',
      title: `Cash drag: ${cashPct.toFixed(1)}% in cash/money market`,
      detail: `You have ${cashPct.toFixed(1)}% in cash vs ${cashTargetPct}% target. Consider deploying into your underweight categories.`,
      amount: formatUSD((cashPct - cashTargetPct) / 100 * total),
    });
  }

  // 5. No bonds = missing cushion
  if (!actual['Bonds'] || actual['Bonds'] < total * 0.01) {
    const bondTargetFrac = TARGETS['Bonds'] || 0.02;
    suggestions.push({
      priority: 'medium',
      category: 'rebalance',
      title: 'No bonds exposure',
      detail: `Portfolio has no bonds. Target is ${(bondTargetFrac * 100).toFixed(0)}%. Adding IEF or similar provides a crash cushion and reduces correlation.`,
      amount: `${formatUSD(total * bondTargetFrac)} target`,
    });
  }

  // 6. Crypto > 25% — flag even if target is lower
  const cryptoPct = ((actual['Crypto'] || 0) / total) * 100;
  const cryptoTargetPct = parseFloat(((TARGETS['Crypto'] || 0.17) * 100).toFixed(1));
  if (cryptoPct > 25) {
    suggestions.push({
      priority: 'high',
      category: 'risk',
      title: `High crypto exposure: ${cryptoPct.toFixed(1)}% of total`,
      detail: `Crypto volatility can cause 50%+ drawdowns. Your target is ${cryptoTargetPct.toFixed(0)}%. Consider hedging or gradual reduction.`,
      amount: formatUSD(actual['Crypto'] || 0),
    });
  }

  // Sort: high → medium → low, then action → risk → rebalance → info
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const categoryOrder = { action: 0, risk: 1, rebalance: 2, info: 3 };
  suggestions.sort((a, b) =>
    priorityOrder[a.priority] - priorityOrder[b.priority] ||
    categoryOrder[a.category] - categoryOrder[b.category]
  );

  return suggestions;
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const PRIORITY_STYLES: Record<Priority, string> = {
  high:   'border-red-500/40 bg-red-500/5',
  medium: 'border-amber-500/40 bg-amber-500/5',
  low:    'border-zinc-700 bg-zinc-900',
};
const PRIORITY_BADGE: Record<Priority, string> = {
  high:   'bg-red-500/20 text-red-400',
  medium: 'bg-amber-500/20 text-amber-400',
  low:    'bg-zinc-700 text-zinc-400',
};
const CATEGORY_BADGE: Record<SuggestionCategory, string> = {
  action:   'bg-blue-500/20 text-blue-400',
  risk:     'bg-red-500/20 text-red-400',
  rebalance:'bg-purple-500/20 text-purple-400',
  info:     'bg-zinc-700 text-zinc-400',
};
const CATEGORY_ICON: Record<SuggestionCategory, string> = {
  action: '⚡',
  risk: '⚠️',
  rebalance: '⚖️',
  info: 'ℹ️',
};

// ─── Page ────────────────────────────────────────────────────────────────────
export default function SuggestionsPage() {
  const portfolio = getPortfolio();
  const targets = getTargets();
  const suggestions = analyzePorfolio(portfolio, targets);

  const high   = suggestions.filter(s => s.priority === 'high');
  const medium = suggestions.filter(s => s.priority === 'medium');
  const low    = suggestions.filter(s => s.priority === 'low');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Suggestions</h1>
        <p className="text-xs text-zinc-500">
          Based on current holdings vs target allocation · {suggestions.length} item{suggestions.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Summary bar */}
      <div className="flex gap-3 flex-wrap">
        {high.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-sm text-red-400 font-medium">{high.length} high priority</span>
          </div>
        )}
        {medium.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-sm text-amber-400 font-medium">{medium.length} medium priority</span>
          </div>
        )}
        {low.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700">
            <span className="w-2 h-2 rounded-full bg-zinc-400" />
            <span className="text-sm text-zinc-400 font-medium">{low.length} low priority</span>
          </div>
        )}
        {suggestions.length === 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-sm text-emerald-400 font-medium">All good — no actions needed</span>
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {suggestions.map((s, i) => (
          <div key={i} className={`rounded-xl border p-5 ${PRIORITY_STYLES[s.priority]}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg">{CATEGORY_ICON[s.category]}</span>
                  <span className="font-semibold text-zinc-100">{s.title}</span>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed">{s.detail}</p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${PRIORITY_BADGE[s.priority]}`}>
                  {s.priority}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_BADGE[s.category]}`}>
                  {s.category}
                </span>
                {s.amount && (
                  <span className="text-sm font-bold text-zinc-300 tabular-nums">{s.amount}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
