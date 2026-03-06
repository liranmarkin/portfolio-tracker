import fs from 'fs';
import path from 'path';
import { PortfolioData, DepositsData, SnapshotEntry, TransactionsData } from './types';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), '..', 'data');

export function getPortfolio(): PortfolioData {
  const raw = fs.readFileSync(path.join(DATA_DIR, 'holdings.json'), 'utf-8');
  return JSON.parse(raw);
}

export function getDeposits(): DepositsData {
  const filePath = path.join(DATA_DIR, 'deposits.json');
  if (!fs.existsSync(filePath)) {
    return { deposits: [], withdrawals: [], summary: { total_deposited_usd: 0, total_withdrawn_usd: 0 }, tracking_started: '', last_updated: '' };
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

export interface AppConfig {
  /** "USD" | "ILS" | "blended" */
  base_currency: 'USD' | 'ILS' | 'blended';
  blended: Record<string, number>;
}

export function getConfig(): AppConfig {
  const filePath = path.join(DATA_DIR, 'config.json');
  if (!fs.existsSync(filePath)) {
    return { base_currency: 'USD', blended: { USD: 1.0 } };
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function getTargets(): { allocations: Record<string, number>; tickers: Record<string, string> } {
  const filePath = path.join(DATA_DIR, 'targets.json');
  if (!fs.existsSync(filePath)) {
    return { allocations: {}, tickers: {} };
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function getTransactions(): TransactionsData {
  const filePath = path.join(DATA_DIR, 'transactions.json');
  if (!fs.existsSync(filePath)) {
    return { transactions: [] };
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

export function getSnapshots(): SnapshotEntry[] {
  const snapshotsDir = path.join(DATA_DIR, 'snapshots');
  if (!fs.existsSync(snapshotsDir)) return [];
  const files = fs.readdirSync(snapshotsDir)
    .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.json$/))  // only dated snapshots, skip example.json
    .sort();

  return files.map(f => {
    const raw = fs.readFileSync(path.join(snapshotsDir, f), 'utf-8');
    const data = JSON.parse(raw);
    const date = f.replace('.json', '');
    return { date, ...data };
  });
}
