import { getPortfolio, getSnapshots, getDeposits, getConfig } from '@/lib/data';
import { formatUSD, formatDate, pnlColor } from '@/lib/format';
import { HistoryChart } from '@/components/charts/HistoryChart';

export const dynamic = 'force-dynamic';

export default function HistoryPage() {
  const portfolio = getPortfolio();
  const snapshots = getSnapshots();
  const deposits = getDeposits();
  const config = getConfig();
  const rate = portfolio.exchange_rate.usd_to_ils;

  // Format a USD value in the configured base currency
  function fmt(usd: number, sign = false): string {
    const prefix = sign && usd >= 0 ? '+' : '';
    if (config.base_currency === 'ILS') {
      return `${prefix}₪${Math.round(usd * rate).toLocaleString('en-US')}`;
    }
    if (config.base_currency === 'blended') {
      const parts = Object.entries(config.blended).map(([currency, weight]) => {
        const val = currency === 'ILS' ? usd * rate * weight : usd * weight;
        return currency === 'ILS'
          ? `₪${Math.round(val).toLocaleString('en-US')}`
          : formatUSD(val);
      });
      return `${prefix}${parts.join(' + ')}`;
    }
    return `${prefix}${formatUSD(usd)}`;
  }

  const chartData = [
    ...snapshots.map(s => ({
      date: s.date,
      value: Math.round(s.total_value_usd),
    })),
  ];

  const today = new Date().toISOString().split('T')[0];
  const lastSnap = chartData[chartData.length - 1];
  if (!lastSnap || lastSnap.date !== today) {
    chartData.push({ date: today, value: Math.round(portfolio.total_value_usd) });
  }

  const depositsByDate: Record<string, number> = {};
  for (const d of deposits.deposits) {
    depositsByDate[d.date] = (depositsByDate[d.date] || 0) + d.amount_usd;
  }

  const changes: {
    from: string; to: string;
    startValue: number; endValue: number;
    totalChange: number; deposited: number;
    marketGain: number; marketGainPct: number;
  }[] = [];

  for (let i = 1; i < chartData.length; i++) {
    const startValue = chartData[i - 1].value;
    const endValue = chartData[i].value;
    const totalChange = endValue - startValue;
    const deposited = Object.entries(depositsByDate)
      .filter(([date]) => date > chartData[i - 1].date && date <= chartData[i].date)
      .reduce((sum, [, amt]) => sum + amt, 0);
    const marketGain = totalChange - deposited;
    const marketGainPct = startValue > 0 ? (marketGain / startValue) * 100 : 0;
    changes.push({ from: chartData[i - 1].date, to: chartData[i].date, startValue, endValue, totalChange, deposited, marketGain, marketGainPct });
  }

  const totalDeposited = deposits.summary.total_deposited_usd;
  const firstValue = snapshots.length > 0 ? snapshots[0].total_value_usd : portfolio.total_value_usd;
  const totalGrowth = portfolio.total_value_usd - firstValue;
  const marketGains = totalGrowth - totalDeposited;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">History</h1>

      <HistoryChart data={chartData} config={config} rate={rate} />

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Capital Deposited</p>
          <p className="text-2xl font-bold text-blue-400">{fmt(totalDeposited, true)}</p>
          <p className="text-xs text-zinc-500 mt-1">{deposits.deposits.length} deposit(s) tracked</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Market Gains</p>
          <p className={`text-2xl font-bold ${pnlColor(marketGains)}`}>{fmt(marketGains, true)}</p>
          <p className="text-xs text-zinc-500 mt-1">Growth minus deposits</p>
        </div>
      </div>

      {/* Period breakdown */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-400">Period Changes</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-zinc-500 uppercase tracking-wider">
              <th className="text-left px-5 py-2.5">Period</th>
              <th className="text-right px-5 py-2.5">Start</th>
              <th className="text-right px-5 py-2.5">End</th>
              <th className="text-right px-5 py-2.5">Deposits</th>
              <th className="text-right px-5 py-2.5">Market Gain</th>
              <th className="text-right px-5 py-2.5">Real Return</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {changes.map((c, i) => (
              <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-5 py-2.5 text-zinc-300">
                  {formatDate(c.from)} &rarr; {formatDate(c.to)}
                </td>
                <td className="text-right px-5 py-2.5 text-zinc-400 tabular-nums">{fmt(c.startValue)}</td>
                <td className="text-right px-5 py-2.5 tabular-nums">{fmt(c.endValue)}</td>
                <td className="text-right px-5 py-2.5 text-blue-400 tabular-nums">
                  {c.deposited > 0 ? fmt(c.deposited, true) : '—'}
                </td>
                <td className={`text-right px-5 py-2.5 font-medium tabular-nums ${pnlColor(c.marketGain)}`}>
                  {fmt(c.marketGain, true)}
                </td>
                <td className={`text-right px-5 py-2.5 font-bold tabular-nums ${pnlColor(c.marketGain)}`}>
                  {c.marketGainPct >= 0 ? '+' : ''}{c.marketGainPct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Deposits list */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-400">Deposits</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-zinc-500 uppercase tracking-wider">
              <th className="text-left px-5 py-2.5">Date</th>
              <th className="text-left px-5 py-2.5">Account</th>
              <th className="text-left px-5 py-2.5">Ticker</th>
              <th className="text-right px-5 py-2.5">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {deposits.deposits.map((d, i) => (
              <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-5 py-2.5 text-zinc-300">{formatDate(d.date)}</td>
                <td className="px-5 py-2.5">{d.account}</td>
                <td className="px-5 py-2.5 font-medium">{d.ticker}</td>
                <td className="text-right px-5 py-2.5 text-blue-400 font-medium tabular-nums">
                  {(() => {
                    // Use stored historical amounts — never recalculate from today's rate
                    if (config.base_currency === 'blended' && d.amount_ils != null) {
                      const parts = Object.entries(config.blended).map(([currency, weight]) =>
                        currency === 'ILS'
                          ? `₪${Math.round(d.amount_ils! * weight).toLocaleString('en-US')}`
                          : formatUSD(d.amount_usd * weight)
                      );
                      return `+${parts.join(' + ')}`;
                    }
                    if (config.base_currency === 'ILS' && d.amount_ils != null) {
                      return `+₪${Math.round(d.amount_ils).toLocaleString('en-US')}`;
                    }
                    return `+${formatUSD(d.amount_usd)}`;
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
