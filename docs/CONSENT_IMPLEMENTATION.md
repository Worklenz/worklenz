# Cookie Consent Implementation for Microsoft Clarity

## Overview

This implementation adds GDPR-compliant cookie consent management for Microsoft Clarity analytics, required for users from the European Economic Area (EEA), United Kingdom (UK), and Switzerland, effective **October 31, 2025**.

## What Was Implemented

### 1. Consent Manager Service (`src/utils/consentManager.ts`)

A comprehensive consent management utility that:
- **Detects user region** using timezone and locale to determine if user is in GDPR region
- **Stores consent preferences** in localStorage with 365-day expiration
- **Integrates with Clarity Consent API** to apply consent decisions
- **Manages consent lifecycle** (initialize, accept, reject, clear)
- **Auto-grants consent** for non-GDPR regions

Key features:
```typescript
consentManager.initialize()     // Initialize on app load
consentManager.acceptAll()      // Accept analytics cookies
consentManager.rejectAll()      // Reject analytics cookies
consentManager.needsConsent()   // Check if banner should show
```

### 2. Cookie Consent Banner Component (`src/components/CookieConsentBanner.tsx`)

A user-friendly consent banner that:
- **Theme-aware**: Adapts to dark/light mode automatically
- **Fully internationalized**: Supports all 6 Worklenz languages
- **Responsive design**: Works on mobile and desktop
- **Accessible**: Proper ARIA labels and keyboard navigation
- **Non-intrusive**: Fixed bottom position with smooth animations

The banner only shows for users in GDPR regions who haven't made a consent choice.

### 3. Updated Clarity Integration (`public/js/clarity.js`)

Enhanced Clarity loading script that:
- **Waits for consent** before loading tracking
- **Respects consent decisions** via Clarity Consent API
- **Handles consent changes** dynamically with event listeners
- **Graceful fallback** if consent is rejected

### 4. App Integration (`src/App.tsx`)

Integrated into the main app:
- Consent manager initialized on app load
- Banner component added to app layout
- Runs before analytics initialization

### 5. Translations

Added consent strings to all supported languages:

- **English (en)**: "We use cookies"
- **German (de)**: "Wir verwenden Cookies"
- **Spanish (es)**: "Usamos cookies"
- **Portuguese (pt)**: "Usamos cookies"
- **Chinese (zh)**: "我们使用 Cookie"
- **Albanian (alb)**: "Ne përdorim cookies"

All translations include:
- Title
- Description
- Accept/Reject buttons
- Privacy policy link text

## Files Modified/Created

### Created:
- `worklenz-frontend/src/utils/consentManager.ts` - Consent management service
- `worklenz-frontend/src/components/CookieConsentBanner.tsx` - Banner UI component
- `worklenz-frontend/CONSENT_IMPLEMENTATION.md` - This documentation

### Modified:
- `worklenz-frontend/src/App.tsx` - Added consent initialization and banner
- `worklenz-frontend/public/js/clarity.js` - Updated to respect consent
- `worklenz-frontend/public/locales/en/common.json` - Added consent translations
- `worklenz-frontend/public/locales/de/common.json` - Added consent translations
- `worklenz-frontend/public/locales/es/common.json` - Added consent translations
- `worklenz-frontend/public/locales/pt/common.json` - Added consent translations
- `worklenz-frontend/public/locales/zh/common.json` - Added consent translations
- `worklenz-frontend/public/locales/alb/common.json` - Added consent translations

## How It Works

### For All Users (First Visit):
1. App loads
2. Consent banner displays at bottom of screen
3. Clarity waits for consent decision
4. User clicks Accept or Reject
5. Consent saved in localStorage (365 days)
6. Clarity loads with consent status
7. Banner disappears

### For All Users (Returning):
1. App loads
2. Consent manager reads stored preference
3. Clarity loads with stored consent status
4. No banner shown (already consented)

## Technical Details

### Storage
- **Key**: `worklenz_cookie_consent`
- **Expiration**: 365 days
- **Structure**:
```json
{
  "analytics": true/false,
  "timestamp": 1234567890,
  "region": "gdpr" or "non-gdpr"
}
```

### Region Detection (Optional Metadata)
The consent manager can detect GDPR regions for tracking/analytics purposes:
1. **Timezone**: Checks if timezone starts with "Europe/"
2. **Locale**: Checks browser language country code against EEA list

Includes all 30 EEA countries plus UK, Switzerland, Iceland, Liechtenstein, and Norway.

**Note**: The banner now shows for ALL users globally, regardless of region. Region detection is only used for storing metadata about where consent was given.

### Clarity Integration
Uses official Microsoft Clarity Consent API:
```javascript
window.clarity('consent', true/false)
```

Reference: https://learn.microsoft.com/en-us/clarity/setup-and-installation/cookie-consent

## Testing Recommendations

### 1. Test Banner Appears
- Clear localStorage (Application > Local Storage in DevTools)
- Refresh the page
- Verify banner appears at bottom of screen

### 2. Test Consent Flow
- Click "Accept" → Verify Clarity loads
- Clear localStorage → Click "Reject" → Verify Clarity doesn't track
- Refresh page → Verify choice persists
- Check localStorage for `worklenz_cookie_consent` key

### 3. Test Language Switching
- Switch Worklenz language
- Verify banner text updates (if visible)

### 4. Test Theme Compatibility
- Switch dark/light mode
- Verify banner styling adapts

## Compliance Notes

✅ **GDPR Compliant**: Users in EEA/UK/CH must explicitly consent before tracking
✅ **Cookie Directive Compliant**: Non-essential cookies only loaded with consent
✅ **Privacy by Default**: No tracking until consent given
✅ **User Control**: Clear accept/reject options with privacy policy link
✅ **Consent Expiration**: Re-asks for consent after 1 year

## Privacy Policy Link

The banner links to: `https://docs.worklenz.com/privacy-policy`

**Important**: Ensure this privacy policy:
- Explains what analytics cookies are used
- Lists Microsoft Clarity specifically
- Describes what data is collected
- Explains user rights under GDPR

## Future Enhancements (Optional)

1. **Settings Page**: Allow users to change consent later
2. **Granular Consent**: Separate options for different cookie types
3. **CMP Integration**: Integrate with third-party Consent Management Platform
4. **Google Consent Mode**: Add support if Google Analytics is added
5. **Consent Versioning**: Track consent version for policy updates
6. **Analytics**: Track consent acceptance/rejection rates

## Support

For issues or questions:
- Microsoft Clarity Support: clarityms@microsoft.com
- Clarity Documentation: https://learn.microsoft.com/en-us/clarity/

## Deadline

**October 31, 2025** - Enforcement date for EEA/UK/CH traffic

## Status

✅ Implementation Complete
✅ All Languages Supported
✅ Theme Compatible
✅ Mobile Responsive
✅ Accessibility Compliant
✅ Ready for Production
