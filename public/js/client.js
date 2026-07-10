/**
 * LÓGICA DEL PORTAL DEL PACIENTE - LABORATORIO SIRIO
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Verificar sesión del cliente
  let currentUser = SirioAuth.checkSession('cliente');
  if (!currentUser) return;

  // Mostrar nombre del cliente en la cabecera
  document.getElementById('client-name').innerText = currentUser.nombre;
  const clientIdText = document.getElementById('client-id-text');
  if (clientIdText) {
    clientIdText.innerText = currentUser.identificacion;
  }
  
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

      // Guardar pestaña activa
      sessionStorage.setItem('sirio_active_tab_client', targetTab);
    });
  });

  // Restaurar pestaña activa guardada al iniciar
  const savedClientTab = sessionStorage.getItem('sirio_active_tab_client');
  if (savedClientTab) {
    const activeBtn = document.querySelector(`#client-nav .nav-tab[data-tab="${savedClientTab}"]`);
    if (activeBtn) {
      activeBtn.click();
    }
  }

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
        
        // Mostrar aviso de resultados retenidos si aplica
        const alertContainer = document.getElementById('client-debt-alert-container');
        if (alertContainer) {
          if (data.has_retained) {
            alertContainer.innerHTML = `
              <div class="panel-card" style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.04) 100%); border: 1px dashed rgba(245, 158, 11, 0.35); border-radius: 12px; padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; display: flex; gap: 1.25rem; align-items: center; justify-content: space-between; flex-wrap: wrap; animation: floatIn 0.3s ease;">
                <div style="display: flex; gap: 1rem; align-items: center; min-width: 280px; flex: 1;">
                  <div style="width: 44px; height: 44px; border-radius: 50%; background: rgba(245, 158, 11, 0.12); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.2);">
                    <i class="fa-solid fa-clock-rotate-left" style="font-size: 1.15rem;"></i>
                  </div>
                  <div>
                    <h4 style="margin: 0 0 3px 0; color: #fbbf24; font-weight: 700; font-size: 0.92rem; text-transform: uppercase; letter-spacing: 0.5px;">Estimado Médico Veterinario</h4>
                    <p style="margin: 0; color: var(--text-muted); font-size: 0.82rem; line-height: 1.45;">
                      Le informamos que disponemos de <strong>nuevos resultados de laboratorio listos</strong> para su consulta. Estos serán publicados en su portal una vez que se regularice el estado de cuenta de su veterinaria. Agradecemos su comprensión.
                    </p>
                  </div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                  <span style="font-size: 0.72rem; font-weight: 700; color: #fca5a5; padding: 4px 10px; border-radius: 20px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); text-transform: uppercase; letter-spacing: 0.5px;">
                    <i class="fa-solid fa-circle-exclamation"></i> Pendiente de Pago
                  </span>
                </div>
              </div>
            `;
          } else {
            alertContainer.innerHTML = '';
          }
        }

        lastFilteredResults = allResults;
        currentResultsPage = 1;
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

  // Helper: verificar si una fecha (string ISO) corresponde al día de hoy en hora local
  function isToday(dateString) {
    if (!dateString) return false;
    const dateObj = new Date(dateString);
    const todayObj = new Date();
    return dateObj.getFullYear() === todayObj.getFullYear() &&
           dateObj.getMonth() === todayObj.getMonth() &&
           dateObj.getDate() === todayObj.getDate();
  }

  // Lógica de paginación de resultados
  let currentResultsPage = 1;
  const RESULTS_PAGE_SIZE = 10;
  let lastFilteredResults = [];

  // Renderizar exámenes como tarjetas con paginación
  function renderResults(results) {
    if (!resultsContainer) return;

    const pagContainer = document.getElementById('results-pagination');

    if (results.length === 0) {
      resultsContainer.innerHTML = `
        <div class="detail-view-placeholder" style="grid-column: 1 / -1; padding: 4rem 1rem;">
          <i class="fa-solid fa-file-waveform" style="font-size: 3rem; color: var(--text-dark); opacity: 0.3; margin-bottom: 1rem;"></i>
          <h3>No hay Examenes Disponibles</h3>
          <p>Aun no se han publicado resultados de examenes para tu cuenta. Te notificaremos cuando esten disponibles.</p>
        </div>
      `;
      if (pagContainer) pagContainer.innerHTML = '';
      return;
    }

    resultsContainer.innerHTML = '';
    
    // Asegurar que la clase del contenedor corresponda al modo seleccionado
    resultsContainer.className = currentViewMode === 'list' ? 'results-list' : 'results-grid';

    // Calcular páginas totales
    const totalPages = Math.ceil(results.length / RESULTS_PAGE_SIZE);
    if (currentResultsPage > totalPages) currentResultsPage = totalPages;
    if (currentResultsPage < 1) currentResultsPage = 1;

    const startIndex = (currentResultsPage - 1) * RESULTS_PAGE_SIZE;
    const endIndex = startIndex + RESULTS_PAGE_SIZE;
    const paginatedItems = results.slice(startIndex, endIndex);

    paginatedItems.forEach(res => {
      const card = document.createElement('div');
      card.className = 'result-card';
      
      const dateLabel = SirioAuth.formatDate(res.fecha_subida);
      const pdfUrl = getPdfUrl(res.nombre_archivo);
      const isRecibidoHoy = isToday(res.fecha_subida);

      card.innerHTML = `
        <div class="result-card-header">
          <div class="result-icon" style="background: rgba(14, 165, 233, 0.1); color: var(--color-primary);">
            <i class="fa-solid fa-file-pdf" style="color: var(--error); font-size: 1.25rem;"></i>
          </div>
          ${isRecibidoHoy ? '<span class="badge-today"><i class="fa-solid fa-clock"></i> Hoy</span>' : ''}
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

    // Dibujar controles de paginación
    if (pagContainer) {
      if (totalPages <= 1) {
        pagContainer.innerHTML = '';
        return;
      }

      let pagHTML = '';
      
      // Botón Anterior
      pagHTML += `
        <button class="btn btn-secondary" id="btn-prev-page" style="height: 38px; padding: 0 14px; font-size: 0.82rem; display: flex; align-items: center; gap: 6px; ${currentResultsPage === 1 ? 'pointer-events: none; opacity: 0.4;' : 'cursor: pointer;'}" ${currentResultsPage === 1 ? 'disabled' : ''}>
          <i class="fa-solid fa-chevron-left"></i> Anterior
        </button>
      `;

      // Números de Página (Reducción inteligente para móvil)
      const startPage = Math.max(1, currentResultsPage - 2);
      const endPage = Math.min(totalPages, startPage + 4);
      const adjustedStartPage = Math.max(1, Math.min(startPage, totalPages - 4));

      if (adjustedStartPage > 1) {
        pagHTML += `<button class="btn btn-secondary btn-page-num" data-page="1" style="height: 38px; width: 38px; padding: 0; font-size: 0.82rem; font-weight: 600; cursor: pointer;">1</button>`;
        if (adjustedStartPage > 2) {
          pagHTML += `<span style="color: var(--text-dark); font-size: 0.82rem; padding: 0 4px;">...</span>`;
        }
      }

      for (let i = adjustedStartPage; i <= endPage; i++) {
        const isActive = i === currentResultsPage;
        pagHTML += `
          <button class="btn ${isActive ? 'btn-primary' : 'btn-secondary'} btn-page-num" data-page="${i}" style="height: 38px; width: 38px; padding: 0; font-size: 0.82rem; font-weight: 600; cursor: pointer; ${isActive ? 'pointer-events: none;' : ''}">
            ${i}
          </button>
        `;
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          pagHTML += `<span style="color: var(--text-dark); font-size: 0.82rem; padding: 0 4px;">...</span>`;
        }
        pagHTML += `<button class="btn btn-secondary btn-page-num" data-page="${totalPages}" style="height: 38px; width: 38px; padding: 0; font-size: 0.82rem; font-weight: 600; cursor: pointer;">${totalPages}</button>`;
      }

      // Botón Siguiente
      pagHTML += `
        <button class="btn btn-secondary" id="btn-next-page" style="height: 38px; padding: 0 14px; font-size: 0.82rem; display: flex; align-items: center; gap: 6px; ${currentResultsPage === totalPages ? 'pointer-events: none; opacity: 0.4;' : 'cursor: pointer;'}" ${currentResultsPage === totalPages ? 'disabled' : ''}>
          Siguiente <i class="fa-solid fa-chevron-right"></i>
        </button>
      `;

      pagContainer.innerHTML = pagHTML;

      // Eventos de botones
      const prevBtn = document.getElementById('btn-prev-page');
      if (prevBtn && currentResultsPage > 1) {
        prevBtn.addEventListener('click', () => {
          currentResultsPage--;
          renderResults(results);
          const scrollTarget = document.querySelector('.search-container') || resultsContainer;
          if (scrollTarget) scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }

      const nextBtn = document.getElementById('btn-next-page');
      if (nextBtn && currentResultsPage < totalPages) {
        nextBtn.addEventListener('click', () => {
          currentResultsPage++;
          renderResults(results);
          const scrollTarget = document.querySelector('.search-container') || resultsContainer;
          if (scrollTarget) scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }

      pagContainer.querySelectorAll('.btn-page-num').forEach(btn => {
        btn.addEventListener('click', () => {
          const targetPage = parseInt(btn.getAttribute('data-page'));
          if (targetPage !== currentResultsPage) {
            currentResultsPage = targetPage;
            renderResults(results);
            const scrollTarget = document.querySelector('.search-container') || resultsContainer;
            if (scrollTarget) scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      });
    }
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

    // 2.5. Filtrar por recibidos hoy
    const todayToggle = document.getElementById('filter-today-toggle');
    const isTodayFilterActive = todayToggle ? todayToggle.classList.contains('active-pill') : false;
    if (isTodayFilterActive) {
      filtered = filtered.filter(res => isToday(res.fecha_subida));
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

    lastFilteredResults = filtered;
    currentResultsPage = 1;
    renderResults(lastFilteredResults);
  }

  // Eventos de filtros
  if (searchExamInput) searchExamInput.addEventListener('keyup', filterAndRenderResults);
  if (filterDateInput) filterDateInput.addEventListener('change', filterAndRenderResults);
  if (sortOrderSelect) sortOrderSelect.addEventListener('change', filterAndRenderResults);
  
  const todayToggle = document.getElementById('filter-today-toggle');
  if (todayToggle) {
    todayToggle.addEventListener('click', () => {
      todayToggle.classList.toggle('active-pill');
      filterAndRenderResults();
    });
  }

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      if (searchExamInput) searchExamInput.value = '';
      if (filterDateInput) filterDateInput.value = '';
      if (sortOrderSelect) sortOrderSelect.value = 'date-desc';
      if (todayToggle) todayToggle.classList.remove('active-pill');
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
  const printInterpretBtn = document.getElementById('print-interpret-btn');
  const interpretError = document.getElementById('interpret-error');
  const interpretErrorMsg = document.getElementById('interpret-error-msg');
  const retryInterpretBtn = document.getElementById('retry-interpret-btn');

  let activeInterpretationData = null;
  let lastSelectedInterpretExam = null; // Guarda idResultado y nombreArchivo para reintentar

  function closeInterpretModal() {
    if (interpretModal) interpretModal.style.display = 'none';
  }

  if (closeInterpretModalBtn) closeInterpretModalBtn.addEventListener('click', closeInterpretModal);
  if (closeInterpretBtn) closeInterpretBtn.addEventListener('click', closeInterpretModal);

  if (printInterpretBtn) {
    printInterpretBtn.addEventListener('click', () => {
      if (activeInterpretationData && typeof SirioComprobantes !== 'undefined') {
        SirioComprobantes.printInterpretacionIa(activeInterpretationData);
      }
    });
  }


  // Cerrar haciendo clic fuera del contenido
  window.addEventListener('click', (e) => {
    if (e.target === interpretModal) {
      closeInterpretModal();
    }
  });

  // Función para solicitar la interpretación y manejar las vistas (Carga, Resultado, Error)
  async function performInterpretation(idResultado, nombreArchivo) {
    if (!idResultado || !nombreArchivo) return;
    
    // Guardar para posibles reintentos
    lastSelectedInterpretExam = { idResultado, nombreArchivo };

    // Resetear datos de impresión
    activeInterpretationData = null;
    if (printInterpretBtn) printInterpretBtn.style.display = 'none';

    // Mostrar pantalla de carga y ocultar el resto
    if (interpretModal) interpretModal.style.display = 'flex';
    if (interpretLoading) interpretLoading.style.display = 'flex';
    if (interpretResult) interpretResult.style.display = 'none';
    if (interpretError) interpretError.style.display = 'none';
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
        
        let formattedText = '';
        // Formatear texto interpretativo
        if (interpretTextContent) {
          formattedText = data.interpretation
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
          interpretTextContent.innerHTML = formattedText;
        }

        // Guardar datos para impresión (SOLO la clínica, sin datos de pacientes como código/nombre!)
        const resultObject = allResults.find(r => r.id_resultado === idResultado);
        activeInterpretationData = {
          fecha: new Date().toLocaleString('es-CO'),
          codigo_interpretacion: 'IA-' + idResultado,
          centro_veterinario: currentUser.nombre || 'N/A',
          nombre_examen: resultObject ? resultObject.nombre_examen : nombreArchivo,
          fecha_examen: resultObject ? SirioAuth.formatDate(resultObject.fecha_subida) : 'N/A',
          analisis_html: formattedText
        };

        if (printInterpretBtn) printInterpretBtn.style.display = 'inline-flex';
      } else {
        // Mostrar error en la tarjeta
        if (interpretLoading) interpretLoading.style.display = 'none';
        if (interpretError) {
          interpretError.style.display = 'flex';
          if (interpretErrorMsg) {
            interpretErrorMsg.innerText = data.message || 'Error en el servicio de interpretación por IA.';
          }
        }
      }
    } catch (error) {
      // Mostrar error de conexión/red en la tarjeta
      if (interpretLoading) interpretLoading.style.display = 'none';
      if (interpretError) {
        interpretError.style.display = 'flex';
        if (interpretErrorMsg) {
          interpretErrorMsg.innerText = error.message || 'Error de conexión con el servidor (generativelanguage.googleapis.com).';
        }
      }
      console.error('Error al solicitar interpretación por IA:', error);
    }
  }

  // Delegación de eventos para el botón "Interpretar (IA)"
  if (resultsContainer) {
    resultsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-interpret-ia');
      if (!btn) return;
      
      const idResultado = btn.dataset.id;
      const nombreArchivo = btn.dataset.archivo;
      performInterpretation(idResultado, nombreArchivo);
    });
  }

  // Listener para el botón de reintentar dentro del modal
  if (retryInterpretBtn) {
    retryInterpretBtn.addEventListener('click', () => {
      if (lastSelectedInterpretExam) {
        performInterpretation(lastSelectedInterpretExam.idResultado, lastSelectedInterpretExam.nombreArchivo);
      }
    });
  }

  // Inicializar cargando los resultados
  loadResults();

  // ==========================================================================
  // PORTAFOLIO DE SERVICIOS INTERACTIVO
  // ==========================================================================
  let allExams = [];
  let customCategories = [];
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
        const portafolioTabBtn = document.querySelector('[data-tab="tab-client-portafolio"]');
        const maintenanceView = document.getElementById('portafolio-maintenance-view');
        const mainContent = document.getElementById('portafolio-main-content');
        
        // El botón de la pestaña siempre permanece visible
        if (portafolioTabBtn) {
          portafolioTabBtn.style.setProperty('display', 'flex', 'important');
        }

        if (data.visible === false) {
          if (maintenanceView) maintenanceView.style.display = 'block';
          if (mainContent) mainContent.style.display = 'none';
          if (downloadPortafolioBtn) downloadPortafolioBtn.style.display = 'none';
          return;
        }

        // Si está habilitado, mostrar el contenido normal
        if (maintenanceView) maintenanceView.style.display = 'none';
        if (mainContent) mainContent.style.display = 'block';
        if (downloadPortafolioBtn) downloadPortafolioBtn.style.display = 'flex';

        const filterCard = document.querySelector('#tab-client-portafolio .panel-card:nth-of-type(2)');
        if (filterCard) filterCard.style.display = 'block';

        allExams = data.portafolio || [];
        customCategories = data.categorias_adicionales || [];
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
    const sections = ['TODOS', ...new Set([...allExams.map(item => item.seccion), ...customCategories])];
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

  // ── INGRESO DE PACIENTES ───────────────────────────────────
  const EXAMS_COMUNES = [
    'Perfil Prequirúrgico 1 (Hemograma + ALT + Creatinina)',
    'Citoquímico de orina (Estudio fisicoquímico - microscópico e incluye coloración GRAM)',
    'Coprológico (Directo + Lugol + Técnica de flotación)',
    'Raspado de piel + Examen con luz de wood',
    'Cultivo 1 Oído (Bacteriológico con antibiograma + Micológico)',
    'Cultivo 2 Oídos (Bacteriológico con antibiograma + Micológico)',
    'Cultivo de otras muestras (Bacteriológico con Antibiograma)(Aerotolerantes)',
    'Hemograma automatizado (Extendido de sangre periférica + Proteínas plasmáticas + Reticulocitos)',
    'Progesterona específica canina',
    'Citología tumoral/TVT/PAAF (TVT Tumor Venéreo Transmisible - PAAF Punción Aspirada por Aguja Fina)',
    'Coprológico seriado (3 muestras) Muestra #1',
    'Coprológico seriado (3 muestras) Muestra #2',
    'Coprológico seriado (3 muestras) Muestra #3',
    'Biopsia Análisis histopatológico de 3 fragmentos de tejido por animal',
    'Perfil Prequirúrgico 1 (HLG + ALT + CRE) JORNADA (Convenio previo con el laboratorio)'
  ];

  const EXAMS_CULTIVOS = [
    'Cultivo bacteriológico + micológico + antibiograma (cualquier muestra)',
    'Cultivo micológico (Hongos) de cualquier muestra',
    'Hemocultivo + antibiograma',
    'Urocultivo (Bacteriológico con antibiograma) + Citoquímico de Orina',
    'Urocultivo (Bacteriológico + antibiograma)',
    'Coprocultivo (Bacteriológico + antibiograma)',
    'Coprocultivo (Bacteriológico - antibiograma) + Coprológico',
    'Cultivo Micobacterias',
    'Antibiograma Adicional',
    'Cultivo anaerobios estrictos',
    'Cultivo bacteriológico + antibiograma MIC (Concentración Inhibitoria Mínima) Cualquier muestra',
    'Cultivo de secreciones (Bacteriológico + antibiograma)',
    'Cultivo de piel (Bacteriológico + antibiograma)'
  ];

  const EXAMS_TOXICOLOGIA = [
    'Tamizaje de intoxicación por warfarínicos',
    'Antidepresivos tricíclicos - TCA',
    'Anfetamina-AMP',
    'Barbitúricos - BAR',
    'Benzodiazepinas - BZO',
    'Cocaína-COC',
    'Feniciclidina - PCP',
    'Marihuana-THC',
    'Metadona-MTD',
    'Metanfetamina-MET',
    'Metilendioximetanfetamina-MDMA',
    'Morfina-MOP',
    'Opiato -OPI',
    'Toxicología completa COC-AMP-THC-MTD-MET-MOP-OPI-MDMA-PCP-BAR-BZO-TCA'
  ];

  const EXAMS_PERFILES = [
    'PREQUIRÚRGICO 2 (Hemograma + ALT  Creatinina + TP + TPT) (Comunicarse y programar con el laboratorio)',
    'TP y TPT (Coordinar con el laboratorio la hora de recolección)',
    'DIAGNÓSTICO PRIMARIO 1 (Hemograma + ALT + Creatinina y Citoquímico o Coprológico o Raspado de piel)',
    'DIAGNÓSTICO PRIMARIO 2 (Hemograma + ALT + Creatinina y 2 exámenes (Coprológico + Raspado de piel o Coprológico + Citoquímico de orina o Raspado de piel + Citoquímico de orina))',
    'DIAGNÓSTICO PRIMARIO 3 (Hemograma + ALT + FA + Creatinina + Urea + BUN)',
    'CONVULSIVO 1 (Hemograma + ALT + Albúmina + AST + BilT+D + BUN /Urea  Creatinina + FA + GGT + Prot diferenciadas + Glucosa)',
    'DERMATOLÓGICO 1 (Raspado de piel + Test de wood + Cultivo bacteriológico con antibiograma + Cultivo micológico)',
    'DERMATOLÓGICO 2 (Hemograma + Raspado de piel + Cultivo bacteriológico con antibiograma + Cultivo micológico + T4 Libre + Colesterol total)',
    'DIABÉTICO 1 (Glucosa en sangre + Glucosa en orina (Cuantitativa) Sugerido para control de diabetes)',
    'DIABÉTICO 2 (Glucosa en sangre + Glucosa en orina (cuantitativa) + Citoquímico de orina)',
    'DIABÉTICO 3 (Citoquímico de orina + Glucosa semicuantitativa + Glucosa en sangre + Hemoglobina glicada (HBA1C))',
    'DIABÉTICO 4 (Citoquímico de orina + Glucosa semicuantitativa + Glucosa en sangre + Fructosamina + Hemoglobina glicada (HBA1C))',
    'DIABÉTICO 5 (Citoquímico de orina + Glucosa semicuantitativa + Fructosamina + Insulina Sugerido para felinos)',
    'DIABÉTICO 6 (Citoquímico de orina + Glucosa en orina (cuantitativa) + Glucosa en sangre + Fructosamina + Hemoglobina glicada (HBA1C))',
    'GASTROINTESTINAL 1 (Coprológico + Parvovirus)',
    'GASTROINTESTINAL 2 (Coprológico + Parvovirus + Coronavirus canino)',
    'GASTROINTESTINAL 3 (Coprograma + Parvovirus + Coronavirus canino)',
    'GASTROINTESTINAL 4 (Hemograma + Coprograma + Parvovirus + Coronavirus canino)',
    'GASTROINTESTINAL 5 (Análisis completo para diarrea persistente Hemograma + Coprograma + Coloración Ziehl Neelsen/Kinyoun + Coprocultivo + Parvovirus + Coronavirus canino)',
    'GERIÁTRICO 1 (Hemograma + ALT + AST + FA + Colesterol Total + Creatinina + Glucosa + Urea + BUN + T4L + Citoquímico de orina)',
    'GERIÁTRICO 2 (Hemograma + ALT + AST + FA + Colesterol Total + Creatinina + Glucosa + Urea + BUN + T4L + T4T específica + Citoquímico de orina)',
    'HEPÁTICO 1 (ALT + AST + FA + BIL T + BIL D + GGT)',
    'HEPÁTICO 2 (ALT + AST + FA + BIL T + BIL D + Proteínas diferenciadas + GGT)',
    'HEPÁTICO 3 (ALT + AST + FA + BIL T + BIL D + Proteínas diferenciadas + GGT + Bun + Urea)',
    'LIPÍDICO 1 (Colesterol total + triglicéridos + HDL + LDL + VLDL)',
    'PANCREÁTICO 1 (Lipasa pancreática específica (canina o felina) + Detección semicuantitativa de grasa neutra y ácidos grasos en heces)',
    'PANCREÁTICO 2 (Amilasa + Glucosa en sangre + Lipasa pancreática específica (canina o felina))',
    'PANCREÁTICO 3 (Amilasa + Glucosa en sangre + Lipasa pancreática específica (canina o felina) + Detección semicuantitativa de grasa neutra y ácidos grasos en heces)',
    'RENAL 1 (Hemograma + BUN + Urea + Creatinina)',
    'RENAL 2 (Hemograma + BUN + Urea + Creatinina + Fósforo)',
    'RENAL 3 (Hemograma + BUN + Urea+ Creatinina + Fósforo + Citoquímico (UPC Semicuantitativa)',
    'RENAL 4 (Hemograma + Creatinina + SDMA (Dimetil Arginina Simétrica))',
    'RENAL 5 (Hemograma + Creatinina + SDMA (Dimetil arginina simétrica) + Urea + BUN + Citoquímico (UPC Semicuantitativa))',
    'RENAL 6 (Citoquímico + BUN + Urea + Creatinina)',
    'RENAL 7 (Citoquímico de orina + Índice UPC Cuantitativa)',
    'RENAL 8 (Citoquímico de orina + BUN + Urea + Creatinina + Fósforo + Índice UPC Cuantitativa)',
    'TIROIDEO 1 (T4L + Colesterol)',
    'TIROIDEO 2 (T4L + Colesterol + Triglicéridos)',
    'TIROIDEO 3 (T4L + T4T no específica + Colesterol +Triglicéridos)',
    'TIROIDEO 4 (T4L + T4T no específica + TSH no específica)',
    'TIROIDEO 5 (T4L + T4T no específica + TSH no específica + Colesterol + Triglicéridos)',
    'TIROIDEO 6 (T4L + T4T específica + TSH específica canina)',
    'TIROIDEO 7 (T4L + T4T específica + TSH específica + Colesterol + Triglicéridos)',
    'ELECTROLÍTOS 1 (Ionograma 1 Sodio + Cloro + Potasio)',
    'ELECTROLÍTOS 2 (Ionograma 2 Sodio + cloro + Potasio + Calcio ionizado + pH)',
    'ELECTROLÍTOS  3 (Ionograma 3 Sodio + Cloro + Potasio + Ph + Calcio ionizado + Calcio sérico + Lactato + Creatinina)',
    'ELECTROLÍTOS  4 (Ionograma 4 Sodio + Cloro + Potasio + Fósforo + pH + Calcio sérico + Calcio ionizado + Lactato + Hematocrito + Hemoglobina + Creatinina)',
    'PCR Hemoparásitos Felino - Tiempo real (Anaplasma spp - Rickettsia spp - Ehrlichia spp - Mycoplasma spp - Hepatozoon spp - Toxoplasma gonsii - Bartonella spp)',
    'PCR Hemoparásitos Canino - Tiempo real (Anaplasma spp - Ehrlichia spp - Mycoplasma Spp - Hepatozoon spp - Babesia spp - Toxoplasma gondii - Dirofilaria spp)',
    'PCR Hemoparásitos Felino - Puno final Positivo o Negativo (Anaplasma sp, Cytauxzoon felis, Mycoplasma sp, Bartonella sp, Haemoplasmas)',
    'PCR Hemoparásitos Canino - Puno final Positivo o Negativo (Anaplasma spp - Ehrlichia spp - Hepatozoon spp - Babesia sp)'
  ];

  const EXAMS_INDIVIDUALES = [
    'Ácido Fólico/Vitamina B9', 'Ácido úrico', 'Ácidos Biliares (Una muestra)', 'Ácidos Biliares Pre - Post', 
    'Albúmina', 'Aldosterona', 'Alanina aminotransferasa (ALT/GPT)', 'Amilasa Pancreática', 
    'Análisis de cálculo urinario (Vejiga)', 'Análisis de cálculo vesiculares', 
    'Análisis de líquidos corporales (Examen físico - químico - bioquímico - citológico y microbiológico)', 
    'Análisis para diarrea persistente (Coprograma + Coloración Ziehl Neelsen/Kinyoun + Coprocultivo)', 
    'Anticuerpos Tiroglobulina (TgAb)', 'Aspartato aminotransferasa (AST)', 'Bilirrubina directa (BD)', 
    'Bilirrubina total (BT)', 'Brucella canis', 'BUN + Urea', 'Biopsia Análisis histopatológico de 1 fragmento adicional', 
    'Calcio ionizado', 'Calcio sérico', 'Citología vaginal canina (Ciclo estral)', 'Coloración GRAM (Infecciosa)', 
    'Cloro', 'Colesterol HDL', 'Colesterol total', 'Coloración Kinyoun', 'Coloración wright', 
    'Coloración Ziehl-Neelsen', 'Coprograma (Coprológico + azucares reductores + sangre oculta + pH + coloración Gram + coloración Wright)', 
    'Cortisol en suero (Específico canino)', 'Cortisol en suero 3 muestras (Específico canino)', 'Cortisol en suero (No específico)', 
    'Cortisol en suero 3 muestras (No específico)', 'Cortisol en orina', 'Coronavirus felino + Índice A/G + Prueba de rivalta Peritonitis infecciosa felina', 
    'Creatinina', 'Creatina Quinasa MB (CK-MB) (Fracción MB - específica del miocardio)', 'Creatina Quinasa Total (CK o CPK total)', 
    'Detección semicuantitativa de grasa neutra y ácidos grasos *Se recomienda para evaluar insuficiencia pancreática enzimática', 
    'Dímero D no específico', 'Dímero D específico canino', 'Espermograma (Examen físico - químico - morfológico - citológico - microbiológico)', 
    'Estradiol', 'Exámen directo (cualquier muestra)', 'Fenobarbital', 'Ferritina', 'Fosfatasa alcalina (FA)', 
    'Fósforo', 'Fructosamina', 'Gamma Glutamil Transferasa (GGT)', 'Glucosa', 'Glucosa en orina (Cuantitativa)', 
    'Hemoglobina glicada (HBA1C)', 'Hierro', 'Hormona Adrenocorticótropica (ACTH)', 'Hormona folículo estimulante (FSH)', 
    'Hormona de crecimiento (GH)', 'Hormona estimulante de tiroides específica canina (TSH)', 'Hormona estimulante de tiroides Inespecífica (TSH)', 
    'Hormona luteinizante (LH)', 'Insulina', 'Lactato Deshidrogenasa (LDH)', 'Lactato (Ácido lactico)', 
    'Lipasa pancreática especifica canina', 'Lipasa pancreática especifica felina', 
    'Leptospira canino Ac IgG contra 4 serovares Canicola - Icterohaemorrhagiae (Copenhague y RGA) - Pomona y Grippotyphosa', 
    'Magnesio', 'Distemper Canino', 'Parathormona', 'Parvovirus + Coronavirus Canino', 'Parvovirus + Coronavirus + Giardia Canino', 
    'Proteína C reactiva no específica (PCR cuantitativa)', 'Proteína C reactiva específica canina (PCR cuantitativa)', 
    'Plasma rico en plaquetas', 'Potasio', 'Prolactina', 'Proteínas diferenciadas (Albumina – Globulinas - Proteínas totales -I ndíce A/G)', 
    'Proteínas totales séricas', 'Pruebas cruzadas de compatibilidad (mayor y menor)', 'Prueba de Coombs específica canina (Prueba de antiglobulina directa)', 
    'Relación Proteína/Creatinina en orina (UPC)', 'Relación Cortisol/Creatinina en orina (UCCR)', 
    'Raspado de piel + Tricograma + Examen con luz de wood', 'Dimetilarginina Simétrica (SDMA) + Creatinina', 
    'Virus de Inmunodeficiencia Felina - Virus de la Leucemia (VIF - VLEU) Felino', 
    'Virus de Inmunodeficiencia Felina/Leucemia/Dirofilaria IDEXX Felino', 'SNAP 4DX IDEXX (Dirofilaria - Enfermedad de Lyme – Ehrlichia - Anaplasma)', 
    'Sodio', 'Somatomedina C', 'Suero autólogo', 'Testosterona libre', 'Testosterona total', 
    'Títulos de rabia (Fluorescent Antibody Virus Neutralization - FAVN Test)', 
    'Tiempo de Protrombina TP (Coordinar con el laboratorio la hora de recolección)', 
    'Tiempo Parcial de Tromboplastina TPT (Coordinar con el laboratorio la hora de recolección)', 'Tiroxina libre T4L', 
    'Tiroxina total específico canino o felino (T4T)', 'Tiroxina total inespecífica (T4T)', 'Toxoplasma IgG', 
    'Toxoplasma IgM', 'Tricograma + Examen con luz de wood', 'Triglicéridos', 'Triyodotironina total T3T', 
    'Tripsina inmunorreactiva Canina', 'Triple viral felina IgG Panleucopenia – Calicivirus - Herpesvirus (Vaccicheck)', 
    'Troponina I', 'Vitamina B12 cianocobalamina', 'Vitamina D25', 'Vitamina D 1.25 Dihidroxi (Calcitrol)'
  ];

  let selectedIngresarExams = new Set();
  let currentIngresarCat = 'COMUNES';

  const ingresarVetInput = document.getElementById('ingresar-vet');
  if (ingresarVetInput && currentUser) {
    ingresarVetInput.value = currentUser.nombre;
  }

  function renderIngresarExams() {
    const listContainer = document.getElementById('ingresar-exam-list');
    const searchInput = document.getElementById('search-ingresar-exam');
    if (!listContainer) return;

    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let listToRender = [];
    if (query) {
      const all = [...EXAMS_COMUNES, ...EXAMS_PERFILES, ...EXAMS_CULTIVOS, ...EXAMS_TOXICOLOGIA, ...EXAMS_INDIVIDUALES];
      listToRender = [...new Set(all)].filter(name => name.toLowerCase().includes(query));
    } else {
      if (currentIngresarCat === 'COMUNES') listToRender = EXAMS_COMUNES;
      else if (currentIngresarCat === 'PERFILES') listToRender = EXAMS_PERFILES;
      else if (currentIngresarCat === 'CULTIVOS') listToRender = EXAMS_CULTIVOS;
      else if (currentIngresarCat === 'TOXICOLOGIA') listToRender = EXAMS_TOXICOLOGIA;
      else if (currentIngresarCat === 'INDIVIDUALES') listToRender = EXAMS_INDIVIDUALES;
    }

    if (listToRender.length === 0) {
      listContainer.innerHTML = `<p style="padding: 1rem; color: var(--text-dark); text-align: center; font-size: 0.82rem; margin: 0;">Ningún examen coincide con la búsqueda.</p>`;
      return;
    }

    listContainer.innerHTML = listToRender.map(examName => {
      const isChecked = selectedIngresarExams.has(examName);
      return `
        <label style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(255,255,255,0.03); border-radius: 6px; border: 1px solid var(--border-light); cursor: pointer; transition: all 0.2s;" class="ingresar-exam-row">
          <span style="font-size: 0.85rem; color: var(--text-main); font-weight: 500; padding-right: 15px;">${examName}</span>
          <input type="checkbox" class="ingresar-exam-cb" data-name="${examName}" ${isChecked ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
        </label>
      `;
    }).join('');

    listContainer.querySelectorAll('.ingresar-exam-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        const name = cb.dataset.name;
        if (cb.checked) {
          selectedIngresarExams.add(name);
        } else {
          selectedIngresarExams.delete(name);
        }
        updateIngresarSelectedPills();
      });
    });
  }

  function updateIngresarSelectedPills() {
    const container = document.getElementById('ingresar-selected-exams-pills');
    const countSpan = document.getElementById('ingresar-selected-count');
    if (!container) return;

    countSpan.innerText = selectedIngresarExams.size;

    if (selectedIngresarExams.size === 0) {
      container.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-dark);">Ningún examen seleccionado. Agregue exámenes arriba.</span>`;
      if (typeof saveFormDraft === 'function') saveFormDraft();
      return;
    }

    container.innerHTML = [...selectedIngresarExams].map(examName => `
      <span style="font-size: 0.76rem; font-weight: 600; color: var(--color-accent); background: rgba(14, 165, 233, 0.1); border: 1px solid rgba(14, 165, 233, 0.2); padding: 5px 12px; border-radius: 20px; display: inline-flex; align-items: center; gap: 6px;">
        ${examName}
        <i class="fa-solid fa-circle-xmark" style="cursor: pointer; opacity: 0.7;" onclick="removeIngresarExam('${examName.replace(/'/g, "\\'")}')"></i>
      </span>
    `).join('');

    if (typeof saveFormDraft === 'function') saveFormDraft();
  }

  window.removeIngresarExam = (examName) => {
    selectedIngresarExams.delete(examName);
    updateIngresarSelectedPills();
    renderIngresarExams();
  };

  const catBtns = document.querySelectorAll('#ingresar-exam-cats button');
  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      catBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentIngresarCat = btn.dataset.cat;
      const searchInput = document.getElementById('search-ingresar-exam');
      if (searchInput) searchInput.value = '';
      renderIngresarExams();
    });
  });

  const searchInputIngresar = document.getElementById('search-ingresar-exam');
  if (searchInputIngresar) {
    searchInputIngresar.addEventListener('input', renderIngresarExams);
  }

  const datosEspecialesSelect = document.getElementById('ingresar-datos-especiales-tipo');
  const condicionalBiopsia = document.getElementById('condicional-biopsia');
  const condicionalPcr = document.getElementById('condicional-pcr');

  if (datosEspecialesSelect) {
    datosEspecialesSelect.addEventListener('change', () => {
      const val = datosEspecialesSelect.value;
      if (val === 'Biopsia') {
        condicionalBiopsia.style.display = 'block';
        condicionalPcr.style.display = 'none';
      } else if (val === 'PCR') {
        condicionalBiopsia.style.display = 'none';
        condicionalPcr.style.display = 'block';
      } else {
        condicionalBiopsia.style.display = 'none';
        condicionalPcr.style.display = 'none';
      }
    });
  }

  const dirHabitualCheckbox = document.getElementById('ingresar-dir-habitual');
  const customDeliveryGrid = document.getElementById('ingresar-custom-delivery-grid');
  if (dirHabitualCheckbox) {
    dirHabitualCheckbox.addEventListener('change', () => {
      customDeliveryGrid.style.display = dirHabitualCheckbox.checked ? 'none' : 'grid';
      if (dirHabitualCheckbox.checked) {
        document.getElementById('ingresar-direccion').value = '';
        document.getElementById('ingresar-telefono').value = '';
      }
    });
  }

  window.changeStep = (from, to) => {
    if (to > from) {
      if (from === 1) {
        const medico = document.getElementById('ingresar-medico');
        const propietario = document.getElementById('ingresar-propietario');
        const pacienteHc = document.getElementById('ingresar-paciente-hc');
        const especie = document.getElementById('ingresar-especie');
        const raza = document.getElementById('ingresar-raza');
        const edad = document.getElementById('ingresar-edad');
        const sexo = document.getElementById('ingresar-sexo');
        
        if (!medico.checkValidity() || !propietario.checkValidity() || !pacienteHc.checkValidity() || !especie.checkValidity() || !raza.checkValidity() || !edad.checkValidity() || !sexo.checkValidity()) {
          showGlobalAlert('Por favor complete todos los campos obligatorios del Paso 1.', 'error');
          document.getElementById('form-ingreso-paciente').reportValidity();
          return;
        }
      }
      
      if (from === 2) {
        const muestrasChecked = document.querySelectorAll('input[name="ingresar-muestra"]:checked');
        if (muestrasChecked.length === 0) {
          showGlobalAlert('Debe seleccionar al menos un tipo de muestra.', 'error');
          return;
        }
        
        const otros = document.getElementById('ingresar-otros').value.trim();
        if (selectedIngresarExams.size === 0 && otros === '') {
          showGlobalAlert('Debe seleccionar al menos un examen de la lista o indicar otro.', 'error');
          return;
        }

        const quien = document.getElementById('ingresar-quien');
        if (!quien.checkValidity()) {
          showGlobalAlert('Por favor, indique quién diligencia el formulario.', 'error');
          quien.focus();
          return;
        }
      }
    }

    document.querySelectorAll('.step-panel').forEach(p => p.style.display = 'none');
    document.getElementById(`step-panel-${to}`).style.display = 'block';

    document.querySelectorAll('.step-indicator').forEach(ind => {
      const step = parseInt(ind.getAttribute('data-step'));
      if (step === to) {
        ind.classList.add('active');
        ind.querySelector('.step-num').style.background = 'var(--color-accent)';
        ind.querySelector('.step-num').style.color = 'white';
        ind.querySelector('span').style.color = 'var(--text-main)';
      } else if (step < to) {
        ind.classList.remove('active');
        ind.querySelector('.step-num').style.background = 'var(--color-primary)';
        ind.querySelector('.step-num').style.color = 'white';
        ind.querySelector('span').style.color = 'var(--text-muted)';
      } else {
        ind.classList.remove('active');
        ind.querySelector('.step-num').style.background = 'var(--border-light)';
        ind.querySelector('.step-num').style.color = 'var(--text-muted)';
        ind.querySelector('span').style.color = 'var(--text-muted)';
      }
    });

    const progressLineFill = document.getElementById('progress-line-fill');
    if (progressLineFill) {
      const widthPercent = ((to - 1) / 2) * 100;
      progressLineFill.style.width = `${widthPercent}%`;
    }
  };

  const btnSubmit = document.getElementById('btn-submit-ingreso');
  if (btnSubmit) {
    btnSubmit.addEventListener('click', async () => {
      const tipoEsp = document.getElementById('ingresar-datos-especiales-tipo').value;
      if (tipoEsp === 'Biopsia') {
        const muestra = document.getElementById('biopsia-tipo-muestra').value;
        const aspecto = document.getElementById('biopsia-aspecto').value;
        const consistencia = document.getElementById('biopsia-consistencia').value;
        const ubicacion = document.getElementById('biopsia-ubicacion').value.trim();
        const tiempo = document.getElementById('biopsia-tiempo').value.trim();
        
        if (!muestra || !aspecto || !consistencia || !ubicacion || !tiempo) {
          showGlobalAlert('Por favor complete todos los datos obligatorios para la Biopsia.', 'error');
          return;
        }
      } else if (tipoEsp === 'PCR') {
        const pcrTipo = document.getElementById('pcr-tipo').value;
        const pcrSintomatico = document.getElementById('pcr-sintomatico').value;
        if (!pcrTipo || !pcrSintomatico) {
          showGlobalAlert('Por favor complete el tipo de PCR y si el paciente es sintomático.', 'error');
          return;
        }
      }

      SirioAuth.showLoading('Enviando ingreso de paciente...');

      const muestrasChecked = [];
      document.querySelectorAll('input[name="ingresar-muestra"]:checked').forEach(cb => {
        muestrasChecked.push(cb.value);
      });

      let detalleEspecial = '';
      if (tipoEsp === 'Biopsia') {
        detalleEspecial = JSON.stringify({
          tipo_muestra: document.getElementById('biopsia-tipo-muestra').value,
          aspecto: document.getElementById('biopsia-aspecto').value,
          consistencia: document.getElementById('biopsia-consistencia').value,
          ubicacion: document.getElementById('biopsia-ubicacion').value.trim(),
          tiempo_evolucion: document.getElementById('biopsia-tiempo').value.trim(),
          detalles_adicionales: document.getElementById('biopsia-detalles-adicionales').value.trim()
        });
      } else if (tipoEsp === 'PCR') {
        const sintomas = [];
        document.querySelectorAll('input[name="pcr-sintomas"]:checked').forEach(cb => {
          sintomas.push(cb.value);
        });
        detalleEspecial = JSON.stringify({
          tipo_pcr: document.getElementById('pcr-tipo').value,
          estado_paciente: document.getElementById('pcr-sintomatico').value,
          sintomas: sintomas,
          observaciones_pcr: document.getElementById('pcr-observaciones').value.trim()
        });
      }

      const payload = {
        id_usuario: currentUser.id_usuario,
        veterinaria: currentUser.nombre,
        medico: document.getElementById('ingresar-medico').value.trim(),
        propietario: document.getElementById('ingresar-propietario').value.trim(),
        paciente_nombre: document.getElementById('ingresar-paciente-hc').value.trim(),
        especie: document.getElementById('ingresar-especie').value,
        raza: document.getElementById('ingresar-raza').value,
        edad: document.getElementById('ingresar-edad').value,
        sexo: document.getElementById('ingresar-sexo').value,
        tipo_muestra: muestrasChecked.join(', '),
        examenes_solicitados: [...selectedIngresarExams].join(', '),
        otros_examenes: document.getElementById('ingresar-otros').value.trim(),
        observaciones: document.getElementById('ingresar-observaciones').value.trim(),
        direccion_recoleccion: document.getElementById('ingresar-dir-habitual').checked ? 'DIRECCIÓN REGISTRADA' : document.getElementById('ingresar-direccion').value.trim(),
        contacto_recoleccion: document.getElementById('ingresar-dir-habitual').checked ? 'TELÉFONO REGISTRADO' : document.getElementById('ingresar-telefono').value.trim(),
        quien_diligencia: document.getElementById('ingresar-quien').value.trim(),
        datos_especiales_tipo: tipoEsp,
        datos_especiales_detalle: detalleEspecial
      };

      try {
        const res = await fetch(`${SirioAuth.API_BASE}/api/client/ingresar-paciente`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        SirioAuth.hideLoading();

        if (data.success) {
          showGlobalAlert('Paciente ingresado con éxito y comprobante generado.', 'success');
          
          // Generar comprobante impreso
          const regData = {
            fecha: data.fecha || new Date().toLocaleString('es-CO'),
            codigo_registro: data.codigo_registro || "2180001",
            correo_centro: currentUser.correo || 'N/A',
            centro_veterinario: currentUser.nombre || 'N/A',
            medico: payload.medico,
            propietario: payload.propietario,
            paciente_nombre: payload.paciente_nombre,
            especie: payload.especie,
            raza: payload.raza,
            edad: payload.edad,
            sexo: payload.sexo,
            muestra: payload.tipo_muestra || 'Ninguna',
            examenes_solicitados: payload.examenes_solicitados || 'Ninguno',
            otros_examenes: payload.otros_examenes || '',
            observaciones: payload.observaciones || '',
            direccion_recoleccion: payload.direccion_recoleccion,
            contacto_recoleccion: payload.contacto_recoleccion,
            quien_diligencia: payload.quien_diligencia,
            datos_especiales_tipo: payload.datos_especiales_tipo,
            datos_especiales_detalle: payload.datos_especiales_detalle
          };
          
          if (typeof SirioComprobantes !== 'undefined') {
            SirioComprobantes.printIngresoPaciente(regData);
          }

          resetIngresarForm();
          changeStep(3, 1);
          const resultsTabBtn = document.querySelector('[data-tab="tab-client-results"]');
          if (resultsTabBtn) resultsTabBtn.click();
        } else {
          showGlobalAlert(data.message || 'Error al ingresar paciente.', 'error');
        }
      } catch (err) {
        SirioAuth.hideLoading();
        console.error('Error al enviar paciente:', err);
        showGlobalAlert('Error de red al intentar registrar paciente.', 'error');
      }
    });
  }

  function resetIngresarForm() {
    document.getElementById('form-ingreso-paciente').reset();
    selectedIngresarExams.clear();
    updateIngresarSelectedPills();
    renderIngresarExams();
    
    document.getElementById('condicional-biopsia').style.display = 'none';
    document.getElementById('condicional-pcr').style.display = 'none';
    document.getElementById('ingresar-custom-delivery-grid').style.display = 'none';
    
    if (ingresarVetInput && currentUser) {
      ingresarVetInput.value = currentUser.nombre;
    }

    // Limpiar borrador guardado en localStorage
    localStorage.removeItem(STORAGE_FORM_KEY);
  }

  const ingresarTabBtn = document.querySelector('[data-tab="tab-client-ingresar"]');
  if (ingresarTabBtn) {
    ingresarTabBtn.addEventListener('click', () => {
      renderIngresarExams();
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

  // ── LOGICA DE BORRADOR DE FORMULARIO (Ingresar Paciente) ──────────
  const STORAGE_FORM_KEY = 'sirio_draft_ingreso_paciente';

  function saveFormDraft() {
    const muestrasChecked = [];
    document.querySelectorAll('input[name="ingresar-muestra"]:checked').forEach(cb => {
      muestrasChecked.push(cb.value);
    });

    const pcrSintomasChecked = [];
    document.querySelectorAll('input[name="pcr-sintomas"]:checked').forEach(cb => {
      pcrSintomasChecked.push(cb.value);
    });

    const draftData = {
      medico: document.getElementById('ingresar-medico')?.value || '',
      propietario: document.getElementById('ingresar-propietario')?.value || '',
      paciente_nombre: document.getElementById('ingresar-paciente-hc')?.value || '',
      especie: document.getElementById('ingresar-especie')?.value || '',
      raza: document.getElementById('ingresar-raza')?.value || '',
      edad: document.getElementById('ingresar-edad')?.value || '',
      sexo: document.getElementById('ingresar-sexo')?.value || '',
      muestras: muestrasChecked,
      examenes_solicitados: Array.from(selectedIngresarExams),
      otros_examenes: document.getElementById('ingresar-otros')?.value || '',
      observaciones: document.getElementById('ingresar-observaciones')?.value || '',
      dir_habitual: document.getElementById('ingresar-dir-habitual')?.checked || false,
      direccion: document.getElementById('ingresar-direccion')?.value || '',
      telefono: document.getElementById('ingresar-telefono')?.value || '',
      quien_diligencia: document.getElementById('ingresar-quien')?.value || '',
      datos_especiales_tipo: document.getElementById('ingresar-datos-especiales-tipo')?.value || '',
      biopsia_tipo_muestra: document.getElementById('biopsia-tipo-muestra')?.value || '',
      biopsia_aspecto: document.getElementById('biopsia-aspecto')?.value || '',
      biopsia_consistencia: document.getElementById('biopsia-consistencia')?.value || '',
      biopsia_ubicacion: document.getElementById('biopsia-ubicacion')?.value || '',
      biopsia_tiempo: document.getElementById('biopsia-tiempo')?.value || '',
      biopsia_detalles_adicionales: document.getElementById('biopsia-detalles-adicionales')?.value || '',
      pcr_tipo: document.getElementById('pcr-tipo')?.value || '',
      pcr_sintomatico: document.getElementById('pcr-sintomatico')?.value || '',
      pcr_sintomas: pcrSintomasChecked,
      pcr_observaciones: document.getElementById('pcr-observaciones')?.value || ''
    };

    localStorage.setItem(STORAGE_FORM_KEY, JSON.stringify(draftData));
  }

  function restoreFormDraft() {
    const saved = localStorage.getItem(STORAGE_FORM_KEY);
    if (!saved) return;

    try {
      const data = JSON.parse(saved);

      if (document.getElementById('ingresar-medico')) document.getElementById('ingresar-medico').value = data.medico || '';
      if (document.getElementById('ingresar-propietario')) document.getElementById('ingresar-propietario').value = data.propietario || '';
      if (document.getElementById('ingresar-paciente-hc')) document.getElementById('ingresar-paciente-hc').value = data.paciente_nombre || '';
      if (document.getElementById('ingresar-especie')) document.getElementById('ingresar-especie').value = data.especie || '';
      if (document.getElementById('ingresar-raza')) document.getElementById('ingresar-raza').value = data.raza || '';
      if (document.getElementById('ingresar-edad')) document.getElementById('ingresar-edad').value = data.edad || '';
      if (document.getElementById('ingresar-sexo')) document.getElementById('ingresar-sexo').value = data.sexo || '';
      if (document.getElementById('ingresar-otros')) document.getElementById('ingresar-otros').value = data.otros_examenes || '';
      if (document.getElementById('ingresar-observaciones')) document.getElementById('ingresar-observaciones').value = data.observaciones || '';
      if (document.getElementById('ingresar-direccion')) document.getElementById('ingresar-direccion').value = data.direccion || '';
      if (document.getElementById('ingresar-telefono')) document.getElementById('ingresar-telefono').value = data.telefono || '';
      if (document.getElementById('ingresar-quien')) document.getElementById('ingresar-quien').value = data.quien_diligencia || '';
      
      const dirHabitual = document.getElementById('ingresar-dir-habitual');
      if (dirHabitual) {
        dirHabitual.checked = data.dir_habitual || false;
        const customDeliveryGrid = document.getElementById('ingresar-custom-delivery-grid');
        if (customDeliveryGrid) {
          customDeliveryGrid.style.display = dirHabitual.checked ? 'none' : 'grid';
        }
      }

      if (data.muestras && Array.isArray(data.muestras)) {
        document.querySelectorAll('input[name="ingresar-muestra"]').forEach(cb => {
          cb.checked = data.muestras.includes(cb.value);
        });
      }

      if (data.examenes_solicitados && Array.isArray(data.examenes_solicitados)) {
        selectedIngresarExams = new Set(data.examenes_solicitados);
      }

      const datosEspecialesSelect = document.getElementById('ingresar-datos-especiales-tipo');
      if (datosEspecialesSelect) {
        datosEspecialesSelect.value = data.datos_especiales_tipo || '';
        const condicionalBiopsia = document.getElementById('condicional-biopsia');
        const condicionalPcr = document.getElementById('condicional-pcr');
        
        if (datosEspecialesSelect.value === 'Biopsia') {
          if (condicionalBiopsia) condicionalBiopsia.style.display = 'block';
          if (condicionalPcr) condicionalPcr.style.display = 'none';
        } else if (datosEspecialesSelect.value === 'PCR') {
          if (condicionalBiopsia) condicionalBiopsia.style.display = 'none';
          if (condicionalPcr) condicionalPcr.style.display = 'block';
        } else {
          if (condicionalBiopsia) condicionalBiopsia.style.display = 'none';
          if (condicionalPcr) condicionalPcr.style.display = 'none';
        }
      }

      if (document.getElementById('biopsia-tipo-muestra')) document.getElementById('biopsia-tipo-muestra').value = data.biopsia_tipo_muestra || '';
      if (document.getElementById('biopsia-aspecto')) document.getElementById('biopsia-aspecto').value = data.biopsia_aspecto || '';
      if (document.getElementById('biopsia-consistencia')) document.getElementById('biopsia-consistencia').value = data.biopsia_consistencia || '';
      if (document.getElementById('biopsia-ubicacion')) document.getElementById('biopsia-ubicacion').value = data.biopsia_ubicacion || '';
      if (document.getElementById('biopsia-tiempo')) document.getElementById('biopsia-tiempo').value = data.biopsia_tiempo || '';
      if (document.getElementById('biopsia-detalles-adicionales')) document.getElementById('biopsia-detalles-adicionales').value = data.biopsia_detalles_adicionales || '';

      if (document.getElementById('pcr-tipo')) document.getElementById('pcr-tipo').value = data.pcr_tipo || '';
      if (document.getElementById('pcr-sintomatico')) document.getElementById('pcr-sintomatico').value = data.pcr_sintomatico || '';
      if (data.pcr_sintomas && Array.isArray(data.pcr_sintomas)) {
        document.querySelectorAll('input[name="pcr-sintomas"]').forEach(cb => {
          cb.checked = data.pcr_sintomas.includes(cb.value);
        });
      }
      if (document.getElementById('pcr-observaciones')) document.getElementById('pcr-observaciones').value = data.pcr_observaciones || '';

      updateIngresarSelectedPills();
      renderIngresarExams();

    } catch (e) {
      console.error('Error al restaurar borrador de paciente:', e);
    }
  }

  // Escuchar cambios en el formulario para auto-guardar borrador
  const formIngreso = document.getElementById('form-ingreso-paciente');
  if (formIngreso) {
    formIngreso.addEventListener('input', saveFormDraft);
    formIngreso.addEventListener('change', saveFormDraft);
  }

  // Restaurar borrador al cargar
  restoreFormDraft();

});
