import { Transaction } from './types';

/**
 * FIFO realized-P&L engine.
 *
 * Processes transactions chronologically and maintains a FIFO lot queue per
 * (account, ticker). Queues are strictly per-account: selling AAPL in one
 * account never consumes lots bought in another.
 *
 * Lot-creating events:
 *   - `buy`                      — cost = amount_usd (falls back to qty × price_usd)
 *   - `income`                   — asset received as income (staking rewards, LP fees,
 *                                  dividends in kind); basis = market value at receipt
 *   - `deposit` with a ticker    — asset transferred in as new capital; basis = stated value
 *   - `swap` to-side             — acquired asset gets a fresh lot at to_amount_usd
 *
 * Lot-consuming events:
 *   - `sell`                     — realizes P&L = proceeds − matched FIFO cost
 *   - `swap` from-side           — in-kind disposal; realizes P&L vs from_amount_usd
 *   - `withdrawal` with a ticker — asset transferred out; lots leave with it, no P&L
 *
 * If a sell exceeds recorded lots (incomplete history), P&L covers only the
 * matched portion — proceeds are prorated and `partial` is set so the UI can
 * flag it. A sell with no recorded lots at all yields `null` (unknown basis).
 *
 * Wrapped/staked variants of an asset are treated as the SAME asset: buying
 * WBTC and selling BTC hits one FIFO queue, and a swap between two variants
 * of the same canonical asset (e.g. WBTC → BTC, stETH → wstETH) is a
 * non-event — no P&L realized, no basis reset. Override or extend the
 * defaults via `config.json` → `ticker_aliases: { "ALIAS": "CANONICAL" }`.
 */

/** Common wrapped/liquid-staked variants mapped to their canonical asset. */
export const DEFAULT_TICKER_ALIASES: Record<string, string> = {
  WBTC: 'BTC', CBBTC: 'BTC', KBTC: 'BTC', EBTC: 'BTC', TBTC: 'BTC', RENBTC: 'BTC',
  WETH: 'ETH', STETH: 'ETH', WSTETH: 'ETH', WEETH: 'ETH', EETH: 'ETH',
  RETH: 'ETH', CBETH: 'ETH', LIQUIDETH: 'ETH',
  WSOL: 'SOL', MSOL: 'SOL', JITOSOL: 'SOL',
};

export interface RealizedPnl {
  pnl_usd: number;
  cost_usd: number;
  proceeds_usd: number;
  /** pnl / cost, as a fraction (0.25 = +25%) */
  pct: number | null;
  matched_qty: number;
  unmatched_qty: number;
  /** True when part of the sold quantity had no recorded buy lots. */
  partial: boolean;
}

interface Lot {
  qty: number;
  unitCost: number;
}

const EPS = 1e-9;

function lotKey(account: string, ticker: string): string {
  return `${account} ${ticker}`;
}

function makeCanonical(aliases?: Record<string, string>): (ticker: string) => string {
  const map = { ...DEFAULT_TICKER_ALIASES, ...aliases };
  return (ticker: string) => {
    const upper = ticker.toUpperCase();
    return map[upper] ?? upper;
  };
}

/**
 * True for swaps between variants of the same canonical asset (WBTC → BTC,
 * stETH → wstETH): pure repackaging with no economic effect. The UI hides
 * these rows; the engine ignores them.
 */
export function isSameAssetSwap(tx: Transaction, aliases?: Record<string, string>): boolean {
  if (tx.type !== 'swap' || !tx.from_ticker || !tx.to_ticker) return false;
  const canonical = makeCanonical(aliases);
  return canonical(tx.from_ticker) === canonical(tx.to_ticker);
}

function pushLot(queues: Map<string, Lot[]>, account: string, ticker: string, qty: number, totalCost: number) {
  if (qty <= EPS) return;
  const key = lotKey(account, ticker);
  const queue = queues.get(key) ?? [];
  queue.push({ qty, unitCost: totalCost / qty });
  queues.set(key, queue);
}

/** Consume up to `qty` from the FIFO queue; returns matched qty and its cost. */
function consumeLots(queues: Map<string, Lot[]>, account: string, ticker: string, qty: number): { matched: number; cost: number } {
  const queue = queues.get(lotKey(account, ticker));
  let remaining = qty;
  let cost = 0;
  let matched = 0;
  while (queue && queue.length > 0 && remaining > EPS) {
    const lot = queue[0];
    const take = Math.min(lot.qty, remaining);
    cost += take * lot.unitCost;
    matched += take;
    remaining -= take;
    lot.qty -= take;
    if (lot.qty <= EPS) queue.shift();
  }
  return { matched, cost };
}

function disposal(queues: Map<string, Lot[]>, account: string, ticker: string, qty: number, proceeds: number): RealizedPnl | null {
  const { matched, cost } = consumeLots(queues, account, ticker, qty);
  if (matched <= EPS) return null; // no recorded basis at all
  const unmatched = qty - matched;
  // Prorate proceeds over the matched portion so partial-basis P&L stays honest.
  const matchedProceeds = unmatched > EPS ? proceeds * (matched / qty) : proceeds;
  const pnl = matchedProceeds - cost;
  return {
    pnl_usd: pnl,
    cost_usd: cost,
    proceeds_usd: matchedProceeds,
    pct: cost > EPS ? pnl / cost : null,
    matched_qty: matched,
    unmatched_qty: unmatched > EPS ? unmatched : 0,
    partial: unmatched > EPS,
  };
}

/**
 * Compute realized P&L for every disposal (sell / swap) in `transactions`.
 * Returns an array aligned with the input order: entry i is the P&L of
 * transactions[i], or null for rows that don't realize P&L (buys, deposits,
 * cash movements, same-asset wrapper swaps, disposals with no recorded basis).
 */
export function computeRealizedPnl(
  transactions: Transaction[],
  tickerAliases?: Record<string, string>,
): (RealizedPnl | null)[] {
  const results: (RealizedPnl | null)[] = new Array(transactions.length).fill(null);
  const canonical = makeCanonical(tickerAliases);
  // Chronological processing; stable sort keeps same-date rows in input order.
  const order = transactions
    .map((tx, i) => ({ tx, i }))
    .sort((a, b) => a.tx.date.localeCompare(b.tx.date) || a.i - b.i);

  const queues = new Map<string, Lot[]>();

  for (const { tx, i } of order) {
    const qty = tx.quantity ?? 0;
    const amount = tx.amount_usd ?? (tx.quantity != null && tx.price_usd != null ? tx.quantity * tx.price_usd : null);
    const ticker = tx.ticker ? canonical(tx.ticker) : null;

    switch (tx.type) {
      case 'buy':
      case 'income':
        if (ticker && qty > EPS && amount != null) {
          pushLot(queues, tx.account, ticker, qty, amount);
        }
        break;

      case 'deposit':
        // Asset deposit (in-kind capital) creates lots; cash deposits don't.
        if (ticker && qty > EPS && amount != null) {
          pushLot(queues, tx.account, ticker, qty, amount);
        }
        break;

      case 'sell':
        if (ticker && qty > EPS && amount != null) {
          results[i] = disposal(queues, tx.account, ticker, qty, amount);
        }
        break;

      case 'withdrawal':
        // In-kind withdrawal removes lots without realizing P&L; cash is ignored.
        if (ticker && qty > EPS) {
          consumeLots(queues, tx.account, ticker, qty);
        }
        break;

      case 'swap': {
        const from = tx.from_ticker ? canonical(tx.from_ticker) : null;
        const to = tx.to_ticker ? canonical(tx.to_ticker) : null;
        // Same canonical asset on both sides (WBTC → BTC, stETH → wstETH):
        // a wrapper exchange, not a disposal. Lots stay untouched.
        if (from && to && from === to) break;
        const fromQty = tx.from_quantity ?? 0;
        const fromAmount = tx.from_amount_usd ?? null;
        const toQty = tx.to_quantity ?? 0;
        const toAmount = tx.to_amount_usd ?? fromAmount;
        if (tx.basis_carryover) {
          // Deferred exchange: no P&L now — the old lots' cost migrates into
          // the acquired asset, so the gain realizes when THAT is disposed.
          let carriedCost: number | null = null;
          if (from && fromQty > EPS) {
            const { matched, cost } = consumeLots(queues, tx.account, from, fromQty);
            if (matched > EPS) carriedCost = cost;
          }
          if (to && toQty > EPS) {
            const basis = carriedCost ?? toAmount;
            if (basis != null) pushLot(queues, tx.account, to, toQty, basis);
          }
          break;
        }
        if (from && fromQty > EPS && fromAmount != null) {
          results[i] = disposal(queues, tx.account, from, fromQty, fromAmount);
        }
        if (to && toQty > EPS && toAmount != null) {
          pushLot(queues, tx.account, to, toQty, toAmount);
        }
        break;
      }
    }
  }

  return results;
}
