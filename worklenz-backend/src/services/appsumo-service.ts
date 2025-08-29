import { log_error } from "../shared/utils";

/**
 * Simplified AppSumo service that leverages the existing licensing backend
 * marketing campaigns system for all campaign management
 */
export class AppSumoService {
  
  // AppSumo-specific Paddle plan IDs (configured in Paddle dashboard)
  private static readonly APPSUMO_PADDLE_PLANS = {
    BUSINESS_MONTHLY: 82951,   // AppSumo Promo - Business (Monthly) - $49.50
    BUSINESS_ANNUAL: 82952,    // AppSumo Promo - Business (Annual) - $414.00
    ENTERPRISE_MONTHLY: 82949, // AppSumo Promo - Enterprise (Monthly) - $174.50
    ENTERPRISE_ANNUAL: 82950,  // AppSumo Promo - Enterprise (Annual) - $1,794.00
  };

  private static readonly LICENSING_API_URL = process.env.LICENSING_API_URL || 'http://localhost:3001';
  private static readonly APPSUMO_CAMPAIGN_CODE = 'APPSUMO_5DAY_50OFF';

  /**
   * Check if user is AppSumo customer based on subscription type
   */
  public static isAppSumoUser(subscriptionType?: string, planName?: string): boolean {
    if (!subscriptionType && !planName) return false;
    
    const lowerType = subscriptionType?.toLowerCase() || '';
    const lowerPlan = planName?.toLowerCase() || '';
    
    return lowerType.includes('appsumo') || 
           lowerType.includes('lifetime') ||
           lowerPlan.includes('appsumo') ||
           lowerPlan.includes('lifetime');
  }

  /**
   * Get AppSumo Paddle plan ID for the given tier and billing cycle
   */
  public static getAppSumoPaddlePlanId(
    planTier: string, 
    billingCycle: 'monthly' | 'annual'
  ): number | null {
    const tierKey = planTier.toLowerCase().includes('business') ? 'BUSINESS' : 
                    planTier.toLowerCase().includes('enterprise') ? 'ENTERPRISE' : null;
    
    if (!tierKey) return null;
    
    const cycleKey = billingCycle.toUpperCase();
    const planKey = `${tierKey}_${cycleKey}` as keyof typeof AppSumoService.APPSUMO_PADDLE_PLANS;
    
    return AppSumoService.APPSUMO_PADDLE_PLANS[planKey] || null;
  }

  /**
   * Check AppSumo campaign eligibility via licensing backend
   */
  public static async checkCampaignEligibility(organizationId: string): Promise<{
    eligible: boolean;
    campaignId?: string;
    discountAmount?: number;
    finalPrice?: number;
    expiresAt?: Date;
    message?: string;
    remainingDays?: number;
    remainingHours?: number;
    remainingMinutes?: number;
  }> {
    try {
      // Call licensing backend campaign eligibility function
      const response = await fetch(`${this.LICENSING_API_URL}/api/campaigns/check/${this.APPSUMO_CAMPAIGN_CODE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id: organizationId,
          target_tier: 'BUSINESS_SMALL'  // Default check
        })
      });

      if (!response.ok) {
        throw new Error(`Licensing API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.eligible) {
        const expiresAt = new Date(data.expires_at);
        const now = new Date();
        const timeDiff = expiresAt.getTime() - now.getTime();
        
        const remainingDays = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const remainingHours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const remainingMinutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

        return {
          eligible: true,
          campaignId: data.campaign_id,
          discountAmount: data.discount_amount,
          finalPrice: data.final_price,
          expiresAt,
          remainingDays: Math.max(0, remainingDays),
          remainingHours: Math.max(0, remainingHours), 
          remainingMinutes: Math.max(0, remainingMinutes),
          message: `🎉 50% OFF! Only ${remainingDays} days, ${remainingHours} hours left!`
        };
      }

      return {
        eligible: false,
        message: data.eligibility_reasons?.[0]?.reason || 'Campaign not available'
      };

    } catch (error) {
      log_error(error);
      
      // Fallback for when licensing backend is not available
      return {
        eligible: false,
        message: 'Unable to check campaign eligibility'
      };
    }
  }

  /**
   * Get countdown widget data for AppSumo users
   */
  public static async getCountdownWidget(organizationId: string): Promise<{
    isVisible: boolean;
    remainingDays: number;
    remainingHours: number;
    remainingMinutes: number;
    urgencyLevel: string;
    message: string;
    ctaText: string;
    ctaUrl: string;
  } | null> {
    try {
      const campaignData = await this.checkCampaignEligibility(organizationId);
      
      if (!campaignData.eligible) {
        return null;
      }

      const remainingDays = campaignData.remainingDays || 0;
      const remainingHours = campaignData.remainingHours || 0;
      const remainingMinutes = campaignData.remainingMinutes || 0;

      // Determine urgency level
      let urgencyLevel = 'low';
      if (remainingDays === 0 && remainingHours <= 6) {
        urgencyLevel = 'critical';
      } else if (remainingDays === 0) {
        urgencyLevel = 'high';
      } else if (remainingDays === 1) {
        urgencyLevel = 'medium';
      }

      return {
        isVisible: true,
        remainingDays,
        remainingHours,
        remainingMinutes,
        urgencyLevel,
        message: campaignData.message || '🚨 Limited time AppSumo offer!',
        ctaText: 'Upgrade Now',
        ctaUrl: '/settings/billing'
      };

    } catch (error) {
      log_error(error);
      return null;
    }
  }

  /**
   * Apply AppSumo discount to pricing calculation
   */
  public static async applyAppSumoDiscount(
    organizationId: string,
    originalPrice: number,
    planTier: string
  ): Promise<{
    discountApplied: boolean;
    discountAmount: number;
    finalPrice: number;
    paddlePlanId?: number;
    specialUserLimit?: number;
  }> {
    try {
      const campaignData = await this.checkCampaignEligibility(organizationId);
      
      if (!campaignData.eligible) {
        return {
          discountApplied: false,
          discountAmount: 0,
          finalPrice: originalPrice
        };
      }

      // For AppSumo users, Business plans allow up to 50 users (normally 25)
      const specialUserLimit = planTier.toLowerCase().includes('business') ? 50 : undefined;

      return {
        discountApplied: true,
        discountAmount: campaignData.discountAmount || (originalPrice * 0.5), // 50% off
        finalPrice: campaignData.finalPrice || (originalPrice * 0.5),
        specialUserLimit
      };

    } catch (error) {
      log_error(error);
      return {
        discountApplied: false,
        discountAmount: 0,
        finalPrice: originalPrice
      };
    }
  }
}