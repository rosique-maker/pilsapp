const CACHE_NAME = 'pilsapp-v' + Date.now(); // Background Debug v2.6
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    'https://unpkg.com/lucide@latest',
    './icon-512.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

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

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) {
                        client = clientList[i];
                        break;
                    }
                }
                return client.focus();
            }
            return clients.openWindow('./');
        })
    );
});

// Listener to handle messages from the app
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'SCHEDULE_TEST_NOTIFICATION') {
        setTimeout(() => {
            self.registration.showNotification('🧪 Pilsapp: Prueba de Aviso', {
                body: 'Si ves esto, las notificaciones funcionan en segundo plano. ¡Pulsa para abrir!',
                icon: './icon-512.png',
                badge: './icon-512.png',
                tag: 'test-reminder',
                renotify: true,
                vibrate: [200, 100, 200]
            });
        }, event.data.delay || 5000);
    }
});
