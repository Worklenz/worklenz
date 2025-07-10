# Service Worker Implementation

This directory contains the service worker implementation for Worklenz, providing offline functionality, caching, and performance improvements.

## Files Overview

- **`sw.js`** (in `/public/`) - The main service worker file
- **`serviceWorkerRegistration.ts`** - Registration and management utilities
- **`ServiceWorkerStatus.tsx`** (in `/components/`) - React component for SW status

## Features

### 🔄 Caching Strategies

1. **Cache First** - Static assets (JS, CSS, images)
   - Serves from cache first, falls back to network
   - Perfect for unchanging resources

2. **Network First** - API requests
   - Tries network first, falls back to cache
   - Ensures fresh data when online

3. **Stale While Revalidate** - HTML pages
   - Serves cached version immediately
   - Updates cache in background

### 📱 PWA Features

- **Offline Support** - App works without internet
- **Installable** - Can be installed on devices
- **Background Sync** - Sync data when online (framework ready)
- **Push Notifications** - Real-time notifications (framework ready)

## Usage

### Basic Integration

The service worker is automatically registered in `App.tsx`:

```tsx
import { registerSW } from './utils/serviceWorkerRegistration';

useEffect(() => {
  registerSW({
    onSuccess: (registration) => {
      console.log('SW registered successfully');
    },
    onUpdate: (registration) => {
      // Show update notification to user
    },
    onOfflineReady: () => {
      console.log('App ready for offline use');
    }
  });
}, []);
```

### Using the Hook

```tsx
import { useServiceWorker } from '../utils/serviceWorkerRegistration';

const MyComponent = () => {
  const { isOffline, swManager, clearCache, forceUpdate } = useServiceWorker();
  
  return (
    <div>
      <p>Status: {isOffline ? 'Offline' : 'Online'}</p>
      <button onClick={clearCache}>Clear Cache</button>
      <button onClick={forceUpdate}>Update App</button>
    </div>
  );
};
```

### Status Component

```tsx
import ServiceWorkerStatus from '../components/service-worker-status/ServiceWorkerStatus';

// Minimal offline indicator
<ServiceWorkerStatus minimal />

// Full status with controls
<ServiceWorkerStatus showControls />
```

## Configuration

### Cacheable Resources

Edit the patterns in `sw.js`:

```javascript
// API endpoints that can be cached
const CACHEABLE_API_PATTERNS = [
  /\/api\/project-categories/,
  /\/api\/task-statuses/,
  // Add more patterns...
];

// Resources that should never be cached
const NEVER_CACHE_PATTERNS = [
  /\/api\/auth\/login/,
  /\/socket\.io/,
  // Add more patterns...
];
```

### Cache Names

Update version to force cache refresh:

```javascript
const CACHE_VERSION = 'v1.0.1'; // Increment when deploying
```

## Development

### Testing Offline

1. Open DevTools → Application → Service Workers
2. Check "Offline" to simulate offline mode
3. Verify app still functions

### Debugging

```javascript
// Check service worker status
navigator.serviceWorker.ready.then(registration => {
  console.log('SW ready:', registration);
});

// Check cache contents
caches.keys().then(names => {
  console.log('Cache names:', names);
});
```

### Cache Management

```javascript
// Clear all caches
caches.keys().then(names => 
  Promise.all(names.map(name => caches.delete(name)))
);

// Clear specific cache
caches.delete('worklenz-api-v1.0.0');
```

## Best Practices

### 1. Cache Strategy Selection

- **Static Assets**: Cache First (fast loading)
- **API Data**: Network First (fresh data)
- **User Content**: Network Only (always fresh)
- **App Shell**: Cache First (instant loading)

### 2. Cache Invalidation

- Increment `CACHE_VERSION` when deploying
- Use versioned URLs for assets
- Set appropriate cache headers

### 3. Offline UX

- Show offline indicators
- Queue actions for later sync
- Provide meaningful offline messages
- Cache critical user data

### 4. Performance

- Cache only necessary resources
- Set cache size limits
- Clean up old caches regularly
- Monitor cache usage

## Monitoring

### Storage Usage

```javascript
// Check storage quota
navigator.storage.estimate().then(estimate => {
  console.log('Used:', estimate.usage);
  console.log('Quota:', estimate.quota);
});
```

### Cache Hit Rate

Monitor in DevTools → Network:
- Look for "from ServiceWorker" requests
- Check cache effectiveness

## Troubleshooting

### Common Issues

1. **SW not updating**
   - Hard refresh (Ctrl+Shift+R)
   - Clear browser cache
   - Check CACHE_VERSION

2. **Resources not caching**
   - Verify URL patterns
   - Check NEVER_CACHE_PATTERNS
   - Ensure HTTPS in production

3. **Offline features not working**
   - Verify SW registration
   - Check browser support
   - Test cache strategies

### Reset Service Worker

```javascript
// Unregister and reload
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(registration => registration.unregister());
  window.location.reload();
});
```

## Browser Support

- ✅ Chrome 45+
- ✅ Firefox 44+
- ✅ Safari 11.1+
- ✅ Edge 17+
- ❌ Internet Explorer

## Future Enhancements

1. **Background Sync**
   - Queue offline actions
   - Sync when online

2. **Push Notifications**
   - Task assignments
   - Project updates
   - Deadline reminders

3. **Advanced Caching**
   - Intelligent prefetching
   - ML-based cache eviction
   - Compression

4. **Offline Analytics**
   - Track offline usage
   - Cache hit rates
   - Performance metrics

---

*Last updated: January 2025* 