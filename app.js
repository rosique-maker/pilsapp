document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();

    // Persistence Helpers
    const saveData = () => {
        localStorage.setItem('pilsapp_meds', JSON.stringify(medications));
        localStorage.setItem('pilsapp_history', JSON.stringify(history));
        localStorage.setItem('pilsapp_vitals', JSON.stringify(vitals));
        localStorage.setItem('pilsapp_settings', JSON.stringify(userSettings));
        syncMedsToServiceWorker();
    };

    const syncMedsToServiceWorker = () => {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'SYNC_MEDS',
                medications: medications
            });
        }
    };

    const loadData = () => {
        const savedMeds = localStorage.getItem('pilsapp_meds');
        const savedHistory = localStorage.getItem('pilsapp_history');
        const savedVitals = localStorage.getItem('pilsapp_vitals');
        const savedSettings = localStorage.getItem('pilsapp_settings');

        if (savedMeds) medications = JSON.parse(savedMeds);
        if (savedHistory) history = JSON.parse(savedHistory);
        if (savedVitals) vitals = JSON.parse(savedVitals);
        if (savedSettings) userSettings = JSON.parse(savedSettings);

        // Data Migration / Cleaning (Fixing "undefined" strings from old versions)
        medications = medications.map(m => ({
            ...m,
            dose: m.dose ? String(m.dose).replace(/undefined/g, '').trim() : '',
            desc: m.desc ? String(m.desc).replace(/undefined/g, '').trim() : ''
        }));

        // Apply Dark Mode if needed
        if (userSettings.isDarkMode) document.body.classList.add('dark-mode');

        // Update header profile pic
        updateHeaderProfile();

        const lastLogin = localStorage.getItem('pilsapp_last_login');
        const todayStr = new Date().toDateString();
        if (lastLogin !== todayStr) {
            medications.forEach(m => m.status = 'pending');
            localStorage.setItem('pilsapp_last_login', todayStr);
            saveData();
        } else {
            syncMedsToServiceWorker(); // Sync even if no status reset
        }

        // Navigation Guard: Redirect to register if not completed
        if (!userSettings.isRegistered) {
            setTimeout(() => navigateTo('register'), 100);
        }
    };

    // State Management
    let medications = [];
    let history = [];
    let vitals = [];
    let userSettings = {
        name: 'Usuario',
        email: 'usuario@pilsapp.com',
        profilePic: '',
        notifPic: '',
        isDarkMode: false,
        timeFormat24h: true,
        isRegistered: false,
        cloudSyncUrl: 'https://script.google.com/macros/s/AKfycby4yZa-BdhiVDwqJssle3SZNvXD9fgZBHas5cmyYXSfmYG1EXAefMFU2OQQP6c5UeoD/exec' // Production Sync URL
    };

    let currentCalendarDate = new Date();
    loadData();

    let editingMedId = null;
    let tempTimes = []; // Temporary times for the add/edit form
    let lastCheckedMinute = '';

    const recordHistory = (med, status) => {
        const entry = {
            id: Date.now(),
            name: med.name,
            status: status,
            time: med.time,
            date: new Date().toDateString(),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        history = history.filter(h => !(h.name === med.name && h.time === med.time && h.date === entry.date));
        if (status !== 'pending') history.push(entry);
        saveData();
    };

    const requestNotificationPermission = async () => {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'default') {
            await Notification.requestPermission();
        }
    };

    const checkNotifications = () => {
        const now = new Date();
        const currentMinute = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        if (lastCheckedMinute === currentMinute) return;
        lastCheckedMinute = currentMinute;

        const dueMeds = medications.filter(m => {
            if (m.status !== 'pending') return false;
            if (m.time !== currentMinute) return false;

            if (m.freq === 'daily') return true;
            if (m.freq === 'weekly') {
                const daysMap = { 0: 'D', 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S' };
                const today = daysMap[now.getDay()];
                return (m.days || []).includes(today);
            }
            if (m.freq === 'monthly') {
                const daysOfMonth = Array.isArray(m.daysOfMonth) ? m.daysOfMonth : [m.dayOfMonth];
                return daysOfMonth.includes(now.getDate());
            }
            return false;
        });

        if (dueMeds.length > 0) {
            const med = dueMeds[0];
            if (document.visibilityState === 'visible') {
                showNotification(med);
            }
        }
    };

    // Call permission request early
    requestNotificationPermission();

    // Check notifications immediately when app returns to foreground
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            checkNotifications();
            syncMedsToServiceWorker(); // Use opportunity to re-sync
        }
    });

    // Ensure sync when SW is ready
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(() => {
            syncMedsToServiceWorker();
        });
    }

    const syncUserToCloud = async (userData) => {
        if (!userSettings.cloudSyncUrl) return;
        console.log('☁️ Sincronizando registro con Google Sheets...', userData);
        try {
            // Using a simple request (text/plain) to avoid CORS preflight (OPTIONS)
            // which Apps Script doesn't handle natively via fetch.
            // mode: 'no-cors' sends the request without following redirects, which still executes.
            const url = userSettings.cloudSyncUrl.trim();
            if (!url) return;

            fetch(url, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(userData)
            });
            console.log('✅ Sync enviado (modo silencioso).');
        } catch (e) {
            console.error('❌ Error enviando a la nube:', e);
        }
    };

    const showNotification = (med, isPreview = false) => {
        if (document.querySelector('.notification-overlay')) return;

        const overlay = document.createElement('div');
        overlay.className = 'notif24-overlay fade-in';
        overlay.innerHTML = `
            <div class="notif24-header">
                <i data-lucide="pill"></i>
                <h2>¡Hora de tu medicina!</h2>
                <div class="notif24-med-name">${med.name}</div>
                <p style="margin-top: 10px; opacity: 0.7;">${med.dose} • ${med.desc}</p>
            </div>

            <div class="notif24-footer">
                <button class="notif24-btn confirm" id="notif-confirm">Confirmar Toma</button>
                <button class="notif24-btn postpone" id="notif-postpone">Posponer 30 min</button>
                <button class="notif24-btn skip" id="notif-skip">Omitir</button>
            </div>
        `;
        document.body.appendChild(overlay);
        lucide.createIcons();

        document.getElementById('notif-confirm').onclick = () => {
            if (!isPreview) {
                med.status = 'taken';
                recordHistory(med, 'taken');
                navigateTo('home');
            }
            overlay.remove();
        };

        document.getElementById('notif-postpone').onclick = () => {
            if (!isPreview) {
                overlay.remove();
                alert('Recordatorio pospuesto 30 minutos.');
                // Simulate postponement for now (full logic would require a background task)
            } else {
                overlay.remove();
            }
        };

        document.getElementById('notif-skip').onclick = () => {
            if (!isPreview) {
                med.status = 'skipped';
                recordHistory(med, 'skipped');
                navigateTo('home');
            }
            overlay.remove();
        };
    };

    setInterval(checkNotifications, 10000);

    const getHoyContent = () => {
        const now = new Date();
        const daysMap = { 0: 'D', 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S' };
        const today = daysMap[now.getDay()];

        const todayMeds = medications.filter(m => {
            if (m.freq === 'daily') return true;
            if (m.freq === 'weekly') return (m.days || []).includes(today);
            if (m.freq === 'monthly') {
                const daysOfMonth = Array.isArray(m.daysOfMonth) ? m.daysOfMonth : [m.dayOfMonth];
                return daysOfMonth.includes(now.getDate());
            }
            return false;
        }).sort((a, b) => a.time.localeCompare(b.time));

        const progress = todayMeds.length > 0 ? Math.round((todayMeds.filter(m => m.status === 'taken').length / todayMeds.length) * 100) : 0;

        return `
            <div class="daily-progress fade-in">
                <div class="progress-header">
                    <span>Hola, <strong>${userSettings.name.split(' ')[0]}</strong> 👋</span>
                    <span>${progress}% hoy</span>
                </div>
                <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${progress}%"></div></div>
            </div>
            <div class="summary-section fade-in">
                <h3 style="margin-bottom: 15px; font-size: 18px;">Horario de Hoy</h3>
                ${todayMeds.length === 0 ? `<div style="text-align: center; color: var(--text-muted); padding: 40px;">No hay medicinas programadas.</div>` : todayMeds.map(m => {
            let icon = 'pill';
            if (m.type === 'capsule') icon = 'tablet';
            if (m.type === 'liquid') icon = 'beaker';
            return `
                        <div class="med-card" onclick="toggleStatus(${m.id})">
                            <div class="med-time"><span class="time">${m.time}</span><span class="period">${m.period}</span></div>
                            <div class="med-info">
                                <h4><i data-lucide="${icon}" style="width: 14px; height: 14px; margin-right: 4px; vertical-align: middle; opacity: 0.7;"></i> ${m.name}</h4>
                                <p>${m.dose} • ${m.desc}</p>
                            </div>
                            <div class="status-icon ${m.status}"><i data-lucide="${m.status === 'taken' ? 'check' : 'clock'}"></i></div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    };

    window.toggleStatus = (id) => {
        const med = medications.find(m => m.id === id);
        if (med) {
            med.status = med.status === 'taken' ? 'pending' : 'taken';
            recordHistory(med, med.status);
            navigateTo('home');
        }
    };

    const getStatsContent = () => {
        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth();
        const monthName = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(currentCalendarDate);
        const firstDayOfMonth = new Date(year, month, 1);
        let firstDayIndex = firstDayOfMonth.getDay() - 1;
        if (firstDayIndex === -1) firstDayIndex = 6;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        const calendarDays = [];

        for (let i = 0; i < firstDayIndex; i++) calendarDays.push('<div class="calendar-day empty"></div>');

        for (let d = 1; d <= daysInMonth; d++) {
            const loopDate = new Date(year, month, d);
            const dateStr = loopDate.toDateString();
            const isFuture = loopDate > today && dateStr !== today.toDateString();
            const isToday = dateStr === today.toDateString();
            let statusClass = '';

            if (isFuture) statusClass = 'future';
            else {
                const dayHistory = history.filter(h => h.date === dateStr);
                const dayMeds = medications.filter(m => {
                    // Check if medication existed on this loopDate
                    const startDate = m.startDate ? new Date(m.startDate) : null;
                    if (startDate && loopDate < startDate && loopDate.toDateString() !== startDate.toDateString()) {
                        return false;
                    }

                    if (m.freq === 'daily') return true;
                    if (m.freq === 'weekly') {
                        const daysMap = { 0: 'D', 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S' };
                        return (m.days || []).includes(daysMap[loopDate.getDay()]);
                    }
                    if (m.freq === 'monthly') {
                        const daysOfMonth = Array.isArray(m.daysOfMonth) ? m.daysOfMonth : [m.dayOfMonth];
                        return daysOfMonth.includes(loopDate.getDate());
                    }
                    return false;
                });
                const dayMedsCount = dayMeds.length;

                if (dayMedsCount > 0) {
                    let takenCount = 0;
                    dayMeds.forEach(m => {
                        const hEntry = dayHistory.find(h => h.name === m.name && h.time === m.time);
                        if (hEntry && hEntry.status === 'taken') takenCount++;
                    });

                    const adherence = (takenCount / dayMedsCount) * 100;
                    if (adherence >= 100) statusClass = 'full';
                    else if (adherence > 50) statusClass = 'partial';
                    else statusClass = 'none';
                }
            }

            calendarDays.push(`<div class="calendar-day" onclick="showDayDetails('${dateStr}')"><div class="day-circle ${statusClass} ${isToday ? 'today' : ''}">${d}</div></div>`);
        }

        return `
            <div class="stats-page fade-in">
                <div class="stats-container">
                    <div class="stat-card">
                        <div class="calendar-header">
                            <button class="month-nav-btn" onclick="changeMonth(-1)"><i data-lucide="chevron-left"></i></button>
                            <h4 style="text-transform: capitalize;">${monthName}</h4>
                            <button class="month-nav-btn" onclick="changeMonth(1)"><i data-lucide="chevron-right"></i></button>
                        </div>
                        <div class="calendar-grid">
                            <div class="calendar-weekday">L</div><div class="calendar-weekday">M</div><div class="calendar-weekday">X</div><div class="calendar-weekday">J</div><div class="calendar-weekday">V</div><div class="calendar-weekday">S</div><div class="calendar-weekday">D</div>
                            ${calendarDays.join('')}
                        </div>
                    </div>
                    <div id="day-details-container"><div style="text-align: center; color: var(--text-muted); padding: 20px;">Seleccione un día para ver detalles</div></div>
                </div>
            </div>
        `;
    };


    window.changeMonth = (delta) => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
        navigateTo('stats');
    };

    window.showDayDetails = (dateStr) => {
        const date = new Date(dateStr);
        const dayHistory = history.filter(h => h.date === dateStr);
        const dayVitals = vitals.filter(v => v.date === dateStr);
        const dayLabel = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);

        const dayMeds = medications.filter(m => {
            // Check if medication existed on this date
            const startDate = m.startDate ? new Date(m.startDate) : null;
            if (startDate && date < startDate && date.toDateString() !== startDate.toDateString()) {
                return false;
            }

            if (m.freq === 'daily') return true;
            if (m.freq === 'weekly') {
                const daysMap = { 0: 'D', 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S' };
                const today = daysMap[date.getDay()];
                return (m.days || []).includes(today);
            }
            if (m.freq === 'monthly') {
                const daysOfMonth = Array.isArray(m.daysOfMonth) ? m.daysOfMonth : [m.dayOfMonth];
                return daysOfMonth.includes(date.getDate());
            }
            return false;
        }).sort((a, b) => a.time.localeCompare(b.time)); // Added sorting here

        const detailsHtml = `
            <div class="stat-card fade-in" style="border-top: 4px solid var(--primary);">
                <h5 style="margin-bottom: 12px; text-transform: capitalize;">${dayLabel}</h5>
                ${dayVitals.length > 0 ? `
                    <div class="vitals-summary-card" style="flex-direction: column; gap: 8px;">
                        ${dayVitals.map(v => `
                            <div class="vitals-detail-row">
                                ${v.systolic ? `<div class="vitals-summary-item" style="color: var(--primary);"><i data-lucide="activity"></i> ${v.systolic}/${v.diastolic}</div>` : ''}
                                ${v.heartRate ? `<div class="vitals-summary-item" style="color: #F43F5E;"><i data-lucide="heart"></i> ${v.heartRate}</div>` : ''}
                                ${v.spo2 ? `<div class="vitals-summary-item" style="color: #06B6D4;"><i data-lucide="wind"></i> ${v.spo2}%</div>` : ''}
                                ${v.glucose ? `<div class="vitals-summary-item" style="color: #F59E0B;"><i data-lucide="droplet"></i> ${v.glucose} mg/dL</div>` : ''}
                                ${v.weight ? `<div class="vitals-summary-item" style="color: #10B981;"><i data-lucide="scale"></i> ${v.weight} kg</div>` : ''}
                                ${v.temp ? `<div class="vitals-summary-item" style="color: #8B5CF6;"><i data-lucide="thermometer"></i> ${v.temp} °C</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                <div class="timeline" style="margin-top: 15px;">
                    ${dayMeds.map(m => {
            const hEntry = dayHistory.find(h => h.name === m.name && h.time === m.time);
            const status = hEntry ? hEntry.status : 'pending';
            return `
                <div class="timeline-item">
                    <div class="timeline-marker ${status}"></div>
                    <div class="timeline-content" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <div>
                            <h5 style="margin:0;">${m.name}</h5>
                            <p style="margin:0; font-size: 11px; opacity: 0.8;">${status === 'taken' ? 'Confirmado' : (status === 'skipped' ? 'Omitido' : 'Pendiente')}</p>
                        </div>
                        <span style="font-size: 11px; font-weight: 700; background: var(--primary-light); color: var(--primary); padding: 2px 8px; border-radius: 8px;">${m.time}</span>
                    </div>
                </div>`;
        }).join('')}
                </div>
            </div>
        `;
        document.getElementById('day-details-container').innerHTML = detailsHtml;
        lucide.createIcons();
    };

    const getVitalsContent = () => {
        const hasVitals = vitals.length > 0;
        return `
            <div class="vitals-page fade-in">
                <h3 style="margin-bottom: 4px;">Signos Vitales</h3>
                <p style="color: var(--text-muted); margin-bottom: 24px;">Registra tus medidas hoy.</p>
                <div id="vitals-entry-container" class="hidden" style="margin-bottom: 24px;">
                    <div class="vitals-container">
                        <div class="vital-entry-card" style="border-left: 4px solid var(--primary);">
                            <h5 style="color: var(--primary); display: flex; align-items: center; gap: 8px;"><i data-lucide="activity"></i> Presión y Pulso</h5>
                            <div class="vital-input-group"><label>Sistólica</label><input type="number" id="vital-sys" class="form-input" placeholder="120"></div>
                            <div class="vital-input-group"><label>Diastólica</label><input type="number" id="vital-dia" class="form-input" placeholder="80"></div>
                            <div class="vital-input-group"><label>Pulso</label><input type="number" id="vital-bpm" class="form-input" placeholder="72"></div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px;">
                            <div class="vital-entry-card" style="border-left: 4px solid #06B6D4;">
                                <h5 style="color: #06B6D4; display: flex; align-items: center; gap: 8px; font-size: 11px;"><i data-lucide="wind" style="width: 14px;"></i> Oxígeno</h5>
                                <input type="number" id="vital-spo2" class="form-input" placeholder="98%" style="padding: 8px;">
                            </div>
                            <div class="vital-entry-card" style="border-left: 4px solid #F59E0B;">
                                <h5 style="color: #F59E0B; display: flex; align-items: center; gap: 8px; font-size: 11px;"><i data-lucide="droplet" style="width: 14px;"></i> Glucosa</h5>
                                <input type="number" id="vital-glucose" class="form-input" placeholder="mg/dL" style="padding: 8px;">
                            </div>
                            <div class="vital-entry-card" style="border-left: 4px solid #10B981;">
                                <h5 style="color: #10B981; display: flex; align-items: center; gap: 8px; font-size: 11px;"><i data-lucide="scale" style="width: 14px;"></i> Peso</h5>
                                <input type="number" id="vital-weight" class="form-input" placeholder="kg" style="padding: 8px;">
                            </div>
                            <div class="vital-entry-card" style="border-left: 4px solid #8B5CF6;">
                                <h5 style="color: #8B5CF6; display: flex; align-items: center; gap: 8px; font-size: 11px;"><i data-lucide="thermometer" style="width: 14px;"></i> Temp</h5>
                                <input type="number" id="vital-temp" class="form-input" placeholder="°C" style="padding: 8px;">
                            </div>
                        </div>
                        <div style="display: flex; gap: 12px; margin-top: 10px;"><button id="save-vitals" class="btn-primary" style="flex: 2;">Guardar</button><button id="cancel-vitals" class="btn-danger-outline" style="flex: 1;">Cancelar</button></div>
                    </div>
                </div>
                <div id="vitals-btn-container" style="text-align: center; margin-bottom: 30px;"><button id="show-vitals-form" class="btn-primary" style="width: auto; padding: 12px 24px;"><i data-lucide="plus-circle" style="margin-right: 8px;"></i> Añadir Medición</button></div>
                ${hasVitals ? `
                    <div style="margin-top: 20px;">
                        <h4 style="margin-bottom: 15px;">Historial</h4>
                        ${vitals.slice(-5).reverse().map(v => `
                            <div class="stat-card" style="margin-bottom: 10px; border-left: 4px solid var(--primary); display: flex; flex-direction: column; gap: 4px;">
                                <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
                                    ${v.systolic ? `<span style="font-size: 13px; font-weight: 700;">${v.systolic}/${v.diastolic} mmHg</span>` : ''}
                                    ${v.heartRate ? `<span style="font-size: 12px; color: #F43F5E; font-weight: 600;"><i data-lucide="heart" style="width: 12px; vertical-align: middle;"></i> ${v.heartRate}</span>` : ''}
                                    ${v.spo2 ? `<span style="font-size: 12px; color: #06B6D4; font-weight: 600;"><i data-lucide="wind" style="width: 12px; vertical-align: middle;"></i> ${v.spo2}%</span>` : ''}
                                    ${v.glucose ? `<span style="font-size: 12px; color: #F59E0B; font-weight: 600;"><i data-lucide="droplet" style="width: 12px; vertical-align: middle;"></i> ${v.glucose}</span>` : ''}
                                </div>
                                <div style="font-size: 10px; color: var(--text-muted);">${v.date}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : `<div style="text-align: center; padding: 40px; color: var(--text-muted);">No hay mediciones registradas.</div>`}
            </div>
        `;
    };

    function bindVitalsEvents() {
        document.getElementById('show-vitals-form').onclick = () => { document.getElementById('vitals-entry-container').classList.remove('hidden'); document.getElementById('vitals-btn-container').classList.add('hidden'); };
        document.getElementById('cancel-vitals').onclick = () => { document.getElementById('vitals-entry-container').classList.add('hidden'); document.getElementById('vitals-btn-container').classList.remove('hidden'); };
        document.getElementById('save-vitals').onclick = () => {
            const sys = document.getElementById('vital-sys').value;
            const dia = document.getElementById('vital-dia').value;
            const bpm = document.getElementById('vital-bpm').value;
            const spo2 = document.getElementById('vital-spo2').value;
            const glucose = document.getElementById('vital-glucose').value;
            const weight = document.getElementById('vital-weight').value;
            const temp = document.getElementById('vital-temp').value;

            if (!sys && !dia && !bpm && !spo2 && !glucose && !weight && !temp) { alert('Introduce al menos una medición.'); return; }

            vitals.push({
                id: Date.now(),
                systolic: sys, diastolic: dia, heartRate: bpm,
                spo2, glucose, weight, temp,
                date: new Date().toDateString(),
                timestamp: new Date().toLocaleTimeString()
            });
            saveData();
            navigateTo('vitals');
        };
    }

    const getSettingsContent = () => `
        <div class="settings-page fade-in">
            <div class="settings-header">
                <input type="file" id="profile-file-input" style="display: none;" accept="image/*">
                <input type="file" id="notif-file-input" style="display: none;" accept="image/*">
                <div class="profile-pic-container" id="profile-pic-trigger">
                    ${userSettings.profilePic ? `<img src="${userSettings.profilePic}">` : `<i data-lucide="user" style="width: 40px; height: 40px; color: var(--primary);"></i>`}
                </div>
                <h3>${userSettings.name}</h3>
                <p style="color: var(--text-muted); font-size: 14px;">${userSettings.email}</p>
            </div>

            <div class="settings-list">
                <h4 style="margin: 20px 0 10px;">Perfil</h4>
                <div class="stat-card" style="padding: 20px;">
                    <div class="form-group"><label>Nombre completo</label><input type="text" id="set-name" class="form-input" value="${userSettings.name}"></div>
                    <div class="form-group" style="margin-top: 12px;"><label>Email</label><input type="email" id="set-email" class="form-input" value="${userSettings.email}"></div>
                </div>

                <h4 style="margin: 20px 0 10px;">Aplicación</h4>
                <div class="stat-card" style="padding: 20px; margin-bottom: 20px; border: 1px solid var(--primary-light);">
                    <h4 style="margin: 0 0 12px; font-size: 14px; color: var(--primary);">Estado del Ayudante (Segundo Plano)</h4>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="font-size: 13px; color: var(--text-muted);">Servicio Activo:</span>
                        <span id="sw-status-text" style="font-size: 13px; font-weight: 700; color: #64748B;">Cargando...</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="font-size: 13px; color: var(--text-muted);">Último Latido:</span>
                        <span id="sw-heartbeat-text" style="font-size: 13px; font-weight: 700; color: var(--primary);">--:--:--</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <span style="font-size: 13px; color: var(--text-muted);">Medicinas en memoria:</span>
                        <span id="sw-med-count" style="font-size: 13px; font-weight: 700; color: var(--primary);">0</span>
                    </div>
                    <button class="export-btn" id="resync-sw-btn" style="width: 100%; margin: 0; padding: 10px; font-size: 12px;">
                        <i data-lucide="refresh-cw" style="width: 12px; height: 12px;"></i> Re-sincronizar Memoria
                    </button>
                </div>

                <div class="settings-item" id="test-notif-trigger" style="cursor: pointer; background: var(--primary-light); border-radius: 12px; margin-bottom: 20px;">
                    <div class="settings-item-info"><i data-lucide="bell" style="color: var(--primary);"></i><span style="color: var(--primary); font-weight: 600;">Probar aviso en 5 seg (Salga de la app)</span></div>
                    <i data-lucide="play" style="width: 16px; color: var(--primary);"></i>
                </div>
                <div class="settings-item">
                    <div class="settings-item-info"><i data-lucide="moon"></i><span>Modo Oscuro</span></div>
                    <div class="toggle-switch ${userSettings.isDarkMode ? 'active' : ''}" id="toggle-dark-mode"></div>
                </div>
                <div class="settings-item" id="set-notif-img-trigger" style="cursor: pointer;">
                    <div class="settings-item-info"><i data-lucide="image"></i><span>Imagen de Recordatorio</span></div>
                    <i data-lucide="chevron-right" style="width: 16px; opacity: 0.5;"></i>
                </div>
                <div class="settings-item" id="preview-notif-trigger" style="cursor: pointer; border-left: 2px solid var(--primary); background: var(--bg-card); margin-top: -10px; border-radius: 0 0 12px 12px; margin-bottom: 20px;">
                    <div class="settings-item-info"><i data-lucide="eye" style="color: var(--primary);"></i><span style="color: var(--primary); font-weight: 600;">Ver cómo queda mi imagen</span></div>
                    <i data-lucide="chevron-right" style="width: 16px; color: var(--primary);"></i>
                </div>


                <h4 style="margin: 20px 0 10px;">Datos</h4>
                <button class="export-btn" id="export-data" style="margin: 0;"><i data-lucide="download"></i> Exportar Historial (CSV)</button>
                <button class="btn-primary" id="save-settings" style="margin-top: 20px;">Guardar Todos los Ajustes</button>
            </div>
        </div>
    `;

    function bindSettingsEvents() {
        document.getElementById('toggle-dark-mode').onclick = function () {
            this.classList.toggle('active');
            userSettings.isDarkMode = this.classList.contains('active');
            document.body.classList.toggle('dark-mode', userSettings.isDarkMode);
        };

        document.getElementById('resync-sw-btn').onclick = () => {
            syncMedsToServiceWorker();
            alert('Memoria del Ayudante sincronizada.');
        };

        // Listen for status updates from SW
        if ('serviceWorker' in navigator) {
            const updateSWStatus = () => {
                const statusText = document.getElementById('sw-status-text');
                if (navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({ type: 'GET_STATUS' });
                } else if (statusText) {
                    statusText.textContent = 'Inactivo (Recargar)';
                    statusText.style.color = 'var(--danger)';
                }
            };

            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'HEARTBEAT') {
                    const statusText = document.getElementById('sw-status-text');
                    const heartbeatText = document.getElementById('sw-heartbeat-text');
                    const medCount = document.getElementById('sw-med-count');

                    if (statusText) {
                        statusText.textContent = 'Activo (Latido)';
                        statusText.style.color = '#10B981';
                    }
                    if (heartbeatText) heartbeatText.textContent = event.data.pulse;
                    if (medCount) medCount.textContent = event.data.medsCount;
                }

                if (event.data && event.data.type === 'STATUS_UPDATE') {
                    const statusText = document.getElementById('sw-status-text');
                    const medCount = document.getElementById('sw-med-count');
                    if (statusText) {
                        statusText.textContent = event.data.status;
                        statusText.style.color = '#10B981';
                    }
                    if (medCount) medCount.textContent = event.data.medsCount;
                }
            });

            // Re-check if worker changes
            navigator.serviceWorker.addEventListener('controllerchange', updateSWStatus);

            // Initial request
            setTimeout(updateSWStatus, 500);
            setTimeout(() => {
                const statusText = document.getElementById('sw-status-text');
                if (statusText && statusText.textContent === 'Cargando...') {
                    statusText.textContent = 'Esperando al Ayudante...';
                }
            }, 3000);
        }

        document.getElementById('test-notif-trigger').onclick = () => {
            if (Notification.permission !== 'granted') {
                alert('Primero debes permitir las notificaciones en tu móvil.');
                requestNotificationPermission();
                return;
            }

            alert('¡Vale! Ahora sal de la app o bloquea el móvil. En 5 segundos recibirás el aviso.');

            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'SCHEDULE_TEST_NOTIFICATION',
                    delay: 5000
                });
            }
        };

        document.getElementById('preview-notif-trigger').onclick = () => {
            showNotification({
                name: 'Tu Medicina',
                dose: '1 Pastilla',
                desc: 'Instrucciones de ejemplo'
            }, true);
        };

        document.getElementById('save-settings').onclick = () => {
            userSettings.name = document.getElementById('set-name').value;
            userSettings.email = document.getElementById('set-email').value;
            saveData();
            updateHeaderProfile();
            alert('Ajustes guardados correctamente.');
            navigateTo('home');
        };

        document.getElementById('set-notif-img-trigger').onclick = () => {
            document.getElementById('notif-file-input').click();
        };

        document.getElementById('notif-file-input').onchange = function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    userSettings.notifPic = event.target.result;
                    saveData();
                    alert('Imagen de recordatorio actualizada.');
                };
                reader.readAsDataURL(file);
            }
        };

        document.getElementById('profile-pic-trigger').onclick = () => {
            document.getElementById('profile-file-input').click();
        };

        document.getElementById('profile-file-input').onchange = function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    userSettings.profilePic = event.target.result;
                    saveData();
                    updateHeaderProfile();
                    navigateTo('settings');
                };
                reader.readAsDataURL(file);
            }
        };

        document.getElementById('export-data').onclick = () => {
            let csv = '\uFEFF'; // BOM for Excel UTF-8
            csv += 'Fecha,Hora,Medicina,Dosis,Estado,Notas\n';
            history.forEach(h => {
                const med = medications.find(m => m.name === h.name);
                csv += `${h.date},${h.timestamp},${h.name},"${med ? med.dose : ''}",${h.status},"${med ? med.desc : ''}"\n`;
            });

            if (vitals.length > 0) {
                csv += '\n\nSIGNOS VITALES\n';
                csv += 'Fecha,Hora,Sistólica,Diastólica,Pulso,SpO2,Glucosa,Peso,Temp\n';
                vitals.forEach(v => {
                    csv += `${v.date},${v.timestamp},${v.systolic || ''},${v.diastolic || ''},${v.heartRate || ''},${v.spo2 || ''},${v.glucose || ''},${v.weight || ''},${v.temp || ''}\n`;
                });
            }

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.setAttribute('href', url);
            a.setAttribute('download', `Pilsapp_Historial_${new Date().toISOString().split('T')[0]}.csv`);
            a.click();
        };
    }

    function updateHeaderProfile() {
        const headerPic = document.getElementById('nav-settings-header');
        if (headerPic) {
            headerPic.innerHTML = userSettings.profilePic
                ? `<img src="${userSettings.profilePic}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">`
                : `<i data-lucide="user" style="width: 20px; color: var(--primary);"></i>`;
            headerPic.innerHTML += `<span class="status-dot online"></span>`;
            lucide.createIcons();
        }
    }

    // Navigation and Routing
    const pages = {
        home: { title: 'Pilsapp', render: () => getHoyContent() },
        meds: {
            title: 'Mis Medicinas',
            render: () => {
                const grouped = medications.reduce((acc, curr) => {
                    if (!acc[curr.name]) {
                        acc[curr.name] = { ...curr, times: [curr.time] };
                    } else {
                        acc[curr.name].times.push(curr.time);
                    }
                    return acc;
                }, {});
                const groupedList = Object.values(grouped);

                return `
                    <div class="meds-list fade-in">
                        ${groupedList.length === 0 ? `<div style="text-align: center; color: var(--text-muted); padding: 60px;">No has añadido medicinas.</div>` : groupedList.map(m => `
                            <div class="med-card" style="margin-top: 15px; flex-direction: column; align-items: flex-start;">
                                <div style="display: flex; align-items: center; gap: 16px; width: 100%;">
                                    <div class="status-icon" style="background: var(--primary-light); color: var(--primary);"><i data-lucide="${m.type === 'capsule' ? 'tablet' : (m.type === 'liquid' ? 'beaker' : 'pill')}"></i></div>
                                    <div class="med-info">
                                        <h4>${m.name}</h4>
                                        <p>${m.dose} • ${m.freq === 'daily' ? 'Diaria' : (m.freq === 'weekly' ? 'Semanal' : 'Mensual')}</p>
                                        <p style="font-size: 11px; color: var(--text-muted); margin-top: 4px; font-weight: 500;">Horas: ${m.times.sort().join(', ')}</p>
                                    </div>
                                </div>
                                <div class="med-card-actions" style="margin-top: 10px; display: flex; gap: 10px;">
                                    <button class="action-icon-btn edit" onclick="editMed('${m.id}')" style="background: var(--primary-light); color: var(--primary); border: none; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                        <i data-lucide="edit-3" style="width: 14px;"></i> Editar
                                    </button>
                                    <button class="action-icon-btn delete" onclick="deleteMed('${m.id}')" style="background: #fee2e2; color: #ef4444; border: none; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                        <i data-lucide="trash-2" style="width: 14px;"></i> Borrar
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        },
        stats: { title: 'Progreso', render: () => getStatsContent() },
        vitals: { title: 'Vitales', render: () => getVitalsContent() },
        settings: { title: 'Ajustes', render: () => getSettingsContent() },
        add: {
            title: editingMedId ? 'Editar Medicina' : 'Nueva Medicina',
            render: () => {
                const med = editingMedId ? medications.find(m => m.id === editingMedId) : null;
                const freq = med ? med.freq : 'daily';
                const type = med ? (med.type || 'pill') : 'pill';
                const selectedDays = med ? (med.days || []) : [];
                const daysOfMonth = med ? (Array.isArray(med.daysOfMonth) ? med.daysOfMonth : [med.dayOfMonth || 1]) : [];

                // If editing, tempTimes reflects the current med's time (simplified for groups in next step)
                if (editingMedId && tempTimes.length === 0) {
                    tempTimes = [{ id: Date.now(), time: med.time }];
                }

                const dosePlaceholder = type === 'liquid' ? 'Ej. 5ml' : (type === 'capsule' ? 'Ej. 1 Cápsula' : 'Ej. 1 Pastilla');

                return `
                    <div class="add-page fade-in">
                        <div class="form-group"><label>Nombre</label><input type="text" id="add-name" class="form-input" placeholder="Ej. Omeprazol" value="${med ? med.name : ''}"></div>
                        
                        <div class="form-group">
                            <label>Tipo de Medicamento</label>
                            <div class="option-group" id="type-selector">
                                <div class="option-chip ${type === 'pill' ? 'active' : ''}" data-type="pill"><i data-lucide="pill" style="width: 14px; margin-right: 4px;"></i> Pastilla</div>
                                <div class="option-chip ${type === 'capsule' ? 'active' : ''}" data-type="capsule"><i data-lucide="tablet" style="width: 14px; margin-right: 4px;"></i> Cápsula</div>
                                <div class="option-chip ${type === 'liquid' ? 'active' : ''}" data-type="liquid"><i data-lucide="beaker" style="width: 14px; margin-right: 4px;"></i> Jarabe</div>
                            </div>
                        </div>

                        <div class="form-group"><label>Dosis</label><input type="text" id="add-dose" class="form-input" id="add-dose-input" placeholder="${dosePlaceholder}" value="${med ? med.dose : ''}"></div>
                        
                        <div class="form-group">
                            <label>Frecuencia</label>
                            <div class="option-group">
                                <div class="option-chip ${freq === 'daily' ? 'active' : ''}" data-freq="daily">Diaria</div>
                                <div class="option-chip ${freq === 'weekly' ? 'active' : ''}" data-freq="weekly">Semanal</div>
                                <div class="option-chip ${freq === 'monthly' ? 'active' : ''}" data-freq="monthly">Mensual</div>
                            </div>
                        </div>

                        <div id="day-selector-container" class="${freq === 'weekly' ? '' : 'hidden'}" style="margin-bottom: 20px;">
                            <label>Días de la semana</label>
                            <div class="day-selector">
                                ${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(day => `
                                    <div class="day-chip ${selectedDays.includes(day) ? 'active' : ''}" data-day="${day}">${day}</div>
                                `).join('')}
                            </div>
                        </div>

                        <div id="monthly-selector-container" class="${freq === 'monthly' ? '' : 'hidden'}" style="margin-bottom: 20px;">
                            <label>Días del mes</label>
                            <div class="day-selector" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px;">
                                ${Array.from({ length: 31 }, (_, i) => i + 1).map(d => `
                                    <div class="day-chip month-day-chip ${daysOfMonth.includes(d) ? 'active' : ''}" data-day="${d}" style="width: 32px; height: 32px; font-size: 11px;">${d}</div>
                                `).join('')}
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Horarios de toma</label>
                            <div class="time-list" id="form-time-list">
                                ${tempTimes.map(t => `<div class="time-tag">${t.time} <i data-lucide="x" onclick="removeTempTime(${t.id})"></i></div>`).join('')}
                            </div>
                            <div style="display: flex; gap: 8px; margin-top: 10px;">
                                <input type="time" id="add-time-input" class="form-input" style="flex: 1;" value="09:00">
                                <button class="add-time-btn" id="add-time-trigger" style="margin: 0;"><i data-lucide="plus"></i> Añadir hora</button>
                            </div>
                        </div>

                        <div class="form-group" style="margin-top: 20px;"><label>Instrucciones</label><input type="text" id="add-desc" class="form-input" placeholder="Ej. En ayunas" value="${med ? med.desc : ''}"></div>
                        
                        <button class="btn-primary" id="save-new-med" style="margin-top: 30px;">${editingMedId ? 'Guardar Cambios' : 'Guardar Medicina'}</button>
                    </div>
                `;
            }
        },
        register: {
            title: 'Bienvenido',
            render: () => `
                <div class="register-page fade-in">
                    <div class="welcome-hero">
                        <div class="logo-circle">
                            <i data-lucide="pill" style="width: 48px; height: 48px; color: white;"></i>
                        </div>
                        <h1>Pilsapp</h1>
                        <p>Tu asistente inteligente para una medicación segura y puntual.</p>
                    </div>
                    
                    <div class="stat-card" style="padding: 24px; border-radius: 24px; margin-top: -40px; position: relative; z-index: 2; margin-left: 20px; margin-right: 20px;">
                        <h3 style="margin-bottom: 20px; text-align: center;">Crea tu Perfil</h3>
                        
                        <div class="profile-pic-setup" id="reg-pic-trigger" style="margin-bottom: 24px; text-align: center;">
                            <div class="profile-pic-container" style="margin: 0 auto; width: 80px; height: 80px; border: 2px solid var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; background: var(--primary-light);">
                                <div id="reg-preview-container" style="width: 100%; height: 100%; display: none;"></div>
                                <i data-lucide="camera" id="reg-icon" style="width: 32px; height: 32px; color: var(--primary);"></i>
                            </div>
                            <input type="file" id="reg-file-input" style="display: none;" accept="image/*">
                            <p style="font-size: 11px; color: var(--text-muted); margin-top: 8px;">Añadir foto (opcional)</p>
                        </div>

                        <div class="form-group">
                            <label>¿Cómo te llamas?</label>
                            <input type="text" id="reg-name" class="form-input" placeholder="Tu nombre">
                        </div>
                        
                        <div class="form-group" style="margin-top: 16px;">
                            <label>Tu correo electrónico</label>
                            <input type="email" id="reg-email" class="form-input" placeholder="nombre@ejemplo.com">
                        </div>

                        <button id="complete-registration" class="btn-primary" style="margin-top: 32px;">Empezar mi salud</button>
                    </div>
                </div>
            `
        }
    };

    window.editMed = (id) => {
        const med = medications.find(m => m.id == id);
        if (med) {
            editingMedId = med.id;
            // Load all times for medications with the same name
            const sameNameMeds = medications.filter(m => m.name === med.name);
            tempTimes = sameNameMeds.map(m => ({ id: m.id, time: m.time }));
            navigateTo('add');
        }
    };

    window.deleteMed = (id) => {
        const med = medications.find(m => m.id == id);
        if (med && confirm(`¿Borrar todas las tomas de ${med.name}?`)) {
            medications = medications.filter(m => m.name !== med.name);
            saveData();
            navigateTo('meds');
        }
    };

    function getAddFormState() {
        return {
            name: document.getElementById('add-name').value,
            dose: document.getElementById('add-dose').value,
            desc: document.getElementById('add-desc').value,
            type: document.querySelector('#type-selector .option-chip.active').getAttribute('data-type'),
            freq: document.querySelector('.option-group:not(#type-selector) .option-chip.active').getAttribute('data-freq'),
            days: Array.from(document.querySelectorAll('.day-chip:not(.month-day-chip).active')).map(c => c.getAttribute('data-day')),
            daysOfMonth: Array.from(document.querySelectorAll('.month-day-chip.active')).map(c => parseInt(c.getAttribute('data-day')))
        };
    }

    function applyAddFormState(state) {
        document.getElementById('add-name').value = state.name;
        document.getElementById('add-dose').value = state.dose;
        document.getElementById('add-desc').value = state.desc;
        document.querySelectorAll('#type-selector .option-chip').forEach(c => {
            c.classList.toggle('active', c.getAttribute('data-type') === state.type);
        });
        document.querySelectorAll('.option-group:not(#type-selector) .option-chip').forEach(c => {
            c.classList.toggle('active', c.getAttribute('data-freq') === state.freq);
        });
        if (document.getElementById('day-selector-container')) {
            document.getElementById('day-selector-container').classList.toggle('hidden', state.freq !== 'weekly');
        }
        if (document.getElementById('monthly-selector-container')) {
            document.getElementById('monthly-selector-container').classList.toggle('hidden', state.freq !== 'monthly');
        }
        document.querySelectorAll('.day-chip:not(.month-day-chip)').forEach(c => {
            c.classList.toggle('active', state.days.includes(c.getAttribute('data-day')));
        });
        document.querySelectorAll('.month-day-chip').forEach(c => {
            c.classList.toggle('active', state.daysOfMonth.includes(parseInt(c.getAttribute('data-day'))));
        });
    }

    window.removeTempTime = (id) => {
        const state = getAddFormState();
        tempTimes = tempTimes.filter(t => t.id !== id);
        navigateTo('add');
        applyAddFormState(state);
    };

    function bindAddEvents() {
        // Type selector logic
        document.querySelectorAll('#type-selector .option-chip').forEach(chip => {
            chip.onclick = function () {
                document.querySelectorAll('#type-selector .option-chip').forEach(c => c.classList.remove('active'));
                this.classList.add('active');
                const type = this.getAttribute('data-type');
                const doseInput = document.getElementById('add-dose');
                if (type === 'liquid') doseInput.placeholder = 'Ej. 5ml';
                else if (type === 'capsule') doseInput.placeholder = 'Ej. 1 Cápsula';
                else doseInput.placeholder = 'Ej. 1 Pastilla';
            };
        });

        // Frequency toggle
        document.querySelectorAll('.option-group:not(#type-selector) .option-chip').forEach(chip => {
            chip.onclick = function () {
                document.querySelectorAll('.option-group:not(#type-selector) .option-chip').forEach(c => c.classList.remove('active'));
                this.classList.add('active');
                const freq = this.getAttribute('data-freq');
                if (document.getElementById('day-selector-container')) {
                    document.getElementById('day-selector-container').classList.toggle('hidden', freq !== 'weekly');
                }
                if (document.getElementById('monthly-selector-container')) {
                    document.getElementById('monthly-selector-container').classList.toggle('hidden', freq !== 'monthly');
                }
            };
        });

        // Day selection toggle (for weekly and monthly)
        document.querySelectorAll('.day-chip').forEach(chip => {
            chip.onclick = function () {
                this.classList.toggle('active');
            };
        });

        // Multiple times logic
        document.getElementById('add-time-trigger').onclick = () => {
            const timeVal = document.getElementById('add-time-input').value;
            if (timeVal) {
                const state = getAddFormState();
                tempTimes.push({ id: Date.now(), time: timeVal });
                navigateTo('add');
                applyAddFormState(state);
            }
        };

        document.getElementById('save-new-med').onclick = () => {
            const name = document.getElementById('add-name').value;
            const dose = document.getElementById('add-dose').value;
            const desc = document.getElementById('add-desc').value;
            const type = document.querySelector('#type-selector .option-chip.active').getAttribute('data-type');
            const freq = document.querySelector('.option-group:not(#type-selector) .option-chip.active').getAttribute('data-freq');
            const days = Array.from(document.querySelectorAll('.day-chip:not(.month-day-chip).active')).map(c => c.getAttribute('data-day'));
            const daysOfMonth = Array.from(document.querySelectorAll('.month-day-chip.active')).map(c => parseInt(c.getAttribute('data-day')));

            if (!name || !dose || tempTimes.length === 0) {
                alert('Por favor, rellena los campos y añade al menos una hora.');
                return;
            }
            if (freq === 'weekly' && days.length === 0) {
                alert('Por favor, selecciona al menos un día de la semana.');
                return;
            }
            if (freq === 'monthly' && daysOfMonth.length === 0) {
                alert('Por favor, selecciona al menos un día del mes.');
                return;
            }

            let originalStartDate = new Date().toDateString();
            if (editingMedId) {
                const oldMed = medications.find(m => m.id === editingMedId);
                if (oldMed) {
                    if (oldMed.startDate) originalStartDate = oldMed.startDate;
                    // Remove all old records with the same name before saving new ones
                    medications = medications.filter(m => m.name !== oldMed.name);
                }
            }

            // Create new records for each time in tempTimes
            tempTimes.forEach(t => {
                medications.push({
                    id: Date.now() + Math.random(),
                    name,
                    dose,
                    time: t.time,
                    desc,
                    type,
                    status: 'pending',
                    freq,
                    days,
                    daysOfMonth,
                    period: parseInt(t.time.split(':')[0]) >= 12 ? 'PM' : 'AM',
                    startDate: originalStartDate
                });
            });

            editingMedId = null;
            tempTimes = [];
            saveData();
            navigateTo('home');
        };
    }

    function navigateTo(pageKey) {
        // Registration Guard
        if (!userSettings.isRegistered && pageKey !== 'register') {
            pageKey = 'register';
        }

        const bottomNav = document.querySelector('.bottom-nav');
        const appHeader = document.querySelector('.app-header');

        if (!userSettings.isRegistered) {
            if (bottomNav) bottomNav.style.display = 'none';
            if (appHeader) appHeader.style.display = 'none';
        } else {
            if (bottomNav) bottomNav.style.display = 'flex';
            if (appHeader) appHeader.style.display = 'flex';
        }

        document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.getAttribute('data-page') === pageKey));

        const pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.innerText = pages[pageKey].title;

        document.getElementById('content').innerHTML = pages[pageKey].render();
        lucide.createIcons();

        if (pageKey === 'register') bindRegisterEvents();
        if (pageKey === 'vitals') bindVitalsEvents();
        if (pageKey === 'settings') bindSettingsEvents();
        if (pageKey === 'add') bindAddEvents();
    }

    function bindRegisterEvents() {
        const trigger = document.getElementById('reg-pic-trigger');
        const fileInput = document.getElementById('reg-file-input');
        const previewContainer = document.getElementById('reg-preview-container');
        const icon = document.getElementById('reg-icon');
        const btn = document.getElementById('complete-registration');

        if (trigger) trigger.onclick = () => fileInput.click();

        if (fileInput) {
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        userSettings.profilePic = event.target.result;
                        previewContainer.innerHTML = `<img src="${event.target.result}" style="width: 100%; height: 100%; object-fit: cover;">`;
                        previewContainer.style.display = 'block';
                        icon.style.display = 'none';
                    };
                    reader.readAsDataURL(file);
                }
            };
        }

        if (btn) {
            btn.onclick = () => {
                const name = document.getElementById('reg-name').value.trim();
                const email = document.getElementById('reg-email').value.trim();

                if (!name || !email) {
                    alert('Por favor, rellena tu nombre y email para continuar.');
                    return;
                }

                userSettings.name = name;
                userSettings.email = email;
                userSettings.isRegistered = true;
                saveData();
                syncUserToCloud({ name, email });
                updateHeaderProfile();
                navigateTo('home');
            };
        }
    }

    document.querySelectorAll('[data-page]').forEach(el => el.onclick = () => {
        const page = el.getAttribute('data-page');
        if (page === 'add' && !editingMedId) {
            tempTimes = []; // Reset for new medication
        }
        if (page !== 'add') {
            editingMedId = null;
            tempTimes = [];
        }
        navigateTo(page);
    });
    navigateTo('home');
});
