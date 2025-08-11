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
      
      // Apply dark mode CSS if dark theme is active
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
      /*
        Note: We can only style the container backgrounds, not the widget UI inside the iframe.
        HubSpot does not currently support external dark mode theming for the chat UI itself.
      */
      #hubspot-conversations-inline-parent,
      #hubspot-conversations-iframe-container {
        background: #141414 !important;
      }
      /* Target HubSpot widget container backgrounds */
      #hubspot-conversations-inline-parent div,
      #hubspot-conversations-iframe-container div,
      [data-test-id="chat-widget"] div {
        background-color: transparent !important;
      }
      /* Ensure Worklenz app elements are not affected by HubSpot styles */
      .ant-menu,
      .ant-menu *,
      [class*="settings"],
      [class*="sidebar"],
      .worklenz-app *:not([id*="hubspot"]):not([class*="widget"]) {
        filter: none !important;
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

// Add this style to ensure the chat widget uses the light color scheme
(function() {
  var style = document.createElement('style');
  style.innerHTML = '#hubspot-messages-iframe-container { color-scheme: light !important; }';
  document.head.appendChild(style);
})();