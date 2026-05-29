# DirectPay Integration — Implementation Analysis

> **API Doc version:** IPG V3 — v1.0.4 (15 Jul 2022)  
> **Analysis date:** 2026-05-22  
> **Branch:** `feature/direct-pay-integration`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture & File Map](#2-architecture--file-map)
3. [Database Schema](#3-database-schema)
4. [Current Payment Flow](#4-current-payment-flow)
5. [Backend Endpoint Inventory](#5-backend-endpoint-inventory)
6. [API Contract vs Implementation](#6-api-contract-vs-implementation)
7. [Security Model](#7-security-model)
8. [Issues & Gaps](#8-issues--gaps)
9. [Dead Code](#9-dead-code)
10. [What Is NOT Yet Implemented](#10-what-is-not-yet-implemented)

---

## 1. Overview

DirectPay is Sri Lanka's payment gateway used to offer LKR-denominated subscriptions to Sri Lankan users. The integration uses DirectPay's IPG V3 tokenization API to:

1. Add and tokenize a user's card via a hosted checkout page
2. Charge the initial subscription payment at card-add time (`do_initial_payment: 1`)
3. Store the `wallet_id` and `card_id` locally for future recurring charges
4. Charge stored cards for subsequent billing cycles via `/cardPay`

The LKR billing path is separate from the existing Paddle (USD) billing path. Region detection (IP geolocation → timezone fallback) decides which pricing modal the user sees.

---

## 2. Architecture & File Map

```
worklenz-backend/
├── src/
│   ├── controllers/billing-controller.ts       ← All DirectPay + Paddle logic
│   ├── routes/apis/billing-api-router.ts       ← Route definitions
│   ├── app.ts                                  ← Webhook route (outside auth/CSRF)
│   └── keys/
│       ├── PRIVATE_KEY_DEV.pem                 ← RSA key for old CARD_PAY flow (legacy)
│       └── PRIVATE_KEY_PROD.pem
├── database/migrations/
│   └── 20260508000001-add-directpay-tokenized-card-billing.sql
└── database/pg-migrations/
    └── 1774000001000_add_directpay_tokenized_card_billing.js

worklenz-frontend/src/
├── components/admin-center/billing/drawers/upgrade-plans-lkr/
│   ├── upgrade-plans-lkr.tsx                  ← Pricing UI + checkout trigger
│   ├── DirectPayModal.tsx                      ← Iframe modal (UNUSED in current flow)
│   └── direct-pay-helper.ts                   ← SDK/popup helpers (UNUSED in current flow)
└── api/admin-center/billing.api.service.ts    ← All billing API calls
```

### Environment Variables (backend)

| Variable | Purpose |
|---|---|
| `DP_URL` | Legacy: generic DirectPay URL (old CARD_PAY flow) |
| `DP_MERCHANT_ID` | DirectPay merchant identifier |
| `DP_SECRET_KEY` | HMAC-SHA256 signing secret |
| `DP_API_KEY` | Legacy API key header (old flow only) |
| `DP_STAGE` | `"PROD"` or anything else → uses test gateway |
| `DP_REFERENCE` | Legacy reference for old `getCardList` endpoint |
| `FRONTEND_URL` | Used to construct `return_url` in session payload |
| `BACKEND_URL` | Used to construct `response_url` (webhook) in session payload |
| `PORT` | Fallback if `BACKEND_URL` is not set |

---

## 3. Database Schema

### `licensing_directpay_cards`
Stores tokenized card metadata per user. No PAN or CVV stored.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | Acts as owner_id in practice |
| `card_id` | TEXT | DirectPay's card token |
| `card_number_masked` | TEXT | e.g. `512345xxxxxx8008` |
| `card_brand` | TEXT | VISA, MASTERCARD, etc. |
| `card_type` | TEXT | CREDIT / DEBIT |
| `expiry_month` | TEXT | |
| `expiry_year` | TEXT | |
| `wallet_id` | TEXT | DirectPay wallet identifier |
| `is_default` | BOOLEAN | |
| `is_active` | BOOLEAN | Set true on add; **never set false on delete** (bug) |
| `last_used_at` | TIMESTAMPTZ | |
| UNIQUE | `(user_id, card_id)` | Prevents duplicate card rows |

### `licensing_directpay_sessions`
One row per `create-session` API call. Tracks the full lifecycle of a card-add attempt.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `order_id` | TEXT UNIQUE | `WL_CARD__{userId}__{ownerId}__{ms}` |
| `user_id` | UUID FK | |
| `owner_id` | UUID FK | |
| `amount` | NUMERIC | |
| `currency` | VARCHAR(5) | Always `LKR` |
| `status` | TEXT | `pending` → `SUCCESS` / `FAILED` |
| `request_payload` | JSONB | Full payload sent to DirectPay |
| `directpay_response` | JSONB | Full webhook/response body received |
| `card_db_id` | UUID FK → licensing_directpay_cards | Populated after webhook |
| `payment_id` | UUID FK → licensing_lkr_payments | Populated after webhook |
| `processed_at` | TIMESTAMPTZ | |

### `licensing_lkr_payments`
One row per payment event (initial charge or recurring).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` / `owner_id` | UUID FK | |
| `status` | TEXT | |
| `card_id` | TEXT | DirectPay card token |
| `card_number` | TEXT | Masked |
| `wallet_id` | TEXT | |
| `transaction_id` | TEXT | DirectPay transaction ID |
| `transaction_status` | TEXT | SUCCESS / FAILED |
| `transaction_amount` / `amount` | NUMERIC | Both columns store same value |
| `order_id` | TEXT | Links back to session |
| `subscription_id` | UUID FK → licensing_custom_subs | |
| `payment_type` | TEXT | `initial` (recurring not yet used) |

### `licensing_custom_subs` (extended columns)
| New Column | Purpose |
|---|---|
| `payment_gateway_id` | FK to `licensing_payment_gateways` |
| `plan_tier_id` | FK to `licensing_custom_plan_pricing` |
| `status` | `pending` / `active` / `paused` / `cancelled` / `past_due` / `expired` / `suspended` / `cancelling` |
| `card_id` | FK to `licensing_directpay_cards` (which card is on file) |
| `next_billing_date` | For recurring charge scheduler |
| `last_payment_date` | |
| `auto_renew` | |
| `retry_count` / `last_retry_at` / `next_retry_date` | Failed payment retry tracking |
| `grace_period_ends` | |

### `licensing_payment_attempts`
Intended for recurring billing retry tracking. Not populated by any current code path.

### `licensing_custom_plan_pricing`
LKR pricing tiers seeded separately. The backend reads `tier_name IN ('pro', 'business')` with `currency = 'LKR'`.

---

## 4. Current Payment Flow

### 4.1 Card Add + Initial Charge (implemented)

```
User → "Upgrade Now" button
  │
  ├─ Frontend: upgrade-plans-lkr.tsx
  │   └─ Reads proAnnualPrice or businessAnnualPrice from DB
  │   └─ Calls billingApiService.createCardAddSession(amount, doInitialPayment=true)
  │
  ├─ Backend: POST /billing/directpay/create-card-session
  │   ├─ Builds CARD_ADD payload:
  │   │     merchant_id, amount (as "X.XX"), source: "worklenz-app",
  │   │     type: "CARD_ADD", order_id: WL_CARD__{userId}__{ownerId}__{ms},
  │   │     currency: "LKR", response_url, return_url,
  │   │     first_name, email, description, logo, do_initial_payment: "1"
  │   │     ⚠ phone: always omitted
  │   ├─ Encodes: Buffer.from(JSON.stringify(payload)).toString("base64")
  │   ├─ Signs:   HMAC-SHA256(base64Payload, DP_SECRET_KEY) → "hmac {hex}"
  │   ├─ POST to DirectPay /api/v3/create-session
  │   │     Content-Type: text/plain
  │   │     Authorization: hmac {hex}
  │   │     Body: base64EncodedPayload
  │   ├─ Saves session row (status: pending)
  │   └─ Returns { sessionData, stage, orderId }
  │
  ├─ Frontend extracts sessionData.data.link (or .link / .redirect_url / .url)
  │   └─ window.location.href = paymentUrl  ← full-page redirect
  │
  ├─ User fills card details on DirectPay hosted page
  │   └─ DirectPay processes card + charges initial amount
  │
  ├─ DirectPay → POST /webhook/directpay/card-response  (backend, no auth/CSRF)
  │   ├─ Reads rawBody (captured in Express verify callback)
  │   ├─ Verifies HMAC signature from Authorization header
  │   ├─ Normalizes response (walletId, cardId, transaction, status)
  │   ├─ Upserts licensing_directpay_cards
  │   ├─ Inserts/updates licensing_lkr_payments
  │   ├─ If SUCCESS: updates licensing_custom_subs (status: active, card_id, last_payment_date)
  │   └─ Updates licensing_directpay_sessions (status, processed_at)
  │
  └─ DirectPay redirects browser to return_url
      └─ /worklenz/admin-center/billing
          ⚠ No handler reads URL params — user sees no confirmation
```

### 4.2 Card Charge for Recurring Billing (partially scaffolded, not operational)

```
Backend scheduler (NOT YET IMPLEMENTED) → calls payWithCard endpoint
  │
  ├─ Backend: POST /billing/directpay/pay-with-card
  │   ├─ Builds cardPay payload: merchant_id, wallet_id, card_id, order_id, currency, amount
  │   ├─ Signs with HMAC (using CryptoJS — different lib from create-session)
  │   ├─ POST to DirectPay /api/v3/cardPay
  │   │     Content-Type: application/json
  │   └─ Returns raw DirectPay response
  │       ⚠ Does NOT record payment in licensing_lkr_payments
  │       ⚠ Does NOT update subscription status
  │       ⚠ No server-side webhook for cardPay result
```

---

## 5. Backend Endpoint Inventory

### Active (new tokenization flow)

| Method | Path | Handler | Notes |
|---|---|---|---|
| POST | `/billing/directpay/create-card-session` | `createCardAddSession` | Creates DirectPay session, stores pending session row |
| GET | `/billing/directpay/list-cards` | `listCards` | Proxies to DirectPay `/listCard` |
| POST | `/billing/directpay/delete-card` | `deleteCard` | Proxies to DirectPay `/deleteCard`; **does not update local DB** |
| POST | `/billing/directpay/pay-with-card` | `payWithCard` | Proxies to DirectPay `/cardPay`; **does not persist result** |
| POST | `/billing/directpay/save-card-response` | `saveDirectPayCardResponse` | Authenticated fallback; saves card data from browser postMessage |
| POST | `/webhook/directpay/card-response` | `handleCardAddResponse` | Unauthenticated webhook from DirectPay; source of truth |

### Active (legacy / miscellaneous)

| Method | Path | Handler | Notes |
|---|---|---|---|
| GET | `/billing/get-direct-pay-data` | `getDirectPayObject` | **Old flow** — returns HMAC-signed payload for client-side DirectPay SDK; hardcoded `amount: 10`, `type: "RECURRING"` |
| POST | `/billing/save-transaction-data` | `saveTransactionData` | **Old flow** — saves card data sent from frontend + fire-and-forgets a charge via RSA-signed CARD_PAY; `amount` variable computed but never used (always charges 10) |
| GET | `/billing/get-card-list` | `getCardList` | **Old flow** — RSA-signed list using `DP_REFERENCE` env var |
| GET | `/billing/check-region` | `checkRegion` | IP geolocation via ip-api.com |
| GET | `/billing/lkr-pricing` | `getLkrPricing` | Reads `licensing_custom_plan_pricing` |
| GET | `/billing/pricing-plans` | `getPricingPlans` | Paddle-based tiers |
| GET | `/billing/contact-us` | `contactUs` | Sends email on contact form submit |

---

## 6. API Contract vs Implementation

### 6.1 CARD_ADD (create-session)

| Field | Docs | Implementation | Status |
|---|---|---|---|
| `merchant_id` | String | `DP_MERCHANT_ID` | ✅ |
| `amount` | String e.g. `"10.00"` | `checkoutAmount.toFixed(2)` | ✅ |
| `source` | String | `"worklenz-app"` (docs show `"custom-plugin"`) | ⚠ Custom value — confirm with DirectPay |
| `type` | `CARD_ADD` | `"CARD_ADD"` | ✅ |
| `order_id` | Unique string | `WL_CARD__{userId}__{ownerId}__{Date.now()}` | ✅ |
| `currency` | `LKR` / `USD` | `"LKR"` | ✅ |
| `response_url` | Server POST callback | `${BACKEND_URL}/webhook/directpay/card-response` | ✅ |
| `return_url` | Browser redirect | `${FRONTEND_URL}/worklenz/admin-center/billing` | ✅ |
| `first_name` | String | Split from user.name | ✅ |
| `last_name` | String | Split from user.name (optional) | ✅ |
| `phone` | String | **Always null / omitted** | ❌ |
| `email` | String | `user.email` | ✅ |
| `description` | String | `"Worklenz - Add Payment Method"` | ✅ |
| `logo` | String | `https://app.worklenz.com/assets/icons/icon-96x96.png` | ✅ |
| `do_initial_payment` | `"0"` / `"1"` | `doInitialPayment ? "1" : "0"` | ✅ |
| Content-Type | `text/plain` | `text/plain` | ✅ |
| Authorization | `hmac {hex}` | `hmac {hex}` | ✅ |

### 6.2 listCard

| Field | Docs | Implementation | Status |
|---|---|---|---|
| `merchant_id` | String | `DP_MERCHANT_ID` | ✅ |
| `wallet_id` | String | From query param | ✅ |
| `sub_merchant_id` | String (optional) | Not sent | ⚠ Optional, likely fine |
| Content-Type | `application/json` | `application/json` | ✅ |
| Encoding | base64(json) | CryptoJS base64(json) | ✅ |

### 6.3 deleteCard

| Field | Docs | Implementation | Status |
|---|---|---|---|
| `merchant_id` | String | `DP_MERCHANT_ID` | ✅ |
| `card_id` | String | From request body | ✅ |
| Content-Type | `application/json` | `application/json` | ✅ |

### 6.4 cardPay (pay-with-card)

| Field | Docs | Implementation | Status |
|---|---|---|---|
| `merchant_id` | String | `DP_MERCHANT_ID` | ✅ |
| `wallet_id` | String | From request body | ✅ |
| `card_id` | String | From request body | ✅ |
| `order_id` | Unique string | From request body | ✅ (caller must generate) |
| `currency` | String | `currency \|\| "LKR"` | ✅ |
| `amount` | String | `String(amount)` | ✅ |
| `promotion_apply_amount` | String (optional) | Not sent | ⚠ Optional |
| `apply_gateway_promotion` | Int (optional) | Not sent | ⚠ Optional |
| `sub_merchant_id` | String (optional) | Not sent | ⚠ Optional |
| Content-Type | `application/json` | `application/json` | ✅ |

### 6.5 Webhook Response Validation

| Step | Docs | Implementation | Status |
|---|---|---|---|
| Read raw body | `file_get_contents('php://input')` | `req.rawBody` (set via Express verify callback) | ✅ |
| Read authorization | `$_SERVER['HTTP_AUTHORIZATION']` | `req.headers.authorization` | ✅ |
| Split scheme | `explode(' ', $signature)` | `signature.split(" ")` | ✅ |
| Verify scheme = "hmac" | Yes | Yes | ✅ |
| Compute HMAC over raw body | `hash_hmac('sha256', $requestBody, $secret)` | `crypto.createHmac("sha256", secret).update(rawPayload)` | ✅ |
| Timing-safe compare | Not specified | `crypto.timingSafeEqual` | ✅ (better than docs) |

---

## 7. Security Model

- **Outbound requests (create-session):** Base64-encoded JSON body + `hmac {hex}` in Authorization header. Uses Node `crypto` module.
- **Outbound requests (listCard / deleteCard / cardPay):** Same scheme but uses `CryptoJS` library (produces identical output).
- **Inbound webhook:** HMAC verification over raw body. `rawBody` captured via Express's `json()` verify callback only for `/webhook/directpay/` paths. Webhook route is mounted before session middleware — no auth/CSRF.
- **No CVV storage.** Card numbers stored masked only (6+last4).
- **RSA signing (legacy only):** `PRIVATE_KEY_DEV.pem` / `PRIVATE_KEY_PROD.pem` used in old `saveTransactionData` for a `CARD_PAY` call. Not used in the new tokenization flow.
- **Region check:** Uses `ip-api.com` free tier (45 req/min). Falls back to timezone detection if IP lookup fails or returns private IP.

---

## 8. Issues & Gaps

### Critical

#### C1 — Phone number always omitted (wallet identity broken)
**File:** [billing-controller.ts:801-803](../worklenz-backend/src/controllers/billing-controller.ts)  
**Problem:** The docs state the wallet is created using **phone + email**. `phone` is hardcoded to `null` and never sent. If DirectPay's wallet lookup uses the phone, cards added by the same user in different sessions may not be found under the same wallet, or the initial wallet creation may fail silently for gateways that require phone.  
**Fix:** Add a `phone` field to the user session/profile and populate it. At minimum, confirm with DirectPay whether phone is optional for wallet creation.

---

#### C2 — Always charges annual price regardless of selected billing period
**File:** [upgrade-plans-lkr.tsx:228-231](../worklenz-frontend/src/components/admin-center/billing/drawers/upgrade-plans-lkr/upgrade-plans-lkr.tsx)  
**Problem:** `amount` is always set to `proAnnualPrice` or `businessAnnualPrice`. The UI displays `/month` pricing in the card but the user is charged the full annual amount on their card. There is no monthly billing option despite the UI implying it.  
**Fix:** Clarify the intended billing model. If annual-only, remove the `/month` display and add a clear annual total label. If monthly should be supported, wire the billing period toggle to the amount.

---

#### C3 — No return URL handler — user receives no confirmation
**File:** [upgrade-plans-lkr.tsx](../worklenz-frontend/src/components/admin-center/billing/drawers/upgrade-plans-lkr/upgrade-plans-lkr.tsx)  
**Problem:** After DirectPay redirects back to `/worklenz/admin-center/billing`, query params like `?status=SUCCESS&trnId=xxx&orderId=xxx` are appended but nothing reads them. The user lands on a blank billing page with no success/error message. The subscription may already be active (webhook fired), but the user has no indication.  
**Fix:** In the billing page component, read URL params on mount and show a toast/banner based on `status`. Optionally poll the backend for subscription status using the `orderId`.

---

#### C4 — `deleteCard` does not mark card inactive in local DB
**File:** [billing-controller.ts:972-1012](../worklenz-backend/src/controllers/billing-controller.ts)  
**Problem:** The endpoint calls DirectPay's `deleteCard` API but never updates `licensing_directpay_cards.is_active`. The card appears valid in Worklenz even after deletion at DirectPay. Any subsequent charge attempt against that `card_id` will fail at DirectPay.  
**Fix:** After a successful DirectPay deleteCard response, `UPDATE licensing_directpay_cards SET is_active = false WHERE card_id = $1`.

---

#### C5 — `payWithCard` does not persist payment result or update subscription
**File:** [billing-controller.ts:1018-1064](../worklenz-backend/src/controllers/billing-controller.ts)  
**Problem:** This endpoint is a pure proxy — it forwards to DirectPay `/cardPay` and returns the raw response. No record is inserted into `licensing_lkr_payments`, and `licensing_custom_subs` is never updated. If this is used for recurring billing, all those payments are invisible to Worklenz.  
**Fix:** After receiving a successful cardPay response, insert into `licensing_lkr_payments` and update `last_payment_date` / `next_billing_date` on the subscription.

---

#### C6 — 3DS flow (`CARD_TOKEN_PAYMENT`) not implemented
**Problem:** The docs describe a `CARD_TOKEN_PAYMENT` type that goes through the DirectPay hosted page and handles 3DS authentication transparently. The current `payWithCard` calls `/cardPay` directly. Cards enrolled in 3DS will reject a direct server-to-server charge. The 3DS-compatible approach requires creating a session with `type: CARD_TOKEN_PAYMENT` (passing `wallet_id`, `card_id`, `cvv`), displaying the hosted page to the user, and handling the webhook result.  
**Fix:** Implement a `CARD_TOKEN_PAYMENT` session flow for payments that require user interaction (3DS). The raw `/cardPay` can remain for non-3DS cards or background retry attempts.

---

### High Severity

#### H1 — `DirectPayModal` and `openDirectPayPopup` are dead code
**Files:** [DirectPayModal.tsx](../worklenz-frontend/src/components/admin-center/billing/drawers/upgrade-plans-lkr/DirectPayModal.tsx), [direct-pay-helper.ts](../worklenz-frontend/src/components/admin-center/billing/drawers/upgrade-plans-lkr/direct-pay-helper.ts)  
**Problem:** The actual checkout is a `window.location.href` redirect. Neither the React Modal component nor the DOM-based popup helper is imported or called anywhere in the current flow. Both contain complex polling/postMessage logic that is completely bypassed.  
**Fix:** If the iframe approach is not planned for the near future, delete both files to avoid maintaining stale logic.

---

#### H2 — DirectPay SDK CDN always loads `/dev/` path
**File:** [direct-pay-helper.ts:39](../worklenz-frontend/src/components/admin-center/billing/drawers/upgrade-plans-lkr/direct-pay-helper.ts)  
**Problem:** `https://cdn.directpay.lk/dev/v1/directpayCardPayment.js` — the `/dev/` segment is hardcoded. The SDK is not used in the current flow (see H1), but if it were re-enabled, production builds would use the dev SDK.  
**Fix:** Use the `stage` prop to switch between dev and prod CDN paths.

---

#### H3 — Old endpoints still live with hardcoded `amount: 10` and fire-and-forget charge
**File:** [billing-controller.ts:127-129, 226](../worklenz-backend/src/controllers/billing-controller.ts)  
**Problem:**
- `getDirectPayObject` computes the correct amount from `getInitialCharge()` but the payload hardcodes `amount: 10`.
- `saveTransactionData` calls `chargeInitialPayment()` without `await`, so failures are silently lost.
- Routes `/billing/get-direct-pay-data` and `/billing/save-transaction-data` are still exposed.  
**Fix:** Remove or disable these routes if the old flow is fully replaced. At minimum, add an explicit deprecation guard.

---

#### H4 — Webhook `rawBody` is a single point of failure
**File:** [app.ts:45-53](../worklenz-backend/src/app.ts)  
**Problem:** `rawBody` is populated via the Express `json()` verify callback only for paths that include `/webhook/directpay/`. If the route changes or the body-parser configuration is altered, `rawBody` will be empty, HMAC verification will always fail, and DirectPay will retry indefinitely with no acknowledgement.  
**Note:** The current wiring is correct, but this fragility should be documented.

---

### Medium Severity

#### M1 — Two different crypto libraries for identical operations
**Problem:** `createCardAddSession` uses Node's built-in `crypto` module; `listCards`, `deleteCard`, and `payWithCard` use `CryptoJS`. Both compute the same HMAC-SHA256 and base64 encoding. The split library usage increases the maintenance surface with no benefit.  
**Fix:** Consolidate on Node `crypto` (already available without a dependency).

---

#### M2 — `data.token` checkout URL format not handled in component
**File:** [upgrade-plans-lkr.tsx:252-264](../worklenz-frontend/src/components/admin-center/billing/drawers/upgrade-plans-lkr/upgrade-plans-lkr.tsx)  
**Problem:** The frontend tries `sessionData.data.link → sessionData.link → sessionData.redirect_url → sessionData.url` but not `sessionData.data.token`. The `direct-pay-helper.ts` helper constructs the URL from a token (`${baseUrl}/${token}`). If DirectPay's API response changes format or returns a token instead of a link, the checkout silently fails.  
**Fix:** Add token-based URL construction: `if (sessionData?.data?.token) paymentUrl = \`${baseUrl}/${sessionData.data.token}\``.

---

#### M3 — `source` field value not confirmed with DirectPay
**File:** [billing-controller.ts:833](../worklenz-backend/src/controllers/billing-controller.ts)  
**Problem:** The payload sends `source: "worklenz-app"`. The docs show `source: "custom-plugin"`. DirectPay may validate this field or use it for reporting.  
**Fix:** Confirm the accepted values with DirectPay support.

---

#### M4 — `order_id` collision risk
**File:** [billing-controller.ts:484](../worklenz-backend/src/controllers/billing-controller.ts)  
**Problem:** `Date.now()` has millisecond resolution. Concurrent requests in the same millisecond (rare but possible under load) produce identical `order_id` values. DirectPay returns `"Order id already exist"` on collision.  
**Fix:** Append a short random suffix: `` `WL_CARD__${userId}__${ownerId}__${Date.now()}__${Math.random().toString(36).slice(2, 7)}` ``

---

### Low Severity

#### L1 — `transaction_amount` and `amount` columns store the same value
**File:** [billing-controller.ts:719, 738](../worklenz-backend/src/controllers/billing-controller.ts)  
Both columns receive `transactionAmount` in the same INSERT/UPDATE. The redundancy is harmless but increases confusion when querying.

---

#### L2 — `licensing_payment_attempts` table is never populated
The table was created for payment retry tracking but no code path inserts into it. It's a schema placeholder for future work.

---

## 9. Dead Code

| Item | Location | Notes |
|---|---|---|
| `DirectPayModal` component | `upgrade-plans-lkr/DirectPayModal.tsx` | Iframe modal, not used in current redirect flow |
| `openDirectPayPopup` function | `direct-pay-helper.ts` | DOM-based iframe overlay, not called anywhere |
| `initializeDirectPaySDK` function | `direct-pay-helper.ts` | DirectPay SDK wrapper, not called anywhere |
| `loadDirectPaySDK` function | `direct-pay-helper.ts` | SDK loader, not called anywhere |
| `getDirectPayObject` handler | `billing-controller.ts:116` | Old HMAC payload builder with hardcoded amount=10 |
| `saveTransactionData` handler | `billing-controller.ts:154` | Old flow with fire-and-forget RSA charge |
| `getCardList` handler | `billing-controller.ts:232` | Old RSA-signed list using `DP_REFERENCE` env var |
| `getDirectPayCheckout` in API service | `billing.api.service.ts:181` | Calls the old `get-direct-pay-data` endpoint |
| `chargeInitialPayment` method | `billing-controller.ts:62` | Fire-and-forget CARD_PAY, only called from saveTransactionData |
| RSA PEM key files | `src/keys/*.pem` | Only used by dead legacy endpoints |

---

## 10. What Is NOT Yet Implemented

| Feature | Notes |
|---|---|
| Return URL confirmation UI | After DirectPay redirect back, show payment status to user |
| Recurring billing scheduler | No cron/job to charge `licensing_directpay_cards` monthly |
| Payment result persistence for `/cardPay` | `payWithCard` is a passthrough only |
| Local DB cleanup on card delete | `is_active` never set to false |
| 3DS payment flow (`CARD_TOKEN_PAYMENT`) | Direct `/cardPay` bypasses 3DS |
| VOID transaction | DirectPay `/void-transaction` endpoint not implemented |
| REFUND transaction | DirectPay `/refund-transaction` endpoint not implemented |
| Transaction status check | DirectPay `/checkPaymentStatus` endpoint not implemented |
| `licensing_payment_attempts` population | Table exists but no inserts |
| Retry logic for failed payments | Schema supports it (`retry_count`, `grace_period_ends`) but no scheduler |
| Phone number collection | Required for wallet identity; currently always null |
| Monthly billing option | UI shows `/month` label but always charges annual amount |
