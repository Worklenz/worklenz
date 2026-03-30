import db from "../config/db";
import { log_error } from "../shared/utils";

export interface IAppSumoLtdEntitlement {
  is_ltd: boolean;
  redeemed_codes_count: number;
  appsumo_business_eligible: boolean;
}

const BUSINESS_UNLOCK_CODE_COUNT = 5;

export class AppSumoLtdEntitlementService {
  public static async getEntitlementForUser(userId: string): Promise<IAppSumoLtdEntitlement> {
    try {
      const result = await db.query(
        `SELECT
            EXISTS(
              SELECT 1
              FROM licensing_coupon_codes lcc
              WHERE lcc.redeemed_by = $1
                AND lcc.is_redeemed = TRUE
                AND lcc.is_refunded = FALSE
            ) AS is_ltd,
            COUNT(*)::INT AS redeemed_codes_count
         FROM licensing_coupon_codes lcc
         WHERE lcc.redeemed_by = $1
           AND lcc.is_redeemed = TRUE
           AND lcc.is_refunded = FALSE;`,
        [userId]
      );

      const row = result.rows[0];
      const redeemedCodesCount = row?.redeemed_codes_count ?? 0;
      const isLtd = row?.is_ltd === true;

      return {
        is_ltd: isLtd,
        redeemed_codes_count: redeemedCodesCount,
        appsumo_business_eligible: isLtd && redeemedCodesCount >= BUSINESS_UNLOCK_CODE_COUNT,
      };
    } catch (error) {
      log_error(error);
      return { is_ltd: false, redeemed_codes_count: 0, appsumo_business_eligible: false };
    }
  }

  public static getBusinessUnlockCodeCount(): number {
    return BUSINESS_UNLOCK_CODE_COUNT;
  }
}

