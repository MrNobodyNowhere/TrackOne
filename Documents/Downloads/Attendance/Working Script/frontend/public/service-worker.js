// This is a minimal service worker that does nothing
// It's here to prevent 404 errors in the console

const CACHE_NAME = 'attendance-trackone-v1';

// Install event - cache basic assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Only cache files that are likely to exist
      return cache.addAll([
        '/index.html',
        '/manifest.json'
      ])
      .catch(error => {
        console.error('Cache addAll error:', error);
        // Continue with installation even if caching fails
        return Promise.resolve();
      });
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - serve from cache if available, otherwise fetch from network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});