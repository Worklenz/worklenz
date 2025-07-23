/**
 * HubSpot Chat Widget integration module
 * Handles widget loading and dark mode theming
 */

class HubSpotManager {
  constructor() {
    this.isProduction = window.location.hostname === 'app.worklenz.com';
    this.scriptId = 'hs-script-loader';
    this.scriptSrc = '//js.hs-scripts.com/22348300.js';
    this.styleId = 'hubspot-dark-mode-override';
  }

  /**
   * Load HubSpot script with dark mode support
   */
  init() {
    if (!this.isProduction) return;

    const loadHubSpot = () => {
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.id = this.scriptId;
      script.async = true;
      script.defer = true;
      script.src = this.scriptSrc;
      
      // Configure dark mode after script loads
      script.onload = () => this.setupDarkModeSupport();
      
      document.body.appendChild(script);
    };

    // Use requestIdleCallback for better performance
    if ('requestIdleCallback' in window) {
      requestIdleCallback(loadHubSpot, { timeout: 3000 });
    } else {
      setTimeout(loadHubSpot, 2000);
    }
  }

  /**
   * Setup dark mode theme switching for HubSpot widget
   */
  setupDarkModeSupport() {
    const applyTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      
      // Remove existing theme styles
      const existingStyle = document.getElementById(this.styleId);
      if (existingStyle) {
        existingStyle.remove();
      }
      
      if (isDark) {
        this.injectDarkModeCSS();
      }
    };
    
    // Apply initial theme after delay to ensure widget is loaded
    setTimeout(applyTheme, 1000);
    
    // Watch for theme changes
    const observer = new MutationObserver(applyTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  /**
   * Inject CSS for dark mode styling
   */
  injectDarkModeCSS() {
    const style = document.createElement('style');
    style.id = this.styleId;
    style.textContent = `
      /* HubSpot Chat Widget Dark Mode Override */
      #hubspot-conversations-inline-parent,
      #hubspot-conversations-iframe-container,
      .shadow-2xl.widget-align-right.widget-align-bottom,
      [data-test-id="chat-widget"],
      [class*="VizExCollapsedChat"],
      [class*="VizExExpandedChat"],
      iframe[src*="hubspot"] {
        filter: invert(1) hue-rotate(180deg) !important;
        background: transparent !important;
      }
      
      /* Target HubSpot widget container backgrounds */
      #hubspot-conversations-inline-parent div,
      #hubspot-conversations-iframe-container div,
      [data-test-id="chat-widget"] div {
        background-color: transparent !important;
      }
      
      /* Prevent double inversion of images, avatars, and icons */
      #hubspot-conversations-iframe-container img,
      #hubspot-conversations-iframe-container [style*="background-image"],
      #hubspot-conversations-iframe-container svg,
      iframe[src*="hubspot"] img,
      iframe[src*="hubspot"] svg,
      [data-test-id="chat-widget"] img,
      [data-test-id="chat-widget"] svg {
        filter: invert(1) hue-rotate(180deg) !important;
      }
      
      /* Additional targeting for widget launcher and chat bubble */
      div[class*="shadow-2xl"],
      div[class*="widget-align"],
      div[style*="position: fixed"] {
        filter: invert(1) hue-rotate(180deg) !important;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Remove HubSpot widget and associated styles
   */
  cleanup() {
    const script = document.getElementById(this.scriptId);
    const style = document.getElementById(this.styleId);
    
    if (script) script.remove();
    if (style) style.remove();
  }
}

// Initialize HubSpot integration
document.addEventListener('DOMContentLoaded', () => {
  const hubspot = new HubSpotManager();
  hubspot.init();
  
  // Make available globally for potential cleanup
  window.HubSpotManager = hubspot;
});