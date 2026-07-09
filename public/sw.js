/**
 * SERVICE WORKER - LABORATORIO SIRIO
 * Gestiona las notificaciones push en segundo plano
 */

self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('[Service Worker] Evento push recibido sin datos.');
    return;
  }

  let data = {};
  try {
    data = event.data.json();
  } catch (err) {
    data = {
      title: 'Laboratorio Clínico SIRIO',
      body: event.data.text()
    };
  }

  const options = {
    body: data.body || 'Tienes nuevos resultados disponibles.',
    icon: data.icon || '/logo.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.data?.url || '/client.html'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Laboratorio Clínico SIRIO', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data.url;

  const clickActionPromise = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((windowClients) => {
    // Si ya está abierto el portal de clientes, enfocar la pestaña
    for (let i = 0; i < windowClients.length; i++) {
      const client = windowClients[i];
      if (client.url.includes('/client.html') && 'focus' in client) {
        return client.focus();
      }
    }
    // Si no está abierto, abrir una pestaña nueva
    if (clients.openWindow) {
      return clients.openWindow(targetUrl);
    }
  });

  event.waitUntil(clickActionPromise);
});
