const CACHE_NAME = 'pilsapp-v' + Date.now(); // Background Alarms v2.7
let swMedications = [];
let swLastCheckedMinute = '';
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

    // Log click for debugging (optional)
    console.log('Notification clicked:', event.notification.tag);

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

const checkSWNotifications = async () => {
    if (swMedications.length === 0) return;

    const now = new Date();
    const currentMinute = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (swLastCheckedMinute === currentMinute) return;

    // Check if any client is focused
    const clientList = await self.clients.matchAll({ type: 'window' });
    const isAppFocused = clientList.some(c => c.focused);
    if (isAppFocused) return;

    swLastCheckedMinute = currentMinute;

    const daysMap = { 0: 'D', 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S' };
    const today = daysMap[now.getDay()];
    const dateNum = now.getDate();

    const dueMeds = swMedications.filter(m => {
        if (m.status !== 'pending') return false;
        if (m.time !== currentMinute) return false;

        if (m.freq === 'daily') return true;
        if (m.freq === 'weekly') return (m.days || []).includes(today);
        if (m.freq === 'monthly') {
            const daysOfMonth = Array.isArray(m.daysOfMonth) ? m.daysOfMonth : [m.dayOfMonth];
            return daysOfMonth.includes(dateNum);
        }
        return false;
    });

    dueMeds.forEach(med => {
        self.registration.showNotification('¡Pilsapp: Hora de tu toma!', {
            body: `Es hora de: ${med.name} (${med.dose})`,
            icon: './icon-512.png',
            badge: './icon-512.png',
            data: { medId: med.id },
            tag: `med-${med.id}-${currentMinute}`,
            renotify: true,
            vibrate: [200, 100, 200]
        });
    });
};

// Start the SW internal clock
setInterval(checkSWNotifications, 30000);

// Listener to handle messages from the app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SYNC_MEDS') {
        swMedications = event.data.medications || [];
        console.log('SW: Medications synced', swMedications.length);
    }

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
