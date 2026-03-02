const CACHE_NAME = 'pilsapp-v' + Date.now(); // Persistence Fix v2.8
let swMedications = [];
let swLastCheckedMinute = '';

// IndexedDB Persistence Logic
const DB_NAME = 'pilsapp_sw_db';
const STORE_NAME = 'meds_store';

const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
};

const saveMedsToDB = async (meds) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(meds, 'current_meds');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

const loadMedsFromDB = async () => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get('current_meds');
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
};
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
        Promise.all([
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            loadMedsFromDB().then(meds => {
                swMedications = meds;
                console.log('SW Activated: Meds loaded from DB', swMedications.length);
            })
        ])
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
    // Force reload from DB if memory is empty
    if (swMedications.length === 0) {
        swMedications = await loadMedsFromDB();
    }
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
            body: `Es hora de: ${med.name} (${med.dose}) ${med.desc ? ' • ' + med.desc : ''}`,
            icon: './icon-512.png',
            badge: './icon-512.png',
            data: { medId: med.id },
            tag: `med-${med.id}-${currentMinute}`,
            renotify: true,
            vibrate: [200, 100, 200],
            actions: [
                { action: 'open', title: 'Abrir App' }
            ]
        });
    });
};

// Start the SW internal clock
setInterval(checkSWNotifications, 30000);

// Listener to handle messages from the app
self.addEventListener('message', async (event) => {
    if (event.data && event.data.type === 'SYNC_MEDS') {
        swMedications = event.data.medications || [];
        await saveMedsToDB(swMedications);
        console.log('SW: Medications synced and saved to DB', swMedications.length);
        checkSWNotifications(); // Immediate check
    }

    if (event.data && event.data.type === 'GET_STATUS') {
        const client = await self.clients.get(event.source.id);
        if (client) {
            client.postMessage({
                type: 'STATUS_UPDATE',
                medsCount: swMedications.length,
                lastCheck: swLastCheckedMinute,
                status: 'Activo (Persistente)'
            });
        }
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
