/**
 * LÓGICA DE TEMAS Y ANIMACIONES ESTACIONALES - LABORATORIO SIRIO
 */

const SirioThemes = {
  activeInterval: null,
  activeParticles: [],

  // Mapeo de temas y sus caracteres de animación
  themeConfig: {
    christmas: {
      className: 'theme-christmas',
      chars: ['❄', '❅', '❆', '•'],
      elementClass: 'snowflake',
      intervalMs: 350,
      maxCount: 22,
      styleGenerator: (el) => {
        el.style.left = Math.random() * 100 + 'vw';
        const duration = 5 + Math.random() * 8;
        el.style.animationDuration = duration + 's';
        el.style.animationDelay = Math.random() * 2 + 's';
        el.style.opacity = 0.3 + Math.random() * 0.7;
        el.style.fontSize = 0.8 + Math.random() * 1.0 + 'rem';
      }
    },
    halloween: {
      className: 'theme-halloween',
      chars: ['👻', '🎃', '🦇', '💀', '🕸️'],
      elementClass: 'halloween-ghost',
      intervalMs: 700,
      maxCount: 12,
      styleGenerator: (el) => {
        el.style.left = Math.random() * 100 + 'vw';
        const duration = 6 + Math.random() * 9;
        el.style.animationDuration = duration + 's';
        el.style.animationDelay = Math.random() * 2 + 's';
        el.style.fontSize = 1.0 + Math.random() * 1.2 + 'rem';
      }
    },
    valentine: {
      className: 'theme-valentine',
      chars: ['💖', '💝', '💕', '❤️', '💘', '🌸'],
      elementClass: 'valentine-heart',
      intervalMs: 500,
      maxCount: 16,
      styleGenerator: (el) => {
        el.style.left = Math.random() * 100 + 'vw';
        const duration = 5 + Math.random() * 7;
        el.style.animationDuration = duration + 's';
        el.style.animationDelay = Math.random() * 2 + 's';
        el.style.opacity = 0.4 + Math.random() * 0.6;
        el.style.fontSize = 1.0 + Math.random() * 1.0 + 'rem';
      }
    }
  },

  // Aplicar un tema estacional de forma dinámica
  applyTheme(themeName) {
    // 1. Limpiar efectos del tema anterior
    this.clearEffects();
    
    // Remover todas las clases de tema existentes en body
    document.body.classList.remove('theme-christmas', 'theme-halloween', 'theme-valentine');
    
    const config = this.themeConfig[themeName];
    if (!config) {
      console.log('[Temas] Tema por defecto (normal) activado.');
      return; // Si es 'default' o no existe, queda limpio
    }
    
    console.log(`[Temas] Aplicando tema estacional: ${themeName}`);
    document.body.classList.add(config.className);
    
    // 2. Iniciar el loop de animación de partículas
    this.startParticles(config);
  },

  // Iniciar la caída/ascenso de partículas
  startParticles(config) {
    this.activeInterval = setInterval(() => {
      if (this.activeParticles.length >= config.maxCount) return;

      const element = document.createElement('div');
      element.className = config.elementClass;
      
      // Carácter aleatorio del tema
      const charIndex = Math.floor(Math.random() * config.chars.length);
      element.innerText = config.chars[charIndex];

      // Aplicar estilos personalizados de animación
      config.styleGenerator(element);

      // Eliminar el elemento al finalizar su animación para no sobrecargar el DOM
      element.addEventListener('animationend', () => {
        element.remove();
        this.activeParticles = this.activeParticles.filter(p => p !== element);
      });

      document.body.appendChild(element);
      this.activeParticles.push(element);
    }, config.intervalMs);
  },

  // Limpiar timers y elementos flotantes del DOM
  clearEffects() {
    if (this.activeInterval) {
      clearInterval(this.activeInterval);
      this.activeInterval = null;
    }
    
    // Remover todos los elementos de partículas del DOM
    const selector = '.snowflake, .halloween-ghost, .valentine-heart';
    document.querySelectorAll(selector).forEach(el => el.remove());
    
    this.activeParticles = [];
  },

  // Cargar tema activo desde el servidor (público)
  async init() {
    try {
      // Usar SirioAuth.API_BASE si está definido, de lo contrario vacío (relativo)
      const apiBase = typeof SirioAuth !== 'undefined' ? SirioAuth.API_BASE : '';
      const response = await fetch(`${apiBase}/api/client/theme`);
      const data = await response.json();
      
      if (data.success && data.theme) {
        this.applyTheme(data.theme);
      }
    } catch (err) {
      console.error('[Temas] Error al inicializar el tema activo:', err);
    }
  }
};

// Autoejecutar al cargar
document.addEventListener('DOMContentLoaded', () => {
  SirioThemes.init();
});
