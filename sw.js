const CACHE_NAME = 'yt-tax-v1018';
const ASSETS = [
    '/coda-tax/',
    '/coda-tax/index.html',
    '/coda-tax/SeomuFix.js',
    '/coda-tax/SeomuFix.css',
    '/coda-tax/manifest.json',
    '/coda-tax/icon-192.png',
    '/coda-tax/icon-512.png'
];

self.addEventListener('install', (event) => {
    // Force wait until old SW is gone
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});
