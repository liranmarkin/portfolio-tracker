# portfolio-tracker / app

Next.js dashboard for portfolio-tracker. Dark theme, live data from your `holdings.json`.

## Setup

```bash
npm install
DATA_DIR=/path/to/your/data npm start     # production, port 3000
DATA_DIR=/path/to/your/data npm run dev   # dev mode, hot reload
```

## Pages

| Route | Description |
|---|---|
| `/` | Dashboard — total value, net worth chart, allocation, pending actions |
| `/holdings` | All accounts + holdings, P&L, pending sell badges |
| `/allocation` | Donut by ticker, bar by account, target vs actual |
| `/history` | Net worth timeline, period changes (deposits separated from gains), deposit log |

## API Routes

| Route | Returns |
|---|---|
| `/api/portfolio` | Current `holdings.json` |
| `/api/snapshots` | All dated snapshots from `data/snapshots/` |
| `/api/deposits` | `deposits.json` |

## Environment Variables

| Var | Default | Description |
|---|---|---|
| `DATA_DIR` | `../data` | Absolute or relative path to your data directory |
| `PORT` | `3000` | Server port (`npm start -- -p 4000` to override) |
