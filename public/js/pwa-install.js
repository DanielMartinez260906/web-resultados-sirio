/**
 * GESTIÓN DE INSTALACIÓN PWA - LABORATORIO SIRIO
 * Captura el prompt de instalación en Android, iOS, Windows, Mac y Linux.
 */

(function () {
  let deferredPrompt = null;
  const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

  function getButtons() {
    return document.querySelectorAll('.pwa-install-btn, #pwa-install-btn');
  }

  function setButtonsDisplay(displayVal) {
    getButtons().forEach(btn => {
      btn.style.display = displayVal;
    });
  }

  // Helper para mostrar alertas en Admin o Cliente
  function notify(msg, type = 'info') {
    if (typeof showGlobalAlert === 'function') {
      showGlobalAlert(msg, type);
    } else {
      const alertEl = document.getElementById('admin-global-alert') || document.getElementById('client-global-alert');
      const textEl = document.getElementById('admin-global-alert-text') || document.getElementById('client-global-alert-text');
      if (alertEl && textEl) {
        textEl.innerHTML = msg;
        alertEl.className = `alert alert-${type}`;
        alertEl.style.display = 'flex';
        setTimeout(() => { alertEl.style.display = 'none'; }, 6000);
      } else {
        alert(msg.replace(/<[^>]*>?/gm, ''));
      }
    }
  }

  // Si ya está instalado en modo standalone, ocultar
  if (isStandalone) {
    document.addEventListener('DOMContentLoaded', () => setButtonsDisplay('none'));
    return;
  }

  // Escuchar el evento de navegadores modernos (Chrome, Edge, Android, etc.)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    setButtonsDisplay('inline-flex');
  });

  // Detección de iOS (Safari)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  document.addEventListener('DOMContentLoaded', () => {
    if (isStandalone) {
      setButtonsDisplay('none');
      return;
    }

    // Si ya capturamos deferredPrompt o es iOS, mostramos el botón
    if (deferredPrompt || isIOS) {
      setButtonsDisplay('inline-flex');
    }

    // Configurar manejador de clics para todos los botones de instalación
    getButtons().forEach(btn => {
      btn.addEventListener('click', async () => {
        if (isIOS) {
          notify(
            'Para instalar en iPhone/iPad: toca el botón Compartir <i class="fa-solid fa-arrow-up-from-bracket"></i> en Safari y selecciona "Agregar al inicio".',
            'info'
          );
          return;
        }

        if (!deferredPrompt) {
          notify(
            'Para instalar esta aplicación en tu PC o celular, busca el icono de instalación <i class="fa-solid fa-download"></i> en la barra de direcciones o menú de tu navegador.',
            'info'
          );
          return;
        }

        // Ejecutar prompt nativo
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`[PWA] Elección de instalación: ${outcome}`);

        if (outcome === 'accepted') {
          setButtonsDisplay('none');
          deferredPrompt = null;
          notify('¡Gracias por instalar la aplicación del Laboratorio SIRIO!', 'success');
        }
      });
    });
  });

  // Evento al completarse la instalación
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] Aplicación instalada exitosamente.');
    setButtonsDisplay('none');
    notify('¡Aplicación instalada exitosamente en este dispositivo!', 'success');
  });
})();
