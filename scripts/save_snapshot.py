#!/usr/bin/env python3
"""
save_snapshot.py — Save current holdings as a dated snapshot

Usage:
    python3 scripts/save_snapshot.py
    python3 scripts/save_snapshot.py --data-dir /path/to/data
    python3 scripts/save_snapshot.py --date 2026-03-01   # override date
"""

import json
import shutil
import argparse
from datetime import datetime
from pathlib import Path


def resolve_data_dir(data_dir_arg):
    if data_dir_arg:
        return Path(data_dir_arg).resolve()
    return Path(__file__).parent.parent / "data"


def save_snapshot(data_dir: Path, date_override: str = None):
    holdings_file = data_dir / "holdings.json"
    snapshots_dir = data_dir / "snapshots"

    if not holdings_file.exists():
        print(f"❌ holdings.json not found at {holdings_file}")
        return

    snapshots_dir.mkdir(parents=True, exist_ok=True)

    today = date_override or datetime.now().strftime("%Y-%m-%d")
    snapshot_file = snapshots_dir / f"{today}.json"

    if snapshot_file.exists():
        print(f"⚠️  Snapshot for {today} already exists!")
        response = input("Overwrite? (y/n): ")
        if response.lower() != "y":
            print("Cancelled.")
            return

    shutil.copy2(holdings_file, snapshot_file)

    with open(snapshot_file) as f:
        data = json.load(f)
    total = data.get("total_value_usd", 0)

    print(f"✅ Snapshot saved: {snapshot_file}")
    print(f"   Total value: ${total:,.2f}")
    print(f"   Accounts: {len(data.get('accounts', {}))}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Save a dated portfolio snapshot")
    parser.add_argument("--data-dir", help="Path to data directory")
    parser.add_argument("--date", help="Override date (YYYY-MM-DD)")
    args = parser.parse_args()
    save_snapshot(resolve_data_dir(args.data_dir), date_override=args.date)
