# Pricing Modal Component

A comprehensive, theme-aware, and mobile-responsive pricing modal for SaaS platforms with dual pricing models, user personalization, and Paddle.js integration.

## Features

- **Dual Pricing Models**: Base Plan Pricing (for teams 6+ users) and Per User Pricing (for teams 1-5 users)
- **Theme Compatibility**: Full dark/light theme support with automatic theme detection
- **User Personalization**: Customized experience for Trial, Free, AppSumo, Custom Plan, and Paid users
- **Mobile Responsive**: Adaptive design with mobile drawer for smaller screens
- **Accessibility**: WCAG 2.1 AA compliant with screen reader support, keyboard navigation, and ARIA attributes
- **Real-time Calculations**: Live pricing updates with API integration
- **Paddle.js Integration**: Secure checkout process with comprehensive error handling
- **AppSumo Support**: Special discount handling with countdown timers

## Usage

### Basic Usage

```tsx
import React, { useState } from 'react';
import { PricingModal } from '@/components/pricing-modal';

function App() {
  const [showPricing, setShowPricing] = useState(false);

  const handlePlanSelect = calculation => {
    console.log('Selected plan:', calculation);
  };

  return (
    <div>
      <button onClick={() => setShowPricing(true)}>View Pricing</button>

      <PricingModal
        visible={showPricing}
        onClose={() => setShowPricing(false)}
        onPlanSelect={handlePlanSelect}
        organizationId="your-org-id"
      />
    </div>
  );
}
```

### Advanced Usage with User Personalization

```tsx
import React, { useState } from 'react';
import { PricingModal, UserPersonalization } from '@/components/pricing-modal';

function AdvancedApp() {
  const [showPricing, setShowPricing] = useState(false);

  const userPersonalization: UserPersonalization = {
    userType: 'appsumo',
    appSumoDiscountExpiry: new Date('2024-12-31'),
    usageMetrics: {
      projects: 15,
      users: 8,
      storage: 2500,
    },
  };

  const handlePlanSelect = calculation => {
    console.log('Plan selected:', calculation);
    // Handle plan selection logic
  };

  return (
    <PricingModal
      visible={showPricing}
      onClose={() => setShowPricing(false)}
      onPlanSelect={handlePlanSelect}
      userPersonalization={userPersonalization}
      organizationId="your-org-id"
      defaultPricingModel="BASE_PLAN"
      defaultBillingCycle="YEARLY"
      defaultTeamSize={8}
      showMobileDrawer={true} // Enable mobile drawer on small screens
    />
  );
}
```

### Mobile-First Usage

```tsx
import React, { useState, useEffect } from 'react';
import { PricingModal } from '@/components/pricing-modal';

function MobileApp() {
  const [showPricing, setShowPricing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <PricingModal
      visible={showPricing}
      onClose={() => setShowPricing(false)}
      showMobileDrawer={isMobile} // Automatically use drawer on mobile
      organizationId="your-org-id"
    />
  );
}
```

## Props

### PricingModal Props

| Prop                  | Type                                        | Default       | Description                      |
| --------------------- | ------------------------------------------- | ------------- | -------------------------------- |
| `visible`             | `boolean`                                   | -             | Controls modal visibility        |
| `onClose`             | `() => void`                                | -             | Callback when modal is closed    |
| `onPlanSelect`        | `(calculation: PricingCalculation) => void` | -             | Callback when plan is selected   |
| `userPersonalization` | `UserPersonalization`                       | -             | User-specific customization data |
| `loading`             | `boolean`                                   | `false`       | Shows loading state              |
| `defaultPricingModel` | `'BASE_PLAN' \| 'PER_USER'`                 | `'BASE_PLAN'` | Initial pricing model            |
| `defaultBillingCycle` | `'MONTHLY' \| 'YEARLY'`                     | `'YEARLY'`    | Initial billing cycle            |
| `defaultTeamSize`     | `number`                                    | `5`           | Initial team size                |
| `organizationId`      | `string`                                    | -             | Organization ID for API calls    |
| `showMobileDrawer`    | `boolean`                                   | `false`       | Force mobile drawer mode         |
| `preselectedPlan`     | `string`                                    | -             | Pre-select a specific plan       |

### UserPersonalization Interface

```tsx
interface UserPersonalization {
  userType: 'trial' | 'free' | 'appsumo' | 'custom' | 'paid';
  currentPlan?: string;
  trialDaysRemaining?: number;
  appSumoDiscountExpiry?: Date;
  customPlanFeatures?: string[];
  usageMetrics?: {
    projects: number;
    users: number;
    storage: number;
  };
}
```

### PricingCalculation Interface

```tsx
interface PricingCalculation {
  model: PricingModel;
  cycle: BillingCycle;
  teamSize: number;
  planId: string;
  basePrice: number;
  additionalUsersCost: number;
  totalCost: number;
  annualSavings?: number;
  discountApplied?: {
    type: 'appsumo' | 'migration' | 'promotional';
    percentage: number;
    amount: number;
  };
}
```

## Pricing Models

### Base Plan Pricing (Default)

- **Target**: Teams with 6+ users
- **Structure**: Fixed base price + per-user add-ons
- **Plans**:
  - Pro Large: $69/month (includes 15 users) + $5.99/user for additional users (max 50 total)
  - Business Large: $99/month (includes 20 users) + $5.99/user for additional users (max 100 total)
  - Enterprise: $349/month unlimited users

### Per User Pricing

- **Target**: Small teams with 1-5 users
- **Structure**: Simple per-user multiplication
- **Plans**:
  - Pro Small: $9.99/user/month or $6.99/user/month annual
  - Business Small: $14.99/user/month or $11.99/user/month annual
  - Enterprise: $349/month unlimited users (same as base plan)

## API Integration

The component integrates with the following API endpoints:

- `/api/migration/organizations/:id/eligibility` - Migration eligibility
- `/api/users/type` - User type information
- `/api/plans/` - Available plans
- `/api/plan-recommendations/organizations/:id` - Plan recommendations
- `/api/subscriptions/` - Subscription management
- `/api/plan-recommendations/organizations/:id/appsumo-countdown` - AppSumo countdown

## Environment Variables

Required environment variables for Paddle.js integration:

```env
REACT_APP_PADDLE_VENDOR_ID=your_paddle_vendor_id
REACT_APP_PADDLE_ENVIRONMENT=sandbox|production
```

## Styling

The component uses CSS custom properties for theming:

```css
.pricing-modal {
  --primary-color: #1890ff;
  --success-color: #52c41a;
  --warning-color: #faad14;
  --error-color: #ff4d4f;
  --text-color: #262626;
  --text-secondary: #8c8c8c;
  --bg-color: #ffffff;
  --bg-secondary: #fafafa;
  --border-color: #f0f0f0;
}

.pricing-modal.dark {
  --text-color: #ffffff;
  --text-secondary: #bfbfbf;
  --bg-color: #141414;
  --bg-secondary: #1f1f1f;
  --border-color: #303030;
}
```

## Accessibility Features

- **ARIA Labels**: Comprehensive labeling for screen readers
- **Keyboard Navigation**: Full keyboard support with focus management
- **Screen Reader Support**: Live regions for dynamic content updates
- **High Contrast**: Support for high contrast mode
- **Reduced Motion**: Respects user motion preferences
- **Focus Management**: Proper focus indicators and tab order

## Mobile Responsiveness

- **Adaptive Layout**: Single column on mobile, 2x2 on tablet, 1x4 on desktop
- **Touch Targets**: Minimum 44px touch targets for mobile
- **Drawer Mode**: Bottom drawer for mobile devices
- **Sticky Controls**: Fixed pricing model and team size controls on mobile
- **Optimized Typography**: Responsive font sizes and spacing

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile Safari 14+
- Chrome Mobile 90+

## Performance Considerations

- **React.memo**: Optimized re-renders for plan cards
- **useMemo**: Cached expensive calculations
- **Lazy Loading**: Progressive enhancement for features
- **Code Splitting**: Separate chunks for checkout functionality
- **Efficient State**: Minimal re-renders during pricing model switches

## Security

- **Paddle Integration**: Secure payment processing
- **Input Validation**: Client and server-side validation
- **CSRF Protection**: Token-based security
- **Rate Limiting**: API request throttling
- **Data Sanitization**: XSS protection

## Testing

```bash
# Unit tests
npm test src/components/pricing-modal

# Integration tests
npm run test:integration

# Accessibility tests
npm run test:a11y

# Visual regression tests
npm run test:visual
```

## Contributing

1. Follow the existing code style
2. Add unit tests for new features
3. Ensure accessibility compliance
4. Test on multiple devices and browsers
5. Update documentation for new props or features
