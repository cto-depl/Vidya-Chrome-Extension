// Cache versioning
const STATIC_CACHE = 'classess-static-v1';
const PAGE_CACHE   = 'classess-pages-v1';
const API_CACHE    = 'classess-api-v1';

// List of static assets to pre-cache
const PRECACHE_URLS = ['/'
  // '/',                      // Root page
  // '/index.jsp',             // Change to your actual entry JSP
  // '/offline.html',          // Offline fallback page
  // '/static/css/style.css',  // Example CSS
  // '/static/js/app.js',      // Example JS
  // '/static/images/logo.png' // Example image
];

// ✅ Utility: Detect navigation request (HTML/JSP pages)
function isNavigateRequest(event) {
  return event.request.mode === 'navigate' ||
         (event.request.method === 'GET' &&
          event.request.headers.get('accept')?.includes('text/html'));
}

// ✅ Utility: Detect API request (hybrid approach: headers + URL + no extension)
function isApiRequest(request) {
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return false;

  // Rule 1: If headers say JSON → API
  if (request.headers.get('accept')?.includes('application/json')) return true;

  // Rule 2: If URL contains known API-like patterns
  if (url.pathname.includes('/api') ||
      url.pathname.includes('/examerspring') ||
      url.pathname.includes('/platform')) return true;

  // Rule 3: If no file extension → likely API/dynamic content
  if (!url.pathname.match(/\.[a-zA-Z0-9]+$/)) return true;

  return false;
}

// ✅ Install: Pre-cache essential static assets
self.addEventListener('install', event => {
  console.log('[SW] install');

  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ✅ Activate: Clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] activate');

  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (![STATIC_CACHE, PAGE_CACHE, API_CACHE].includes(key)) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ✅ Fetch: Handle requests
self.addEventListener('fetch', event => {
  console.log('[SW] fetch', event.request.method, event.request.url, 'mode=', event.request.mode);

  const request = event.request;

  // --- Handle navigation (JSP/HTML pages) ---
  if (isNavigateRequest(event)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(PAGE_CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then(cached =>
            cached || caches.match('/offline.html')
          );
        })
    );
    return;
  }

  // --- Handle API requests ---
  if (isApiRequest(request)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(API_CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then(cached =>
            cached ||
            new Response(
              JSON.stringify({ offline: true, data: [] }),
              { headers: { 'Content-Type': 'application/json' } }
            )
          );
        })
    );
    return;
  }

  // --- Handle static assets (cache-first) ---
  event.respondWith(
    caches.match(request).then(cached => {
      return (
        cached ||
        fetch(request).then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        })
      );
    })
  );
});
