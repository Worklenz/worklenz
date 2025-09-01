import { PricingData } from './types';

export const calculatePrice = (
  basePrice: number,
  teamSize: number,
  includedUsers: number,
  additionalUserPrice: number,
  isAnnual: boolean = false
): number => {
  const extraUsers = Math.max(0, teamSize - includedUsers);
  const multiplier = isAnnual ? 12 : 1;
  return basePrice + (extraUsers * additionalUserPrice * multiplier);
};

export const getInitialPricingData = (): PricingData => ({
  free: {
    monthly_price: '0',
    annual_price: '0',
    users_included: '',
    max_users: '',
    pricing_model: 'free',
    tier_id: '',
  },
  pro: {
    monthly_price: '',
    annual_price: '',
    annual_total: '',
    users_included: '',
    max_users: '',
    additional_user_price: '',
    monthly_plan_id: '',
    annual_plan_id: '',
    pricing_model: 'base_plan',
    tier_id: '',
  },
  pro_small: {
    monthly_price: '',
    annual_price: '',
    users_included: '',
    max_users: '',
    pricing_model: 'per_user',
    additional_user_price: '',
    monthly_plan_id: '',
    annual_plan_id: '',
    tier_id: '',
  },
  business: {
    monthly_price: '',
    annual_price: '',
    annual_total: '',
    users_included: '',
    max_users: '',
    additional_user_price: '',
    monthly_plan_id: '',
    annual_plan_id: '',
    pricing_model: 'base_plan',
    tier_id: '',
  },
  business_small: {
    monthly_price: '',
    annual_price: '',
    users_included: '',
    max_users: '',
    pricing_model: 'per_user',
    additional_user_price: '',
    monthly_plan_id: '',
    annual_plan_id: '',
    tier_id: '',
  },
  enterprise: {
    monthly_price: '',
    annual_price: '',
    annual_total: '',
    users_included: 'Unlimited',
    max_users: 'Unlimited',
    additional_user_price: '0',
    monthly_plan_id: '',
    annual_plan_id: '',
    pricing_model: 'base_plan',
    tier_id: '',
  },
});

export const mapTierBasedPricingToFrontend = (tiers: any[]): PricingData => {
  const mapped = getInitialPricingData();

  tiers.forEach(tier => {
    const tierName = tier.tier_name;
    const getPlanId = (tier: any, isAnnual: boolean) => 
      isAnnual 
        ? (tier.plans?.annual_plan_id || tier.annual_paddle_plan_id || tier.paddle_plan_id || '')
        : (tier.plans?.monthly_plan_id || tier.monthly_paddle_plan_id || tier.paddle_plan_id || '');

    switch (tierName) {
      case 'PRO_SMALL':
        mapped.pro_small = {
          monthly_price: tier.monthly_per_user_price?.toString() || '',
          annual_price: tier.annual_per_user_price?.toString() || '',
          users_included: tier.min_users?.toString() || '',
          max_users: tier.max_users?.toString() || '',
          additional_user_price: tier.monthly_per_user_price?.toString() || '',
          pricing_model: 'per_user',
          monthly_plan_id: getPlanId(tier, false),
          annual_plan_id: getPlanId(tier, true),
          tier_id: tier.id,
        };
        break;
        
      case 'PRO_LARGE':
        mapped.pro = {
          monthly_price: tier.monthly_base_price?.toString() || '',
          annual_price: tier.annual_base_price
            ? (Number(tier.annual_base_price) / 12).toFixed(2)
            : '',
          annual_total: tier.annual_base_price?.toString() || '',
          users_included: tier.included_users?.toString() || '',
          max_users: tier.max_users?.toString() || '',
          additional_user_price: tier.monthly_per_user_price?.toString() || '',
          pricing_model: 'base_plan',
          monthly_plan_id: getPlanId(tier, false),
          annual_plan_id: getPlanId(tier, true),
          tier_id: tier.id,
        };
        break;
        
      case 'BUSINESS_SMALL':
        mapped.business_small = {
          monthly_price: tier.monthly_per_user_price?.toString() || '',
          annual_price: tier.annual_per_user_price?.toString() || '',
          users_included: tier.min_users?.toString() || '',
          max_users: tier.max_users?.toString() || '',
          additional_user_price: tier.monthly_per_user_price?.toString() || '',
          pricing_model: 'per_user',
          monthly_plan_id: getPlanId(tier, false),
          annual_plan_id: getPlanId(tier, true),
          tier_id: tier.id,
        };
        break;
        
      case 'BUSINESS_LARGE':
        mapped.business = {
          monthly_price: tier.monthly_base_price?.toString() || '',
          annual_price: tier.annual_base_price
            ? (Number(tier.annual_base_price) / 12).toFixed(2)
            : '',
          annual_total: tier.annual_base_price?.toString() || '',
          users_included: tier.included_users?.toString() || '',
          max_users: tier.max_users?.toString() || '',
          additional_user_price: tier.monthly_per_user_price?.toString() || '',
          pricing_model: 'base_plan',
          monthly_plan_id: getPlanId(tier, false),
          annual_plan_id: getPlanId(tier, true),
          tier_id: tier.id,
        };
        break;
        
      case 'ENTERPRISE':
        mapped.enterprise = {
          monthly_price: tier.monthly_base_price?.toString() || '',
          annual_price: tier.annual_base_price
            ? (Number(tier.annual_base_price) / 12).toFixed(2)
            : '',
          annual_total: tier.annual_base_price?.toString() || '',
          users_included: 'Unlimited',
          max_users: 'Unlimited',
          additional_user_price: '0',
          pricing_model: 'base_plan',
          monthly_plan_id: getPlanId(tier, false),
          annual_plan_id: getPlanId(tier, true),
          tier_id: tier.id,
        };
        break;
        
      case 'FREE':
        mapped.free = {
          monthly_price: '0',
          annual_price: '0',
          users_included: tier.included_users?.toString() || '',
          max_users: tier.max_users?.toString() || '',
          additional_user_price: '0',
          pricing_model: 'free',
          tier_id: tier.id,
        };
        break;
    }
  });

  return mapped;
};