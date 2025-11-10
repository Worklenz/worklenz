# Business Plan Trial System

## Overview

The Business Plan Trial system allows users to experience premium Business plan features for 7 days without requiring a credit card. This document outlines the complete implementation, user flow, and technical architecture.

## Features Unlocked During Trial

During the 7-day Business plan trial, users gain access to:

- **Client Portal**: External client access to project updates and collaboration
- **Project Finance**: Budget tracking, cost management, and financial reporting
- **Advanced Analytics**: Enhanced reporting, insights, and data visualization
- **Resource Tools**: Advanced team workload management and resource allocation

## User Flow

### 1. Trial Eligibility Check

The system automatically checks if a user is eligible for the Business plan trial:

- User must not have previously used a Business plan trial
- User must not currently be on any other plan trial
- User must be authenticated and have team access

### 2. Trial Offer Display

Eligible users see trial offers in two locations:

#### Alert Banner (Primary)
- Appears at the top of the application via `BusinessPlanTrialAlert`
- Clean, dismissible banner with direct "Start Free Trial" button
- Shows trial duration and "No card required" messaging

#### Upgrade Modal Integration
- Business plan card shows "Start Free Trial" instead of "Choose Plan"
- Seamlessly integrated into existing pricing modal flow

### 3. Trial Activation Process

When "Start Free Trial" is clicked:

1. **Frontend Validation**: Button shows loading state
2. **API Call**: `PlanTrialApiService.startBusinessTrial()`
3. **Backend Processing**: Creates trial record and updates session
4. **Database Update**: New record in `licensing_plan_trials` table
5. **Page Refresh**: Updates UI to reflect trial status
6. **Feature Unlock**: Business features become immediately available

### 4. Active Trial Experience

During the trial period:

- **Status Display**: Active trial banner with countdown timer
- **Feature Access**: All Business plan features fully functional
- **Upgrade Prompts**: Clear calls-to-action to convert before expiration
- **Time Remaining**: Visual countdown in days/hours format

### 5. Trial Expiration

When trial expires:

- **Feature Lock**: Business features become unavailable
- **Upgrade Prompts**: Persistent upgrade messaging
- **Data Retention**: All data created during trial is preserved

## Technical Implementation

### Database Schema

```sql
-- Core trial tracking table
CREATE TABLE licensing_plan_trials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    team_id UUID NOT NULL REFERENCES teams(id),
    plan_id UUID NOT NULL REFERENCES licensing_pricing_plans(id),
    trial_start_date TIMESTAMP DEFAULT NOW(),
    trial_end_date TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Supporting function for trial duration
CREATE OR REPLACE FUNCTION get_business_plan_trial_duration()
RETURNS INTEGER AS $$
DECLARE
    trial_duration_days INTEGER := 7;
BEGIN
    RETURN trial_duration_days;
END;
$$ LANGUAGE plpgsql;
```

### API Endpoints

#### Check Trial Eligibility
```typescript
GET /api/plan-trials/business/eligibility
Response: {
  can_start_trial: boolean,
  has_used_trial: boolean,
  current_trial?: PlanTrialInfo
}
```

#### Start Business Trial
```typescript
POST /api/plan-trials/business/start
Response: {
  done: boolean,
  message: string,
  body?: {
    trial_id: string,
    end_date: string
  }
}
```

### Frontend Components

#### BusinessPlanTrialAlert
- **Location**: `src/components/BusinessPlanTrialAlert/`
- **Purpose**: Main trial offer and status display
- **States**: Eligible, Active, Loading
- **Features**: Dismissible, i18n support, direct trial start

#### BusinessTrialCard
- **Location**: `src/components/admin-center/billing/drawers/upgrade-plans/components/`
- **Purpose**: Detailed trial information in upgrade flow
- **Features**: Countdown timer, feature highlights, upgrade CTA

#### UpgradePlans Integration
- **Modified**: Business plan card conditional rendering
- **Logic**: Shows trial button for eligible users
- **Fallback**: Standard "Choose Plan" for non-eligible users

### Session Management

Trial status is tracked in user session:

```typescript
interface UserSession {
  plan_trial_id?: string;
  plan_trial_start_date?: string;
  plan_trial_end_date?: string;
  plan_trial_plan_id?: string;
}
```

### Utility Functions

```typescript
// Check if user is on Business trial
export const isOnBusinessTrial = (session: UserSession): boolean => {
  return session?.plan_trial_plan_id === BUSINESS_PLAN_ID;
};

// Get remaining trial days
export const getPlanTrialDaysRemaining = (session: UserSession): number => {
  if (!session?.plan_trial_end_date) return 0;
  const endDate = new Date(session.plan_trial_end_date);
  const now = new Date();
  return Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
};
```

## Internationalization

Full i18n support across 6 languages (en, de, es, pt, zh, alb):

```json
{
  "business-trial-offer": "Try Business Plan Free for 7 Days",
  "business-trial-unlock": "Unlock Client Portal, Project Finance & more",
  "business-trial-no-card": "No credit card required",
  "business-trial-start": "Start Free Trial",
  "business-trial-active": "Business Trial Active",
  "business-trial-days-remaining": "{{days}} days remaining in your Business trial",
  "business-trial-upgrade": "Upgrade Now"
}
```

## Security Considerations

- **Eligibility Validation**: Server-side checks prevent trial abuse
- **Session Management**: Trial status validated on each request
- **Rate Limiting**: API endpoints protected against spam
- **Data Integrity**: Trial records immutable once created

## Performance Optimizations

- **Lazy Loading**: Trial components loaded only when needed
- **Caching**: Eligibility checks cached to reduce API calls
- **Efficient Queries**: Database indexes on trial lookup fields
- **Memory Management**: Proper cleanup of trial-related subscriptions

## Monitoring and Analytics

Key metrics to track:

- **Trial Conversion Rate**: Users who upgrade after trial
- **Feature Usage**: Which Business features are used most during trial
- **Trial Completion Rate**: Users who complete full 7-day trial
- **Time to Conversion**: How quickly trial users upgrade

## Future Enhancements

Potential improvements:

- **Extended Trials**: Ability to offer longer trial periods
- **Feature-Specific Trials**: Trial access to individual Business features
- **Trial Extensions**: One-time extensions for engaged users
- **Onboarding Integration**: Guided trial experience with feature tutorials

## Troubleshooting

### Common Issues

1. **Trial Not Starting**: Check eligibility API response and user session
2. **Features Not Unlocking**: Verify session refresh and plan ID matching
3. **UI Not Updating**: Ensure page refresh after trial activation
4. **Countdown Timer Wrong**: Check timezone handling in date calculations

### Debug Commands

```bash
# Check trial records in database
psql -d worklenz_db -c "SELECT * FROM licensing_plan_trials WHERE user_id = 'USER_UUID';"

# Verify Business plan ID
psql -d worklenz_db -c "SELECT id, name FROM licensing_pricing_plans WHERE name ILIKE '%business%';"

# Check trial duration function
psql -d worklenz_db -c "SELECT get_business_plan_trial_duration();"
```

## Conclusion

The Business Plan Trial system provides a frictionless way for users to experience premium features, driving conversion while maintaining a clean user experience. The 7-day duration balances user evaluation time with business conversion goals.