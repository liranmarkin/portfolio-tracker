#!/usr/bin/env python3
"""
view_snapshots.py — List and compare historical portfolio snapshots

Usage:
    python3 scripts/view_snapshots.py                              # list all
    python3 scripts/view_snapshots.py 2026-02-01 2026-03-01       # compare two dates
    python3 scripts/view_snapshots.py --data-dir /path/to/data
"""

import json
import sys
import argparse
from pathlib import Path
from datetime import datetime


def resolve_data_dir(data_dir_arg):
    if data_dir_arg:
        return Path(data_dir_arg).resolve()
    return Path(__file__).parent.parent / "data"


def list_snapshots(snapshots_dir: Path):
    if not snapshots_dir.exists():
        print("No snapshots found.")
        return []

    snapshots = sorted(snapshots_dir.glob("*.json"))
    if not snapshots:
        print("No snapshots found.")
        return []

    print(f"\n{'═'*60}")
    print("PORTFOLIO SNAPSHOTS")
    print(f"{'═'*60}")
    print(f"{'Date':<12}  {'USD':>15}  {'ILS':>18}")
    print(f"{'─'*60}")

    for snapshot in snapshots:
        date = snapshot.stem
        with open(snapshot) as f:
            data = json.load(f)
        total_usd = data.get("total_value_usd", 0)
        total_ils = data.get("total_value_ils", 0) or total_usd * data.get("exchange_rate", {}).get("usd_to_ils", 3.7)
        print(f"{date:<12}  ${total_usd:>13,.2f}  ₪{total_ils:>16,.2f}")

    print(f"{'═'*60}\n")
    return snapshots


def compare_snapshots(snapshots_dir: Path, date1: str, date2: str):
    file1 = snapshots_dir / f"{date1}.json"
    file2 = snapshots_dir / f"{date2}.json"

    if not file1.exists() or not file2.exists():
        print("One or both snapshots not found.")
        return

    with open(file1) as f:
        data1 = json.load(f)
    with open(file2) as f:
        data2 = json.load(f)

    t1 = data1.get("total_value_usd", 0)
    t2 = data2.get("total_value_usd", 0)
    t1_ils = data1.get("total_value_ils", 0) or t1 * data1.get("exchange_rate", {}).get("usd_to_ils", 3.7)
    t2_ils = data2.get("total_value_ils", 0) or t2 * data2.get("exchange_rate", {}).get("usd_to_ils", 3.7)

    change_usd = t2 - t1
    change_ils = t2_ils - t1_ils
    change_pct = (change_usd / t1 * 100) if t1 > 0 else 0

    print(f"\n{'═'*60}")
    print(f"COMPARISON: {date1} → {date2}")
    print(f"{'═'*60}")
    print(f"{date1}:  ${t1:>12,.2f}  |  ₪{t1_ils:>12,.2f}")
    print(f"{date2}:  ${t2:>12,.2f}  |  ₪{t2_ils:>12,.2f}")
    print(f"Change:   ${change_usd:>+12,.2f}  |  ₪{change_ils:>+12,.2f} ({change_pct:+.2f}%)")
    print(f"{'═'*60}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="List and compare portfolio snapshots")
    parser.add_argument("date1", nargs="?", help="First date (YYYY-MM-DD)")
    parser.add_argument("date2", nargs="?", help="Second date (YYYY-MM-DD)")
    parser.add_argument("--data-dir", help="Path to data directory")
    args = parser.parse_args()

    data_dir = resolve_data_dir(args.data_dir)
    snapshots_dir = data_dir / "snapshots"
    snapshots = list_snapshots(snapshots_dir)

    if args.date1 and args.date2:
        compare_snapshots(snapshots_dir, args.date1, args.date2)
    elif snapshots and len(snapshots) >= 2:
        compare_snapshots(snapshots_dir, snapshots[0].stem, snapshots[-1].stem)
