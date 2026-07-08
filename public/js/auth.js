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
  // Clave para localStorage/Cookies de sesión
  STORAGE_KEY: 'sirio_session_user',

  // Helpers de cookies
  setCookie(name, value, days) {
    let expires = "";
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/; SameSite=Lax";
  },

  getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
      let c = ca[i].trim();
      if (c.indexOf(nameEQ) === 0) {
        return decodeURIComponent(c.substring(nameEQ.length));
      }
    }
    return null;
  },

  eraseCookie(name) {
    document.cookie = name + "=; Max-Age=-99999999; path=/; SameSite=Lax";
  },
  
  // Obtener usuario actualmente logueado
  getCurrentUser() {
    const userJson = this.getCookie(this.STORAGE_KEY);
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
        const days = rememberMe ? 7 : null;
        this.setCookie(this.STORAGE_KEY, JSON.stringify(userData), days);
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
    this.eraseCookie(this.STORAGE_KEY);
    localStorage.removeItem(this.STORAGE_KEY);
    sessionStorage.removeItem(this.STORAGE_KEY);
    window.location.href = '/index.html';
  },

  // Verificar la sesión en una página específica y redirigir si es incorrecta
  checkSession(requiredRole) {
    const isLoginPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
    
    // Si estamos en la página de login
    if (isLoginPage) {
      // Si el usuario navegó hacia atrás/adelante para llegar aquí,
      // borramos la sesión y no permitimos la redirección automática
      const navigationEntry = performance.getEntriesByType("navigation")[0];
      const isBackForward = navigationEntry && navigationEntry.type === "back_forward";
      
      if (isBackForward) {
        this.eraseCookie(this.STORAGE_KEY);
        localStorage.removeItem(this.STORAGE_KEY);
        sessionStorage.removeItem(this.STORAGE_KEY);
        return null;
      }
    }

    const user = this.getCurrentUser();
    
    // Si no hay sesión, al index (login)
    if (!user) {
      if (!isLoginPage) {
        window.location.href = '/index.html';
      }
      return null;
    }

    // Si hay sesión y está en el login, redirigir a su dashboard correspondiente
    if (isLoginPage) {
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

  // Inicializar barras de navegación deslizantes con flechas de ayuda
  const initNavScrolls = () => {
    const wrappers = document.querySelectorAll('.nav-scroll-wrapper');
    wrappers.forEach(wrapper => {
      const nav = wrapper.querySelector('.admin-nav');
      const arrowLeft = wrapper.querySelector('.scroll-arrow.left');
      const arrowRight = wrapper.querySelector('.scroll-arrow.right');
      if (!nav || !arrowLeft || !arrowRight) return;

      const updateArrows = () => {
        const scrollLeft = nav.scrollLeft;
        const scrollWidth = nav.scrollWidth;
        const clientWidth = nav.clientWidth;
        
        const hasOverflow = scrollWidth > clientWidth;
        const isAtLeft = scrollLeft <= 5;
        const isAtRight = scrollLeft + clientWidth >= scrollWidth - 5;

        if (hasOverflow) {
          if (isAtLeft) {
            arrowLeft.classList.remove('visible');
            wrapper.classList.remove('overflow-left');
          } else {
            arrowLeft.classList.add('visible');
            wrapper.classList.add('overflow-left');
          }

          if (isAtRight) {
            arrowRight.classList.remove('visible');
            wrapper.classList.remove('overflow-right');
          } else {
            arrowRight.classList.add('visible');
            wrapper.classList.add('overflow-right');
          }
        } else {
          arrowLeft.classList.remove('visible');
          arrowRight.classList.remove('visible');
          wrapper.classList.remove('overflow-left');
          wrapper.classList.remove('overflow-right');
        }
      };

      // Controladores de scroll para los botones
      arrowLeft.addEventListener('click', () => {
        nav.scrollBy({ left: -200, behavior: 'smooth' });
      });

      arrowRight.addEventListener('click', () => {
        nav.scrollBy({ left: 200, behavior: 'smooth' });
      });

      // Monitorear eventos de scroll y redimensionamiento
      nav.addEventListener('scroll', updateArrows);
      window.addEventListener('resize', updateArrows);
      
      // Una pequeña pausa para asegurar que el DOM y estilos estén renderizados
      setTimeout(updateArrows, 100);
      
      // Observar cambios en el contenido (por ejemplo, si cambian pestañas activas)
      const observer = new MutationObserver(updateArrows);
      observer.observe(nav, { childList: true, subtree: true });
    });
  };

  initNavScrolls();
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

// Manejar la carga de páginas desde la caché del historial (bfcache) para forzar verificación de sesión
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});
