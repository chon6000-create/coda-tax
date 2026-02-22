const CACHE_NAME = 'yt-tax-v1';
const ASSETS = [
    './',
    './index.html',
    './CODA_Refund_App.js',
    './CODA_Refund_Style.css',
    './manifest.json'
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
