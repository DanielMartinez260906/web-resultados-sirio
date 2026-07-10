/**
 * GESTIÓN DE INSTALACIÓN PWA - LABORATORIO SIRIO
 * Captura el prompt de instalación en Android y PC, y provee guías para iOS.
 */

(function () {
  let deferredPrompt = null;
  const pwaBtn = document.getElementById('pwa-install-btn');

  // Detectar si ya está corriendo en modo standalone (instalado)
  const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

  // Si ya está instalado, ocultamos el botón
  if (isStandalone && pwaBtn) {
    pwaBtn.style.display = 'none';
    return;
  }

  // Escuchar el evento de Chrome/Android
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevenir el prompt automático del navegador
    e.preventDefault();
    deferredPrompt = e;
    
    // Mostrar el botón en el header
    if (pwaBtn) {
      pwaBtn.style.display = 'inline-flex';
    }
  });

  // Si es un celular y es iOS (Safari no dispara beforeinstallprompt, pero queremos dejarle opción al usuario)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS && !isStandalone && pwaBtn) {
    pwaBtn.style.display = 'inline-flex';
  }

  if (pwaBtn) {
    pwaBtn.addEventListener('click', async () => {
      if (isIOS) {
        // En iOS mostramos una alerta explicativa hermosa con los pasos
        if (typeof showGlobalAlert === 'function') {
          showGlobalAlert(
            'Para instalar en iPhone: toca Compartir <i class="fa-solid fa-arrow-up-from-bracket"></i> y selecciona "Agregar a la pantalla de inicio".', 
            'info'
          );
        } else {
          alert('Para instalar en iPhone: toca el botón de Compartir en Safari y selecciona "Agregar a la pantalla de inicio".');
        }
        return;
      }

      if (!deferredPrompt) {
        if (typeof showGlobalAlert === 'function') {
          showGlobalAlert('La aplicación ya está instalada o tu navegador no soporta instalación automática.', 'info');
        } else {
          alert('La aplicación ya está instalada o tu navegador no soporta instalación directa.');
        }
        return;
      }

      // Mostrar el diálogo de instalación
      deferredPrompt.prompt();
      
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[PWA] Decisión de instalación: ${outcome}`);
      
      if (outcome === 'accepted') {
        pwaBtn.style.display = 'none';
        deferredPrompt = null;
      }
    });
  }

  // Ocultar botón si se completa la instalación
  window.addEventListener('appinstalled', (evt) => {
    console.log('[PWA] Aplicación instalada correctamente.');
    if (pwaBtn) pwaBtn.style.display = 'none';
  });
})();
