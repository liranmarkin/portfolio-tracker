#!/usr/bin/env python3
"""
Portfolio Gains Tracker
-----------------------
Compares two snapshots to separate:
  - Deposits (quantity increases × price)
  - Market gains (price changes on same quantity)
"""

import json, sys, os
from pathlib import Path

def resolve_data_dir(data_dir_arg=None):
    if data_dir_arg:
        return Path(data_dir_arg).resolve()
    return Path(__file__).parent.parent / "data"

USD_ILS = 3.072  # Bank of Israel rate


def to_usd(value, currency="USD", rate=USD_ILS):
    if currency == "ILS":
        return value / rate
    return value


def load_snapshot(date_str, snapshots_dir):
    path = snapshots_dir / f"{date_str}.json"
    if not path.exists():
        print(f"Snapshot not found: {path}")
        sys.exit(1)
    with open(path) as f:
        return json.load(f)


def compare_snapshots(old_date, new_date, data_dir=None):
    data_dir = data_dir or resolve_data_dir()
    snapshots_dir = data_dir / "snapshots"
    old = load_snapshot(old_date, snapshots_dir)
    new = load_snapshot(new_date, snapshots_dir)

    rate = new.get("exchange_rate", {}).get("usd_to_ils", USD_ILS)

    deposits_usd = 0
    market_gain_usd = 0
    rows = []

    for acc_key, new_acc in new["accounts"].items():
        old_acc = old["accounts"].get(acc_key, {})
        for ticker, new_h in new_acc.get("holdings", {}).items():
            old_h = old_acc.get("holdings", {}).get(ticker, {})

            new_qty = new_h.get("quantity", 0)
            old_qty = old_h.get("quantity", 0)
            qty_delta = new_qty - old_qty

            # Price in USD
            currency = new_h.get("currency", "USD")
            if currency == "ILS":
                new_price_usd = new_h.get("current_price_ils", new_h.get("current_price_agorot", 0) / 100) / rate
                old_price_usd = old_h.get("current_price_ils", old_h.get("current_price_agorot", 0) / 100) / rate
            else:
                new_price_usd = new_h.get("current_price", 0)
                old_price_usd = old_h.get("current_price", new_price_usd)

            # Deposit value = new units × current price
            deposit_usd = qty_delta * new_price_usd if qty_delta > 0 else 0

            # Market gain = price change × old quantity (excluding new deposits)
            price_change_usd = (new_price_usd - old_price_usd) * old_qty
            # Also gain on new units from price movement after purchase (if any) = 0 at time of deposit

            deposits_usd += deposit_usd
            market_gain_usd += price_change_usd

            if abs(deposit_usd) > 1 or abs(price_change_usd) > 1:
                rows.append({
                    "account": acc_key,
                    "ticker": ticker,
                    "old_qty": old_qty,
                    "new_qty": new_qty,
                    "qty_delta": qty_delta,
                    "old_price_usd": old_price_usd,
                    "new_price_usd": new_price_usd,
                    "deposit_usd": deposit_usd,
                    "market_gain_usd": price_change_usd,
                })

    old_total = old.get("total_value_usd", 0)
    new_total = new.get("total_value_usd", 0)
    total_change = new_total - old_total

    print(f"\n📊 Portfolio: {old_date} → {new_date}")
    print(f"{'─'*55}")
    print(f"  Starting value:  ${old_total:>12,.2f}")
    print(f"  Ending value:    ${new_total:>12,.2f}")
    print(f"  Total change:    ${total_change:>+12,.2f}")
    print(f"{'─'*55}")
    print(f"  💰 Deposits:     ${deposits_usd:>+12,.2f}")
    print(f"  📈 Market gains: ${market_gain_usd:>+12,.2f}")
    print(f"{'─'*55}")

    if deposits_usd > 0:
        roi = market_gain_usd / (old_total + deposits_usd) * 100
        print(f"  ROI (excl. deposits): {roi:+.2f}%")

    print(f"\nBreakdown by position:")
    print(f"  {'Account':<16} {'Ticker':<22} {'Deposit':>12} {'Mkt Gain':>12}")
    print(f"  {'─'*16} {'─'*22} {'─'*12} {'─'*12}")
    for r in sorted(rows, key=lambda x: abs(x["market_gain_usd"]), reverse=True):
        dep_str = f"${r['deposit_usd']:+,.0f}" if r['deposit_usd'] else "—"
        gain_str = f"${r['market_gain_usd']:+,.0f}" if abs(r['market_gain_usd']) > 0.5 else "—"
        print(f"  {r['account']:<16} {r['ticker']:<22} {dep_str:>12} {gain_str:>12}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Separate deposits vs market gains between two snapshots")
    parser.add_argument("date1", nargs="?", default="2026-02-06", help="Start date (YYYY-MM-DD)")
    parser.add_argument("date2", nargs="?", default="2026-03-05", help="End date (YYYY-MM-DD)")
    parser.add_argument("--data-dir", help="Path to data directory")
    args = parser.parse_args()
    compare_snapshots(args.date1, args.date2, resolve_data_dir(args.data_dir))
