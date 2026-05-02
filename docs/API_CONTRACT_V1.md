# KANIKAN API Contract V1

This contract defines the first backend read endpoints needed by the current frontend pages. V1 is optimized for page rendering, not raw database mirroring.

## General Rules

- Base path: `/api/v1`
- Auth: every endpoint requires the logged-in user session.
- Dates: ISO date strings in `YYYY-MM-DD`.
- Date-times: ISO timestamp strings.
- Currency: integer Rupiah, no decimals.
- Weight fields:
  - `weight_g` means grams per fish unless explicitly named `feed_g`.
  - `weight_kg` means total biomass/harvest weight.
- Pagination:
  - Use `limit` and `cursor` for ledgers.
  - Response returns `next_cursor: string | null`.
- IDs are strings.

## Shared Enums

```ts
type PondStatus = 'active' | 'inactive'
type CycleStatus = 'running' | 'closed'
type StockMovementType =
  | 'stock_in'
  | 'sold'
  | 'died'
  | 'transfer_in'
  | 'transfer_out'
  | 'adjustment_in'
  | 'adjustment_out'
  | 'personal_use'
type CashType = 'Masuk' | 'Keluar'
type AlertTone = 'info' | 'warning' | 'danger' | 'success'
```

## Page To Endpoint Mapping

| Page | Endpoint |
| --- | --- |
| Dashboard | `GET /dashboard_summary` |
| Ponds | `GET /ponds_list`, `GET /pond_detail` |
| Stock | `GET /stock_movements` |
| Cash & Balance | `GET /cash_summary`, `GET /cash_transactions`, `GET /cash_categories` |

## 1. Dashboard Summary

`GET /api/v1/dashboard_summary`

Query params:

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `date` | string | no | Defaults to today. Used for daily log/feed checks. |
| `period_start` | string | no | Defaults to last 7 days for mortality/feed comparison. |
| `period_end` | string | no | Defaults to `date`. |

Frontend needs:

- KPI row: running ponds, feed today vs target, survival rate, mortality this week.
- Attention list with clear pond/action copy.
- Overall growth chart for average sample weight across running ponds.
- Money snapshot.
- Pond overview table for active ponds only.

Response:

```json
{
  "as_of_date": "2026-04-27",
  "period": {
    "start": "2026-04-21",
    "end": "2026-04-27",
    "label": "Last 7 days"
  },
  "kpis": {
    "running_ponds": 4,
    "feed_today_g": 10200,
    "feed_target_g": 9800,
    "feed_today_vs_target_pct": 104.1,
    "feed_calculation_note": "Total feed logged today divided by average daily feed from the selected period.",
    "survival_rate_pct": 93.2,
    "mortality_this_week_pct": 1.8,
    "mortality_this_week_count": 105
  },
  "attention_items": [
    {
      "id": "missing-log-pond-1",
      "tone": "warning",
      "pond_id": "pond-1",
      "pond_name": "Bucket 1",
      "title": "Bucket 1 needs a daily log today",
      "description": "Open the pond and add today feed plus a short daily note.",
      "action_label": "Add log"
    }
  ],
  "growth": {
    "scope": "overall_running_ponds",
    "title": "Overall growth",
    "subtitle": "Average sample weight across running ponds.",
    "points": [
      {
        "date": "2026-04-21",
        "avg_weight_g": 120
      }
    ]
  },
  "money_snapshot": {
    "sales_this_month_rp": 994100,
    "expense_this_month_rp": 325000,
    "net_this_month_rp": 669100
  },
  "pond_overview": [
    {
      "pond_id": "pond-1",
      "pond_name": "Bucket 1",
      "cycle_id": "cycle-101",
      "fish_species": "Lele",
      "days_since_stocking": 75,
      "live_fish_count": 745,
      "survival_rate_pct": 82.1,
      "avg_weight_g": 145,
      "status": "healthy"
    }
  ]
}
```

## 2. Ponds List

`GET /api/v1/ponds_list`

Query params:

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `include_inactive` | boolean | no | Defaults to `true` for Ponds page selector. |
| `q` | string | no | Search by pond name. |

Frontend needs:

- Summary: total ponds, active/running ponds, empty ponds.
- Compact pond selector/list.
- Selected pond summary on mobile.

Response:

```json
{
  "summary": {
    "total_ponds": 5,
    "active_ponds": 4,
    "empty_ponds": 1
  },
  "ponds": [
    {
      "pond_id": "pond-1",
      "pond_name": "Bucket 1",
      "pond_type": "Ember",
      "capacity_fish": 80,
      "status": "active",
      "description": "Lele growout cepat.",
      "current_cycle": {
        "cycle_id": "cycle-101",
        "cycle_name": "Cycle 101",
        "fish_species": "Lele",
        "date_start": "2026-02-11",
        "days_since_stocking": 75
      }
    }
  ]
}
```

## 3. Pond Detail

`GET /api/v1/pond_detail`

Query params:

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `pond_id` | string | yes | Selected pond. |
| `logs_limit` | number | no | Defaults to `10`. |
| `stock_limit` | number | no | Defaults to `10`. |

Frontend needs:

- Detail header:
  - Pond title and fish species.
  - Active/not active status and current cycle.
  - Stocking start, days since stocking.
  - Total fish, survival rate, average weight.
  - Target weight progress.
  - Harvest prediction.
  - Last log with timestamp/relative text.
  - Notes.
- Daily logs tab with edit/delete actions.
- Stock movements tab with user-friendly movement type and delete action.
- Cycle history tab without horizontal scroll on mobile.
- If inactive/empty: hide Add Log/Update Stock and show Open Pond/Start New Cycle action.

Response:

```json
{
  "pond": {
    "pond_id": "pond-1",
    "pond_name": "Bucket 1",
    "pond_type": "Ember",
    "capacity_fish": 80,
    "status": "active",
    "description": "Pakan alternatif lele maggot dan azola."
  },
  "current_cycle": {
    "cycle_id": "cycle-101",
    "cycle_name": "Cycle 101",
    "status": "running",
    "fish_species": "Lele",
    "date_start": "2026-02-11",
    "days_since_stocking": 75,
    "initial_stock_count": 1200,
    "live_fish_count": 985,
    "survival_rate_pct": 82.1,
    "avg_weight_g": 145,
    "target_weight_g": 180,
    "target_progress_pct": 80.6,
    "harvest_prediction": {
      "days_left": 20,
      "label": "20 days left"
    },
    "last_log": {
      "log_id": "log-1",
      "logged_at": "2026-04-26T08:30:00Z",
      "date": "2026-04-26",
      "relative_label": "1 hari yang lalu"
    }
  },
  "daily_logs": [
    {
      "log_id": "log-1",
      "date": "2026-04-26",
      "logged_at": "2026-04-26T08:30:00Z",
      "feed_g": 3200,
      "sample_weight_g": 145,
      "sample_count": 10,
      "event": "Ikan aktif",
      "action": "Tambah aerasi",
      "description": "Air agak keruh, ikan aktif.",
      "created_by": {
        "profile_id": "profile-owner",
        "name": "R Pang"
      },
      "can_update": true,
      "can_delete": true
    }
  ],
  "stock_movements": [
    {
      "movement_id": "mv-3",
      "date": "2026-04-13",
      "movement_type": "sold",
      "movement_label": "Sold",
      "count": 180,
      "weight_kg": 5.8,
      "description": "Batch 1",
      "created_at": "2026-04-13T08:00:00Z",
      "can_delete": false
    }
  ],
  "cycle_history": [
    {
      "cycle_id": "cycle-101",
      "cycle_name": "Cycle 101",
      "fish_species": "Lele",
      "date_start": "2026-02-11",
      "date_end": null,
      "initial_stock_count": 1200,
      "status": "running"
    }
  ]
}
```

## 4. Stock Movements

`GET /api/v1/stock_movements`

Query params:

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `period` | string | no | `today`, `7d`, `30d`, `month`, `3m`, `all`. |
| `start_date` | string | no | Optional explicit range. |
| `end_date` | string | no | Optional explicit range. |
| `pond_id` | string | no | Use `all` or omit for all ponds. |
| `type` | string | no | `all`, `in`, `sold`, `died`, `transfer`. |
| `limit` | number | no | Defaults to `20`. Mobile can request `7`. |
| `cursor` | string | no | For load more. |

Frontend needs:

- Stock by pond cards.
- Pond filter options.
- Period filter options.
- Movement type chips.
- Ledger table/cards.
- Detailed delete confirmation:
  - Bucket/pond and fish species.
  - Date.
  - Stock type.
  - Quantity.

Response:

```json
{
  "period": {
    "start": "2026-03-29",
    "end": "2026-04-27",
    "label": "Last 30 days"
  },
  "pond_cards": [
    {
      "pond_id": "pond-1",
      "pond_name": "Bucket 1",
      "status": "active",
      "fish_species": "Lele",
      "current_stock_count": 745,
      "biomass_kg": 108.0,
      "avg_weight_g": 145
    }
  ],
  "filters": {
    "ponds": [
      {
        "pond_id": "all",
        "pond_name": "All Ponds"
      },
      {
        "pond_id": "pond-1",
        "pond_name": "Bucket 1"
      }
    ],
    "types": [
      { "value": "all", "label": "All" },
      { "value": "in", "label": "In" },
      { "value": "sold", "label": "Sold" },
      { "value": "died", "label": "Died" },
      { "value": "transfer", "label": "Transfer" }
    ]
  },
  "items": [
    {
      "movement_id": "mv-3",
      "date": "2026-04-13",
      "pond_id": "pond-1",
      "pond_name": "Bucket 1",
      "cycle_id": "cycle-101",
      "cycle_name": "Cycle 101",
      "fish_species": "Lele",
      "movement_type": "sold",
      "movement_label": "Sold",
      "direction": "out",
      "count": 180,
      "weight_kg": 5.8,
      "description": "Batch 1",
      "created_at": "2026-04-13T08:00:00Z",
      "can_delete": false
    }
  ],
  "next_cursor": "cursor_abc"
}
```

## 5. Cash Summary

`GET /api/v1/cash_summary`

Query params:

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `month` | string | yes | Format `YYYY-MM`. Month control source of truth. |

Frontend needs:

- Month control period.
- Balance summary.
- Balance over time line chart.
- Tooltip with date, balance, income, outcome, net.

Response:

```json
{
  "month": "2026-04",
  "period": {
    "start": "2026-04-01",
    "end": "2026-04-30",
    "label": "01 Apr - 30 Apr",
    "is_current_month": true
  },
  "summary": {
    "opening_balance_rp": 0,
    "ending_balance_rp": 669100,
    "income_rp": 994100,
    "outcome_rp": 325000,
    "net_rp": 669100
  },
  "balance_points": [
    {
      "date": "2026-04-13",
      "balance_rp": 127600,
      "income_rp": 127600,
      "outcome_rp": 0,
      "net_rp": 127600
    }
  ]
}
```

## 6. Cash Transactions

`GET /api/v1/cash_transactions`

Query params:

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `month` | string | yes | Format `YYYY-MM`. |
| `type` | string | no | `Masuk`, `Keluar`, or omit for all. |
| `category_id` | string | no | Optional category ID filter. |
| `limit` | number | no | Defaults to `20`. Mobile can request `7`. |
| `cursor` | string | no | For load more. |

Frontend needs:

- Desktop table.
- Mobile cards, 7 visible at a time.
- Tap mobile row to open delete confirmation.
- Transaction delete confirmation.

Response:

```json
{
  "month": "2026-04",
  "items": [
    {
      "transaction_id": "cash-1",
      "date": "2026-04-13",
      "type": "Masuk",
      "category_id": "cash-cat-sales",
      "category_name": "Penjualan",
      "description": "Penjualan Batch 1 | Note: Buyer A",
      "amount_rp": 127600,
      "cycle_id": "cycle-101",
      "source_sale_id": "sale-1",
      "created_by": {
        "profile_id": "profile-owner",
        "name": "R Pang"
      },
      "can_delete": false
    }
  ],
  "next_cursor": "cursor_def"
}
```

## 7. Cash Categories

`GET /api/v1/cash_categories`

Query params:

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `type` | string | no | `Masuk` or `Keluar`. Omit to return all categories. |

Frontend needs:

- Add Transaction modal category picker.
- Category display in cash ledger.
- Category ID submission to `kas.category_id`.

Response:

```json
{
  "items": [
    {
      "category_id": "cash-cat-feed",
      "type": "Keluar",
      "name": "Pakan",
      "sort_order": 1
    },
    {
      "category_id": "cash-cat-sales",
      "type": "Masuk",
      "name": "Penjualan",
      "sort_order": 1
    }
  ]
}
```

## V1 Mutations Needed Soon

These are not part of the requested read contract, but the current UI already needs them for full backend wiring:

| UI Action | Suggested Endpoint |
| --- | --- |
| Add daily log | `POST /api/v1/daily_logs` |
| Update daily log | `PATCH /api/v1/daily_logs/:log_id` |
| Delete daily log | `DELETE /api/v1/daily_logs/:log_id` |
| Add/update stock movement | `POST /api/v1/stock_movements` |
| Delete stock movement | `DELETE /api/v1/stock_movements/:movement_id` |
| Add cash transaction | `POST /api/v1/cash_transactions` |
| Delete cash transaction | `DELETE /api/v1/cash_transactions/:transaction_id` |

Mutation payload cleanup notes:

- Daily log payload should use `description`; do not send `water_condition`.
- Stock movement payload should use `description`; do not send `notes`.
- Cash transaction payload should use `category_id` and `description`; do not send raw `category` or `notes`.
