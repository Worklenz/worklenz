import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { getTeamMemberCount } from "../shared/paddle-utils";
import { generatePayLinkRequest, updateUsers } from "../shared/paddle-requests";

import CryptoJS from "crypto-js";
import moment from "moment";
import axios from "axios";

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { log_error } from "../shared/utils";
import { sendEmail } from "../shared/email";

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

  public static async getInitialCharge(count: number) {
    if (!count) throw new Error("No selected plan detected.");

    const baseRate = 4990;
    const firstTier = 15;
    const secondTierEnd = 200;

    if (count <= firstTier) {
      return baseRate;
    } else if (count <= secondTierEnd) {
      return baseRate + (count - firstTier) * 300;
    }
    return baseRate + (secondTierEnd - firstTier) * 300 + (count - secondTierEnd) * 200;

  }

  public static async getBillingMonth() {
    const startDate = moment().format("YYYYMMDD");
    const endDate = moment().add(1, "month").subtract(1, "day").format("YYYYMMDD");

    return `${startDate} - ${endDate}`;
  }

  public static async chargeInitialPayment(signature: string, data: any) {
    const config = {
      method: "post",
      maxBodyLength: Infinity,
      url: process.env.DP_URL,
      headers: {
        "Content-Type": "application/json",
        "Signature": signature,
        "x-api-key": process.env.DP_API_KEY
      },
      data
    };

    axios.request(config)
      .then((response) => {
        console.log(JSON.stringify(response.data));
      })
      .catch((error) => {
        console.log(error);
      });
  }

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
  public static async getDirectPayObject(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { seatCount } = req.query;
    if (!seatCount) return res.status(200).send(new ServerResponse(false, null));
    const email = req.user?.email;
    const name = req.user?.name;
    const amount = await this.getInitialCharge(parseInt(seatCount as string));
    const uniqueTimestamp = moment().format("YYYYMMDDHHmmss");
    const billingMonth = await this.getBillingMonth();

    const { DP_MERCHANT_ID, DP_SECRET_KEY, DP_STAGE } = process.env;

    const payload = {
      merchant_id: DP_MERCHANT_ID,
      amount: 10,
      type: "RECURRING",
      order_id: `WORKLENZ_${email}_${uniqueTimestamp}`,
      currency: "LKR",
      return_url: null,
      response_url: null,
      first_name: name,
      last_name: null,
      phone: null,
      email,
      description: `${name} (${email})`,
      page_type: "IN_APP",
      logo: "https://app.worklenz.com/assets/icons/icon-96x96.png",
      start_date: moment().format("YYYY-MM-DD"),
      do_initial_payment: 1,
      interval: 1,
    };

    const encodePayload = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(JSON.stringify(payload)));
    const signature = CryptoJS.HmacSHA256(encodePayload, DP_SECRET_KEY as string);

    return res.status(200).send(new ServerResponse(true, { signature: signature.toString(CryptoJS.enc.Hex), dataString: encodePayload, stage: DP_STAGE }));
  }

  @HandleExceptions()
  public static async saveTransactionData(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { status, card, transaction, seatCount } = req.body;
    const { DP_MERCHANT_ID, DP_STAGE } = process.env;

    const email = req.user?.email;

    const amount = await this.getInitialCharge(parseInt(seatCount as string));
    const uniqueTimestamp = moment().format("YYYYMMDDHHmmss");
    const billingMonth = await this.getBillingMonth();

    const values = [
      status,
      card?.id,
      card?.number,
      card?.brand,
      card?.type,
      card?.issuer,
      card?.expiry?.year,
      card?.expiry?.month,
      card?.walletId,
      transaction?.id,
      transaction?.status,
      transaction?.amount || 0,
      transaction?.currency || null,
      transaction?.channel || null,
      transaction?.dateTime || null,
      transaction?.message || null,
      transaction?.description || null,
      req.user?.id,
      req.user?.owner_id,
    ];

    const q = `INSERT INTO licensing_lkr_payments (
      status, card_id, card_number, card_brand, card_type, card_issuer,
      card_expiry_year, card_expiry_month, wallet_id,
      transaction_id, transaction_status, transaction_amount, 
      transaction_currency, transaction_channel, transaction_datetime,
      transaction_message, transaction_description, user_id, owner_id
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
    );`;
    await db.query(q, values);

    if (transaction.status === "SUCCESS") {
      const payload = {
        "merchantId": DP_MERCHANT_ID,
        "reference": `WORKLENZ_${email}_${uniqueTimestamp}`,
        "type": "CARD_PAY",
        "cardId": card.id,
        "refCode": req.user?.id,
        amount,
        "currency": "LKR"
      };
      const dataString = Object.values(payload).join("");
      const { DP_STAGE } = process.env;

      const pemFile = DP_STAGE === "PROD" ? "src/keys/PRIVATE_KEY_PROD.pem" : `src/keys/PRIVATE_KEY_DEV.pem`;

      const privateKeyTest = fs.readFileSync(path.resolve(pemFile), "utf8");
      const sign = crypto.createSign("SHA256");
      sign.update(dataString);
      sign.end();

      const signature = sign.sign(privateKeyTest);
      const byteArray = new Uint8Array(signature);
      let byteString = "";
      for (let i = 0; i < byteArray.byteLength; i++) {
        byteString += String.fromCharCode(byteArray[i]);
      }
      const base64Signature = btoa(byteString);

      this.chargeInitialPayment(base64Signature, payload);
    }

    return res.status(200).send(new ServerResponse(true, null, "Your purchase has been successfully completed!").withTitle("Done"));
  }

  @HandleExceptions()
  public static async getCardList(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { DP_MERCHANT_ID, DP_REFERENCE, DP_STAGE } = process.env;

    const payload = {
      "merchantId": DP_MERCHANT_ID,
      "reference": DP_REFERENCE,
      "type": "LIST_CARD"
    };

    const dataString = `${DP_MERCHANT_ID}${DP_REFERENCE}LIST_CARD`;
    const pemFile = DP_STAGE === "PROD" ? "src/keys/PRIVATE_KEY_PROD.pem" : `src/keys/PRIVATE_KEY_DEV.pem`;

    const privateKeyTest = fs.readFileSync(path.resolve(pemFile), "utf8");
    const sign = crypto.createSign("SHA256");
    sign.update(dataString);
    sign.end();

    const signature = sign.sign(privateKeyTest);
    const byteArray = new Uint8Array(signature);
    let byteString = "";
    for (let i = 0; i < byteArray.byteLength; i++) {
      byteString += String.fromCharCode(byteArray[i]);
    }
    const base64Signature = btoa(byteString);
    // const signature = CryptoJS.HmacSHA256(dataString, DP_SECRET_KEY as string).toString(CryptoJS.enc.Hex);

    return res.status(200).send(new ServerResponse(true, { signature: base64Signature, dataString }));
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

  private static buildDirectPayOrderId(userId: string, ownerId: string): string {
    return `${this.DIRECTPAY_CARD_ORDER_PREFIX}__${userId}__${ownerId}__${Date.now()}`;
  }

  private static normalizeDirectPayUrlBase(url: string): string {
    const trimmedUrl = url.trim().replace(/\/+$/, "");
    return /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `http://${trimmedUrl}`;
  }

  private static parseDirectPayOrderOwner(orderId?: string | null): IDirectPaySessionOwner {
    if (!orderId) return { userId: null, ownerId: null };

    const match = orderId.match(/^WL_CARD__([0-9a-f-]{36})__([0-9a-f-]{36})__/i);
    return {
      userId: match?.[1] || null,
      ownerId: match?.[2] || match?.[1] || null,
    };
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
        : { rows: [] };
      const session = sessionResult.rows[0];

      const userId = fallbackUserId || session?.user_id || parsedOwner.userId;
      const ownerId = fallbackOwnerId || session?.owner_id || parsedOwner.ownerId || userId;

      if (!userId || !normalized.walletId || !normalized.cardId) {
        await client.query("ROLLBACK");
        return {
          saved: false,
          message: "Missing user, wallet, or card data in DirectPay response",
        };
      }

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
    const { amount, doInitialPayment = true } = req.body;
    const email = req.user?.email;
    const name = req.user?.name;
    const userId = req.user?.id;
    const ownerId = req.user?.owner_id || req.user?.id;
    // Phone number is optional and not available in IPassportSession
    // Can be queried from database if needed in the future
    const phone = null;

    if (!email || !name || !userId || !ownerId) {
      return res.status(400).send(new ServerResponse(false, null, "User email and name are required"));
    }

    const { DP_MERCHANT_ID, DP_SECRET_KEY, DP_STAGE, FRONTEND_URL, BACKEND_URL, PORT } = process.env;
    if (!DP_MERCHANT_ID || !DP_SECRET_KEY) {
      return res.status(500).send(new ServerResponse(false, null, "DirectPay credentials are not configured"));
    }

    const checkoutAmount = Number(amount || 10);
    if (!Number.isFinite(checkoutAmount) || checkoutAmount <= 0) {
      return res.status(400).send(new ServerResponse(false, null, "Valid amount is required"));
    }

    const orderId = this.buildDirectPayOrderId(userId, ownerId);

    // Construct backend URL for response callback
    const backendBaseUrl = this.normalizeDirectPayUrlBase(BACKEND_URL || `http://localhost:${PORT || 3000}`);
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
      response_url: `${backendBaseUrl}/webhook/directpay/card-response`,
      return_url: `${frontendBaseUrl}/worklenz/admin-center/billing`,
      first_name: firstName,
      email: email,
      description: "Worklenz - Add Payment Method",
      logo: "https://app.worklenz.com/assets/icons/icon-96x96.png",
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
      await db.query(
        `
          INSERT INTO licensing_directpay_sessions (
            order_id, user_id, owner_id, amount, currency, status, request_payload
          )
          VALUES ($1, $2, $3, $4, 'LKR', 'pending', $5)
          ON CONFLICT (order_id) DO UPDATE
          SET amount = EXCLUDED.amount,
              request_payload = EXCLUDED.request_payload,
              updated_at = CURRENT_TIMESTAMP
        `,
        [orderId, userId, ownerId, checkoutAmount, JSON.stringify(requestPayload)]
      );

      // Call DirectPay API
      const response = await axios.post(apiUrl, base64EncodedPayload, {
        headers: {
          "Content-Type": "text/plain",
          "Authorization": signature,
        },
        timeout: 30000,
      });

      const sessionData = this.decodeDirectPayApiResponse(response.data);

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
   * List cards for a user's wallet
   * Uses /api/v3/listCard
   */
  @HandleExceptions()
  public static async listCards(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { wallet_id } = req.query;

    if (!wallet_id) {
      return res.status(400).send(new ServerResponse(false, null, "wallet_id is required"));
    }

    const { DP_MERCHANT_ID, DP_SECRET_KEY, DP_STAGE } = process.env;

    const requestPayload = {
      merchant_id: DP_MERCHANT_ID,
      wallet_id: String(wallet_id),
    };

    const base64EncodedPayload = CryptoJS.enc.Base64.stringify(
      CryptoJS.enc.Utf8.parse(JSON.stringify(requestPayload))
    );

    const generatedHash = CryptoJS.HmacSHA256(base64EncodedPayload, DP_SECRET_KEY as string);
    const signature = `hmac ${generatedHash.toString(CryptoJS.enc.Hex)}`;

    const apiUrl = DP_STAGE === "PROD"
      ? "https://gateway.directpay.lk/api/v3/listCard"
      : "https://test-gateway.directpay.lk/api/v3/listCard";

    try {
      const response = await axios.post(apiUrl, base64EncodedPayload, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": signature,
        },
        timeout: 30000,
      });

      return res.status(200).send(new ServerResponse(true, this.decodeDirectPayApiResponse(response.data)));
    } catch (error: any) {
      log_error(error);
      return res.status(500).send(new ServerResponse(false, null,
        error?.response?.data?.message || "Failed to list cards"));
    }
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

    const { DP_MERCHANT_ID, DP_SECRET_KEY, DP_STAGE } = process.env;

    const requestPayload = {
      merchant_id: DP_MERCHANT_ID,
      card_id: String(card_id),
    };

    const base64EncodedPayload = CryptoJS.enc.Base64.stringify(
      CryptoJS.enc.Utf8.parse(JSON.stringify(requestPayload))
    );

    const generatedHash = CryptoJS.HmacSHA256(base64EncodedPayload, DP_SECRET_KEY as string);
    const signature = `hmac ${generatedHash.toString(CryptoJS.enc.Hex)}`;

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

      return res.status(200).send(new ServerResponse(true, this.decodeDirectPayApiResponse(response.data)));
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
    const { wallet_id, card_id, order_id, amount, currency } = req.body;

    if (!wallet_id || !card_id || !order_id || !amount) {
      return res.status(400).send(new ServerResponse(false, null, 
        "wallet_id, card_id, order_id, and amount are required"));
    }

    const { DP_MERCHANT_ID, DP_SECRET_KEY, DP_STAGE } = process.env;

    const requestPayload = {
      merchant_id: DP_MERCHANT_ID,
      wallet_id: String(wallet_id),
      card_id: String(card_id),
      order_id: String(order_id),
      currency: currency || "LKR",
      amount: String(amount),
    };

    const base64EncodedPayload = CryptoJS.enc.Base64.stringify(
      CryptoJS.enc.Utf8.parse(JSON.stringify(requestPayload))
    );

    const generatedHash = CryptoJS.HmacSHA256(base64EncodedPayload, DP_SECRET_KEY as string);
    const signature = `hmac ${generatedHash.toString(CryptoJS.enc.Hex)}`;

    const apiUrl = DP_STAGE === "PROD"
      ? "https://gateway.directpay.lk/api/v3/cardPay"
      : "https://test-gateway.directpay.lk/api/v3/cardPay";

    try {
      const response = await axios.post(apiUrl, base64EncodedPayload, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": signature,
        },
        timeout: 30000,
      });

      return res.status(200).send(new ServerResponse(true, this.decodeDirectPayApiResponse(response.data)));
    } catch (error: any) {
      log_error(error);
      return res.status(500).send(new ServerResponse(false, null,
        error?.response?.data?.message || "Failed to process payment"));
    }
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
      const remoteAddress = req.connection?.remoteAddress || req.socket?.remoteAddress;

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
      const response = await axios.get(`http://ip-api.com/json/${ip}?fields=status,country,countryCode`, {
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
        price: 0, // Free plan is always 0
      },
      pro: {
        price: proRow ? Number(proRow.monthly_base_price || 0) : 0,
        discountedPrice: proRow ? Number(proRow.annual_base_price || 0) : 0,
      },
      business: {
        price: businessRow ? Number(businessRow.monthly_base_price || 0) : 4990, // Fallback: LKR 4,990/month
        discountedPrice: businessRow ? Number(businessRow.annual_base_price || 0) : 49900, // Fallback: LKR 49,900/year
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
