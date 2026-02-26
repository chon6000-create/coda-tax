const CACHE_NAME = 'yt-tax-v5';
const ASSETS = [
    '/coda-tax/',
    '/coda-tax/index.html',
    '/coda-tax/CODA_Refund_App.js',
    '/coda-tax/CODA_Refund_Style.css',
    '/coda-tax/manifest.json',
    '/coda-tax/icon-192.png',
    '/coda-tax/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
