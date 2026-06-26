/**
 * Cookie Consent Manager
 * Handles cookie consent for Microsoft Clarity analytics in compliance with GDPR
 * Supports EEA, UK, and Switzerland regions
 */

interface ConsentPreferences {
  analytics: boolean;
  timestamp: number;
  region?: string;
}

interface ClarityConsentOptions {
  hasConsent: boolean;
  metaCookies?: string[];
}

declare global {
  interface Window {
    clarity?: (command: string, ...args: any[]) => void;
  }
}

class ConsentManager {
  private readonly STORAGE_KEY = 'worklenz_cookie_consent';
  private readonly CONSENT_VERSION = '1.0';
  private readonly CONSENT_EXPIRY_DAYS = 365;

  // Regions requiring explicit consent
  private readonly GDPR_REGIONS = [
    'AT',
    'BE',
    'BG',
    'HR',
    'CY',
    'CZ',
    'DK',
    'EE',
    'FI',
    'FR',
    'DE',
    'GR',
    'HU',
    'IE',
    'IT',
    'LV',
    'LT',
    'LU',
    'MT',
    'NL',
    'PL',
    'PT',
    'RO',
    'SK',
    'SI',
    'ES',
    'SE',
    'GB',
    'CH',
    'IS',
    'LI',
    'NO',
  ];

  /**
   * Get stored consent preferences
   */
  getConsent(): ConsentPreferences | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;

      const consent: ConsentPreferences = JSON.parse(stored);

      // Check if consent has expired
      const expiryTime = consent.timestamp + this.CONSENT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
      if (Date.now() > expiryTime) {
        this.clearConsent();
        return null;
      }

      return consent;
    } catch (error) {
      console.error('Error reading consent preferences:', error);
      return null;
    }
  }

  /**
   * Save consent preferences
   */
  setConsent(analytics: boolean, region?: string): void {
    try {
      const preferences: ConsentPreferences = {
        analytics,
        timestamp: Date.now(),
        region,
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(preferences));

      // Apply consent to Clarity immediately
      this.applyClarityConsent(analytics);

      // Dispatch custom event for other listeners (like clarity.js)
      window.dispatchEvent(new CustomEvent('consentChanged', { detail: preferences }));
    } catch (error) {
      console.error('Error saving consent preferences:', error);
    }
  }

  /**
   * Clear all consent data
   */
  clearConsent(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing consent:', error);
    }
  }

  /**
   * Check if user needs to see consent banner
   */
  needsConsent(): boolean {
    const consent = this.getConsent();

    // Show banner if no consent is stored (for all users globally)
    return !consent;
  }

  /**
   * Detect if user is in a GDPR region
   * Uses timezone and locale as indicators
   */
  isGDPRRegion(): boolean {
    try {
      // Check timezone
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const europeanTimezones = [
        'Europe/',
        'Atlantic/Reykjavik',
        'Atlantic/Faroe',
        'Atlantic/Madeira',
        'Atlantic/Canary',
      ];

      if (europeanTimezones.some(tz => timezone.startsWith(tz))) {
        return true;
      }

      // Check locale (as backup)
      const locale = navigator.language || (navigator as any).userLanguage;
      if (locale) {
        const country = locale.split('-')[1]?.toUpperCase();
        if (country && this.GDPR_REGIONS.includes(country)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error detecting region:', error);
      // Err on the side of caution - show consent banner
      return true;
    }
  }

  /**
   * Apply consent preferences to Microsoft Clarity
   */
  applyClarityConsent(hasConsent: boolean): void {
    if (typeof window === 'undefined' || !window.clarity) {
      console.warn('Clarity not loaded yet, consent will be applied when available');
      return;
    }

    try {
      // Use Clarity Consent API
      // Reference: https://learn.microsoft.com/en-us/clarity/setup-and-installation/cookie-consent
      window.clarity('consent', hasConsent);

      console.log(`Clarity consent ${hasConsent ? 'granted' : 'denied'}`);
    } catch (error) {
      console.error('Error applying Clarity consent:', error);
    }
  }

  /**
   * Initialize consent on app load
   */
  initialize(): void {
    const consent = this.getConsent();

    if (consent) {
      // Apply existing consent
      this.applyClarityConsent(consent.analytics);
    }
    // If no consent stored, banner will show for all users globally
  }

  /**
   * Accept all cookies
   */
  acceptAll(): void {
    // Detect region for tracking purposes (optional metadata)
    const region = this.isGDPRRegion() ? 'gdpr' : 'non-gdpr';
    this.setConsent(true, region);
  }

  /**
   * Reject all cookies
   */
  rejectAll(): void {
    // Detect region for tracking purposes (optional metadata)
    const region = this.isGDPRRegion() ? 'gdpr' : 'non-gdpr';
    this.setConsent(false, region);
  }

  /**
   * Get consent status for analytics
   */
  hasAnalyticsConsent(): boolean {
    const consent = this.getConsent();
    return consent?.analytics ?? false;
  }
}

// Export singleton instance
export const consentManager = new ConsentManager();
