# DirectPay Payment Retry & Cancellation Implementation

## Overview

This document details the implementation of payment retry logic and cancellation features for DirectPay recurring billing using the wallet + card capture method.

---

## 1. Payment Retry Logic

### Retry Strategy

**Goal**: Maximize successful payment recovery while minimizing user friction.

**Approach**: 3-retry system with exponential backoff + dunning management

```
Failed Payment → Retry 1 (Day 1) → Retry 2 (Day 3) → Retry 3 (Day 7) → Suspend/Cancel
                    ↓                  ↓                  ↓
                 Email 1           Email 2            Final Warning
```

### Database Schema Extensions

```sql
-- Add retry tracking to licensing_custom_subs
ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;
ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS next_retry_date DATE;
ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS grace_period_ends DATE;

-- Payment attempts log
CREATE TABLE IF NOT EXISTS licensing_payment_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES licensing_custom_subs(id),
    wallet_id TEXT NOT NULL,
    card_id TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    currency VARCHAR(5) NOT NULL,
    order_id TEXT NOT NULL,
    attempt_number INTEGER DEFAULT 1,
    status TEXT NOT NULL, -- 'success', 'failed', 'pending'
    failure_reason TEXT,
    transaction_id TEXT,
    directpay_response JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_payment_attempts_subscription ON licensing_payment_attempts(subscription_id, created_at DESC);
CREATE INDEX idx_payment_attempts_status ON licensing_payment_attempts(status, created_at DESC);
```

---

## 2. Retry Service Implementation

### File: `/src/services/payment-retry-service.ts`

```typescript
import db from '../config/db';
import moment from 'moment';
import { DirectPayGateway } from './payment-gateways/directpay-gateway';
import { EmailService } from './email-service';

export class PaymentRetryService {
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_SCHEDULE = [1, 3, 7]; // Days between retries
  private static readonly GRACE_PERIOD_DAYS = 10; // Total grace period before suspension

  /**
   * Process all subscriptions due for retry
   */
  static async processRetries(): Promise<void> {
    const dueForRetry = await db.query(`
      SELECT lcs.*, ldc.wallet_id, ldc.card_id, u.email, u.name
      FROM licensing_custom_subs lcs
      JOIN licensing_directpay_cards ldc ON ldc.id = lcs.card_id
      JOIN users u ON u.id = lcs.user_id
      WHERE lcs.status = 'past_due'
        AND lcs.retry_count < $1
        AND lcs.next_retry_date <= CURRENT_DATE
    `, [this.MAX_RETRIES]);

    for (const subscription of dueForRetry.rows) {
      await this.retryPayment(subscription);
    }
  }

  /**
   * Retry a failed payment
   */
  static async retryPayment(subscription: any): Promise<boolean> {
    const attemptNumber = subscription.retry_count + 1;
    const orderId = `RETRY_${subscription.id}_${attemptNumber}_${Date.now()}`;

    console.log(`[Retry ${attemptNumber}/${this.MAX_RETRIES}] Subscription ${subscription.id}`);

    // Log payment attempt
    const attemptId = await this.logPaymentAttempt(subscription, orderId, attemptNumber, 'pending');

    try {
      // Attempt payment via DirectPay
      const gateway = new DirectPayGateway();
      const response = await gateway.chargeStoredCard({
        walletId: subscription.wallet_id,
        cardId: subscription.card_id,
        orderId,
        amount: parseFloat(subscription.rate),
        currency: subscription.currency
      });

      if (response.transaction.status === 'SUCCESS') {
        // Payment succeeded!
        await this.handleRetrySuccess(subscription, response, attemptId);
        return true;
      } else {
        // Payment failed again
        await this.handleRetryFailure(subscription, response, attemptNumber, attemptId);
        return false;
      }
    } catch (error) {
      console.error(`Retry failed for subscription ${subscription.id}:`, error);
      await this.handleRetryFailure(subscription, { error: error.message }, attemptNumber, attemptId);
      return false;
    }
  }

  /**
   * Handle successful retry
   */
  private static async handleRetrySuccess(
    subscription: any,
    response: any,
    attemptId: string
  ): Promise<void> {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Update payment attempt
      await client.query(`
        UPDATE licensing_payment_attempts
        SET status = 'success',
            transaction_id = $1,
            directpay_response = $2,
            processed_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [response.transaction.id, JSON.stringify(response), attemptId]);

      // Reset subscription to active
      const newEndDate = moment(subscription.end_date || new Date())
        .add(subscription.billing_type === 'month' ? 1 : 12, 'months')
        .format('YYYY-MM-DD');

      await client.query(`
        UPDATE licensing_custom_subs
        SET status = 'active',
            end_date = $1,
            next_billing_date = $1,
            last_payment_date = CURRENT_DATE,
            retry_count = 0,
            last_retry_at = NULL,
            next_retry_date = NULL,
            grace_period_ends = NULL
        WHERE id = $2
      `, [newEndDate, subscription.id]);

      // Log successful payment
      await client.query(`
        INSERT INTO licensing_lkr_payments
        (user_id, subscription_id, amount, transaction_id, transaction_status, payment_type, billing_type)
        VALUES ($1, $2, $3, $4, 'SUCCESS', 'recurring', $5)
      `, [subscription.user_id, subscription.id, subscription.rate, response.transaction.id, subscription.billing_type]);

      await client.query('COMMIT');

      // Send success email
      await EmailService.sendPaymentRetrySuccessEmail(subscription);

      console.log(`✅ Retry successful for subscription ${subscription.id}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Handle failed retry
   */
  private static async handleRetryFailure(
    subscription: any,
    response: any,
    attemptNumber: number,
    attemptId: string
  ): Promise<void> {
    const failureReason = response.transaction?.description || response.error || 'Unknown error';
    const nextRetryDate = attemptNumber < this.MAX_RETRIES
      ? moment().add(this.RETRY_SCHEDULE[attemptNumber], 'days').format('YYYY-MM-DD')
      : null;

    // Update payment attempt
    await db.query(`
      UPDATE licensing_payment_attempts
      SET status = 'failed',
          failure_reason = $1,
          directpay_response = $2,
          processed_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [failureReason, JSON.stringify(response), attemptId]);

    if (attemptNumber >= this.MAX_RETRIES) {
      // Max retries reached - suspend subscription
      await this.suspendSubscription(subscription, failureReason);
    } else {
      // Schedule next retry
      await db.query(`
        UPDATE licensing_custom_subs
        SET retry_count = $1,
            last_retry_at = CURRENT_TIMESTAMP,
            next_retry_date = $2
        WHERE id = $3
      `, [attemptNumber, nextRetryDate, subscription.id]);

      // Send retry notification email
      await EmailService.sendPaymentRetryFailedEmail(subscription, attemptNumber, nextRetryDate);
    }

    console.log(`❌ Retry ${attemptNumber}/${this.MAX_RETRIES} failed for subscription ${subscription.id}`);
  }

  /**
   * Suspend subscription after max retries
   */
  private static async suspendSubscription(subscription: any, reason: string): Promise<void> {
    await db.query(`
      UPDATE licensing_custom_subs
      SET status = 'suspended',
          auto_renew = false,
          cancellation_reason = $1,
          cancelled_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [`Payment failed after ${this.MAX_RETRIES} retry attempts: ${reason}`, subscription.id]);

    // Log suspension
    await db.query(`
      INSERT INTO licensing_custom_subs_logs (subscription_id, log_text, description, admin_user_id)
      VALUES ($1, 'suspended_payment_failure', $2, (SELECT id FROM licensing_admin_users LIMIT 1))
    `, [subscription.id, `Subscription suspended after ${this.MAX_RETRIES} failed payment attempts`]);

    // Send final suspension email
    await EmailService.sendSubscriptionSuspendedEmail(subscription);
  }

  /**
   * Log payment attempt
   */
  private static async logPaymentAttempt(
    subscription: any,
    orderId: string,
    attemptNumber: number,
    status: string
  ): Promise<string> {
    const result = await db.query(`
      INSERT INTO licensing_payment_attempts
      (subscription_id, wallet_id, card_id, amount, currency, order_id, attempt_number, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
      subscription.id,
      subscription.wallet_id,
      subscription.card_id,
      subscription.rate,
      subscription.currency,
      orderId,
      attemptNumber,
      status
    ]);

    return result.rows[0].id;
  }

  /**
   * Manual retry trigger (for admin use)
   */
  static async manualRetry(subscriptionId: string, adminUserId: string): Promise<boolean> {
    const subscription = await db.query(`
      SELECT lcs.*, ldc.wallet_id, ldc.card_id, u.email, u.name
      FROM licensing_custom_subs lcs
      JOIN licensing_directpay_cards ldc ON ldc.id = lcs.card_id
      JOIN users u ON u.id = lcs.user_id
      WHERE lcs.id = $1
    `, [subscriptionId]);

    if (!subscription.rows.length) {
      throw new Error('Subscription not found');
    }

    const success = await this.retryPayment(subscription.rows[0]);

    // Log admin action
    await db.query(`
      INSERT INTO licensing_custom_subs_logs (subscription_id, log_text, description, admin_user_id)
      VALUES ($1, 'manual_retry', $2, $3)
    `, [subscriptionId, `Admin triggered manual payment retry`, adminUserId]);

    return success;
  }
}
```

---

## 3. Cancellation Service Implementation

### File: `/src/services/subscription-cancellation-service.ts`

```typescript
import db from '../config/db';
import moment from 'moment';
import { EmailService } from './email-service';

export class SubscriptionCancellationService {
  /**
   * Cancel subscription immediately
   */
  static async cancelImmediately(
    subscriptionId: string,
    userId: string,
    reason: string,
    initiatedBy: 'user' | 'admin',
    adminUserId?: string
  ): Promise<void> {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Get subscription details
      const subResult = await client.query(`
        SELECT lcs.*, u.email, u.name
        FROM licensing_custom_subs lcs
        JOIN users u ON u.id = lcs.user_id
        WHERE lcs.id = $1 AND lcs.user_id = $2
      `, [subscriptionId, userId]);

      if (!subResult.rows.length) {
        throw new Error('Subscription not found');
      }

      const subscription = subResult.rows[0];

      // Update subscription status
      await client.query(`
        UPDATE licensing_custom_subs
        SET status = 'cancelled',
            auto_renew = false,
            cancellation_reason = $1,
            cancelled_at = CURRENT_TIMESTAMP,
            end_date = CURRENT_DATE -- End immediately
        WHERE id = $2
      `, [reason, subscriptionId]);

      // Log cancellation
      await client.query(`
        INSERT INTO licensing_custom_subs_logs
        (subscription_id, log_text, description, admin_user_id)
        VALUES ($1, 'cancelled_immediately', $2, $3)
      `, [
        subscriptionId,
        `Subscription cancelled immediately by ${initiatedBy}. Reason: ${reason}`,
        adminUserId || subscription.user_id
      ]);

      await client.query('COMMIT');

      // Send cancellation confirmation email
      await EmailService.sendCancellationConfirmationEmail(subscription, 'immediate');

      console.log(`✅ Subscription ${subscriptionId} cancelled immediately`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Cancel subscription at end of billing period
   */
  static async cancelAtPeriodEnd(
    subscriptionId: string,
    userId: string,
    reason: string,
    initiatedBy: 'user' | 'admin',
    adminUserId?: string
  ): Promise<void> {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Get subscription details
      const subResult = await client.query(`
        SELECT lcs.*, u.email, u.name
        FROM licensing_custom_subs lcs
        JOIN users u ON u.id = lcs.user_id
        WHERE lcs.id = $1 AND lcs.user_id = $2
      `, [subscriptionId, userId]);

      if (!subResult.rows.length) {
        throw new Error('Subscription not found');
      }

      const subscription = subResult.rows[0];

      // Update subscription to not auto-renew
      await client.query(`
        UPDATE licensing_custom_subs
        SET auto_renew = false,
            cancellation_reason = $1,
            cancelled_at = CURRENT_TIMESTAMP,
            status = 'cancelling' -- New status: active but won't renew
        WHERE id = $2
      `, [reason, subscriptionId]);

      // Log cancellation
      await client.query(`
        INSERT INTO licensing_custom_subs_logs
        (subscription_id, log_text, description, admin_user_id)
        VALUES ($1, 'cancelled_at_period_end', $2, $3)
      `, [
        subscriptionId,
        `Subscription will cancel at period end (${subscription.end_date}) by ${initiatedBy}. Reason: ${reason}`,
        adminUserId || subscription.user_id
      ]);

      await client.query('COMMIT');

      // Send cancellation confirmation email
      await EmailService.sendCancellationConfirmationEmail(subscription, 'period_end', subscription.end_date);

      console.log(`✅ Subscription ${subscriptionId} scheduled for cancellation on ${subscription.end_date}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reactivate a cancelled/suspended subscription
   */
  static async reactivate(
    subscriptionId: string,
    userId: string,
    initiatedBy: 'user' | 'admin',
    adminUserId?: string
  ): Promise<void> {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Get subscription details
      const subResult = await client.query(`
        SELECT lcs.*, ldc.wallet_id, ldc.card_id
        FROM licensing_custom_subs lcs
        JOIN licensing_directpay_cards ldc ON ldc.id = lcs.card_id
        WHERE lcs.id = $1 AND lcs.user_id = $2
          AND lcs.status IN ('cancelled', 'suspended', 'cancelling')
      `, [subscriptionId, userId]);

      if (!subResult.rows.length) {
        throw new Error('Subscription not found or cannot be reactivated');
      }

      const subscription = subResult.rows[0];

      // Calculate new end date
      const newEndDate = moment()
        .add(subscription.billing_type === 'month' ? 1 : 12, 'months')
        .format('YYYY-MM-DD');

      // Attempt to charge immediately for reactivation
      const DirectPayGateway = (await import('./payment-gateways/directpay-gateway')).DirectPayGateway;
      const gateway = new DirectPayGateway();

      const orderId = `REACTIVATE_${subscriptionId}_${Date.now()}`;
      const response = await gateway.chargeStoredCard({
        walletId: subscription.wallet_id,
        cardId: subscription.card_id,
        orderId,
        amount: parseFloat(subscription.rate),
        currency: subscription.currency
      });

      if (response.transaction.status !== 'SUCCESS') {
        throw new Error(`Payment failed: ${response.transaction.description}`);
      }

      // Reactivate subscription
      await client.query(`
        UPDATE licensing_custom_subs
        SET status = 'active',
            auto_renew = true,
            end_date = $1,
            next_billing_date = $1,
            last_payment_date = CURRENT_DATE,
            cancellation_reason = NULL,
            cancelled_at = NULL,
            retry_count = 0,
            last_retry_at = NULL,
            next_retry_date = NULL
        WHERE id = $2
      `, [newEndDate, subscriptionId]);

      // Log reactivation payment
      await client.query(`
        INSERT INTO licensing_lkr_payments
        (user_id, subscription_id, amount, transaction_id, transaction_status, payment_type, billing_type)
        VALUES ($1, $2, $3, $4, 'SUCCESS', 'reactivation', $5)
      `, [subscription.user_id, subscriptionId, subscription.rate, response.transaction.id, subscription.billing_type]);

      // Log reactivation
      await client.query(`
        INSERT INTO licensing_custom_subs_logs
        (subscription_id, log_text, description, admin_user_id)
        VALUES ($1, 'reactivated', $2, $3)
      `, [
        subscriptionId,
        `Subscription reactivated by ${initiatedBy}. New end date: ${newEndDate}`,
        adminUserId || subscription.user_id
      ]);

      await client.query('COMMIT');

      // Send reactivation confirmation email
      await EmailService.sendReactivationConfirmationEmail(subscription, newEndDate);

      console.log(`✅ Subscription ${subscriptionId} reactivated. New end date: ${newEndDate}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process refund for cancelled subscription
   */
  static async processRefund(
    subscriptionId: string,
    transactionId: string,
    amount: number,
    reason: string,
    adminUserId: string
  ): Promise<void> {
    // Call DirectPay refund API
    const DirectPayGateway = (await import('./payment-gateways/directpay-gateway')).DirectPayGateway;
    const gateway = new DirectPayGateway();

    const refundResponse = await gateway.refundTransaction({
      transactionId,
      amount,
      reason
    });

    if (refundResponse.status !== 200) {
      throw new Error('Refund failed');
    }

    // Log refund
    await db.query(`
      UPDATE licensing_lkr_payments
      SET transaction_status = 'REFUNDED',
          refund_amount = $1,
          refund_reason = $2,
          refunded_at = CURRENT_TIMESTAMP
      WHERE transaction_id = $3
    `, [amount, reason, transactionId]);

    await db.query(`
      INSERT INTO licensing_custom_subs_logs
      (subscription_id, log_text, description, admin_user_id)
      VALUES ($1, 'refund_processed', $2, $3)
    `, [subscriptionId, `Refund of ${amount} processed. Reason: ${reason}`, adminUserId]);

    console.log(`✅ Refund processed for transaction ${transactionId}`);
  }
}
```

---

## 4. Cron Job Configuration

### File: `/src/services/billing-scheduler.ts`

```typescript
import cron from 'node-cron';
import { PaymentRetryService } from './payment-retry-service';
import { BillingCycleService } from './billing-cycle-service';

export class BillingScheduler {
  /**
   * Start all billing-related cron jobs
   */
  static start(): void {
    // Daily billing cycle - Process new charges at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('🔄 [CRON] Running daily billing cycle...');
      try {
        await BillingCycleService.processBillingCycle();
        console.log('✅ [CRON] Daily billing cycle completed');
      } catch (error) {
        console.error('❌ [CRON] Daily billing cycle failed:', error);
      }
    });

    // Payment retry - Run at 10 AM daily
    cron.schedule('0 10 * * *', async () => {
      console.log('🔄 [CRON] Processing payment retries...');
      try {
        await PaymentRetryService.processRetries();
        console.log('✅ [CRON] Payment retries processed');
      } catch (error) {
        console.error('❌ [CRON] Payment retry failed:', error);
      }
    });

    // Clean up expired subscriptions - Run at midnight
    cron.schedule('0 0 * * *', async () => {
      console.log('🔄 [CRON] Cleaning up expired subscriptions...');
      try {
        await this.cleanupExpiredSubscriptions();
        console.log('✅ [CRON] Cleanup completed');
      } catch (error) {
        console.error('❌ [CRON] Cleanup failed:', error);
      }
    });

    console.log('✅ Billing scheduler started');
  }

  /**
   * Mark subscriptions as expired if past end_date
   */
  private static async cleanupExpiredSubscriptions(): Promise<void> {
    const db = (await import('../config/db')).default;

    await db.query(`
      UPDATE licensing_custom_subs
      SET status = 'expired'
      WHERE status = 'cancelling'
        AND end_date < CURRENT_DATE
        AND auto_renew = false
    `);
  }
}
```

### Start scheduler in `app.ts`:

```typescript
import { BillingScheduler } from './services/billing-scheduler';

// After database connection
BillingScheduler.start();
```

---

## 5. API Endpoints

### Cancellation Endpoints

```typescript
// src/controllers/billing-controller.ts

@HandleExceptions()
public static async cancelSubscription(req: IWorkLenzRequest, res: IWorkLenzResponse) {
  const { subscriptionId, reason, cancelImmediately } = req.body;

  if (cancelImmediately) {
    await SubscriptionCancellationService.cancelImmediately(
      subscriptionId,
      req.user?.id!,
      reason,
      'user'
    );
  } else {
    await SubscriptionCancellationService.cancelAtPeriodEnd(
      subscriptionId,
      req.user?.id!,
      reason,
      'user'
    );
  }

  return res.status(200).send(new ServerResponse(true, { message: 'Subscription cancelled' }));
}

@HandleExceptions()
public static async reactivateSubscription(req: IWorkLenzRequest, res: IWorkLenzResponse) {
  const { subscriptionId } = req.body;

  await SubscriptionCancellationService.reactivate(
    subscriptionId,
    req.user?.id!,
    'user'
  );

  return res.status(200).send(new ServerResponse(true, { message: 'Subscription reactivated' }));
}
```

### Admin Endpoints

```typescript
// src/controllers/admin-center-controller.ts

@HandleExceptions()
@RequireAdminAuth()
public static async manualRetry(req: IWorkLenzRequest, res: IWorkLenzResponse) {
  const { subscriptionId } = req.body;

  const success = await PaymentRetryService.manualRetry(
    subscriptionId,
    req.user?.id!
  );

  return res.status(200).send(new ServerResponse(true, { success }));
}

@HandleExceptions()
@RequireAdminAuth()
public static async processRefund(req: IWorkLenzRequest, res: IWorkLenzResponse) {
  const { subscriptionId, transactionId, amount, reason } = req.body;

  await SubscriptionCancellationService.processRefund(
    subscriptionId,
    transactionId,
    amount,
    reason,
    req.user?.id!
  );

  return res.status(200).send(new ServerResponse(true, { message: 'Refund processed' }));
}
```

### Routes

```typescript
// Billing routes
router.post('/cancel-subscription', BillingController.cancelSubscription);
router.post('/reactivate-subscription', BillingController.reactivateSubscription);

// Admin routes
router.post('/billing/manual-retry', AdminCenterController.manualRetry);
router.post('/billing/refund', AdminCenterController.processRefund);
```

---

## 6. Email Notifications

### Email Templates Needed

1. **Payment Retry Failed** - After each retry attempt
2. **Payment Retry Success** - When retry succeeds
3. **Subscription Suspended** - After max retries
4. **Cancellation Confirmation** - Immediate or period-end
5. **Reactivation Confirmation** - When reactivated
6. **Refund Processed** - Refund confirmation

---

## 7. Monitoring & Alerts

### Metrics to Track

```sql
-- Failed payment rate
SELECT
  DATE(created_at) as date,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
  COUNT(*) FILTER (WHERE status = 'success') as success_count,
  ROUND(COUNT(*) FILTER (WHERE status = 'failed') * 100.0 / COUNT(*), 2) as failure_rate
FROM licensing_payment_attempts
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Subscription health
SELECT
  status,
  COUNT(*) as count,
  SUM(rate) as total_revenue
FROM licensing_custom_subs
GROUP BY status;

-- Retry success rate
SELECT
  attempt_number,
  COUNT(*) FILTER (WHERE status = 'success') as successes,
  COUNT(*) FILTER (WHERE status = 'failed') as failures,
  ROUND(COUNT(*) FILTER (WHERE status = 'success') * 100.0 / COUNT(*), 2) as success_rate
FROM licensing_payment_attempts
WHERE attempt_number > 1
GROUP BY attempt_number
ORDER BY attempt_number;
```

---

## 8. Testing Checklist

- [ ] Test payment retry on Day 1, 3, 7
- [ ] Test max retries reached → suspension
- [ ] Test successful retry → reset retry count
- [ ] Test immediate cancellation
- [ ] Test cancellation at period end
- [ ] Test reactivation with payment
- [ ] Test reactivation payment failure
- [ ] Test refund processing
- [ ] Test admin manual retry
- [ ] Test cron job execution
- [ ] Test email notifications
- [ ] Test concurrent retry processing

---

## Summary

This implementation provides:
✅ Robust 3-retry payment system with exponential backoff
✅ Flexible cancellation (immediate or end-of-period)
✅ Easy reactivation with payment
✅ Comprehensive refund handling
✅ Admin controls for manual interventions
✅ Full audit trail via logs
✅ Email notifications at every step
✅ Monitoring queries for business insights
