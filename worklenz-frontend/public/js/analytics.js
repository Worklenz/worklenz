/**
 * Google Analytics initialization module
 * Handles analytics loading and privacy notices
 */

class AnalyticsManager {
  constructor() {
    this.isProduction = window.location.hostname === 'app.worklenz.com';
    this.trackingId = this.isProduction ? 'G-7KSRKQ1397' : 'G-3LM2HGWEXG';
  }

  /**
   * Initialize Google Analytics asynchronously
   */
  init() {
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
   * Show privacy notice for non-production environments
   */
  showPrivacyNotice() {
    const notice = document.createElement('div');
    notice.style.cssText = `
      position: fixed;
      bottom: 16px;
      right: 16px;
      background: #222;
      color: #f5f5f5;
      padding: 12px 16px 10px 16px;
      border-radius: 7px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.18);
      z-index: 1000;
      max-width: 320px;
      font-family: Inter, sans-serif;
      border: 1px solid #333;
      font-size: 0.95rem;
    `;
    notice.innerHTML = `
      <div style="margin-bottom: 6px; font-weight: 600; color: #fff; font-size: 1rem;">Analytics Notice</div>
      <div style="margin-bottom: 8px; color: #f5f5f5;">This app uses Google Analytics for anonymous usage stats. No personal data is tracked.</div>
      <button id="analytics-notice-btn" style="padding: 5px 14px; background: #1890ff; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 0.95rem;">Got it</button>
    `;
    document.body.appendChild(notice);

    // Add event listener to button
    const btn = notice.querySelector('#analytics-notice-btn');
    btn.addEventListener('click', e => {
      e.preventDefault();
      localStorage.setItem('privacyNoticeShown', 'true');
      notice.remove();
    });
  }

  /**
   * Check if privacy notice should be shown
   */
  checkPrivacyNotice() {
    const isProduction =
      window.location.hostname === 'worklenz.com' ||
      window.location.hostname === 'app.worklenz.com';
    const noticeShown = localStorage.getItem('privacyNoticeShown') === 'true';

    // Show notice if not in production and not shown before
    if (!isProduction && !noticeShown) {
      this.showPrivacyNotice();
    }
  }
}

// Initialize analytics when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const analytics = new AnalyticsManager();
  analytics.init();
  analytics.checkPrivacyNotice();
});
