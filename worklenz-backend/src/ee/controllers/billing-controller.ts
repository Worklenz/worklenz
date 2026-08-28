import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";

import db from "../../config/db";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../../controllers/worklenz-controller-base";
import HandleExceptions from "../../decorators/handle-exceptions";
import { getTeamMemberCount } from "../shared/paddle-utils";
import { generatePayLinkRequest, updateUsers } from "../shared/paddle-requests";

import axios from "axios";

import crypto from "crypto";
import { isIP } from "net";
import { log_error } from "../../shared/utils";
import { sendEmail } from "../../shared/email";

interface IDirectPaySessionOwner {
  userId: string | null;
  ownerId: string | null;
}

interface IDirectPayNormalizedResponse {
  status: string | null;
  orderId: string | null;
  walletId: string | null;
  card: any;
  cardId: string | null;
  transaction: any;
  transactionId: string | null;
}

export default class BillingController extends WorklenzControllerBase {
  private static readonly DIRECTPAY_CARD_ORDER_PREFIX = "WL_CARD";

  @HandleExceptions()
  public static async upgradeToPaidPlan(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { plan, seatCount } = req.query;

    const teamMemberData = await getTeamMemberCount(req.user?.owner_id ?? "");
    if (seatCount) {
      teamMemberData.user_count = parseInt(seatCount as string, 10);
    }
    const axiosResponse = await generatePayLinkRequest(teamMemberData, plan as string, req.user?.owner_id, req.user?.id);

    return res.status(200).send(new ServerResponse(true, axiosResponse.body));
  }

  @HandleExceptions()
  public static async addMoreSeats(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { seatCount } = req.body;

    const q = `SELECT subscription_id
    FROM licensing_user_subscriptions lus
    WHERE user_id = $1;`;
    const result = await db.query(q, [req.user?.owner_id]);
    const [data] = result.rows;

    const response = await updateUsers(data.subscription_id, seatCount);

    if (!response.body.subscription_id) {
      return res.status(200).send(new ServerResponse(false, null, response.message || "Please check your subscription."));
    }
    return res.status(200).send(new ServerResponse(true, null, "Your purchase has been successfully completed!").withTitle("Done"));
  }

  @HandleExceptions()
  public static async contactUs(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { contactNo } = req.query;

    if (!contactNo) {
      return res.status(200).send(new ServerResponse(false, null, "Contact number is required!"));
    }

    const html = `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Worklenz Local Billing - Contact Information</title>
      </head>
      <body>
          <div>
              <h1 style="text-align: center; margin-bottom: 20px;">Worklenz Local Billing - Contact Information</h1>
              <p><strong>Name:</strong> ${req.user?.name}</p>
              <p><strong>Contact No:</strong> ${contactNo as string}</p>
              <p><strong>Email:</strong> ${req.user?.email}</p>
          </div>
      </body>
      </html>`;
    const to = [process.env.CONTACT_US_EMAIL || "chamika@ceydigital.com"];

    sendEmail({
      to,
      subject: "Worklenz - Local billing contact.",
      html
    });
    return res.status(200).send(new ServerResponse(true, null, "Your contact information has been sent successfully."));
  }

  @HandleExceptions()
  public static async getPricingPlans(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    // Query plan tiers with their associated pricing plans
    const q = `
      SELECT 
        lpt.id,
        lpt.tier_name,
        lpt.display_name,
        lpt.tier_level,
        lpt.pricing_model,
        lpt.monthly_base_price,
        lpt.annual_base_price,
        lpt.monthly_per_user_price,
        lpt.annual_per_user_price,
        lpt.min_users,
        lpt.max_users,
        lpt.included_users,
        lpt.max_projects,
        lpt.max_storage_gb,
        lpt.has_api_access,
        lpt.has_advanced_analytics,
        lpt.has_custom_fields,
        lpt.has_gantt_charts,
        lpt.has_time_tracking,
        lpt.has_resource_management,
        lpt.has_portfolio_view,
        lpt.has_custom_branding,
        lpt.has_sso,
        lpt.has_audit_logs,
        lpt.has_priority_support,
        lpt.has_dedicated_account_manager,
        lpt.is_popular,
        lpt.sort_order,
        -- Get paddle plan IDs from related pricing plans
        monthly_plan.id as monthly_plan_id,
        monthly_plan.paddle_id as monthly_paddle_id,
        monthly_plan.active as monthly_active,
        annual_plan.id as annual_plan_id,
        annual_plan.paddle_id as annual_paddle_id,
        annual_plan.active as annual_active
      FROM licensing_plan_tiers lpt
      LEFT JOIN licensing_pricing_plans monthly_plan ON lpt.id = monthly_plan.tier_id 
        AND monthly_plan.billing_type = 'month' 
        AND monthly_plan.active = true
      LEFT JOIN licensing_pricing_plans annual_plan ON lpt.id = annual_plan.tier_id 
        AND annual_plan.billing_type = 'year' 
        AND annual_plan.active = true
      WHERE lpt.is_active = true
      ORDER BY lpt.sort_order, lpt.tier_level;
    `;

    const result = await db.query(q);

    // Transform the data into a format that the frontend expects
    const tiers = result.rows.map(row => ({
      id: row.id,
      tier_name: row.tier_name,
      display_name: row.display_name,
      tier_level: row.tier_level,
      pricing_model: row.pricing_model,

      // Direct tier data
      monthly_base_price: row.monthly_base_price,
      annual_base_price: row.annual_base_price,
      monthly_per_user_price: row.monthly_per_user_price,
      annual_per_user_price: row.annual_per_user_price,
      min_users: row.min_users,
      max_users: row.max_users,
      included_users: row.included_users,

      // Plan IDs for paddle integration
      plans: {
        monthly_plan_id: row.monthly_plan_id,
        monthly_paddle_id: row.monthly_paddle_id,
        annual_plan_id: row.annual_plan_id,
        annual_paddle_id: row.annual_paddle_id
      },

      // Features
      features: {
        max_projects: row.max_projects,
        max_storage_gb: row.max_storage_gb,
        has_api_access: row.has_api_access,
        has_advanced_analytics: row.has_advanced_analytics,
        has_custom_fields: row.has_custom_fields,
        has_gantt_charts: row.has_gantt_charts,
        has_time_tracking: row.has_time_tracking,
        has_resource_management: row.has_resource_management,
        has_portfolio_view: row.has_portfolio_view,
        has_custom_branding: row.has_custom_branding,
        has_sso: row.has_sso,
        has_audit_logs: row.has_audit_logs,
        has_priority_support: row.has_priority_support,
        has_dedicated_account_manager: row.has_dedicated_account_manager
      },

      // UI properties
      is_popular: row.is_popular,
      sort_order: row.sort_order
    }));

    return res.status(200).send(new ServerResponse(true, {
      tiers: tiers
    }));
  }

  /**
   * Get LKR pricing for Sri Lankan users
   * 
   * This is a simplified, DB-driven endpoint used by the LKR upgrade modal.
   *
   * It expects that licensing_custom_plan_pricing contains LKR pricing tiers:
   * - tier_name = 'pro' (for reference, though we use business tier)
   * - tier_name = 'business' (main business plan for LKR users)
   * - currency = 'LKR'
   *
   * For the business plan:
   * - monthly_base_price     => price
   * - annual_base_price      => discountedPrice
   * 
   * Free plan is the same for both local and non-local users (always 0).
   */
  /**
   * Create DirectPay card add session for tokenization
   * Uses /api/v3/create-session with type: CARD_ADD
   */
  private static encodeDirectPayPayload(payload: any): string {
    return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
  }

  private static signDirectPayPayload(base64Payload: string, secret: string): string {
    const hash = crypto
      .createHmac("sha256", secret)
      .update(base64Payload)
      .digest("hex");

    return `hmac ${hash}`;
  }

  private static verifyDirectPaySignature(rawPayload: string, signature: string | undefined, secret: string): boolean {
    if (!rawPayload || !signature) return false;

    const [scheme, receivedHash] = signature.split(" ");
    if (scheme !== "hmac" || !receivedHash) return false;

    const expectedHash = crypto
      .createHmac("sha256", secret)
      .update(rawPayload)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedHash, "hex");
    const receivedBuffer = Buffer.from(receivedHash, "hex");

    return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  private static decodeDirectPayPayload(rawPayload: string | undefined, parsedBody: any): any {
    if (parsedBody && typeof parsedBody === "object" && !Buffer.isBuffer(parsedBody) && !parsedBody.raw) {
      return parsedBody;
    }

    const raw = (rawPayload || parsedBody?.raw || "").toString().trim();
    if (!raw) return parsedBody || {};

    try {
      return JSON.parse(raw);
    } catch (_jsonError) {
      const decoded = Buffer.from(raw, "base64").toString("utf8");
      return JSON.parse(decoded);
    }
  }

  private static decodeDirectPayApiResponse(data: any): any {
    if (!data || typeof data === "object") return data;

    const raw = data.toString().trim();
    try {
      return JSON.parse(raw);
    } catch (_jsonError) {
      try {
        return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
      } catch (_base64Error) {
        return data;
      }
    }
  }

  private static buildDirectPayOrderId(_userId: string, _ownerId: string): string {
    const now = new Date();
    const datePart = now.toISOString().slice(2, 10).replace(/-/g, ""); // YYMMDD
    const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
    return `${this.DIRECTPAY_CARD_ORDER_PREFIX}${datePart}${rand}`;
  }

  private static normalizeDirectPayUrlBase(url: string): string {
    const trimmedUrl = url.trim().replace(/\/+$/, "");
    return /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `http://${trimmedUrl}`;
  }

  private static parseDirectPayOrderOwner(_orderId?: string | null): IDirectPaySessionOwner {
    // Owner identity is looked up from licensing_directpay_sessions by order_id in processCardResponse.
    // This stub exists only as a fallback path; returning nulls causes the session row to be used.
    return { userId: null, ownerId: null };
  }

  private static maskCardNumber(cardNumber?: string | null): string {
    if (!cardNumber) return "****";
    if (cardNumber.includes("x") || cardNumber.includes("*")) return cardNumber;

    const digitsOnly = cardNumber.replace(/\D/g, "");
    if (digitsOnly.length < 10) return cardNumber;

    return `${digitsOnly.slice(0, 6)}xxxxxx${digitsOnly.slice(-4)}`;
  }

  private static normalizeDirectPayResponse(payload: any): IDirectPayNormalizedResponse {
    const data = payload?.data || {};
    const card = payload?.card || data?.card || {};
    const transaction = payload?.transaction || data?.transaction || {};
    const orderId =
      payload?.order_id ||
      payload?.orderId ||
      data?.order_id ||
      data?.orderId ||
      transaction?.order_id ||
      transaction?.orderId ||
      null;
    const walletId =
      payload?.walletId ||
      payload?.wallet_id ||
      data?.walletId ||
      data?.wallet_id ||
      card?.walletId ||
      card?.wallet_id ||
      null;
    const cardId =
      card?.id ||
      card?.card_id ||
      payload?.card_id ||
      data?.card_id ||
      null;
    const transactionId =
      transaction?.id ||
      payload?.transaction_id ||
      payload?.trnId ||
      data?.transaction_id ||
      null;
    const status =
      transaction?.status ||
      card?.status ||
      payload?.status ||
      data?.status ||
      null;

    return {
      status: status ? String(status) : null,
      orderId: orderId ? String(orderId) : null,
      walletId: walletId ? String(walletId) : null,
      card,
      cardId: cardId ? String(cardId) : null,
      transaction,
      transactionId: transactionId ? String(transactionId) : null,
    };
  }

  private static async persistDirectPayCardResponse(
    payload: any,
    fallbackUserId?: string,
    fallbackOwnerId?: string
  ): Promise<{ saved: boolean; cardDbId?: string; paymentId?: string; message?: string }> {
    const normalized = this.normalizeDirectPayResponse(payload);
    const parsedOwner = this.parseDirectPayOrderOwner(normalized.orderId);
    const client = await db.pool.connect();

    try {
      await client.query("BEGIN");

      const sessionResult = normalized.orderId
        ? await client.query(
          "SELECT * FROM licensing_directpay_sessions WHERE order_id = $1 FOR UPDATE",
          [normalized.orderId]
        )
        : await client.query(
          `SELECT * FROM licensing_directpay_sessions
           WHERE status = 'pending'
           ORDER BY created_at DESC
           LIMIT 1
           FOR UPDATE`,
          []
        );
      const session = sessionResult.rows[0];
      console.log("[DirectPay Webhook] Resolved session:", session ? `order_id=${session.order_id} user_id=${session.user_id}` : "none");

      const userId = fallbackUserId || session?.user_id || parsedOwner.userId;
      const ownerId = fallbackOwnerId || session?.owner_id || parsedOwner.ownerId || userId;

      if (!userId || !normalized.walletId || !normalized.cardId) {
        await client.query("ROLLBACK");
        console.error("[DirectPay Webhook] Cannot save — missing:", { userId, walletId: normalized.walletId, cardId: normalized.cardId });
        return {
          saved: false,
          message: "Missing user, wallet, or card data in DirectPay response",
        };
      }
      console.log("[DirectPay Webhook] Saving card for userId:", userId, "walletId:", normalized.walletId, "cardId:", normalized.cardId);

      const cardNumber = this.maskCardNumber(normalized.card?.number || normalized.card?.mask);
      const cardResult = await client.query(
        `
          INSERT INTO licensing_directpay_cards (
            user_id, card_id, card_number_masked, card_brand, card_type,
            expiry_month, expiry_year, wallet_id, is_default, is_active, last_used_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, true, CURRENT_TIMESTAMP)
          ON CONFLICT (user_id, card_id) DO UPDATE
          SET card_number_masked = EXCLUDED.card_number_masked,
              card_brand = EXCLUDED.card_brand,
              card_type = EXCLUDED.card_type,
              expiry_month = EXCLUDED.expiry_month,
              expiry_year = EXCLUDED.expiry_year,
              wallet_id = EXCLUDED.wallet_id,
              is_active = true,
              last_used_at = CURRENT_TIMESTAMP
          RETURNING id
        `,
        [
          ownerId,
          normalized.cardId,
          cardNumber,
          normalized.card?.brand || null,
          normalized.card?.type || null,
          normalized.card?.expiry?.month || null,
          normalized.card?.expiry?.year || null,
          normalized.walletId,
        ]
      );
      const cardDbId = cardResult.rows[0]?.id;

      const subscriptionResult = await client.query(
        `
          SELECT id
          FROM licensing_custom_subs
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [ownerId]
      );
      const subscriptionId = subscriptionResult.rows[0]?.id || null;
      const paymentStatus = normalized.status || "UNKNOWN";
      const transactionAmount =
        normalized.transaction?.amount ||
        payload?.amount ||
        session?.amount ||
        0;
      const transactionCurrency =
        normalized.transaction?.currency ||
        payload?.currency ||
        session?.currency ||
        "LKR";

      let existingPayment;
      if (normalized.orderId || normalized.transactionId) {
        const existingPaymentResult = await client.query(
          `
            SELECT id
            FROM licensing_lkr_payments
            WHERE ($1::TEXT IS NOT NULL AND order_id = $1)
               OR ($2::TEXT IS NOT NULL AND transaction_id = $2)
            ORDER BY created_at DESC
            LIMIT 1
          `,
          [normalized.orderId, normalized.transactionId]
        );
        existingPayment = existingPaymentResult.rows[0];
      }

      let paymentId = existingPayment?.id;
      if (paymentId) {
        await client.query(
          `
            UPDATE licensing_lkr_payments
            SET status = $2,
                card_id = $3,
                card_number = $4,
                card_brand = $5,
                card_type = $6,
                card_expiry_year = $7,
                card_expiry_month = $8,
                wallet_id = $9,
                transaction_id = COALESCE($10, transaction_id),
                transaction_status = $11,
                transaction_amount = $12,
                amount = $12,
                transaction_currency = $13,
                transaction_channel = $14,
                transaction_datetime = COALESCE($15::TIMESTAMPTZ, transaction_datetime),
                transaction_message = $16,
                transaction_description = $17,
                subscription_id = COALESCE($18, subscription_id),
                payment_type = COALESCE(payment_type, 'initial')
            WHERE id = $1
          `,
          [
            paymentId,
            paymentStatus,
            normalized.cardId,
            cardNumber,
            normalized.card?.brand || null,
            normalized.card?.type || null,
            normalized.card?.expiry?.year || null,
            normalized.card?.expiry?.month || null,
            normalized.walletId,
            normalized.transactionId,
            paymentStatus,
            transactionAmount,
            transactionCurrency,
            normalized.transaction?.channel || null,
            normalized.transaction?.dateTime || null,
            normalized.transaction?.message || null,
            normalized.transaction?.description || null,
            subscriptionId,
          ]
        );
      } else {
        const paymentResult = await client.query(
          `
            INSERT INTO licensing_lkr_payments (
              status, card_id, card_number, card_brand, card_type,
              card_expiry_year, card_expiry_month, wallet_id,
              transaction_id, transaction_status, transaction_amount, amount,
              transaction_currency, transaction_channel, transaction_datetime,
              transaction_message, transaction_description, user_id, owner_id,
              subscription_id, payment_type, order_id
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8,
              $9, $10, $11, $11, $12, $13, $14,
              $15, $16, $17, $18, $19, 'initial', $20
            )
            RETURNING id
          `,
          [
            paymentStatus,
            normalized.cardId,
            cardNumber,
            normalized.card?.brand || null,
            normalized.card?.type || null,
            normalized.card?.expiry?.year || null,
            normalized.card?.expiry?.month || null,
            normalized.walletId,
            normalized.transactionId,
            paymentStatus,
            transactionAmount,
            transactionCurrency,
            normalized.transaction?.channel || null,
            normalized.transaction?.dateTime || null,
            normalized.transaction?.message || null,
            normalized.transaction?.description || null,
            userId,
            ownerId,
            subscriptionId,
            normalized.orderId,
          ]
        );
        paymentId = paymentResult.rows[0]?.id;
      }

      if (subscriptionId && paymentStatus === "SUCCESS") {
        await client.query(
          `
            UPDATE licensing_custom_subs
            SET card_id = $1,
                status = CASE WHEN status = 'pending' THEN 'active' ELSE status END,
                last_payment_date = CURRENT_DATE
            WHERE id = $2
          `,
          [cardDbId, subscriptionId]
        );
      }

      if (normalized.orderId) {
        await client.query(
          `
            UPDATE licensing_directpay_sessions
            SET status = $2,
                directpay_response = $3,
                card_db_id = $4,
                payment_id = $5,
                processed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE order_id = $1
          `,
          [normalized.orderId, paymentStatus, JSON.stringify(payload), cardDbId, paymentId]
        );
      }

      await client.query("COMMIT");
      return { saved: true, cardDbId, paymentId };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  @HandleExceptions()
  public static async createCardAddSession(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { amount, doInitialPayment = false, plan } = req.body;
    const email = req.user?.email;
    const name = req.user?.name;
    const userId = req.user?.id;
    const ownerId = req.user?.owner_id || req.user?.id;

    // Try to get phone from DB for DirectPay wallet identity (wallet = phone + email)
    let phone: string | null = null;
    try {
      const phoneResult = await db.query("SELECT phone FROM users WHERE id = $1", [userId]);
      phone = phoneResult.rows[0]?.phone || null;
    } catch {
      // phone column may not exist; wallet identity falls back to email only
    }

    if (!email || !name || !userId || !ownerId) {
      return res.status(400).send(new ServerResponse(false, null, "User email and name are required"));
    }

    // If the owner already has an active card on file, return it so the frontend
    // can skip card-add and go straight to payment — avoids DirectPay "Card already exist".
    const existingCardResult = await db.query(
      `SELECT card_id, wallet_id, card_number_masked, card_brand, expiry_month, expiry_year
         FROM licensing_directpay_cards
        WHERE user_id = $1 AND is_active = true
        ORDER BY created_at DESC
        LIMIT 1`,
      [ownerId]
    );
    if (existingCardResult.rows.length > 0) {
      return res.status(200).send(new ServerResponse(true, {
        existingCard: existingCardResult.rows[0],
        stage: process.env.DP_STAGE,
      }));
    }

    const { DP_MERCHANT_ID, DP_SECRET_KEY, DP_STAGE, FRONTEND_URL, BACKEND_URL, ADMIN_BACKEND_URL, PORT } = process.env;
    if (!DP_MERCHANT_ID || !DP_SECRET_KEY) {
      return res.status(500).send(new ServerResponse(false, null, "DirectPay credentials are not configured"));
    }

    const checkoutAmount = Number(amount || 10);
    if (!Number.isFinite(checkoutAmount) || checkoutAmount <= 0) {
      return res.status(400).send(new ServerResponse(false, null, "Valid amount is required"));
    }

    const orderId = this.buildDirectPayOrderId(userId, ownerId);

    // Use ADMIN_BACKEND_URL for the card-response webhook if set (admin backend handles card persistence)
    const webhookBaseUrl = this.normalizeDirectPayUrlBase(ADMIN_BACKEND_URL || BACKEND_URL || `http://localhost:${PORT || 3000}`);
    const frontendBaseUrl = this.normalizeDirectPayUrlBase(FRONTEND_URL || "http://localhost:5000");

    // Split name into first_name and last_name
    const nameParts = name.trim().split(" ");
    const firstName = nameParts[0] || name;
    const lastName = nameParts.slice(1).join(" ") || null;

    const requestPayload: any = {
      merchant_id: DP_MERCHANT_ID,
      amount: checkoutAmount.toFixed(2),
      source: "worklenz-app",
      type: "CARD_ADD",
      order_id: orderId,
      currency: "LKR",
      response_url: `${webhookBaseUrl}/directpay-webhook/card-response`,
      return_url: `${frontendBaseUrl}/worklenz/admin-center/billing?dp_card_added=1`,
      first_name: firstName,
      email: email,
      description: "Worklenz - Add Payment Method",
      logo: "https://s3.us-west-2.amazonaws.com/worklenz.com/assets/icon-96x96.png",
      do_initial_payment: doInitialPayment ? "1" : "0",
    };

    // Add optional fields only if they have values
    if (lastName) {
      requestPayload.last_name = lastName;
    }
    if (phone) {
      requestPayload.phone = phone;
    }

    const base64EncodedPayload = this.encodeDirectPayPayload(requestPayload);
    const signature = this.signDirectPayPayload(base64EncodedPayload, DP_SECRET_KEY);

    // Determine API URL based on stage
    const apiUrl = DP_STAGE === "PROD" 
      ? "https://gateway.directpay.lk/api/v3/create-session"
      : "https://test-gateway.directpay.lk/api/v3/create-session";

    try {
      console.log(`[createCardAddSession] orderId=${orderId} userId=${userId} ownerId=${ownerId} amount=${checkoutAmount} plan=${plan || null}`);

      await db.query(
        `
          INSERT INTO licensing_directpay_sessions (
            order_id, user_id, owner_id, amount, currency, status, request_payload, plan_key
          )
          VALUES ($1, $2, $3, $4, 'LKR', 'pending', $5, $6)
          ON CONFLICT (order_id) DO UPDATE
          SET amount = EXCLUDED.amount,
              request_payload = EXCLUDED.request_payload,
              plan_key = EXCLUDED.plan_key,
              updated_at = CURRENT_TIMESTAMP
        `,
        [orderId, userId, ownerId, checkoutAmount, JSON.stringify(requestPayload), plan || null]
      );
      console.log(`[createCardAddSession] session upserted — orderId=${orderId} plan_key=${plan || null}`);

      // Call DirectPay API
      const response = await axios.post(apiUrl, base64EncodedPayload, {
        headers: {
          "Content-Type": "text/plain",
          "Authorization": signature,
        },
        timeout: 30000,
      });

      const sessionData = this.decodeDirectPayApiResponse(response.data);
      console.log(`[createCardAddSession] DirectPay response status=${sessionData?.status} orderId=${orderId}`);

      if (Number(sessionData?.status) >= 400) {
        await db.query(
          `
            UPDATE licensing_directpay_sessions
            SET status = 'failed',
                directpay_response = $2,
                updated_at = CURRENT_TIMESTAMP,
                processed_at = CURRENT_TIMESTAMP
            WHERE order_id = $1
          `,
          [orderId, JSON.stringify(sessionData)]
        );

        return res.status(400).send(new ServerResponse(false, {
          sessionData,
          stage: DP_STAGE,
          orderId,
        }, sessionData?.data?.return_url?.[0] || "DirectPay rejected the card session request"));
      }

      return res.status(200).send(new ServerResponse(true, {
        sessionData,
        stage: DP_STAGE,
        orderId,
      }));
    } catch (error: any) {
      log_error(error);
      return res.status(500).send(new ServerResponse(false, null, 
        error?.response?.data?.message || "Failed to create card add session"));
    }
  }

  /**
   * Create a CARD_TOKEN_PAYMENT session for 3DS authenticated payment using a stored card.
   * Uses /api/v3/CARD_TOKEN_PAYMENT
   */
  @HandleExceptions()
  public static async createCardTokenPaymentSession(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const userId = req.user?.id;
    const ownerId = req.user?.owner_id || userId;
    if (!userId || !ownerId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const { wallet_id, card_id, cvv, amount, currency } = req.body;
    if (!wallet_id || !card_id || !amount) {
      return res.status(400).send(new ServerResponse(false, null, "wallet_id, card_id, and amount are required"));
    }

    const { DP_MERCHANT_ID, DP_SECRET_KEY, DP_STAGE } = process.env;
    if (!DP_MERCHANT_ID || !DP_SECRET_KEY) {
      return res.status(500).send(new ServerResponse(false, null, "DirectPay credentials are not configured"));
    }

    const orderId = this.buildDirectPayOrderId(userId, ownerId);
    const paymentCurrency = currency || "LKR";

    const requestPayload: Record<string, any> = {
      merchant_id: DP_MERCHANT_ID,
      type: "CARD_TOKEN_PAYMENT",
      wallet_id: String(wallet_id),
      card_id: String(card_id),
      order_id: orderId,
      currency: paymentCurrency,
      amount: String(amount),
    };
    if (cvv) {
      requestPayload.cvv = String(cvv);
    }

    const base64EncodedPayload = this.encodeDirectPayPayload(requestPayload);
    const signature = this.signDirectPayPayload(base64EncodedPayload, DP_SECRET_KEY);

    const apiUrl = DP_STAGE === "PROD"
      ? "https://gateway.directpay.lk/api/v3/CARD_TOKEN_PAYMENT"
      : "https://test-gateway.directpay.lk/api/v3/CARD_TOKEN_PAYMENT";

    try {
      const response = await axios.post(apiUrl, base64EncodedPayload, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": signature,
        },
        timeout: 30000,
      });

      const sessionData = this.decodeDirectPayApiResponse(response.data);
      return res.status(200).send(new ServerResponse(true, {
        sessionData,
        stage: DP_STAGE,
        orderId,
      }));
    } catch (error: any) {
      log_error(error);
      return res.status(500).send(new ServerResponse(false, null,
        error?.response?.data?.message || "Failed to create token payment session"));
    }
  }

  /**
   * List cards for a user's wallet
   * Uses /api/v3/listCard
   */
  @HandleExceptions()
  public static async listCards(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const ownerId = req.user?.owner_id || req.user?.id;
    console.log("[listCards] ownerId:", ownerId);

    const result = await db.query(
      `SELECT card_id, wallet_id, card_number_masked, card_brand, card_type, expiry_month, expiry_year
       FROM licensing_directpay_cards
       WHERE user_id = $1 AND is_active = true
       ORDER BY created_at DESC`,
      [ownerId]
    );

    console.log("[listCards] DB rows:", result.rows.length, result.rows[0] ?? "none");

    return res.status(200).send(new ServerResponse(true, {
      card_list: result.rows,
      wallet_id: result.rows[0]?.wallet_id ?? null,
    }));
  }

  /**
   * Delete a card
   * Uses /api/v3/deleteCard
   */
  @HandleExceptions()
  public static async deleteCard(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { card_id } = req.body;

    if (!card_id) {
      return res.status(400).send(new ServerResponse(false, null, "card_id is required"));
    }

    const ownerId = req.user?.owner_id || req.user?.id;
    const ownershipCheck = await db.query(
      "SELECT 1 FROM licensing_directpay_cards WHERE card_id = $1 AND user_id = $2 AND is_active = true",
      [String(card_id), ownerId]
    );
    if (ownershipCheck.rowCount === 0) {
      return res.status(404).send(new ServerResponse(false, null, "Card not found"));
    }

    const { DP_MERCHANT_ID, DP_SECRET_KEY, DP_STAGE } = process.env;

    const requestPayload = {
      merchant_id: DP_MERCHANT_ID,
      card_id: String(card_id),
    };

    const base64EncodedPayload = this.encodeDirectPayPayload(requestPayload);
    const signature = this.signDirectPayPayload(base64EncodedPayload, DP_SECRET_KEY as string);

    const apiUrl = DP_STAGE === "PROD"
      ? "https://gateway.directpay.lk/api/v3/deleteCard"
      : "https://test-gateway.directpay.lk/api/v3/deleteCard";

    try {
      const response = await axios.post(apiUrl, base64EncodedPayload, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": signature,
        },
        timeout: 30000,
      });

      const decoded = this.decodeDirectPayApiResponse(response.data);
      if (decoded?.status === 1) {
        await db.query(
          "UPDATE licensing_directpay_cards SET is_active = false WHERE card_id = $1 AND user_id = $2",
          [String(card_id), ownerId]
        );
      }
      return res.status(200).send(new ServerResponse(true, decoded));
    } catch (error: any) {
      log_error(error);
      return res.status(500).send(new ServerResponse(false, null,
        error?.response?.data?.message || "Failed to delete card"));
    }
  }

  /**
   * Pay using a stored card
   * Uses /api/v3/cardPay
   */
  @HandleExceptions()
  public static async payWithCard(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { wallet_id, card_id, order_id, plan } = req.body;
    console.log("[payWithCard] Request — wallet_id:", wallet_id, "card_id:", card_id, "order_id:", order_id, "plan:", plan);

    if (!wallet_id || !card_id || !order_id) {
      console.error("[payWithCard] Missing required fields");
      return res.status(400).send(new ServerResponse(false, null,
        "wallet_id, card_id, and order_id are required"));
    }

    // Never trust the client-supplied amount/currency. Derive the charge from
    // server-side pricing for the requested plan and reject unsupported
    // plans/currencies before charging or activating a subscription.
    let charge: { tierName: string; amount: number; currency: string };
    try {
      charge = await this.resolveLkrPlanCharge(plan, req.body.currency);
    } catch (err: any) {
      console.warn("[payWithCard] Rejected — invalid plan/currency:", err?.message);
      return res.status(400).send(new ServerResponse(false, null,
        err?.message || "Unsupported plan or currency"));
    }
    const amount = charge.amount;
    const currency = charge.currency;
    if (req.body.amount !== undefined && Number(req.body.amount) !== amount) {
      console.warn(`[payWithCard] Client amount ${req.body.amount} != server amount ${amount} for plan ${plan} — using server amount`);
    }

    const { DP_MERCHANT_ID, DP_SECRET_KEY, DP_STAGE } = process.env;

    const requestPayload = {
      merchant_id: DP_MERCHANT_ID,
      wallet_id: String(wallet_id),
      card_id: String(card_id),
      order_id: String(order_id),
      currency,
      amount: String(amount),
    };

    const base64EncodedPayload = this.encodeDirectPayPayload(requestPayload);
    const signature = this.signDirectPayPayload(base64EncodedPayload, DP_SECRET_KEY as string);

    const apiUrl = DP_STAGE === "PROD"
      ? "https://gateway.directpay.lk/api/v3/cardPay"
      : "https://test-gateway.directpay.lk/api/v3/cardPay";

    console.log("[payWithCard] stage:", DP_STAGE, "url:", apiUrl);
    console.log("[payWithCard] payload:", JSON.stringify(requestPayload));
    console.log("[payWithCard] base64:", base64EncodedPayload.slice(0, 40) + "...");
    console.log("[payWithCard] signature:", signature);

    // Idempotency guard: block charge if subscription is active and already paid this month
    const userId = req.user?.id;
    const ownerId = req.user?.owner_id || userId;
    const recentPaymentResult = await db.query(
      `SELECT lp.id
       FROM licensing_lkr_payments lp
       JOIN licensing_custom_subs lcs ON lcs.user_id = $1
       WHERE lp.owner_id = $1
         AND lp.status IN ('SUCCESS', '200')
         AND lp.created_at >= (CURRENT_DATE - INTERVAL '1 hour')
         AND lcs.status = 'active'
         AND lcs.end_date > CURRENT_DATE
       LIMIT 1`,
      [ownerId]
    );
    if (recentPaymentResult.rows.length > 0) {
      console.warn("[payWithCard] Blocked duplicate charge — active subscription with recent payment for ownerId:", ownerId);
      return res.status(200).send(new ServerResponse(false, null, "A payment was already processed recently. Please wait before retrying."));
    }

    try {
      const response = await axios.post(apiUrl, base64EncodedPayload, {
        headers: {
          "Content-Type": "text/plain",
          "Authorization": signature,
        },
        timeout: 30000,
      });

      const decoded = this.decodeDirectPayApiResponse(response.data);
      const txnStatus = decoded?.data?.transaction?.status || decoded?.transaction?.status || "UNKNOWN";
      console.log("[payWithCard] DirectPay response — status:", decoded?.status, "txnStatus:", txnStatus, "decoded:", JSON.stringify(decoded));

      if (txnStatus === "SUCCESS") {
        const txn = decoded?.data?.transaction || decoded?.transaction || {};

        await db.query(
          `INSERT INTO licensing_lkr_payments
             (user_id, owner_id, order_id, transaction_id, transaction_status,
              transaction_amount, transaction_currency, transaction_channel,
              status, card_id, payment_type)
           VALUES ($1, $2, $3, $4, 'SUCCESS', $5, $6, $7, 200, $8, 'recurring')
           ON CONFLICT DO NOTHING`,
          [
            userId, ownerId,
            String(order_id),
            String(txn.id ?? ""),
            parseFloat(String(amount)),
            currency || "LKR",
            String(txn.channel ?? ""),
            Number(card_id),
          ]
        );
        console.log("[payWithCard] Payment SUCCESS — recorded in DB");

        await this.activateLkrSubscription(ownerId as string, plan, parseFloat(String(amount)));
      } else {
        console.warn("[payWithCard] Payment not successful — txnStatus:", txnStatus, "message:", decoded?.data?.transaction?.message);
      }

      const success = txnStatus === "SUCCESS";
      return res.status(200).send(new ServerResponse(success, decoded, success ? undefined : `Payment ${txnStatus}: ${decoded?.data?.transaction?.message || "failed"}`));
    } catch (error: any) {
      log_error(error);
      console.error("[payWithCard] axios error:", error?.response?.status, error?.response?.data);
      return res.status(500).send(new ServerResponse(false, null,
        error?.response?.data?.message || "Failed to process payment"));
    }
  }

  /**
   * Resolves the authoritative monthly charge for an LKR plan from server-side
   * pricing. Rejects unsupported plans/currencies so the client cannot dictate
   * the amount it is billed.
   */
  private static async resolveLkrPlanCharge(
    planKey: string | undefined,
    currency: string | undefined
  ): Promise<{ tierName: string; amount: number; currency: string }> {
    const normalizedCurrency = (currency || "LKR").toUpperCase();
    if (normalizedCurrency !== "LKR") {
      throw new Error(`Unsupported currency: ${normalizedCurrency}`);
    }

    // 'startup' is the legacy UI key for the business tier.
    const allowedPlans = ["pro", "business", "startup"];
    if (planKey !== undefined && !allowedPlans.includes(planKey)) {
      throw new Error(`Unsupported plan: ${planKey}`);
    }
    const tierName = planKey === "pro" ? "pro" : "business";

    const pricingResult = await db.query(
      `SELECT monthly_base_price
         FROM licensing_custom_plan_pricing
        WHERE tier_name = $1 AND currency = 'LKR' AND is_active = TRUE
        LIMIT 1`,
      [tierName]
    );
    const price = Number(pricingResult.rows[0]?.monthly_base_price);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`No active LKR pricing found for plan: ${tierName}`);
    }

    return { tierName, amount: price, currency: "LKR" };
  }

  private static async activateLkrSubscription(
    ownerId: string,
    planKey: string | undefined,
    amount: number
  ): Promise<void> {
    // 'startup' is the UI key for the business tier; both map to ANNUAL_BUSINESS license type
    const tierName = planKey === "pro" ? "pro" : "business";

    const pricingResult = await db.query(
      `SELECT id, included_users, max_users
       FROM licensing_custom_plan_pricing
       WHERE tier_name = $1 AND currency = 'LKR' AND is_active = TRUE
       LIMIT 1`,
      [tierName]
    );
    const pricing = pricingResult.rows[0];
    if (!pricing) {
      console.error(`[activateLkrSubscription] No active pricing tier found for tierName=${tierName}`);
      throw new Error(`No active pricing tier found for plan: ${tierName}`);
    }
    const planTierId = pricing.id;
    const userLimit = pricing.max_users || pricing.included_users;

    console.log(`[activateLkrSubscription] planKey=${planKey} tierName=${tierName} planTierId=${planTierId} userLimit=${userLimit} amount=${amount}`);

    // Extend existing active/pending subscription or create a new one
    const existingResult = await db.query(
      `SELECT id, end_date FROM licensing_custom_subs
       WHERE user_id = $1 AND status IN ('active', 'pending')
       ORDER BY created_at DESC LIMIT 1`,
      [ownerId]
    );

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      const newEndDate = existing.end_date && new Date(existing.end_date) > new Date()
        ? `(DATE '${existing.end_date}' + INTERVAL '1 month')`
        : "(CURRENT_DATE + INTERVAL '1 month')";
      await db.query(
        `UPDATE licensing_custom_subs
         SET status = 'active',
             rate = $2,
             plan_tier_id = $3,
             user_limit = $4,
             end_date = ${newEndDate},
             next_billing_date = ${newEndDate},
             auto_renew = TRUE,
             retry_count = 0,
             last_retry_at = NULL,
             next_retry_date = NULL,
             grace_period_ends = NULL,
             payment_gateway_id = (SELECT id FROM licensing_payment_gateways WHERE name = 'directpay'),
             card_id = (SELECT id FROM licensing_directpay_cards WHERE user_id = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT 1)
         WHERE id = $5`,
        [ownerId, amount, planTierId, userLimit, existing.id]
      );
      console.log(`[activateLkrSubscription] Extended existing subscription=${existing.id} new_end_date=${newEndDate}`);
    } else {
      const insertResult = await db.query(
        `INSERT INTO licensing_custom_subs
           (user_id, billing_type, currency, rate, end_date, next_billing_date, user_limit, plan_tier_id, status, auto_renew, payment_gateway_id, card_id)
         VALUES (
           $1, 'month', 'LKR', $2,
           CURRENT_DATE + INTERVAL '1 month',
           CURRENT_DATE + INTERVAL '1 month',
           $3, $4, 'active', TRUE,
           (SELECT id FROM licensing_payment_gateways WHERE name = 'directpay'),
           (SELECT id FROM licensing_directpay_cards WHERE user_id = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT 1)
         ) RETURNING id`,
        [ownerId, amount, userLimit, planTierId]
      );
      console.log(`[activateLkrSubscription] Created new subscription=${insertResult.rows[0]?.id} for owner=${ownerId}`);
    }

    // Pro tier → ANNUAL_PRO, Business tier → ANNUAL_BUSINESS
    const licenseTypeKey = tierName === 'pro' ? 'ANNUAL_PRO' : 'ANNUAL_BUSINESS';
    const orgUpdateResult = await db.query(
      `UPDATE organizations
       SET license_type_id = (SELECT id FROM sys_license_types WHERE key = $2),
           subscription_status = 'active'
       WHERE user_id = $1
       RETURNING license_type_id`,
      [ownerId, licenseTypeKey]
    );
    const updatedLicenseTypeId = orgUpdateResult.rows[0]?.license_type_id;
    if (!updatedLicenseTypeId) {
      console.error(`[activateLkrSubscription] ${licenseTypeKey} not found in sys_license_types — run migration 20260626000001`);
    }
    console.log(`[activateLkrSubscription] Org license_type_id=${updatedLicenseTypeId} (${licenseTypeKey}) subscription_status=active for owner=${ownerId}`);
  }

  @HandleExceptions()
  public static async downloadLkrReceipt(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const ownerId = req.user?.owner_id || req.user?.id;

    const result = await db.query(
      `SELECT lp.id, lp.created_at, lp.transaction_amount, lp.amount,
              lp.transaction_currency, lp.transaction_id, lp.order_id,
              lp.card_number, lp.payment_type,
              u.name AS user_name, u.email AS user_email,
              o.organization_name AS org_name,
              lpt.display_name AS plan_name
       FROM licensing_lkr_payments lp
       JOIN users u ON u.id = $2
       LEFT JOIN organizations o ON o.user_id = $2
       LEFT JOIN licensing_custom_subs lcs ON lcs.id = lp.subscription_id
       LEFT JOIN licensing_custom_plan_pricing lpt ON lpt.id = lcs.plan_tier_id
       WHERE lp.id = $1 AND lp.owner_id = $2
       LIMIT 1`,
      [id, ownerId]
    );

    const row = result.rows[0];
    if (!row) {
      return res.status(404).send(new ServerResponse(false, null, 'Receipt not found'));
    }

    const amount = Number(row.transaction_amount ?? row.amount ?? 0);
    const currency = row.transaction_currency ?? 'LKR';
    const date = new Date(row.created_at).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
    const receiptNumber = (row.order_id ?? row.transaction_id ?? row.id).replace(/[^A-Z0-9]/gi, '').slice(-12).toUpperCase();
    const planLabel = row.plan_name
      ? `${row.plan_name.charAt(0).toUpperCase() + row.plan_name.slice(1)} Plan — ${currency} ${amount.toFixed(2)} / month`
      : null;

    const { LkrReceiptTemplate } = require('../../shared/lkr-receipt-template');
    const html = LkrReceiptTemplate.generate({
      receiptNumber,
      date,
      amount,
      currency,
      transactionId: row.transaction_id ?? null,
      orderId: row.order_id ?? null,
      cardNumber: row.card_number ?? null,
      planName: planLabel,
      userName: row.user_name ?? null,
      userEmail: row.user_email ?? null,
      orgName: row.org_name ?? null,
    });

    const puppeteer = require('puppeteer');
    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });
      await browser.close();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="receipt-${receiptNumber}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.end(pdfBuffer, 'binary');
    } catch (pdfErr) {
      console.error('[downloadLkrReceipt] PDF error:', pdfErr);
      return res.status(500).send(new ServerResponse(false, null, 'Failed to generate receipt'));
    }
  }

  @HandleExceptions()
  public static async getLkrPaymentHistory(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const ownerId = req.user?.owner_id || req.user?.id;
    const result = await db.query(
      `SELECT id,
              created_at,
              transaction_amount,
              amount,
              transaction_currency,
              transaction_status,
              status,
              transaction_id,
              order_id,
              payment_type,
              card_number
       FROM licensing_lkr_payments
       WHERE owner_id = $1
         AND (transaction_status = 'SUCCESS' OR status::text IN ('SUCCESS', '200'))
       ORDER BY created_at DESC
       LIMIT 50`,
      [ownerId]
    );
    return res.status(200).send(new ServerResponse(true, { payments: result.rows }));
  }

  /**
   * Handle DirectPay card add response (webhook)
   * Called by DirectPay server after card is added/payment is processed.
   * This endpoint is mounted at /webhook/directpay/card-response (outside auth/CSRF).
   */
  @HandleExceptions()
  public static async handleCardAddResponse(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { DP_SECRET_KEY } = process.env;
    if (!DP_SECRET_KEY) {
      return res.status(500).send(new ServerResponse(false, null, "DirectPay credentials are not configured"));
    }

    const rawBody = (req as any).rawBody || (typeof req.body === "string" ? req.body : "");
    const signature = (req.headers.authorization || req.headers["Authorization"]) as string | undefined;

    if (!this.verifyDirectPaySignature(rawBody, signature, DP_SECRET_KEY)) {
      log_error("[DirectPay Webhook] Invalid HMAC signature");
      return res.status(401).send(new ServerResponse(false, null, "Invalid DirectPay signature"));
    }

    const responseData = this.decodeDirectPayPayload(rawBody, req.body);
    const normalized = this.normalizeDirectPayResponse(responseData);

    if (!normalized.walletId || !normalized.cardId) {
      log_error("[DirectPay Webhook] Missing wallet or card data in callback");
      return res.status(200).send(new ServerResponse(true, { message: "Webhook received without actionable card data" }));
    }

    const result = await this.persistDirectPayCardResponse(responseData);
    return res.status(200).send(new ServerResponse(true, result, "Card add response processed"));
  }

  /**
   * Authenticated fallback for DirectPay SDK postMessage success payloads.
   * Webhook remains the source of truth when the browser only receives return URL params.
   */
  @HandleExceptions()
  public static async saveDirectPayCardResponse(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const responseData = req.body;
    const normalized = this.normalizeDirectPayResponse(responseData);

    if (!normalized.walletId || !normalized.cardId) {
      return res.status(200).send(new ServerResponse(true, {
        saved: false,
        message: "No card payload available; waiting for DirectPay webhook",
      }));
    }

    const result = await this.persistDirectPayCardResponse(
      responseData,
      req.user?.id,
      req.user?.owner_id || req.user?.id
    );

    return res.status(200).send(new ServerResponse(true, result));
  }

  @HandleExceptions()
  public static async checkRegion(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    try {
      // Extract IP address from request headers (handle proxies and load balancers)
      const forwardedFor = req.headers['x-forwarded-for'];
      const realIp = req.headers['x-real-ip'];
      const remoteAddress = req.socket?.remoteAddress;

      let ip: string | undefined;

      if (forwardedFor) {
        // x-forwarded-for can contain multiple IPs, take the first one (client IP)
        ip = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0].trim();
      } else if (realIp) {
        ip = Array.isArray(realIp) ? realIp[0] : realIp;
      } else if (remoteAddress) {
        ip = remoteAddress;
      }

      // Remove IPv6 prefix if present (::ffff:)
      if (ip?.startsWith('::ffff:')) {
        ip = ip.substring(7);
      }

      // Only accept well-formed IP addresses. The value originates from
      // client-controlled headers (x-forwarded-for / x-real-ip), so reject
      // anything that is not a valid IPv4/IPv6 address before it is used to
      // build the outbound geolocation request URL (prevents SSRF / URL
      // injection via a crafted header).
      if (ip && !isIP(ip)) {
        ip = undefined;
      }

      // Skip geolocation for localhost/private IPs (development environment)
      if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
        return res.status(200).send(new ServerResponse(true, {
          isLkrEligible: null, // null means fallback to timezone detection
          country: 'Unknown (Local/Private IP)',
          countryCode: null,
          ip: ip || 'unknown'
        }));
      }

      // Use free IP geolocation service (ip-api.com - no API key required, 45 requests/minute)
      const response = await axios.get(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode`, {
        timeout: 3000 // 3 second timeout
      });

      if (response.data.status === 'success') {
        const isLkrEligible = response.data.countryCode === 'LK';
        
        return res.status(200).send(new ServerResponse(true, {
          isLkrEligible,
          country: response.data.country,
          countryCode: response.data.countryCode,
          ip
        }));
      } else {
        // API returned failure status, fallback to timezone
        return res.status(200).send(new ServerResponse(true, {
          isLkrEligible: null,
          country: 'Unknown',
          countryCode: null,
          ip
        }));
      }
    } catch (error) {
      // On any error (network, timeout, etc.), return null to trigger timezone fallback
      log_error(error);
      return res.status(200).send(new ServerResponse(true, {
        isLkrEligible: null,
        country: 'Error',
        countryCode: null,
        error: 'Geolocation service unavailable'
      }));
    }
  }

  @HandleExceptions()
  public static async getLkrPricing(_req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    // Query the licensing_custom_plan_pricing table for LKR pricing
    const q = `
      SELECT
        tier_name,
        display_name,
        monthly_base_price,
        annual_base_price,
        included_users,
        max_users,
        monthly_per_user_price,
        annual_per_user_price,
        currency
      FROM licensing_custom_plan_pricing
      WHERE is_active = TRUE
        AND currency = 'LKR'
        AND tier_name IN ('pro', 'business')
      ORDER BY tier_level ASC
    `;

    const result = await db.query(q);
    const rows = result.rows || [];

    const proRow = rows.find(r => r.tier_name === "pro");
    const businessRow = rows.find(r => r.tier_name === "business");

    // Free plan is the same for both local and non-local users
    const payload = {
      free: {
        display_name: 'Free',
        price: 0,
      },
      pro: {
        display_name: proRow?.display_name || 'Pro',
        price: proRow ? Number(proRow.monthly_base_price || 0) : 0,
      },
      business: {
        display_name: businessRow?.display_name || 'Business',
        price: businessRow ? Number(businessRow.monthly_base_price || 0) : 0,
      },
    };

    // Log warning if using fallback pricing
    if (!businessRow) {
      console.warn('⚠️  LKR business pricing not found in licensing_custom_plan_pricing table. Using fallback pricing.');
    }
    if (!proRow) {
      console.warn('⚠️  LKR pro pricing not found in licensing_custom_plan_pricing table.');
    }

    return res.status(200).send(new ServerResponse(true, payload));
  }

}
