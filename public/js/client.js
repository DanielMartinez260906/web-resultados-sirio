/**
 * LÓGICA DEL PORTAL DEL PACIENTE - LABORATORIO SIRIO
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Verificar sesión del cliente
  let currentUser = SirioAuth.checkSession('cliente');
  if (!currentUser) return;

  // Mostrar nombre del cliente y DNI en la cabecera
  document.getElementById('client-name').innerText = currentUser.nombre;
  document.getElementById('client-id-text').innerText = currentUser.identificacion;
  
  // Botón de cerrar sesión
  document.getElementById('logout-btn').addEventListener('click', () => SirioAuth.logout());

  // Variables de estado
  let allResults = [];
  let currentViewMode = localStorage.getItem('sirio_client_view_mode') || 'grid';

  // Elementos del DOM
  const resultsContainer = document.getElementById('results-container');
  const searchExamInput = document.getElementById('search-exam');
  const globalAlert = document.getElementById('client-global-alert');
  const globalAlertText = document.getElementById('client-global-alert-text');

  // Alternador de pestañas (Tabs)
  const tabButtons = document.querySelectorAll('#client-nav .nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.style.display = 'none');
      
      btn.classList.add('active');
      document.getElementById(targetTab).style.display = 'block';
    });
  });

  // Alternador de vista (Mosaico / Lista)
  const viewGridBtn = document.getElementById('view-grid-btn');
  const viewListBtn = document.getElementById('view-list-btn');

  function setViewMode(mode) {
    currentViewMode = mode;
    localStorage.setItem('sirio_client_view_mode', mode);
    
    if (mode === 'list') {
      if (resultsContainer) resultsContainer.className = 'results-list';
      if (viewListBtn) viewListBtn.classList.add('active');
      if (viewGridBtn) viewGridBtn.classList.remove('active');
    } else {
      if (resultsContainer) resultsContainer.className = 'results-grid';
      if (viewGridBtn) viewGridBtn.classList.add('active');
      if (viewListBtn) viewListBtn.classList.remove('active');
    }
  }

  // Inicializar modo de vista preferido
  setViewMode(currentViewMode);
  if (viewGridBtn) viewGridBtn.addEventListener('click', () => setViewMode('grid'));
  if (viewListBtn) viewListBtn.addEventListener('click', () => setViewMode('list'));

  // Inicializar datos de perfil
  function initProfile() {
    // Lectura
    const nameVal = document.getElementById('profile-name-val');
    const usernameVal = document.getElementById('profile-username-val');

    if (nameVal) nameVal.innerText = currentUser.nombre;
    if (usernameVal) usernameVal.innerText = currentUser.usuario;
    
    const pwdVal = document.getElementById('profile-password-val');
    if (pwdVal) {
      pwdVal.setAttribute('data-password', currentUser.contrasena || '');
      pwdVal.innerText = '••••••••';
      const toggleProfilePwdBtn = document.getElementById('toggle-profile-pwd-btn');
      if (toggleProfilePwdBtn) {
        const icon = toggleProfilePwdBtn.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-eye';
      }
    }
  }
  
  initProfile();

  // Botón para alternar visibilidad de contraseña
  const toggleProfilePwdBtn = document.getElementById('toggle-profile-pwd-btn');
  if (toggleProfilePwdBtn) {
    toggleProfilePwdBtn.addEventListener('click', () => {
      const pwdVal = document.getElementById('profile-password-val');
      const icon = toggleProfilePwdBtn.querySelector('i');
      if (pwdVal && icon) {
        if (pwdVal.innerText === '••••••••') {
          pwdVal.innerText = pwdVal.getAttribute('data-password') || '';
          icon.className = 'fa-solid fa-eye-slash';
        } else {
          pwdVal.innerText = '••••••••';
          icon.className = 'fa-solid fa-eye';
        }
      }
    });
  }

  // Cargar exámenes
  async function loadResults() {
    try {
      const response = await fetch(`${SirioAuth.API_BASE}/api/client/results?id_usuario=${currentUser.id_usuario}`);
      const data = await response.json();

      if (data.success) {
        allResults = data.results;
        renderResults(allResults);
      } else {
        showGlobalAlert(data.message || 'Error al obtener tus resultados.', 'error');
        if (resultsContainer) resultsContainer.innerHTML = '<p style="text-align: center; color: var(--error); padding: 2rem 0; grid-column: 1 / -1;">No se pudieron cargar los resultados.</p>';
      }
    } catch (error) {
      console.error('Error al cargar resultados:', error);
      showGlobalAlert('No se pudo establecer conexion con el servidor.', 'error');
      if (resultsContainer) resultsContainer.innerHTML = '<p style="text-align: center; color: var(--error); padding: 2rem 0; grid-column: 1 / -1;">Error de conexion con el servidor.</p>';
    }
  }

  // Helper: obtener URL correcta del PDF (Cloudinary o local legacy)
  function getPdfUrl(nombreArchivo) {
    if (!nombreArchivo) return '';
    // Si ya es una URL completa (Cloudinary), usarla directamente
    if (nombreArchivo.startsWith('http://') || nombreArchivo.startsWith('https://')) {
      return nombreArchivo;
    }
    // Archivo local (modo demo o legacy)
    return `/uploads/${nombreArchivo}`;
  }

  // Renderizar exámenes como tarjetas
  function renderResults(results) {
    if (!resultsContainer) return;

    if (results.length === 0) {
      resultsContainer.innerHTML = `
        <div class="detail-view-placeholder" style="grid-column: 1 / -1; padding: 4rem 1rem;">
          <i class="fa-solid fa-file-waveform" style="font-size: 3rem; color: var(--text-dark); opacity: 0.3; margin-bottom: 1rem;"></i>
          <h3>No hay Examenes Disponibles</h3>
          <p>Aun no se han publicado resultados de examenes para tu cuenta. Te notificaremos cuando esten disponibles.</p>
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = '';
    
    // Asegurar que la clase del contenedor corresponda al modo seleccionado
    resultsContainer.className = currentViewMode === 'list' ? 'results-list' : 'results-grid';

    results.forEach(res => {
      const card = document.createElement('div');
      card.className = 'result-card';
      
      const dateLabel = SirioAuth.formatDate(res.fecha_subida);
      const pdfUrl = getPdfUrl(res.nombre_archivo);

      card.innerHTML = `
        <div class="result-card-header">
          <div class="result-icon" style="background: rgba(14, 165, 233, 0.1); color: var(--color-primary);">
            <i class="fa-solid fa-file-pdf" style="color: var(--error); font-size: 1.25rem;"></i>
          </div>
          <span class="result-date"><i class="fa-solid fa-calendar-day"></i> ${dateLabel}</span>
        </div>
        
        <div class="result-card-body" style="padding-top: 4px;">
          <h3 style="font-size: 0.95rem; font-weight: 600; color: var(--text-main); word-break: break-all; line-height: 1.45;" title="${res.nombre_examen}">
            ${res.nombre_examen}
          </h3>
        </div>
        
        <div class="result-card-footer" style="flex-wrap: wrap; gap: 8px;">
          <a href="${pdfUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="flex: 1 1 70px; min-width: 65px;">
            <i class="fa-solid fa-eye"></i> Ver
          </a>
          <a href="/api/client/download?url=${encodeURIComponent(pdfUrl)}&nombre=${encodeURIComponent(res.nombre_examen)}" class="btn btn-primary" style="flex: 1 1 100px; min-width: 95px;">
            <i class="fa-solid fa-circle-down"></i> Descargar
          </a>
          <button class="btn btn-accent btn-interpret-ia" data-id="${res.id_resultado}" data-archivo="${res.nombre_archivo}" style="flex: 1 1 100%; width: 100%; margin-top: 4px; gap: 6px; justify-content: center; height: 38px; font-size: 0.82rem;">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Apoyo en Interpretación con SirIA
          </button>
        </div>
      `;
      
      resultsContainer.appendChild(card);
    });
  }

  // Elementos de filtros adicionales
  const filterDateInput = document.getElementById('filter-date');
  const sortOrderSelect = document.getElementById('sort-order');
  const clearFiltersBtn = document.getElementById('clear-filters-btn');

  function filterAndRenderResults() {
    if (!searchExamInput) return;
    const query = searchExamInput.value.toLowerCase().trim();
    const dateVal = filterDateInput ? filterDateInput.value : ''; // formato YYYY-MM-DD
    const sortVal = sortOrderSelect ? sortOrderSelect.value : 'date-desc';

    let filtered = [...allResults];

    // 1. Filtrar por buscador
    if (query) {
      filtered = filtered.filter(res => 
        res.nombre_examen.toLowerCase().includes(query)
      );
    }

    // 2. Filtrar por fecha
    if (dateVal) {
      filtered = filtered.filter(res => {
        if (!res.fecha_subida) return false;
        const resDate = res.fecha_subida.split('T')[0];
        return resDate === dateVal;
      });
    }

    // 3. Ordenar
    if (sortVal === 'date-desc') {
      filtered.sort((a, b) => new Date(b.fecha_subida) - new Date(a.fecha_subida));
    } else if (sortVal === 'date-asc') {
      filtered.sort((a, b) => new Date(a.fecha_subida) - new Date(b.fecha_subida));
    } else if (sortVal === 'name-asc') {
      filtered.sort((a, b) => a.nombre_examen.localeCompare(b.nombre_examen));
    } else if (sortVal === 'name-desc') {
      filtered.sort((a, b) => b.nombre_examen.localeCompare(a.nombre_examen));
    }

    renderResults(filtered);
  }

  // Eventos de filtros
  if (searchExamInput) searchExamInput.addEventListener('keyup', filterAndRenderResults);
  if (filterDateInput) filterDateInput.addEventListener('change', filterAndRenderResults);
  if (sortOrderSelect) sortOrderSelect.addEventListener('change', filterAndRenderResults);
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      if (searchExamInput) searchExamInput.value = '';
      if (filterDateInput) filterDateInput.value = '';
      if (sortOrderSelect) sortOrderSelect.value = 'date-desc';
      filterAndRenderResults();
    });
  }

  // Mostrar alertas
  function showGlobalAlert(message, type = 'info') {
    if (!globalAlert || !globalAlertText) return;
    globalAlert.className = `alert alert-${type}`;
    globalAlertText.innerText = message;
    
    const icon = globalAlert.querySelector('i');
    if (icon) {
      if (type === 'error') {
        icon.className = 'fa-solid fa-triangle-exclamation';
      } else if (type === 'success') {
        icon.className = 'fa-solid fa-circle-check';
      } else {
        icon.className = 'fa-solid fa-circle-info';
      }
    }

    globalAlert.style.display = 'flex';
    
    setTimeout(() => {
      globalAlert.style.display = 'none';
    }, 5000);
  }

  // ==========================================================================
  // LÓGICA DE INTERPRETACIÓN CON IA (GEMINI)
  // ==========================================================================
  const interpretModal = document.getElementById('interpret-modal');
  const closeInterpretModalBtn = document.getElementById('close-interpret-modal');
  const closeInterpretBtn = document.getElementById('close-interpret-btn');
  const interpretLoading = document.getElementById('interpret-loading');
  const interpretResult = document.getElementById('interpret-result');
  const interpretTextContent = document.getElementById('interpret-text-content');

  function closeInterpretModal() {
    if (interpretModal) interpretModal.style.display = 'none';
  }

  if (closeInterpretModalBtn) closeInterpretModalBtn.addEventListener('click', closeInterpretModal);
  if (closeInterpretBtn) closeInterpretBtn.addEventListener('click', closeInterpretModal);

  // Cerrar haciendo clic fuera del contenido
  window.addEventListener('click', (e) => {
    if (e.target === interpretModal) {
      closeInterpretModal();
    }
  });

  // Delegación de eventos para el botón "Interpretar (IA)"
  if (resultsContainer) {
    resultsContainer.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-interpret-ia');
      if (!btn) return;

      const idResultado = btn.dataset.id;
      const nombreArchivo = btn.dataset.archivo;

      if (!idResultado || !nombreArchivo) return;

      // Abrir modal y mostrar pantalla de carga
      if (interpretModal) interpretModal.style.display = 'flex';
      if (interpretLoading) interpretLoading.style.display = 'flex';
      if (interpretResult) interpretResult.style.display = 'none';
      if (interpretTextContent) interpretTextContent.innerHTML = '';

      try {
        const response = await fetch(`${SirioAuth.API_BASE}/api/client/interpret-exam`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id_resultado: idResultado,
            nombre_archivo: nombreArchivo
          })
        });

        const data = await response.json();

        if (data.success) {
          if (interpretLoading) interpretLoading.style.display = 'none';
          if (interpretResult) interpretResult.style.display = 'block';
          
          // Formatear texto interpretativo
          if (interpretTextContent) {
            // Renderizado básico de Markdown simple para negritas y listas
            let formattedText = data.interpretation
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/\*(.*?)\*/g, '<em>$1</em>');
            interpretTextContent.innerHTML = formattedText;
          }
        } else {
          closeInterpretModal();
          showGlobalAlert(data.message || 'Error al obtener la interpretación del examen.', 'error');
        }
      } catch (error) {
        closeInterpretModal();
        console.error('Error al solicitar interpretación por IA:', error);
        showGlobalAlert('Error de conexión con el servidor al intentar interpretar el examen.', 'error');
      }
    });
  }

  // Inicializar cargando los resultados
  loadResults();

  // ==========================================================================
  // PORTAFOLIO DE SERVICIOS INTERACTIVO
  // ==========================================================================
  let allExams = [];
  let selectedExams = new Set();
  let currentPortafolioCategory = 'TODOS';

  const portafolioTableBody = document.getElementById('portafolio-table-body');
  const searchPortafolioInput = document.getElementById('search-portafolio');
  const portafolioCatsContainer = document.getElementById('portafolio-cats');
  const portafolioCalculator = document.getElementById('portafolio-calculator');
  const selectedTestsList = document.getElementById('selected-tests-list');
  const cotizadorTotalVal = document.getElementById('cotizador-total-val');
  const clearSelectedTestsBtn = document.getElementById('clear-selected-tests');
  const printQuoteBtn = document.getElementById('print-quote-btn');
  const downloadPortafolioBtn = document.getElementById('download-portafolio-btn');

  async function loadPortafolio() {
    // Show loading state
    if (portafolioTableBody) {
      portafolioTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2.5rem 0;color:var(--text-muted);">
        <i class="fa-solid fa-spinner fa-spin" style="font-size:1.4rem;margin-bottom:0.5rem;display:block;"></i>
        Cargando portafolio...
      </td></tr>`;
    }
    try {
      const response = await fetch(`${SirioAuth.API_BASE}/api/client/portafolio`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      if (data.success) {
        if (data.visible === false) {
          if (downloadPortafolioBtn) downloadPortafolioBtn.style.display = 'none';
          const filterCard = document.querySelector('#tab-client-portafolio .panel-card:nth-of-type(2)');
          if (filterCard) filterCard.style.display = 'none';
          
          const grid = document.getElementById('portafolio-layout-grid');
          if (grid) {
            grid.style.gridTemplateColumns = '1fr';
            grid.innerHTML = `
              <div class="panel-card" style="padding: 4rem 2rem; text-align: center; max-width: 600px; margin: 2rem auto; border: 1px solid rgba(234, 179, 8, 0.2); background: rgba(234, 179, 8, 0.03); border-radius: 12px; animation: floatIn 0.3s ease;">
                <i class="fa-solid fa-clock-rotate-left" style="font-size: 3rem; color: var(--color-accent); margin-bottom: 1.5rem; display: block;"></i>
                <h3 style="color: var(--text-main); font-size: 1.25rem; font-weight: 700; margin-bottom: 0.75rem;">Portafolio en Mantenimiento</h3>
                <p style="color: var(--text-muted); font-size: 0.85rem; line-height: 1.6; margin-bottom: 0;">
                  Estimado Doctor/a: Actualmente nos encontramos actualizando nuestras tarifas y catálogo de exámenes. Por favor, consulte directamente con el laboratorio para cotizaciones inmediatas. Disculpe las molestias.
                </p>
              </div>
            `;
          }
          return;
        }

        // Restore if visible
        if (downloadPortafolioBtn) downloadPortafolioBtn.style.display = 'flex';
        const filterCard = document.querySelector('#tab-client-portafolio .panel-card:nth-of-type(2)');
        if (filterCard) filterCard.style.display = 'block';

        allExams = data.portafolio || [];
        initCategories();
        renderPortafolioTable();
      } else {
        throw new Error('Portafolio vacío o sin datos');
      }
    } catch (error) {
      console.error('Error al cargar portafolio:', error);
      if (portafolioTableBody) {
        portafolioTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:3rem 0;color:var(--error);">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:1.8rem;display:block;margin-bottom:0.6rem;opacity:0.7;"></i>
          No se pudo cargar el portafolio.<br>
          <span style="font-size:0.75rem;color:var(--text-muted);margin-top:6px;display:block;">Verifique que el servidor esté activo e intente recargar la página.</span>
        </td></tr>`;
      }
    }
  }

  function initCategories() {
    if (!portafolioCatsContainer) return;
    const sections = ['TODOS', ...new Set(allExams.map(item => item.seccion))];
    portafolioCatsContainer.innerHTML = sections.map(sec => {
      const isActive = sec === currentPortafolioCategory;
      return `<button class="category-pill" data-category="${sec}" style="
        padding: 6px 14px; font-size: 0.78rem; border-radius: 20px; white-space: nowrap;
        height: 32px; border: 1px solid ${isActive ? 'var(--color-primary)' : 'var(--border-light)'};
        background: ${isActive ? 'var(--color-primary)' : 'rgba(255,255,255,0.03)'};
        color: ${isActive ? '#fff' : 'var(--text-muted)'}; cursor: pointer;
        transition: all 0.2s; font-family: inherit; font-weight: ${isActive ? '600' : '400'};
      ">${sec}</button>`;
    }).join('');

    portafolioCatsContainer.querySelectorAll('.category-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        currentPortafolioCategory = btn.dataset.category;
        portafolioCatsContainer.querySelectorAll('.category-pill').forEach(b => {
          b.style.background = 'rgba(255,255,255,0.03)';
          b.style.color = 'var(--text-muted)';
          b.style.border = '1px solid var(--border-light)';
          b.style.fontWeight = '400';
        });
        btn.style.background = 'var(--color-primary)';
        btn.style.color = '#fff';
        btn.style.border = '1px solid var(--color-primary)';
        btn.style.fontWeight = '600';
        renderPortafolioTable();
      });
    });
  }

  function getRecipientBadge(recipiente) {
    if (!recipiente) return '';
    const text = recipiente.toLowerCase();
    let bg = 'rgba(255,255,255,0.05)', color = 'var(--text-muted)';
    if (text.includes('lila') || text.includes('edta'))           { bg = 'rgba(168,85,247,0.15)'; color = '#d8b4fe'; }
    else if (text.includes('celeste') || text.includes('citrato')){ bg = 'rgba(14,165,233,0.15)'; color = '#7dd3fc'; }
    else if (text.includes('roja') || text.includes('rojo'))      { bg = 'rgba(239,68,68,0.15)';  color = '#fca5a5'; }
    else if (text.includes('amarilla') || text.includes('amarillo')){ bg = 'rgba(234,179,8,0.15)';color = '#fde047'; }
    else if (text.includes('verde') || text.includes('heparina')) { bg = 'rgba(34,197,94,0.15)';  color = '#86efac'; }
    else if (text.includes('gris') || text.includes('fluoruro'))  { bg = 'rgba(148,163,184,0.15)';color = '#cbd5e1'; }
    return `<span style="background:${bg};color:${color};padding:3px 8px;border-radius:4px;font-size:0.72rem;font-weight:500;border:1px solid rgba(255,255,255,0.06);display:inline-block;">${recipiente}</span>`;
  }

  function renderPortafolioTable() {
    if (!portafolioTableBody) return;
    const query = searchPortafolioInput ? searchPortafolioInput.value.toLowerCase().trim() : '';
    const filtered = allExams.filter(item => {
      const matchCat = currentPortafolioCategory === 'TODOS' || item.seccion === currentPortafolioCategory;
      const matchSearch = item.examen.toLowerCase().includes(query) || item.seccion.toLowerCase().includes(query);
      return matchCat && matchSearch;
    });

    if (filtered.length === 0) {
      portafolioTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-dark);padding:3rem 0;">
        <i class="fa-solid fa-folder-open" style="font-size:2rem;opacity:0.3;margin-bottom:0.5rem;display:block;"></i>
        No se encontraron exámenes.
      </td></tr>`;
      return;
    }

    // Group by section if showing ALL
    if (currentPortafolioCategory === 'TODOS') {
      const sections = [...new Set(filtered.map(i => i.seccion))];
      portafolioTableBody.innerHTML = sections.map(sec => {
        const items = filtered.filter(i => i.seccion === sec);
        const rows = items.map(item => buildRow(item)).join('');
        return `<tr><td colspan="6" style="padding:12px 10px 4px;background:rgba(14,165,233,0.06);border-bottom:none;">
          <span style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--color-primary);">
            <i class="fa-solid fa-circle-chevron-right" style="margin-right:5px;font-size:0.65rem;"></i>${sec}
          </span>
        </td></tr>${rows}`;
      }).join('');
    } else {
      portafolioTableBody.innerHTML = filtered.map(item => buildRow(item)).join('');
    }

    // Events
    portafolioTableBody.querySelectorAll('.portafolio-row').forEach(row => {
      row.addEventListener('mouseenter', () => row.style.background = 'rgba(14,165,233,0.04)');
      row.addEventListener('mouseleave', () => row.style.background = '');
      row.addEventListener('click', () => {
        const cb = row.querySelector('.exam-checkbox');
        if (cb) { cb.checked = !cb.checked; toggleExamSelection(cb.dataset.id, cb.checked); }
      });
    });
    portafolioTableBody.querySelectorAll('.exam-checkbox').forEach(cb => {
      cb.addEventListener('change', () => toggleExamSelection(cb.dataset.id, cb.checked));
    });
  }

  function buildRow(item) {
    const isChecked = selectedExams.has(item.id_examen) ? 'checked' : '';
    const formattedPrice = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(item.precio);
    return `<tr class="portafolio-row" data-id="${item.id_examen}" style="border-bottom:1px solid var(--border-light);cursor:pointer;transition:background 0.15s;">
      <td style="padding:11px 10px;" onclick="event.stopPropagation();">
        <input type="checkbox" class="exam-checkbox" data-id="${item.id_examen}" ${isChecked} style="cursor:pointer;width:16px;height:16px;accent-color:var(--color-primary);">
      </td>
      <td style="padding:11px 10px;font-weight:550;color:var(--text-main);font-size:0.85rem;">${item.examen}</td>
      <td style="padding:11px 10px;text-align:right;font-weight:700;color:var(--color-accent);font-size:0.92rem;white-space:nowrap;">${formattedPrice}</td>
      <td style="padding:11px 10px;color:var(--text-muted);font-size:0.78rem;white-space:nowrap;">${item.tiempo_reporte}</td>
      <td style="padding:11px 10px;color:var(--text-muted);font-size:0.78rem;">${item.muestra}</td>
      <td style="padding:11px 10px;">${getRecipientBadge(item.recipiente)}</td>
    </tr>`;
  }

  function toggleExamSelection(idExamen, isChecked) {
    if (isChecked) selectedExams.add(idExamen);
    else selectedExams.delete(idExamen);
    updateCalculator();
  }

  function updateCalculator() {
    const grid = document.getElementById('portafolio-layout-grid');
    if (selectedExams.size === 0) {
      if (portafolioCalculator) portafolioCalculator.style.display = 'none';
      if (grid) grid.style.gridTemplateColumns = '1fr';
      return;
    }
    if (portafolioCalculator) portafolioCalculator.style.display = 'block';
    if (grid && window.innerWidth > 992) grid.style.gridTemplateColumns = '1fr 340px';

    const selectedList = allExams.filter(item => selectedExams.has(item.id_examen));
    const total = selectedList.reduce((sum, item) => sum + item.precio, 0);
    if (cotizadorTotalVal) cotizadorTotalVal.innerText = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(total);

    if (selectedTestsList) {
      selectedTestsList.innerHTML = selectedList.map(item => {
        const priceStr = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(item.precio);
        return `<div style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.02);padding:8px 12px;border-radius:6px;border:1px solid var(--border-light);font-size:0.79rem;gap:8px;">
          <div style="flex:1;word-break:break-word;">
            <div style="font-weight:600;color:var(--text-main);">${item.examen}</div>
            <div style="font-size:0.68rem;color:var(--text-muted);margin-top:2px;">${item.seccion}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            <span style="font-weight:700;color:var(--color-accent);font-size:0.82rem;">${priceStr}</span>
            <button class="remove-test-btn" data-id="${item.id_examen}" style="background:transparent;border:none;color:var(--error);cursor:pointer;padding:4px;font-size:0.85rem;" title="Quitar">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>`;
      }).join('');

      selectedTestsList.querySelectorAll('.remove-test-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          selectedExams.delete(btn.dataset.id);
          const cb = portafolioTableBody ? portafolioTableBody.querySelector(`.exam-checkbox[data-id="${btn.dataset.id}"]`) : null;
          if (cb) cb.checked = false;
          updateCalculator();
        });
      });
    }
  }

  if (clearSelectedTestsBtn) {
    clearSelectedTestsBtn.addEventListener('click', () => {
      selectedExams.clear();
      if (portafolioTableBody) portafolioTableBody.querySelectorAll('.exam-checkbox').forEach(cb => cb.checked = false);
      updateCalculator();
    });
  }

  if (searchPortafolioInput) searchPortafolioInput.addEventListener('input', renderPortafolioTable);

  if (printQuoteBtn) {
    printQuoteBtn.addEventListener('click', () => {
      localStorage.setItem('sirio_quote_exams', JSON.stringify([...selectedExams]));
      const userData = SirioAuth.getUser ? SirioAuth.getUser() : {};
      localStorage.setItem('sirio_client_info', JSON.stringify(userData || {}));
      window.open('/portafolio-print.html?cotizar=true', '_blank');
    });
  }

  if (downloadPortafolioBtn) {
    downloadPortafolioBtn.addEventListener('click', () => {
      window.open('/portafolio-print.html', '_blank');
    });
  }

  // Cargar portafolio INMEDIATAMENTE al iniciar (no esperar el click de tab)
  loadPortafolio();

  // También recargar si la tab se activa y está vacía (por si acaso)
  const portafolioTabBtn = document.querySelector('[data-tab="tab-client-portafolio"]');
  if (portafolioTabBtn) {
    portafolioTabBtn.addEventListener('click', () => {
      if (allExams.length === 0) loadPortafolio();
    });
  }

});
