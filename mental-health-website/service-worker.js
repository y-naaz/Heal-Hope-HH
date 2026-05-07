// MindWell Service Worker — handles background push notifications
const CACHE_NAME = 'mindwell-v1';

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
    self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(clients.claim());
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
