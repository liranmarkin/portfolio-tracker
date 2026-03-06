#!/usr/bin/env python3
"""
update_portfolio.py — Fetch live prices and update holdings.json

Usage:
    python3 scripts/update_portfolio.py                          # default: data/ next to scripts/
    python3 scripts/update_portfolio.py --data-dir /path/to/data # custom data directory
    python3 scripts/update_portfolio.py --dry-run                # preview without saving

Price sources:
    Stocks / ETFs  → yfinance (Yahoo Finance, free, no key)
    Crypto         → CoinGecko public API (free, no key)
    USD/ILS rate   → exchangerate-api.com (free, no key)
    ILS funds      → MANUAL — edit holdings.json directly (see NOTE below)

NOTE: Israeli mutual funds (e.g. IBI, Harel) are not listed on Yahoo Finance.
Update their value manually in holdings.json before running this script:
    "MY_FUND": { "value": 52000, "currency": "ILS" }

Supported ticker formats:
    US stocks/ETFs  → "IVV", "GOOG", "IBIT"
    Israeli stocks  → "TEVA.TA", "NICE.TA"  (.TA suffix for TASE)
    Crypto          → "BTC", "ETH", "USDC"  (in the "Crypto" account)
    ILS funds       → any holding with "currency": "ILS"  (manual only)
"""

import json
import sys
import argparse
import shutil
from datetime import datetime
from pathlib import Path

try:
    import yfinance as yf
except ImportError:
    print("❌ yfinance not installed. Run: pip install yfinance")
    sys.exit(1)

try:
    import requests
except ImportError:
    print("❌ requests not installed. Run: pip install requests")
    sys.exit(1)

# ── Add more crypto here as needed ──────────────────────────────────────────
COINGECKO_IDS = {
    "BTC": "bitcoin",
    "ETH": "ethereum",
    "SOL": "solana",
    "USDC": "usd-coin",
    "USDT": "tether",
    "BNB": "binancecoin",
}
# ────────────────────────────────────────────────────────────────────────────


def resolve_data_dir(data_dir_arg: str | None) -> Path:
    if data_dir_arg:
        return Path(data_dir_arg).resolve()
    # Default: data/ sibling to scripts/
    return Path(__file__).parent.parent / "data"


def fetch_stock_price(ticker: str) -> float | None:
    try:
        data = yf.Ticker(ticker).fast_info
        price = data.get("lastPrice") or data.get("regularMarketPreviousClose")
        return float(price) if price and price > 0 else None
    except Exception as e:
        print(f"  ⚠️  {ticker}: yfinance error — {e}")
        return None


def fetch_crypto_prices(symbols: list) -> dict:
    ids_needed = {s: COINGECKO_IDS[s] for s in symbols if s in COINGECKO_IDS}
    if not ids_needed:
        return {}
    ids_str = ",".join(ids_needed.values())
    try:
        resp = requests.get(
            f"https://api.coingecko.com/api/v3/simple/price?ids={ids_str}&vs_currencies=usd",
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return {sym: data[cg_id]["usd"] for sym, cg_id in ids_needed.items() if cg_id in data}
    except Exception as e:
        print(f"  ⚠️  CoinGecko error: {e}")
        return {}


def fetch_usd_ils_rate() -> float:
    try:
        resp = requests.get("https://api.exchangerate-api.com/v4/latest/USD", timeout=10)
        resp.raise_for_status()
        return float(resp.json()["rates"]["ILS"])
    except Exception as e:
        print(f"  ⚠️  Exchange rate fetch failed ({e}), using fallback 3.7")
        return 3.7


def update_portfolio(data_dir: Path, dry_run: bool = False):
    holdings_file = data_dir / "holdings.json"
    web_data = data_dir.parent / "web" / "data.json"

    if not holdings_file.exists():
        print(f"❌ holdings.json not found at {holdings_file}")
        print("   Copy data/holdings.example.json to data/holdings.json and fill in your holdings.")
        sys.exit(1)

    with open(holdings_file) as f:
        portfolio = json.load(f)

    print(f"\n{'─'*60}")
    print(f"  Portfolio Price Update — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"  Data dir: {data_dir}")
    print(f"{'─'*60}\n")

    # Exchange rate
    print("📡 Fetching USD/ILS rate...")
    usd_to_ils = fetch_usd_ils_rate()
    print(f"   USD/ILS = {usd_to_ils:.4f}\n")

    # Collect tickers
    stock_tickers = set()
    crypto_symbols = set()
    for acc_key, account in portfolio["accounts"].items():
        for ticker, holding in account.get("holdings", {}).items():
            if acc_key == "Crypto":
                crypto_symbols.add(ticker)
            elif holding.get("currency", "USD") != "ILS":
                stock_tickers.add(ticker)

    # Fetch stocks
    stock_prices = {}
    if stock_tickers:
        print(f"📡 Fetching stock/ETF prices ({', '.join(sorted(stock_tickers))})...")
        for ticker in sorted(stock_tickers):
            price = fetch_stock_price(ticker)
            if price:
                stock_prices[ticker] = price
                print(f"   {ticker:<12} ${price:,.2f}")
            else:
                print(f"   {ticker:<12} ❌ failed — keeping cached price")
        print()

    # Fetch crypto (single batch)
    crypto_prices = {}
    if crypto_symbols:
        print(f"📡 Fetching crypto prices ({', '.join(sorted(crypto_symbols))})...")
        crypto_prices = fetch_crypto_prices(list(crypto_symbols))
        for sym, price in crypto_prices.items():
            print(f"   {sym:<12} ${price:,.2f}")
        for sym in crypto_symbols - set(crypto_prices):
            print(f"   {sym:<12} ❌ not in COINGECKO_IDS — add it to the map in this script")
        print()

    # Update holdings
    account_totals = {}
    for acc_key, account in portfolio["accounts"].items():
        acc_total = 0.0
        print(f"  [{account.get('name', acc_key)}]")

        for ticker, holding in account.get("holdings", {}).items():
            currency = holding.get("currency", "USD")

            if acc_key == "Crypto":
                price = crypto_prices.get(ticker)
                if price is not None:
                    holding["current_price"] = price
                    holding["value"] = holding["quantity"] * price
                value = holding.get("value", 0)
                acc_total += value
                print(f"    {ticker:<14} ${holding.get('current_price', 0):,.2f} × {holding['quantity']:.6f} = ${value:,.2f}")

            elif currency == "ILS":
                ils_value = holding.get("value", 0)
                usd_value = ils_value / usd_to_ils
                acc_total += usd_value
                print(f"    {ticker:<14} ₪{ils_value:,.2f} = ${usd_value:,.2f}  ← manual")

            else:
                price = stock_prices.get(ticker)
                if price is not None:
                    holding["current_price"] = price
                    holding["value"] = holding["quantity"] * price
                elif "current_price" in holding:
                    holding["value"] = holding["quantity"] * holding["current_price"]
                value = holding.get("value", 0)
                acc_total += value
                print(f"    {ticker:<14} ${holding.get('current_price', 0):,.2f} × {holding.get('quantity', 0)} = ${value:,.2f}")

        account["total_value"] = acc_total
        account_totals[acc_key] = acc_total
        print()

    # Totals
    grand_total_usd = sum(account_totals.values())
    grand_total_ils = grand_total_usd * usd_to_ils

    for acc_key, value in account_totals.items():
        pct = value / grand_total_usd * 100 if grand_total_usd > 0 else 0
        portfolio["accounts"][acc_key]["percentage"] = round(pct, 4)

    portfolio["total_value_usd"] = grand_total_usd
    portfolio["total_value_ils"] = grand_total_ils
    portfolio["exchange_rate"] = {
        "usd_to_ils": usd_to_ils,
        "ils_to_usd": round(1 / usd_to_ils, 6),
        "note": "Live rate from exchangerate-api.com",
    }
    portfolio["last_updated"] = datetime.now().astimezone().isoformat()

    print(f"{'═'*60}")
    print(f"  TOTAL (USD):   ${grand_total_usd:>14,.2f}")
    print(f"  TOTAL (ILS):   ₪{grand_total_ils:>14,.2f}")
    print(f"{'═'*60}")
    for acc_key, acc_value in account_totals.items():
        name = portfolio["accounts"][acc_key].get("name", acc_key)
        pct = portfolio["accounts"][acc_key]["percentage"]
        print(f"  {name:<28} ${acc_value:>12,.2f}  ({pct:.1f}%)")
    print(f"{'═'*60}\n")

    if dry_run:
        print("🔍 Dry run — not saving.")
        return

    with open(holdings_file, "w") as f:
        json.dump(portfolio, f, indent=2)
    print(f"✅ Saved to {holdings_file}")

    if web_data.parent.exists():
        shutil.copy2(holdings_file, web_data)
        print(f"✅ Web data updated at {web_data}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch live prices and update holdings.json")
    parser.add_argument("--data-dir", help="Path to data directory (default: ../data relative to script)")
    parser.add_argument("--dry-run", action="store_true", help="Show prices without saving")
    args = parser.parse_args()
    update_portfolio(resolve_data_dir(args.data_dir), dry_run=args.dry_run)
