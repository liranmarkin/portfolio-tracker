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

export interface Transaction {
  date: string;
  type: 'buy' | 'sell' | 'deposit' | 'withdrawal';
  account: string;
  ticker: string | null;
  quantity: number | null;
  price_usd: number | null;
  amount_usd: number | null;
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
