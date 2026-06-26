# SaaS Subscription and User Migration System

## Overview

This document describes the comprehensive SaaS subscription system and optional user migration infrastructure built for Worklenz. The system handles multiple user types, pricing tiers, marketing campaigns, and provides an optional migration path to Paddle-powered billing.

## Key Principles

- **Optional Migration**: All migrations are completely optional - users can continue with their current plans indefinitely
- **Data Preservation**: All user data, projects, and settings remain unchanged during migration
- **Grandfathered Pricing**: Custom plan users can preserve their current pricing when migrating
- **No Pressure Policy**: Clear messaging that users are not required to migrate

## Architecture Components

### 1. Database Schema

#### Core Tables Created:

**Subscription Plans & Tiers:**
- `licensing_plan_tiers` - Defines all subscription tiers with features and pricing
- `licensing_plan_variants` - Dual pricing model support (per-user vs flat-rate)
- `licensing_subscription_transitions` - Tracks all plan changes with audit trail

**User Type Management:**
- `licensing_user_type_history` - Complete history of user type transitions
- `licensing_migration_eligibility` - Migration rules and discount eligibility
- `licensing_appsumo_migrations` - AppSumo user migration tracking (5-day window)
- `licensing_custom_plan_mappings` - Maps custom plans to new pricing tiers

**Marketing Campaigns:**
- `licensing_marketing_campaigns` - Time-limited promotional campaigns
- `licensing_campaign_redemptions` - Campaign usage tracking with attribution
- `licensing_migration_discounts` - Promotional codes for migration incentives

**Usage & Analytics:**
- `licensing_usage_tracking` - Daily usage metrics for billing and analytics
- `licensing_overage_charges` - Additional charges for usage beyond limits
- `licensing_migration_audit` - Complete audit trail of all migration activities

#### Enhanced Existing Tables:
- Added `user_type` and migration tracking to `organizations`
- Enhanced `licensing_user_subscriptions` with new pricing models
- Extended `licensing_pricing_plans` with tier relationships

### 2. Pricing Structure

#### Plan Tiers:
- **Free**: $0/month, 3 users (manual management)
- **Pro Small**: $9.99/user/month or $6.99/user/month annual (1-5 users)
- **Business Small**: $14.99/user/month or $11.99/user/month annual (1-5 users)
- **Pro Large**: $69/month base (15 users) + $5.99/user extra (max 50 users)
- **Business Large**: $99/month base (20 users) + $5.99/user extra (max 100 users)
- **Enterprise**: $349/month unlimited users

#### User Types & Migration Paths:
- **Trial Users** → Any paid plan (standard pricing)
- **Free Users** → Any paid plan (standard pricing)
- **Custom Plan Users** → Equivalent/better plans (grandfathered pricing preservation only)
- **AppSumo Users** → Business/Enterprise only (50% off for 12 months, 5-day window)

## TypeScript Services & Implementation

### 1. Core Services

**`plan-recommendation-service.ts`:**
- Comprehensive plan recommendation engine with legacy plan analysis
- Sophisticated recommendation scoring with 7 factors
- User type-specific logic and discount application
- Integration with all user analytics and cost-benefit services

**`user-analytics-service.ts`:**
- Advanced usage pattern analysis and user behavior insights
- Growth trends calculation and feature utilization tracking
- Collaboration index and personalized recommendations
- Usage-based plan recommendations and limit projections

**`appsumo-migration-service.ts`:**
- Specialized AppSumo discount handling with countdown features
- Post-discount migration support with future campaign signup
- Real-time countdown widgets and notification management
- Context-aware migration processing (within/post discount window)

**`custom-plan-mapping-service.ts`:**
- Legacy custom plan feature mapping to new pricing tiers
- Grandfathered pricing preservation with automatic coupon generation
- 70%+ feature match requirement for plan recommendations
- Custom feature analysis and upgrade path mapping

**`migration-cost-benefit-service.ts`:**
- Comprehensive migration cost/benefit analysis
- Total Cost of Ownership (TCO) and ROI calculations
- Payback period analysis and risk assessment
- Detailed migration timeline and recommendation generation

### 2. Enhanced Controllers

**`migration-controller.ts`:**
- Core migration orchestration with eligibility validation
- Migration preview with comprehensive cost analysis
- Migration execution with consent tracking and audit trails
- Admin rollback capabilities and analytics management

**`subscription-controller.ts`:**
- Paddle-integrated subscription management with legacy plan support
- Smart upgrade paths with validation and cost analysis
- Usage analytics with projections and limit checking
- Subscription lifecycle management (create, upgrade, cancel)

**`user-type-controller.ts`:**
- User type detection and management across legacy systems
- Capability assessment and eligibility checking
- Legacy plan details with migration option analysis
- User type transition tracking and history management

**`plan-recommendation-controller.ts`:** (Enhanced)
- Comprehensive recommendation generation with analytics integration
- AppSumo countdown widgets and migration flow management
- Admin operations for campaigns and notification management
- Future campaign signup and post-discount user engagement

### 3. Router Integration

All services are integrated through the following API routers, registered in `src/routes/apis/index.ts`:

- **`migration-api-router.ts`** → `/api/migration/`
- **`subscriptions-api-router.ts`** → `/api/subscriptions/`  
- **`users-api-router.ts`** → `/api/users/`
- **`plans-api-router.ts`** → `/api/plans/`
- **`plan-recommendation-api-router.ts`** → `/api/plan-recommendations/`

Each router provides comprehensive authentication, validation, and error handling for their respective domains.

## API Endpoints

### Migration APIs (`/api/migration/`)

#### Migration Status & Eligibility
```http
GET /api/migration/organizations/:id/eligibility
# Returns migration eligibility, available plans, discounts, and migration options

GET /api/migration/organizations/:id/preview
# Provides migration preview with cost analysis and feature comparison
```

#### Migration Processing
```http
POST /api/migration/organizations/:id/execute
{
  "targetPlan": "BUSINESS_SMALL",
  "billingCycle": "monthly",
  "preserveGrandfathering": true,
  "userConsent": true,
  "consentMetadata": {
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "timestamp": "2025-08-22T10:30:00Z"
  }
}
# Executes migration with comprehensive consent tracking and audit trail

POST /api/migration/organizations/:id/rollback
{
  "reason": "User requested rollback due to billing confusion",
  "adminNotes": "Customer called support within 24h window"
}
# Admin-only rollback within 24-hour window
```

#### Migration Analytics
```http
GET /api/migration/analytics
# Admin-only comprehensive migration analytics and metrics

GET /api/migration/organizations/:id/audit-trail
# Complete migration history and audit trail for organization
```

### Subscription APIs (`/api/subscriptions/`)

#### Subscription Management
```http
POST /api/subscriptions/
{
  "planId": "pro_small_monthly_2025",
  "billingCycle": "monthly",
  "userCount": 10,
  "organizationId": "uuid"
}
# Creates new subscription via Paddle integration

GET /api/subscriptions/current
# Returns current user's subscription details with usage and limits

PUT /api/subscriptions/upgrade
{
  "newPlanId": "business_large_monthly_2025",
  "effectiveDate": "immediate",
  "prorationHandling": "credit_remaining"
}
# Handles subscription upgrades with prorated billing
```

#### Usage Tracking & Limits
```http
GET /api/subscriptions/usage
# Returns current usage metrics against plan limits

POST /api/subscriptions/validate-action
{
  "action": "add_project",
  "resourceCount": 1,
  "userId": "uuid"
}
# Validates if action is allowed under current plan limits

POST /api/subscriptions/cancel
{
  "reason": "budget_constraints",
  "feedback": "Great product, will return when budget allows",
  "effectiveDate": "end_of_billing_period"
}
# Handles subscription cancellation with feedback collection
```

### User Type APIs (`/api/users/`)

#### User Type Management
```http
GET /api/users/type
# Returns current user type (Trial, Free, Custom Plan, AppSumo, Paid)

PUT /api/users/type
{
  "newType": "PAID",
  "reason": "subscription_created",
  "metadata": {
    "subscriptionId": "paddle_sub_123",
    "planId": "pro_small_monthly_2025"
  }
}
# Updates user type with transition tracking

GET /api/users/type/history
# Returns complete user type transition history
```

#### Eligibility & Capabilities
```http
POST /api/users/type/check-eligibility
{
  "action": "create_project",
  "resourceType": "project",
  "currentCount": 15
}
# Checks if user can perform action based on current type and limits

GET /api/users/legacy-plan
# Returns legacy plan details for custom plan users with migration mapping
```

### Plan Information APIs (`/api/plans/`)

#### Plan Listing & Pricing
```http
GET /api/plans/
# Returns all available plans with user-specific pricing and recommendations

GET /api/plans/:id/details
# Returns detailed plan information including features and pricing tiers

POST /api/plans/calculate-pricing
{
  "planId": "business_large_monthly_2025",
  "userCount": 25,
  "billingCycle": "annual",
  "discountCodes": ["LOYALTY25"]
}
# Calculates total pricing with discounts and user count
```

### Plan Recommendation APIs (`/api/plan-recommendations/`)

#### Comprehensive Recommendations
```http
GET /api/plan-recommendations/organizations/:id
# Returns personalized plan recommendations based on usage analytics

GET /api/plan-recommendations/organizations/:id/cost-benefit
{
  "targetPlan": "BUSINESS_SMALL",
  "analysisDepth": "comprehensive"
}
# Provides detailed cost-benefit analysis for plan migration

GET /api/plan-recommendations/organizations/:id/appsumo-countdown
# Real-time AppSumo countdown widget data with urgency messaging
```

#### AppSumo Specific Endpoints
```http
GET /api/plan-recommendations/organizations/:id/appsumo
# AppSumo user status with discount eligibility and post-discount options

POST /api/plan-recommendations/organizations/:id/appsumo/migrate
{
  "selectedPlan": "BUSINESS_SMALL",
  "userConsent": true,
  "migrationContext": "within_discount_window"
}
# Processes AppSumo migration with flexible discount handling

POST /api/plan-recommendations/organizations/:id/campaign-signup
{
  "notificationPreferences": {
    "email": true,
    "inApp": false,
    "frequency": "major_campaigns_only"
  },
  "campaignInterests": ["seasonal", "volume_discounts"]
}
# Signs up AppSumo users for future campaign notifications
```

#### Admin Plan Management
```http
POST /api/plan-recommendations/admin/appsumo/send-notifications
{
  "notificationType": "discount_reminder",
  "targetUsers": "all_eligible",
  "urgencyLevel": "medium"
}
# Bulk AppSumo notification system

GET /api/plan-recommendations/admin/analytics
# Comprehensive plan recommendation and AppSumo analytics

POST /api/plan-recommendations/admin/campaigns/create
{
  "campaignName": "Holiday Special 2025",
  "campaignCode": "HOLIDAY25",
  "discountType": "percentage",
  "discountValue": 30,
  "targetUserTypes": ["trial", "free"],
  "validUntil": "2025-12-31T23:59:59Z"
}
# Creates new marketing campaigns with targeting rules
```

### Public Information APIs (No Authentication Required)

```http
GET /api/migration/migration-info
# General information about migration availability and support

GET /api/plans/public/pricing
# Public pricing information for marketing pages

GET /api/plan-recommendations/migration-info
# Public AppSumo migration information and timeline
```

## Database Functions

### Pricing & Calculations
```sql
-- Calculate subscription price for any tier and user count
calculate_subscription_price(tier_name, user_count, billing_cycle)

-- Validate user limits against subscription
validate_user_limits(organization_id, additional_users)
```

### Migration Management
```sql
-- Determine migration eligibility and applicable discounts
determine_migration_eligibility(organization_id)

-- Process user migration with consent tracking
process_user_migration(organization_id, target_tier, billing_cycle, discount_code, initiated_by)

-- Send migration notifications to AppSumo users
notify_appsumo_users_migration()
```

### Campaign Management
```sql
-- Check campaign eligibility for specific users
check_campaign_eligibility(campaign_code, organization_id, target_tier, user_count)

-- Apply campaign discount and record redemption
apply_campaign_discount(campaign_code, organization_id, target_tier, billing_cycle, user_count, attribution)
```

## Marketing Campaigns

### Campaign Types Supported:
- **Flash Sales** - Time-limited high-discount offers
- **Holiday Promotions** - Seasonal campaigns
- **Referral Programs** - User acquisition incentives
- **Partnership Deals** - Special rates for segments

### Campaign Features:
- **Flexible Targeting** - By user type, plan tier, region, user count
- **Discount Types** - Percentage, fixed amount, BOGO, free months
- **Stacking Rules** - Control which discounts can combine
- **Attribution Tracking** - UTM parameters and conversion analytics
- **Redemption Limits** - Per-user and total limits for fraud prevention

### Sample Campaigns:
```sql
-- Flash Sale: 40% off all plans for 48 hours
INSERT INTO licensing_marketing_campaigns (
    campaign_name, campaign_code, campaign_type,
    discount_type, discount_value, discount_duration_months,
    target_user_types, target_plan_tiers,
    max_total_redemptions, is_featured
) VALUES (
    'Flash Sale - 40% Off All Plans', 'FLASH40', 'flash_sale',
    'percentage', 40, 3,
    ARRAY['trial', 'free'], ARRAY['PRO_SMALL', 'BUSINESS_SMALL'],
    100, TRUE
);
```

## Paddle Integration

### Required Paddle Products:
```
Standard Plans:
- pro_small_monthly_2025 ($9.99/user)
- pro_small_annual_2025 ($6.99/user)
- business_small_monthly_2025 ($14.99/user)
- business_small_annual_2025 ($11.99/user)
- pro_large_base_2025 ($69 base + $5.99/extra user)
- business_large_base_2025 ($99 base + $5.99/extra user)
- enterprise_2025 ($349 unlimited)

AppSumo Special Products (50% off - 5 day window):
- appsumo_business_small_50off
- appsumo_business_large_50off
- appsumo_enterprise_50off

AppSumo Standard Products (post-discount migration):
- business_small_monthly_2025
- business_large_monthly_2025
- enterprise_2025
```

### Webhook Handling:
- `subscription_created` - Complete migration process
- `subscription_updated` - Update user limits and pricing
- `subscription_cancelled` - Handle cancellations
- `subscription_payment_succeeded` - Record payments
- `subscription_payment_failed` - Handle failed payments

## Migration Process Flow

### 1. Eligibility Check
```typescript
const eligibility = await userMigrationService.checkMigrationEligibility(organizationId);
// Returns: eligible plans, discounts, special offers, migration window
```

### 2. Migration Preview
```typescript
const preview = await migrationController.getMigrationPreview(organizationId, planId);
// Returns: step-by-step preview, cost comparison, what changes vs stays same
```

### 3. User Consent & Processing
```typescript
const result = await userMigrationService.processMigration(
    organizationId, planId, preserveGrandfathering, userConsent
);
// Creates Paddle subscription, preserves data, records audit trail
```

### 4. Grandfathered Pricing (Custom Users)
```typescript
// Automatically creates Paddle coupon to preserve current pricing
const grandfatheredPlan = await createGrandfatheredPlan(currentPlan, selectedPlan, org);
// Permanent discount coupon applied to new subscription
```

## Security & Compliance

### User Consent Tracking:
- Explicit consent required for all migrations
- IP address and timestamp logging
- Audit trail for all migration activities
- GDPR-compliant data handling

### Webhook Security:
- Paddle signature verification
- Duplicate event handling
- Error logging and retry mechanisms
- Secure JWT token authentication

### Data Protection:
- All user data preserved during migration
- No data loss or corruption risk
- 24-hour rollback window for admin
- Complete audit trail maintained

## Usage Examples

### Check Migration Eligibility:
```bash
GET /api/migration/organizations/123/eligibility
```
Response includes current plan, available options, special offers, and clear messaging about the optional nature of migration.

### Get Migration Preview:
```bash
GET /api/migration/organizations/123/preview?targetPlan=BUSINESS_SMALL&billingCycle=monthly
```
Returns detailed cost-benefit analysis and migration preview.

### Execute Migration:
```bash
POST /api/migration/organizations/123/execute
{
    "targetPlan": "BUSINESS_SMALL",
    "billingCycle": "monthly",
    "preserveGrandfathering": true,
    "userConsent": true,
    "consentMetadata": {
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "timestamp": "2025-08-22T10:30:00Z"
    }
}
```

### Get Current Subscription:
```bash
GET /api/subscriptions/current
```
Returns current subscription details with usage metrics and limits.

### Validate Action Against Limits:
```bash
POST /api/subscriptions/validate-action
{
    "action": "add_project",
    "resourceCount": 1,
    "userId": "uuid"
}
```

### Get User Type Information:
```bash
GET /api/users/type
```
Returns current user type (Trial, Free, Custom Plan, AppSumo, Paid).

### Get Plan Recommendations:
```bash
GET /api/plan-recommendations/organizations/123
```
Returns personalized plan recommendations based on usage analytics.

### AppSumo Countdown Widget:
```bash
GET /api/plan-recommendations/organizations/123/appsumo-countdown
```
Returns real-time countdown data for AppSumo discount window.

## Admin Operations

### View Migration Analytics:
```bash
GET /api/migration/analytics
```
Comprehensive migration analytics and conversion metrics.

### Migration Rollback (24hr window):
```bash
POST /api/migration/organizations/123/rollback
{
    "reason": "User requested rollback due to billing confusion",
    "adminNotes": "Customer called support within 24h window"
}
```

### AppSumo Admin Operations (Notifications Disabled):
```bash
# Email notifications currently disabled - may be enabled in future
# POST /api/plan-recommendations/admin/appsumo/send-notifications
# Available for future use when email reminders are enabled
```

### Create Marketing Campaign:
```bash
POST /api/plan-recommendations/admin/campaigns/create
{
    "campaignName": "Holiday Special 2025",
    "campaignCode": "HOLIDAY25",
    "discountType": "percentage",
    "discountValue": 30,
    "targetUserTypes": ["trial", "free"],
    "validUntil": "2025-12-31T23:59:59Z"
}
```

### View Plan Recommendation Analytics:
```bash
GET /api/plan-recommendations/admin/analytics
```
Comprehensive plan recommendation and AppSumo analytics.

## Monitoring & Analytics

### Key Metrics Tracked:
- Migration eligibility by user type
- Conversion rates by offer type
- Revenue impact of migrations
- Campaign performance analytics
- User preference distributions

### Audit Trails:
- All migration activities logged
- User consent timestamps
- Admin actions tracked
- Campaign redemptions recorded
- Webhook processing logs

## Future Enhancements

### Planned Features:
- Advanced campaign A/B testing
- Personalized migration recommendations
- Enhanced analytics dashboard
- Automated migration reminders
- Multi-currency support expansion

### Integration Opportunities:
- CRM integration for sales insights
- Email marketing automation
- Customer success workflows
- Support ticket integration
- Business intelligence tools

## Deployment Notes

### Database Migrations:
1. Run `2025-08-22_saas_subscription_system.sql`
2. Run `2025-08-22_user_type_migration_system.sql`
3. Run `2025-08-22_marketing_campaigns.sql`

### Environment Variables Required:
```
PADDLE_API_KEY=your_paddle_api_key
PADDLE_ENVIRONMENT=sandbox|production
JWT_SECRET=your_jwt_secret
```

### Service Dependencies:
- PostgreSQL 15+
- Node.js 20+
- Paddle account with API access
- Email service for notifications

## Support & Maintenance

### Regular Tasks:
- Monitor campaign performance
- Review migration analytics
- Process pending custom plan mappings
- Update Paddle product catalog
- Audit webhook processing logs

### Troubleshooting:
- Check webhook logs for failed events
- Verify Paddle product synchronization
- Monitor migration audit trails
- Review user consent records
- Validate pricing calculations

This system provides a robust, scalable foundation for SaaS subscription management while maintaining the flexibility and user choice that builds customer trust and satisfaction.

---

## AppSumo Migration System - Developer Documentation

### Overview

The AppSumo migration system provides specialized handling for AppSumo customers with flexible migration windows and future campaign support. Key principle: **AppSumo users can always migrate, even after the discount period expires**.

### Migration Windows & Discount Logic

#### Primary Discount Window (5 Days)
- **50% discount** on Business plans for 12 months
- **Countdown timer** with urgency messaging
- **Real-time eligibility checking**
- **Email notifications disabled** (may be enabled in future)

#### Post-Discount Migration (Unlimited)
- **Standard pricing** applies
- **Full migration capability** maintained
- **Future campaign notifications** available
- **Enhanced support** for migration assistance

### Database Schema - AppSumo Extensions

```sql
-- AppSumo Migration Tracking
CREATE TABLE licensing_appsumo_migrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    migration_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    special_discount_rate INTEGER DEFAULT 50,
    minimum_tier_required VARCHAR(50) DEFAULT 'BUSINESS_SMALL',
    notification_sent BOOLEAN DEFAULT FALSE,
    last_notification_sent TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id)
);

-- Enhanced Migration Audit
ALTER TABLE licensing_migration_audit ADD COLUMN migration_context VARCHAR(50);
-- Values: 'within_discount_window', 'post_discount_window', 'future_campaign'

-- AppSumo Future Campaign Signups
CREATE TABLE licensing_appsumo_campaign_signups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    email VARCHAR(255) NOT NULL,
    signup_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notification_preferences JSONB,
    campaign_interests TEXT[],
    UNIQUE(organization_id)
);
```

### AppSumo Service Architecture

#### Core Service: `AppSumoMigrationService`

```typescript
// Key Methods:
checkAppSumoEligibility(organizationId: string): Promise<AppSumoStatus>
getAppSumoRecommendations(organizationId: string): Promise<AppSumoRecommendations>
processAppSumoMigration(organizationId: string, plan: PlanTier, consent: boolean)
sendMigrationNotifications(): Promise<NotificationResult>
getCountdownWidget(organizationId: string): Promise<CountdownWidget>
getAppSumoAnalytics(): Promise<AnalyticsData>
```

#### Migration Status Interface

```typescript
interface AppSumoStatus {
  isAppSumoUser: boolean;
  purchaseDate?: Date;
  remainingMigrationDays?: number;
  eligibleForSpecialDiscount: boolean;
  minimumPlanTier: "BUSINESS_SMALL" | "BUSINESS_LARGE" | "ENTERPRISE";
  specialOfferDiscount: number; // 50
  alreadyMigrated?: boolean;
}

interface PostDiscountOptions {
  canStillMigrate: boolean;
  standardPricing: boolean;
  futureCampaigns: FutureCampaignInfo;
  migrationBenefits: string[];
  contactSupport: ContactInfo;
}
```

### API Endpoints - AppSumo Specific

#### Public AppSumo Information
```http
GET /api/plan-recommendations/migration-info
# Returns general AppSumo migration availability and support info
```

#### User AppSumo Status
```http
GET /api/plan-recommendations/organizations/:id/appsumo
# Returns:
# - Current discount eligibility
# - Remaining time in discount window
# - Post-discount migration options
# - Future campaign signup availability
```

#### AppSumo Migration Processing
```http
POST /api/plan-recommendations/organizations/:id/appsumo/migrate
{
  "selectedPlan": "BUSINESS_SMALL",
  "userConsent": true
}
# Handles both discounted and standard pricing migrations
```

#### Admin AppSumo Management
```http
# Email notifications currently disabled (may be enabled in future)
# POST /api/plan-recommendations/admin/appsumo/send-notifications

GET /api/plan-recommendations/admin/analytics
# Comprehensive AppSumo migration analytics
```

### Migration Flow - Technical Implementation

#### 1. Eligibility Detection
```typescript
// Automatic AppSumo user detection
const isAppSumoUser = await db.query(`
  SELECT EXISTS(
    SELECT 1 FROM licensing_coupon_codes 
    WHERE redeemed_by = $1 AND code LIKE '%APPSUMO%'
  )
`, [userId]);

// Create migration record with 5-day window
if (isAppSumoUser && !migrationRecordExists) {
  await createAppSumoMigrationRecord(organizationId, userId);
}
```

#### 2. Discount Window Logic
```typescript
const remainingDays = Math.max(0, daysUntilDeadline);
const eligibleForDiscount = remainingDays > 0;
const migrationContext = eligibleForDiscount ? 
  'within_discount_window' : 'post_discount_window';
```

#### 3. Migration Processing
```typescript
// Flexible migration - works in both windows
const discountRate = isWithinDiscountWindow ? 50 : 0;
const paddleProductId = isWithinDiscountWindow ? 
  'appsumo_business_small_50off' : 'business_small_monthly_2025';

// Record migration with context
await recordMigrationAudit({
  organizationId,
  migrationContext,
  discountApplied: discountRate,
  userConsent: true
});
```

### Notification System

#### Email Notifications (Currently Disabled)
Email reminder system is available but currently disabled. May be enabled in future with:

```typescript
// Future implementation (disabled)
// Day 3 Reminder - sendAppSumoNotification('discount_reminder')
// Day 1 Final Warning - sendAppSumoNotification('final_warning') 
// Post-Discount Follow-up - sendAppSumoNotification('post_discount_options')
```

#### Available Email Templates (Ready for Future Use)
- **discount_reminder.html** - Standard 3-day reminder (disabled)
- **final_warning.html** - Urgent 24-hour notice (disabled)
- **post_discount_options.html** - Standard pricing migration info (disabled)
- **future_campaign_signup.html** - Campaign notification signup (available)

### Countdown Widget Integration

#### Frontend Widget API
```typescript
// Real-time countdown widget data
GET /api/plan-recommendations/organizations/:id/appsumo-countdown

Response:
{
  "isVisible": true,
  "remainingDays": 2,
  "remainingHours": 14,
  "remainingMinutes": 23,
  "urgencyLevel": "high",
  "message": "🚨 URGENT: Only 2 days left...",
  "ctaText": "Claim 50% Discount",
  "ctaUrl": "/settings/billing?appsumo=true"
}
```

#### Widget States
- **Active Discount** (Days 5-1): Countdown with discount CTA
- **Final Hours** (< 24h): Critical urgency messaging
- **Expired Discount** (Day 0+): Standard migration CTA with future campaign signup
- **Already Migrated**: Success state with referral options

### Future Campaign System

#### Campaign Signup Process
```typescript
// User opts into future campaign notifications
POST /api/plan-recommendations/organizations/:id/campaign-signup
{
  "notificationPreferences": {
    "email": true,
    "inApp": true,
    "frequency": "major_campaigns_only"
  },
  "campaignInterests": ["seasonal", "anniversary", "volume_discounts"]
}
```

#### Campaign Types Supported
- **Seasonal Campaigns** (Holiday specials, back-to-school)
- **Anniversary Campaigns** (Worklenz milestones, AppSumo partnerships)
- **Volume Discounts** (Team size-based promotions)
- **Reactivation Campaigns** (Win-back offers for inactive users)

### Analytics & Reporting

#### Key Metrics Tracked
```typescript
interface AppSumoAnalytics {
  totalAppSumoUsers: number;
  eligibleForMigration: number;
  migratedWithDiscount: number;
  migratedPostDiscount: number;
  expiredOpportunities: number;
  futureOpportunities: number;
  conversionRates: {
    withinWindow: number;
    postWindow: number;
    overall: number;
  };
  revenueImpact: {
    discountedMigrations: number;
    standardMigrations: number;
    totalARR: number;
  };
}
```

#### Admin Dashboard Queries
```sql
-- AppSumo Migration Funnel Analysis
WITH appsumo_funnel AS (
  SELECT 
    COUNT(*) as total_appsumo_users,
    COUNT(CASE WHEN lam.migration_deadline > NOW() THEN 1 END) as active_discount_eligible,
    COUNT(CASE WHEN lma.migration_context = 'within_discount_window' THEN 1 END) as discount_migrations,
    COUNT(CASE WHEN lma.migration_context = 'post_discount_window' THEN 1 END) as standard_migrations,
    COUNT(CASE WHEN lacs.id IS NOT NULL THEN 1 END) as campaign_signups
  FROM licensing_coupon_codes lcc
  LEFT JOIN licensing_appsumo_migrations lam ON lam.user_id = lcc.redeemed_by
  LEFT JOIN licensing_migration_audit lma ON lma.organization_id = lam.organization_id
  LEFT JOIN licensing_appsumo_campaign_signups lacs ON lacs.user_id = lcc.redeemed_by
  WHERE lcc.code LIKE '%APPSUMO%'
)
SELECT * FROM appsumo_funnel;
```

### Testing Strategy

#### Unit Tests
```typescript
describe('AppSumoMigrationService', () => {
  test('allows migration within discount window with 50% discount');
  test('allows migration after discount window at standard pricing');
  test('prevents duplicate migrations');
  test('handles expired discount window gracefully');
  test('generates correct countdown messages');
  test('tracks migration context correctly');
});
```

#### Integration Tests
```typescript
describe('AppSumo Migration Flow', () => {
  test('complete discount window migration flow');
  test('complete post-discount migration flow');
  test('notification sequence delivery');
  test('countdown widget state transitions');
  test('admin analytics accuracy');
});
```

### Error Handling & Edge Cases

#### Common Scenarios
```typescript
// Already migrated user attempts second migration
if (appSumoStatus.alreadyMigrated) {
  return { 
    success: false, 
    message: "User has already migrated to a standard plan",
    suggestedAction: "contact_support_for_plan_changes"
  };
}

// Discount window expired but user wants to migrate
if (!appSumoStatus.eligibleForSpecialDiscount) {
  return {
    success: true,
    migrationContext: 'post_discount_window',
    discountApplied: 0,
    message: "Successfully migrated at standard pricing. Watch for future campaigns!"
  };
}
```

#### Rollback Procedures
```sql
-- Emergency rollback (within 24 hours)
UPDATE licensing_migration_audit 
SET migration_status = 'rolled_back', rollback_reason = $1, rollback_timestamp = NOW()
WHERE id = $2 AND created_at > NOW() - INTERVAL '24 hours';
```

### Performance Considerations

#### Caching Strategy
```typescript
// Cache AppSumo status for 1 hour (countdown changes frequently)
const cacheKey = `appsumo_status_${organizationId}`;
const cacheTTL = 3600; // 1 hour

// Cache post-discount options for 24 hours (rarely changes)
const postDiscountCacheKey = `appsumo_post_discount_${organizationId}`;
const postDiscountTTL = 86400; // 24 hours
```

#### Database Optimization
```sql
-- Indexes for AppSumo queries
CREATE INDEX idx_appsumo_migrations_deadline ON licensing_appsumo_migrations(migration_deadline);
CREATE INDEX idx_appsumo_migrations_org ON licensing_appsumo_migrations(organization_id);
CREATE INDEX idx_coupon_codes_appsumo ON licensing_coupon_codes(redeemed_by) WHERE code LIKE '%APPSUMO%';
```

### Deployment Checklist

#### Pre-Deployment
- [ ] Database migrations applied
- [ ] Paddle products created (discounted + standard)
- [ ] Email templates configured
- [ ] Notification schedules configured
- [ ] Admin analytics dashboard ready

#### Post-Deployment
- [ ] AppSumo user detection working
- [ ] Countdown widgets displaying correctly
- [ ] Email notifications sending
- [ ] Migration flows tested (both discount & standard)
- [ ] Admin analytics populating

### Support & Troubleshooting

#### Common Issues
```typescript
// Issue: User doesn't see AppSumo options
// Solution: Check coupon code detection
const debugAppSumoStatus = await db.query(`
  SELECT lcc.code, lcc.redeemed_by, lam.migration_deadline
  FROM licensing_coupon_codes lcc
  LEFT JOIN licensing_appsumo_migrations lam ON lam.user_id = lcc.redeemed_by
  WHERE lcc.redeemed_by = $1
`, [userId]);

// Issue: Countdown widget not updating
// Solution: Check cache invalidation and real-time calculation
```

#### Support Contact Points
- **AppSumo Migration Issues**: appsumo-support@worklenz.com
- **Technical Implementation**: dev-team@worklenz.com
- **Campaign Management**: marketing@worklenz.com

This comprehensive AppSumo system ensures that all AppSumo customers have a smooth migration path with or without discounts, while providing clear communication about future opportunities and maintaining excellent customer relationships.