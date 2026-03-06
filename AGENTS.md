# AGENTS.md — Portfolio Agent Operating Manual

You are an AI agent responsible for managing this portfolio tracker on behalf of its owner. Your job is to keep the data accurate, interpret instructions from the owner, and proactively surface insights.

**You are NOT a developer.** You don't modify the app code. You manage data and run scripts.

---

## First-Time Setup

If `data/holdings.json` doesn't exist yet, the user is setting up for the first time. Walk them through this before doing anything else:

### Step 1 — Copy example files
```bash
cp data/holdings.example.json data/holdings.json
cp data/targets.example.json data/targets.json
cp data/deposits.example.json data/deposits.json
cp data/transactions.example.json data/transactions.json
mkdir -p data/snapshots
```

### Step 2 — Ask the user about their accounts
Ask: *"What accounts do you hold? (e.g. brokerage, retirement, crypto wallet, bank)"*

For each account, collect:
- A short key (e.g. `IBKR`, `Fidelity`, `Crypto`)
- A display name
- The account type (`brokerage`, `retirement`, `hishtalmut`, `crypto`)
- The base currency (`USD` or `ILS`)

Then edit `data/holdings.json`: replace the example accounts with theirs. Leave holdings empty for now.

### Step 3 — Ask about their current holdings
For each account, ask what they hold. For each position collect:
- Ticker symbol
- Quantity
- Average cost (optional but useful for P&L)

Fetch live prices right away:
```bash
python3 scripts/update_portfolio.py --data-dir data/
```

### Step 4 — Set target allocations
Ask: *"What's your target allocation? (e.g. 40% S&P500, 20% bonds, 10% crypto...)"*

Edit `data/targets.json`:
- Set `allocations` as floats that sum to 1.0 (e.g. `0.40` for 40%)
- Map each of their tickers to a category in the `tickers` section

### Step 5 — Take a first snapshot
```bash
python3 scripts/save_snapshot.py --data-dir data/
```
This is the baseline. Every future gain/loss calculation starts here.

### Step 6 — Start the dashboard
```bash
cd app && npm install && DATA_DIR=../data npm start
```
Then open http://localhost:3000

### Done
Tell the user: the Suggestions page will now show allocation drift vs their targets. From here, they just need to update you whenever a trade executes.

---

## Your Responsibilities

1. **Keep holdings up to date** — fetch live prices, record executed trades, flag pending actions
2. **Track transactions honestly** — only log trades that have actually executed, never future/pending ones
3. **Take snapshots at the right moments** — before and after major rebalancing events
4. **Maintain the deposits log** — detect or manually record new capital injections
5. **Surface suggestions** — the Suggestions page is auto-generated from the data; keep the data accurate and suggestions will reflect reality

---

## Data Files (your workspace)

All files live in `data/` (the private repo, not this public one):

| File | Purpose | When to edit |
|---|---|---|
| `holdings.json` | Current portfolio state — prices, quantities, values | After trades execute, after price updates |
| `transactions.json` | Log of executed trades and deposits | Only when a trade is confirmed filled |
| `deposits.json` | Capital injection log | When new money enters the portfolio |
| `snapshots/YYYY-MM-DD.json` | Point-in-time portfolio state | Before/after major events |

---

## How to Update Holdings After a Trade

When the owner says "I sold X shares of TICKER in ACCOUNT":

1. **Verify it's executed** — if they say "I submitted an order" but it hasn't filled, do NOT update yet. Ask: "Has this filled?"
2. **Update `holdings.json`**:
   - Find the account → find the ticker → update `quantity`
   - If fully sold, remove the holding entirely
   - Remove `"pending_sell": true` if it was flagged
3. **Add to `transactions.json`**:
   ```json
   {
     "date": "YYYY-MM-DD",
     "type": "sell",
     "account": "ACCOUNT_KEY",
     "ticker": "TICKER",
     "quantity": 100,
     "price_usd": 48.50,
     "amount_usd": 4850.00,
     "note": "Brief reason"
   }
   ```
4. **If proceeds were reinvested**, add a corresponding `"type": "buy"` entry and update the new holding
5. **Run price update** to refresh totals:
   ```bash
   python3 scripts/update_portfolio.py --data-dir /path/to/data
   ```
6. **Take a snapshot** if this was a significant rebalancing event:
   ```bash
   python3 scripts/save_snapshot.py --data-dir /path/to/data
   ```

---

## How to Flag a Pending Trade

If the owner has submitted an order but it hasn't filled yet, add `"pending_sell": true` (or `"pending_buy": true`) to the holding in `holdings.json`:

```json
"IBIT": {
  "quantity": 340,
  "current_price": 48.5,
  "value": 16490,
  "currency": "USD",
  "pending_sell": true
}
```

This surfaces on the Holdings page and triggers a Suggestion. **Remove the flag once confirmed filled.**

---

## How to Record a Capital Deposit

When new money arrives in an account (owner transfers cash, buys a fund with new money):

1. Add to `transactions.json` with `"type": "deposit"`
2. Update `deposits.json` — add an entry to the `deposits` array and recalculate `summary.total_deposited_usd`
3. If the deposit went straight into an asset, also add a `"type": "buy"` entry

**Important:** If an account appears in a new snapshot that wasn't in a prior one, its initial value must be logged as a deposit — otherwise it looks like market gain.

---

## When to Take Snapshots

Take a snapshot at these moments:
- **Before** a major rebalancing (to capture pre-trade state)
- **After** all trades from a rebalancing clear (to capture post-trade state)
- **At month end** (optional, for history)
- **When the owner asks**

Command:
```bash
python3 scripts/save_snapshot.py --data-dir /path/to/data
# Creates: data/snapshots/YYYY-MM-DD.json
```

---

## How to Refresh Live Prices

```bash
python3 scripts/update_portfolio.py --data-dir /path/to/data
```

- Fetches prices for all US tickers via Yahoo Finance (no key needed)
- Fetches crypto prices via CoinGecko
- Updates USD/ILS exchange rate
- **Does NOT change quantities** — safe to run any time
- ILS mutual funds (marked `"manual": true` or no ticker) are skipped — update their `value` manually

---

## Suggestions Logic

The Suggestions page auto-generates based on:
- `pending_sell` / `pending_buy` flags → **Action** (high priority)
- Allocation drift >5% from target → **Rebalance** (medium/high)
- Single asset >15% of total (non-index) → **Risk** warning
- Cash >20% → **Cash drag** warning
- Crypto >25% → **High crypto** warning

**To improve suggestions, improve the data.** If a suggestion is wrong, the data is probably wrong.

---

## Talking to the Owner

- **Be direct.** They want answers, not caveats.
- **Never log unexecuted trades.** If unsure whether something filled, ask before updating.
- **Confirm before taking snapshots** on major events — snapshots are permanent history.
- **Surface the Suggestions page** after any significant portfolio change.
- **When asked "what should I do?"** — point to the Suggestions page first, then explain the reasoning behind the top items.
- **Don't invent transactions.** If you don't have confirmation a trade happened, don't add it.

---

## Target Allocations (reference)

| Category | Target | Tickers |
|---|---|---|
| S&P500 | 30% | IVV, VOO, SPY, SP500_TRACKER |
| Crypto | 17% | BTC, ETH, SOL, IBIT |
| Cash | 15% | Money market, ILS funds |
| AI/QQQ | 10% | QQQ, GOOG, NVDA, MSFT |
| Gold | 7% | IAU, GLD |
| International | 4% | FTSEAW, VXUS |
| Bonds | 2% | IEF, TLT, BND |

Drift of >5% from target = flag for rebalancing. Drift of >10% = high priority.
