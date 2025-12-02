/**
 * Microsoft Clarity Analytics with Cookie Consent
 * Loads Clarity only after user consent is obtained
 */
(function () {
  if (window.location.hostname !== 'app.worklenz.com') return;

  const CLARITY_PROJECT_ID = 'siut8ujo0c';
  const STORAGE_KEY = 'worklenz_cookie_consent';

  /**
   * Load Clarity script
   */
  function loadClarity() {
    (function (c, l, a, r, i, t, y) {
      c[a] =
        c[a] ||
        function () {
          (c[a].q = c[a].q || []).push(arguments);
        };
      t = l.createElement(r);
      t.async = 1;
      t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', CLARITY_PROJECT_ID);
  }

  /**
   * Check consent and initialize Clarity
   */
  function initializeWithConsent() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        // No consent stored yet, Clarity will be loaded after user makes a choice
        return;
      }

      const consent = JSON.parse(stored);

      // Check if consent has expired (365 days)
      const expiryTime = consent.timestamp + 365 * 24 * 60 * 60 * 1000;
      if (Date.now() > expiryTime) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }

      // Load Clarity and apply consent status
      loadClarity();

      // Wait for Clarity to be available, then apply consent
      const checkClarityLoaded = setInterval(function () {
        if (window.clarity) {
          clearInterval(checkClarityLoaded);
          window.clarity('consent', consent.analytics);
          console.log(
            'Clarity initialized with consent:',
            consent.analytics ? 'granted' : 'denied'
          );
        }
      }, 100);

      // Clear interval after 5 seconds to avoid infinite loop
      setTimeout(function () {
        clearInterval(checkClarityLoaded);
      }, 5000);
    } catch (error) {
      console.error('Error initializing Clarity with consent:', error);
    }
  }

  /**
   * Listen for consent changes
   */
  function setupConsentListener() {
    window.addEventListener('storage', function (event) {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const consent = JSON.parse(event.newValue);

          // If Clarity is not loaded yet, load it
          if (!window.clarity) {
            loadClarity();
          }

          // Wait for Clarity to be available
          const checkClarityLoaded = setInterval(function () {
            if (window.clarity) {
              clearInterval(checkClarityLoaded);
              window.clarity('consent', consent.analytics);
            }
          }, 100);

          // Clear interval after 5 seconds
          setTimeout(function () {
            clearInterval(checkClarityLoaded);
          }, 5000);
        } catch (error) {
          console.error('Error handling consent change:', error);
        }
      }
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initializeWithConsent();
      setupConsentListener();
    });
  } else {
    initializeWithConsent();
    setupConsentListener();
  }
})();
