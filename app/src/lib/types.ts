export interface Holding {
  quantity?: number;
  current_price?: number;
  current_price_agorot?: number;
  current_price_ils?: number;
  value: number;
  currency?: string;
  name?: string;
  type?: string;
  fund_id?: string;
  note?: string;
  avg_cost?: number;
  cost_basis?: number;
  unrealized_pnl?: number;
  unrealized_pct?: number;
  pending_sell?: boolean;
  annual_cost_pct?: number;
  breakdown?: Record<string, number>;
  last_priced?: string;
  manual_price?: boolean;
  proxy_synthesized?: boolean;
  proxy?: {
    ticker?: string;
    baseline_price_usd?: number;
    baseline_fx_usd_ils?: number;
    baseline_value_ils?: number;
    baseline_date?: string;
    rationale?: string;
  };
  growth_apr?: number;
}

export interface Account {
  name: string;
  type: string;
  account_id?: string;
  holdings: Record<string, Holding>;
  total_value: number;
  total_value_usd?: number;
  total_value_ils?: number;
  percentage: number;
  currency?: string;
  note?: string;
}

export interface ExchangeRate {
  usd_to_ils: number;
  ils_to_usd: number;
  note?: string;
  source?: string;
}

export interface PortfolioData {
  last_updated: string;
  accounts: Record<string, Account>;
  total_value_usd: number;
  total_value_ils: number;
  exchange_rate: ExchangeRate;
}

export interface Deposit {
  date: string;
  account: string;
  ticker: string;
  currency: string;
  qty_before: number;
  qty_after: number;
  qty_delta: number;
  value_ils_before?: number;
  value_ils_after?: number;
  amount_ils?: number;
  amount_usd: number;
  price_usd?: number;
  usd_ils_rate?: number;
  detected_from: string;
}

export interface DepositsData {
  deposits: Deposit[];
  withdrawals: Deposit[];
  summary: {
    total_deposited_usd: number;
    total_withdrawn_usd: number;
  };
  tracking_started: string;
  last_updated: string;
}

export type TransactionType = 'buy' | 'sell' | 'deposit' | 'withdrawal' | 'swap' | 'income';

export interface Transaction {
  date: string;
  type: TransactionType;
  account: string;
  ticker: string | null;
  quantity: number | null;
  price_usd: number | null;
  amount_usd: number | null;
  /** Swap-only fields: an in-kind exchange (disposal of `from_ticker`, acquisition of `to_ticker`). */
  from_ticker?: string | null;
  to_ticker?: string | null;
  from_quantity?: number | null;
  to_quantity?: number | null;
  from_amount_usd?: number | null;
  to_amount_usd?: number | null;
  /** Internal transfer between own accounts — excluded from capital-flow summary stats. */
  internal?: boolean;
  /**
   * Swap-only: carry the FIFO cost basis of the disposed asset into the
   * acquired asset instead of realizing P&L (e.g. a tax-deferred in-kind
   * exchange). The gain surfaces only when the acquired asset is disposed.
   */
  basis_carryover?: boolean;
  note?: string;
}

export interface TransactionsData {
  transactions: Transaction[];
}

export interface SnapshotEntry {
  date: string;
  total_value_usd: number;
  total_value_ils: number;
  exchange_rate: ExchangeRate;
  accounts: Record<string, Account>;
}
