# Monetization MVP

This document describes the first monetization implementation in the bot.

## Subscription Tiers

- `free`
- `trial` (7 days, one-time)
- `premium` (time-limited)

## Free Tier Limits

- `50` transactions per month
- `10` voice inputs per day

When limits are exceeded, the bot shows an upgrade prompt (`/trial`, `/premium`).

## Premium/Trial Features in MVP

- Unlimited transactions
- Unlimited voice inputs
- `/chart` command access
- Bank statement import access

## User Commands

- `/premium` - show current plan and premium offer
- `/trial` - start one-time 7-day trial
- `/buy month|year|lifetime` - pay via Telegram Stars

## Admin Commands

Admin IDs are controlled by `ADMIN_USERS` env var.

- `/admin_stats` - monetization + basic observability counters
- `/admin_sub <userId> <free|trial|premium> [days]` - update user subscription
- `/admin_payment <userId> <amount> <currency> <provider> <reference>` - record payment and grant premium days

### Example

```text
/admin_sub 123456 premium 30
/admin_payment 123456 299 USD stars tg_charge_001
```

## Admin HTTP API

Protected by `x-admin-token: <ADMIN_API_TOKEN>` header (or `?token=` query for quick checks).

- `GET /admin/monetization` - aggregated stats + recent user subscription records
- `GET /admin/ui` - lightweight admin page (append `?token=...`)
- `POST /admin/subscription` - set user tier
- `POST /admin/payment` - record payment + grant premium

Examples:

```bash
curl -H "x-admin-token: $ADMIN_API_TOKEN" \
  http://127.0.0.1:3005/admin/monetization

curl -X POST -H "Content-Type: application/json" \
  -H "x-admin-token: $ADMIN_API_TOKEN" \
  -d '{"userId":"123","tier":"premium","days":30}' \
  http://127.0.0.1:3005/admin/subscription
```

## Data Model

Added fields on `users`:

- `subscriptionTier`
- `premiumExpiresAt`
- `trialStartedAt`
- `trialExpiresAt`
- `trialUsed`
- `transactionsThisMonth`, `transactionsMonthKey`
- `voiceInputsToday`, `voiceDayKey`
- `lastPaymentAt`, `lastPaymentProvider`, `lastPaymentReference`

## Notes

- In `NODE_ENV=test`, usage consumption is bypassed to keep tests deterministic.
- Production behavior enforces limits and subscription state transitions.

## Telegram Stars Flow

1. User triggers `/buy month|year|lifetime`.
2. Bot sends Telegram invoice (`currency: XTR`).
3. Bot handles `pre_checkout_query` and confirms it.
4. Bot handles `successful_payment` in `message`.
5. Premium is activated automatically by invoice payload plan.
