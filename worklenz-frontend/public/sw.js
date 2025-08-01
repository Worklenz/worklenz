// Worklenz Service Worker
// Provides offline functionality, caching, and performance improvements

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAMES = {
  STATIC: `worklenz-static-${CACHE_VERSION}`,
  DYNAMIC: `worklenz-dynamic-${CACHE_VERSION}`,
  API: `worklenz-api-${CACHE_VERSION}`,
  IMAGES: `worklenz-images-${CACHE_VERSION}`,
};

// Resources to cache immediately on install
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/env-config.js',
  '/manifest.json',
  // Ant Design and other critical CSS/JS will be cached as they're requested
];

// API endpoints that can be cached
const CACHEABLE_API_PATTERNS = [
  /\/api\/project-categories/,
  /\/api\/project-statuses/,
  /\/api\/task-priorities/,
  /\/api\/task-statuses/,
  /\/api\/job-titles/,
  /\/api\/teams\/\d+\/members/,
  /\/api\/auth\/user/, // Cache user info for offline access
];

// Resources that should never be cached
const NEVER_CACHE_PATTERNS = [
  /\/api\/auth\/login/,
  /\/api\/auth\/logout/,
  /\/api\/notifications/,
  /\/socket\.io/,
  /\.hot-update\./,
  /sw\.js$/,
  /chrome-extension/,
  /moz-extension/,
];

// Install event - Cache static resources
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');

  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAMES.STATIC);
        await cache.addAll(STATIC_CACHE_URLS);
        console.log('Service Worker: Static resources cached');

        // Skip waiting to activate immediately
        await self.skipWaiting();
      } catch (error) {
        console.error('Service Worker: Installation failed', error);
      }
    })()
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');

  event.waitUntil(
    (async () => {
      try {
        // Clean up old caches
        const cacheNames = await caches.keys();
        const oldCaches = cacheNames.filter(name =>
          Object.values(CACHE_NAMES).every(currentCache => currentCache !== name)
        );

        await Promise.all(oldCaches.map(cacheName => caches.delete(cacheName)));

        console.log('Service Worker: Old caches cleaned up');

        // Take control of all pages
        await self.clients.claim();
      } catch (error) {
        console.error('Service Worker: Activation failed', error);
      }
    })()
  );
});

// Fetch event - Handle all network requests
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and browser extensions
  if (request.method !== 'GET' || NEVER_CACHE_PATTERNS.some(pattern => pattern.test(url.href))) {
    return;
  }

  event.respondWith(handleFetchRequest(request));
});

// Main fetch handler with different strategies based on resource type
async function handleFetchRequest(request) {
  const url = new URL(request.url);

  try {
    // Static assets - Cache First strategy
    if (isStaticAsset(url)) {
      return await cacheFirstStrategy(request, CACHE_NAMES.STATIC);
    }

    // Images - Cache First with long-term storage
    if (isImageRequest(url)) {
      return await cacheFirstStrategy(request, CACHE_NAMES.IMAGES);
    }

    // API requests - Network First with fallback
    if (isAPIRequest(url)) {
      return await networkFirstStrategy(request, CACHE_NAMES.API);
    }

    // HTML pages - Stale While Revalidate
    if (isHTMLRequest(request)) {
      return await staleWhileRevalidateStrategy(request, CACHE_NAMES.DYNAMIC);
    }

    // Everything else - Network First
    return await networkFirstStrategy(request, CACHE_NAMES.DYNAMIC);
  } catch (error) {
    console.error('Service Worker: Fetch failed', error);
    return createOfflineResponse(request);
  }
}

// Cache First Strategy - Try cache first, fallback to network
async function cacheFirstStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.status === 200) {
      // Clone before caching as response can only be used once
      const responseClone = networkResponse.clone();
      await cache.put(request, responseClone);
    }
    return networkResponse;
  } catch (error) {
    console.error('Cache First: Network failed', error);
    throw error;
  }
}

// Network First Strategy - Try network first, fallback to cache
async function networkFirstStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.status === 200) {
      // Cache successful responses
      const responseClone = networkResponse.clone();
      await cache.put(request, responseClone);
    }

    return networkResponse;
  } catch (error) {
    console.warn('Network First: Network failed, trying cache', error);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    throw error;
  }
}

// Stale While Revalidate Strategy - Return cached version while updating in background
async function staleWhileRevalidateStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  // Fetch from network in background
  const networkResponsePromise = fetch(request)
    .then(async networkResponse => {
      if (networkResponse.status === 200) {
        const responseClone = networkResponse.clone();
        await cache.put(request, responseClone);
      }
      return networkResponse;
    })
    .catch(error => {
      console.warn('Stale While Revalidate: Background update failed', error);
    });

  // Return cached version immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }

  // If no cached version, wait for network
  return await networkResponsePromise;
}

// Helper functions to identify resource types
function isStaticAsset(url) {
  return (
    /\.(js|css|woff2?|ttf|eot)$/.test(url.pathname) ||
    url.pathname.includes('/assets/') ||
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    url.pathname === '/favicon.ico' ||
    url.pathname === '/env-config.js'
  );
}

function isImageRequest(url) {
  return (
    /\.(png|jpg|jpeg|gif|svg|webp|ico)$/.test(url.pathname) || url.pathname.includes('/file-types/')
  );
}

function isAPIRequest(url) {
  return (
    url.pathname.startsWith('/api/') ||
    CACHEABLE_API_PATTERNS.some(pattern => pattern.test(url.pathname))
  );
}

function isHTMLRequest(request) {
  return request.headers.get('accept')?.includes('text/html');
}

// Create offline fallback response
function createOfflineResponse(request) {
  if (isImageRequest(new URL(request.url))) {
    // Return a simple SVG placeholder for images
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">
      <rect width="200" height="150" fill="#f0f0f0"/>
      <text x="100" y="75" text-anchor="middle" fill="#999" font-family="Arial, sans-serif" font-size="14">
        Offline
      </text>
    </svg>`;

    return new Response(svg, {
      headers: { 'Content-Type': 'image/svg+xml' },
    });
  }

  if (isAPIRequest(new URL(request.url))) {
    // Return empty array or error for API requests
    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'This feature requires an internet connection',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // For HTML requests, try to return cached index.html
  return caches.match('/') || new Response('Offline', { status: 503 });
}

// Handle background sync events (for future implementation)
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync', event.tag);

  if (event.tag === 'background-sync') {
    event.waitUntil(handleBackgroundSync());
  }
});

async function handleBackgroundSync() {
  // This is where you would handle queued actions when coming back online
  console.log('Service Worker: Handling background sync');

  // Example: Send queued task updates, sync offline changes, etc.
  // Implementation would depend on your app's specific needs
}

// Handle push notification events (for future implementation)
self.addEventListener('push', event => {
  if (!event.data) return;

  const options = {
    body: event.data.text(),
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
  };

  event.waitUntil(self.registration.showNotification('Worklenz', options));
});

// Handle notification click events
self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil(self.clients.openWindow('/'));
});

// Message handling for communication with main thread
self.addEventListener('message', event => {
  const { type, payload } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'GET_VERSION':
      event.ports[0].postMessage({ version: CACHE_VERSION });
      break;
      
    case 'CHECK_FOR_UPDATES':
      checkForUpdates().then((hasUpdates) => {
        event.ports[0].postMessage({ hasUpdates });
      });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;

    case 'LOGOUT':
      // Special handler for logout - clear all caches and unregister
      handleLogout().then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;

    default:
      console.log('Service Worker: Unknown message type', type);
  }
});

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  console.log('Service Worker: All caches cleared');
}

async function checkForUpdates() {
  try {
    // Check if there's a new service worker available
    const registration = await self.registration.update();
    const hasNewWorker = registration.installing || registration.waiting;
    
    if (hasNewWorker) {
      console.log('Service Worker: New version detected');
      return true;
    }
    
    // Also check if the main app files have been updated by trying to fetch index.html
    // and comparing it with the cached version
    try {
      const cache = await caches.open(CACHE_NAMES.STATIC);
      const cachedResponse = await cache.match('/');
      const networkResponse = await fetch('/', { cache: 'no-cache' });
      
      if (cachedResponse && networkResponse.ok) {
        const cachedContent = await cachedResponse.text();
        const networkContent = await networkResponse.text();
        
        if (cachedContent !== networkContent) {
          console.log('Service Worker: App content has changed');
          return true;
        }
      }
    } catch (error) {
      console.log('Service Worker: Could not check for content updates', error);
    }
    
    return false;
  } catch (error) {
    console.error('Service Worker: Error checking for updates', error);
    return false;
  }
}

async function handleLogout() {
  try {
    // Clear all caches
    await clearAllCaches();

    // Unregister the service worker to force fresh registration on next visit
    await self.registration.unregister();

    console.log('Service Worker: Logout handled - caches cleared and unregistered');
  } catch (error) {
    console.error('Service Worker: Error during logout handling', error);
    throw error;
  }
}

console.log('Service Worker: Loaded successfully');
