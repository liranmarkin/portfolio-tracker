# portfolio-tracker

A personal portfolio tracker with a Next.js dashboard and Python scripts for fetching live prices, saving snapshots, and tracking deposits vs. market gains.

**No API keys required.** Uses free public APIs (Yahoo Finance, CoinGecko, exchangerate-api).

---

## Structure

```
portfolio-tracker/
├── app/                  ← Next.js dashboard (dark theme, charts, 4 pages)
│   └── src/
│       ├── app/          ← Pages: dashboard, holdings, allocation, history
│       ├── components/   ← Charts (Recharts), Nav
│       └── lib/          ← data.ts (reads JSON files), types, formatters
├── scripts/              ← Python CLI tools
│   ├── update_portfolio.py   ← Fetch live prices → holdings.json
│   ├── fetch_prices.py       ← Quick price lookup (no file changes)
│   ├── save_snapshot.py      ← Save dated snapshot
│   ├── view_snapshots.py     ← List / compare snapshots
│   ├── view_by_asset.py      ← Holdings by ticker across accounts
│   ├── historical_value.py   ← Portfolio value at any past date
│   ├── portfolio_gains.py    ← Deposits vs market gains between snapshots
│   └── deposits.py           ← Track and manage capital deposits
├── data/
│   └── holdings.example.json ← Template — copy to holdings.json and fill in
├── requirements.txt
└── setup.sh              ← First-time setup
```

---

## Quick Start

```bash
git clone https://github.com/YOUR_USERNAME/portfolio-tracker.git
cd portfolio-tracker
./setup.sh

# Edit your holdings
nano data/holdings.json

# Fetch live prices
source venv/bin/activate
python3 scripts/update_portfolio.py

# Start dashboard
cd app && DATA_DIR=../data npm install && DATA_DIR=../data npm start
# → http://localhost:3000
```

---

## Data Format

Copy `data/holdings.example.json` → `data/holdings.json` and fill in your holdings.

```json
{
  "accounts": {
    "IBKR": {
      "name": "Interactive Brokers",
      "type": "brokerage",
      "holdings": {
        "IVV":  { "quantity": 10, "currency": "USD" },
        "IBIT": { "quantity": 5,  "currency": "USD", "avg_cost": 37.14 }
      }
    },
    "Crypto": {
      "name": "Crypto Wallet",
      "type": "crypto",
      "holdings": {
        "BTC": { "quantity": 0.5, "currency": "USD" },
        "ETH": { "quantity": 2.0, "currency": "USD" }
      }
    },
    "Bank": {
      "name": "Bank Account",
      "type": "brokerage",
      "holdings": {
        "MY_FUND": {
          "quantity": 1000,
          "value": 50000,
          "currency": "ILS"
        }
      }
    }
  }
}
```

**Supported holding types:**
| Type | How to use |
|---|---|
| US stocks / ETFs | Set `currency: "USD"`, quantity in shares |
| Israeli TASE stocks | Use `.TA` ticker suffix (e.g. `TEVA.TA`) |
| Crypto | Put in a `"type": "crypto"` account, BTC/ETH/SOL etc. |
| ILS mutual funds | Set `currency: "ILS"`, update `value` manually in ILS |

---

## Price Sources

| Data | Source | Key required? |
|---|---|---|
| Stocks / ETFs | Yahoo Finance via `yfinance` | No |
| Israeli TASE | Same, `.TA` suffix | No |
| Crypto | CoinGecko public API | No |
| USD/ILS rate | exchangerate-api.com | No |
| ILS funds | Manual — edit `holdings.json` | — |

---

## Python Scripts

All scripts accept `--data-dir /path/to/data` (defaults to `../data` relative to script).

```bash
# Fetch live prices
python3 scripts/update_portfolio.py
python3 scripts/update_portfolio.py --dry-run          # preview only

# Quick price lookup
python3 scripts/fetch_prices.py IVV BTC TEVA.TA

# Snapshots
python3 scripts/save_snapshot.py
python3 scripts/view_snapshots.py                      # list all
python3 scripts/view_snapshots.py 2026-02-01 2026-03-01  # compare two

# Deposits vs market gains
python3 scripts/deposits.py detect 2026-02-01 2026-03-01  # auto-detect
python3 scripts/deposits.py view
python3 scripts/deposits.py add                          # manual entry
python3 scripts/portfolio_gains.py 2026-02-01 2026-03-01

# Historical value (real prices, not estimates)
python3 scripts/historical_value.py 2025-10-31
python3 scripts/historical_value.py 2025-10-31 2026-03-01  # compare

# By-asset breakdown
python3 scripts/view_by_asset.py
```

---

## Dashboard (Next.js App)

```bash
cd app
npm install
DATA_DIR=/path/to/your/data npm start     # production (port 3000)
DATA_DIR=/path/to/your/data npm run dev   # dev mode with hot reload
```

**Pages:**
- `/` — Dashboard: total value, net worth chart, allocation donut, pending actions
- `/holdings` — All accounts + holdings, P&L, pending badges
- `/allocation` — By-ticker donut, by-account bar, target vs actual
- `/history` — Net worth timeline, period changes (deposits vs real return), deposit log

**Environment variables:**
| Var | Default | Description |
|---|---|---|
| `DATA_DIR` | `../data` | Path to your data folder |
| `PORT` | `3000` | Server port |

---

## Adding New Crypto

Edit `COINGECKO_IDS` at the top of `scripts/update_portfolio.py` and `scripts/fetch_prices.py`:

```python
COINGECKO_IDS = {
    "BTC": "bitcoin",
    "ETH": "ethereum",
    "PEPE": "pepe",    # ← find the ID in the CoinGecko URL
}
```

---

## Private Usage with financial-os

This repo is the generic tool. For private personal data, use it as a git submodule inside a private repo:

```bash
# In your private repo
git submodule add git@github.com:YOUR_USERNAME/portfolio-tracker.git tools/portfolio-tracker

# Run with your data
DATA_DIR=/path/to/private/data tools/portfolio-tracker/app/... npm start
python3 tools/portfolio-tracker/scripts/update_portfolio.py --data-dir /path/to/private/data
```

---

## Dependencies

```
requests>=2.28.0     # API calls
matplotlib>=3.6.0    # (legacy) chart generation
yfinance>=0.2.40     # Yahoo Finance price data
```

Install: `pip install -r requirements.txt` or run `./setup.sh`.
