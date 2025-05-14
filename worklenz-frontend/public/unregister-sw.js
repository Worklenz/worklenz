if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    if (registrations.length > 0) {
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