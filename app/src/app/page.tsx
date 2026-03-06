import { getPortfolio, getSnapshots, getTargets, getConfig } from '@/lib/data';
import { formatUSD, formatILS, formatTimestamp, formatUSDPrecise, pnlColor } from '@/lib/format';
import { NetWorthChart } from '@/components/charts/NetWorthChart';
import { AllocationDonut } from '@/components/charts/AllocationDonut';
import type { PortfolioData } from '@/lib/types';

export const dynamic = 'force-dynamic';

function getAssetAllocation(portfolio: PortfolioData, tickerMap: Record<string, string>) {
  const buckets: Record<string, number> = {};
  for (const account of Object.values(portfolio.accounts)) {
    for (const [ticker, holding] of Object.entries(account.holdings)) {
      const cat = tickerMap[ticker] ?? (holding.currency === 'ILS' ? 'Cash' : 'Other');
      const usdValue = holding.currency === 'ILS'
        ? holding.value / portfolio.exchange_rate.usd_to_ils
        : holding.value;
      buckets[cat] = (buckets[cat] || 0) + usdValue;
    }
  }
  return Object.entries(buckets).map(([name, value]) => ({ name, value: Math.round(value) }));
}

function getBiggestPosition(portfolio: PortfolioData) {
  let biggest = { ticker: '', value: 0, account: '' };
  for (const [, account] of Object.entries(portfolio.accounts)) {
    for (const [ticker, holding] of Object.entries(account.holdings)) {
      const usdValue = holding.currency === 'ILS'
        ? holding.value / portfolio.exchange_rate.usd_to_ils
        : holding.value;
      if (usdValue > biggest.value) {
        biggest = { ticker, value: usdValue, account: account.name };
      }
    }
  }
  return biggest;
}

function getPendingSells(portfolio: PortfolioData) {
  const pending: { ticker: string; account: string; value: number; pnl?: number }[] = [];
  for (const account of Object.values(portfolio.accounts)) {
    for (const [ticker, holding] of Object.entries(account.holdings)) {
      if (holding.pending_sell) {
        pending.push({
          ticker,
          account: account.name,
          value: holding.value,
          pnl: holding.unrealized_pnl,
        });
      }
    }
  }
  return pending;
}

export default function Dashboard() {
  const portfolio = getPortfolio();
  const snapshots = getSnapshots();
  const targets = getTargets();
  const config = getConfig();

  // Compute display value based on base_currency setting
  const rate = portfolio.exchange_rate.usd_to_ils;
  let primaryValue: number;
  let primaryLabel: string;
  let primaryFormatter: (v: number) => string;

  if (config.base_currency === 'ILS') {
    primaryValue = portfolio.total_value_ils;
    primaryLabel = 'Total Portfolio Value';
    primaryFormatter = (v) => `₪${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  } else if (config.base_currency === 'blended') {
    primaryValue = Object.entries(config.blended).reduce((sum, [currency, weight]) => {
      if (currency === 'USD') return sum + portfolio.total_value_usd * weight;
      if (currency === 'ILS') return sum + (portfolio.total_value_ils / rate) * weight;
      return sum;
    }, 0);
    const blendLabel = Object.entries(config.blended)
      .map(([c, w]) => `${Math.round(w * 100)}% ${c}`)
      .join(' + ');
    primaryLabel = `Total Value (${blendLabel})`;
    primaryFormatter = formatUSD;
  } else {
    primaryValue = portfolio.total_value_usd;
    primaryLabel = 'Total Portfolio Value';
    primaryFormatter = formatUSD;
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

  const allocation = getAssetAllocation(portfolio, targets.tickers);
  const biggest = getBiggestPosition(portfolio);
  const pendingSells = getPendingSells(portfolio);

  const firstValue = snapshots.length > 0 ? snapshots[0].total_value_usd : portfolio.total_value_usd;
  const totalChange = portfolio.total_value_usd - firstValue;
  const totalChangePct = (totalChange / firstValue) * 100;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-baseline gap-6 flex-wrap">
          {config.base_currency === 'blended' ? (
            <>
              <div>
                <p className="text-sm text-zinc-500 mb-1">Total Portfolio Value</p>
                <div className="flex items-baseline gap-2 flex-wrap">
                  {Object.entries(config.blended).map(([currency, weight], i, arr) => (
                    <>
                      <div key={currency} className="flex flex-col">
                        <span className="text-xs text-zinc-500 mb-0.5">{Math.round(weight * 100)}% {currency}</span>
                        <span className="text-4xl font-bold tracking-tight">
                          {currency === 'USD'
                            ? formatUSD(portfolio.total_value_usd * weight)
                            : `₪${Math.round(portfolio.total_value_ils * weight).toLocaleString('en-US')}`}
                        </span>
                      </div>
                      {i < arr.length - 1 && (
                        <span className="text-2xl text-zinc-600 font-light self-end mb-1">+</span>
                      )}
                    </>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div>
              <p className="text-sm text-zinc-500 mb-1">{primaryLabel}</p>
              <p className="text-4xl font-bold tracking-tight">{primaryFormatter(primaryValue)}</p>
            </div>
          )}
          {config.base_currency === 'USD' && (
            <div>
              <p className="text-sm text-zinc-500 mb-1">&nbsp;</p>
              <p className="text-2xl font-semibold text-zinc-400">{formatILS(portfolio.total_value_ils)}</p>
            </div>
          )}
          {config.base_currency === 'ILS' && (
            <div>
              <p className="text-sm text-zinc-500 mb-1">&nbsp;</p>
              <p className="text-2xl font-semibold text-zinc-400">{formatUSD(portfolio.total_value_usd)}</p>
            </div>
          )}
        </div>
        <p className="text-xs text-zinc-600 mt-2">
          Last updated: {formatTimestamp(portfolio.last_updated)} &middot; Rate: 1 USD = {portfolio.exchange_rate.usd_to_ils} ILS
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NetWorthChart data={chartData} />
        <AllocationDonut data={allocation} title="Allocation by Asset Type" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Biggest Position</p>
          <p className="text-xl font-semibold">{biggest.ticker}</p>
          <p className="text-sm text-zinc-400">{formatUSD(biggest.value)} &middot; {biggest.account}</p>
        </div>

        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Accounts</p>
          <p className="text-xl font-semibold">{Object.keys(portfolio.accounts).length}</p>
          <p className="text-sm text-zinc-400">
            {Object.values(portfolio.accounts).filter(a => a.type === 'brokerage').length} brokerage,{' '}
            {Object.values(portfolio.accounts).filter(a => a.type === 'retirement').length} retirement,{' '}
            {Object.values(portfolio.accounts).filter(a => a.type === 'crypto').length} crypto
          </p>
        </div>

        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Pending Actions</p>
          {pendingSells.length > 0 ? (
            <div className="space-y-1">
              {pendingSells.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">SELL</span>
                  <span className="text-sm">{p.ticker}</span>
                  {p.pnl !== undefined && (
                    <span className={`text-xs ${pnlColor(p.pnl)}`}>
                      {p.pnl >= 0 ? '+' : ''}{formatUSDPrecise(p.pnl)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">None</p>
          )}
        </div>
      </div>
    </div>
  );
}
