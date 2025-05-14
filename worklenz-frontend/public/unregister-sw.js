if ('serviceWorker' in navigator) {
  // Check if we've already attempted to unregister in this session
  if (!sessionStorage.getItem('swUnregisterAttempted')) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      if (registrations.length > 0) {
        // Mark that we've attempted to unregister
        sessionStorage.setItem('swUnregisterAttempted', 'true');
        // If there are registered service workers, do a hard reload first
        window.location.reload(true);
      } else {
        // If no service workers are registered, unregister any that might be pending
        for(let registration of registrations) {
          registration.unregister();
        }
      }
    });
  }
} 