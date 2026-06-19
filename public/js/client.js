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
        
        <div class="result-card-footer">
          <a href="/uploads/${res.nombre_archivo}" target="_blank" class="btn btn-secondary">
            <i class="fa-solid fa-eye"></i> Ver
          </a>
          <a href="/uploads/${res.nombre_archivo}" download="${res.nombre_archivo}" class="btn btn-primary">
            <i class="fa-solid fa-circle-down"></i> Descargar
          </a>
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

  // Inicializar cargando los resultados
  loadResults();
});
