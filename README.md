# KANIKAN Web App

KANIKAN Web App adalah scaffold MVP untuk dashboard operasional farm ikan berbasis:

- Vite
- React
- TypeScript
- Tailwind CSS
- React Router
- TanStack Query
- Supabase JS
- React Hook Form
- Zod

Dokumen source of truth produk ada di:

- `../KANIKAN_WEB_APP_SPEC_FINAL.md`

Additional working docs:

- `./docs/SUPABASE_WIRING_AND_UI_CUSTOMIZATION_GUIDE.md`
- `./docs/WEB_APP_PROGRESS_TRACKER.md`

## What is implemented

- protected routing
- login screen with Supabase-ready auth and demo mode fallback
- responsive app shell with desktop sidebar and mobile bottom navigation
- dashboard with summary cards, alerts, and feed trend chart
- ponds list and pond detail
- cycles list and cycle detail with manual close + transfer flow
- daily log create/delete pattern with local draft persistence
- stock movement ledger and manual adjustment flow
- sales flow with auto cash entry and stock reduction warning
- cash ledger with nullable description support
- settings page for language and Telegram ID
- placeholder routes for Predictions, Reports, and Master Data

## Local setup

1. Install dependencies

```bash
npm install
```

2. Optional: connect Supabase by copying `.env.example` to `.env`

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

If env values are missing, the app runs in demo mode using local seeded data and local storage persistence.

3. Start dev server

```bash
npm run dev
```

4. Build for production

```bash
npm run build
```

## Folder guide

- `src/features` domain modules and route pages
- `src/lib` helpers, formatting, storage, seed data, stock logic
- `src/routes` router and route protection
- `src/types` shared domain types

## Maintainability notes

- local storage is used only for non-sensitive drafts and UI state
- stock calculations use `stock_movements` as the primary source
- `fish_inventory` is intentionally not used as the primary stock ledger
- this scaffold is ready to swap demo storage with real Supabase-backed CRUD in the next implementation pass
