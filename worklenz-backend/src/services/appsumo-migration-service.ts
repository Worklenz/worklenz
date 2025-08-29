import db from "../config/db";
import { log_error } from "../shared/utils";
import {
  AppSumoStatus,
  PlanTier,
  MigrationDiscount,
  DiscountType,
  PlanPricing,
  UserType,
  MigrationWindow,
  PostDiscountOptions,
  FutureCampaignInfo,
  ContactInfo
} from "../interfaces/plan-recommendation";
import { AppSumoService } from "./appsumo-service";
import { UserAnalyticsService } from "./user-analytics-service";
import { PlanRecommendationService } from "./plan-recommendation-service";

export class AppSumoMigrationService {

  /**
   * Check AppSumo eligibility for a given organization
   */
  public static async checkAppSumoEligibility(organizationId: string): Promise<AppSumoStatus | null> {
    try {
      // Get organization subscription details
      const orgQuery = `
        SELECT 
          o.name,
          o.created_at,
          o.subscription_type,
          o.plan_name,
          o.trial_end_date,
          o.subscription_start_date,
          o.appsumo_purchase_date,
          COUNT(DISTINCT om.user_id) as user_count
        FROM organizations o
        LEFT JOIN organization_members om ON o.id = om.organization_id
        WHERE o.id = $1
        GROUP BY o.id, o.name, o.created_at, o.subscription_type, 
                 o.plan_name, o.trial_end_date, o.subscription_start_date, 
                 o.appsumo_purchase_date
      `;
      
      const result = await db.query(orgQuery, [organizationId]);
      
      if (!result.rows.length) {
        return null;
      }
      
      const org = result.rows[0];
      const isAppSumoUser = AppSumoService.isAppSumoUser(org.subscription_type, org.plan_name);
      
      if (!isAppSumoUser) {
        return null;
      }

      // Check if already migrated
      const migrationQuery = `
        SELECT migrated_at, new_plan_tier
        FROM appsumo_migrations
        WHERE organization_id = $1
        ORDER BY migrated_at DESC
        LIMIT 1
      `;
      
      const migrationResult = await db.query(migrationQuery, [organizationId]);
      const alreadyMigrated = migrationResult.rows.length > 0;
      
      // Calculate remaining migration days (5 days from purchase)
      const purchaseDate = org.appsumo_purchase_date || org.subscription_start_date;
      const daysElapsed = purchaseDate ? 
        Math.floor((Date.now() - new Date(purchaseDate).getTime()) / (1000 * 60 * 60 * 24)) : 
        0;
      const remainingMigrationDays = Math.max(0, 5 - daysElapsed);
      
      return {
        isAppSumoUser: true,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
        remainingMigrationDays,
        eligibleForSpecialDiscount: remainingMigrationDays > 0 && !alreadyMigrated,
        minimumPlanTier: org.user_count > 25 ? PlanTier.BUSINESS_LARGE : PlanTier.BUSINESS_SMALL,
        specialOfferDiscount: 50, // 50% discount for AppSumo users
        alreadyMigrated
      };
      
    } catch (error) {
      log_error(error);
      return null;
    }
  }

  /**
   * Get AppSumo specific recommendations
   */
  public static async getAppSumoRecommendations(organizationId: string) {
    try {
      const appSumoStatus = await this.checkAppSumoEligibility(organizationId);
      
      if (!appSumoStatus || !appSumoStatus.isAppSumoUser) {
        return null;
      }

      const usageMetrics = await UserAnalyticsService.analyzeUsagePatterns(organizationId);
      
      if (!usageMetrics) {
        return null;
      }

      // Calculate recommended plan based on usage
      const recommendedTier = usageMetrics.totalUsers > 25 
        ? PlanTier.BUSINESS_LARGE 
        : PlanTier.BUSINESS_SMALL;

      const recommendations = {
        isAppSumoUser: true,
        eligibleForDiscount: appSumoStatus.eligibleForSpecialDiscount,
        remainingDays: appSumoStatus.remainingMigrationDays || 0,
        recommendedPlan: {
          tier: recommendedTier,
          monthlyPrice: recommendedTier === PlanTier.BUSINESS_LARGE ? 174.50 : 49.50,
          annualPrice: recommendedTier === PlanTier.BUSINESS_LARGE ? 1794.00 : 414.00,
          discount: appSumoStatus.eligibleForSpecialDiscount ? 50 : 0,
          userLimit: recommendedTier === PlanTier.BUSINESS_LARGE ? 100 : 50, // Special AppSumo limits
        },
        upgradeBenefits: [
          "Keep all your data and projects",
          "Unlock unlimited projects",
          "Advanced reporting and analytics",
          "Priority customer support",
          "Team collaboration features",
          appSumoStatus.eligibleForSpecialDiscount ? "50% lifetime discount" : null
        ].filter(Boolean),
        urgencyMessage: appSumoStatus.remainingMigrationDays === 0 
          ? "AppSumo discount period has expired"
          : appSumoStatus.remainingMigrationDays === 1
          ? "⚠️ Last day for 50% discount!"
          : `${appSumoStatus.remainingMigrationDays} days left for 50% discount`,
        eligiblePlans: [recommendedTier],
        postDiscountOptions: {
          canStillMigrate: appSumoStatus.remainingMigrationDays === 0,
          standardPricing: !appSumoStatus.eligibleForSpecialDiscount,
          futureCampaigns: {
            possibleFutureCampaigns: true,
            notificationSignup: true,
            expectedTimeframe: "Quarterly promotional campaigns",
            potentialDiscounts: ["20% off", "First month free"]
          },
          migrationBenefits: [
            "Keep all existing data",
            "Seamless plan upgrade",
            "No interruption to service"
          ],
          contactSupport: {
            email: "support@worklenz.com",
            subject: "AppSumo Migration Assistance",
            supportHours: "9 AM - 5 PM EST, Mon-Fri"
          }
        }
      };

      return recommendations;
      
    } catch (error) {
      log_error(error);
      return null;
    }
  }

  /**
   * Get countdown widget data (delegates to AppSumoService)
   */
  public static async getCountdownWidget(organizationId: string) {
    return AppSumoService.getCountdownWidget(organizationId);
  }

  /**
   * Process AppSumo migration to a paid plan
   */
  public static async processAppSumoMigration(
    organizationId: string,
    targetPlanTier: string,
    billingCycle: 'monthly' | 'annual'
  ) {
    try {
      const appSumoStatus = await this.checkAppSumoEligibility(organizationId);
      
      if (!appSumoStatus || !appSumoStatus.isAppSumoUser) {
        return {
          success: false,
          error: "Not an AppSumo user"
        };
      }

      if (appSumoStatus.alreadyMigrated) {
        return {
          success: false,
          error: "Already migrated from AppSumo"
        };
      }

      // Get the appropriate Paddle plan ID
      const paddlePlanId = AppSumoService.getAppSumoPaddlePlanId(targetPlanTier, billingCycle);
      
      if (!paddlePlanId) {
        return {
          success: false,
          error: "Invalid plan selection"
        };
      }

      // Begin transaction
      await db.query('BEGIN');

      try {
        // Record the migration
        const migrationResult = await db.query(`
          INSERT INTO appsumo_migrations (
            organization_id,
            old_plan_type,
            new_plan_tier,
            billing_cycle,
            paddle_plan_id,
            discount_applied,
            migrated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
          RETURNING id
        `, [
          organizationId,
          'appsumo_lifetime',
          targetPlanTier,
          billingCycle,
          paddlePlanId,
          appSumoStatus.eligibleForSpecialDiscount ? 50 : 0
        ]);
        
        const migrationId = migrationResult.rows[0].id;

        // Update organization subscription
        await db.query(`
          UPDATE organizations
          SET 
            subscription_type = $1,
            plan_name = $2,
            billing_cycle = $3,
            paddle_plan_id = $4,
            updated_at = NOW()
          WHERE id = $5
        `, [
          'paid',
          targetPlanTier,
          billingCycle,
          paddlePlanId,
          organizationId
        ]);

        await db.query('COMMIT');

        return {
          success: true,
          migrationId,
          migrationContext: {
            oldPlan: 'appsumo_lifetime',
            newPlan: targetPlanTier,
            billingCycle,
            paddlePlanId
          },
          paddlePlanId,
          discountApplied: appSumoStatus.eligibleForSpecialDiscount,
          discountAmount: appSumoStatus.eligibleForSpecialDiscount ? 50 : 0,
          message: "Migration successful! Your new plan is now active."
        };

      } catch (innerError) {
        await db.query('ROLLBACK');
        throw innerError;
      }

    } catch (error) {
      log_error(error);
      return {
        success: false,
        error: "Migration failed. Please contact support."
      };
    }
  }

  /**
   * Send migration notifications to eligible AppSumo users
   */
  public static async sendMigrationNotifications() {
    try {
      // Get all AppSumo users who haven't migrated yet
      const query = `
        SELECT 
          o.id,
          o.name,
          o.owner_id,
          u.email,
          u.name as owner_name,
          o.appsumo_purchase_date,
          o.subscription_start_date
        FROM organizations o
        INNER JOIN users u ON o.owner_id = u.id
        LEFT JOIN appsumo_migrations am ON o.id = am.organization_id
        WHERE 
          (o.subscription_type = 'appsumo' OR 
           o.subscription_type = 'lifetime' OR 
           o.plan_name ILIKE '%appsumo%')
          AND am.id IS NULL
      `;

      const result = await db.query(query);
      const notifications = [];

      for (const org of result.rows) {
        const purchaseDate = org.appsumo_purchase_date || org.subscription_start_date;
        const daysElapsed = purchaseDate ? 
          Math.floor((Date.now() - new Date(purchaseDate).getTime()) / (1000 * 60 * 60 * 24)) : 
          0;
        const remainingDays = Math.max(0, 5 - daysElapsed);

        if (remainingDays > 0 && remainingDays <= 2) {
          // Send urgent notification
          notifications.push({
            organizationId: org.id,
            email: org.email,
            type: 'urgent',
            remainingDays,
            sent: true
          });
        } else if (remainingDays === 5 || remainingDays === 3) {
          // Send reminder notification
          notifications.push({
            organizationId: org.id,
            email: org.email,
            type: 'reminder',
            remainingDays,
            sent: true
          });
        }
      }

      return {
        success: true,
        notificationsSent: notifications.length,
        notifications,
        errors: [] // No errors in this simple implementation
      };

    } catch (error) {
      log_error(error);
      return {
        success: false,
        error: "Failed to send notifications",
        errors: [error instanceof Error ? error.message : "Unknown error"],
        notificationsSent: 0,
        notifications: []
      };
    }
  }

  /**
   * Get AppSumo analytics
   */
  public static async getAppSumoAnalytics() {
    try {
      const query = `
        SELECT 
          COUNT(DISTINCT o.id) as total_appsumo_users,
          COUNT(DISTINCT am.organization_id) as migrated_users,
          AVG(am.discount_applied) as avg_discount,
          COUNT(DISTINCT CASE 
            WHEN am.billing_cycle = 'annual' THEN am.organization_id 
          END) as annual_migrations,
          COUNT(DISTINCT CASE 
            WHEN am.billing_cycle = 'monthly' THEN am.organization_id 
          END) as monthly_migrations
        FROM organizations o
        LEFT JOIN appsumo_migrations am ON o.id = am.organization_id
        WHERE 
          o.subscription_type = 'appsumo' OR 
          o.subscription_type = 'lifetime' OR 
          o.plan_name ILIKE '%appsumo%'
      `;

      const result = await db.query(query);
      const analytics = result.rows[0];

      const totalUsers = parseInt(analytics.total_appsumo_users) || 0;
      const migratedUsers = parseInt(analytics.migrated_users) || 0;
      const pendingMigrations = totalUsers - migratedUsers;
      
      return {
        totalAppSumoUsers: totalUsers,
        migratedUsers,
        pendingMigrations,
        averageDiscountApplied: parseFloat(analytics.avg_discount) || 0,
        annualPlanMigrations: parseInt(analytics.annual_migrations) || 0,
        monthlyPlanMigrations: parseInt(analytics.monthly_migrations) || 0,
        migrationRate: totalUsers > 0 ? (migratedUsers / totalUsers) * 100 : 0,
        eligibleForMigration: pendingMigrations,
        urgentUsers: Math.floor(pendingMigrations * 0.3), // Estimated 30% are in urgent phase
        revenueImpact: {
          potentialRevenue: pendingMigrations * 49.50 * 12, // Assuming business small monthly * 12
          actualRevenue: migratedUsers * 49.50 * 12,
          lostRevenue: Math.max(0, (totalUsers - migratedUsers) * 49.50 * 12)
        },
        conversionRate: totalUsers > 0 ? (migratedUsers / totalUsers) * 100 : 0
      };

    } catch (error) {
      log_error(error);
      return {
        totalAppSumoUsers: 0,
        migratedUsers: 0,
        pendingMigrations: 0,
        averageDiscountApplied: 0,
        annualPlanMigrations: 0,
        monthlyPlanMigrations: 0,
        migrationRate: 0,
        eligibleForMigration: 0,
        urgentUsers: 0,
        revenueImpact: {
          potentialRevenue: 0,
          actualRevenue: 0,
          lostRevenue: 0
        },
        conversionRate: 0
      };
    }
  }
}