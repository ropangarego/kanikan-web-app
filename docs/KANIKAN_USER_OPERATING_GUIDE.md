# KANIKAN User Operating Guide

Last updated: 2026-05-02
Audience: owner, operator, and daily system user

## 1. What KANIKAN Is

KANIKAN helps manage fish farm operations:

- See farm condition from the dashboard.
- Manage ponds and active cycles.
- Record daily logs.
- Record stock changes.
- Track cash in and cash out.
- Check items that need attention.
- Switch language and profile settings.

## 2. Login

Open the web-app and login with the email/password registered in Supabase.

If login fails:

- Check email/password.
- Check internet connection.
- Ask the system maintainer to verify your Supabase user and profile.

## 3. Dashboard

The dashboard shows the most important condition first:

- Running ponds.
- Stock and survival indicators.
- Cash snapshot.
- Attention items.
- Growth overview.

The attention box only shows a few priority items. Use **See more** to open the full Attention page.

## 4. Ponds

Use **Info Kolam / Ponds** to manage pond operations.

Main actions:

- Add pond.
- Select pond.
- Start new cycle for an empty pond.
- Add daily log.
- Update stock.
- Transfer cycle.
- Close cycle.

If a pond is empty, the page will not show active-cycle metrics.

## 5. Start Cycle

Use this when new fish are stocked into a pond.

Required data:

- Start date.
- Fish type.
- Initial stock.

Optional but recommended:

- Seed weight.
- Target weight.
- Capital.
- Description.

One pond can only have one running cycle.

## 6. Daily Log

Daily logs record operational notes for the current active cycle.

Common fields:

- Date.
- Feed.
- Note.
- Action.
- Sample weight.
- Sample count.

Sample weight is useful because it powers growth charts and harvest estimation.

## 7. Stock Movement

Stock movement is the main stock ledger.

Use it for:

- Stock in.
- Death.
- Transfer.
- Adjustment.

Important:

- Stock totals are calculated from this ledger.
- Do not use old fish inventory data as the main reference.

## 8. Transfer Cycle

Use transfer when fish move from one pond/container to another.

The target pond should be empty.

The system keeps transfer context so the history can be audited later.

## 9. Close Cycle

Use close cycle when the cycle is finished or needs to be manually closed.

Close cycle requires:

- Close date.
- Reason.
- Danger confirmation.

This is intentional because closing a cycle changes operational history.

## 10. Cash Ledger

Use **Saldo & Kas / Cash** to track money.

Rules:

- Amount must be greater than 0.
- Choose cash type: in or out.
- Choose category.
- Description is optional.

Owner can edit/delete according to access rules. Some generated records may be protected.

## 11. Settings

Settings can update:

- Language: Indonesian or English.
- Telegram ID.
- Tutorial mode.
- Dark mode.

If language is changed, the app should update and keep the choice across pages.

## 12. Good Daily Habit

Recommended daily flow:

```text
1. Login.
2. Open Dashboard.
3. Check Attention.
4. Open each running pond if needed.
5. Add daily log.
6. Record stock changes if any.
7. Record cash transaction if any.
8. Check that toast notification says save/update succeeded.
```

## 13. If Something Looks Wrong

Try:

- Refresh the browser.
- Check selected pond/filter.
- Check internet connection.
- Logout and login again.
- Contact the maintainer if data still looks wrong.

Do not repeatedly submit the same form if the app shows a connection error.

