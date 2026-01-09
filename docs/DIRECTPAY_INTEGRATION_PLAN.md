# DirectPay Payment Gateway Integration Plan

> **Note**: All code snippets in this document are sample code for illustration purposes. Actual implementation may differ based on evolving requirements, code reviews, and technical constraints discovered during development.

## Overview

Implement DirectPay payment gateway for Sri Lankan users in the **Worklenz License Manager backend** with automated subscription billing using wallet + card capture approach. This provides full control over billing cycles, payment retries, and custom pricing while matching Paddle's functionality. Enable admin-controlled migration of existing custom plan users while preserving their custom pricing.

## Architecture Context

The Worklenz system has **two separate backends** sharing the same PostgreSQL database:

1. **Main Worklenz Backend** (`/worklenz-business/worklenz-backend`): Handles core application features (projects, tasks, teams, etc.)
2. **License Manager Backend** (`/Worklenz License Manager/worklenz-license-manager-backend`): **Handles all billing and licensing operations**

**DirectPay integration will be implemented entirely in the License Manager backend** alongside the existing Paddle integration, following the same architectural patterns.

## Requirements Summary

- **Priority**: Full automation for new and existing users
- **Migration Strategy**: Admin-controlled (manual, one-by-one migration)
- **Pricing Model**: Fixed LKR pricing for new users, preserve custom rates for existing users
- **DirectPay Approach**: Wallet + card capture (manual billing) with automatic retry logic via cron jobs

## DirectPay Integration Approach

### **Recommended: Wallet + Card Capture (Manual Billing)**
This is our PRIMARY approach for better control and flexibility:

1. **Initial Card Setup**: User pays with `type: "CARD_ADD"` → DirectPay saves card in wallet
2. **Scheduled Billing**: Our cron job (`node-cron`) triggers billing on the due date
3. **Manual Charge**: Backend calls `POST /api/v3/cardPay` with stored `wallet_id` + `card_id`
4. **Retry Logic**: If payment fails, our retry service handles 3 attempts (Day 1, 3, 7)
5. **Subscription Extension**: On success, backend extends `end_date` and updates status

**Why This Approach?**
- ✅ Full control over billing timing and retry logic
- ✅ Easier to implement custom business logic (proration, plan changes, custom pricing)
- ✅ Better for admin-controlled migrations of existing users
- ✅ Supports complex scenarios (manual extensions, custom rates)
- ✅ Transparent failure handling with graceful degradation

### Alternative: Automatic Recurring Subscriptions
DirectPay also supports automatic recurring billing with `type: "RECURRING"`:
1. **Initial Setup**: User pays with `type: "RECURRING"` → DirectPay saves card and schedules billing
2. **Automatic Billing**: DirectPay automatically charges the card each billing cycle
3. **Webhook Notifications**: DirectPay sends webhook on each successful/failed payment
4. **Subscription Extension**: Our backend receives webhook and extends `end_date`

**Trade-offs**: Less control, harder to implement custom retry logic and business rules.

### Key APIs (Primary Flow)
- **Add Card to Wallet**: `POST /api/v3/create-session` with `type: "CARD_ADD"`
- **Charge Stored Card**: `POST /api/v3/cardPay` (our main billing endpoint)
- **List Cards**: `POST /api/v3/listCard`
- **Delete Card**: `POST /api/v3/deleteCard`
- **Check Status**: `POST /api/v3/checkPaymentStatus`

> **📄 Related Documentation**: See [DIRECTPAY_RETRY_AND_CANCELLATION.md](./DIRECTPAY_RETRY_AND_CANCELLATION.md) for comprehensive payment retry logic, cancellation features, cron job implementation, and failure handling strategies.

### Environment Variables Required

Add to `/Worklenz License Manager/worklenz-license-manager-backend/.env`:

```bash
# DirectPay Configuration
DP_MERCHANT_ID=your_merchant_id_here
DP_SECRET_KEY=your_secret_key_here
DP_BASE_URL=https://test-gateway.directpay.lk  # or https://gateway.directpay.lk for production
DP_STAGE=DEV  # DEV, UAT, or PROD

# Frontend URL for DirectPay redirects
FRONTEND_URL=https://app.worklenz.com  # or your frontend URL
BACKEND_URL=https://licensing.worklenz.com  # License Manager backend URL
```

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

**Migration File**: The License Manager uses the same database as the main backend. Database migrations should be added to the main backend repository: `/worklenz-backend/database/migrations/20250118000000-add-directpay-subscription-support.sql`

---

## Phase 2: Backend Gateway Abstraction (License Manager)

### Gateway Abstraction Layer Design

Create a unified interface that abstracts payment gateway operations in the License Manager backend, making it easy to support multiple providers.

> **📁 Location**: All Phase 2 files will be created in `/Worklenz License Manager/worklenz-license-manager-backend/src/`

#### Base Payment Gateway Interface

**File**: `/worklenz-license-manager-backend/src/services/payment-gateways/base-payment-gateway.ts`

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

**File**: `/worklenz-license-manager-backend/src/services/payment-gateways/directpay-gateway.ts`

```typescript
import { BasePaymentGateway, ICheckoutParams, ICheckoutResponse } from './base-payment-gateway';
import CryptoJS from 'crypto-js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import moment from 'moment';
import db from '../../config/db';

export class DirectPayGateway extends BasePaymentGateway {
  private readonly CREATE_SESSION_URL = '/api/v3/create-session';
  private readonly CARD_PAY_URL = '/api/v3/cardPay';
  private readonly LIST_CARDS_URL = '/api/v3/listCard';
  private readonly DELETE_CARD_URL = '/api/v3/deleteCard';
  private readonly CHECK_STATUS_URL = '/api/v3/checkPaymentStatus';

  constructor() {
    super({
      merchantId: process.env.DP_MERCHANT_ID,
      secretKey: process.env.DP_SECRET_KEY,
      baseUrl: process.env.DP_BASE_URL, // https://test-gateway.directpay.lk or https://gateway.directpay.lk
      stage: process.env.DP_STAGE // DEV, UAT, PROD
    }, 'DirectPay');
  }

  async generateCheckout(params: ICheckoutParams): Promise<ICheckoutResponse> {
    // Fetch user details
    const userQuery = `SELECT name, email FROM users WHERE id = $1`;
    const userResult = await db.query(userQuery, [params.userId]);
    const user = userResult.rows[0];

    const uniqueTimestamp = moment().format('YYYYMMDDHHmmss');
    const orderId = `WORKLENZ_${uniqueTimestamp}`;

    // DirectPay wallet + card capture approach
    // Use CARD_ADD to save card to wallet without immediate recurring
    const payload = {
      merchant_id: this.config.merchantId,
      amount: params.amount.toString(),
      source: 'worklenz-app',
      type: 'CARD_ADD', // Add card to wallet - we'll charge manually via cron
      order_id: orderId,
      currency: params.currency,
      response_url: `${process.env.BACKEND_URL}/api/billing/directpay-webhook`,
      return_url: `${process.env.FRONTEND_URL}/billing/payment-success`,
      first_name: user.name.split(' ')[0],
      last_name: user.name.split(' ').slice(1).join(' ') || user.name.split(' ')[0],
      email: user.email,
      phone: user.phone || '',
      description: `Worklenz ${params.billingType === 'year' ? 'Annual' : 'Monthly'} Subscription - Initial Setup`,
      logo: ''
    };

    // Generate HMAC SHA-256 signature per DirectPay spec
    const jsonEncoded = JSON.stringify(payload);
    const base64Encoded = Buffer.from(jsonEncoded).toString('base64');
    const signature = crypto
      .createHmac('sha256', this.config.secretKey)
      .update(base64Encoded)
      .digest('hex');

    return {
      signature: `hmac ${signature}`,
      dataString: base64Encoded,
      stage: this.config.stage
    };
  }

  /**
   * Charge a stored card (manual billing approach)
   * Called by cron job or retry service
   */
  async chargeStoredCard(params: {
    walletId: string;
    cardId: string;
    orderId: string;
    amount: number;
    currency: string;
    description?: string;
  }): Promise<any> {
    const payload = {
      merchant_id: this.config.merchantId,
      wallet_id: params.walletId,
      card_id: params.cardId,
      order_id: params.orderId,
      currency: params.currency,
      amount: params.amount.toString(),
      description: params.description || 'Worklenz Subscription Payment'
    };

    // Generate signature
    const jsonEncoded = JSON.stringify(payload);
    const base64Encoded = Buffer.from(jsonEncoded).toString('base64');
    const signature = crypto
      .createHmac('sha256', this.config.secretKey)
      .update(base64Encoded)
      .digest('hex');

    // Call DirectPay cardPay endpoint
    const response = await fetch(`${this.config.baseUrl}${this.CARD_PAY_URL}`, {
      method: 'POST',
      headers: {
        'Authorization': `hmac ${signature}`,
        'Content-Type': 'text/plain'
      },
      body: base64Encoded
    });

    const responseData = await response.text();
    const decodedResponse = JSON.parse(Buffer.from(responseData, 'base64').toString('utf-8'));

    return decodedResponse;
  }

  async processWebhook(payload: any, signature?: string): Promise<any> {
    // Validate webhook signature
    const isValid = this.validateWebhookSignature(payload, signature);
    if (!isValid) {
      return { isValid: false, error: 'Invalid signature' };
    }

    // DirectPay sends base64 encoded payload
    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));

    // Handle based on transaction status and payment_type
    const status = decodedPayload.transaction?.status;
    const paymentType = decodedPayload.payment_type || 'initial';

    if (status === 'SUCCESS') {
      await this.handlePaymentSuccess(decodedPayload, paymentType);
    } else if (status === 'FAILED') {
      await this.handlePaymentFailed(decodedPayload);
    }

    return { isValid: true, payload: decodedPayload };
  }

  private async handlePaymentSuccess(payload: any, paymentType: string): Promise<void> {
    const txnId = payload.transaction.id;
    const walletId = payload.walletId;
    const cardInfo = payload.card;

    // Find subscription by order_id or wallet_id
    const subscriptionQuery = `
      SELECT lcs.* FROM licensing_custom_subs lcs
      LEFT JOIN licensing_directpay_cards ldc ON ldc.id = lcs.card_id
      WHERE ldc.wallet_id = $1 OR lcs.id IN (
        SELECT subscription_id FROM licensing_lkr_payments WHERE order_id = $2
      )
      ORDER BY lcs.created_at DESC LIMIT 1
    `;
    const result = await db.query(subscriptionQuery, [walletId, payload.order_id]);
    const subscription = result.rows[0];

    if (!subscription) return;

    // For recurring payments, extend subscription
    if (paymentType === 'recurring') {
      const newEndDate = moment(subscription.end_date)
        .add(subscription.billing_type === 'month' ? 1 : 12, 'months');

      await db.query(`
        UPDATE licensing_custom_subs
        SET end_date = $1,
            last_payment_date = CURRENT_DATE,
            next_billing_date = $1,
            status = 'active'
        WHERE id = $2
      `, [newEndDate.format('YYYY-MM-DD'), subscription.id]);
    }

    // Save payment record
    await db.query(`
      INSERT INTO licensing_lkr_payments
      (user_id, subscription_id, amount, transaction_id, transaction_status, payment_type, billing_type)
      VALUES ($1, $2, $3, $4, 'SUCCESS', $5, $6)
    `, [subscription.user_id, subscription.id, payload.transaction.amount, txnId, paymentType, subscription.billing_type]);

    // Save card info if not already saved
    if (cardInfo && cardInfo.id) {
      await this.saveCardInfo(subscription.user_id, cardInfo, walletId);
    }
  }

  private async handlePaymentFailed(payload: any): Promise<void> {
    const walletId = payload.walletId;

    await db.query(`
      UPDATE licensing_custom_subs lcs
      SET status = 'past_due'
      FROM licensing_directpay_cards ldc
      WHERE ldc.id = lcs.card_id AND ldc.wallet_id = $1
    `, [walletId]);
  }

  private validateWebhookSignature(requestBody: string, signature?: string): boolean {
    if (!signature) return false;

    const parts = signature.split(' ');
    if (parts.length !== 2 || parts[0] !== 'hmac') return false;

    const receivedHash = parts[1];
    const computedHash = crypto
      .createHmac('sha256', this.config.secretKey)
      .update(requestBody)
      .digest('hex');

    return receivedHash === computedHash;
  }

  private async saveCardInfo(userId: string, cardInfo: any, walletId: string): Promise<void> {
    await db.query(`
      INSERT INTO licensing_directpay_cards
      (user_id, card_id, card_number_masked, card_brand, card_type,
       expiry_month, expiry_year, wallet_id, is_default)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      ON CONFLICT (user_id, card_id) DO UPDATE
      SET last_used_at = CURRENT_TIMESTAMP
    `, [userId, cardInfo.id, cardInfo.number, cardInfo.brand, cardInfo.type,
        cardInfo.expiry.month, cardInfo.expiry.year, walletId]);
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

**File**: `/worklenz-license-manager-backend/src/services/payment-gateways/paddle-gateway.ts`

> **Note**: The License Manager already has `paddle-controller.ts` and `paddle-sdk.ts`. This wrapper integrates them into the gateway abstraction pattern.

```typescript
import { BasePaymentGateway } from './base-payment-gateway';
import PaddleController from '../../controllers/paddle-controller';
import { PaddleSDK } from '../../controllers/paddle-sdk';

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

**File**: `/worklenz-license-manager-backend/src/services/payment-gateways/gateway-factory.ts`

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

**File**: `/worklenz-license-manager-backend/src/services/subscription-management-service.ts`

> **Note**: This extends the existing `CustomSubsController` functionality with automated DirectPay billing.

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

### Billing Cycle Service (Cron Jobs)

**File**: `/worklenz-license-manager-backend/src/services/billing-cycle-service.ts`

Since we're using the wallet + card capture approach, we need a scheduled service to automatically charge cards on billing dates.

```typescript
import cron from 'node-cron';
import db from '../config/db';
import moment from 'moment';
import { PaymentGatewayFactory } from './payment-gateways/gateway-factory';
import { DirectPayGateway } from './payment-gateways/directpay-gateway';

export class BillingCycleService {
  /**
   * Start all billing-related cron jobs
   */
  static start(): void {
    console.log('Starting billing cycle cron jobs...');

    // Daily billing cycle - Process subscriptions due for billing at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('Running daily billing cycle...');
      await this.processBillingCycle();
    });

    console.log('Billing cron jobs started successfully');
  }

  /**
   * Process all subscriptions due for billing today
   */
  static async processBillingCycle(): Promise<void> {
    try {
      // Find all active subscriptions due for billing today
      const query = `
        SELECT
          lcs.id as subscription_id,
          lcs.user_id,
          lcs.billing_type,
          lcs.rate,
          lcs.currency,
          ldc.wallet_id,
          ldc.card_id,
          u.email,
          u.name
        FROM licensing_custom_subs lcs
        JOIN licensing_directpay_cards ldc ON ldc.id = lcs.card_id
        JOIN users u ON u.id = lcs.user_id
        WHERE lcs.status = 'active'
          AND lcs.auto_renew = true
          AND lcs.next_billing_date <= CURRENT_DATE
          AND lcs.payment_gateway_id = (SELECT id FROM licensing_payment_gateways WHERE name = 'directpay')
          AND ldc.is_active = true
      `;

      const result = await db.query(query);
      const subscriptionsDue = result.rows;

      console.log(`Found ${subscriptionsDue.length} subscriptions due for billing`);

      for (const sub of subscriptionsDue) {
        await this.processSubscriptionBilling(sub);

        // Rate limiting - wait 500ms between billing attempts
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log('Daily billing cycle completed');
    } catch (error) {
      console.error('Error in billing cycle:', error);
    }
  }

  /**
   * Process billing for a single subscription
   */
  private static async processSubscriptionBilling(subscription: any): Promise<void> {
    const {
      subscription_id,
      user_id,
      billing_type,
      rate,
      currency,
      wallet_id,
      card_id,
      email,
      name
    } = subscription;

    try {
      const orderId = `BILLING_${subscription_id}_${moment().format('YYYYMMDDHHmmss')}`;

      // Charge the stored card
      const gateway = await PaymentGatewayFactory.getGateway('directpay') as DirectPayGateway;
      const response = await gateway.chargeStoredCard({
        walletId: wallet_id,
        cardId: card_id,
        orderId,
        amount: parseFloat(rate),
        currency,
        description: `Worklenz ${billing_type === 'month' ? 'Monthly' : 'Annual'} Subscription`
      });

      if (response.transaction?.status === 'SUCCESS') {
        await this.handleBillingSuccess(subscription_id, response, orderId);
        console.log(`✓ Billing successful for subscription ${subscription_id}`);
      } else {
        await this.handleBillingFailure(subscription_id, response, orderId);
        console.log(`✗ Billing failed for subscription ${subscription_id}`);
      }
    } catch (error) {
      console.error(`Error billing subscription ${subscription_id}:`, error);
      await this.handleBillingFailure(subscription_id, { error: error.message }, 'ERROR');
    }
  }

  /**
   * Handle successful billing
   */
  private static async handleBillingSuccess(
    subscriptionId: string,
    response: any,
    orderId: string
  ): Promise<void> {
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // Get subscription details
      const subQuery = `SELECT billing_type, user_id, rate FROM licensing_custom_subs WHERE id = $1`;
      const subResult = await client.query(subQuery, [subscriptionId]);
      const sub = subResult.rows[0];

      // Calculate new end date
      const newEndDate = moment()
        .add(sub.billing_type === 'month' ? 1 : 12, 'months')
        .format('YYYY-MM-DD');

      // Extend subscription
      await client.query(`
        UPDATE licensing_custom_subs
        SET end_date = $1,
            next_billing_date = $1,
            last_payment_date = CURRENT_DATE,
            status = 'active',
            retry_count = 0,
            last_retry_at = NULL,
            next_retry_date = NULL
        WHERE id = $2
      `, [newEndDate, subscriptionId]);

      // Record payment
      await client.query(`
        INSERT INTO licensing_lkr_payments (
          user_id, subscription_id, amount, transaction_id,
          transaction_status, payment_type, billing_type, order_id
        ) VALUES ($1, $2, $3, $4, 'SUCCESS', 'recurring', $5, $6)
      `, [
        sub.user_id,
        subscriptionId,
        sub.rate,
        response.transaction.id,
        sub.billing_type,
        orderId
      ]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Handle billing failure - initiate retry process
   */
  private static async handleBillingFailure(
    subscriptionId: string,
    response: any,
    orderId: string
  ): Promise<void> {
    await db.query(`
      UPDATE licensing_custom_subs
      SET status = 'past_due',
          retry_count = 0,
          next_retry_date = CURRENT_DATE + INTERVAL '1 day'
      WHERE id = $1
    `, [subscriptionId]);

    // Log failed payment attempt
    await db.query(`
      INSERT INTO licensing_payment_attempts (
        subscription_id, attempt_number, status, failure_reason, order_id
      ) VALUES ($1, 0, 'failed', $2, $3)
    `, [
      subscriptionId,
      response.transaction?.failure_reason || response.error || 'Unknown error',
      orderId
    ]);
  }
}
```

**Usage**: Start cron jobs in the License Manager server startup:

```typescript
// In /worklenz-license-manager-backend/src/bin/www or after app initialization
import { BillingCycleService } from '../services/billing-cycle-service';

// After server starts (in bin/www)
BillingCycleService.start();
console.log('DirectPay billing cron jobs started');
```

> **⚠️ Important**: The retry logic is handled separately by `PaymentRetryService` (see [DIRECTPAY_RETRY_AND_CANCELLATION.md](./DIRECTPAY_RETRY_AND_CANCELLATION.md)). The billing cycle service only handles the initial billing attempt and marks subscriptions as `past_due` on failure.

---

## Phase 3: Backend API Endpoints (License Manager)

> **📁 Location**: All Phase 3 files will be in `/Worklenz License Manager/worklenz-license-manager-backend/src/`

### DirectPay Controller (New)

Instead of modifying existing controllers, create a new dedicated **DirectPay Controller** following the same pattern as `paddle-controller.ts`.

**File**: `/worklenz-license-manager-backend/src/controllers/directpay-controller.ts`

```typescript
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { log_error } from "../shared/utils";
import { DirectPayGateway } from "../services/payment-gateways/directpay-gateway";
import { SubscriptionManagementService } from "../services/subscription-management-service";

export default class DirectPayController extends WorklenzControllerBase {
```

Add the following methods to the `DirectPayController` class:

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

Create new DirectPay API router following the same pattern as `paddle-api-router.ts`.

**File**: `/worklenz-license-manager-backend/src/routes/apis/directpay-api-router.ts`

```typescript
import express from "express";
import DirectPayController from "../../controllers/directpay-controller";

const router = express.Router();

// Public webhook endpoint (no auth)
router.post('/webhook', DirectPayController.handleDirectPayWebhook);

// Authenticated endpoints
router.post('/create-subscription', DirectPayController.createCustomSubscription);
router.get('/pricing', DirectPayController.getCustomPlanPricing);
router.post('/cancel-subscription', DirectPayController.cancelSubscription);
router.get('/saved-cards', DirectPayController.getSavedCards);
router.delete('/saved-cards/:cardId', DirectPayController.deleteCard);

// Admin-only endpoints
router.post('/admin/switch-gateway', DirectPayController.switchPaymentGateway);
router.get('/admin/subscriptions', DirectPayController.listCustomSubscriptions);
router.post('/admin/extend-subscription', DirectPayController.manualExtendSubscription);

export default router;
```

**Register in main app**: Add to `/worklenz-license-manager-backend/src/app.ts`:

```typescript
import directpayApiRouter from "./routes/apis/directpay-api-router";

// After paddle routes (around line 98)
app.use("/directpay-secure", jwtValidator, directpayApiRouter);

// Webhook route without auth (around line 114, similar to paddle-webhook)
app.use("/directpay-webhook", directpayApiRouter);
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

> **Important**: DirectPay is implemented in the **License Manager backend**, not the main Worklenz backend.

1. **Schedule Maintenance Window** (if needed for schema changes)

2. **Database Migration** (Main Backend)
   ```bash
   cd worklenz-backend
   npm run migrate:up -- 20250118000000-add-directpay-subscription-support.sql
   ```

3. **Deploy License Manager Backend** (PRIMARY)
   ```bash
   cd "Worklenz License Manager/worklenz-license-manager-backend"
   git pull origin main
   npm install
   npm run build
   pm2 restart worklenz-license-manager

   # Verify cron jobs started
   pm2 logs worklenz-license-manager | grep "billing cron"
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
   - Check License Manager health endpoints
   - Verify cron jobs are running (`BillingCycleService.start()`)
   - Test DirectPay checkout with sandbox account
   - Verify webhook endpoint is accessible: `POST https://licensing.worklenz.com/directpay-webhook`
   - Monitor error logs for 30 minutes

### Admin-Controlled Migration Process

#### Migration Script

**File**: `/worklenz-license-manager-backend/scripts/migrate-user-to-directpay.ts`

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

### Database Migrations (Main Backend)
1. `/worklenz-backend/database/migrations/20250118000000-add-directpay-subscription-support.sql`

### License Manager Backend (New Files)
1. `/worklenz-license-manager-backend/src/controllers/directpay-controller.ts` - Main DirectPay controller
2. `/worklenz-license-manager-backend/src/services/payment-gateways/base-payment-gateway.ts` - Gateway abstraction
3. `/worklenz-license-manager-backend/src/services/payment-gateways/paddle-gateway.ts` - Paddle wrapper
4. `/worklenz-license-manager-backend/src/services/payment-gateways/directpay-gateway.ts` - DirectPay implementation
5. `/worklenz-license-manager-backend/src/services/payment-gateways/gateway-factory.ts` - Gateway selector
6. `/worklenz-license-manager-backend/src/services/subscription-management-service.ts` - Subscription logic
7. `/worklenz-license-manager-backend/src/services/billing-cycle-service.ts` - Cron jobs for wallet + card capture
8. `/worklenz-license-manager-backend/src/routes/apis/directpay-api-router.ts` - API routes
9. `/worklenz-license-manager-backend/scripts/migrate-user-to-directpay.ts` - Migration script

### License Manager Backend (Modified Files)
1. `/worklenz-license-manager-backend/src/app.ts` - Register DirectPay routes and start cron jobs
2. `/worklenz-license-manager-backend/src/bin/www` - Initialize BillingCycleService on startup

### Frontend (New Files)
1. `/worklenz-frontend/src/components/admin-center/billing/saved-cards/SavedCards.tsx`
2. `/worklenz-frontend/src/components/admin-center/billing/admin/GatewaySwitcher.tsx`

### Frontend (Modified Files)
1. `/worklenz-frontend/src/components/admin-center/billing/drawers/upgrade-plans/UpgradePlans.tsx`
2. `/worklenz-frontend/src/api/admin-center/billing.api.service.ts`

---

## Key Design Decisions Rationale

### 1. Wallet + Card Capture Over Automatic Recurring

**Decision**: Use `type: "CARD_ADD"` with manual billing via `POST /api/v3/cardPay` instead of DirectPay's automatic recurring (`type: "RECURRING"`).

**Rationale**:
- **Full Control**: We control exactly when charges occur, enabling custom billing logic
- **Better Retry Logic**: Our 3-retry system with exponential backoff (Day 1, 3, 7) is more sophisticated than DirectPay's default retry
- **Custom Pricing Support**: Easier to handle existing users with custom rates, proration, and plan changes
- **Admin Flexibility**: Admins can manually extend subscriptions, pause billing, or adjust amounts mid-cycle
- **Graceful Failure Handling**: We can implement custom dunning management and user notifications
- **Complex Scenarios**: Supports manual migrations, custom business rules, and non-standard billing cycles
- **Transparency**: Full audit trail via `licensing_payment_attempts` table
- **Testing**: Easier to test billing logic in isolation without waiting for DirectPay's schedule

**Trade-off Accepted**: Requires maintaining cron jobs and retry infrastructure, but provides significantly more control and flexibility.

### 2. Two-Tier Pricing Strategy

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

### DirectPay API Endpoints

**Base URLs:**
- Development: `https://test-gateway.directpay.lk/api/v3/`
- Production: `https://gateway.directpay.lk/api/v3/`

**Endpoints:**

1. **Create Payment Session** (for RECURRING or CARD_ADD)
   - `POST /create-session`
   - Returns: `{ signature, dataString, stage }` for SDK initialization

2. **Pay Using Stored Card**
   - `POST /cardPay`
   - Body: `{ merchant_id, wallet_id, card_id, order_id, currency, amount }`

3. **List User's Cards**
   - `POST /listCard`
   - Body: `{ merchant_id, wallet_id }`

4. **Delete Card**
   - `POST /deleteCard`
   - Body: `{ merchant_id, card_id }`

5. **Check Transaction Status**
   - `POST /checkPaymentStatus`
   - Body: `{ merchant_id, order_id }`

6. **Authorize Payment** (Reserve funds)
   - `POST /cardAuthorize`
   - Body: `{ merchant_id, wallet_id, card_id, order_id, currency, amount }`

7. **Capture Payment** (Capture authorized funds)
   - `POST /cardCapture`
   - Body: `{ merchant_id, wallet_id, card_id, order_id, currency, amount, auth_transaction_id }`

8. **Void Transaction**
   - `POST /void-transaction`
   - Body: `{ merchant_id, transaction_id, merchant_note }`

9. **Refund Transaction**
   - `POST /refund-transaction`
   - Body: `{ merchant_id, transaction_id, amount, merchant_note }`

### Payment Types

1. **RECURRING**: Automatic recurring billing (DirectPay handles scheduling)
2. **CARD_ADD**: Add card to wallet without initial payment
3. **CARD_TOKEN_PAYMENT**: One-time payment with stored card (with 3DS check)
4. **ONE_TIME**: Regular one-time payment

### Webhook Response Structure

DirectPay sends base64 encoded JSON to `response_url`:

```json
{
  "status": 200,
  "walletId": "102",
  "card": {
    "id": 367,
    "number": "512345xxxxxx0008",
    "brand": "MASTERCARD",
    "type": "CREDIT",
    "expiry": { "year": "25", "month": "12" }
  },
  "transaction": {
    "id": 110812,
    "status": "SUCCESS",
    "amount": "122.22",
    "currency": "LKR",
    "channel": "MASTERCARD",
    "dateTime": "2022-02-02 10:28:25"
  },
  "promotion": {
    "apply": false,
    "pay_type": "RECURRING"
  }
}
```

### Signature Validation

**For API Requests (sending to DirectPay):**
```typescript
// Step 1: JSON encode payload
const jsonEncoded = JSON.stringify(payload);

// Step 2: Base64 encode
const base64Encoded = Buffer.from(jsonEncoded).toString('base64');

// Step 3: Generate HMAC SHA-256
const hash = crypto
  .createHmac('sha256', SECRET_KEY)
  .update(base64Encoded)
  .digest('hex');

// Step 4: Prepend "hmac "
const signature = `hmac ${hash}`;

// Step 5: Send in Authorization header
headers: {
  'Authorization': signature,
  'Content-Type': 'text/plain'
}
// Body: base64Encoded string
```

**For Webhook Validation (receiving from DirectPay):**
```typescript
// DirectPay sends: Authorization header with "hmac <hash>"
const signature = request.headers['authorization'];
const requestBody = request.body; // base64 encoded string

// Split signature
const [prefix, receivedHash] = signature.split(' ');

// Compute hash from request body
const computedHash = crypto
  .createHmac('sha256', SECRET_KEY)
  .update(requestBody)
  .digest('hex');

// Validate
const isValid = receivedHash === computedHash;
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
