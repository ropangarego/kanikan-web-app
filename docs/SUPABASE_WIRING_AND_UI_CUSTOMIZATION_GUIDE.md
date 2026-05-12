# KANIKAN Web App Guide

Last updated: 2026-04-17

Dokumen ini menjelaskan dua hal:

1. cara menghubungkan CRUD/query layer ke Supabase asli
2. cara meng-customize UI walaupun kamu lebih familiar dengan JavaScript daripada TypeScript

Source of truth produk tetap:

- [`../KANIKAN_WEB_APP_SPEC_FINAL.md`](../KANIKAN_WEB_APP_SPEC_FINAL.md)

## 1. Current App State

Saat ini web-app sudah punya:

- app shell responsive
- auth flow yang siap ke Supabase
- route protection
- halaman MVP utama
- seeded demo data
- local storage untuk draft/filter state

Yang masih demo/local:

- query data operasional utama
- mutation CRUD utama
- dashboard aggregates dari DB views/RPC

Diagram singkat:

```text
Current state

UI Pages
  |
  v
App Context
  |
  +--> Seed Data
  +--> Local Storage
  +--> Supabase Auth (ready)

Target state

UI Pages
  |
  v
Feature Query/Mutation Layer
  |
  +--> Supabase Tables
  +--> Supabase Views
  +--> Supabase RPC
  +--> Local Storage (draft/filter only)
```

## 2. How to Wire Real Supabase

### 2.1 Set environment first

Copy:

- [`../.env.example`](../.env.example)

menjadi `.env`, lalu isi:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

File Supabase client yang dipakai:

- [`../src/lib/supabase.ts`](../src/lib/supabase.ts)

Kalau env belum diisi:

- app tetap jalan dalam demo mode
- auth pakai demo fallback
- data operasional tetap dari seeded snapshot

### 2.2 Understand the current architecture

File penting:

- [`../src/features/auth/auth-context.tsx`](../src/features/auth/auth-context.tsx)
- [`../src/features/app/app-data-context.tsx`](../src/features/app/app-data-context.tsx)
- [`../src/types/domain.ts`](../src/types/domain.ts)

Peran masing-masing:

- `auth-context.tsx`
  - sudah siap pakai Supabase Auth
  - fallback ke demo profile jika env belum ada

- `app-data-context.tsx`
  - sekarang memegang seeded data dan local mutations
  - ini adalah tempat utama yang harus dipindah dari demo storage ke Supabase query/mutation

- `domain.ts`
  - mendefinisikan bentuk data frontend
  - jadi jembatan antara snake_case DB dan camelCase UI

### 2.3 Recommended migration strategy

Jangan ubah semua sekaligus.

Urutan yang paling aman:

1. `Settings`
2. `Ponds`
3. `Cycles`
4. `Daily Logs`
5. `Stock Movements`
6. `Cash`
7. `Sales`
8. `Dashboard`

Kenapa:

- dari yang paling sederhana ke yang paling kompleks
- wiring data stabil dulu
- business logic lintas tabel dibelakangkan sampai fondasinya rapi

### 2.4 Create a dedicated API/query layer

Disarankan membuat folder baru:

```text
src/lib/api/
  dashboard.ts
  ponds.ts
  cycles.ts
  daily-logs.ts
  stock-movements.ts
  sales.ts
  cash.ts
  settings.ts
```

Tujuan:

- query dan mutation tidak bercampur dengan JSX
- halaman tetap fokus ke UI
- lebih mudah testing dan debug

Contoh pola `fetchPonds()`:

```ts
import { supabase } from '../supabase'

export async function fetchPonds() {
  const { data, error } = await supabase!
    .from('units')
    .select('id, name, type, capacity, is_active, notes')
    .order('name')

  if (error) throw error

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type ?? '-',
    capacity: row.capacity ?? 0,
    isActive: row.is_active ?? true,
    notes: row.notes ?? '',
  }))
}
```

### 2.5 Replace local reads one module at a time

Sekarang halaman banyak membaca:

- `appData.snapshot.*`

Target akhirnya:

- halaman pakai `useQuery`
- `queryFn` memanggil `src/lib/api/*`
- demo fallback boleh tetap ada sementara

Contoh pola target:

```ts
const pondsQuery = useQuery({
  queryKey: ['ponds'],
  queryFn: fetchPonds,
})
```

### 2.6 Replace local writes one module at a time

Saat ini mutation seperti:

- `addDailyLog`
- `addStockMovement`
- `addSale`
- `addCashEntry`
- `closeCycle`
- `transferCycle`

masih mutasi seeded snapshot.

Target:

- CRUD sederhana pakai `insert / update / delete`
- flow kompleks pindah ke RPC

Contoh create daily log:

```ts
const { error } = await supabase!.from('log_harian').insert({
  date: input.date,
  unit_id: input.unitId,
  cycle_id: input.cycleId,
  fish_type_id: input.fishTypeId,
  feed_g: input.feedG,
  event: input.event,
  action: input.action,
  description: input.description,
  sample_weight_g: input.sampleWeightG,
  sample_count: input.sampleCount,
})

if (error) throw error
```

### 2.7 Table mapping reference

Gunakan mapping ini:

```text
Profile       -> profiles
Pond          -> units
Cycle         -> cycles
DailyLog      -> log_harian
StockMovement -> stock_movements
Sale          -> penjualan
CashEntry     -> kas
```

Mapping field umumnya:

```text
unit_id          -> unitId
date_start       -> dateStart
date_end         -> dateEnd
target_weight_g  -> targetWeightG
avg_seed_weight_g -> avgSeedWeightG
created_at       -> createdAt
```

Diagram transform:

```text
Supabase row (snake_case)
        |
        v
mapper / normalizer
        |
        v
frontend object (camelCase)
        |
        v
React components
```

### 2.8 When to use tables, views, or RPC

#### Use tables for:

- simple CRUD
- forms
- record detail
- list pages

Examples:

- `units`
- `log_harian`
- `stock_movements`
- `kas`
- `penjualan`

#### Use views for:

- summarized list data
- dashboard cards
- pond current status
- cycle metrics

Examples from spec:

- `farm_status_summary`
- `pond_current_status`
- `cycle_summary`
- `cash_summary`
- `stock_movement_summary`
- `cycle_prediction_summary`

#### Use RPC for:

- multi-step transactional logic
- write flows touching several tables
- actions that must stay consistent

Use RPC especially for:

- sale + auto cash-in + optional sold movement
- manual cycle close with reason
- transfer cycle / pindah wadah

Recommended target:

```text
UI action
  |
  +--> Simple form save ----------> table insert/update/delete
  |
  +--> Complex business action ---> RPC
  |
  +--> Heavy summary -------------> view / RPC read
```

### 2.9 Recommended RPC candidates

#### `close_cycle_manually`

Input:

- `p_cycle_id`
- `p_date_end`
- `p_reason`

Should handle:

- validate cycle exists and active
- compute live stock from `stock_movements`
- decide closing movement type:
  - `personal_use`
  - or `adjustment_out`
- write closing movement if needed
- update cycle `date_end`
- append note/reason if desired

#### `transfer_cycle`

Input:

- `p_cycle_id`
- `p_to_unit_id`
- `p_date_end`
- `p_reason`

Should handle:

- validate source cycle active
- validate target pond has no active cycle
- compute live stock
- create `transfer_out`
- close old cycle
- create new cycle
- create `transfer_in`

#### `create_sale_with_cash`

Input:

- sale fields
- optional sold count metadata

Should handle:

- insert `penjualan`
- auto insert `kas` type `Masuk`
- optionally insert stock movement `sold`
- return status whether stock was reduced or not

### 2.10 Suggested implementation phases

#### Phase 1: Make profile real

Wire:

- settings page
- language update
- Telegram ID update

Files to focus:

- [`../src/features/settings/settings-page.tsx`](../src/features/settings/settings-page.tsx)
- [`../src/features/auth/auth-context.tsx`](../src/features/auth/auth-context.tsx)

#### Phase 2: Make ponds and cycles real

Wire:

- ponds list
- pond detail
- cycles list
- cycle detail basic read

Files:

- [`../src/features/ponds/ponds-page.tsx`](../src/features/ponds/ponds-page.tsx)
- [`../src/features/ponds/pond-detail-page.tsx`](../src/features/ponds/pond-detail-page.tsx)
- [`../src/features/cycles/cycles-page.tsx`](../src/features/cycles/cycles-page.tsx)
- [`../src/features/cycles/cycle-detail-page.tsx`](../src/features/cycles/cycle-detail-page.tsx)

#### Phase 3: Make daily logs and stock movements real

Wire:

- CRUD log harian
- list/filter stock movement
- manual adjustment

#### Phase 4: Make cash and sales real

Wire:

- CRUD cash
- CRUD sale
- auto cash entry
- sold count warning logic

#### Phase 5: Move complex actions into RPC

Wire:

- close cycle
- transfer cycle
- create sale with side effects

#### Phase 6: Make dashboard fully real

Wire:

- all dashboard cards
- alerts
- summary charts

Use DB views/RPC instead of large client-side calculation.

## 3. UI Customization Guide

Yes, you can customize the UI yourself.

The most important thing to know:

> In this codebase, TypeScript does not change how UI is written.
> Most visual changes still happen in normal React JSX and CSS utility classes.

If you know JavaScript, you already know most of what you need.

### 3.1 How to think about TypeScript here

This:

```ts
type Pond = {
  id: string
  name: string
}
```

basically just means:

- `id` should be text
- `name` should be text

It is a shape declaration, not a new programming style.

Most UI editing still looks like this:

```tsx
<h1 className="text-2xl font-semibold">Farm Control Center</h1>
```

So if you want to customize UI:

- change text
- change layout
- change color classes
- change spacing
- change components

without touching most types at all

### 3.2 Best files to start customizing

#### Global style

- [`../src/index.css`](../src/index.css)

Use for:

- font base
- global page feel
- base background

#### App shell and navigation

- [`../src/features/layout/app-shell.tsx`](../src/features/layout/app-shell.tsx)
- [`../src/features/layout/nav-config.ts`](../src/features/layout/nav-config.ts)

Use for:

- sidebar
- top bar
- mobile nav
- quick actions

#### Shared UI components

- [`../src/features/shared/components.tsx`](../src/features/shared/components.tsx)

Use for:

- cards
- pills
- table style
- section wrappers

If you change this file, many pages improve together.

#### Page-level layout

- [`../src/features/dashboard/dashboard-page.tsx`](../src/features/dashboard/dashboard-page.tsx)
- [`../src/features/ponds/ponds-page.tsx`](../src/features/ponds/ponds-page.tsx)
- [`../src/features/cycles/cycle-detail-page.tsx`](../src/features/cycles/cycle-detail-page.tsx)

Use for:

- per-page arrangement
- cards and sections order
- charts and content density

### 3.3 What you will mostly edit

#### Text

Example:

```tsx
<h2 className="text-xl font-semibold">Responsive operational shell</h2>
```

You can rename that freely.

#### Tailwind classes

Example:

```tsx
className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
```

This controls:

- `rounded-lg` -> corner roundness
- `border` -> border
- `border-slate-200` -> border color
- `bg-white` -> background
- `p-4` -> padding
- `shadow-sm` -> shadow

#### Layout structure

Example:

- move cards
- change grids
- change spacing
- add or remove sections

### 3.4 Tailwind cheat sheet for common customization

#### Color

```text
bg-emerald-500
text-slate-900
border-slate-200
```

Examples:

- green to blue:
  - `bg-emerald-500` -> `bg-sky-600`
- softer cards:
  - `bg-white` -> `bg-slate-50`

#### Spacing

```text
p-4     padding
px-3    horizontal padding
py-2    vertical padding
gap-4   space between items
space-y-6 vertical stack spacing
```

#### Size

```text
w-72
text-sm
text-xl
rounded-lg
shadow-sm
```

### 3.5 Example customization map

#### Want to change app accent color

Edit:

- [`../src/features/layout/app-shell.tsx`](../src/features/layout/app-shell.tsx)
- [`../src/features/dashboard/dashboard-page.tsx`](../src/features/dashboard/dashboard-page.tsx)

Search for:

- `emerald`

#### Want denser dashboard

Edit:

- dashboard grid classes in [`../src/features/dashboard/dashboard-page.tsx`](../src/features/dashboard/dashboard-page.tsx)

Examples:

- `gap-6` -> `gap-4`
- `xl:grid-cols-5` -> `xl:grid-cols-4`

#### Want cleaner cards everywhere

Edit:

- [`../src/features/shared/components.tsx`](../src/features/shared/components.tsx)

Change:

- `PageSection`
- `StatCard`
- `Table`

#### Want different sidebar size

Edit:

- `w-72` in [`../src/features/layout/app-shell.tsx`](../src/features/layout/app-shell.tsx)

#### Want different mobile nav

Edit:

- bottom `<nav>` in [`../src/features/layout/app-shell.tsx`](../src/features/layout/app-shell.tsx)

### 3.6 Safe editing rules for a JS-first developer

#### Safe rule 1

Mostly edit:

- text
- JSX structure
- `className`

#### Safe rule 2

Avoid changing:

- `type ...`
- `interface ...`

unless you are intentionally changing data structure

#### Safe rule 3

If you see this:

```ts
({ title, subtitle }: { title: string; subtitle?: string })
```

it only means:

- `title` must exist
- `subtitle` optional

You can usually ignore the type part and edit the JSX below it.

#### Safe rule 4

If TypeScript complains after a UI change, common reasons are:

- wrong prop name
- wrong field name
- number turned into string unexpectedly
- required prop got removed

### 3.7 Learning path for you

Best order to practice:

1. customize colors in `app-shell.tsx`
2. customize cards/tables in `components.tsx`
3. customize dashboard layout
4. customize one form page like `sales-page.tsx`
5. only then touch query/mutation wiring

Diagram:

```text
Best path for customization

Text/classes
   ->
Shared components
   ->
Page layouts
   ->
Forms
   ->
Real data wiring
```

## 4. Suggested Next Step

The cleanest next implementation move is:

1. create `src/lib/api/*`
2. wire `Settings` to real `profiles`
3. wire `Ponds` to real `units`
4. wire `Daily Logs` to real `log_harian`
5. keep other modules in demo mode temporarily

That gives you a hybrid app:

- some modules real
- some modules still scaffolded
- no need to rewrite everything at once

This is the least painful path from MVP scaffold to production-ready data wiring.
