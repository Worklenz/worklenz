# DirectPay Payment Gateway Integration Plan

> **Note**: All code snippets in this document are sample code for illustration purposes. Actual implementation may differ based on evolving requirements, code reviews, and technical constraints discovered during development.

## Overview

Implement DirectPay payment gateway for Sri Lankan users with automated recurring subscriptions, matching Paddle's functionality. Enable admin-controlled migration of existing custom plan users while preserving their custom pricing.

## Requirements Summary

- **Priority**: Full automation for new and existing users
- **Migration Strategy**: Admin-controlled (manual, one-by-one migration)
- **Pricing Model**: Fixed LKR pricing for new users, preserve custom rates for existing users
- **DirectPay Capabilities**: Full recurring support with webhooks and subscription management APIs

---

## Phase 1: Database Schema & Foundation

### New Tables

#### 1. `licensing_payment_gateways` - Gateway Configuration

Centralized table to manage all payment gateway configurations.

```sql
CREATE TABLE licensing_payment_gateways (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,              -- 'paddle', 'directpay', 'manual'
    display_name TEXT NOT NULL,             -- User-facing name
    is_active BOOLEAN DEFAULT true,
    supports_recurring BOOLEAN DEFAULT true,
    supported_currencies TEXT[],            -- ['USD'], ['LKR'], etc.
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Initial data
INSERT INTO licensing_payment_gateways (name, display_name, supported_currencies, supports_recurring) VALUES
('paddle', 'Paddle', ARRAY['USD'], true),
('directpay', 'DirectPay', ARRAY['LKR'], true),
('manual', 'Manual/Admin', ARRAY['LKR', 'USD'], false);
```

**Purpose**: Enables multi-gateway support and easy addition of future payment providers.

#### 2. `licensing_directpay_cards` - Saved Payment Methods

Stores tokenized card information for recurring payments.

```sql
CREATE TABLE licensing_directpay_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id TEXT NOT NULL,                  -- DirectPay card token
    card_number_masked TEXT NOT NULL,       -- Last 4 digits only (e.g., "**** 4242")
    card_brand TEXT,                        -- Visa, Mastercard, etc.
    card_type TEXT,                         -- Credit, Debit
    expiry_month TEXT,
    expiry_year TEXT,
    wallet_id TEXT,                         -- DirectPay wallet reference
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMPTZ,
    UNIQUE(user_id, card_id)
);

CREATE INDEX idx_directpay_cards_user_id ON licensing_directpay_cards(user_id);
CREATE INDEX idx_directpay_cards_active_default ON licensing_directpay_cards(user_id, is_active, is_default);
```

**Security Note**: Only store tokenized card references, never raw card numbers.

#### 3. `licensing_directpay_webhooks` - Webhook Event Log

Tracks all webhook events for debugging, auditing, and idempotency.

```sql
CREATE TABLE licensing_directpay_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id TEXT UNIQUE,                   -- DirectPay event ID for idempotency
    event_type TEXT NOT NULL,               -- PAYMENT_SUCCESS, PAYMENT_FAILED, etc.
    user_id UUID REFERENCES users(id),
    subscription_id UUID REFERENCES licensing_custom_subs(id),
    payment_id UUID,
    payload JSONB NOT NULL,                 -- Full webhook payload
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_directpay_webhooks_event_id ON licensing_directpay_webhooks(event_id);
CREATE INDEX idx_directpay_webhooks_processed ON licensing_directpay_webhooks(processed, created_at);
```

**Purpose**: Prevents duplicate processing of webhook events and provides audit trail.

#### 4. `licensing_custom_plan_pricing` - Fixed LKR Pricing Tiers

Defines standard pricing tiers for new LKR subscribers.

```sql
CREATE TABLE licensing_custom_plan_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tier_name TEXT NOT NULL,                -- 'pro', 'business', 'enterprise'
    tier_level INTEGER NOT NULL,            -- For sorting/comparison
    display_name TEXT NOT NULL,             -- "Pro Plan", "Business Plan"
    monthly_base_price NUMERIC(10,2) NOT NULL,
    annual_base_price NUMERIC(10,2) NOT NULL,
    currency TEXT DEFAULT 'LKR',
    included_users INTEGER NOT NULL,        -- Base user count
    max_users INTEGER,                      -- NULL for unlimited
    monthly_per_user_price NUMERIC(10,2),  -- Overage pricing
    annual_per_user_price NUMERIC(10,2),
    features JSONB,                         -- Feature flags
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Example: Seed standard tiers
INSERT INTO licensing_custom_plan_pricing (tier_name, tier_level, display_name, monthly_base_price, annual_base_price, included_users, max_users, monthly_per_user_price, annual_per_user_price, currency, features) VALUES
('pro', 1, 'Pro Plan', 75000, 840000, 15, 50, 1800, 20160, 'LKR', '{"unlimited_projects": true, "gantt_charts": true}'::jsonb),
('business', 2, 'Business Plan', 120000, 1320000, 20, 100, 1800, 20160, 'LKR', '{"unlimited_projects": true, "client_portal": true}'::jsonb),
('enterprise', 3, 'Enterprise Plan', 350000, 3850000, 100, NULL, NULL, NULL, 'LKR', '{"unlimited_projects": true, "sso": true, "priority_support": true}'::jsonb);
```

**Note**: Pricing values are examples and should be configured based on business requirements.

### Enhance Existing Tables

#### `licensing_custom_subs` - Add Recurring Subscription Support

```sql
ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS payment_gateway_id UUID REFERENCES licensing_payment_gateways(id);
ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS plan_tier_id UUID REFERENCES licensing_custom_plan_pricing(id);
ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'past_due', 'expired'));
ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS next_billing_date DATE;
ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS last_payment_date DATE;
ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT true;
ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS directpay_subscription_id TEXT;
ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS card_id UUID REFERENCES licensing_directpay_cards(id);
ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

CREATE INDEX idx_custom_subs_next_billing ON licensing_custom_subs(next_billing_date)
WHERE status = 'active' AND auto_renew = true;

CREATE INDEX idx_custom_subs_user_status ON licensing_custom_subs(user_id, status);
```

**Key Fields**:
- `plan_tier_id`: Links to fixed pricing (new users) - NULL for existing custom pricing
- `status`: Tracks subscription lifecycle
- `auto_renew`: Controls whether subscription auto-renews
- `directpay_subscription_id`: DirectPay's recurring subscription reference

#### `licensing_lkr_payments` - Enhanced Payment Tracking

```sql
ALTER TABLE licensing_lkr_payments ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES licensing_custom_subs(id);
ALTER TABLE licensing_lkr_payments ADD COLUMN IF NOT EXISTS billing_type TEXT DEFAULT 'month';
ALTER TABLE licensing_lkr_payments ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'initial' CHECK (payment_type IN ('initial', 'recurring'));
ALTER TABLE licensing_lkr_payments ADD COLUMN IF NOT EXISTS directpay_subscription_id TEXT;
ALTER TABLE licensing_lkr_payments ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE licensing_lkr_payments ADD COLUMN IF NOT EXISTS next_billing_date DATE;
```

**Purpose**: Links payments to subscriptions and distinguishes initial vs recurring charges.

#### `organizations` - Gateway Preference

```sql
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS preferred_payment_gateway_id UUID REFERENCES licensing_payment_gateways(id);

-- Set DirectPay as default for existing LKR users
UPDATE organizations
SET preferred_payment_gateway_id = (SELECT id FROM licensing_payment_gateways WHERE name = 'directpay')
WHERE is_lkr_billing = true;
```

**Migration File**: Create `/worklenz-backend/database/migrations/20250118000000-add-directpay-subscription-support.sql` with all schema changes.

---

## Phase 2: Backend Gateway Abstraction

### Gateway Abstraction Layer Design

Create a unified interface that abstracts payment gateway operations, making it easy to support multiple providers.

#### Base Payment Gateway Interface

**File**: `/worklenz-backend/src/services/payment-gateways/base-payment-gateway.ts`

```typescript
export interface ICheckoutParams {
  userId: string;
  planId: string;
  billingType: 'month' | 'year';
  quantity: number;
  currency: string;
  amount: number;
}

export interface ICheckoutResponse {
  checkoutUrl?: string;
  signature?: string;
  dataString?: string;
  stage?: string;
  sessionId?: string;
}

export interface IWebhookValidation {
  isValid: boolean;
  payload?: any;
  error?: string;
}

export abstract class BasePaymentGateway {
  protected config: any;
  protected gatewayName: string;

  constructor(config: any, gatewayName: string) {
    this.config = config;
    this.gatewayName = gatewayName;
  }

  // Core methods that all gateways must implement
  abstract generateCheckout(params: ICheckoutParams): Promise<ICheckoutResponse>;
  abstract processWebhook(payload: any, signature?: string): Promise<IWebhookValidation>;
  abstract cancelSubscription(subscriptionId: string, userId: string): Promise<boolean>;
  abstract updateSubscription(params: any): Promise<boolean>;
  abstract getSubscriptionStatus(subscriptionId: string): Promise<string>;
}
```

#### DirectPay Gateway Implementation

**File**: `/worklenz-backend/src/services/payment-gateways/directpay-gateway.ts`

```typescript
import { BasePaymentGateway, ICheckoutParams, ICheckoutResponse } from './base-payment-gateway';
import CryptoJS from 'crypto-js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import moment from 'moment';
import db from '../../config/db';

export class DirectPayGateway extends BasePaymentGateway {
  constructor() {
    super({
      apiKey: process.env.DP_API_KEY,
      merchantId: process.env.DP_MERCHANT_ID,
      secretKey: process.env.DP_SECRET_KEY,
      baseUrl: process.env.DP_URL,
      stage: process.env.DP_STAGE
    }, 'DirectPay');
  }

  async generateCheckout(params: ICheckoutParams): Promise<ICheckoutResponse> {
    // Fetch user details
    const userQuery = `SELECT name, email FROM users WHERE id = $1`;
    const userResult = await db.query(userQuery, [params.userId]);
    const user = userResult.rows[0];

    const uniqueTimestamp = moment().format('YYYYMMDDHHmmss');
    const orderId = `WORKLENZ_${user.email}_${uniqueTimestamp}`;

    // Build DirectPay recurring payment payload
    const payload = {
      merchant_id: this.config.merchantId,
      amount: params.amount,
      type: 'RECURRING',
      order_id: orderId,
      currency: params.currency,
      return_url: `${process.env.FRONTEND_URL}/billing/payment-success`,
      response_url: `${process.env.BACKEND_URL}/api/billing/directpay-webhook`,
      first_name: user.name,
      email: user.email,
      description: `Worklenz ${params.billingType === 'year' ? 'Annual' : 'Monthly'} Subscription`,
      page_type: 'IN_APP',
      start_date: moment().format('YYYY-MM-DD'),
      do_initial_payment: 1,
      interval: params.billingType === 'month' ? 1 : 12,
      interval_type: 'MONTH'
    };

    // Generate HMAC signature
    const encodePayload = CryptoJS.enc.Base64.stringify(
      CryptoJS.enc.Utf8.parse(JSON.stringify(payload))
    );
    const signature = CryptoJS.HmacSHA256(encodePayload, this.config.secretKey as string);

    return {
      signature: signature.toString(CryptoJS.enc.Hex),
      dataString: encodePayload,
      stage: this.config.stage
    };
  }

  async processWebhook(payload: any, signature?: string): Promise<any> {
    // Validate webhook signature
    const isValid = this.validateWebhookSignature(payload, signature);
    if (!isValid) {
      return { isValid: false, error: 'Invalid signature' };
    }

    // Process different event types
    const eventType = payload.event_type || payload.status;

    switch (eventType) {
      case 'PAYMENT_SUCCESS':
        await this.handlePaymentSuccess(payload);
        break;
      case 'PAYMENT_FAILED':
        await this.handlePaymentFailed(payload);
        break;
      case 'SUBSCRIPTION_CANCELLED':
        await this.handleSubscriptionCancelled(payload);
        break;
    }

    return { isValid: true, payload };
  }

  private async handlePaymentSuccess(payload: any): Promise<void> {
    // Find subscription by transaction reference
    const subscriptionQuery = `
      SELECT lcs.*, lp.user_id
      FROM licensing_custom_subs lcs
      JOIN licensing_lkr_payments lp ON lp.subscription_id = lcs.id
      WHERE lp.transaction_id = $1
      LIMIT 1
    `;
    const result = await db.query(subscriptionQuery, [payload.transaction_id]);
    const subscription = result.rows[0];

    // Calculate new end_date
    const currentEndDate = moment(subscription.end_date);
    const newEndDate = subscription.billing_type === 'month'
      ? currentEndDate.add(1, 'month')
      : currentEndDate.add(1, 'year');

    // Update subscription
    await db.query(`
      UPDATE licensing_custom_subs
      SET end_date = $1,
          last_payment_date = CURRENT_DATE,
          next_billing_date = $1,
          status = 'active'
      WHERE id = $2
    `, [newEndDate.format('YYYY-MM-DD'), subscription.id]);

    // Log recurring payment
    await this.logRecurringPayment(payload, subscription.id);
  }

  private async handlePaymentFailed(payload: any): Promise<void> {
    await db.query(`
      UPDATE licensing_custom_subs
      SET status = 'past_due'
      WHERE directpay_subscription_id = $1
    `, [payload.subscription_id]);
  }

  private validateWebhookSignature(payload: any, signature?: string): boolean {
    if (!signature) return false;

    const dataString = Object.values(payload).join('');
    const computedSignature = CryptoJS.HmacSHA256(dataString, this.config.secretKey as string)
      .toString(CryptoJS.enc.Hex);

    return computedSignature === signature;
  }

  async cancelSubscription(subscriptionId: string, userId: string): Promise<boolean> {
    // Call DirectPay API to cancel recurring subscription
    // Implementation depends on DirectPay's API specification
    return true;
  }

  // Additional methods...
}
```

**Note**: Code is illustrative. Actual DirectPay API calls depend on their API documentation.

#### Paddle Gateway Implementation

**File**: `/worklenz-backend/src/services/payment-gateways/paddle-gateway.ts`

```typescript
import { BasePaymentGateway } from './base-payment-gateway';
import { generatePayLinkRequest, cancelSubscription as cancelPaddleSubscription } from '../../shared/paddle-requests';

export class PaddleGateway extends BasePaymentGateway {
  constructor() {
    super({}, 'Paddle');
  }

  async generateCheckout(params: any): Promise<any> {
    const teamMemberData = {
      user_count: params.quantity.toString(),
      email: params.userId
    };

    const response = await generatePayLinkRequest(
      teamMemberData,
      params.planId,
      params.userId,
      params.userId
    );
    return response.body;
  }

  async processWebhook(payload: any): Promise<any> {
    // Paddle webhook validation (existing implementation)
    return { isValid: true, payload };
  }

  async cancelSubscription(subscriptionId: string, userId: string): Promise<boolean> {
    const result = await cancelPaddleSubscription(subscriptionId, userId);
    return result?.success || false;
  }

  // Other methods...
}
```

**Purpose**: Wraps existing Paddle code into gateway abstraction.

#### Gateway Factory

**File**: `/worklenz-backend/src/services/payment-gateways/gateway-factory.ts`

```typescript
import { BasePaymentGateway } from './base-payment-gateway';
import { PaddleGateway } from './paddle-gateway';
import { DirectPayGateway } from './directpay-gateway';
import db from '../../config/db';

export class PaymentGatewayFactory {
  private static instances: Map<string, BasePaymentGateway> = new Map();

  static async getGateway(gatewayName: string): Promise<BasePaymentGateway> {
    if (this.instances.has(gatewayName)) {
      return this.instances.get(gatewayName)!;
    }

    let gateway: BasePaymentGateway;

    switch (gatewayName.toLowerCase()) {
      case 'paddle':
        gateway = new PaddleGateway();
        break;
      case 'directpay':
        gateway = new DirectPayGateway();
        break;
      default:
        throw new Error(`Unsupported payment gateway: ${gatewayName}`);
    }

    this.instances.set(gatewayName, gateway);
    return gateway;
  }

  static async getGatewayForUser(userId: string): Promise<BasePaymentGateway> {
    // Determine gateway based on user's organization settings
    const query = `
      SELECT
        o.is_lkr_billing,
        o.country,
        pg.name as gateway_name
      FROM organizations o
      LEFT JOIN licensing_payment_gateways pg ON pg.id = o.preferred_payment_gateway_id
      WHERE o.user_id = $1
    `;

    const result = await db.query(query, [userId]);
    const org = result.rows[0];

    // Auto-detect if no explicit preference
    if (!org.gateway_name) {
      const countryQuery = `SELECT code FROM countries WHERE id = $1`;
      const countryResult = await db.query(countryQuery, [org.country]);
      const countryCode = countryResult.rows[0]?.code;

      if (org.is_lkr_billing || countryCode === 'LK') {
        return this.getGateway('directpay');
      }
      return this.getGateway('paddle');
    }

    return this.getGateway(org.gateway_name);
  }
}
```

**Benefits**:
- Single point of gateway selection logic
- Caches gateway instances for performance
- Auto-detects appropriate gateway for users

### Subscription Management Service

**File**: `/worklenz-backend/src/services/subscription-management-service.ts`

```typescript
import db from '../config/db';
import moment from 'moment';
import { PaymentGatewayFactory } from './payment-gateways/gateway-factory';

export class SubscriptionManagementService {
  /**
   * Create a new custom subscription via DirectPay
   */
  static async createCustomSubscription(
    userId: string,
    planTierId: string,
    billingType: 'month' | 'year',
    quantity: number,
    cardId?: string
  ) {
    // Get plan pricing
    const planQuery = `SELECT * FROM licensing_custom_plan_pricing WHERE id = $1`;
    const planResult = await db.query(planQuery, [planTierId]);
    const plan = planResult.rows[0];

    // Calculate amount
    const amount = this.calculateSubscriptionAmount(plan, billingType, quantity);

    // Get DirectPay gateway
    const gateway = await PaymentGatewayFactory.getGateway('directpay');

    // Generate checkout
    const checkoutData = await gateway.generateCheckout({
      userId,
      planId: planTierId,
      billingType,
      quantity,
      currency: 'LKR',
      amount
    });

    // Create subscription record (pending until payment)
    const subscriptionQuery = `
      INSERT INTO licensing_custom_subs (
        user_id, billing_type, currency, rate, end_date, user_limit,
        payment_gateway_id, plan_tier_id, status, card_id, auto_renew
      ) VALUES (
        $1, $2, 'LKR', $3,
        (CURRENT_DATE + INTERVAL '${billingType === 'month' ? '1 month' : '1 year'}'),
        $4,
        (SELECT id FROM licensing_payment_gateways WHERE name = 'directpay'),
        $5, 'pending', $6, true
      ) RETURNING id
    `;

    const subResult = await db.query(subscriptionQuery, [
      userId, billingType, amount, quantity, planTierId, cardId
    ]);

    return {
      success: true,
      subscriptionId: subResult.rows[0].id,
      checkoutData
    };
  }

  /**
   * Calculate subscription amount
   * - For new users: Use licensing_custom_plan_pricing
   * - For existing users: Use licensing_custom_subs.rate (preserve custom pricing)
   */
  private static calculateSubscriptionAmount(plan: any, billingType: 'month' | 'year', quantity: number): number {
    const basePrice = billingType === 'month'
      ? parseFloat(plan.monthly_base_price)
      : parseFloat(plan.annual_base_price);

    const includedUsers = parseInt(plan.included_users) || 0;

    if (quantity <= includedUsers) {
      return basePrice;
    }

    // Calculate overage
    const extraUsers = quantity - includedUsers;
    const perUserPrice = billingType === 'month'
      ? parseFloat(plan.monthly_per_user_price || 0)
      : parseFloat(plan.annual_per_user_price || 0);

    return basePrice + (extraUsers * perUserPrice);
  }

  /**
   * Extend subscription after successful payment
   */
  static async extendSubscription(subscriptionId: string, transactionId: string): Promise<boolean> {
    const query = `
      UPDATE licensing_custom_subs
      SET end_date = end_date +
        CASE
          WHEN billing_type = 'month' THEN INTERVAL '1 month'
          ELSE INTERVAL '1 year'
        END,
        last_payment_date = CURRENT_DATE,
        next_billing_date = end_date +
          CASE
            WHEN billing_type = 'month' THEN INTERVAL '1 month'
            ELSE INTERVAL '1 year'
          END,
        status = 'active'
      WHERE id = $1
      RETURNING end_date
    `;

    const result = await db.query(query, [subscriptionId]);
    return result.rows.length > 0;
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(subscriptionId: string, userId: string, reason?: string) {
    // Get subscription details
    const subQuery = `
      SELECT directpay_subscription_id, payment_gateway_id
      FROM licensing_custom_subs
      WHERE id = $1 AND user_id = $2
    `;
    const subResult = await db.query(subQuery, [subscriptionId, userId]);
    const sub = subResult.rows[0];

    // Cancel at gateway
    if (sub.directpay_subscription_id) {
      const gateway = await PaymentGatewayFactory.getGateway('directpay');
      await gateway.cancelSubscription(sub.directpay_subscription_id, userId);
    }

    // Update local database
    await db.query(`
      UPDATE licensing_custom_subs
      SET status = 'cancelled',
          auto_renew = false,
          cancellation_reason = $1,
          cancelled_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [reason, subscriptionId]);

    return { success: true };
  }
}
```

---

## Phase 3: Backend API Endpoints

### Billing Controller Enhancements

**File**: `/worklenz-backend/src/controllers/billing-controller.ts` (modify existing)

Add the following methods to the existing `BillingController` class:

#### 1. Create Custom Subscription

```typescript
@HandleExceptions()
public static async createCustomSubscription(req: IWorkLenzRequest, res: IWorkLenzResponse) {
  const { planTierId, billingType, quantity, cardId } = req.body;

  const result = await SubscriptionManagementService.createCustomSubscription(
    req.user?.id!,
    planTierId,
    billingType,
    quantity,
    cardId
  );

  return res.status(200).send(new ServerResponse(true, result));
}
```

**Route**: `POST /api/billing/create-custom-subscription`

**Request Body**:
```json
{
  "planTierId": "uuid-of-plan-tier",
  "billingType": "month",
  "quantity": 10,
  "cardId": "uuid-of-saved-card (optional)"
}
```

#### 2. DirectPay Webhook Handler

```typescript
@HandleExceptions()
public static async handleDirectPayWebhook(req: IWorkLenzRequest, res: IWorkLenzResponse) {
  const payload = req.body;
  const signature = req.headers['signature'] as string;

  // Check idempotency
  const eventId = payload.event_id || payload.transaction_id;
  const existingQuery = `SELECT 1 FROM licensing_directpay_webhooks WHERE event_id = $1`;
  const existing = await db.query(existingQuery, [eventId]);

  if (existing.rows.length > 0) {
    return res.status(200).send({ received: true, message: 'Event already processed' });
  }

  // Log webhook
  await db.query(`
    INSERT INTO licensing_directpay_webhooks (event_id, event_type, payload, processed)
    VALUES ($1, $2, $3, false)
  `, [eventId, payload.event_type || payload.status, JSON.stringify(payload)]);

  // Process webhook
  const gateway = await PaymentGatewayFactory.getGateway('directpay');
  const validation = await gateway.processWebhook(payload, signature);

  if (validation.isValid) {
    // Mark as processed
    await db.query(`
      UPDATE licensing_directpay_webhooks SET processed = true, processed_at = CURRENT_TIMESTAMP
      WHERE event_id = $1
    `, [eventId]);
  }

  return res.status(200).send({ received: true });
}
```

**Route**: `POST /api/billing/directpay-webhook`

**Security**: Validates HMAC signature, checks idempotency via `event_id`.

#### 3. Get Custom Plan Pricing

```typescript
@HandleExceptions()
public static async getCustomPlanPricing(req: IWorkLenzRequest, res: IWorkLenzResponse) {
  const { billingType = 'month', quantity = 1 } = req.query;

  const query = `
    SELECT id, tier_name, display_name, monthly_base_price, annual_base_price,
           included_users, max_users, monthly_per_user_price, annual_per_user_price,
           currency, features
    FROM licensing_custom_plan_pricing
    WHERE is_active = true
    ORDER BY tier_level ASC
  `;

  const result = await db.query(query);
  const tiers = result.rows.map(tier => {
    const qty = parseInt(quantity as string);
    const basePrice = billingType === 'month' ? tier.monthly_base_price : tier.annual_base_price;
    const perUserPrice = billingType === 'month' ? tier.monthly_per_user_price : tier.annual_per_user_price;

    let calculatedTotal = parseFloat(basePrice);
    if (qty > tier.included_users && perUserPrice) {
      calculatedTotal += (qty - tier.included_users) * parseFloat(perUserPrice);
    }

    return { ...tier, calculatedTotal };
  });

  return res.status(200).send(new ServerResponse(true, { tiers }));
}
```

**Route**: `GET /api/billing/custom-plan-pricing?billingType=month&quantity=10`

#### 4. Cancel Custom Subscription

```typescript
@HandleExceptions()
public static async cancelCustomSubscription(req: IWorkLenzRequest, res: IWorkLenzResponse) {
  const { subscriptionId, reason, cancelImmediately } = req.body;

  const result = await SubscriptionManagementService.cancelSubscription(
    subscriptionId,
    req.user?.id!,
    reason
  );

  return res.status(200).send(new ServerResponse(true, result));
}
```

#### 5. Get Saved Cards

```typescript
@HandleExceptions()
public static async getSavedCards(req: IWorkLenzRequest, res: IWorkLenzResponse) {
  const query = `
    SELECT id, card_number_masked, card_brand, card_type, expiry_month, expiry_year,
           is_default, last_used_at
    FROM licensing_directpay_cards
    WHERE user_id = $1 AND is_active = true
    ORDER BY is_default DESC, last_used_at DESC NULLS LAST
  `;

  const result = await db.query(query, [req.user?.id]);
  return res.status(200).send(new ServerResponse(true, { cards: result.rows }));
}
```

#### 6. Delete Card

```typescript
@HandleExceptions()
public static async deleteCard(req: IWorkLenzRequest, res: IWorkLenzResponse) {
  const { cardId } = req.params;

  await db.query(`
    UPDATE licensing_directpay_cards
    SET is_active = false
    WHERE id = $1 AND user_id = $2
  `, [cardId, req.user?.id]);

  return res.status(200).send(new ServerResponse(true, { message: 'Card removed' }));
}
```

#### 7. Enhanced Save Transaction Data

Modify the existing `saveTransactionData` method (around line 146) to:
- Link transaction to subscription via `subscription_id`
- Save card details to `licensing_directpay_cards`
- Update subscription status to 'active'
- Store `directpay_subscription_id` from DirectPay response

### Admin Center Controller Enhancements

**File**: `/worklenz-backend/src/controllers/admin-center-controller.ts` (modify existing)

#### 1. Switch Payment Gateway

```typescript
@HandleExceptions()
@RequireAdminAuth()  // Custom decorator for admin-only access
public static async switchPaymentGateway(req: IWorkLenzRequest, res: IWorkLenzResponse) {
  const { userId, gatewayName, reason } = req.body;

  // Validate: Check for active subscriptions on different gateway
  const activeSubQuery = `
    SELECT lcs.id, pg.name as current_gateway
    FROM licensing_custom_subs lcs
    JOIN licensing_payment_gateways pg ON pg.id = lcs.payment_gateway_id
    WHERE lcs.user_id = $1 AND lcs.status = 'active'
  `;
  const activeSub = await db.query(activeSubQuery, [userId]);

  if (activeSub.rows.length > 0 && activeSub.rows[0].current_gateway !== gatewayName) {
    return res.status(400).send(new ServerResponse(false, {
      message: 'Cannot switch gateway while active subscription exists on different gateway'
    }));
  }

  // Update organization gateway preference
  const gatewayQuery = `SELECT id FROM licensing_payment_gateways WHERE name = $1`;
  const gatewayResult = await db.query(gatewayQuery, [gatewayName]);
  const gatewayId = gatewayResult.rows[0]?.id;

  await db.query(`
    UPDATE organizations
    SET preferred_payment_gateway_id = $1
    WHERE user_id = $2
  `, [gatewayId, userId]);

  // Log the change
  await db.query(`
    INSERT INTO licensing_custom_subs_logs (subscription_id, log_text, description, admin_user_id)
    VALUES (
      (SELECT id FROM licensing_custom_subs WHERE user_id = $1 LIMIT 1),
      'gateway_switched',
      $2,
      $3
    )
  `, [userId, `Switched to ${gatewayName}. Reason: ${reason}`, req.user?.id]);

  return res.status(200).send(new ServerResponse(true, { message: 'Gateway switched successfully' }));
}
```

**Route**: `POST /api/admin-center/billing/switch-gateway`

#### 2. List Custom Subscriptions

```typescript
@HandleExceptions()
@RequireAdminAuth()
public static async listCustomSubscriptions(req: IWorkLenzRequest, res: IWorkLenzResponse) {
  const { status, gateway, page = 1, limit = 50 } = req.query;

  let whereConditions = [];
  let params: any[] = [];
  let paramIndex = 1;

  if (status) {
    whereConditions.push(`lcs.status = $${paramIndex++}`);
    params.push(status);
  }

  if (gateway) {
    whereConditions.push(`pg.name = $${paramIndex++}`);
    params.push(gateway);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const query = `
    SELECT lcs.*, u.email, u.name, pg.name as gateway_name,
           lcp.tier_name, lcp.display_name as plan_name
    FROM licensing_custom_subs lcs
    JOIN users u ON u.id = lcs.user_id
    LEFT JOIN licensing_payment_gateways pg ON pg.id = lcs.payment_gateway_id
    LEFT JOIN licensing_custom_plan_pricing lcp ON lcp.id = lcs.plan_tier_id
    ${whereClause}
    ORDER BY lcs.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(parseInt(limit as string), (parseInt(page as string) - 1) * parseInt(limit as string));

  const result = await db.query(query, params);
  return res.status(200).send(new ServerResponse(true, { subscriptions: result.rows }));
}
```

**Route**: `GET /api/admin-center/billing/custom-subscriptions?status=active&page=1`

#### 3. Manual Extend Subscription

```typescript
@HandleExceptions()
@RequireAdminAuth()
public static async manualExtendSubscription(req: IWorkLenzRequest, res: IWorkLenzResponse) {
  const { subscriptionId, extensionMonths, reason } = req.body;

  // Extend subscription
  await db.query(`
    UPDATE licensing_custom_subs
    SET end_date = end_date + ($1 || ' months')::INTERVAL,
        next_billing_date = end_date + ($1 || ' months')::INTERVAL
    WHERE id = $2
  `, [extensionMonths, subscriptionId]);

  // Log the extension
  await db.query(`
    INSERT INTO licensing_custom_subs_logs (subscription_id, log_text, description, admin_user_id)
    VALUES ($1, 'manual_extension', $2, $3)
  `, [subscriptionId, `Extended by ${extensionMonths} months. Reason: ${reason}`, req.user?.id]);

  return res.status(200).send(new ServerResponse(true, { message: 'Subscription extended' }));
}
```

**Route**: `POST /api/admin-center/billing/manual-extend`

**Use Case**: For existing users with custom pricing who haven't set up DirectPay yet.

### Route Definitions

Add routes to `/worklenz-backend/src/routes/apis/billing-api-router.ts`:

```typescript
router.post('/create-custom-subscription', BillingController.createCustomSubscription);
router.post('/directpay-webhook', BillingController.handleDirectPayWebhook);
router.get('/custom-plan-pricing', BillingController.getCustomPlanPricing);
router.post('/cancel-custom-subscription', BillingController.cancelCustomSubscription);
router.get('/saved-cards', BillingController.getSavedCards);
router.delete('/saved-cards/:cardId', BillingController.deleteCard);
```

Add admin routes to `/worklenz-backend/src/routes/apis/admin-center-api-router.ts`:

```typescript
router.post('/billing/switch-gateway', AdminCenterController.switchPaymentGateway);
router.get('/billing/custom-subscriptions', AdminCenterController.listCustomSubscriptions);
router.post('/billing/manual-extend', AdminCenterController.manualExtendSubscription);
```

---

## Phase 4: Frontend Integration

### Gateway Detection in UpgradePlans Component

**File**: `/worklenz-frontend/src/components/admin-center/billing/drawers/upgrade-plans/UpgradePlans.tsx` (modify)

Add state variables:

```typescript
const [paymentGateway, setPaymentGateway] = useState<'paddle' | 'directpay'>('paddle');
const [customPlanPricing, setCustomPlanPricing] = useState<any[]>([]);
const [isDirectPayCheckoutOpen, setIsDirectPayCheckoutOpen] = useState(false);
```

Add gateway detection effect:

```typescript
useEffect(() => {
  const detectGateway = async () => {
    try {
      // Fetch organization data
      const orgResponse = await adminCenterApiService.getOrganization();

      if (orgResponse.done) {
        const org = orgResponse.body;
        const isLkrUser = org.is_lkr_billing || org.country_code === 'LK';

        if (isLkrUser) {
          setPaymentGateway('directpay');

          // Fetch LKR pricing
          const pricingResponse = await billingApiService.getCustomPlanPricing({
            billingType: billingFrequency,
            quantity: teamSize
          });

          if (pricingResponse.done) {
            setCustomPlanPricing(pricingResponse.body.tiers);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to detect payment gateway', error);
    }
  };

  detectGateway();
}, [billingFrequency, teamSize]);
```

Add DirectPay checkout handler:

```typescript
const handleCheckout = async (planType: 'pro' | 'business' | 'enterprise') => {
  if (paymentGateway === 'directpay') {
    await handleDirectPayCheckout(planType);
  } else {
    await continueWithPaddlePlan(planType);
  }
};

const handleDirectPayCheckout = async (planType: string) => {
  try {
    setPaddleLoading(true);

    const planTier = customPlanPricing.find(p => p.tier_name === planType);
    if (!planTier) {
      message.error('Plan not found');
      return;
    }

    const response = await billingApiService.createCustomSubscription({
      planTierId: planTier.id,
      billingType: billingFrequency,
      quantity: teamSize
    });

    if (response.done) {
      openDirectPayCheckout(response.body.checkoutData);
    } else {
      message.error('Failed to initiate checkout');
    }
  } catch (error) {
    logger.error('DirectPay checkout error', error);
    message.error('An error occurred during checkout');
  } finally {
    setPaddleLoading(false);
  }
};

const openDirectPayCheckout = (checkoutData: any) => {
  const { signature, dataString, stage } = checkoutData;

  // Load DirectPay SDK
  const script = document.createElement('script');
  script.src = `https://directpay.lk/sdk/${stage.toLowerCase()}/directpay.js`;
  script.async = true;

  script.onload = () => {
    // @ts-ignore - DirectPay SDK
    if (window.DirectPay) {
      // @ts-ignore
      window.DirectPay.initiate({
        signature,
        data: dataString,
        onSuccess: handleDirectPaySuccess,
        onError: handleDirectPayError,
        onCancel: handleDirectPayCancel
      });
    }
  };

  script.onerror = () => {
    message.error('Failed to load payment gateway');
    setPaddleLoading(false);
  };

  document.body.appendChild(script);
};

const handleDirectPaySuccess = async () => {
  message.success('Payment successful! Your subscription is now active.');

  // Refresh session to get updated subscription status
  const sessionResponse = await authApiService.verify();
  if (sessionResponse.done) {
    dispatch(setUser(sessionResponse.body));
    setSession(sessionResponse.body);
  }

  // Refresh billing info
  dispatch(fetchBillingInfo());

  // Close modal and redirect
  dispatch(toggleUpgradeModal(false));
  window.location.href = '/admin-center/billing';
};

const handleDirectPayError = (error: any) => {
  logger.error('DirectPay payment error', error);
  message.error('Payment failed. Please try again.');
  setPaddleLoading(false);
};

const handleDirectPayCancel = () => {
  message.info('Payment cancelled');
  setPaddleLoading(false);
};
```

Update pricing display:

```typescript
const formatCurrency = (amount: number) => {
  if (paymentGateway === 'directpay') {
    return `LKR ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${amount.toFixed(2)}`;
};

// Use in rendering
<Typography.Title level={3}>
  {formatCurrency(selectedPlanPrice)}
  <span className="billing-frequency">/{billingFrequency === 'annual' ? 'year' : 'month'}</span>
</Typography.Title>
```

Update plan cards to show DirectPay pricing:

```typescript
const getPlanPricing = (planType: PlanType) => {
  if (paymentGateway === 'directpay') {
    const tier = customPlanPricing.find(p => p.tier_name === planType);
    return tier ? tier.calculatedTotal : 0;
  }

  // Existing Paddle pricing logic
  return pricingData[planType][billingFrequency];
};
```

### Saved Cards Component

**File**: `/worklenz-frontend/src/components/admin-center/billing/saved-cards/SavedCards.tsx` (new)

```typescript
import { Card, Button, Popconfirm, Empty, Spin } from 'antd';
import { DeleteOutlined, CreditCardOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { billingApiService } from '@/api/admin-center/billing.api.service';
import { message } from 'antd';

interface SavedCard {
  id: string;
  card_number_masked: string;
  card_brand: string;
  card_type: string;
  expiry_month: string;
  expiry_year: string;
  is_default: boolean;
  last_used_at: string;
}

export const SavedCards = () => {
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSavedCards();
  }, []);

  const fetchSavedCards = async () => {
    try {
      setLoading(true);
      const response = await billingApiService.getSavedCards();
      if (response.done) {
        setCards(response.body.cards);
      }
    } catch (error) {
      message.error('Failed to load saved cards');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    try {
      const response = await billingApiService.deleteCard(cardId);
      if (response.done) {
        message.success('Card removed successfully');
        fetchSavedCards();
      }
    } catch (error) {
      message.error('Failed to remove card');
    }
  };

  if (loading) {
    return <Spin />;
  }

  if (cards.length === 0) {
    return (
      <Empty
        description="No saved payment methods"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <div className="saved-cards-container">
      {cards.map(card => (
        <Card key={card.id} className="card-item">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CreditCardOutlined style={{ fontSize: '24px' }} />
              <div>
                <div style={{ fontWeight: 500 }}>
                  {card.card_brand} •••• {card.card_number_masked}
                  {card.is_default && (
                    <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: '8px' }} />
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                  Expires {card.expiry_month}/{card.expiry_year}
                </div>
              </div>
            </div>
            <Popconfirm
              title="Remove this card?"
              description="This action cannot be undone."
              onConfirm={() => handleDeleteCard(card.id)}
              okText="Remove"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
            >
              <Button icon={<DeleteOutlined />} danger type="text" />
            </Popconfirm>
          </div>
        </Card>
      ))}
    </div>
  );
};
```

### Admin Gateway Switcher Component

**File**: `/worklenz-frontend/src/components/admin-center/billing/admin/GatewaySwitcher.tsx` (new)

```typescript
import { Form, Select, Input, Button, message, Card } from 'antd';
import { useState } from 'react';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';

export const GatewaySwitcher = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      const response = await adminCenterApiService.switchPaymentGateway(values);

      if (response.done) {
        message.success('Payment gateway switched successfully');
        form.resetFields();
      } else {
        message.error(response.message || 'Failed to switch gateway');
      }
    } catch (error: any) {
      message.error(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Switch User Payment Gateway (Admin Only)">
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Form.Item
          name="userId"
          label="User ID"
          rules={[{ required: true, message: 'Please enter user ID' }]}
        >
          <Input placeholder="Enter user UUID" />
        </Form.Item>

        <Form.Item
          name="gatewayName"
          label="New Gateway"
          rules={[{ required: true, message: 'Please select gateway' }]}
        >
          <Select placeholder="Select payment gateway">
            <Select.Option value="paddle">Paddle (International)</Select.Option>
            <Select.Option value="directpay">DirectPay (Sri Lanka)</Select.Option>
            <Select.Option value="manual">Manual/Admin</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="reason"
          label="Reason for Switch"
          rules={[{ required: true, message: 'Please provide reason' }]}
        >
          <Input.TextArea
            rows={3}
            placeholder="e.g., User moved to Sri Lanka, requested local payment method"
          />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Switch Gateway
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};
```

### API Service Methods

**File**: `/worklenz-frontend/src/api/admin-center/billing.api.service.ts` (modify)

Add methods:

```typescript
export class BillingApiService {
  // ... existing methods

  async createCustomSubscription(params: {
    planTierId: string;
    billingType: 'month' | 'year';
    quantity: number;
    cardId?: string;
  }) {
    return this.post('/api/billing/create-custom-subscription', params);
  }

  async getCustomPlanPricing(params?: {
    billingType?: string;
    quantity?: number;
  }) {
    return this.get('/api/billing/custom-plan-pricing', { params });
  }

  async cancelCustomSubscription(subscriptionId: string, reason?: string) {
    return this.post('/api/billing/cancel-custom-subscription', {
      subscriptionId,
      reason
    });
  }

  async getSavedCards() {
    return this.get('/api/billing/saved-cards');
  }

  async deleteCard(cardId: string) {
    return this.delete(`/api/billing/saved-cards/${cardId}`);
  }
}

export class AdminCenterApiService {
  // ... existing methods

  async switchPaymentGateway(params: {
    userId: string;
    gatewayName: string;
    reason: string;
  }) {
    return this.post('/api/admin-center/billing/switch-gateway', params);
  }

  async listCustomSubscriptions(params?: {
    status?: string;
    gateway?: string;
    page?: number;
    limit?: number;
  }) {
    return this.get('/api/admin-center/billing/custom-subscriptions', { params });
  }

  async manualExtendSubscription(params: {
    subscriptionId: string;
    extensionMonths: number;
    reason: string;
  }) {
    return this.post('/api/admin-center/billing/manual-extend', params);
  }
}
```

---

## Phase 5: Testing Strategy

### Unit Tests

#### Gateway Tests
```typescript
describe('DirectPayGateway', () => {
  it('should generate valid checkout signature', async () => {
    const gateway = new DirectPayGateway();
    const result = await gateway.generateCheckout({
      userId: 'test-user-id',
      planId: 'test-plan-id',
      billingType: 'month',
      quantity: 10,
      currency: 'LKR',
      amount: 75000
    });

    expect(result.signature).toBeDefined();
    expect(result.dataString).toBeDefined();
    expect(result.stage).toBeDefined();
  });

  it('should validate webhook signatures correctly', async () => {
    const gateway = new DirectPayGateway();
    const mockPayload = { /* ... */ };
    const mockSignature = 'valid-signature';

    const validation = await gateway.processWebhook(mockPayload, mockSignature);
    expect(validation.isValid).toBe(true);
  });
});

describe('SubscriptionManagementService', () => {
  it('should calculate correct amount for base plan', () => {
    const mockPlan = {
      monthly_base_price: 75000,
      annual_base_price: 840000,
      included_users: 15,
      monthly_per_user_price: 1800,
      annual_per_user_price: 20160
    };

    const amount = SubscriptionManagementService['calculateSubscriptionAmount'](
      mockPlan,
      'month',
      10
    );

    expect(amount).toBe(75000); // 10 users <= 15 included users
  });

  it('should calculate correct amount with overage', () => {
    const mockPlan = {
      monthly_base_price: 75000,
      included_users: 15,
      monthly_per_user_price: 1800
    };

    const amount = SubscriptionManagementService['calculateSubscriptionAmount'](
      mockPlan,
      'month',
      20
    );

    expect(amount).toBe(75000 + (5 * 1800)); // Base + 5 extra users
  });
});
```

### Integration Tests

```typescript
describe('DirectPay Checkout Flow', () => {
  it('should complete full subscription flow', async () => {
    // 1. Create subscription
    const createResponse = await request(app)
      .post('/api/billing/create-custom-subscription')
      .send({
        planTierId: 'test-plan-id',
        billingType: 'month',
        quantity: 10
      })
      .set('Authorization', `Bearer ${testUserToken}`);

    expect(createResponse.status).toBe(200);
    expect(createResponse.body.done).toBe(true);
    const subscriptionId = createResponse.body.body.subscriptionId;

    // 2. Simulate DirectPay success webhook
    const webhookPayload = {
      event_id: 'test-event-123',
      event_type: 'PAYMENT_SUCCESS',
      transaction_id: 'test-txn-456',
      amount: 75000,
      currency: 'LKR',
      status: 'SUCCESS'
    };

    const webhookResponse = await request(app)
      .post('/api/billing/directpay-webhook')
      .send(webhookPayload)
      .set('Signature', generateTestSignature(webhookPayload));

    expect(webhookResponse.status).toBe(200);

    // 3. Verify subscription is active
    const subscription = await db.query(
      'SELECT status, end_date FROM licensing_custom_subs WHERE id = $1',
      [subscriptionId]
    );

    expect(subscription.rows[0].status).toBe('active');
    expect(subscription.rows[0].end_date).toBeDefined();
  });

  it('should not process duplicate webhook events', async () => {
    const payload = {
      event_id: 'duplicate-event',
      event_type: 'PAYMENT_SUCCESS',
      transaction_id: 'test-txn'
    };

    // First webhook
    await request(app)
      .post('/api/billing/directpay-webhook')
      .send(payload);

    // Duplicate webhook
    const response = await request(app)
      .post('/api/billing/directpay-webhook')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.message).toContain('already processed');

    // Verify only one entry in webhook log
    const logs = await db.query(
      'SELECT COUNT(*) FROM licensing_directpay_webhooks WHERE event_id = $1',
      ['duplicate-event']
    );
    expect(parseInt(logs.rows[0].count)).toBe(1);
  });
});
```

### Manual Testing Checklist

- [ ] **Gateway Detection**: New LKR user sees DirectPay as default gateway
- [ ] **Plan Selection**: User can select Pro/Business/Enterprise with monthly/annual toggle
- [ ] **Pricing Display**: LKR pricing displays correctly with proper formatting
- [ ] **DirectPay Checkout**: DirectPay SDK loads and opens checkout modal
- [ ] **Payment Success**: Subscription activates and end_date is set correctly
- [ ] **Payment Failure**: Subscription marked as past_due, user notified
- [ ] **Webhook Idempotency**: Duplicate webhooks don't create duplicate payments
- [ ] **Recurring Billing**: DirectPay auto-charges on billing date and extends subscription
- [ ] **Saved Cards**: User can view and delete saved payment methods
- [ ] **Cancellation**: User can cancel subscription, future billing stops
- [ ] **Admin Gateway Switch**: Admin can switch user from Paddle to DirectPay
- [ ] **Existing User Pricing**: Migrated users retain custom pricing rates
- [ ] **Manual Extension**: Admin can manually extend subscription for custom users

---

## Phase 6: Deployment & Migration

### Pre-Deployment Checklist

- [ ] Database migrations tested on staging environment
- [ ] DirectPay sandbox account configured (DP_STAGE=DEV)
- [ ] Environment variables verified (`DP_MERCHANT_ID`, `DP_SECRET_KEY`, `DP_API_KEY`)
- [ ] Backend deployed to staging with zero errors
- [ ] Frontend deployed to staging
- [ ] End-to-end testing completed on staging
- [ ] Webhook endpoint publicly accessible and tested
- [ ] SSL certificate valid for webhook endpoint
- [ ] Error monitoring configured (Sentry, LogRocket, etc.)
- [ ] Database backup created

### Production Deployment Steps

1. **Schedule Maintenance Window** (if needed for schema changes)
2. **Database Migration**
   ```bash
   cd worklenz-backend
   npm run migrate:up -- 20250118000000-add-directpay-subscription-support.sql
   ```
3. **Deploy Backend**
   ```bash
   git pull origin main
   npm install
   npm run build
   pm2 restart worklenz-backend
   ```
4. **Deploy Frontend**
   ```bash
   cd worklenz-frontend
   git pull origin main
   npm install
   npm run build
   # Deploy build to CDN/hosting
   ```
5. **Verify Deployment**
   - Check health endpoints
   - Test DirectPay checkout with sandbox account
   - Monitor error logs for 30 minutes

### Admin-Controlled Migration Process

#### Migration Script

**File**: `/worklenz-backend/scripts/migrate-user-to-directpay.ts`

```typescript
import db from '../src/config/db';
import moment from 'moment';

interface MigrationResult {
  success: boolean;
  userId: string;
  message: string;
}

/**
 * Migrate a single user from manual/Paddle to DirectPay
 * Preserves custom pricing for existing users
 */
export async function migrateUserToDirectPay(
  userId: string,
  adminUserId: string,
  reason: string
): Promise<MigrationResult> {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // 1. Get current custom subscription (if exists)
    const subQuery = `
      SELECT * FROM licensing_custom_subs
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const subResult = await client.query(subQuery, [userId]);

    if (subResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        userId,
        message: 'No existing subscription found for user'
      };
    }

    const currentSub = subResult.rows[0];

    // 2. Verify subscription is not already on DirectPay
    const gatewayCheck = `
      SELECT pg.name
      FROM licensing_payment_gateways pg
      WHERE pg.id = $1
    `;
    const gatewayResult = await client.query(gatewayCheck, [currentSub.payment_gateway_id]);

    if (gatewayResult.rows[0]?.name === 'directpay') {
      await client.query('ROLLBACK');
      return {
        success: false,
        userId,
        message: 'User already on DirectPay'
      };
    }

    // 3. Update subscription to DirectPay gateway
    // IMPORTANT: Preserve custom pricing (rate, user_limit)
    // Set auto_renew=false until user adds payment method
    await client.query(`
      UPDATE licensing_custom_subs
      SET payment_gateway_id = (SELECT id FROM licensing_payment_gateways WHERE name = 'directpay'),
          status = 'active',
          auto_renew = false,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [currentSub.id]);

    // 4. Update organization
    await client.query(`
      UPDATE organizations
      SET preferred_payment_gateway_id = (SELECT id FROM licensing_payment_gateways WHERE name = 'directpay')
      WHERE user_id = $1
    `, [userId]);

    // 5. Log migration
    await client.query(`
      INSERT INTO licensing_custom_subs_logs (
        subscription_id, log_text, description, admin_user_id
      ) VALUES ($1, 'migrated_to_directpay', $2, $3)
    `, [
      currentSub.id,
      `Admin migration to DirectPay. Reason: ${reason}. Custom pricing preserved (rate: ${currentSub.rate}, limit: ${currentSub.user_limit})`,
      adminUserId
    ]);

    await client.query('COMMIT');

    return {
      success: true,
      userId,
      message: `Successfully migrated user to DirectPay. Custom pricing preserved.`
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Migration failed for user ${userId}:`, error);
    return {
      success: false,
      userId,
      message: `Migration failed: ${(error as Error).message}`
    };
  } finally {
    client.release();
  }
}

/**
 * Batch migration function (use with caution)
 */
export async function batchMigrateUsers(
  userIds: string[],
  adminUserId: string,
  reason: string
): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  for (const userId of userIds) {
    const result = await migrateUserToDirectPay(userId, adminUserId, reason);
    results.push(result);

    // Rate limiting - wait 100ms between migrations
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.log('Usage: ts-node migrate-user-to-directpay.ts <userId> <adminUserId> <reason>');
    process.exit(1);
  }

  const [userId, adminUserId, reason] = args;

  migrateUserToDirectPay(userId, adminUserId, reason)
    .then(result => {
      console.log(result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Migration error:', error);
      process.exit(1);
    });
}
```

#### Admin Migration Workflow

1. **Identify Candidates**
   - Query existing custom plan users
   - Prioritize users with upcoming renewal dates
   - Check LKR billing preference

2. **Use Admin UI or Script**
   - **UI**: Use `GatewaySwitcher` component
   - **Script**: Run migration script with user ID

3. **User Notification**
   - Send email: "Your billing has been upgraded to DirectPay"
   - Include instructions to add payment method
   - Link to billing dashboard

4. **User Action**
   - User logs in
   - Goes to Billing section
   - Adds DirectPay card
   - Subscription switches to `auto_renew=true`

5. **Monitor**
   - Check migration logs
   - Verify no failed payments
   - Track user adoption rate

---

## Critical Files Summary

### Backend (New Files)
1. `/worklenz-backend/database/migrations/20250118000000-add-directpay-subscription-support.sql`
2. `/worklenz-backend/src/services/payment-gateways/base-payment-gateway.ts`
3. `/worklenz-backend/src/services/payment-gateways/paddle-gateway.ts`
4. `/worklenz-backend/src/services/payment-gateways/directpay-gateway.ts`
5. `/worklenz-backend/src/services/payment-gateways/gateway-factory.ts`
6. `/worklenz-backend/src/services/subscription-management-service.ts`
7. `/worklenz-backend/scripts/migrate-user-to-directpay.ts`

### Backend (Modified Files)
1. `/worklenz-backend/src/controllers/billing-controller.ts`
2. `/worklenz-backend/src/controllers/admin-center-controller.ts`
3. `/worklenz-backend/src/routes/apis/billing-api-router.ts`
4. `/worklenz-backend/src/routes/apis/admin-center-api-router.ts`

### Frontend (New Files)
1. `/worklenz-frontend/src/components/admin-center/billing/saved-cards/SavedCards.tsx`
2. `/worklenz-frontend/src/components/admin-center/billing/admin/GatewaySwitcher.tsx`

### Frontend (Modified Files)
1. `/worklenz-frontend/src/components/admin-center/billing/drawers/upgrade-plans/UpgradePlans.tsx`
2. `/worklenz-frontend/src/api/admin-center/billing.api.service.ts`

---

## Key Design Decisions Rationale

### 1. Two-Tier Pricing Strategy

**Decision**: New users get fixed pricing from `licensing_custom_plan_pricing`, existing users keep custom rates in `licensing_custom_subs.rate`.

**Rationale**:
- Preserves business commitments to existing customers
- Standardizes pricing for scalability
- Allows gradual transition to fixed pricing
- Simplifies future billing operations

### 2. Admin-Controlled Migration

**Decision**: Admins manually migrate users one-by-one instead of automatic mass migration.

**Rationale**:
- Reduces risk of payment disruptions
- Allows personalized communication with high-value customers
- Gives time to verify DirectPay integration stability
- Enables gradual rollout and learning

### 3. Gateway Abstraction

**Decision**: Create `BasePaymentGateway` abstract class with standardized interface.

**Rationale**:
- Future-proofs for additional gateways (Stripe, PayHere, etc.)
- Simplifies testing with mock gateways
- Centralizes payment logic
- Reduces code duplication

### 4. Webhook Idempotency

**Decision**: Store all webhook events in `licensing_directpay_webhooks` with `event_id` uniqueness constraint.

**Rationale**:
- Prevents duplicate payment processing
- Provides audit trail for debugging
- Enables webhook replay for failed processing
- Industry best practice

### 5. Status-Based Subscription Management

**Decision**: Use `status` field ('active', 'past_due', 'cancelled', 'expired') instead of boolean flags.

**Rationale**:
- Clearer subscription lifecycle representation
- Easier to add new states (e.g., 'paused', 'pending_cancellation')
- Simplifies business logic and queries
- Aligns with payment gateway standards

---

## Success Metrics

### Technical Metrics
- [ ] Payment success rate > 95%
- [ ] Webhook processing latency < 5 seconds
- [ ] Zero duplicate payment processing
- [ ] API response time < 500ms (p95)
- [ ] Zero downtime during deployment

### Business Metrics
- [ ] LKR user conversion rate improves by X%
- [ ] Reduced manual billing operations
- [ ] X% of custom users migrated within 3 months
- [ ] Subscription renewal rate remains stable
- [ ] Customer support tickets related to billing decrease

### User Experience Metrics
- [ ] Checkout completion rate > 80%
- [ ] Payment method addition success rate > 90%
- [ ] User satisfaction score for billing process > 4/5
- [ ] Average time to complete checkout < 2 minutes

---

## Rollback Plan

### Rollback Triggers
- Payment success rate drops below 80%
- More than 10% of webhooks failing
- Critical security vulnerability discovered
- Database corruption detected

### Rollback Steps
1. **Immediate Actions**
   - Disable DirectPay checkout (redirect all to Paddle)
   - Stop processing DirectPay webhooks
   - Notify users of temporary payment issues

2. **Data Preservation**
   - DO NOT roll back database migrations (data loss risk)
   - Mark all DirectPay subscriptions as 'paused'
   - Export DirectPay transaction logs for analysis

3. **Investigation**
   - Review error logs
   - Test in staging environment
   - Identify root cause

4. **Resolution**
   - Fix identified issues
   - Deploy patch to staging
   - Test thoroughly
   - Redeploy to production

5. **Recovery**
   - Re-enable DirectPay gradually (10% → 50% → 100%)
   - Monitor closely for 48 hours
   - Communicate with affected users

---

## Post-Implementation Monitoring

### Daily Monitoring (First 2 Weeks)

```sql
-- Payment success rate
SELECT
  COUNT(*) FILTER (WHERE transaction_status = 'SUCCESS') * 100.0 / COUNT(*) as success_rate,
  COUNT(*) as total_payments,
  DATE(created_at) as payment_date
FROM licensing_lkr_payments
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY payment_date DESC;

-- Webhook processing health
SELECT
  processed,
  COUNT(*) as count,
  AVG(retry_count) as avg_retries,
  MAX(created_at) as last_webhook
FROM licensing_directpay_webhooks
WHERE created_at >= CURRENT_DATE - INTERVAL '24 hours'
GROUP BY processed;

-- Active subscriptions by gateway
SELECT
  pg.name as gateway,
  COUNT(*) as active_count,
  SUM(lcs.rate) as total_monthly_revenue
FROM licensing_custom_subs lcs
JOIN licensing_payment_gateways pg ON pg.id = lcs.payment_gateway_id
WHERE lcs.status = 'active'
GROUP BY pg.name;

-- Failed payments requiring attention
SELECT
  u.email,
  lcs.status,
  lcs.next_billing_date,
  lcs.rate
FROM licensing_custom_subs lcs
JOIN users u ON u.id = lcs.user_id
WHERE lcs.status = 'past_due'
  AND lcs.next_billing_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY lcs.next_billing_date ASC;
```

### Alert Thresholds
- **Critical**: Payment success rate < 70%, webhook processing stopped
- **Warning**: Payment success rate < 85%, webhook delay > 5 minutes
- **Info**: New DirectPay subscription created, migration completed

---

## FAQ / Troubleshooting

### Q: User's DirectPay checkout is not opening
**A**: Check browser console for errors. Verify DirectPay SDK URL is correct and accessible. Ensure signature generation is working properly.

### Q: Webhook received but not processed
**A**: Check `licensing_directpay_webhooks` table for error_message. Verify signature validation. Check if event_id already exists (duplicate).

### Q: Subscription not extending after payment
**A**: Verify webhook contains correct transaction_id. Check `licensing_lkr_payments.subscription_id` is correctly linked. Review `handlePaymentSuccess` logic.

### Q: Admin cannot switch user's gateway
**A**: Verify user doesn't have active subscription on different gateway. Check admin authentication. Review `switchPaymentGateway` validation logic.

### Q: Existing user's pricing changed after migration
**A**: Check migration script preserves `rate` and `user_limit` fields. Verify `plan_tier_id` is NULL for migrated users. Review `calculateSubscriptionAmount` logic.

---

## Appendix: DirectPay API Reference

### Expected DirectPay Endpoints

**Note**: These are based on common recurring payment gateway patterns. Verify with actual DirectPay API documentation.

1. **Create Recurring Payment**: `POST /recurring-payment`
2. **Cancel Subscription**: `POST /cancel-subscription`
3. **Get Subscription Status**: `GET /subscription-status/:id`
4. **List Cards**: `POST /list-cards`
5. **Remove Card**: `POST /remove-card`

### Expected Webhook Events

1. **PAYMENT_SUCCESS**: Recurring payment succeeded
2. **PAYMENT_FAILED**: Payment failed (card declined, insufficient funds)
3. **SUBSCRIPTION_CANCELLED**: User or admin cancelled subscription
4. **CARD_EXPIRED**: Saved card expired
5. **CARD_UPDATED**: User updated payment method

### Signature Validation

**HMAC-SHA256** using `DP_SECRET_KEY`:
```typescript
const dataString = Object.values(payload).join('');
const signature = CryptoJS.HmacSHA256(dataString, SECRET_KEY).toString(CryptoJS.enc.Hex);
```

**RSA-SHA256** using private key for API requests:
```typescript
const sign = crypto.createSign('SHA256');
sign.update(dataString);
const signature = sign.sign(privateKey, 'base64');
```

---

## Conclusion

This implementation plan provides a comprehensive roadmap for integrating DirectPay payment gateway with automated subscription management. The phased approach ensures:

- **Scalability**: Gateway abstraction supports future payment providers
- **Reliability**: Webhook idempotency and error handling prevent data corruption
- **Flexibility**: Two-tier pricing accommodates both new and existing users
- **Control**: Admin-controlled migration reduces risk
- **Maintainability**: Clear separation of concerns and well-documented code

**Next Steps**: Review this plan with stakeholders, prioritize phases, and begin implementation starting with database schema changes.

---

**Document Version**: 1.0
**Last Updated**: 2025-01-18
**Author**: Claude (Anthropic AI)
**Status**: Pending Review
