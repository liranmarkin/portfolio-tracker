#!/usr/bin/env python3
"""
historical_value.py — Calculate portfolio value at any past date using real prices

Usage:
    python3 scripts/historical_value.py 2025-10-31           # value on that date
    python3 scripts/historical_value.py 2025-10-31 2026-03-01  # compare two dates

How it works:
    - Reads your current holdings.json for quantities/structure
    - Fetches real historical prices for that date:
        Stocks/ETFs → yfinance historical OHLCV data
        Crypto      → CoinGecko historical price endpoint
        ILS funds   → uses current value (no historical API available)
        USD/ILS rate → uses closest available rate

Limitations:
    - Quantities are taken from the CURRENT holdings.json, not what they were
      on the historical date. For a true historical snapshot, use snapshots instead:
          python3 scripts/view_snapshots.py 2025-10-31 2026-03-01
    - ILS mutual funds: no public historical API, current value is used as proxy
"""

import sys
import json
import argparse
from datetime import datetime, timedelta
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

def resolve_data_dir(data_dir_arg):
    if data_dir_arg:
        return Path(data_dir_arg).resolve()
    return Path(__file__).parent.parent / "data"

COINGECKO_IDS = {
    "BTC": "bitcoin",
    "ETH": "ethereum",
    "SOL": "solana",
    "USDC": "usd-coin",
    "USDT": "tether",
    "BNB": "binancecoin",
}


def fetch_stock_historical(ticker: str, date_str: str) -> float | None:
    """
    Fetch the closing price of a stock/ETF on a specific date.
    date_str: "YYYY-MM-DD"
    Tries up to 5 days back (handles weekends/holidays).
    """
    target = datetime.strptime(date_str, "%Y-%m-%d")
    end = target + timedelta(days=1)
    start = target - timedelta(days=5)

    try:
        hist = yf.download(
            ticker,
            start=start.strftime("%Y-%m-%d"),
            end=end.strftime("%Y-%m-%d"),
            progress=False,
            auto_adjust=True,
        )
        if hist.empty:
            return None
        # Get the row closest to target date
        close = hist["Close"].iloc[-1]
        return float(close.iloc[0] if hasattr(close, "iloc") else close)
    except Exception as e:
        print(f"  ⚠️  {ticker} historical: {e}")
        return None


def fetch_crypto_historical(symbol: str, date_str: str) -> float | None:
    """
    Fetch crypto price on a specific date via CoinGecko history endpoint.
    date_str: "YYYY-MM-DD"
    """
    coin_id = COINGECKO_IDS.get(symbol)
    if not coin_id:
        return None
    cg_date = datetime.strptime(date_str, "%Y-%m-%d").strftime("%d-%m-%Y")
    try:
        resp = requests.get(
            f"https://api.coingecko.com/api/v3/coins/{coin_id}/history?date={cg_date}",
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["market_data"]["current_price"]["usd"]
    except Exception as e:
        print(f"  ⚠️  CoinGecko {symbol} historical: {e}")
        return None


def calculate_value_at_date(date_str: str, data_dir: Path = None) -> float:
    """Calculate total portfolio value using historical prices for the given date."""
    holdings_file = (data_dir or Path(__file__).parent.parent / "data") / "holdings.json"
    with open(holdings_file) as f:
        portfolio = json.load(f)

    current_rate = portfolio.get("exchange_rate", {}).get("usd_to_ils", 3.7)

    print(f"\n{'─'*65}")
    print(f"  Portfolio Value on {date_str}  (current quantities)")
    print(f"{'─'*65}")

    grand_total = 0.0

    for acc_key, account in portfolio["accounts"].items():
        print(f"\n  [{account.get('name', acc_key)}]")

        for ticker, holding in account.get("holdings", {}).items():
            qty = holding.get("quantity", 0)
            currency = holding.get("currency", "USD")

            if acc_key == "Crypto":
                price = fetch_crypto_historical(ticker, date_str)
                if price:
                    value = qty * price
                    grand_total += value
                    print(f"    {ticker:<14} ${price:>12,.2f} × {qty:.6f}  = ${value:>12,.2f}")
                else:
                    print(f"    {ticker:<14} ❌ no historical price")

            elif currency == "ILS":
                # No historical API for Israeli mutual funds
                ils_value = holding.get("value", 0)
                usd_value = ils_value / current_rate
                grand_total += usd_value
                print(f"    {ticker:<14} ₪{ils_value:>12,.2f} (current — no historical API)  = ${usd_value:>12,.2f}")

            else:
                price = fetch_stock_historical(ticker, date_str)
                if price:
                    value = qty * price
                    grand_total += value
                    print(f"    {ticker:<14} ${price:>12,.2f} × {qty}  = ${value:>12,.2f}")
                else:
                    print(f"    {ticker:<14} ❌ no historical price")

    print(f"\n{'═'*65}")
    print(f"  TOTAL on {date_str}:   ${grand_total:>14,.2f}  /  ₪{grand_total * current_rate:>14,.2f}")
    print(f"{'═'*65}")
    print(f"  ⚠️  Note: uses CURRENT quantities. For true history, use view_snapshots.py")
    print()

    return grand_total


def compare_dates(date1: str, date2: str, data_dir: Path = None):
    """Show portfolio value change between two historical dates."""
    print(f"\nComparing {date1} → {date2} using historical prices...\n")
    v1 = calculate_value_at_date(date1, data_dir)
    v2 = calculate_value_at_date(date2, data_dir)
    change = v2 - v1
    pct = change / v1 * 100 if v1 > 0 else 0
    print(f"{'═'*65}")
    print(f"  {date1}:   ${v1:>14,.2f}")
    print(f"  {date2}:   ${v2:>14,.2f}")
    print(f"  Change:      ${change:>+14,.2f}  ({pct:+.2f}%)")
    print(f"{'═'*65}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Portfolio value at a historical date using real prices",
        epilog="Examples:\n  python3 scripts/historical_value.py 2025-10-31\n  python3 scripts/historical_value.py 2025-10-31 2026-03-01",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("date1", help="Date in YYYY-MM-DD format")
    parser.add_argument("date2", nargs="?", help="Second date to compare (optional)")
    parser.add_argument("--data-dir", help="Path to data directory")
    args = parser.parse_args()

    data_dir = resolve_data_dir(args.data_dir)
    if args.date2:
        compare_dates(args.date1, args.date2, data_dir)
    else:
        calculate_value_at_date(args.date1, data_dir)
