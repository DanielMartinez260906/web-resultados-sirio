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
  const testContainer = document.getElementById('push-test-container');
  const testBtn = document.getElementById('push-test-btn');
  const headerPushBtn = document.getElementById('header-push-btn');

  if (!toggleBtn || !statusMsg) return;

  // Verificar soporte
  const isPushSupported = 'serviceWorker' in navigator && 'PushManager' in window;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

  if (!isPushSupported) {
    toggleBtn.disabled = true;
    if (isIOS && !isStandalone) {
      toggleBtn.innerHTML = '<i class="fa-solid fa-circle-info"></i> Requiere PWA';
      statusMsg.style.display = 'block';
      statusMsg.style.color = '#eab308';
      statusMsg.innerHTML = `
        <div style="background: rgba(234, 179, 8, 0.08); border: 1px solid rgba(234, 179, 8, 0.2); padding: 12px; border-radius: 8px; font-size: 0.82rem; line-height: 1.45; text-align: left; margin-top: 8px;">
          <strong style="color: #eab308; display: block; margin-bottom: 4px;"><i class="fa-solid fa-circle-exclamation"></i> Requisito de iPhone (iOS):</strong>
          Para activar las notificaciones push, debes agregar esta web a tu pantalla de inicio:<br>
          1. Toca el botón de <strong>Compartir</strong> <span style="display:inline-block; transform: translateY(1px); font-size: 0.9rem;"><i class="fa-solid fa-share-nodes"></i></span> o <span style="display:inline-block; transform: translateY(1px); font-size: 0.9rem;"><i class="fa-solid fa-arrow-up-from-bracket"></i></span> en tu navegador.<br>
          2. Desplázate hacia abajo y selecciona <strong>"Agregar a la pantalla de inicio"</strong>.<br>
          3. Abre la aplicación desde el ícono de tu pantalla de inicio e inicia sesión para activar las notificaciones.
        </div>
      `;
      
      if (headerPushBtn) {
        headerPushBtn.className = 'btn btn-secondary btn-icon';
        headerPushBtn.style.color = '#eab308';
        headerPushBtn.style.borderColor = 'rgba(234, 179, 8, 0.4)';
        headerPushBtn.title = 'Requiere instalar en pantalla de inicio';
        headerPushBtn.addEventListener('click', () => {
          showGlobalAlert(
            'Para recibir notificaciones en iPhone: toca Compartir <i class="fa-solid fa-arrow-up-from-bracket"></i> y selecciona "Agregar a la pantalla de inicio".', 
            'info'
          );
        });
      }
    } else {
      toggleBtn.innerHTML = '<i class="fa-solid fa-ban"></i> No Soportado';
      statusMsg.style.display = 'block';
      statusMsg.style.color = '#ef4444';
      statusMsg.innerText = 'Este navegador no soporta Notificaciones Push.';
      
      if (headerPushBtn) {
        headerPushBtn.disabled = true;
        headerPushBtn.title = 'Notificaciones no soportadas en este navegador';
      }
    }
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
      
      if (headerPushBtn) {
        headerPushBtn.className = 'btn btn-secondary btn-icon status-blocked';
        headerPushBtn.innerHTML = '<i class="fa-solid fa-bell-slash"></i>';
        headerPushBtn.title = 'Notificaciones bloqueadas';
      }
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
      if (testContainer) testContainer.style.display = 'flex';

      if (headerPushBtn) {
        headerPushBtn.className = 'btn btn-secondary btn-icon status-active';
        headerPushBtn.innerHTML = '<i class="fa-solid fa-bell"></i>';
        headerPushBtn.title = 'Notificaciones activadas';
      }
    } else {
      toggleBtn.innerHTML = '<i class="fa-solid fa-bell-slash"></i> Desactivadas';
      toggleBtn.style.background = 'rgba(255, 255, 255, 0.05)';
      toggleBtn.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      toggleBtn.style.color = 'var(--text-muted)';
      statusMsg.style.display = 'none';
      if (testContainer) testContainer.style.display = 'none';

      if (headerPushBtn) {
        headerPushBtn.className = 'btn btn-secondary btn-icon pulse-inactive';
        headerPushBtn.innerHTML = '<i class="fa-solid fa-bell-slash"></i>';
        headerPushBtn.title = 'Activar notificaciones';
      }
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

  // Manejador del clic del botón (Unificado para cabecera y perfil)
  const handleToggleClick = async (clickedBtn) => {
    toggleBtn.disabled = true;
    if (headerPushBtn) headerPushBtn.disabled = true;
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
      if (headerPushBtn) headerPushBtn.disabled = false;
    }
  };

  toggleBtn.addEventListener('click', () => handleToggleClick(toggleBtn));
  if (headerPushBtn) {
    headerPushBtn.addEventListener('click', () => handleToggleClick(headerPushBtn));
  }

  // Manejador del clic del botón de prueba
  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      testBtn.disabled = true;
      const originalText = testBtn.innerHTML;
      testBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Enviando...';
      try {
        const response = await fetch(`${SirioAuth.API_BASE}/api/push/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_usuario: currentUser.id_usuario })
        });
        const data = await response.json();
        if (data.success) {
          testBtn.innerHTML = '<i class="fa-solid fa-check" style="color: #34d399;"></i> ¡Enviada!';
          setTimeout(() => {
            testBtn.innerHTML = originalText;
            testBtn.disabled = false;
          }, 3000);
        } else {
          showGlobalAlert(data.message || 'Error al enviar notificación de prueba.', 'error');
          testBtn.innerHTML = originalText;
          testBtn.disabled = false;
        }
      } catch (err) {
        console.error('Error al probar notificaciones:', err);
        showGlobalAlert('Fallo de red al enviar la prueba.', 'error');
        testBtn.innerHTML = originalText;
        testBtn.disabled = false;
      }
    });
  }

  // Inicializar
  await initPush();
});
