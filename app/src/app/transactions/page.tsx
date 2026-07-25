import { getConfig, getTransactions } from '@/lib/data';
import { formatUSD, formatDate, pnlColor } from '@/lib/format';
import { computeRealizedPnl, isSameAssetSwap, RealizedPnl } from '@/lib/pnl';
import { Transaction } from '@/lib/types';

export const dynamic = 'force-dynamic';

const TYPE_STYLES: Record<string, string> = {
  buy:        'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  sell:       'bg-red-500/15 text-red-400 border border-red-500/30',
  deposit:    'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  withdrawal: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  swap:       'bg-purple-500/15 text-purple-400 border border-purple-500/30',
  income:     'bg-teal-500/15 text-teal-400 border border-teal-500/30',
};

const TYPE_LABEL: Record<string, string> = {
  buy: 'BUY', sell: 'SELL', deposit: 'DEPOSIT', withdrawal: 'WITHDRAWAL',
  swap: 'SWAP', income: 'INCOME',
};

function AmountCell({ tx }: { tx: Transaction }) {
  const amount = tx.amount_usd ?? (tx.type === 'swap' ? tx.from_amount_usd : null);
  if (amount == null) {
    return <span className="text-zinc-500">—</span>;
  }
  if (tx.type === 'swap') {
    return <span className="text-zinc-300 font-medium">{formatUSD(amount)}</span>;
  }
  if (tx.type === 'deposit') {
    return <span className="text-blue-400 font-medium">+{formatUSD(amount)}</span>;
  }
  if (tx.type === 'income') {
    return <span className="text-teal-400 font-medium">+{formatUSD(amount)}</span>;
  }
  const sign = tx.type === 'sell' || tx.type === 'withdrawal' ? '+' : '-';
  const color = tx.type === 'sell' || tx.type === 'withdrawal' ? 'text-emerald-400' : 'text-red-400';
  return <span className={`font-medium ${color}`}>{sign}{formatUSD(amount)}</span>;
}

function PnlCell({ pnl }: { pnl: RealizedPnl | null }) {
  if (pnl == null) {
    return <span className="text-zinc-600">—</span>;
  }
  const sign = pnl.pnl_usd >= 0 ? '+' : '−';
  const pct = pnl.pct != null ? ` (${pnl.pnl_usd >= 0 ? '+' : ''}${(pnl.pct * 100).toFixed(1)}%)` : '';
  return (
    <span
      className={`font-medium tabular-nums ${pnlColor(pnl.pnl_usd)}`}
      title={`FIFO within account: proceeds ${formatUSD(pnl.proceeds_usd)} − cost ${formatUSD(pnl.cost_usd)}${
        pnl.partial ? ` · ${pnl.unmatched_qty.toLocaleString()} units had no recorded buy lots` : ''
      }`}
    >
      {sign}{formatUSD(Math.abs(pnl.pnl_usd))}
      <span className="text-xs opacity-75">{pct}</span>
      {pnl.partial && <span className="text-amber-400" title="Partial cost basis — some sold units have no recorded buy lots">†</span>}
    </span>
  );
}

function AssetCell({ tx }: { tx: Transaction }) {
  if (tx.type === 'swap' && tx.from_ticker) {
    return (
      <span className="font-semibold">
        {tx.from_ticker} <span className="text-zinc-500">→</span> {tx.to_ticker ?? '?'}
      </span>
    );
  }
  return <span className="font-semibold">{tx.ticker ?? '—'}</span>;
}

export default function TransactionsPage() {
  const { transactions } = getTransactions();

  // Realized P&L per transaction (FIFO, per account) — computed in original
  // order, then carried along through sorting/grouping. Wrapped-asset tickers
  // (WBTC → BTC etc.) share one queue; extend via config.json ticker_aliases.
  const aliases = getConfig().ticker_aliases;
  const pnls = computeRealizedPnl(transactions, aliases);
  // Same-asset wrapper swaps (WBTC → BTC) are pure repackaging — hidden from
  // the list entirely; they remain in the data file as an audit trail.
  const rows = transactions
    .map((tx, i) => ({ tx, pnl: pnls[i] }))
    .filter(({ tx }) => !isSameAssetSwap(tx, aliases));

  // Sort newest first
  const sorted = [...rows].sort((a, b) => b.tx.date.localeCompare(a.tx.date));

  // Summary stats — internal transfers between own accounts are excluded
  const external = sorted.filter(r => !r.tx.internal);
  const totalBought    = external.filter(r => r.tx.type === 'buy').reduce((s, r) => s + (r.tx.amount_usd ?? 0), 0);
  const totalSold      = external.filter(r => r.tx.type === 'sell').reduce((s, r) => s + (r.tx.amount_usd ?? 0), 0);
  const totalDeposited = external.filter(r => r.tx.type === 'deposit').reduce((s, r) => s + (r.tx.amount_usd ?? 0), 0);
  const totalRealized  = sorted.reduce((s, r) => s + (r.pnl?.pnl_usd ?? 0), 0);
  const realizedCount  = sorted.filter(r => r.pnl != null).length;

  // Group by date
  const byDate: Record<string, typeof rows> = {};
  for (const row of sorted) {
    if (!byDate[row.tx.date]) byDate[row.tx.date] = [];
    byDate[row.tx.date].push(row);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Transactions</h1>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Capital Deposited</p>
          <p className="text-2xl font-bold text-blue-400">+{formatUSD(totalDeposited)}</p>
          <p className="text-xs text-zinc-500 mt-1">{external.filter(r => r.tx.type === 'deposit').length} deposits</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Total Bought</p>
          <p className="text-2xl font-bold text-red-400">-{formatUSD(totalBought)}</p>
          <p className="text-xs text-zinc-500 mt-1">{external.filter(r => r.tx.type === 'buy').length} buy orders</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Total Sold</p>
          <p className="text-2xl font-bold text-emerald-400">+{formatUSD(totalSold)}</p>
          <p className="text-xs text-zinc-500 mt-1">{external.filter(r => r.tx.type === 'sell').length} sell orders</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Realized P&L</p>
          <p className={`text-2xl font-bold ${pnlColor(totalRealized)}`}>
            {totalRealized >= 0 ? '+' : '−'}{formatUSD(Math.abs(totalRealized))}
          </p>
          <p className="text-xs text-zinc-500 mt-1">FIFO · {realizedCount} disposals with basis</p>
        </div>
      </div>

      {/* Transaction list grouped by date */}
      <div className="space-y-4">
        {Object.entries(byDate).map(([date, dateRows]) => (
          <div key={date} className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-300">{formatDate(date)}</span>
              <span className="text-xs text-zinc-500">{dateRows.length} transaction{dateRows.length > 1 ? 's' : ''}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800/50">
                  <th className="text-left px-5 py-2">Type</th>
                  <th className="text-left px-5 py-2">Account</th>
                  <th className="text-left px-5 py-2">Asset</th>
                  <th className="text-right px-5 py-2">Qty</th>
                  <th className="text-right px-5 py-2">Price</th>
                  <th className="text-right px-5 py-2">Amount</th>
                  <th className="text-right px-5 py-2">P&L</th>
                  <th className="text-left px-5 py-2 text-zinc-600">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {dateRows.map(({ tx, pnl }, i) => (
                  <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_STYLES[tx.type] ?? 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/30'}`}>
                        {TYPE_LABEL[tx.type] ?? tx.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-300 font-mono text-xs">{tx.account}</td>
                    <td className="px-5 py-3"><AssetCell tx={tx} /></td>
                    <td className="text-right px-5 py-3 text-zinc-400 tabular-nums">
                      {(tx.quantity ?? tx.from_quantity) != null ? (tx.quantity ?? tx.from_quantity)!.toLocaleString() : '—'}
                    </td>
                    <td className="text-right px-5 py-3 text-zinc-400 tabular-nums">
                      {tx.price_usd != null ? formatUSD(tx.price_usd) : '—'}
                    </td>
                    <td className="text-right px-5 py-3 tabular-nums">
                      <AmountCell tx={tx} />
                    </td>
                    <td className="text-right px-5 py-3">
                      <PnlCell pnl={pnl} />
                    </td>
                    <td className="px-5 py-3 text-zinc-500 text-xs max-w-xs truncate" title={tx.note ?? ''}>{tx.note ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {sorted.length === 0 && (
          <div className="text-center py-16 text-zinc-600">
            No transactions yet. Add entries to <code className="text-zinc-500">data/transactions.json</code>.
          </div>
        )}
      </div>

      {sorted.length > 0 && (
        <p className="text-xs text-zinc-600">
          P&L is realized gain/loss computed FIFO <em>within each account</em> (USD, fee-inclusive amounts as recorded).
          Wrapped variants count as their base asset (WBTC/cbBTC = BTC, stETH/weETH = ETH); swapping between variants
          of the same asset realizes nothing. Cross-asset swaps are in-kind disposals. † = partial cost basis: some
          sold units predate recorded history. This is an economic view — not tax advice; tax P&L may use different
          lot ordering, currency, and rules.
        </p>
      )}
    </div>
  );
}
