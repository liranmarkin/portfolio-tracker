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
    "XAUT": "tether-gold",
    "PAXG": "pax-gold",
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
            # Manual ILS holdings can declare a proxy_ticker for synthetic pricing
            proxy = holding.get("proxy", {})
            if proxy.get("ticker"):
                stock_tickers.add(proxy["ticker"])

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
    now_iso = datetime.now().astimezone().isoformat()
    refreshed = []
    failed = []
    manual_holdings = []

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
                    holding["last_priced"] = now_iso
                    holding.pop("manual_price", None)
                    refreshed.append((acc_key, ticker))
                else:
                    failed.append((acc_key, ticker, "crypto symbol not in COINGECKO_IDS map"))
                value = holding.get("value", 0)
                acc_total += value
                print(f"    {ticker:<14} ${holding.get('current_price', 0):,.2f} × {holding['quantity']:.6f} = ${value:,.2f}")

            elif ticker in ("USD_CASH", "ILS_CASH"):
                # Cash residuals — value tracks quantity 1:1, no live price needed
                holding["current_price"] = 1
                holding["value"] = holding.get("quantity", 0)
                holding["last_priced"] = now_iso
                holding.pop("manual_price", None)
                value = holding["value"]
                # ILS cash value is in shekels, convert for portfolio total
                if currency == "ILS":
                    acc_total += value / usd_to_ils
                    print(f"    {ticker:<14} ₪{value:,.2f} = ${value/usd_to_ils:,.2f}  (cash)")
                else:
                    acc_total += value
                    print(f"    {ticker:<14} ${1:,.2f} × {holding.get('quantity', 0)} = ${value:,.2f}")

            elif currency == "ILS":
                proxy = holding.get("proxy", {})
                proxy_ticker = proxy.get("ticker")
                proxy_price = stock_prices.get(proxy_ticker) if proxy_ticker else None
                proxy_apr = holding.get("growth_apr")  # e.g. 0.045 for 4.5% APR (money market funds)

                if proxy_ticker and proxy_price and proxy.get("baseline_price_usd") and proxy.get("baseline_fx_usd_ils") and proxy.get("baseline_value_ils"):
                    # Synthesize current value from proxy ticker
                    baseline_usd = proxy["baseline_value_ils"] / proxy["baseline_fx_usd_ils"]
                    proxy_return = proxy_price / proxy["baseline_price_usd"]
                    new_usd = baseline_usd * proxy_return
                    new_ils = new_usd * usd_to_ils
                    holding["value"] = new_ils
                    if holding.get("quantity"):
                        new_unit_ils = new_ils / holding["quantity"]
                        holding["current_price_ils"] = new_unit_ils
                        holding["current_price_agorot"] = round(new_unit_ils * 100, 4)
                    holding["last_priced"] = now_iso
                    holding["proxy_synthesized"] = True
                    holding.pop("manual_price", None)
                    acc_total += new_usd
                    print(f"    {ticker:<14} ₪{new_ils:,.2f} = ${new_usd:,.2f}  ↺ via {proxy_ticker}@${proxy_price:.2f} (return {(proxy_return-1)*100:+.2f}%)")
                elif proxy_apr is not None and holding.get("growth_baseline_value_ils") and holding.get("growth_baseline_date"):
                    # Compound at fixed APR (e.g. Israeli money market funds tracking BoI rate)
                    baseline_date = datetime.fromisoformat(holding["growth_baseline_date"]).astimezone()
                    days = (datetime.now().astimezone() - baseline_date).days
                    new_ils = holding["growth_baseline_value_ils"] * ((1 + proxy_apr) ** (days / 365.0))
                    usd_value = new_ils / usd_to_ils
                    holding["value"] = new_ils
                    if holding.get("quantity"):
                        new_unit_ils = new_ils / holding["quantity"]
                        holding["current_price_ils"] = new_unit_ils
                        holding["current_price_agorot"] = round(new_unit_ils * 100, 4)
                    holding["last_priced"] = now_iso
                    holding["proxy_synthesized"] = True
                    holding.pop("manual_price", None)
                    acc_total += usd_value
                    print(f"    {ticker:<14} ₪{new_ils:,.2f} = ${usd_value:,.2f}  ↺ @{proxy_apr*100:.2f}% APR over {days}d")
                else:
                    ils_value = holding.get("value", 0)
                    usd_value = ils_value / usd_to_ils
                    acc_total += usd_value
                    holding["manual_price"] = True
                    holding.pop("proxy_synthesized", None)
                    manual_holdings.append((acc_key, ticker, holding.get("last_priced")))
                    print(f"    {ticker:<14} ₪{ils_value:,.2f} = ${usd_value:,.2f}  ← manual")

            else:
                price = stock_prices.get(ticker)
                if price is not None:
                    holding["current_price"] = price
                    holding["value"] = holding["quantity"] * price
                    holding["last_priced"] = now_iso
                    holding.pop("manual_price", None)
                    refreshed.append((acc_key, ticker))
                else:
                    if "current_price" in holding:
                        holding["value"] = holding["quantity"] * holding["current_price"]
                    failed.append((acc_key, ticker, "yfinance fetch failed"))
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

    # ── Staleness report ────────────────────────────────────────────────
    now_dt = datetime.now().astimezone()
    aging = []   # 14-45 days
    stale = []   # >45 days or no timestamp
    for acc_key, ticker, last_priced in manual_holdings:
        if not last_priced:
            stale.append((acc_key, ticker, "no timestamp"))
            continue
        try:
            then = datetime.fromisoformat(last_priced)
            days = (now_dt - then).days
        except Exception:
            stale.append((acc_key, ticker, "bad timestamp"))
            continue
        if days > 45:
            stale.append((acc_key, ticker, f"{days}d old"))
        elif days > 14:
            aging.append((acc_key, ticker, f"{days}d old"))

    if failed or stale or aging:
        print(f"{'!'*60}")
        print(f"  ⚠️  PRICE STALENESS REPORT")
        print(f"{'!'*60}")
        if failed:
            print(f"\n  ❌ FAILED to refresh ({len(failed)}):")
            for acc, t, reason in failed:
                print(f"     {acc:<16} {t:<14} {reason}")
        if stale:
            print(f"\n  🔴 STALE manual prices (>45d, refresh now) ({len(stale)}):")
            for acc, t, reason in stale:
                print(f"     {acc:<16} {t:<14} {reason}")
        if aging:
            print(f"\n  🟠 AGING manual prices (14-45d) ({len(aging)}):")
            for acc, t, reason in aging:
                print(f"     {acc:<16} {t:<14} {reason}")
        print(f"\n  → Manual ILS funds (IBI, Harel) need to be set directly in holdings.json.")
        print(f"  → Update both the `value` (or `current_price_agorot`) AND `last_priced` fields.")
        print(f"{'!'*60}\n")

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
