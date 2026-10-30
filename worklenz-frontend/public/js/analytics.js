/**
 * Google Analytics initialization module
 * Handles analytics loading and privacy notices
 */

// Worklenz's own deployments: the cloud service and its test servers (as isTestServer() in the backend)
const PRODUCTION_HOST = 'app.worklenz.com';
const TEST_HOSTS = ['dev.worklenz.com', 'uat.app.worklenz.com'];

class AnalyticsManager {
  constructor() {
    const hostname = window.location.hostname;
    this.isProduction = hostname === PRODUCTION_HOST;
    this.isWorklenzHosted = this.isProduction || TEST_HOSTS.includes(hostname);
    this.trackingId = this.isProduction ? 'G-7KSRKQ1397' : 'G-3LM2HGWEXG';
  }

  /**
   * Initialize Google Analytics asynchronously
   */
  init() {
    // Self-hosted instances never contact Google Analytics, like clarity.js and hubspot.js
    if (!this.isWorklenzHosted) return;

    const loadAnalytics = () => {
      // Load the Google Analytics script
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${this.trackingId}`;
      document.head.appendChild(script);

      // Initialize Google Analytics
      window.dataLayer = window.dataLayer || [];
      function gtag() {
        dataLayer.push(arguments);
      }
      gtag('js', new Date());
      gtag('config', this.trackingId);
    };

    // Use requestIdleCallback if available, otherwise setTimeout
    if ('requestIdleCallback' in window) {
      requestIdleCallback(loadAnalytics, { timeout: 2000 });
    } else {
      setTimeout(loadAnalytics, 1000);
    }
  }

  /**
   * Legacy privacy notice removed - now using cookie consent banner
   * See: src/components/CookieConsentBanner.tsx
   */
}

// Initialize analytics when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const analytics = new AnalyticsManager();
  analytics.init();
  // Note: Cookie consent is now handled by CookieConsentBanner component
});
