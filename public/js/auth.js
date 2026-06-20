/**
 * LÓGICA DE AUTENTICACIÓN COMPARTIDA - LABORATORIO SIRIO
 */

const SirioAuth = {
  // URL base de la API para permitir pruebas desde file:// o Live Server
  API_BASE: (function() {
    if (window.location.protocol === 'file:') {
      return 'http://localhost:3000';
    }
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname) || 
                    window.location.hostname.startsWith('192.168.') || 
                    window.location.hostname.startsWith('10.');
    if (isLocal && window.location.port !== '3000') {
      return 'http://localhost:3000';
    }
    return '';
  })(),
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
      const response = await fetch(`${this.API_BASE}/api/auth/login`, {
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
        return { success: false, message: result.message || 'Error de inicio de sesion.' };
      }
    } catch (error) {
      console.error('Error en login:', error);
      return { success: false, message: 'No se pudo conectar con el servidor. Por favor, asegurese de que el servidor local este ejecutandose.' };
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
      const response = await fetch(`${this.API_BASE}/api/status`);
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
  },

  // Formatear la fecha y hora completa en espanol
  formatDate(isoString) {
    if (!isoString) return 'Fecha de publicacion no registrada';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) {
        return isoString;
      }
      const dias = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
      const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      
      const diaSemana = dias[date.getDay()];
      const dia = date.getDate();
      const mes = meses[date.getMonth()];
      const anio = date.getFullYear();
      
      let horas = date.getHours();
      const minutos = String(date.getMinutes()).padStart(2, '0');
      const ampm = horas >= 12 ? 'PM' : 'AM';
      horas = horas % 12;
      horas = horas ? horas : 12;
      
      return `${diaSemana}, ${dia} ${mes}, ${anio} - ${horas}:${minutos} ${ampm}`;
    } catch (e) {
      return isoString;
    }
  }
};

// Ejecutar inicialización al cargar el DOM (Tema y Estado de Conexión)
document.addEventListener('DOMContentLoaded', () => {
  // Aplicar tema guardado en localStorage (Modo Claro por defecto)
  const savedTheme = localStorage.getItem('sirio_theme');
  if (savedTheme !== 'dark') {
    document.body.classList.add('light-theme');
  }
  
  // Inicializar botón de alternancia de tema si está presente en el DOM
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    updateThemeIcon(themeToggle);
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      const isLight = document.body.classList.contains('light-theme');
      localStorage.setItem('sirio_theme', isLight ? 'light' : 'dark');
      updateThemeIcon(themeToggle);
    });
  }

  // Mostrar el badge de estado de Google Sheets solo para administradores
  const _sessionUser = SirioAuth.getCurrentUser();
  if (_sessionUser && _sessionUser.rol === 'admin') {
    SirioAuth.initStatusBadge();
  }
});

function updateThemeIcon(btn) {
  const icon = btn.querySelector('i');
  if (!icon) return;
  if (document.body.classList.contains('light-theme')) {
    icon.className = 'fa-solid fa-moon';
    btn.title = "Cambiar a Modo Oscuro";
  } else {
    icon.className = 'fa-solid fa-sun';
    btn.title = "Cambiar a Modo Claro";
  }
}
