import { getPortfolio, getTargets, getConfig } from '@/lib/data';
import { formatUSD } from '@/lib/format';
import { AllocationDonut } from '@/components/charts/AllocationDonut';
import { AccountBar } from '@/components/charts/AccountBar';
import { TargetVsActual } from '@/components/charts/TargetVsActual';
import type { PortfolioData } from '@/lib/types';

export const dynamic = 'force-dynamic';

function getTickerAllocation(portfolio: PortfolioData, targets: { tickers: Record<string, string> }) {
  const bucketsUsd: Record<string, number> = {};
  const bucketsIls: Record<string, number> = {};
  const rate = portfolio.exchange_rate.usd_to_ils;
  for (const account of Object.values(portfolio.accounts)) {
    for (const [ticker, holding] of Object.entries(account.holdings)) {
      const label = holding.name ? `${ticker.split('_')[0]}` : ticker;
      const cat = targets.tickers[ticker] ?? (ticker.includes('FUND') ? 'Cash' : 'Other');
      const usdValue = holding.currency === 'ILS' ? holding.value / rate : holding.value;
      bucketsUsd[label] = (bucketsUsd[label] || 0) + usdValue;
      if (cat === 'Cash') {
        const ilsValue = holding.currency === 'ILS' ? holding.value : holding.value * rate;
        bucketsIls[label] = (bucketsIls[label] || 0) + ilsValue;
      }
    }
  }
  return Object.entries(bucketsUsd)
    .map(([name, value]) => ({
      name,
      value: Math.round(value),
      nativeLabel: bucketsIls[name] !== undefined
        ? `₪${Math.round(bucketsIls[name]).toLocaleString('en-US')}`
        : undefined,
    }))
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
  const config = getConfig();
  const rate = portfolio.exchange_rate.usd_to_ils;
  const tickerData = getTickerAllocation(portfolio, targets);
  const accountData = getAccountAllocation(portfolio);
  const targetVsActual = getTargetVsActual(portfolio, targets);

  // Category → native ILS total (for Cash label in donut)
  const categoryIls: Record<string, number> = {};
  for (const account of Object.values(portfolio.accounts)) {
    for (const [ticker, holding] of Object.entries(account.holdings)) {
      const cat = targets.tickers[ticker] ?? (ticker.includes('FUND') ? 'Cash' : 'Other');
      if (cat === 'Cash') {
        const ils = holding.currency === 'ILS' ? holding.value : holding.value * rate;
        categoryIls[cat] = (categoryIls[cat] || 0) + ils;
      }
    }
  }

  // Cash slices get nativeLabel with actual ILS; AllocationDonut uses config+rate for others

  // Build category allocation data
  const catBuckets: Record<string, number> = {};
  for (const account of Object.values(portfolio.accounts)) {
    for (const [ticker, holding] of Object.entries(account.holdings)) {
      const cat = targets.tickers[ticker] ?? (ticker.includes('FUND') ? 'Cash' : 'Other');
      const usdValue = holding.currency === 'ILS' ? holding.value / rate : holding.value;
      catBuckets[cat] = (catBuckets[cat] || 0) + usdValue;
    }
  }
  const categoryData = Object.entries(catBuckets)
    .map(([name, value]) => ({
      name,
      value: Math.round(value),
      nativeLabel: name === 'Cash' && categoryIls[name] !== undefined
        ? `₪${Math.round(categoryIls[name]).toLocaleString('en-US')}`
        : undefined,
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-8">
      {/* Current Allocation Section */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold">Allocation</h1>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 border border-emerald-800">CURRENT</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AllocationDonut data={categoryData} title="By Asset Type (Current)" config={config} rate={rate} />
          <AllocationDonut data={tickerData} title="By Ticker (Current)" config={config} rate={rate} />
          <AccountBar data={accountData} />
        </div>
      </div>

      {/* Target vs Actual Section */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl font-semibold">Target vs Actual</h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">🎯 TARGET COMPARISON</span>
        </div>
        <TargetVsActual data={targetVsActual} />

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden mt-4">
          <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
            <h3 className="text-sm font-medium text-zinc-400">Detail</h3>
            <span className="text-xs text-zinc-600">— 🎯 Target is your desired allocation</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-zinc-500 uppercase tracking-wider">
                <th className="text-left px-5 py-2.5">Category</th>
                <th className="text-right px-5 py-2.5">
                  <span className="inline-flex items-center gap-1">🎯 Target</span>
                </th>
                <th className="text-right px-5 py-2.5">
                  <span className="inline-flex items-center gap-1 text-emerald-500">● Actual</span>
                </th>
                <th className="text-right px-5 py-2.5">Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {targetVsActual.map(row => {
                const diff = row.actual - row.target;
                const hasTarget = row.target > 0;
                return (
                  <tr key={row.name} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-5 py-2.5 font-medium">{row.name}</td>
                    <td className="text-right px-5 py-2.5">
                      {hasTarget
                        ? <span className="text-zinc-400">{row.target}%</span>
                        : <span className="text-zinc-700 text-xs italic">no target</span>
                      }
                    </td>
                    <td className="text-right px-5 py-2.5 text-emerald-400 font-medium">{row.actual}%</td>
                    <td className={`text-right px-5 py-2.5 font-medium ${
                      !hasTarget ? 'text-zinc-600' :
                      Math.abs(diff) < 2 ? 'text-zinc-400' : diff > 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {hasTarget ? (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%' : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
