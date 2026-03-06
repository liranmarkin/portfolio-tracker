import { getTransactions } from '@/lib/data';
import { formatUSD, formatDate } from '@/lib/format';
import { Transaction } from '@/lib/types';

export const dynamic = 'force-dynamic';

const TYPE_STYLES: Record<string, string> = {
  buy:        'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  sell:       'bg-red-500/15 text-red-400 border border-red-500/30',
  deposit:    'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  withdrawal: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
};

const TYPE_LABEL: Record<string, string> = {
  buy: 'BUY', sell: 'SELL', deposit: 'DEPOSIT', withdrawal: 'WITHDRAWAL',
};

function AmountCell({ tx }: { tx: Transaction }) {
  if (tx.amount_usd == null) {
    return <span className="text-zinc-500">—</span>;
  }
  const sign = tx.type === 'sell' || tx.type === 'withdrawal' ? '+' : '-';
  const color = tx.type === 'sell' || tx.type === 'withdrawal' ? 'text-emerald-400' : 'text-red-400';
  if (tx.type === 'deposit') {
    return <span className="text-blue-400 font-medium">+{formatUSD(tx.amount_usd)}</span>;
  }
  return <span className={`font-medium ${color}`}>{sign}{formatUSD(tx.amount_usd)}</span>;
}

export default function TransactionsPage() {
  const { transactions } = getTransactions();

  // Sort newest first
  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));

  // Summary stats
  const totalBought    = sorted.filter(t => t.type === 'buy').reduce((s, t) => s + (t.amount_usd ?? 0), 0);
  const totalSold      = sorted.filter(t => t.type === 'sell').reduce((s, t) => s + (t.amount_usd ?? 0), 0);
  const totalDeposited = sorted.filter(t => t.type === 'deposit').reduce((s, t) => s + (t.amount_usd ?? 0), 0);

  // Group by date
  const byDate: Record<string, Transaction[]> = {};
  for (const tx of sorted) {
    if (!byDate[tx.date]) byDate[tx.date] = [];
    byDate[tx.date].push(tx);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Transactions</h1>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Capital Deposited</p>
          <p className="text-2xl font-bold text-blue-400">+{formatUSD(totalDeposited)}</p>
          <p className="text-xs text-zinc-500 mt-1">{sorted.filter(t => t.type === 'deposit').length} deposits</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Total Bought</p>
          <p className="text-2xl font-bold text-red-400">-{formatUSD(totalBought)}</p>
          <p className="text-xs text-zinc-500 mt-1">{sorted.filter(t => t.type === 'buy').length} buy orders</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Total Sold</p>
          <p className="text-2xl font-bold text-emerald-400">+{formatUSD(totalSold)}</p>
          <p className="text-xs text-zinc-500 mt-1">{sorted.filter(t => t.type === 'sell').length} sell orders</p>
        </div>
      </div>

      {/* Transaction list grouped by date */}
      <div className="space-y-4">
        {Object.entries(byDate).map(([date, txs]) => (
          <div key={date} className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-300">{formatDate(date)}</span>
              <span className="text-xs text-zinc-500">{txs.length} transaction{txs.length > 1 ? 's' : ''}</span>
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
                  <th className="text-left px-5 py-2 text-zinc-600">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {txs.map((tx, i) => (
                  <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_STYLES[tx.type] ?? ''}`}>
                        {TYPE_LABEL[tx.type] ?? tx.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-300 font-mono text-xs">{tx.account}</td>
                    <td className="px-5 py-3 font-semibold">{tx.ticker ?? '—'}</td>
                    <td className="text-right px-5 py-3 text-zinc-400 tabular-nums">
                      {tx.quantity != null ? tx.quantity.toLocaleString() : '—'}
                    </td>
                    <td className="text-right px-5 py-3 text-zinc-400 tabular-nums">
                      {tx.price_usd != null ? formatUSD(tx.price_usd) : '—'}
                    </td>
                    <td className="text-right px-5 py-3 tabular-nums">
                      <AmountCell tx={tx} />
                    </td>
                    <td className="px-5 py-3 text-zinc-500 text-xs max-w-xs truncate">{tx.note ?? ''}</td>
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
    </div>
  );
}
