# monday BizDev Analytics Dashboard

Custom React + TypeScript monday.com app UI rebuilt from your screenshots.

## What is included

- KPI cards row (Total Leads, Leads This Week, Active Outreach, Converted)
- Lead Sources donut chart
- Outreach Effectiveness horizontal bar chart
- Industry Trends bar chart
- Outreach Activity by Week area line chart
- monday context + GraphQL loading with mock-data fallback

## Local run

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env
```

3. Start dev server:

```bash
npm run dev
```

### Local run shortcuts

- Local-only (stable URL):

```bash
npm run dev:local
```

Serves on `http://127.0.0.1:5173/`

## Connect real board data locally (recommended before deploy)

1. Create local env file:

```bash
cp .env.local.example .env.local
```

2. Open `.env.local` and set:

- `MONDAY_API_TOKEN` to your monday API token
- `VITE_MONDAY_BOARD_ID` to your board ID (currently `7045235564`)

3. Run frontend + local API together:

```bash
npm run dev:full
```

4. Open:

`http://127.0.0.1:5173/`

This mode pulls live monday data through a local server (`http://127.0.0.1:8787`) so your token is not exposed in browser code.

### Useful local API endpoints

- `http://127.0.0.1:8787/health`
- `http://127.0.0.1:8787/fields?boardId=7045235564` (board columns: id/title/type)
- `http://127.0.0.1:8787/board-data?boardId=7045235564`

### Pull suggested env mapping

Run this to print board columns plus a copy/paste env mapping block:

```bash
npm run fields:pull
```
- Expose on your network (same Wi-Fi):

```bash
npm run dev:network
```

## Using inside monday (dev)

monday app features loaded in the monday UI usually need a public HTTPS URL. For local development in monday itself, run a tunnel (for example `ngrok` or `cloudflared`) that forwards to `http://127.0.0.1:5173`, then use that HTTPS URL in your monday app feature settings.

## Environment variables

- `VITE_MONDAY_BOARD_ID`: board ID to load by default (current default is `7045235564`)

## monday integration notes

- Inside monday, the app uses `monday.listen('context')` to detect the active board.
- It requests board items via `monday.api(...)` and derives chart series from column titles using keyword matching:
  - Lead source: titles containing `source` or `contact type`
  - Outreach status: titles containing `status` or `outreach`
  - Industry: titles containing `industry`
- If permissions are missing or request fails, it gracefully shows mock data.

## Next customization

For pixel-perfect board mapping, share your exact column names for:

- Lead source column
- Outreach status column
- Industry column
- Conversion/closed status indicator
