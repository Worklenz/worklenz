if ('serviceWorker' in navigator) {
  // Check if we've already attempted to unregister in this session
  if (!sessionStorage.getItem('swUnregisterAttempted')) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      const ngswWorker = registrations.find(reg => reg.active?.scriptURL.includes('ngsw-worker'));

      if (ngswWorker) {
        // Mark that we've attempted to unregister
        sessionStorage.setItem('swUnregisterAttempted', 'true');
        // Unregister the ngsw-worker
        ngswWorker.unregister().then(() => {
          // Reload the page after unregistering
          window.location.reload(true);
        });
      } else {
        // If no ngsw-worker is found, unregister any other service workers
        for (let registration of registrations) {
          registration.unregister();
        }
      }
    });
  }
}
