// MindWell Service Worker — push notifications + safety plan offline cache
const CACHE_NAME   = 'mindwell-v2';
const SP_CACHE_KEY = 'mindwell-safety-plan';

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
    self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => clients.claim())
    );
});

// ── Message from page: cache safety plan ─────────────────────────────────────
self.addEventListener('message', event => {
    if (event.data?.type === 'CACHE_SAFETY_PLAN') {
        const plan = event.data.plan;
        caches.open(CACHE_NAME).then(cache => {
            const resp = new Response(JSON.stringify(plan), {
                headers: { 'Content-Type': 'application/json' }
            });
            cache.put(SP_CACHE_KEY, resp);
        });
    }
});

// ── Push received ─────────────────────────────────────────────────────────────
self.addEventListener('push', event => {
    let data = { title: 'MindWell', body: 'You have a goal reminder!' };

    if (event.data) {
        try {
            data = JSON.parse(event.data.text());
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `goal-${data.goalId || 'reminder'}`,   // replaces previous same-goal notification
        renotify: true,
        data: { goalId: data.goalId, url: '/dashboard.html#goals' },
        actions: [
            { action: 'view',    title: '📊 View Goals' },
            { action: 'dismiss', title: '✕ Dismiss'    }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
    event.notification.close();

    if (event.action === 'dismiss') return;

    const targetUrl = event.notification.data?.url || '/dashboard.html#goals';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            // Focus existing tab if open
            for (const client of windowClients) {
                if (client.url.includes('dashboard.html') && 'focus' in client) {
                    client.focus();
                    client.postMessage({ type: 'REMINDER_CLICK', goalId: event.notification.data?.goalId });
                    return;
                }
            }
            // Otherwise open a new tab
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
