#!/usr/bin/env python3
"""
view_by_asset.py — Aggregate holdings by ticker across all accounts

Usage:
    python3 scripts/view_by_asset.py
    python3 scripts/view_by_asset.py --data-dir /path/to/data
"""

import json
import argparse
from collections import defaultdict
from pathlib import Path


def resolve_data_dir(data_dir_arg):
    if data_dir_arg:
        return Path(data_dir_arg).resolve()
    return Path(__file__).parent.parent / "data"


def view_by_asset(data_dir: Path):
    holdings_file = data_dir / "holdings.json"
    if not holdings_file.exists():
        print(f"❌ holdings.json not found at {holdings_file}")
        return

    with open(holdings_file) as f:
        portfolio = json.load(f)

    usd_to_ils = portfolio.get("exchange_rate", {}).get("usd_to_ils", 3.7)

    # Aggregate stocks
    assets = defaultdict(lambda: {"quantity": 0, "accounts": [], "current_price": 0})
    ils_total = 0.0
    crypto_total = 0.0

    for acc_key, account in portfolio["accounts"].items():
        for ticker, holding in account.get("holdings", {}).items():
            currency = holding.get("currency", "USD")

            if acc_key == "Crypto":
                continue
            elif currency == "ILS":
                ils_total += holding.get("value", 0) / usd_to_ils
                continue

            assets[ticker]["quantity"] += holding.get("quantity", 0)
            assets[ticker]["current_price"] = holding.get("current_price", 0)
            assets[ticker]["accounts"].append({
                "account": account.get("name", acc_key),
                "quantity": holding.get("quantity", 0),
            })

    print(f"\n{'═'*65}")
    print("STOCKS & ETFs BY TICKER")
    print(f"{'═'*65}")

    stocks_total = 0.0
    for ticker in sorted(assets):
        a = assets[ticker]
        price = a["current_price"]
        qty = a["quantity"]
        value = qty * price
        stocks_total += value
        print(f"\n  {ticker}  —  {qty} shares @ ${price:.2f}  =  ${value:,.2f}")
        for acc in a["accounts"]:
            print(f"    · {acc['account']:<30} {acc['quantity']} shares")

    # Crypto
    print(f"\n{'─'*65}")
    print("CRYPTO")
    crypto_acc = portfolio["accounts"].get("Crypto", {}).get("holdings", {})
    for sym, h in crypto_acc.items():
        value = h.get("value", 0)
        crypto_total += value
        print(f"  {sym:<8} {h['quantity']:.6f}  @ ${h.get('current_price', 0):,.2f}  =  ${value:,.2f}")

    # ILS funds
    print(f"\n{'─'*65}")
    print("ILS FUNDS (manual)")
    for acc_key, account in portfolio["accounts"].items():
        for ticker, holding in account.get("holdings", {}).items():
            if holding.get("currency") == "ILS":
                ils_val = holding.get("value", 0)
                usd_val = ils_val / usd_to_ils
                print(f"  {ticker:<30} ₪{ils_val:,.2f}  =  ${usd_val:,.2f}")

    grand_total = portfolio.get("total_value_usd", stocks_total + crypto_total + ils_total)

    # Category summary via targets.json ticker mapping (XAUT counts as Gold,
    # cash-in-transit as Cash, etc.) — falls back to coarse buckets if absent.
    targets_file = data_dir / "targets.json"
    print(f"\n{'═'*65}")
    if targets_file.exists():
        with open(targets_file) as f:
            targets = json.load(f)
        ticker_cat = targets.get("tickers", {})
        alloc = targets.get("allocations", {})
        by_cat = defaultdict(float)
        for account in portfolio["accounts"].values():
            for ticker, h in account.get("holdings", {}).items():
                val = h.get("value", 0)
                if h.get("currency") == "ILS":
                    val /= usd_to_ils
                cat = ticker_cat.get(ticker) or ("Cash" if "FUND" in ticker else "Other")
                by_cat[cat] += val
        for cat in sorted(by_cat, key=by_cat.get, reverse=True):
            pct = by_cat[cat] / grand_total * 100
            tgt = f"  (target {alloc[cat]*100:.0f}%)" if cat in alloc else ""
            print(f"  {cat:<14} ${by_cat[cat]:>14,.2f}  ({pct:.1f}%){tgt}")
    else:
        print(f"  Stocks/ETFs:   ${stocks_total:>14,.2f}  ({stocks_total/grand_total*100:.1f}%)")
        print(f"  Crypto:        ${crypto_total:>14,.2f}  ({crypto_total/grand_total*100:.1f}%)")
        print(f"  ILS Funds:     ${ils_total:>14,.2f}  ({ils_total/grand_total*100:.1f}%)")
    print(f"{'─'*65}")
    print(f"  TOTAL (USD):   ${grand_total:>14,.2f}")
    print(f"  TOTAL (ILS):   ₪{grand_total * usd_to_ils:>14,.2f}")
    print(f"{'═'*65}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="View holdings aggregated by asset")
    parser.add_argument("--data-dir", help="Path to data directory")
    args = parser.parse_args()
    view_by_asset(resolve_data_dir(args.data_dir))
