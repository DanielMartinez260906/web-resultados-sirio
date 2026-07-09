/**
 * GESTIÓN DE NOTIFICACIONES PUSH - CLIENTE - LABORATORIO SIRIO
 */

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = SirioAuth.getCurrentUser();
  if (!currentUser || currentUser.rol !== 'cliente') {
    return; // Solo los clientes registrados reciben notificaciones push de resultados
  }

  const toggleBtn = document.getElementById('push-toggle-btn');
  const statusMsg = document.getElementById('push-status-message');

  if (!toggleBtn || !statusMsg) return;

  // Verificar soporte
  const isPushSupported = 'serviceWorker' in navigator && 'PushManager' in window;
  if (!isPushSupported) {
    toggleBtn.disabled = true;
    toggleBtn.innerHTML = '<i class="fa-solid fa-ban"></i> No Soportado';
    statusMsg.style.display = 'block';
    statusMsg.style.color = '#ef4444';
    statusMsg.innerText = 'Este navegador no soporta Notificaciones Push.';
    return;
  }

  let isSubscribed = false;
  let swRegistration = null;

  // Helper para convertir clave pública VAPID de Base64Url a Uint8Array
  function urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Actualizar estado visual del botón
  function updateToggleButton() {
    if (Notification.permission === 'denied') {
      toggleBtn.innerHTML = '<i class="fa-solid fa-bell-slash"></i> Bloqueadas';
      toggleBtn.style.background = 'rgba(239, 68, 68, 0.1)';
      toggleBtn.style.borderColor = 'rgba(239, 68, 68, 0.3)';
      toggleBtn.style.color = '#fca5a5';
      statusMsg.style.display = 'block';
      statusMsg.style.color = '#fca5a5';
      statusMsg.innerText = 'Las notificaciones están bloqueadas en tu navegador. Por favor, cambia los permisos del sitio para poder activarlas.';
      return;
    }

    if (isSubscribed) {
      toggleBtn.innerHTML = '<i class="fa-solid fa-bell-check" style="color: #10b981;"></i> Activas';
      toggleBtn.style.background = 'rgba(16, 185, 129, 0.12)';
      toggleBtn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
      toggleBtn.style.color = '#34d399';
      statusMsg.style.display = 'block';
      statusMsg.style.color = '#34d399';
      statusMsg.innerText = '¡Notificaciones activadas correctamente en este dispositivo!';
    } else {
      toggleBtn.innerHTML = '<i class="fa-solid fa-bell-slash"></i> Desactivadas';
      toggleBtn.style.background = 'rgba(255, 255, 255, 0.05)';
      toggleBtn.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      toggleBtn.style.color = 'var(--text-muted)';
      statusMsg.style.display = 'none';
    }
  }

  // Inicializar Service Worker y verificar suscripción existente
  async function initPush() {
    try {
      // Registrar Service Worker
      swRegistration = await navigator.serviceWorker.register('sw.js');
      console.log('[Push] Service Worker registrado correctamente.');

      // Obtener suscripción existente
      const subscription = await swRegistration.pushManager.getSubscription();
      isSubscribed = !(subscription === null);

      if (isSubscribed) {
        console.log('[Push] Cliente suscrito previamente.');
        // Sincronizar con el servidor en cada carga para asegurar persistencia
        await syncSubscriptionWithServer(subscription);
      }
      updateToggleButton();
    } catch (error) {
      console.error('[Push] Error al registrar el Service Worker o recuperar suscripción:', error);
      statusMsg.style.display = 'block';
      statusMsg.style.color = '#fca5a5';
      statusMsg.innerText = 'Error al inicializar el servicio de notificaciones.';
    }
  }

  // Enviar suscripción al servidor
  async function syncSubscriptionWithServer(subscription) {
    // Formatear el JSON de la suscripción
    const subJSON = subscription.toJSON();
    const payload = {
      id_usuario: currentUser.id_usuario,
      subscription: {
        endpoint: subJSON.endpoint,
        keys: {
          p256dh: subJSON.keys.p256dh,
          auth: subJSON.keys.auth
        }
      }
    };

    try {
      const response = await fetch(`${SirioAuth.API_BASE}/api/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!data.success) {
        console.error('[Push] Error en sincronización de servidor:', data.message);
      }
    } catch (err) {
      console.error('[Push] Fallo de red al sincronizar suscripción:', err);
    }
  }

  // Suscribir al usuario
  async function subscribeUser() {
    try {
      // 1. Obtener llave pública VAPID desde el servidor
      const response = await fetch(`${SirioAuth.API_BASE}/api/push/key`);
      const keyData = await response.json();
      const applicationServerKey = urlB64ToUint8Array(keyData.publicKey);

      // 2. Suscribirse mediante PushManager
      const subscription = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });

      console.log('[Push] Nueva suscripción generada en navegador.');

      // 3. Guardar en servidor
      await syncSubscriptionWithServer(subscription);

      isSubscribed = true;
      updateToggleButton();
    } catch (err) {
      console.error('[Push] Error al suscribir al usuario:', err);
      isSubscribed = false;
      updateToggleButton();
      statusMsg.style.display = 'block';
      statusMsg.style.color = '#ef4444';
      statusMsg.innerText = 'No se pudo activar las notificaciones. Intente de nuevo.';
    }
  }

  // Cancelar suscripción del usuario
  async function unsubscribeUser() {
    try {
      const subscription = await swRegistration.pushManager.getSubscription();
      if (subscription) {
        // Eliminar en el servidor
        await fetch(`${SirioAuth.API_BASE}/api/push/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_usuario: currentUser.id_usuario,
            endpoint: subscription.endpoint
          })
        });

        // Cancelar suscripción en el navegador
        await subscription.unsubscribe();
        console.log('[Push] Suscripción cancelada con éxito.');
      }

      isSubscribed = false;
      updateToggleButton();
    } catch (err) {
      console.error('[Push] Error al cancelar suscripción:', err);
      statusMsg.style.display = 'block';
      statusMsg.style.color = '#ef4444';
      statusMsg.innerText = 'Error al desactivar notificaciones.';
    }
  }

  // Manejador del clic del botón
  toggleBtn.addEventListener('click', async () => {
    toggleBtn.disabled = true;
    try {
      if (isSubscribed) {
        await unsubscribeUser();
      } else {
        // Solicitar permisos primero
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          await subscribeUser();
        } else {
          updateToggleButton();
        }
      }
    } catch (err) {
      console.error('[Push] Error en toggle:', err);
    } finally {
      toggleBtn.disabled = false;
    }
  });

  // Inicializar
  await initPush();
});
