# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lonely Shopee Monitor is a real-time order monitoring dashboard for Shopee Seller Centre. It uses Playwright to automate browser sessions and scrape orders via Shopee's internal API, displaying them on a SvelteKit web dashboard. Supports multi-account monitoring and is designed to run on Docker (e.g., NAS).

## Common Commands

### Backend (Node.js + TypeScript)

```bash
cd backend
npm install
npx playwright install chromium   # One-time: install Chromium for headless automation
npm run dev                        # Development with auto-reload (tsx watch)
npm run build                      # Compile TypeScript → dist/
npm start                          # Run compiled output
```

### Frontend (SvelteKit + Svelte 5)

```bash
cd frontend
npm install
npm run dev          # Vite dev server at http://localhost:5173
npm run build        # Build static output
npm run check        # Type-check (svelte-kit sync + svelte-check)
npm run check:watch  # Watch mode type-check
```

### Docker (Production)

```bash
docker compose up --build          # Build and start all services
docker compose up -d               # Run in background
docker compose logs -f backend     # Follow backend logs
```

## Architecture

### Clean Architecture (Backend)

The backend follows Clean Architecture with strict layer separation:

- **`domain/`** — Entities (`Order`, `Account`, `ScrapeResult`) and Ports (interfaces: `AuthGateway`, `OrderGateway`, `CachePort`, `Scheduler`)
- **`infrastructure/`** — Implementations: Playwright auth (`shopee-auth.gateway.ts`), Shopee API scraper (`shopee-api.gateway.ts`), JSON file cache (`file-cache.ts`), interval scheduler (`interval-scheduler.ts`)
- **`usecases/`** — Business logic: `CheckAuthUseCase`, `FetchOrdersUseCase`, `ManagePollingUseCase`
- **`routes/`** — Express HTTP endpoints (thin layer, delegates to usecases)
- **`index.ts`** — Bootstrap with manual Dependency Injection; instantiates infrastructure and injects into usecases

### How Shopee API Access Works

Shopee's API requires authenticated browser cookies and anti-bot headers. Rather than extracting cookies and making raw HTTP requests, `ShopeeApiGateway` uses `page.evaluate()` to execute `fetch()` calls **inside the Playwright browser context**. This bypasses anti-bot detection transparently. Auth cookies and headers are never manually managed.

### Multi-Account Support

`index.ts` bootstraps one full set of infrastructure per account. Account 1 uses `SHOPEE_USERNAME`/`SHOPEE_PASSWORD`; Account 2 uses `SHOPEE_USERNAME_2`/`SHOPEE_PASSWORD_2`. Each account gets its own browser profile directory, cache file, and auth gateway. A single `IntervalScheduler` polls all accounts.

### Frontend

SvelteKit configured with `adapter-static` (outputs pure static HTML/CSS/JS). Uses Svelte 5 runes syntax (`$state`, `$derived`, `$effect`). Key component hierarchy:

```
App.svelte → auth check on mount
  └── Dashboard.svelte → tabs + refresh
        ├── TabFilter.svelte
        └── OrderCard.svelte
```

`shopeeOrderService` in `lib/core/services/` handles all HTTP calls to the backend API.

## Key Files

| File | Purpose |
|------|---------|
| `backend/src/index.ts` | DI bootstrap, server startup, graceful shutdown |
| `backend/src/infrastructure/shopee/shopee-api.gateway.ts` | Shopee order scraping via browser evaluate() |
| `backend/src/infrastructure/shopee/shopee-auth.gateway.ts` | Playwright login, session persistence, cookie management |
| `backend/src/usecases/fetch-orders.usecase.ts` | Fetch → compare → cache logic; change detection |
| `frontend/src/lib/app/App.svelte` | Auth check + root component |
| `frontend/src/lib/modules/dashboard/Dashboard.svelte` | Main dashboard UI |
| `docker-compose.yml` | Production orchestration (backend + frontend + volumes) |

## Environment Variables

Copy `.env.example` to `.env` in both root and `backend/` directories.

```env
# Required
SHOPEE_USERNAME=<email or phone>
SHOPEE_PASSWORD=<password>

# Optional
SHOPEE_USERNAME_2=<second account>
SHOPEE_PASSWORD_2=<second account password>
POLLING_INTERVAL=300     # Seconds between auto-fetch (default: 300)
HEADLESS=false           # Show browser window (default: true)
DATA_DIR=./data          # Path for browser profiles and cache files
```

## Docker Notes

- Backend port `3001` (API), port `6080` (noVNC web console to view browser)
- Frontend port `5173`
- Browser profile and order cache are stored in named Docker volumes for persistence across restarts
- Backend Dockerfile installs Xvfb + x11vnc + noVNC so the headless Chromium session can be observed via browser at `http://localhost:6080`
- Backend `docker-entrypoint.sh` starts the virtual display and VNC server before launching the Node process
