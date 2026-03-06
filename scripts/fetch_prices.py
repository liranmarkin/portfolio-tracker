#!/usr/bin/env python3
"""
fetch_prices.py — Look up current prices for any ticker or crypto symbol

Usage:
    python3 scripts/fetch_prices.py AAPL GOOG IVV         # US stocks/ETFs
    python3 scripts/fetch_prices.py TEVA.TA NICE.TA        # Israeli TASE stocks (.TA suffix)
    python3 scripts/fetch_prices.py BTC ETH SOL            # Crypto (CoinGecko)
    python3 scripts/fetch_prices.py IBIT IVV BTC ETH       # Mix of anything

This is a standalone lookup tool — does NOT modify holdings.json.
Useful for:
  - Checking a price before manually updating holdings.json
  - Verifying a ticker symbol works before adding it to your portfolio
  - Quick spot-checks

Supported:
    US stocks/ETFs   → yfinance (Yahoo Finance)
    Israeli stocks   → yfinance with .TA suffix (e.g. TEVA.TA)
    Crypto           → CoinGecko (BTC, ETH, SOL, USDC, USDT, BNB)
                       For other crypto: add to COINGECKO_IDS below

To add a crypto not in the list:
    1. Find its CoinGecko ID at https://coingecko.com (it's in the URL)
    2. Add to COINGECKO_IDS: "SYMBOL": "coingecko-id"
"""

import sys
import argparse
import requests

try:
    import yfinance as yf
except ImportError:
    print("❌ yfinance not installed. Run: pip install yfinance")
    sys.exit(1)

# ── Add more crypto here as needed ──────────────────────────────────────────
COINGECKO_IDS = {
    "BTC": "bitcoin",
    "ETH": "ethereum",
    "SOL": "solana",
    "USDC": "usd-coin",
    "USDT": "tether",
    "BNB": "binancecoin",
    "XRP": "ripple",
    "DOGE": "dogecoin",
    "ADA": "cardano",
    "AVAX": "avalanche-2",
}
# ────────────────────────────────────────────────────────────────────────────


def fetch_stock(ticker: str) -> float | None:
    try:
        info = yf.Ticker(ticker).fast_info
        price = info.get("lastPrice") or info.get("regularMarketPreviousClose")
        return float(price) if price and price > 0 else None
    except Exception as e:
        return None


def fetch_crypto_batch(symbols: list[str]) -> dict[str, float]:
    ids_map = {s: COINGECKO_IDS[s] for s in symbols if s in COINGECKO_IDS}
    if not ids_map:
        return {}
    ids_str = ",".join(ids_map.values())
    try:
        resp = requests.get(
            f"https://api.coingecko.com/api/v3/simple/price?ids={ids_str}&vs_currencies=usd",
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return {sym: data[cg_id]["usd"] for sym, cg_id in ids_map.items() if cg_id in data}
    except Exception as e:
        print(f"  ⚠️  CoinGecko error: {e}")
        return {}


def main():
    parser = argparse.ArgumentParser(
        description="Look up current prices for any ticker or crypto symbol",
        epilog="Examples:\n  python3 scripts/fetch_prices.py AAPL BTC ETH\n  python3 scripts/fetch_prices.py TEVA.TA IVV SOL",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("symbols", nargs="+", help="Tickers or crypto symbols to look up")
    args = parser.parse_args()

    symbols = [s.upper() for s in args.symbols]

    crypto_syms = [s for s in symbols if s in COINGECKO_IDS]
    stock_syms = [s for s in symbols if s not in COINGECKO_IDS]
    unknown_crypto = [s for s in symbols if s not in COINGECKO_IDS and s not in stock_syms]

    print()

    # Stocks
    if stock_syms:
        print("Stocks / ETFs (via Yahoo Finance):")
        for ticker in stock_syms:
            price = fetch_stock(ticker)
            if price is not None:
                print(f"  {ticker:<14} ${price:,.2f}")
            else:
                print(f"  {ticker:<14} ❌ not found — check the ticker symbol")
        print()

    # Crypto (single batch)
    if crypto_syms:
        print("Crypto (via CoinGecko):")
        prices = fetch_crypto_batch(crypto_syms)
        for sym in crypto_syms:
            price = prices.get(sym)
            if price is not None:
                print(f"  {sym:<14} ${price:,.2f}")
            else:
                print(f"  {sym:<14} ❌ fetch failed")
        print()

    # Unknown symbols not in crypto map — try as stocks anyway
    if unknown_crypto:
        print(f"Note: {', '.join(unknown_crypto)} not in crypto list — tried as stock ticker above.")
        print("If it's a crypto, add it to COINGECKO_IDS in this script.")
        print()


if __name__ == "__main__":
    main()
