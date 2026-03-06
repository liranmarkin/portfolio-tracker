#!/usr/bin/env python3
"""
deposits.py — Track and manage deposits into your portfolio

A "deposit" is new capital you add (not market gains). This script separates
the two so you can measure real investment returns.

Commands:
    detect <date1> <date2>   Auto-detect deposits by comparing two snapshots
                             (quantity increases = new capital added)
    view                     View all logged deposits + summary
    add                      Manually log a deposit (interactive)

Usage:
    python3 scripts/deposits.py detect 2026-02-06 2026-03-05
    python3 scripts/deposits.py view
    python3 scripts/deposits.py add
    python3 scripts/deposits.py --data-dir /path/to/data view

How detection works:
    Compares holdings quantities between two snapshots.
    Quantity increase = deposit (valued at the new snapshot's price).
    Price change on same quantity = market gain (not a deposit).
    Withdrawals (quantity decreases) are also detected and logged.
"""

import json
import argparse
from datetime import datetime
from pathlib import Path


def resolve_data_dir(data_dir_arg=None):
    if data_dir_arg:
        return Path(data_dir_arg).resolve()
    return Path(__file__).parent.parent / "data"


def load_deposits(deposits_file: Path) -> dict:
    if deposits_file.exists():
        with open(deposits_file) as f:
            return json.load(f)
    return {
        "deposits": [],
        "withdrawals": [],
        "summary": {"total_deposited_usd": 0, "total_withdrawn_usd": 0},
        "tracking_started": datetime.now().strftime("%Y-%m-%d"),
        "last_updated": datetime.now().strftime("%Y-%m-%d"),
    }


def save_deposits(data: dict, deposits_file: Path):
    data["last_updated"] = datetime.now().strftime("%Y-%m-%d")
    # Recalculate summary
    data["summary"]["total_deposited_usd"] = sum(d.get("amount_usd", 0) for d in data.get("deposits", []))
    data["summary"]["total_withdrawn_usd"] = sum(w.get("amount_usd", 0) for w in data.get("withdrawals", []))
    with open(deposits_file, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def load_snapshot(snapshots_dir: Path, date_str: str) -> dict:
    path = snapshots_dir / f"{date_str}.json"
    if not path.exists():
        available = sorted(p.stem for p in snapshots_dir.glob("*.json"))
        print(f"❌ Snapshot not found: {date_str}")
        print(f"   Available: {', '.join(available) or 'none'}")
        raise SystemExit(1)
    with open(path) as f:
        return json.load(f)


def detect(data_dir: Path, date1: str, date2: str, save: bool = True):
    """Auto-detect deposits/withdrawals by comparing two snapshots."""
    snapshots_dir = data_dir / "snapshots"
    deposits_file = data_dir / "deposits.json"

    old = load_snapshot(snapshots_dir, date1)
    new = load_snapshot(snapshots_dir, date2)
    rate = new.get("exchange_rate", {}).get("usd_to_ils", 3.7)

    new_deposits = []
    new_withdrawals = []

    print(f"\n🔍 Detecting deposits: {date1} → {date2}\n")

    for acc_key, new_acc in new["accounts"].items():
        old_acc = old["accounts"].get(acc_key, {})

        for ticker, new_h in new_acc.get("holdings", {}).items():
            old_h = old_acc.get("holdings", {}).get(ticker, {})

            new_qty = new_h.get("quantity", 0)
            old_qty = old_h.get("quantity", 0)
            qty_delta = new_qty - old_qty

            if abs(qty_delta) < 0.000001:
                continue  # No change

            currency = new_h.get("currency", "USD")
            if currency == "ILS":
                # ILS fund: use value directly
                new_val_ils = new_h.get("value", 0)
                old_val_ils = old_h.get("value", 0)
                delta_ils = new_val_ils - old_val_ils
                delta_usd = delta_ils / rate
                entry = {
                    "date": date2,
                    "account": acc_key,
                    "ticker": ticker,
                    "currency": "ILS",
                    "qty_before": old_qty,
                    "qty_after": new_qty,
                    "qty_delta": round(qty_delta, 6),
                    "value_ils_before": round(old_val_ils, 2),
                    "value_ils_after": round(new_val_ils, 2),
                    "amount_ils": round(abs(delta_ils), 2),
                    "amount_usd": round(abs(delta_usd), 2),
                    "usd_ils_rate": round(rate, 4),
                    "detected_from": f"{date1} → {date2}",
                }
            else:
                price_usd = new_h.get("current_price", 0)
                amount_usd = abs(qty_delta) * price_usd
                entry = {
                    "date": date2,
                    "account": acc_key,
                    "ticker": ticker,
                    "currency": "USD",
                    "qty_before": old_qty,
                    "qty_after": new_qty,
                    "qty_delta": round(qty_delta, 6),
                    "price_usd": round(price_usd, 4),
                    "amount_usd": round(amount_usd, 2),
                    "detected_from": f"{date1} → {date2}",
                }

            if qty_delta > 0:
                new_deposits.append(entry)
                amt = f"${entry['amount_usd']:,.2f}"
                print(f"  💰 DEPOSIT   {acc_key:<18} {ticker:<20} +{abs(qty_delta):.4f} units  ≈ {amt}")
            else:
                new_withdrawals.append(entry)
                amt = f"${entry['amount_usd']:,.2f}"
                print(f"  🔴 WITHDRAWAL {acc_key:<17} {ticker:<20} -{abs(qty_delta):.4f} units  ≈ {amt}")

    if not new_deposits and not new_withdrawals:
        print("  No quantity changes detected between these snapshots.")
        return

    total_dep = sum(d["amount_usd"] for d in new_deposits)
    total_wit = sum(w["amount_usd"] for w in new_withdrawals)
    print(f"\n{'─'*60}")
    print(f"  💰 New deposits detected:    ${total_dep:>12,.2f}")
    if new_withdrawals:
        print(f"  🔴 Withdrawals detected:     ${total_wit:>12,.2f}")
    print(f"{'─'*60}")

    if not save:
        print("\n🔍 Dry run — not saving to deposits.json")
        return

    deposits_data = load_deposits(deposits_file)

    # Avoid duplicates: check if entries for this date range already exist
    existing_keys = {
        (d["account"], d["ticker"], d["date"])
        for d in deposits_data.get("deposits", []) + deposits_data.get("withdrawals", [])
    }
    added = 0
    for entry in new_deposits:
        k = (entry["account"], entry["ticker"], entry["date"])
        if k not in existing_keys:
            deposits_data.setdefault("deposits", []).append(entry)
            added += 1
    for entry in new_withdrawals:
        k = (entry["account"], entry["ticker"], entry["date"])
        if k not in existing_keys:
            deposits_data.setdefault("withdrawals", []).append(entry)
            added += 1

    if added:
        save_deposits(deposits_data, deposits_file)
        print(f"\n✅ Saved {added} new entries to {deposits_file}")
    else:
        print(f"\n⚠️  All entries already exist in deposits.json — nothing added.")


def view(data_dir: Path):
    """Display all deposits and summary."""
    deposits_file = data_dir / "deposits.json"

    if not deposits_file.exists():
        print("No deposits.json found. Run: deposits.py detect <date1> <date2>")
        return

    with open(deposits_file) as f:
        data = json.load(f)

    deposits = data.get("deposits", [])
    withdrawals = data.get("withdrawals", [])

    print(f"\n{'═'*65}")
    print("  DEPOSITS")
    print(f"{'═'*65}")
    if deposits:
        print(f"  {'Date':<12} {'Account':<18} {'Ticker':<20} {'Amount':>12}")
        print(f"  {'─'*12} {'─'*18} {'─'*20} {'─'*12}")
        for d in sorted(deposits, key=lambda x: x["date"]):
            print(f"  {d['date']:<12} {d['account']:<18} {d['ticker']:<20} ${d['amount_usd']:>10,.2f}")
    else:
        print("  No deposits recorded.")

    if withdrawals:
        print(f"\n{'─'*65}")
        print("  WITHDRAWALS")
        print(f"  {'Date':<12} {'Account':<18} {'Ticker':<20} {'Amount':>12}")
        print(f"  {'─'*12} {'─'*18} {'─'*20} {'─'*12}")
        for w in sorted(withdrawals, key=lambda x: x["date"]):
            print(f"  {w['date']:<12} {w['account']:<18} {w['ticker']:<20} ${w['amount_usd']:>10,.2f}")

    summary = data.get("summary", {})
    total_dep = summary.get("total_deposited_usd", 0)
    total_wit = summary.get("total_withdrawn_usd", 0)
    net = total_dep - total_wit

    print(f"\n{'═'*65}")
    print(f"  💰 Total deposited:   ${total_dep:>12,.2f}")
    if total_wit:
        print(f"  🔴 Total withdrawn:   ${total_wit:>12,.2f}")
        print(f"  📊 Net capital in:    ${net:>12,.2f}")
    print(f"  Tracking since: {data.get('tracking_started', 'unknown')}")
    print(f"  Last updated:   {data.get('last_updated', 'unknown')}")
    print(f"{'═'*65}\n")


def add(data_dir: Path):
    """Manually log a deposit (interactive)."""
    deposits_file = data_dir / "deposits.json"
    deposits_data = load_deposits(deposits_file)

    print("\nManually log a deposit")
    print("─" * 40)
    date = input("Date (YYYY-MM-DD, enter for today): ").strip() or datetime.now().strftime("%Y-%m-%d")
    account = input("Account key (e.g. IBKR): ").strip()
    ticker = input("Ticker (e.g. IVV): ").strip()
    amount_usd = float(input("Amount in USD: ").strip())
    note = input("Note (optional): ").strip()

    entry = {
        "date": date,
        "account": account,
        "ticker": ticker,
        "amount_usd": amount_usd,
        "manual": True,
    }
    if note:
        entry["note"] = note

    deposits_data.setdefault("deposits", []).append(entry)
    save_deposits(deposits_data, deposits_file)
    print(f"\n✅ Deposit logged: ${amount_usd:,.2f} into {account}/{ticker} on {date}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Track and manage portfolio deposits",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python3 scripts/deposits.py detect 2026-02-06 2026-03-05\n"
            "  python3 scripts/deposits.py view\n"
            "  python3 scripts/deposits.py add\n"
            "  python3 scripts/deposits.py detect 2026-02-06 2026-03-05 --dry-run"
        ),
    )
    parser.add_argument("command", choices=["detect", "view", "add"], help="Command to run")
    parser.add_argument("date1", nargs="?", help="Start date for detect (YYYY-MM-DD)")
    parser.add_argument("date2", nargs="?", help="End date for detect (YYYY-MM-DD)")
    parser.add_argument("--data-dir", help="Path to data directory")
    parser.add_argument("--dry-run", action="store_true", help="Detect without saving")
    args = parser.parse_args()

    data_dir = resolve_data_dir(args.data_dir)

    if args.command == "detect":
        if not args.date1 or not args.date2:
            parser.error("detect requires date1 and date2")
        detect(data_dir, args.date1, args.date2, save=not args.dry_run)
    elif args.command == "view":
        view(data_dir)
    elif args.command == "add":
        add(data_dir)
