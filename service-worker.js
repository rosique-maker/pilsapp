const CACHE_NAME = 'pilsapp-v' + Date.now(); // Robust Heartbeat v2.9
let swMedications = [];
let swLastCheckedMinute = '';
let swNotificationLog = {}; // { medId_date_time: true }

// IndexedDB Persistence Logic
const DB_NAME = 'pilsapp_sw_db';
const STORE_NAME = 'meds_store';
const LOG_STORE = 'notif_log';

const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 2); // Upgrade to v2 for log
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
            if (!db.objectStoreNames.contains(LOG_STORE)) {
                db.createObjectStore(LOG_STORE);
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
};

const saveLogToDB = async (log) => {
    const db = await openDB();
    const tx = db.transaction(LOG_STORE, 'readwrite');
    tx.objectStore(LOG_STORE).put(log, 'history_log');
};

const loadLogFromDB = async () => {
    const db = await openDB();
    const tx = db.transaction(LOG_STORE, 'readonly');
    const request = tx.objectStore(LOG_STORE).get('history_log');
    return new Promise(r => {
        request.onsuccess = () => r(request.result || {});
        request.onerror = () => r({});
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
            }),
            loadLogFromDB().then(log => {
                swNotificationLog = log;
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
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentMinuteStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
    const todayKey = now.toDateString();

    // Heartbeat: used for diagnostics in the UI
    const pulseTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Force reload from DB if memory is empty
    if (swMedications.length === 0) {
        swMedications = await loadMedsFromDB();
    }
    if (!swNotificationLog || Object.keys(swNotificationLog).length === 0) {
        swNotificationLog = await loadLogFromDB();
    }

    if (swMedications.length === 0) return;

    // Check if any client is focused
    const clientList = await self.clients.matchAll({ type: 'window' });
    const isAppFocused = clientList.some(c => c.focused);

    // Notify app of pulse (Heartbeat)
    clientList.forEach(client => {
        client.postMessage({
            type: 'HEARTBEAT',
            pulse: pulseTime,
            medsCount: swMedications.length
        });
    });

    if (isAppFocused) return;

    if (swLastCheckedMinute === currentMinuteStr) return;
    swLastCheckedMinute = currentMinuteStr;

    const daysMap = { 0: 'D', 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S' };
    const today = daysMap[now.getDay()];
    const dateNum = now.getDate();

    const dueMeds = swMedications.filter(med => {
        if (med.status !== 'pending') return false;

        // Tolerance Window Logic: Match if current time is within 5 minutes of scheduled time
        const [scheduledH, scheduledM] = med.time.split(':').map(Number);
        const scheduledTotalMins = (scheduledH * 60) + scheduledM;
        const currentTotalMins = (currentHour * 60) + currentMin;

        const diff = currentTotalMins - scheduledTotalMins;

        // If we are within 0 to 5 minutes after the scheduled time
        const isTimeMatch = diff >= 0 && diff < 5;
        if (!isTimeMatch) return false;

        if (med.freq === 'daily') return true;
        if (med.freq === 'weekly') return (med.days || []).includes(today);
        if (med.freq === 'monthly') {
            const daysOfMonth = Array.isArray(med.daysOfMonth) ? med.daysOfMonth : [med.dayOfMonth];
            return daysOfMonth.includes(dateNum);
        }
        return false;
    });

    let sentAny = false;
    dueMeds.forEach(med => {
        // Anti-double-notification log
        const logKey = `${med.id}_${todayKey}_${med.time}`;
        if (swNotificationLog[logKey]) return; // Already notified today at this time

        sentAny = true;
        swNotificationLog[logKey] = true;

        self.registration.showNotification('¡Pilsapp: Hora de tu toma!', {
            body: `Toma de las ${med.time}: ${med.name} (${med.dose}) ${med.desc ? ' • ' + med.desc : ''}`,
            icon: './icon-512.png',
            badge: './icon-512.png',
            data: { medId: med.id },
            tag: `med-${med.id}`, // Constant tag per med so they overwrite if multiple fire
            renotify: true,
            vibrate: [200, 100, 200],
            requireInteraction: true,
            actions: [
                { action: 'open', title: 'Ver Detalles' }
            ]
        });
    });

    if (sentAny) {
        saveLogToDB(swNotificationLog);
    }
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
