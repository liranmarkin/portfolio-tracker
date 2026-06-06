import { getPortfolio } from '@/lib/data';

export const dynamic = 'force-dynamic';

const MATRIX: Record<string, Record<string, number>> = {
  IVV:    { IVV: 1.00, BTC: 0.30, ETH: 0.32, GOOG: 0.75, QQQ: 0.90, TLT: -0.25, GLDM: 0.08, FTSEAW: 0.90, VXUS: 0.85 },
  BTC:    { IVV: 0.30, BTC: 1.00, ETH: 0.88, GOOG: 0.30, QQQ: 0.35, TLT: -0.10, GLDM: 0.10, FTSEAW: 0.30, VXUS: 0.25 },
  ETH:    { IVV: 0.32, BTC: 0.88, ETH: 1.00, GOOG: 0.30, QQQ: 0.35, TLT: -0.10, GLDM: 0.10, FTSEAW: 0.30, VXUS: 0.25 },
  GOOG:   { IVV: 0.75, BTC: 0.30, ETH: 0.30, GOOG: 1.00, QQQ: 0.85, TLT: -0.20, GLDM: 0.05, FTSEAW: 0.75, VXUS: 0.70 },
  QQQ:    { IVV: 0.90, BTC: 0.35, ETH: 0.35, GOOG: 0.85, QQQ: 1.00, TLT: -0.25, GLDM: 0.05, FTSEAW: 0.85, VXUS: 0.80 },
  TLT:    { IVV: -0.25, BTC: -0.10, ETH: -0.10, GOOG: -0.20, QQQ: -0.25, TLT: 1.00, GLDM: 0.25, FTSEAW: -0.25, VXUS: -0.25 },
  GLDM:   { IVV: 0.08, BTC: 0.10, ETH: 0.10, GOOG: 0.05, QQQ: 0.05, TLT: 0.25, GLDM: 1.00, FTSEAW: 0.05, VXUS: 0.05 },
  FTSEAW: { IVV: 0.90, BTC: 0.30, ETH: 0.30, GOOG: 0.75, QQQ: 0.85, TLT: -0.25, GLDM: 0.05, FTSEAW: 1.00, VXUS: 0.95 },
  VXUS:   { IVV: 0.85, BTC: 0.25, ETH: 0.25, GOOG: 0.70, QQQ: 0.80, TLT: -0.25, GLDM: 0.05, FTSEAW: 0.95, VXUS: 1.00 },
};

const ASSETS = Object.keys(MATRIX);

function getColor(val: number): string {
  if (val === 1.00) return 'bg-zinc-700 text-zinc-300';
  if (val >= 0.80) return 'bg-red-900/80 text-red-200';
  if (val >= 0.60) return 'bg-orange-900/70 text-orange-200';
  if (val >= 0.30) return 'bg-yellow-900/60 text-yellow-200';
  if (val >= 0.10) return 'bg-zinc-800 text-zinc-400';
  if (val >= -0.05) return 'bg-zinc-800/50 text-zinc-500';
  return 'bg-emerald-900/60 text-emerald-300';
}

function getHeldTickers(): Set<string> {
  const held = new Set<string>();
  try {
    const portfolio = getPortfolio();
    for (const account of Object.values(portfolio.accounts)) {
      for (const ticker of Object.keys(account.holdings ?? {})) {
        if (ticker in MATRIX) held.add(ticker);
      }
    }
  } catch {
    // No holdings data yet (e.g. fresh setup) — fall back to empty set.
  }
  return held;
}

export default function CorrelationPage() {
  const HELD = getHeldTickers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Correlation Matrix</h1>
        <p className="text-sm text-zinc-500 mt-1">Historical pairwise correlations. <span className="text-zinc-400 font-medium">Bold = assets you hold.</span></p>
      </div>

      {/* Heatmap */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-x-auto">
        <table className="text-xs w-full">
          <thead>
            <tr>
              <th className="px-3 py-3 text-left text-zinc-500 font-medium w-32">Asset</th>
              {ASSETS.map(a => (
                <th key={a} className={`px-2 py-3 text-center font-medium ${HELD.has(a) ? 'text-zinc-200' : 'text-zinc-500'}`}>
                  {a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {ASSETS.map(row => (
              <tr key={row} className="hover:bg-zinc-800/20">
                <td className={`px-3 py-2.5 font-medium ${HELD.has(row) ? 'text-zinc-200' : 'text-zinc-500'}`}>
                  {row}
                  {HELD.has(row) && <span className="ml-1 text-emerald-500 text-xs">●</span>}
                </td>
                {ASSETS.map(col => {
                  const val = MATRIX[row][col];
                  return (
                    <td key={col} className={`px-2 py-2.5 text-center font-mono rounded-sm ${getColor(val)}`}>
                      {val.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-red-900/80 inline-block"/><span className="text-zinc-400">High (≥0.80) — moves together</span></div>
        <div className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-orange-900/70 inline-block"/><span className="text-zinc-400">Moderate-high (0.60–0.80)</span></div>
        <div className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-yellow-900/60 inline-block"/><span className="text-zinc-400">Moderate (0.30–0.60)</span></div>
        <div className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-zinc-800 inline-block"/><span className="text-zinc-400">Low (0.10–0.30)</span></div>
        <div className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-emerald-900/60 inline-block"/><span className="text-zinc-400">Negative — hedges</span></div>
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 rounded-xl border border-red-900/40 p-4">
          <h3 className="text-sm font-semibold text-red-400 mb-2">🔴 High Correlation Cluster</h3>
          <p className="text-xs text-zinc-400">IVV · QQQ · GOOG · FTSEAW all move together (0.75–0.90). Adding more of any of these doesn&apos;t diversify — it just adds more of the same bet.</p>
        </div>
        <div className="bg-zinc-900 rounded-xl border border-emerald-900/40 p-4">
          <h3 className="text-sm font-semibold text-emerald-400 mb-2">🟢 True Diversifiers</h3>
          <p className="text-xs text-zinc-400"><strong className="text-zinc-300">TLT</strong> goes negative in equity crashes — your rebalancing ammo. <strong className="text-zinc-300">GLDM</strong> is near-zero with everything — pure independent hedge.</p>
        </div>
        <div className="bg-zinc-900 rounded-xl border border-yellow-900/40 p-4">
          <h3 className="text-sm font-semibold text-yellow-400 mb-2">⚠️ FTSEAW vs VXUS</h3>
          <p className="text-xs text-zinc-400">FTSEAW (All-World, 60% US) correlates 0.90 with S&P500 — barely diversifies. VXUS (ex-US only) is better at 0.85, but still not a true hedge.</p>
        </div>
      </div>
    </div>
  );
}
