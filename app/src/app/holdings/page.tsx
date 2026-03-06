import { getPortfolio, getConfig } from '@/lib/data';
import { formatUSD, formatUSDPrecise, formatILS, pnlColor, accountTypeBadgeColor, accountTypeLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default function HoldingsPage() {
  const portfolio = getPortfolio();
  const config = getConfig();
  const rate = portfolio.exchange_rate.usd_to_ils;

  // Format account total in base currency
  function formatAccountTotal(totalUsd: number) {
    if (config.base_currency === 'ILS') {
      return `₪${Math.round(totalUsd * rate).toLocaleString('en-US')}`;
    }
    if (config.base_currency === 'blended') {
      const parts = Object.entries(config.blended).map(([currency, weight]) => {
        if (currency === 'USD') return formatUSD(totalUsd * weight);
        if (currency === 'ILS') return `₪${Math.round(totalUsd * rate * weight).toLocaleString('en-US')}`;
        return '';
      });
      return parts.join(' + ');
    }
    return formatUSD(totalUsd);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Holdings</h1>

      {Object.entries(portfolio.accounts).map(([key, account]) => (
        <div key={key} className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">{account.name}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${accountTypeBadgeColor(account.type)}`}>
                {accountTypeLabel(account.type)}
              </span>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">{formatAccountTotal(account.total_value)}</p>
              <p className="text-xs text-zinc-500">{account.percentage.toFixed(1)}% of portfolio</p>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-zinc-500 uppercase tracking-wider">
                <th className="text-left px-5 py-2.5">Asset</th>
                <th className="text-right px-5 py-2.5">Qty</th>
                <th className="text-right px-5 py-2.5">Price</th>
                <th className="text-right px-5 py-2.5">Value</th>
                <th className="text-right px-5 py-2.5">P&L</th>
                <th className="text-right px-5 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {Object.entries(account.holdings).map(([ticker, h]) => {
                const isILS = h.currency === 'ILS';
                const usdValue = isILS ? h.value / rate : h.value;
                const price = h.current_price_ils ?? h.current_price;

                return (
                  <tr key={ticker} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium">{ticker}</div>
                      {h.name && <div className="text-xs text-zinc-500 truncate max-w-[200px]">{h.name}</div>}
                    </td>
                    <td className="text-right px-5 py-3 text-zinc-300 tabular-nums">
                      {h.quantity !== undefined ? (
                        h.quantity < 1 ? h.quantity.toFixed(6) : h.quantity.toLocaleString()
                      ) : '—'}
                    </td>
                    <td className="text-right px-5 py-3 text-zinc-300 tabular-nums">
                      {price !== undefined ? (
                        isILS ? `₪${price.toFixed(2)}` : `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      ) : '—'}
                    </td>
                    <td className="text-right px-5 py-3 tabular-nums">
                      <div className="font-medium">
                        {isILS ? formatILS(h.value) : formatUSDPrecise(h.value)}
                      </div>
                      {isILS && (
                        <div className="text-xs text-zinc-500">{formatUSD(usdValue)}</div>
                      )}
                    </td>
                    <td className="text-right px-5 py-3 tabular-nums">
                      {h.unrealized_pnl !== undefined ? (
                        <div>
                          <span className={`font-medium ${pnlColor(h.unrealized_pnl)}`}>
                            {h.unrealized_pnl >= 0 ? '+' : ''}{formatUSDPrecise(h.unrealized_pnl)}
                          </span>
                          {h.unrealized_pct !== undefined && (
                            <div className={`text-xs ${pnlColor(h.unrealized_pnl)}`}>
                              {h.unrealized_pct >= 0 ? '+' : ''}{h.unrealized_pct.toFixed(1)}%
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="text-right px-5 py-3">
                      {h.pending_sell && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">
                          Pending Sell
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
