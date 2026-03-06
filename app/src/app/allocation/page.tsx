import { getPortfolio, getTargets } from '@/lib/data';
import { AllocationDonut } from '@/components/charts/AllocationDonut';
import { AccountBar } from '@/components/charts/AccountBar';
import { TargetVsActual } from '@/components/charts/TargetVsActual';
import type { PortfolioData } from '@/lib/types';

export const dynamic = 'force-dynamic';

function getTickerAllocation(portfolio: PortfolioData) {
  const buckets: Record<string, number> = {};
  const rate = portfolio.exchange_rate.usd_to_ils;
  for (const account of Object.values(portfolio.accounts)) {
    for (const [ticker, holding] of Object.entries(account.holdings)) {
      const label = holding.name ? `${ticker.split('_')[0]}` : ticker;
      const usdValue = holding.currency === 'ILS'
        ? holding.value / rate
        : holding.value;
      buckets[label] = (buckets[label] || 0) + usdValue;
    }
  }
  return Object.entries(buckets)
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);
}

function getAccountAllocation(portfolio: PortfolioData) {
  return Object.values(portfolio.accounts)
    .map(a => ({ name: a.name, value: Math.round(a.total_value) }))
    .sort((a, b) => b.value - a.value);
}

function getTargetVsActual(portfolio: PortfolioData, targets: { allocations: Record<string, number>; tickers: Record<string, string> }) {
  const rate = portfolio.exchange_rate.usd_to_ils;
  const total = portfolio.total_value_usd;
  const actual: Record<string, number> = {};

  for (const account of Object.values(portfolio.accounts)) {
    for (const [ticker, holding] of Object.entries(account.holdings)) {
      const cat = targets.tickers[ticker] ?? (ticker.includes('FUND') ? 'Cash' : 'Other');
      const usdValue = holding.currency === 'ILS' ? holding.value / rate : holding.value;
      actual[cat] = (actual[cat] || 0) + usdValue;
    }
  }

  const categories = new Set([...Object.keys(targets.allocations), ...Object.keys(actual)]);
  return Array.from(categories).map(cat => ({
    name: cat,
    target: parseFloat(((targets.allocations[cat] || 0) * 100).toFixed(1)),
    actual: parseFloat(((actual[cat] || 0) / total * 100).toFixed(1)),
  })).sort((a, b) => b.target - a.target);
}

export default function AllocationPage() {
  const portfolio = getPortfolio();
  const targets = getTargets();
  const tickerData = getTickerAllocation(portfolio);
  const accountData = getAccountAllocation(portfolio);
  const targetVsActual = getTargetVsActual(portfolio, targets);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Allocation</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AllocationDonut data={tickerData} title="Allocation by Ticker" />
        <AccountBar data={accountData} />
      </div>

      <TargetVsActual data={targetVsActual} />

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-400">Target vs Actual Detail</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-zinc-500 uppercase tracking-wider">
              <th className="text-left px-5 py-2.5">Category</th>
              <th className="text-right px-5 py-2.5">Target</th>
              <th className="text-right px-5 py-2.5">Actual</th>
              <th className="text-right px-5 py-2.5">Diff</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {targetVsActual.map(row => {
              const diff = row.actual - row.target;
              return (
                <tr key={row.name} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-5 py-2.5 font-medium">{row.name}</td>
                  <td className="text-right px-5 py-2.5 text-zinc-400">{row.target}%</td>
                  <td className="text-right px-5 py-2.5">{row.actual}%</td>
                  <td className={`text-right px-5 py-2.5 font-medium ${
                    Math.abs(diff) < 2 ? 'text-zinc-400' : diff > 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {diff >= 0 ? '+' : ''}{diff.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
