/**
 * FONDO DE RED DE PARTÍCULAS INTERACTIVO Y CONECTADO - LABORATORIO SIRIO
 * Muestra una constelación de puntos que se mueven al cargar, se conectan con líneas
 * y disminuyen su velocidad gradualmente hasta quedar estáticos como fondo.
 * Incluye de forma destacada la constelación de Canis Major con la estrella Sirio brillando.
 */

(function () {
  let canvas, ctx;
  let particles = [];
  let constellationStarsMap = {}; // Mapa para acceder rápido a las estrellas de Canis Major
  let animationId = null;
  let isLightTheme = false;

  // Parámetros de la simulación
  const maxDistance = 150; // Distancia máxima para conectar dos puntos aleatorios
  const friction = 0.981;   // Factor de desaceleración (fricción) para detenerlos suavemente
  const stopThreshold = 0.05; // Velocidad por debajo de la cual se detienen por completo

  // Definición de la constelación de Canis Major (Offsets del centro)
  const constellationDef = [
    { id: 'sirius', name: 'Sirio', dx: 0, dy: 0, radius: 8.5, color: 'rgba(255, 255, 255, 0.95)', type: 'sirius' },
    { id: 'mirzam', name: 'Mirzam', dx: -80, dy: 15, radius: 5.0, color: 'rgba(14, 165, 233, 0.85)', type: 'constellation' },
    { id: 'muliphein', name: 'Muliphein', dx: 45, dy: -50, radius: 4.0, color: 'rgba(14, 165, 233, 0.85)', type: 'constellation' },
    { id: 'wezen', name: 'Wezen', dx: 65, dy: 105, radius: 5.5, color: 'rgba(212, 175, 55, 0.85)', type: 'constellation' }, // Amarillo/Oro
    { id: 'adhara', name: 'Adhara', dx: 30, dy: 170, radius: 5.0, color: 'rgba(14, 165, 233, 0.85)', type: 'constellation' },
    { id: 'aludra', name: 'Aludra', dx: 110, dy: 135, radius: 4.5, color: 'rgba(14, 165, 233, 0.85)', type: 'constellation' },
    { id: 'furud', name: 'Furud', dx: -30, dy: 195, radius: 4.0, color: 'rgba(14, 165, 233, 0.85)', type: 'constellation' }
  ];

  // Conexiones de la constelación de Canis Major
  const constellationConnections = [
    ['mirzam', 'sirius'],
    ['sirius', 'muliphein'],
    ['sirius', 'wezen'],
    ['wezen', 'adhara'],
    ['wezen', 'aludra'],
    ['adhara', 'furud'],
    ['adhara', 'aludra']
  ];

  class Particle {
    constructor(x, y, radius, color, type, isConstellation = false, offset = null) {
      this.x = x;
      this.y = y;
      this.radius = radius;
      this.color = color;
      this.type = type; // 'blue', 'gold', 'constellation', 'sirius'
      this.isConstellation = isConstellation;
      this.constellationOffset = offset; // Guardar offset para reposicionamiento en resize

      // Velocidad inicial constante y sutil para las estrellas de fondo
      const angle = Math.random() * Math.PI * 2;
      if (isConstellation) {
        this.vx = 0;
        this.vy = 0;
      } else {
        const speed = 0.05 + Math.random() * 0.12; // Velocidad muy sutil y constante
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
      }
    }

    update(w, h) {
      // Aplicar movimiento sin fricción
      this.x += this.vx;
      this.y += this.vy;

      // Rebote en bordes (solo para estrellas libres, las de constelación quedan en su sitio relativo)
      if (!this.isConstellation) {
        if (this.x - this.radius < 0) {
          this.x = this.radius;
          this.vx *= -1;
        } else if (this.x + this.radius > w) {
          this.x = w - this.radius;
          this.vx *= -1;
        }

        if (this.y - this.radius < 0) {
          this.y = this.radius;
          this.vy *= -1;
        } else if (this.y + this.radius > h) {
          this.y = h - this.radius;
          this.vy *= -1;
        }
      }
    }

    draw() {
      if (this.type === 'sirius') {
        // --- Dibujar la estrella Sirio (Brillante con destellos) ---
        const glowRadius = this.radius * (isLightTheme ? 2.5 : 4.0);

        // 1. Resplandor radial de fondo
        const grad = ctx.createRadialGradient(this.x, this.y, this.radius * 0.2, this.x, this.y, glowRadius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.2, '#0ea5e9');
        grad.addColorStop(1, 'rgba(14, 165, 233, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // 2. Destello cruzado de 4 puntas (Efecto lente telescópico)
        const flareLength = canvas.width < 600 ? 18 : 28;
        ctx.strokeStyle = isLightTheme ? 'rgba(14, 165, 233, 0.4)' : 'rgba(255, 255, 255, 0.65)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        // Línea horizontal
        ctx.moveTo(this.x - flareLength, this.y);
        ctx.lineTo(this.x + flareLength, this.y);
        // Línea vertical
        ctx.moveTo(this.x, this.y - flareLength);
        ctx.lineTo(this.x, this.y + flareLength);
        ctx.stroke();

        // 3. Núcleo de la estrella
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = isLightTheme ? 0 : 8;
        ctx.shadowColor = '#0ea5e9';
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        // --- Estrellas normales y otras de la constelación ---
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        
        // Brillo sutil en modo oscuro
        ctx.shadowBlur = isLightTheme ? 0 : (this.isConstellation ? 5 : 3);
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }

  function init() {
    isLightTheme = document.body.classList.contains('light-theme');

    // Canvas Setup
    if (!document.getElementById('network-canvas')) {
      canvas = document.createElement('canvas');
      canvas.id = 'network-canvas';
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.zIndex = '-2';
      canvas.style.pointerEvents = 'none';
      document.body.appendChild(canvas);
    } else {
      canvas = document.getElementById('network-canvas');
    }

    ctx = canvas.getContext('2d');
    resizeCanvas();

    particles = [];
    constellationStarsMap = {};

    // 1. Definir Centro y Escala de la Constelación según resolución
    let centerX, centerY;
    const isMobile = canvas.width < 600;
    const constellationScale = isMobile ? 0.60 : 1.0;

    if (isMobile) {
      // En móvil: arriba a la mitad para que no lo tape la tarjeta de login
      centerX = canvas.width * 0.5;
      centerY = canvas.height * 0.20;
    } else {
      // En escritorio: izquierda a la mitad, al lado de la tarjeta de login
      centerX = canvas.width * 0.22;
      centerY = canvas.height * 0.45;
    }

    // 2. Generar Estrellas de la Constelación Sirio (Canis Major)
    constellationDef.forEach(star => {
      const x = centerX + star.dx * constellationScale;
      const y = centerY + star.dy * constellationScale;
      const r = star.radius * (isMobile ? 0.75 : 1.0); // Encoger levemente en móvil

      const p = new Particle(
        x, 
        y, 
        r, 
        star.color, 
        star.type, 
        true, 
        { dx: star.dx * constellationScale, dy: star.dy * constellationScale }
      );
      
      particles.push(p);
      constellationStarsMap[star.id] = p;
    });

    // 3. Generar Estrellas Libres de Fondo (Mayor cantidad y variedad de tamaños)
    const backgroundStarCount = Math.min(130, Math.floor((canvas.width * canvas.height) / 9500));

    for (let i = 0; i < backgroundStarCount; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      // Estrellas de distintos tamaños: unas muy pequeñas y lejanas (0.6px) y otras más grandes y brillantes (3.8px)
      const radius = 0.6 + Math.random() * 3.2;
      const opacity = 0.3 + Math.random() * 0.6; // Opacidad aleatoria para dar profundidad tridimensional
      
      let color = `rgba(14, 165, 233, ${opacity})`; // Predomina Azul (85%)
      let type = 'blue';
      
      if (Math.random() > 0.85) {
        color = `rgba(212, 175, 55, ${opacity})`; // 15% Amarillo/Oro
        type = 'gold';
      }

      particles.push(new Particle(x, y, radius, color, type, false));
    }

    window.removeEventListener('resize', onResize);
    window.addEventListener('resize', onResize);

    if (animationId) cancelAnimationFrame(animationId);
    animate();
  }

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function onResize() {
    resizeCanvas();
    
    // Reposicionar constelación de forma responsiva en resize
    let centerX, centerY;
    const isMobile = canvas.width < 600;
    const constellationScale = isMobile ? 0.60 : 1.0;

    if (isMobile) {
      centerX = canvas.width * 0.5;
      centerY = canvas.height * 0.20;
    } else {
      centerX = canvas.width * 0.22;
      centerY = canvas.height * 0.45;
    }

    particles.forEach(p => {
      if (p.isConstellation && p.constellationOffset) {
        // Aplicar offset adaptativo
        p.x = centerX + (p.constellationOffset.dx / (p.constellationOffset.dx ? constellationScale : 1)) * constellationScale;
        p.y = centerY + (p.constellationOffset.dy / (p.constellationOffset.dy ? constellationScale : 1)) * constellationScale;
      }
    });

    drawFrame();
  }

  function drawFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    isLightTheme = document.body.classList.contains('light-theme');

    // Buscar el logo en la página para crear una zona de exclusión
    const logoEl = document.querySelector('.brand-header img') || document.querySelector('.header-user-info img');
    const logoRect = logoEl ? logoEl.getBoundingClientRect() : null;
    const isLogoValid = logoRect && logoRect.width > 0 && logoRect.height > 0;
    
    let exclusionLeft = 0;
    let exclusionRight = 0;
    let exclusionTop = 0;
    let exclusionBottom = 0;
    if (isLogoValid) {
      const buffer = 15; // Colchón de seguridad de 15px alrededor del logo
      exclusionLeft = logoRect.left - buffer;
      exclusionRight = logoRect.right + buffer;
      exclusionTop = logoRect.top - buffer;
      exclusionBottom = logoRect.bottom + buffer;
    }

    // 1. DIBUJAR CONEXIONES DE LA CONSTELACIÓN SIRIO (Líneas fijas más notorias)
    constellationConnections.forEach(conn => {
      const p1 = constellationStarsMap[conn[0]];
      const p2 = constellationStarsMap[conn[1]];

      if (p1 && p2) {
        // Evitar líneas de la constelación si alguna estrella queda dentro de la exclusión
        if (isLogoValid) {
          const isP1Inside = p1.x > exclusionLeft && p1.x < exclusionRight && p1.y > exclusionTop && p1.y < exclusionBottom;
          const isP2Inside = p2.x > exclusionLeft && p2.x < exclusionRight && p2.y > exclusionTop && p2.y < exclusionBottom;
          if (isP1Inside || isP2Inside) return;
        }

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        
        // Líneas fijas celestes brillantes
        ctx.strokeStyle = isLightTheme ? 'rgba(14, 165, 233, 0.32)' : 'rgba(14, 165, 233, 0.42)';
        ctx.lineWidth = 1.6; // Más grueso
        ctx.stroke();
      }
    });

    // 2. DIBUJAR CONEXIONES DE PARTÍCULAS ALEATORIAS
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const p1 = particles[i];
        const p2 = particles[j];

        // Omitir dibujar doble línea si ambos ya están conectados por la constelación fija
        if (p1.isConstellation && p2.isConstellation) continue;
        
        // Evitar dibujar conexiones si alguna de las dos partículas cruza la zona de exclusión del logo
        if (isLogoValid) {
          const isP1Inside = p1.x > exclusionLeft && p1.x < exclusionRight && p1.y > exclusionTop && p1.y < exclusionBottom;
          const isP2Inside = p2.x > exclusionLeft && p2.x < exclusionRight && p2.y > exclusionTop && p2.y < exclusionBottom;
          if (isP1Inside || isP2Inside) continue;
        }

        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxDistance) {
          const ratio = 1 - (dist / maxDistance);
          const maxOpacity = isLightTheme ? 0.22 : 0.14;
          const opacity = ratio * maxOpacity;

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          
          if (p1.type === 'gold' || p2.type === 'gold') {
            ctx.strokeStyle = `rgba(212, 175, 55, ${opacity * 0.9})`;
          } else {
            ctx.strokeStyle = `rgba(14, 165, 233, ${opacity})`;
          }
          
          ctx.lineWidth = 1.0;
          ctx.stroke();
        }
      }
    }

    // 3. DIBUJAR PUNTOS/ESTRELLAS (Evitando la zona del logo)
    particles.forEach(p => {
      if (isLogoValid && p.x > exclusionLeft && p.x < exclusionRight && p.y > exclusionTop && p.y < exclusionBottom) {
        return; // No dibujar
      }
      p.draw();
    });
  }

  function animate() {
    drawFrame();

    // Actualizar movimiento de estrellas
    particles.forEach(p => {
      p.update(canvas.width, canvas.height);
    });

    // Se mueven indefinidamente a velocidad sutil constante
    animationId = requestAnimationFrame(animate);
  }

  // Ejecución automática al cargar el DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Exponer API global
  window.SirioNetworkBg = {
    restart: () => {
      init();
    }
  };
})();
