/**
 * LÓGICA DE AUTENTICACIÓN COMPARTIDA - LABORATORIO SIRIO
 */

const SirioAuth = {
  // Clave para localStorage
  STORAGE_KEY: 'sirio_session_user',
  
  // Obtener usuario actualmente logueado
  getCurrentUser() {
    const userJson = localStorage.getItem(this.STORAGE_KEY) || sessionStorage.getItem(this.STORAGE_KEY);
    if (!userJson) return null;
    try {
      return JSON.parse(userJson);
    } catch (e) {
      this.logout();
      return null;
    }
  },

  // Iniciar sesión
  async login(username, password, rememberMe) {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const result = await response.json();

      if (result.success) {
        const userData = result.user;
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem(this.STORAGE_KEY, JSON.stringify(userData));
        return { success: true, user: userData };
      } else {
        return { success: false, message: result.message || 'Error de inicio de sesión.' };
      }
    } catch (error) {
      console.error('Error en login:', error);
      return { success: false, message: 'No se pudo conectar con el servidor. Por favor, asegúrate de que el servidor local está ejecutándose.' };
    }
  },

  // Cerrar sesión
  logout() {
    localStorage.removeItem(this.STORAGE_KEY);
    sessionStorage.removeItem(this.STORAGE_KEY);
    window.location.href = '/index.html';
  },

  // Verificar la sesión en una página específica y redirigir si es incorrecta
  checkSession(requiredRole) {
    const user = this.getCurrentUser();
    
    // Si no hay sesión, al index (login)
    if (!user) {
      if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
        window.location.href = '/index.html';
      }
      return null;
    }

    // Si hay sesión y está en el login, redirigir a su dashboard correspondiente
    if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
      if (user.rol === 'admin') {
        window.location.href = '/admin.html';
      } else if (user.rol === 'cliente') {
        window.location.href = '/client.html';
      }
      return user;
    }

    // Si el rol del usuario no coincide con el requerido para la página
    if (requiredRole && user.rol !== requiredRole) {
      if (user.rol === 'admin') {
        window.location.href = '/admin.html';
      } else {
        window.location.href = '/client.html';
      }
      return null;
    }

    return user;
  },

  // Cargar dinámicamente el badge de estado en la página
  async initStatusBadge() {
    // Si ya existe en el DOM, no hacer nada
    if (document.getElementById('sirio-status-badge')) return;

    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      
      const badge = document.createElement('div');
      badge.id = 'sirio-status-badge';
      badge.className = 'status-badge';
      
      if (data.demoMode) {
        badge.innerHTML = `
          <span class="status-dot yellow"></span>
          <span>Modo Demo (Sin Google Sheets)</span>
        `;
        badge.title = "Para conectar a Google Sheets real, edita el archivo .env e introduce la URL de tu Google Apps Script.";
      } else {
        badge.innerHTML = `
          <span class="status-dot green"></span>
          <span>Google Sheets Conectado</span>
        `;
      }
      
      document.body.appendChild(badge);
    } catch (e) {
      console.warn('No se pudo conectar con el endpoint de estado.');
    }
  },

  // Mostrar loading spinner en pantalla
  showLoading(text = 'Cargando...') {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loading-overlay';
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `
        <div class="spinner"></div>
        <p id="loading-text" style="color: white; font-weight: 500;">${text}</p>
      `;
      document.body.appendChild(overlay);
    } else {
      document.getElementById('loading-text').innerText = text;
    }
    // Forzar reflow
    overlay.offsetHeight;
    overlay.classList.add('active');
  },

  // Ocultar loading spinner
  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.classList.remove('active');
    }
  }
};

// Ejecutar inicialización del badge al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  SirioAuth.initStatusBadge();
});
