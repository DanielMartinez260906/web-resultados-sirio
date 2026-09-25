/**
 * LÓGICA DEL PANEL DE ADMINISTRACIÓN - LABORATORIO SIRIO
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Verificar sesión de administrador
  const currentUser = SirioAuth.checkSession('admin');
  if (!currentUser) return;

  // Helper to format credits with thousands separator dots
  function formatCredits(val) {
    const num = val !== undefined && val !== null ? val : 0;
    return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  // Mostrar nombre del administrador en la cabecera
  document.getElementById('admin-name').innerText = currentUser.nombre;
  
  function updateHeaderRoleDisplay(role) {
    const textEl = document.getElementById('admin-role-text');
    const iconEl = document.getElementById('admin-role-icon');
    const displayEl = document.getElementById('admin-role-display');
    
    if (!textEl || !displayEl) return;
    
    const normalizedRole = (role || 'admin').toLowerCase().trim();
    
    if (normalizedRole === 'jefas') {
      textEl.innerText = 'Jefa / Jefe de Laboratorio 👑';
      displayEl.style.color = '#f472b6'; // Pink
      if (iconEl) iconEl.className = 'fa-solid fa-crown';
    } else if (normalizedRole === 'programadores') {
      textEl.innerText = 'Programador del Sistema 💻';
      displayEl.style.color = '#c084fc'; // Purple
      if (iconEl) iconEl.className = 'fa-solid fa-code';
    } else {
      textEl.innerText = 'Personal del Laboratorio';
      displayEl.style.color = 'var(--text-muted)';
      if (iconEl) iconEl.className = 'fa-solid fa-user-shield';
    }
  }

  updateHeaderRoleDisplay(currentUser.rol);

  document.getElementById('logout-btn').addEventListener('click', () => SirioAuth.logout());

  // Lógica del botón de recarga
  const reloadBtn = document.getElementById('reload-btn');
  if (reloadBtn) {
    reloadBtn.addEventListener('click', () => {
      const icon = reloadBtn.querySelector('i');
      if (icon) icon.classList.add('fa-spin');
      setTimeout(() => {
        window.location.reload();
      }, 300);
    });
  }

  // Variables de estado
  let allClients = [];
  let selectedClient = null;
  let selectedFiles = []; // Almacena el listado de archivos seleccionados/arrastrados
  let allResults = []; // Almacena todos los resultados para el historial general
  let isJefasUnlocked = false; // Estado de autorización para pestañas restringidas
  let allStaff = [];
  let selectedStaff = null;
  let selectedDirClient = null;
  let activeDirectory = 'clients'; // 'clients' o 'staff'
  let activeUserIds = [];

  // Heartbeat para registrar nuestra propia presencia como administrador
  function startPresenceHeartbeat(userId, role) {
    if (!userId) return;
    const sendHeartbeat = async () => {
      try {
        await fetch(`${SirioAuth.API_BASE}/api/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_usuario: userId, rol: role || 'admin' })
        });
      } catch (err) {
        console.error('Error enviando presencia admin:', err);
      }
    };
    sendHeartbeat();
    setInterval(sendHeartbeat, 15000); // Cada 15 segundos
  }
  startPresenceHeartbeat(currentUser.id_usuario, currentUser.rol);

  // Polling para traer sesiones activas de la API del servidor
  async function fetchActiveSessions() {
    try {
      const response = await fetch(`${SirioAuth.API_BASE}/api/admin/active-sessions`);
      const data = await response.json();
      if (data.success && data.activeUsers) {
        activeUserIds = data.activeUsers.map(u => u.id_usuario);
        updateActiveIndicators();
      }
    } catch (err) {
      console.error('Error al obtener sesiones activas:', err);
    }
  }

  function updateActiveIndicators() {
    // 1. Tarjetas de clientes y personal en el directorio
    document.querySelectorAll('.client-item').forEach(el => {
      const id = el.getAttribute('data-id');
      const badge = el.querySelector('.active-status-badge');
      if (badge && id) {
        if (activeUserIds.includes(id)) {
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      }
    });

    // 2. Detalle del cliente seleccionado
    const selectedClientBadge = document.getElementById('dir-client-active-badge');
    if (selectedClientBadge) {
      if (selectedDirClient && activeUserIds.includes(selectedDirClient.id_usuario)) {
        selectedClientBadge.style.display = 'inline-block';
      } else {
        selectedClientBadge.style.display = 'none';
      }
    }

    // 3. Detalle del personal seleccionado
    const selectedStaffBadge = document.getElementById('dir-staff-active-badge');
    if (selectedStaffBadge) {
      if (selectedStaff && activeUserIds.includes(selectedStaff.id_usuario)) {
        selectedStaffBadge.style.display = 'inline-block';
      } else {
        selectedStaffBadge.style.display = 'none';
      }
    }
  }

  // Iniciar polling
  fetchActiveSessions();
  setInterval(fetchActiveSessions, 8000); // Cada 8 segundos

  // Elementos del DOM
  const clientsContainer = document.getElementById('clients-container');
  const searchClientInput = document.getElementById('search-client');
  const createClientForm = document.getElementById('create-client-form');
  const generalOverviewView = document.getElementById('general-overview-view');
  const activeClientView = document.getElementById('active-client-view');
  const noClientSelectedView = document.getElementById('no-client-selected-view');
  const allResultsTableBody = document.getElementById('all-results-table-body');
  const totalResultsCount = document.getElementById('total-results-count');
  const searchAllResults = document.getElementById('search-all-results');
  
  // Detalle de Cliente Activo
  const activeClientName = document.getElementById('active-client-name');
  const activeClientIdVal = document.getElementById('active-client-id-val');
  const activeClientUsernameVal = document.getElementById('active-client-username-val');
  const deselectClientBtn = document.getElementById('deselect-client-btn');
  const clientHistoryContainer = document.getElementById('client-history-container');

  // Formulario de Subida
  const uploadResultForm = document.getElementById('upload-result-form');
  const uploadClientIdInput = document.getElementById('upload-client-id');
  const dropzone = document.getElementById('dropzone');
  const pdfInput = document.getElementById('pdf-input');
  const fileListContainer = document.getElementById('file-list-container');

  // Alertas
  const globalAlert = document.getElementById('admin-global-alert');
  const globalAlertText = document.getElementById('admin-global-alert-text');

  // ==========================================================================
  // FUNCIONES AUXILIARES
  // ==========================================================================

  // Helper: obtener URL correcta del PDF (Cloudinary o local legacy)
  function getPdfUrl(nombreArchivo) {
    if (!nombreArchivo) return '';
    if (nombreArchivo.startsWith('http://') || nombreArchivo.startsWith('https://')) {
      return nombreArchivo; // URL completa de Cloudinary
    }
    return `/uploads/${nombreArchivo}`; // Archivo local legacy
  }

  // ==========================================================================
  // FUNCIONES DE API
  // ==========================================================================

  // Cargar lista de clientes
  async function loadClients() {
    try {
      const response = await fetch(`${SirioAuth.API_BASE}/api/admin/clients`);
      const data = await response.json();
      
      if (data.success) {
        allClients = data.clients;
        renderClients(allClients);
        renderDirClients(allClients);
        populateHistoryFilters();
        populateStatsFilters();
        populateAdminClientSelect();
        
        const activeTab = sessionStorage.getItem('sirio_active_tab_admin');
        if (activeTab === 'tab-stats') {
          loadAndRenderStats();
        }
      } else {
        showGlobalAlert(data.message || 'Error al cargar los clientes.', 'error');
      }
    } catch (error) {
      console.error('Error al cargar clientes:', error);
      showGlobalAlert('No se pudo establecer conexion para cargar clientes.', 'error');
    }
  }

  // Cargar historial general de todos los resultados
  async function loadGeneralOverview() {
    allResultsTableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-dark); padding: 2.5rem 0;">
          <i class="fa-solid fa-circle-notch fa-spin" style="margin-bottom: 0.5rem; font-size: 1.2rem; color: var(--color-primary);"></i>
          <p>Cargando historial general...</p>
        </td>
      </tr>
    `;

    try {
      const response = await fetch(`${SirioAuth.API_BASE}/api/admin/results`);
      const data = await response.json();

      if (data.success) {
        allResults = data.results;
        populateHistoryFilters();
        populateStatsFilters();
        renderGeneralOverview(allResults);
        
        const activeTab = sessionStorage.getItem('sirio_active_tab_admin');
        if (activeTab === 'tab-stats') {
          loadAndRenderStats();
        }
      } else {
        allResultsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--error); padding: 1.5rem;">${data.message || 'Error al obtener historial general.'}</td></tr>`;
      }
    } catch (error) {
      console.error('Error al cargar historial general:', error);
      allResultsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--error); padding: 1.5rem;">Error de conexion al cargar historial general.</td></tr>`;
    }
  }

  // Renderizar la tabla de historial general
  function renderGeneralOverview(results) {
    totalResultsCount.innerText = `${results.length} ${results.length === 1 ? 'examen' : 'examenes'}`;
    
    // Resetear checkbox general y ocultar botón de lote
    const selectAllChk = document.getElementById('select-all-results-chk');
    if (selectAllChk) selectAllChk.checked = false;
    const deleteSelectedBtn = document.getElementById('delete-selected-results-btn');
    if (deleteSelectedBtn) deleteSelectedBtn.style.display = 'none';

    if (results.length === 0) {
      allResultsTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 3rem 0;">
            <i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.3;"></i>
            <p>No se han publicado examenes todavia.</p>
          </td>
        </tr>
      `;
      return;
    }

    allResultsTableBody.innerHTML = '';
    results.forEach(res => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border-light)';
      tr.style.transition = 'var(--transition-smooth)';
      
      tr.addEventListener('mouseenter', () => tr.style.background = 'rgba(255, 255, 255, 0.02)');
      tr.addEventListener('mouseleave', () => tr.style.background = 'transparent');
      
      tr.innerHTML = `
          <td style="padding: 12px 16px; text-align: center;">
            <input type="checkbox" class="select-result-chk" data-id="${res.id_resultado}" style="cursor: pointer; width: 16px; height: 16px;">
          </td>
          <td style="padding: 12px 16px; font-weight: 500; color: var(--text-main); max-width: 150px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${res.nombre_cliente}">
            ${res.nombre_cliente}
          </td>
          <td style="padding: 12px 16px; color: var(--text-main); font-weight: 600; max-width: 250px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${res.nombre_examen}">
            <i class="fa-solid fa-file-pdf" style="color: var(--error); margin-right: 6px;"></i> ${res.nombre_examen}
          </td>
          <td style="padding: 12px 16px; color: var(--text-muted); font-size: 0.8rem;">
            ${SirioAuth.formatDate(res.fecha_subida)}
          </td>
          <td style="padding: 12px 16px; color: var(--text-main); max-width: 140px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${res.admin_nombre || res.admin_id || 'Sin dato'}">
            <i class="fa-solid fa-user-shield" style="color: var(--color-primary); margin-right: 5px; font-size: 0.8rem;"></i>
            ${res.admin_nombre || res.admin_id || '<span style="color:var(--text-muted);font-style:italic;">Sin dato</span>'}
          </td>
          <td style="padding: 12px 16px; text-align: center;">
            <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
              <a href="${getPdfUrl(res.nombre_archivo)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-icon" style="padding: 4px 8px;" title="Ver PDF">
                <i class="fa-solid fa-eye" style="font-size: 0.85rem;"></i>
              </a>
              <button class="btn btn-danger btn-icon delete-general-result-btn" data-id="${res.id_resultado}" style="padding: 4px 8px;" title="Eliminar examen">
                <i class="fa-solid fa-trash-can" style="font-size: 0.85rem;"></i>
              </button>
            </div>
          </td>
        `;
      allResultsTableBody.appendChild(tr);
    });
  }

  // Elementos de Filtros Avanzados para Historial General
  const toggleHistoryFiltersBtn = document.getElementById('toggle-history-filters-btn');
  const historyAdvancedFiltersPanel = document.getElementById('history-advanced-filters-panel');
  const historyFilterClient = document.getElementById('history-filter-client');
  const historyFilterExam = document.getElementById('history-filter-exam');
  const historyFilterDateFrom = document.getElementById('history-filter-date-from');
  const historyFilterDateTo = document.getElementById('history-filter-date-to');
  const historyFilterUploader = document.getElementById('history-filter-uploader');
  const historyClearFiltersBtn = document.getElementById('history-clear-filters-btn');

  // Toggle de panel de filtros avanzados
  if (toggleHistoryFiltersBtn && historyAdvancedFiltersPanel) {
    toggleHistoryFiltersBtn.addEventListener('click', () => {
      const isVisible = historyAdvancedFiltersPanel.style.display !== 'none';
      historyAdvancedFiltersPanel.style.display = isVisible ? 'none' : 'grid';
      toggleHistoryFiltersBtn.classList.toggle('btn-primary', !isVisible);
      toggleHistoryFiltersBtn.classList.toggle('btn-secondary', isVisible);
    });
  }

  // Poblar selectores de filtros del historial general
  function populateHistoryFilters() {
    // 1. Selector de Clientes
    if (historyFilterClient) {
      const currentSelected = historyFilterClient.value;
      historyFilterClient.innerHTML = '<option value="">Todos los clientes</option>';
      
      // Obtener lista única ordenada de clientes
      const clientsMap = new Map();
      allClients.forEach(c => clientsMap.set(c.id_usuario, c.nombre));
      allResults.forEach(r => {
        if (r.id_usuario && !clientsMap.has(r.id_usuario)) {
          clientsMap.set(r.id_usuario, r.nombre_cliente || r.id_usuario);
        }
      });

      const sortedClients = Array.from(clientsMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));
      sortedClients.forEach(([id, name]) => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = `${name} (${id})`;
        if (id === currentSelected) opt.selected = true;
        historyFilterClient.appendChild(opt);
      });
    }

    // 2. Selector de Colaboradores / Enviado Por
    if (historyFilterUploader) {
      const currentSelected = historyFilterUploader.value;
      historyFilterUploader.innerHTML = '<option value="">Todos los colaboradores</option>';
      
      const uploadersSet = new Set();
      allResults.forEach(r => {
        const uploader = r.admin_nombre || r.admin_id;
        if (uploader && uploader !== 'Desconocido') {
          uploadersSet.add(uploader.trim());
        }
      });

      Array.from(uploadersSet).sort().forEach(uploader => {
        const opt = document.createElement('option');
        opt.value = uploader;
        opt.textContent = uploader;
        if (uploader === currentSelected) opt.selected = true;
        historyFilterUploader.appendChild(opt);
      });
    }
  }

  // Parsear fecha flexible (ISO o DD/MM/YYYY o DD/MM/YYYY HH:mm o YYYY-MM-DD) a objeto Date seguro
  function parseFlexibleDate(dateStr) {
    if (!dateStr) return null;
    try {
      if (dateStr instanceof Date) {
        return isNaN(dateStr.getTime()) ? null : dateStr;
      }
      const str = String(dateStr).trim();
      if (!str) return null;

      // Caso formato DD/MM/YYYY o DD/MM/YYYY HH:mm
      if (str.includes('/')) {
        const parts = str.split(' ')[0].split('/');
        if (parts.length >= 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          let year = parseInt(parts[2], 10);
          if (year < 100) year += 2000;
          return new Date(year, month, day, 12, 0, 0); // mediodía para evitar saltos UTC
        }
      }

      // Caso formato YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        const parts = str.split('T')[0].split(' ')[0].split('-');
        if (parts.length >= 3) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          return new Date(year, month, day, 12, 0, 0);
        }
      }

      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }

  // Filtrado compuesto para el historial general
  function applyHistoryFilters() {
    const query = searchAllResults ? searchAllResults.value.toLowerCase().trim() : '';
    const selectedClientId = historyFilterClient ? historyFilterClient.value : '';
    const examQuery = historyFilterExam ? historyFilterExam.value.toLowerCase().trim() : '';
    const dateFromStr = historyFilterDateFrom ? historyFilterDateFrom.value : '';
    const dateToStr = historyFilterDateTo ? historyFilterDateTo.value : '';
    const selectedUploader = historyFilterUploader ? historyFilterUploader.value : '';

    const dateFrom = dateFromStr ? new Date(dateFromStr + 'T00:00:00') : null;
    const dateTo = dateToStr ? new Date(dateToStr + 'T23:59:59') : null;

    const filtered = allResults.filter(res => {
      // 1. Buscador global
      if (query) {
        const matchName = (res.nombre_cliente || '').toLowerCase().includes(query);
        const matchExam = (res.nombre_examen || '').toLowerCase().includes(query);
        const matchId = (res.id_usuario || '').toLowerCase().includes(query);
        const matchAdmin = (res.admin_nombre || res.admin_id || '').toLowerCase().includes(query);
        if (!matchName && !matchExam && !matchId && !matchAdmin) return false;
      }

      // 2. Filtro Cliente
      if (selectedClientId && res.id_usuario !== selectedClientId) {
        return false;
      }

      // 3. Filtro Examen / PDF
      if (examQuery) {
        const examName = (res.nombre_examen || '').toLowerCase();
        const fileName = (res.nombre_archivo || '').toLowerCase();
        if (!examName.includes(examQuery) && !fileName.includes(examQuery)) {
          return false;
        }
      }

      // 4. Filtro Enviado por
      if (selectedUploader) {
        const uploader = (res.admin_nombre || res.admin_id || '').trim();
        if (uploader !== selectedUploader) {
          return false;
        }
      }

      // 5. Filtro de Fechas
      if (dateFrom || dateTo) {
        const resDate = parseFlexibleDate(res.fecha_subida);
        if (resDate) {
          if (dateFrom && resDate < dateFrom) return false;
          if (dateTo && resDate > dateTo) return false;
        }
      }

      return true;
    });

    renderGeneralOverview(filtered);
  }

  // Event Listeners de los filtros de Historial
  if (searchAllResults) searchAllResults.addEventListener('input', applyHistoryFilters);
  if (historyFilterClient) historyFilterClient.addEventListener('change', applyHistoryFilters);
  if (historyFilterExam) historyFilterExam.addEventListener('input', applyHistoryFilters);
  if (historyFilterDateFrom) historyFilterDateFrom.addEventListener('change', applyHistoryFilters);
  if (historyFilterDateTo) historyFilterDateTo.addEventListener('change', applyHistoryFilters);
  if (historyFilterUploader) historyFilterUploader.addEventListener('change', applyHistoryFilters);

  if (historyClearFiltersBtn) {
    historyClearFiltersBtn.addEventListener('click', () => {
      if (searchAllResults) searchAllResults.value = '';
      if (historyFilterClient) historyFilterClient.value = '';
      if (historyFilterExam) historyFilterExam.value = '';
      if (historyFilterDateFrom) historyFilterDateFrom.value = '';
      if (historyFilterDateTo) historyFilterDateTo.value = '';
      if (historyFilterUploader) historyFilterUploader.value = '';
      applyHistoryFilters();
    });
  }

  // Delegacion de eventos para eliminar desde la tabla general
  allResultsTableBody.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.delete-general-result-btn');
    if (!deleteBtn) return;
    
    const idResultado = deleteBtn.dataset.id;
    if (!idResultado) return;
    
    const confirmDelete = confirm('¿Esta seguro de que desea eliminar este resultado? Se borrara de la base de datos y se eliminara el archivo PDF permanentemente.');
    if (!confirmDelete) return;
    
    SirioAuth.showLoading('Eliminando examen...');
    
    try {
      const response = await fetch(`${SirioAuth.API_BASE}/api/admin/delete-result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id_resultado: idResultado })
      });
      
      const result = await response.json();
      SirioAuth.hideLoading();
      
      if (result.success) {
        showGlobalAlert('Examen eliminado correctamente del portal.', 'success');
        loadGeneralOverview(); // Recargar el resumen general
      } else {
        showGlobalAlert(result.message || 'Error al eliminar el examen.', 'error');
      }
    } catch (error) {
      SirioAuth.hideLoading();
      console.error('Error al eliminar resultado:', error);
      showGlobalAlert('Error de red al intentar eliminar el examen.', 'error');
    }
  });

  // Cargar historial de exámenes del cliente activo
  async function loadClientHistory(clientId) {
    clientHistoryContainer.innerHTML = `
      <div style="text-align: center; color: var(--text-dark); padding: 1.5rem 0;">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
        <p>Cargando historial...</p>
      </div>
    `;

    try {
      const response = await fetch(`${SirioAuth.API_BASE}/api/client/results?id_usuario=${clientId}`);
      const data = await response.json();

      if (data.success) {
        renderHistory(data.results);
      } else {
        clientHistoryContainer.innerHTML = `<p style="color: var(--error); text-align: center; padding: 1rem;">${data.message || 'Error al obtener historial.'}</p>`;
      }
    } catch (error) {
      console.error('Error al cargar historial:', error);
      clientHistoryContainer.innerHTML = '<p style="color: var(--error); text-align: center; padding: 1rem;">Error de conexion al cargar historial.</p>';
    }
  }

  // ==========================================================================
  // RENDERIZADO DE ELEMENTOS
  // ==========================================================================

  // Renderizar la lista de clientes
  function renderClients(clients) {
    if (clients.length === 0) {
      clientsContainer.innerHTML = '<p style="text-align: center; color: var(--text-dark); padding: 2rem 0;">No se encontraron clientes.</p>';
      return;
    }

    clientsContainer.innerHTML = '';
    clients.forEach(client => {
      const div = document.createElement('div');
      div.className = `client-item ${selectedClient && selectedClient.id_usuario === client.id_usuario ? 'active' : ''}`;
      div.dataset.id = client.id_usuario;
      
      div.innerHTML = `
        <div class="client-item-info" style="flex-grow: 1; min-width: 0; padding-right: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <h4 style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap; margin: 0;">${client.nombre}</h4>
            ${client.moroso ? '<span style="background: rgba(239, 68, 68, 0.15); color: #f87171; font-size: 0.6rem; padding: 1px 5px; border-radius: 3px; font-weight: 700; border: 1px solid rgba(239, 68, 68, 0.2); text-transform: uppercase; flex-shrink: 0;">MOROSO</span>' : ''}
          </div>
          <p style="margin-top: 4px;"><i class="fa-solid fa-id-card"></i> ID/NIT: ${client.identificacion}</p>
        </div>
        <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
          <span class="client-item-badge">${client.id_usuario}</span>
        </div>
      `;
      
      div.addEventListener('click', () => selectClient(client));
      clientsContainer.appendChild(div);
    });
  }

  // Renderizar el historial de exámenes en tarjetas compactas
  function renderHistory(results) {
    if (results.length === 0) {
      clientHistoryContainer.innerHTML = '<p style="text-align: center; color: var(--text-dark); padding: 1.5rem 0;">No hay examenes publicados para este cliente.</p>';
      return;
    }

    clientHistoryContainer.innerHTML = '';
    results.forEach(res => {
      const div = document.createElement('div');
      div.className = 'client-item';
      div.style.cursor = 'default';
      div.style.borderLeft = '3px solid var(--color-accent)';
      
      div.innerHTML = `
        <div class="client-item-info" style="flex-grow: 1; min-width: 0; padding-right: 10px;">
          <h4 style="font-size: 0.95rem; font-weight: 600; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${res.nombre_examen}">
            <i class="fa-solid fa-file-pdf" style="color: var(--error); margin-right: 6px;"></i> ${res.nombre_examen}
          </h4>
          <p style="font-size: 0.75rem; margin-top: 4px; color: var(--text-dark);">
            <i class="fa-solid fa-calendar"></i> ${SirioAuth.formatDate(res.fecha_subida)} 
          </p>
        </div>
        <div style="display: flex; gap: 6px; align-items: center; flex-shrink: 0;">
          <a href="${getPdfUrl(res.nombre_archivo)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-icon" style="padding: 6px 10px;" title="Ver PDF">
            <i class="fa-solid fa-eye" style="font-size: 0.95rem;"></i>
          </a>
          <button class="btn btn-danger btn-icon delete-result-btn" data-id="${res.id_resultado}" style="padding: 6px 10px;" title="Eliminar examen">
            <i class="fa-solid fa-trash-can" style="font-size: 0.95rem;"></i>
          </button>
        </div>
      `;
      clientHistoryContainer.appendChild(div);
    });
  }

  // ==========================================================================
  // CONTROLADORES DE ACCIONES
  // ==========================================================================

  // Seleccionar cliente
  function selectClient(client) {
    selectedClient = client;
    
    // Marcar como activo en la lista
    document.querySelectorAll('.client-item').forEach(item => {
      if (item.dataset.id === client.id_usuario) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Mostrar panel
    if (noClientSelectedView) noClientSelectedView.style.display = 'none';
    activeClientView.style.display = 'block';

    // Mostrar alerta informativa si el cliente es moroso (no ocultar el formulario)
    const debtWarning = document.getElementById('active-client-debt-warning');
    if (debtWarning) {
      debtWarning.style.display = client.moroso ? 'block' : 'none';
    }

    // Cambiar a la pestaña de enviar resultados si no estamos allí
    switchTab('tab-send');

    // Rellenar cabecera e input oculto
    activeClientName.innerText = client.nombre;
    activeClientIdVal.innerText = client.identificacion;
    activeClientUsernameVal.innerText = client.usuario;
    uploadClientIdInput.value = client.id_usuario;

    // Resetear formulario de subida anterior
    resetUploadForm();

    // Cargar historial
    loadClientHistory(client.id_usuario);
  }

  // Deseleccionar cliente
  function deselectClient() {
    selectedClient = null;
    document.querySelectorAll('.client-item').forEach(item => item.classList.remove('active'));
    activeClientView.style.display = 'none';
    if (noClientSelectedView) noClientSelectedView.style.display = 'flex';
    resetUploadForm();
    loadGeneralOverview(); // Recargar el historial general
  }

  deselectClientBtn.addEventListener('click', deselectClient);

  // Filtrar clientes en el buscador
  searchClientInput.addEventListener('keyup', () => {
    const query = searchClientInput.value.toLowerCase().trim();
    const filtered = allClients.filter(c => 
      c.nombre.toLowerCase().includes(query) || 
      c.identificacion.toString().includes(query) ||
      c.id_usuario.toLowerCase().includes(query)
    );
    renderClients(filtered);
  });

  // ==========================================================================
  // SELECTOR DE ROL EN EL FORMULARIO DE REGISTRO
  // ==========================================================================
  let registroRol = 'cliente'; // Estado actual del selector

  const regRoleClientBtn = document.getElementById('reg-role-client-btn');
  const regRoleAdminBtn  = document.getElementById('reg-role-admin-btn');
  const regFormTitle     = document.getElementById('reg-form-title');
  const regFormSubtitle  = document.getElementById('reg-form-subtitle');
  const regLabelName     = document.getElementById('reg-label-name');
  const regLabelUsername = document.getElementById('reg-label-username');
  const regSubmitBtn     = document.getElementById('reg-submit-btn');
  const regClientFields  = document.getElementById('reg-client-only-fields');
  const newClientId      = document.getElementById('new-client-id');

  function setRegistroRol(rol) {
    registroRol = rol;

    const isAdmin = rol === 'admin';

    // Visual del toggle
    const activeStyle  = `background: ${isAdmin ? 'var(--color-accent)' : 'var(--color-primary)'}; color: #fff;`;
    const inactiveStyle = 'background: transparent; color: var(--text-muted);';
    if (regRoleClientBtn) regRoleClientBtn.style.cssText = regRoleClientBtn.style.cssText.replace(/background:[^;]+;|color:[^;]+;/g, '') + (isAdmin ? inactiveStyle : activeStyle.split('; ').map(s => s).join('; '));
    if (regRoleAdminBtn)  regRoleAdminBtn.style.cssText  = regRoleAdminBtn.style.cssText.replace(/background:[^;]+;|color:[^;]+;/g, '')  + (isAdmin ? activeStyle.split('; ').map(s => s).join('; ') : inactiveStyle);

    // Reseteamos estilo inline con enfoque más limpio
    if (regRoleClientBtn) {
      regRoleClientBtn.style.background = isAdmin ? 'transparent' : 'var(--color-primary)';
      regRoleClientBtn.style.color      = isAdmin ? 'var(--text-muted)' : '#fff';
    }
    if (regRoleAdminBtn) {
      regRoleAdminBtn.style.background  = isAdmin ? 'var(--color-accent)' : 'transparent';
      regRoleAdminBtn.style.color       = isAdmin ? '#fff' : 'var(--text-muted)';
    }

    // Título y subtítulo
    if (regFormTitle) {
      regFormTitle.innerHTML = isAdmin
        ? '<i class="fa-solid fa-user-shield"></i> Registrar Administrador'
        : '<i class="fa-solid fa-user-plus"></i> Registrar Cliente';
    }
    if (regFormSubtitle) {
      regFormSubtitle.textContent = isAdmin
        ? 'Personal del laboratorio con acceso completo al panel de administración.'
        : 'Clínicas, veterinarios o propietarios que verán los exámenes.';
    }
    if (regLabelName) {
      regLabelName.textContent = isAdmin ? 'Nombre Completo' : 'Nombre / Razón Social';
    }
    if (regLabelUsername) {
      regLabelUsername.textContent = isAdmin ? 'Usuario de Acceso del Administrador' : 'Usuario de Acceso';
    }

    // Mostrar / ocultar campos exclusivos de cliente
    if (regClientFields) {
      regClientFields.style.display = isAdmin ? 'none' : 'block';
    }
    // Quitar required de identificación en modo admin
    if (newClientId) {
      newClientId.required = !isAdmin;
    }

    // Botón de envío
    if (regSubmitBtn) {
      regSubmitBtn.innerHTML = isAdmin
        ? '<i class="fa-solid fa-user-shield"></i> Registrar Administrador'
        : '<i class="fa-solid fa-user-check"></i> Registrar Cliente';
      regSubmitBtn.style.background = isAdmin ? 'var(--color-accent)' : '';
      regSubmitBtn.className = isAdmin ? 'btn btn-accent' : 'btn btn-accent';
    }
  }

  if (regRoleClientBtn) regRoleClientBtn.addEventListener('click', () => setRegistroRol('cliente'));
  if (regRoleAdminBtn)  regRoleAdminBtn.addEventListener('click',  () => setRegistroRol('admin'));

  // Inicializar en modo cliente
  setRegistroRol('cliente');

  // Registrar nuevo usuario (cliente o administrador)
  createClientForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre        = document.getElementById('new-client-name').value.trim();
    const identificacion = document.getElementById('new-client-id').value.trim();
    const direccion     = document.getElementById('new-client-address').value.trim();
    const correo        = document.getElementById('new-client-email').value.trim();
    const telefono      = document.getElementById('new-client-phone').value.trim();
    const usuario       = document.getElementById('new-client-username').value.trim();
    const contrasena    = document.getElementById('new-client-password').value;
    const rol           = registroRol;

    const loadingMsg = rol === 'admin' ? 'Creando cuenta de administrador...' : 'Creando cuenta de cliente...';
    SirioAuth.showLoading(loadingMsg);

    try {
      const response = await fetch(`${SirioAuth.API_BASE}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, identificacion, usuario, contrasena, direccion, correo, telefono, rol })
      });

      const result = await response.json();
      SirioAuth.hideLoading();

      if (result.success) {
        showGlobalAlert(result.message, 'success');
        createClientForm.reset();
        document.getElementById('pwd-char-count').textContent = '0/15';
        // Restaurar rol a cliente tras registro exitoso
        setRegistroRol('cliente');

        if (rol === 'cliente') {
          // Recargar lista y seleccionar el nuevo cliente
          await loadClients();
          const clientId = result.client ? result.client.id_usuario : null;
          if (clientId) {
            const newClient = allClients.find(c => c.id_usuario === clientId);
            if (newClient) selectClient(newClient);
          }
        } else {
          // Para admin solo recargamos la lista de clientes (no navegar)
          await loadClients();
        }
      } else {
        showGlobalAlert(result.message || 'Error al registrar el usuario.', 'error');
      }
    } catch (error) {
      SirioAuth.hideLoading();
      console.error('Error al registrar usuario:', error);
      showGlobalAlert('Error de red al intentar registrar al usuario.', 'error');
    }
  });

  // Eliminar un cliente de manera definitiva (ejecución tras confirmar en modal)
  async function executeDeleteClient(client) {
    SirioAuth.showLoading(`Eliminando al cliente ${client.nombre}...`);

    try {
      const response = await fetch(`${SirioAuth.API_BASE}/api/admin/delete-client`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id_usuario: client.id_usuario })
      });

      const result = await response.json();
      SirioAuth.hideLoading();

      if (result.success) {
        showGlobalAlert(result.message || 'Cliente y sus exámenes asociados eliminados correctamente.', 'success');
        
        // Deseleccionar en el directorio si corresponde
        if (selectedDirClient && selectedDirClient.id_usuario === client.id_usuario) {
          selectedDirClient = null;
          if (dirClientDetailView) dirClientDetailView.style.display = 'none';
          if (dirNoClientSelected) dirNoClientSelected.style.display = 'flex';
        }

        // Si el cliente eliminado es el que está seleccionado actualmente, deseleccionarlo
        if (selectedClient && selectedClient.id_usuario === client.id_usuario) {
          deselectClient();
        } else {
          // Si no estaba seleccionado, igual recargamos historial general
          loadGeneralOverview();
        }
        
        // Recargar la lista de clientes
        await loadClients();

        // Renderizar lista filtrada del directorio
        const query = searchDirClientInput ? searchDirClientInput.value.toLowerCase().trim() : '';
        const filtered = allClients.filter(c => 
          c.nombre.toLowerCase().includes(query) || 
          c.identificacion.toString().includes(query) ||
          c.id_usuario.toLowerCase().includes(query)
        );
        renderDirClients(filtered);
      } else {
        showGlobalAlert(result.message || 'Error al eliminar el cliente.', 'error');
      }
    } catch (error) {
      SirioAuth.hideLoading();
      console.error('Error al eliminar cliente:', error);
      showGlobalAlert('Error de red al intentar eliminar al cliente.', 'error');
    }
  }

  // ==========================================================================
  // DRAG & DROP Y SELECCIÓN DE ARCHIVOS MÚLTIPLES
  // ==========================================================================

  // Forzar click en input file
  dropzone.addEventListener('click', () => {
    pdfInput.click();
  });

  // Cambiar color en dragover
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  // Dropear archivos
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  });

  // Selección tradicional
  pdfInput.addEventListener('change', () => {
    if (pdfInput.files.length > 0) {
      handleFilesSelected(pdfInput.files);
    }
  });

  // Procesar archivos seleccionados (añadiéndolos al listado actual)
  function handleFilesSelected(filesList) {
    let addedCount = 0;
    
    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      
      // Validar tipo de archivo
      if (file.type !== 'application/pdf') {
        showGlobalAlert(`El archivo "${file.name}" no es un PDF y fue descartado.`, 'error');
        continue;
      }
      
      // Validar tamaño máximo (10MB)
      if (file.size > 10 * 1024 * 1024) {
        showGlobalAlert(`El archivo "${file.name}" supera el limite de 10MB y fue descartado.`, 'error');
        continue;
      }
      
      // Evitar duplicados por nombre
      if (selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
        continue;
      }
      
      selectedFiles.push(file);
      addedCount++;
    }

    if (addedCount > 0) {
      renderSelectedFiles();
    }
  }

  // Renderizar la lista de archivos seleccionados
  function renderSelectedFiles() {
    if (selectedFiles.length === 0) {
      fileListContainer.style.display = 'none';
      dropzone.style.display = 'flex';
      pdfInput.value = '';
      return;
    }

    dropzone.style.display = 'none';
    fileListContainer.innerHTML = '';
    fileListContainer.style.display = 'flex';

    selectedFiles.forEach((file, index) => {
      const div = document.createElement('div');
      div.className = 'file-selected-info';
      div.style.marginBottom = '0'; // Eliminar margen extra
      
      div.innerHTML = `
        <span class="file-selected-name" style="word-break: break-all; min-width: 0; flex-grow: 1; padding-right: 10px;">
          <i class="fa-solid fa-file-pdf" style="color: var(--error);"></i>
          <span>${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
        </span>
        <button type="button" class="file-remove-btn" data-index="${index}">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      `;
      
      // Eliminar este archivo individualmente al hacer clic en su papelera
      div.querySelector('.file-remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        selectedFiles.splice(index, 1);
        renderSelectedFiles();
      });
      
      fileListContainer.appendChild(div);
    });

    // Agregar un botón inferior para añadir más archivos
    const addMoreDiv = document.createElement('div');
    addMoreDiv.style.textAlign = 'center';
    addMoreDiv.style.marginTop = '10px';
    addMoreDiv.innerHTML = `
      <button type="button" class="btn btn-secondary" style="padding: 6px 14px; font-size: 0.85rem;" id="add-more-files-btn">
        <i class="fa-solid fa-plus"></i> Anadir mas PDFs
      </button>
    `;
    addMoreDiv.querySelector('#add-more-files-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      pdfInput.click();
    });
    
    fileListContainer.appendChild(addMoreDiv);
  }

  function resetUploadForm() {
    selectedFiles = [];
    renderSelectedFiles();
  }

  // ==========================================================================
  // PUBLICAR EXÁMENES (Subir PDFs en lote)
  // ==========================================================================

  uploadResultForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!selectedClient) {
      showGlobalAlert('Por favor, selecciona un cliente primero.', 'error');
      return;
    }

    if (selectedFiles.length === 0) {
      showGlobalAlert('Por favor, selecciona o arrastra al menos un archivo PDF con los resultados.', 'error');
      return;
    }

    const id_usuario = uploadClientIdInput.value;

    // Crear FormData
    const formData = new FormData();
    formData.append('id_usuario', id_usuario);
    formData.append('admin_id', currentUser.id_usuario);
    formData.append('admin_nombre', currentUser.nombre);
    
    // Adjuntar todos los archivos seleccionados bajo la clave 'pdf'
    selectedFiles.forEach(file => {
      formData.append('pdf', file);
    });

    SirioAuth.showLoading(`Publicando ${selectedFiles.length} examenes...`);

    try {
      const response = await fetch(`${SirioAuth.API_BASE}/api/admin/upload`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      SirioAuth.hideLoading();

      if (result.success) {
        showGlobalAlert(result.message, 'success');
        resetUploadForm();
        
        // Recargar historial del cliente activo
        loadClientHistory(id_usuario);
      } else {
        showGlobalAlert(result.message || 'Error al subir los resultados.', 'error');
      }
    } catch (error) {
      SirioAuth.hideLoading();
      console.error('Error al publicar exámenes:', error);
      showGlobalAlert('Error de conexion al subir los archivos PDF al servidor.', 'error');
    }
  });

  // ==========================================================================
  // DELEGACIÓN DE EVENTOS PARA ELIMINAR EXÁMENES
  // ==========================================================================
  clientHistoryContainer.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.delete-result-btn');
    if (!deleteBtn) return;
    
    const idResultado = deleteBtn.dataset.id;
    if (!idResultado) return;
    
    const confirmDelete = confirm('¿Esta seguro de que desea eliminar este resultado? Se borrara de la base de datos de Google Sheets y se eliminara el archivo PDF permanentemente.');
    if (!confirmDelete) return;
    
    SirioAuth.showLoading('Eliminando examen del portal...');
    
    try {
      const response = await fetch(`${SirioAuth.API_BASE}/api/admin/delete-result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id_resultado: idResultado })
      });
      
      const result = await response.json();
      SirioAuth.hideLoading();
      
      if (result.success) {
        showGlobalAlert('Examen eliminado correctamente del portal.', 'success');
        // Recargar historial del cliente activo
        if (selectedClient) {
          loadClientHistory(selectedClient.id_usuario);
        }
      } else {
        showGlobalAlert(result.message || 'Error al eliminar el examen.', 'error');
      }
    } catch (error) {
      SirioAuth.hideLoading();
      console.error('Error al eliminar resultado:', error);
      showGlobalAlert('Error de red al intentar eliminar el examen.', 'error');
    }
  });

  // ==========================================================================
  // HELPER ALERTS
  // ==========================================================================

  function showGlobalAlert(message, type = 'info') {
    globalAlert.className = `alert alert-${type}`;
    globalAlertText.innerText = message;
    
    const icon = globalAlert.querySelector('i');
    if (type === 'error') {
      icon.className = 'fa-solid fa-triangle-exclamation';
    } else if (type === 'success') {
      icon.className = 'fa-solid fa-circle-check';
    } else {
      icon.className = 'fa-solid fa-circle-info';
    }

    globalAlert.style.display = 'flex';
    
    setTimeout(() => {
      globalAlert.style.display = 'none';
    }, 5000);
  }

  // Contador de caracteres para contraseña de cliente
  const pwdInput    = document.getElementById('new-client-password');
  const pwdCounter  = document.getElementById('pwd-char-count');
  pwdInput.addEventListener('input', () => {
    const len = pwdInput.value.length;
    pwdCounter.textContent = len + '/15';
    pwdCounter.style.color = len >= 13 ? 'var(--error)' : len >= 10 ? '#f59e0b' : 'var(--text-muted)';
  });

  // ==========================================================================
  // LÓGICA DE ELIMINAR TODOS LOS EXÁMENES (ZONA DE PELIGRO)
  // ==========================================================================
  const securityPhrases = [
    'ELIMINAR TODO MI HISTORIAL',
    'BORRAR EXAMENES COMPLETAMENTE',
    'CONFIRMAR VACIADO ABSOLUTO',
    'BORRADO DE ALTA SEGURIDAD',
    'AUTORIZAR DESTRUCCION DE PDFS',
    'ELIMINAR BASE DE DATOS',
    'VACIAR PORTAL DE EXAMENES',
    'BORRADO TOTAL DEFINITIVO',
    'CONFIRMO ELIMINACION ABSOLUTA',
    'ELIMINAR EXAMENES PERMANENTEMENTE',
    'DESTRUIR REGISTROS DE PACIENTES',
    'ELIMINAR HISTORIAL GENERAL',
    'LIMPIEZA DE SERVIDOR COMPLETADA',
    'VACIAR HISTORIAL DE CLIENTES',
    'RESETEAR SISTEMA DE ARCHIVOS',
    'ELIMINAR TODOS LOS PDFS',
    'CONFIRMAR BORRADO DE EXAMENES',
    'AUTORIZAR LIMPIEZA ABSOLUTA',
    'PROCEDER CON EL VACIADO',
    'ELIMINAR EXAMENES DEL PORTAL',
    'ELIMINAR TODOS LOS DATOS',
    'BORRAR TODO SIN MARCHA ATRAS',
    'DESTRUIR DATOS DEL SERVIDOR',
    'VALIDAR ELIMINACION GENERAL',
    'CONFIRMAR DESTRUCCION TOTAL',
    'VACIADO COMPLETO DEL PORTAL',
    'ELIMINACION TOTAL SIN RETORNO',
    'DESINTEGRAR BASE DE DATOS',
    'ELIMINAR EXAMENES ANTERIORES',
    'CONFIRMAR PURGA COMPLETA',
    'ELIMINACION DE DATOS CONFIRMADA',
    'BORRAR ARCHIVOS DE EXAMENES',
    'AUTORIZAR DESTRUCCION MASIVA',
    'LIMPIAR HISTORIAL DE PACIENTES',
    'RESETEAR ARCHIVOS PDFS',
    'EJECUTAR FORMATEO DE TABLA',
    'ELIMINAR REGISTROS GENERALES',
    'APLICAR BORRADO SEGURO',
    'DESTRUCCION DEFINITIVA DE DATOS',
    'PURGAR EXAMENES DE LA NUBE',
    'ELIMINACION MASIVA AUTORIZADA',
    'CONFIRMAR RESETEO COMPLETO',
    'BORRAR BASE DE DATOS DE EXAMENES',
    'DESTRUCCION DE ARCHIVOS CONFIRMADA',
    'VACIAR TODOS LOS CLIENTES',
    'LIMPIEZA TOTAL DEL PORTAL',
    'BORRADO TOTAL SIN CONTEMPLACION',
    'CONFIRMO ACCION IRREVERSIBLE',
    'AUTORIZAR REINICIO GENERAL',
    'BORRAR REGISTROS DEL SERVIDOR',
    'LIMPIAR BASE DE DATOS MOCK',
    'ELIMINAR PDFS DEL SERVIDOR',
    'CONFIRMO PERDIDA DE PDFS',
    'CONFIRMO BORRADO SHEET',
    'BORRAR TODO EL PORTAL',
    'VACIADO DEFINITIVO DE EXAMENES',
    'CONFIRMAR DESTRUCCION DE EXAMENES',
    'AUTORIZAR VACIADO TOTAL',
    'ELIMINAR TODAS LAS HOJAS',
    'ELIMINACION RAPIDA DE PDFS',
    'EJECUTAR LIMPIEZA TOTAL',
    'ELIMINAR EXAMENES HISTORICOS',
    'BORRADO EXTREMO AUTORIZADO',
    'ELIMINAR TODOS LOS HISTORIALES',
    'CONFIRMAR BORRADO ABSOLUTO',
    'BORRAR EXAMENES AHORA',
    'ELIMINAR ABSOLUTAMENTE TODO',
    'VACIADO DE SEGURIDAD EXTREMA',
    'DESTRUCCION DE HISTORIAL GENERAL',
    'BORRAR TODOS LOS DOCUMENTOS',
    'CONFIRMAR BORRADO PERMANENTE',
    'ELIMINACION DE EXAMENES COMPLETA',
    'LIMPIAR CARPETA UPLOADS',
    'DESHACERSE DE TODOS LOS PDFS',
    'COMPLEMENTAR BORRADO DEFINITIVO'
  ];

  let currentSecurityPhrase = '';
  const deleteAllModal = document.getElementById('delete-all-modal');
  const phraseDisplay = document.getElementById('security-phrase-display');
  const phraseInput = document.getElementById('security-phrase-input');
  const checkConfirm1 = document.getElementById('check-confirm-1');
  const checkConfirm2 = document.getElementById('check-confirm-2');
  const confirmBtn = document.getElementById('confirm-delete-all-btn');

  function generateSecurityPhrase() {
    const randomIndex = Math.floor(Math.random() * securityPhrases.length);
    currentSecurityPhrase = securityPhrases[randomIndex];
    phraseDisplay.textContent = currentSecurityPhrase;
    phraseInput.value = '';
    checkConfirm1.checked = false;
    checkConfirm2.checked = false;
    updateDeleteAllButtonState();
  }

  function updateDeleteAllButtonState() {
    const check1 = checkConfirm1.checked;
    const check2 = checkConfirm2.checked;
    const textInput = phraseInput.value.trim().toUpperCase();
    
    if (check1 && check2 && textInput === currentSecurityPhrase) {
      confirmBtn.disabled = false;
    } else {
      confirmBtn.disabled = true;
    }
  }

  // Escuchar cambios
  checkConfirm1.addEventListener('change', updateDeleteAllButtonState);
  checkConfirm2.addEventListener('change', updateDeleteAllButtonState);
  phraseInput.addEventListener('input', updateDeleteAllButtonState);

  // Bloquear copiar/pegar y arrastrar en la frase de confirmación
  phraseInput.addEventListener('paste', (e) => {
    e.preventDefault();
    showGlobalAlert('No se permite pegar el texto. Debe escribirlo carácter por carácter.', 'error');
  });

  phraseInput.addEventListener('drop', (e) => {
    e.preventDefault();
    showGlobalAlert('No se permite arrastrar texto. Debe escribirlo carácter por carácter.', 'error');
  });

  // Abrir Modal
  document.getElementById('delete-all-btn').addEventListener('click', () => {
    deleteAllModal.style.display = 'flex';
    generateSecurityPhrase();
  });

  // Cerrar Modal
  function closeDeleteAllModal() {
    deleteAllModal.style.display = 'none';
  }

  document.getElementById('close-delete-all-modal').addEventListener('click', closeDeleteAllModal);
  document.getElementById('cancel-delete-all-btn').addEventListener('click', closeDeleteAllModal);

  // Enviar Petición
  confirmBtn.addEventListener('click', async () => {
    closeDeleteAllModal();
    SirioAuth.showLoading('Eliminando todos los exámenes...');

    try {
      const response = await fetch(`${SirioAuth.API_BASE}/api/admin/delete-all-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      SirioAuth.hideLoading();

      if (result.success) {
        showGlobalAlert(result.message || 'Todos los exámenes fueron eliminados correctamente.', 'success');
        
        // Si hay un cliente activo seleccionado, lo deseleccionamos
        if (selectedClient) {
          deselectClient();
        } else {
          loadGeneralOverview();
        }
      } else {
        showGlobalAlert(result.message || 'Error al eliminar todos los exámenes.', 'error');
      }
    } catch (error) {
      SirioAuth.hideLoading();
      console.error('Error al vaciar los exámenes:', error);
      showGlobalAlert('Error de red al intentar eliminar todos los exámenes.', 'error');
    }
  });

  // Cambiar pestaña activa programáticamente
  function switchTab(tabId) {
    const tabButton = document.querySelector(`.nav-tab[data-tab="${tabId}"]`);
    if (tabButton) {
      if (!tabButton.classList.contains('active')) {
        tabButton.click();
      }
    }
  }

  // Lógica de cambio de pestañas (Tabs)
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');

  navTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      const targetTab = tab.dataset.tab;

      // Interceptar si es de configuración o portafolio y está bloqueado
      const hasSpecialAccess = currentUser && (currentUser.rol === 'jefas' || currentUser.rol === 'programadores');
      if ((targetTab === 'tab-config' || targetTab === 'tab-portafolio-admin') && !isJefasUnlocked && !hasSpecialAccess) {
        e.preventDefault();
        e.stopPropagation();
        openJefasPasswordModal(targetTab);
        return;
      }

      // Interceptar pestaña de estadísticas
      if (targetTab === 'tab-stats' && !hasSpecialAccess) {
        e.preventDefault();
        e.stopPropagation();
        showGlobalAlert('Acceso denegado: Se requieren permisos de Jefa/Jefe o Programador.', 'error');
        return;
      }

      // Quitar clase activa de todas las pestañas y agregar al actual
      navTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Mostrar el contenido de la pestaña destino y ocultar los demás
      tabContents.forEach(content => {
        if (content.id === targetTab) {
          content.style.display = 'block';
        } else {
          content.style.display = 'none';
        }
      });

      if (targetTab === 'tab-stats') {
        loadAndRenderStats();
      }

      // Guardar pestaña activa
      sessionStorage.setItem('sirio_active_tab_admin', targetTab);

      // Al cambiar de pestaña, asegurar el estado correcto de "Enviar Resultados"
      if (targetTab === 'tab-send') {
        if (selectedClient) {
          activeClientView.style.display = 'block';
          if (noClientSelectedView) noClientSelectedView.style.display = 'none';
        } else {
          activeClientView.style.display = 'none';
          if (noClientSelectedView) noClientSelectedView.style.display = 'flex';
        }
      }

      if (targetTab === 'tab-clients') {
        const dirToggleClientsBtn = document.getElementById('dir-toggle-clients-btn');
        if (dirToggleClientsBtn) {
          dirToggleClientsBtn.click();
        } else {
          renderDirClients(allClients);
          selectedDirClient = null;
          if (dirClientDetailView) dirClientDetailView.style.display = 'none';
          if (dirNoClientSelected) dirNoClientSelected.style.display = 'flex';
        }
      }

      if (targetTab === 'tab-config') {
        loadSystemConfig();
      }

      if (targetTab === 'tab-soporte') {
        loadSupportTickets();
      }
    });
  });

  // ── CONTROL DE ACCESO RESTRINGIDO JEFAS ────────────────────
  const jefasPasswordModal = document.getElementById('jefas-password-modal');
  const jefasPasswordInput = document.getElementById('jefas-password-input');
  const toggleJefasPwdVisibility = document.getElementById('toggle-jefas-pwd-visibility');
  const jefasPasswordError = document.getElementById('jefas-password-error');
  const cancelJefasPasswordBtn = document.getElementById('cancel-jefas-password-btn');
  const confirmJefasPasswordBtn = document.getElementById('confirm-jefas-password-btn');
  let pendingTabId = null;

  function openJefasPasswordModal(targetTab) {
    pendingTabId = targetTab;
    if (jefasPasswordInput) {
      jefasPasswordInput.value = '';
      jefasPasswordInput.setAttribute('type', 'password');
    }
    const icon = toggleJefasPwdVisibility ? toggleJefasPwdVisibility.querySelector('i') : null;
    if (icon) icon.className = 'fa-solid fa-eye';
    if (jefasPasswordError) jefasPasswordError.style.display = 'none';
    if (jefasPasswordModal) jefasPasswordModal.style.display = 'flex';
    setTimeout(() => { if (jefasPasswordInput) jefasPasswordInput.focus(); }, 100);
  }

  function closeJefasPasswordModal() {
    if (jefasPasswordModal) jefasPasswordModal.style.display = 'none';
    pendingTabId = null;
  }

  if (toggleJefasPwdVisibility) {
    toggleJefasPwdVisibility.addEventListener('click', () => {
      const type = jefasPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      jefasPasswordInput.setAttribute('type', type);
      const icon = toggleJefasPwdVisibility.querySelector('i');
      if (type === 'password') {
        icon.className = 'fa-solid fa-eye';
      } else {
        icon.className = 'fa-solid fa-eye-slash';
      }
    });
  }

  if (cancelJefasPasswordBtn) {
    cancelJefasPasswordBtn.addEventListener('click', () => {
      closeJefasPasswordModal();
    });
  }

  async function verifyJefasPassword() {
    const password = jefasPasswordInput.value.trim();
    if (!password) return;

    // Contraseña Jefas solicitada por el usuario
    if (password === 'SirioJefas2026*') {
      isJefasUnlocked = true;
      closeJefasPasswordModal();
      if (pendingTabId) {
        switchTab(pendingTabId);
      }
    } else {
      if (jefasPasswordError) jefasPasswordError.style.display = 'block';
      if (jefasPasswordInput) {
        jefasPasswordInput.value = '';
        jefasPasswordInput.focus();
      }
    }
  }

  if (confirmJefasPasswordBtn) {
    confirmJefasPasswordBtn.addEventListener('click', verifyJefasPassword);
  }

  if (jefasPasswordInput) {
    jefasPasswordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        verifyJefasPassword();
      }
    });
  }

  // ==========================================================================
  // LÓGICA DEL DIRECTORIO DE CLIENTES (Pestaña Clientes y Perfiles)
  // ==========================================================================
  const dirClientsContainer = document.getElementById('dir-clients-container');
  const searchDirClientInput = document.getElementById('search-dir-client');
  const dirNoClientSelected = document.getElementById('dir-no-client-selected');
  const dirClientDetailView = document.getElementById('dir-client-detail-view');
  
  const dirClientName = document.getElementById('dir-client-name');
  const dirClientIdVal = document.getElementById('dir-client-id-val');
  const dirClientUsernameVal = document.getElementById('dir-client-username-val');
  const dirClientDateVal = document.getElementById('dir-client-date-val');
  const dirClientAddressVal = document.getElementById('dir-client-address-val');
  const dirClientEmailVal = document.getElementById('dir-client-email-val');
  const dirClientPhoneVal = document.getElementById('dir-client-phone-val');
  
  const dirEditClientBtn = document.getElementById('dir-edit-client-btn');
  const dirEditClientForm = document.getElementById('dir-edit-client-form');
  const cancelEditDirBtn = document.getElementById('cancel-edit-dir-btn');

  selectedDirClient = null;

  // Renderizar la lista de clientes en el directorio
  function renderDirClients(clientsList) {
    if (!dirClientsContainer) return;
    dirClientsContainer.innerHTML = '';
    
    if (clientsList.length === 0) {
      dirClientsContainer.innerHTML = '<p style="text-align: center; color: var(--text-dark); padding: 1rem 0;">No se encontraron clientes.</p>';
      return;
    }
    
    clientsList.forEach(client => {
      const item = document.createElement('div');
      item.className = 'client-item';
      item.setAttribute('data-id', client.id_usuario);
      if (selectedDirClient && selectedDirClient.id_usuario === client.id_usuario) {
        item.classList.add('active');
      }
      
      const isActive = activeUserIds.includes(client.id_usuario);
      
      item.innerHTML = `
        <div class="client-item-info">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <h4 style="margin: 0;">${client.nombre}</h4>
            ${client.moroso ? '<span style="background: rgba(239, 68, 68, 0.15); color: #f87171; font-size: 0.6rem; padding: 1px 5px; border-radius: 3px; font-weight: 700; border: 1px solid rgba(239, 68, 68, 0.2); text-transform: uppercase;">MOROSO</span>' : ''}
            <span class="active-status-badge" style="display: ${isActive ? 'inline-block' : 'none'}; background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 0.6rem; padding: 1px 5px; border-radius: 3px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; animation: pulse 2s infinite;">Activo</span>
          </div>
          <p style="margin-top: 4px;"><i class="fa-solid fa-passport"></i> DNI: ${client.identificacion}</p>
        </div>
        <span class="client-item-badge">${client.id_usuario}</span>
      `;
      
      item.addEventListener('click', () => {
        selectDirClient(client);
        document.querySelectorAll('#dir-clients-container .client-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
      });
      
      dirClientsContainer.appendChild(item);
    });
  }

  // Seleccionar cliente en el directorio
  function selectDirClient(client) {
    selectedDirClient = client;
    
    // Ocultar formulario de edición y mostrar vista lectura
    if (dirEditClientForm) dirEditClientForm.style.display = 'none';
    if (dirClientDetailView) dirClientDetailView.style.display = 'block';
    if (dirNoClientSelected) dirNoClientSelected.style.display = 'none';
    
    if (dirClientName) dirClientName.innerText = client.nombre;
    if (dirClientIdVal) dirClientIdVal.innerText = client.identificacion;
    if (dirClientUsernameVal) dirClientUsernameVal.innerText = client.usuario;
    if (dirClientDateVal) dirClientDateVal.innerText = client.fecha_registro ? client.fecha_registro.split('T')[0] : '...';
    if (dirClientAddressVal) dirClientAddressVal.innerText = client.direccion || 'No registrada';
    if (dirClientEmailVal) dirClientEmailVal.innerText = client.correo || 'No registrado';
    if (dirClientPhoneVal) dirClientPhoneVal.innerText = client.telefono || 'No registrado';
    
    const planVal = document.getElementById('dir-client-plan-val');
    const creditsVal = document.getElementById('dir-client-credits-val');
    if (planVal) planVal.innerText = client.plan || 'Básico';
    if (creditsVal) creditsVal.innerHTML = `<i class="fa-solid fa-coins"></i> ${formatCredits(client.sirio_credits)}`;
    
    // IA Trial status rendering
    const dirClientIaStatusVal = document.getElementById('dir-client-ia-status-val');
    const dirEnableIaTrialBtn = document.getElementById('dir-enable-ia-trial-btn');
    const dirDisableIaTrialBtn = document.getElementById('dir-disable-ia-trial-btn');
    
    if (dirClientIaStatusVal) {
      dirClientIaStatusVal.innerHTML = `<span style="color: #10b981; font-weight: 700;"><i class="fa-solid fa-circle-check"></i> Gratuito y Habilitado</span>`;
      if (dirEnableIaTrialBtn) dirEnableIaTrialBtn.style.display = 'none';
      if (dirDisableIaTrialBtn) dirDisableIaTrialBtn.style.display = 'none';
    }
    
    // Configure badge and toggle button
    const debtBadge = document.getElementById('dir-client-debt-badge');
    const toggleDebtBtn = document.getElementById('dir-toggle-debt-btn');
    if (debtBadge) {
      debtBadge.style.display = client.moroso ? 'inline-block' : 'none';
    }
    if (toggleDebtBtn) {
      if (client.moroso) {
        toggleDebtBtn.innerHTML = '<i class="fa-solid fa-user-check"></i> Habilitar Envío / Al Día';
        toggleDebtBtn.style.background = 'rgba(34, 197, 94, 0.15)';
        toggleDebtBtn.style.color = '#86efac';
        toggleDebtBtn.style.border = '1px solid rgba(34, 197, 94, 0.3)';
      } else {
        toggleDebtBtn.innerHTML = '<i class="fa-solid fa-hand-holding-dollar"></i> Restringir Envío / Moroso';
        toggleDebtBtn.style.background = 'rgba(239, 68, 68, 0.15)';
        toggleDebtBtn.style.color = '#fca5a5';
        toggleDebtBtn.style.border = '1px solid rgba(239, 68, 68, 0.3)';
      }
    }

    const dirPwdVal = document.getElementById('dir-client-password-val');
    if (dirPwdVal) {
      dirPwdVal.setAttribute('data-password', client.contrasena || '');
      dirPwdVal.innerText = '••••••••';
      const dirToggleBtn = document.getElementById('toggle-dir-pwd-btn');
      if (dirToggleBtn) {
        const icon = dirToggleBtn.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-eye';
      }
    }
    
    // Rellenar formulario de edición
    if (document.getElementById('edit-dir-name')) document.getElementById('edit-dir-name').value = client.nombre;
    if (document.getElementById('edit-dir-address')) document.getElementById('edit-dir-address').value = client.direccion || '';
    if (document.getElementById('edit-dir-email')) document.getElementById('edit-dir-email').value = client.correo || '';
    if (document.getElementById('edit-dir-phone')) document.getElementById('edit-dir-phone').value = client.telefono || '';
    if (document.getElementById('edit-dir-plan')) document.getElementById('edit-dir-plan').value = client.plan || 'Básico';
    if (document.getElementById('edit-dir-credits')) document.getElementById('edit-dir-credits').value = client.sirio_credits !== undefined ? client.sirio_credits : 0;
    if (document.getElementById('edit-dir-password')) document.getElementById('edit-dir-password').value = '';
  }

  // Botón para alternar visibilidad de contraseña en directorio
  const toggleDirPwdBtn = document.getElementById('toggle-dir-pwd-btn');
  if (toggleDirPwdBtn) {
    toggleDirPwdBtn.addEventListener('click', () => {
      const dirPwdVal = document.getElementById('dir-client-password-val');
      const icon = toggleDirPwdBtn.querySelector('i');
      if (dirPwdVal && icon) {
        if (dirPwdVal.innerText === '••••••••') {
          dirPwdVal.innerText = dirPwdVal.getAttribute('data-password') || '';
          icon.className = 'fa-solid fa-eye-slash';
        } else {
          dirPwdVal.innerText = '••••••••';
          icon.className = 'fa-solid fa-eye';
        }
      }
    });
  }

  // Botón para alternar estado de morosidad del cliente
  const dirToggleDebtBtn = document.getElementById('dir-toggle-debt-btn');
  if (dirToggleDebtBtn) {
    dirToggleDebtBtn.addEventListener('click', async () => {
      if (!selectedDirClient) return;

      const newStatus = !selectedDirClient.moroso;
      const confirmMsg = newStatus
        ? `¿Está seguro de que desea marcar a "${selectedDirClient.nombre}" como MOROSO?\n\nLos nuevos resultados que suba para este cliente quedarán retenidos y no serán visibles en su cuenta hasta que se ponga al día.`
        : `¿Está seguro de que desea marcar a "${selectedDirClient.nombre}" como AL DÍA?\n\nSe liberarán todos los resultados retenidos y serán visibles inmediatamente para el cliente.`;

      if (!confirm(confirmMsg)) return;

      SirioAuth.showLoading(newStatus ? 'Restringiendo cliente...' : 'Habilitando cliente...');

      try {
        const response = await fetch(`${SirioAuth.API_BASE}/api/client/update-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_usuario: selectedDirClient.id_usuario,
            moroso: newStatus,
            requested_by_admin: true
          })
        });
        const result = await response.json();
        SirioAuth.hideLoading();

        if (result.success) {
          showGlobalAlert(
            newStatus
              ? `Cliente "${selectedDirClient.nombre}" marcado como MOROSO. Envíos restringidos.`
              : `Cliente "${selectedDirClient.nombre}" marcado como AL DÍA. Funciones habilitadas.`,
            'success'
          );

          // Recargar clientes para refrescar ambas pestañas
          await loadClients();

          // Re-seleccionar el cliente actualizado
          const updated = allClients.find(c => c.id_usuario === selectedDirClient.id_usuario);
          if (updated) {
            selectDirClient(updated);
          }

          // Renderizar lista filtrada si hay búsqueda activa
          const query = searchDirClientInput ? searchDirClientInput.value.toLowerCase().trim() : '';
          const filtered = allClients.filter(c =>
            c.nombre.toLowerCase().includes(query) ||
            c.identificacion.toString().includes(query) ||
            c.id_usuario.toLowerCase().includes(query)
          );
          renderDirClients(filtered);
        } else {
          showGlobalAlert(result.message || 'Error al actualizar el estado del cliente.', 'error');
        }
      } catch (err) {
        SirioAuth.hideLoading();
        console.error('Error al cambiar estado de morosidad:', err);
        showGlobalAlert('Error de red al intentar cambiar el estado del cliente.', 'error');
      }
    });
  }

  const dirEnableIaTrialBtn = document.getElementById('dir-enable-ia-trial-btn');
  if (dirEnableIaTrialBtn) {
    dirEnableIaTrialBtn.addEventListener('click', async () => {
      console.log('[SirIA Trial] Botón HABILITAR clickeado. selectedDirClient:', selectedDirClient);
      if (!selectedDirClient) {
        console.warn('[SirIA Trial] No hay cliente seleccionado, abortando.');
        return;
      }

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 15);
      const expiryDateStr = expiryDate.toISOString().split('T')[0];

      if (!confirm(`¿Está seguro de que desea habilitar una prueba de 15 días para el uso de la interpretación con IA a "${selectedDirClient.nombre}"?\n\nLa prueba vencerá el: ${expiryDateStr}`)) return;

      SirioAuth.showLoading('Habilitando prueba de IA...');

      try {
        console.log('[SirIA Trial] Enviando petición al servidor...', { id_usuario: selectedDirClient.id_usuario, ia_trial_expiry: expiryDateStr });
        const response = await fetch(`${SirioAuth.API_BASE}/api/client/update-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_usuario: selectedDirClient.id_usuario,
            ia_trial_expiry: expiryDateStr,
            requested_by_admin: true
          })
        });
        const result = await response.json();
        console.log('[SirIA Trial] Respuesta del servidor:', result);
        SirioAuth.hideLoading();

        if (result.success) {
          showGlobalAlert(`Prueba de 15 días habilitada con éxito para "${selectedDirClient.nombre}". Vence el ${expiryDateStr}.`, 'success');
          
          await loadClients();

          const updated = allClients.find(c => c.id_usuario === selectedDirClient.id_usuario);
          if (updated) {
            selectDirClient(updated);
          }
        } else {
          showGlobalAlert(result.message || 'Error al habilitar la prueba de IA.', 'error');
        }
      } catch (err) {
        SirioAuth.hideLoading();
        console.error('[SirIA Trial] Error al habilitar prueba de IA:', err);
        showGlobalAlert('Error de red al intentar habilitar la prueba de IA: ' + err.message, 'error');
      }
    });
  } else {
    console.error('[SirIA Trial] ¡¡BOTÓN dir-enable-ia-trial-btn NO ENCONTRADO en el DOM!!');
  }

  const dirDisableIaTrialBtn = document.getElementById('dir-disable-ia-trial-btn');
  if (dirDisableIaTrialBtn) {
    dirDisableIaTrialBtn.addEventListener('click', async () => {
      if (!selectedDirClient) return;

      if (!confirm(`¿Está seguro de que desea cancelar la prueba de interpretación con IA para "${selectedDirClient.nombre}"?`)) return;

      SirioAuth.showLoading('Removiendo prueba de IA...');

      try {
        const response = await fetch(`${SirioAuth.API_BASE}/api/client/update-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_usuario: selectedDirClient.id_usuario,
            ia_trial_expiry: '', // Limpiar la fecha
            requested_by_admin: true
          })
        });
        const result = await response.json();
        SirioAuth.hideLoading();

        if (result.success) {
          showGlobalAlert(`Prueba de IA removida con éxito para "${selectedDirClient.nombre}".`, 'success');
          
          await loadClients();

          const updated = allClients.find(c => c.id_usuario === selectedDirClient.id_usuario);
          if (updated) {
            selectDirClient(updated);
          }
        } else {
          showGlobalAlert(result.message || 'Error al remover la prueba de IA.', 'error');
        }
      } catch (err) {
        SirioAuth.hideLoading();
        console.error('Error al remover prueba de IA:', err);
        showGlobalAlert('Error de red al intentar remover la prueba de IA.', 'error');
      }
    });
  }

  // Filtrar directorio de clientes
  if (searchDirClientInput) {
    searchDirClientInput.addEventListener('keyup', () => {
      const query = searchDirClientInput.value.toLowerCase().trim();
      const filtered = allClients.filter(c => 
        c.nombre.toLowerCase().includes(query) || 
        c.identificacion.toString().includes(query) ||
        c.id_usuario.toLowerCase().includes(query)
      );
      renderDirClients(filtered);
    });
  }

  // Botón mostrar edición
  if (dirEditClientBtn) {
    dirEditClientBtn.addEventListener('click', () => {
      if (dirEditClientForm) dirEditClientForm.style.display = 'block';
    });
  }

  // Botón cancelar edición
  if (cancelEditDirBtn) {
    cancelEditDirBtn.addEventListener('click', () => {
      if (dirEditClientForm) dirEditClientForm.style.display = 'none';
    });
  }

  // Enviar formulario de edición (Admin editando cliente)
  if (dirEditClientForm) {
    dirEditClientForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const nombre = document.getElementById('edit-dir-name').value;
      const direccion = document.getElementById('edit-dir-address').value;
      const correo = document.getElementById('edit-dir-email').value;
      const telefono = document.getElementById('edit-dir-phone').value;
      const plan = document.getElementById('edit-dir-plan').value;
      const sirio_credits = parseInt(document.getElementById('edit-dir-credits').value) || 0;
      const contrasena = document.getElementById('edit-dir-password').value;
      
      SirioAuth.showLoading('Guardando cambios del cliente...');
      
      try {
        const response = await fetch(`${SirioAuth.API_BASE}/api/client/update-profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id_usuario: selectedDirClient.id_usuario,
            nombre,
            direccion,
            correo,
            telefono,
            contrasena,
            plan,
            sirio_credits,
            requested_by_admin: true
          })
        });
        
        const result = await response.json();
        SirioAuth.hideLoading();
        
        if (result.success) {
          showGlobalAlert(result.message || 'Cliente actualizado correctamente.', 'success');
          
          // Recargar clientes y actualizar lista actual en memoria
          await loadClients();
          
          // Encontrar el cliente actualizado en allClients
          const updated = allClients.find(c => c.id_usuario === selectedDirClient.id_usuario);
          if (updated) {
            selectDirClient(updated);
          }
          
          // Renderizar lista filtrada si hay búsqueda
          const query = searchDirClientInput ? searchDirClientInput.value.toLowerCase().trim() : '';
          const filtered = allClients.filter(c => 
            c.nombre.toLowerCase().includes(query) || 
            c.identificacion.toString().includes(query) ||
            c.id_usuario.toLowerCase().includes(query)
          );
          renderDirClients(filtered);
        } else {
          showGlobalAlert(result.message || 'Error al actualizar el cliente.', 'error');
        }
      } catch (err) {
        SirioAuth.hideLoading();
        console.error('Error al actualizar cliente:', err);
        showGlobalAlert('Error de red al intentar actualizar el cliente.', 'error');
      }
    });
  }

  // Elementos del Modal de Eliminación de Cliente
  const deleteClientModal = document.getElementById('delete-client-modal');
  const deleteClientModalName = document.getElementById('delete-client-modal-name');
  const deleteClientModalUsername = document.getElementById('delete-client-modal-username');
  const deleteClientConfirmInput = document.getElementById('delete-client-confirm-input');
  const confirmDeleteClientBtn = document.getElementById('confirm-delete-client-btn');
  const cancelDeleteClientBtn = document.getElementById('cancel-delete-client-btn');
  const closeDeleteClientModalBtn = document.getElementById('close-delete-client-modal');

  // Cerrar modal de eliminación
  function closeDeleteClientModalFunc() {
    if (deleteClientModal) deleteClientModal.style.display = 'none';
    if (deleteClientConfirmInput) deleteClientConfirmInput.value = '';
    if (confirmDeleteClientBtn) confirmDeleteClientBtn.disabled = true;
  }

  // Abrir modal de eliminación
  function openDeleteClientModal(client) {
    if (!client) return;
    if (deleteClientModalName) deleteClientModalName.innerText = client.nombre;
    if (deleteClientModalUsername) deleteClientModalUsername.innerText = client.usuario;
    if (deleteClientConfirmInput) deleteClientConfirmInput.value = '';
    if (confirmDeleteClientBtn) confirmDeleteClientBtn.disabled = true;
    if (deleteClientModal) deleteClientModal.style.display = 'flex';
  }

  // Validar input de confirmación
  if (deleteClientConfirmInput) {
    deleteClientConfirmInput.addEventListener('input', () => {
      const inputVal = deleteClientConfirmInput.value.trim().toLowerCase();
      const expectedVal = selectedDirClient ? selectedDirClient.usuario.toLowerCase() : '';
      if (inputVal === expectedVal && expectedVal !== '') {
        if (confirmDeleteClientBtn) confirmDeleteClientBtn.disabled = false;
      } else {
        if (confirmDeleteClientBtn) confirmDeleteClientBtn.disabled = true;
      }
    });
  }

  // Eventos de botones del modal de eliminación
  if (cancelDeleteClientBtn) cancelDeleteClientBtn.addEventListener('click', closeDeleteClientModalFunc);
  if (closeDeleteClientModalBtn) closeDeleteClientModalBtn.addEventListener('click', closeDeleteClientModalFunc);
  
  if (confirmDeleteClientBtn) {
    confirmDeleteClientBtn.addEventListener('click', async () => {
      if (selectedDirClient) {
        closeDeleteClientModalFunc();
        await executeDeleteClient(selectedDirClient);
      }
    });
  }

  // Botón de eliminar cliente desde el directorio
  const dirDeleteClientBtn = document.getElementById('dir-delete-client-btn');
  if (dirDeleteClientBtn) {
    dirDeleteClientBtn.addEventListener('click', () => {
      if (selectedDirClient) {
        openDeleteClientModal(selectedDirClient);
      }
    });
  }

  // ==========================================================================
  // LÓGICA DEL DIRECTORIO DEL PERSONAL DEL LABORATORIO
  // ==========================================================================
  const dirToggleClientsBtn = document.getElementById('dir-toggle-clients-btn');
  const dirToggleStaffBtn = document.getElementById('dir-toggle-staff-btn');
  const dirClientsSection = document.getElementById('dir-clients-section');
  const dirStaffSection = document.getElementById('dir-staff-section');
  const dirNoStaffSelected = document.getElementById('dir-no-staff-selected');
  const dirStaffDetailView = document.getElementById('dir-staff-detail-view');
  const searchDirStaffInput = document.getElementById('search-dir-staff');
  const dirStaffContainer = document.getElementById('dir-staff-container');

  // Cargar personal del laboratorio
  async function loadStaff() {
    try {
      const response = await fetch(`${SirioAuth.API_BASE}/api/admin/staff`);
      const data = await response.json();
      if (data.success) {
        allStaff = data.admins;
        renderDirStaff(allStaff);
      } else {
        showGlobalAlert(data.message || 'Error al cargar el personal del laboratorio.', 'error');
      }
    } catch (error) {
      console.error('Error al cargar personal:', error);
      showGlobalAlert('No se pudo establecer conexión para cargar personal.', 'error');
    }
  }

  // Renderizar directorio de personal
  function renderDirStaff(staffList) {
    if (!dirStaffContainer) return;
    dirStaffContainer.innerHTML = '';
    
    if (staffList.length === 0) {
      dirStaffContainer.innerHTML = '<p style="text-align: center; color: var(--text-dark); padding: 1rem 0;">No se encontró personal.</p>';
      return;
    }
    
    // Ordenar: Jefas (1), Programadores (2), Admin (3) y secundariamente por orden alfabético
    const sortedList = [...staffList].sort((a, b) => {
      const roleOrder = { 'jefas': 1, 'programadores': 2, 'admin': 3 };
      const roleA = roleOrder[a.rol] || 3;
      const roleB = roleOrder[b.rol] || 3;
      
      if (roleA !== roleB) {
        return roleA - roleB;
      }
      return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
    });
    
    sortedList.forEach(member => {
      const item = document.createElement('div');
      item.className = 'client-item';
      item.setAttribute('data-id', member.id_usuario);
      if (selectedStaff && selectedStaff.id_usuario === member.id_usuario) {
        item.classList.add('active');
      }
      
      const roleNames = {
        'jefas': 'Jefa / Jefe 👑',
        'programadores': 'Programador 💻',
        'admin': 'Admin Normal 👤'
      };
      const roleText = roleNames[member.rol] || 'Admin Normal 👤';
      const isActive = activeUserIds.includes(member.id_usuario);
      
      item.innerHTML = `
        <div class="client-item-info">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <h4 style="margin: 0;">${member.nombre}</h4>
            <span class="active-status-badge" style="display: ${isActive ? 'inline-block' : 'none'}; background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 0.6rem; padding: 1px 5px; border-radius: 3px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; animation: pulse 2s infinite;">Activo</span>
          </div>
          <p style="margin-top: 4px; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-user-tag" style="color: var(--color-accent); font-size: 0.72rem;"></i>
            <span style="font-weight: 600; text-transform: uppercase; font-size: 0.68rem; letter-spacing: 0.3px; color: var(--color-accent);">${roleText}</span>
            <span style="color: var(--border-light);">|</span>
            <span style="color: var(--text-muted); font-size: 0.72rem;">U: ${member.usuario}</span>
          </p>
        </div>
        <span class="client-item-badge" style="background: var(--color-accent); color: #000; border-color: var(--color-accent); font-weight: 700; font-size: 0.72rem;">${member.total_enviados} env.</span>
      `;
      
      item.addEventListener('click', () => {
        selectStaff(member);
        document.querySelectorAll('#dir-staff-container .client-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
      });
      
      dirStaffContainer.appendChild(item);
    });
  }

  // Seleccionar miembro de personal en el directorio
  function selectStaff(member) {
    selectedStaff = member;
    
    // Ocultar formulario de edición y mostrar vista lectura
    if (document.getElementById('dir-edit-staff-form')) {
      document.getElementById('dir-edit-staff-form').style.display = 'none';
    }
    if (dirStaffDetailView) dirStaffDetailView.style.display = 'block';
    if (dirNoStaffSelected) dirNoStaffSelected.style.display = 'none';
    
    if (document.getElementById('dir-staff-name')) {
      document.getElementById('dir-staff-name').innerText = member.nombre;
    }
    if (document.getElementById('dir-staff-id-val')) {
      document.getElementById('dir-staff-id-val').innerText = member.identificacion || '00000000';
    }
    if (document.getElementById('dir-staff-username-val')) {
      document.getElementById('dir-staff-username-val').innerText = member.usuario;
    }
    if (document.getElementById('dir-staff-sent-count-val')) {
      document.getElementById('dir-staff-sent-count-val').innerText = member.total_enviados || 0;
    }
    if (document.getElementById('dir-staff-date-val')) {
      document.getElementById('dir-staff-date-val').innerText = member.fecha_registro ? member.fecha_registro.split('T')[0] : '...';
    }

    const dirStaffPwdVal = document.getElementById('dir-staff-password-val');
    if (dirStaffPwdVal) {
      dirStaffPwdVal.setAttribute('data-password', member.contrasena || '');
      dirStaffPwdVal.innerText = '••••••••';
      const dirStaffToggleBtn = document.getElementById('toggle-dir-staff-pwd-btn');
      if (dirStaffToggleBtn) {
        dirStaffToggleBtn.innerHTML = '<i class="fa-solid fa-eye"></i>';
      }
    }
    
    // Rellenar formulario de edición
    if (document.getElementById('edit-dir-staff-name')) {
      document.getElementById('edit-dir-staff-name').value = member.nombre;
    }
    if (document.getElementById('edit-dir-staff-id')) {
      document.getElementById('edit-dir-staff-id').value = member.identificacion || '00000000';
    }
    if (document.getElementById('edit-dir-staff-password')) {
      document.getElementById('edit-dir-staff-password').value = '';
    }

    // Actualizar badge de rol y botones de toggle de rol
    const dirStaffRoleBadge = document.getElementById('dir-staff-role-badge');
    const dirToggleStaffRoleBtn = document.getElementById('dir-toggle-staff-role-btn');
    const dirToggleProgrammerRoleBtn = document.getElementById('dir-toggle-programmer-role-btn');
    
    if (dirStaffRoleBadge && dirToggleStaffRoleBtn && dirToggleProgrammerRoleBtn) {
      const currentRole = member.rol || 'admin';
      
      // Estilo y texto del badge según el rol
      if (currentRole === 'jefas') {
        dirStaffRoleBadge.innerText = 'JEFA / JEFE 👑';
        dirStaffRoleBadge.style.background = 'rgba(236, 72, 153, 0.15)'; // Pink
        dirStaffRoleBadge.style.color = '#f472b6';
        dirStaffRoleBadge.style.borderColor = 'rgba(236, 72, 153, 0.3)';
        
        dirToggleStaffRoleBtn.innerHTML = '<i class="fa-solid fa-user-slash"></i> Quitar Rol Jefa/Jefe';
        dirToggleStaffRoleBtn.style.background = 'rgba(239, 68, 68, 0.15)';
        dirToggleStaffRoleBtn.style.color = '#f87171';
        dirToggleStaffRoleBtn.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        
        dirToggleProgrammerRoleBtn.innerHTML = '<i class="fa-solid fa-code"></i> Hacer Programador';
        dirToggleProgrammerRoleBtn.style.background = 'rgba(168, 85, 247, 0.15)';
        dirToggleProgrammerRoleBtn.style.color = '#c084fc';
        dirToggleProgrammerRoleBtn.style.borderColor = 'rgba(168, 85, 247, 0.3)';
      } else if (currentRole === 'programadores') {
        dirStaffRoleBadge.innerText = 'PROGRAMADOR 💻';
        dirStaffRoleBadge.style.background = 'rgba(168, 85, 247, 0.15)'; // Purple
        dirStaffRoleBadge.style.color = '#c084fc';
        dirStaffRoleBadge.style.borderColor = 'rgba(168, 85, 247, 0.3)';
        
        dirToggleStaffRoleBtn.innerHTML = '<i class="fa-solid fa-crown"></i> Hacer Jefa o Jefe';
        dirToggleStaffRoleBtn.style.background = 'rgba(236, 72, 153, 0.15)';
        dirToggleStaffRoleBtn.style.color = '#f472b6';
        dirToggleStaffRoleBtn.style.borderColor = 'rgba(236, 72, 153, 0.3)';
        
        dirToggleProgrammerRoleBtn.innerHTML = '<i class="fa-solid fa-user-slash"></i> Quitar Rol Programador';
        dirToggleProgrammerRoleBtn.style.background = 'rgba(239, 68, 68, 0.15)';
        dirToggleProgrammerRoleBtn.style.color = '#f87171';
        dirToggleProgrammerRoleBtn.style.borderColor = 'rgba(239, 68, 68, 0.3)';
      } else {
        dirStaffRoleBadge.innerText = 'ADMIN NORMAL 👤';
        dirStaffRoleBadge.style.background = 'rgba(14, 165, 233, 0.15)'; // Sky
        dirStaffRoleBadge.style.color = '#38bdf8';
        dirStaffRoleBadge.style.borderColor = 'rgba(14, 165, 233, 0.3)';
        
        dirToggleStaffRoleBtn.innerHTML = '<i class="fa-solid fa-crown"></i> Hacer Jefa o Jefe';
        dirToggleStaffRoleBtn.style.background = 'rgba(236, 72, 153, 0.15)';
        dirToggleStaffRoleBtn.style.color = '#f472b6';
        dirToggleStaffRoleBtn.style.borderColor = 'rgba(236, 72, 153, 0.3)';
        
        dirToggleProgrammerRoleBtn.innerHTML = '<i class="fa-solid fa-code"></i> Hacer Programador';
        dirToggleProgrammerRoleBtn.style.background = 'rgba(168, 85, 247, 0.15)';
        dirToggleProgrammerRoleBtn.style.color = '#c084fc';
        dirToggleProgrammerRoleBtn.style.borderColor = 'rgba(168, 85, 247, 0.3)';
      }
      
      // Ocultar botones si es el administrador principal U000
      if (member.id_usuario === 'U000') {
        dirToggleStaffRoleBtn.style.display = 'none';
        dirToggleProgrammerRoleBtn.style.display = 'none';
      } else {
        dirToggleStaffRoleBtn.style.display = 'inline-flex';
        dirToggleProgrammerRoleBtn.style.display = 'inline-flex';
      }
    }
  }

  // Toggles de selección de directorio
  if (dirToggleClientsBtn) {
    dirToggleClientsBtn.addEventListener('click', () => {
      activeDirectory = 'clients';
      dirToggleClientsBtn.style.background = 'var(--color-primary)';
      dirToggleClientsBtn.style.color = '#fff';
      dirToggleStaffBtn.style.background = 'transparent';
      dirToggleStaffBtn.style.color = 'var(--text-muted)';
      
      dirClientsSection.style.display = 'flex';
      dirStaffSection.style.display = 'none';
      
      dirStaffDetailView.style.display = 'none';
      dirNoStaffSelected.style.display = 'none';
      
      if (selectedDirClient) {
        selectDirClient(selectedDirClient);
      } else {
        if (dirClientDetailView) dirClientDetailView.style.display = 'none';
        if (dirNoClientSelected) dirNoClientSelected.style.display = 'flex';
      }
    });
  }

  if (dirToggleStaffBtn) {
    dirToggleStaffBtn.addEventListener('click', () => {
      activeDirectory = 'staff';
      dirToggleStaffBtn.style.background = 'var(--color-accent)';
      dirToggleStaffBtn.style.color = '#000';
      dirToggleClientsBtn.style.background = 'transparent';
      dirToggleClientsBtn.style.color = 'var(--text-muted)';
      
      dirClientsSection.style.display = 'none';
      dirStaffSection.style.display = 'flex';
      
      if (dirClientDetailView) dirClientDetailView.style.display = 'none';
      if (dirNoClientSelected) dirNoClientSelected.style.display = 'none';
      
      loadStaff();
      
      if (selectedStaff) {
        selectStaff(selectedStaff);
      } else {
        if (dirStaffDetailView) dirStaffDetailView.style.display = 'none';
        if (dirNoStaffSelected) dirNoStaffSelected.style.display = 'flex';
      }
    });
  }

  // Botón para alternar visibilidad de contraseña del personal
  const toggleDirStaffPwdBtn = document.getElementById('toggle-dir-staff-pwd-btn');
  if (toggleDirStaffPwdBtn) {
    toggleDirStaffPwdBtn.addEventListener('click', () => {
      const dirStaffPwdVal = document.getElementById('dir-staff-password-val');
      if (dirStaffPwdVal && toggleDirStaffPwdBtn) {
        if (dirStaffPwdVal.innerText === '••••••••') {
          dirStaffPwdVal.innerText = dirStaffPwdVal.getAttribute('data-password') || '';
          toggleDirStaffPwdBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
        } else {
          dirStaffPwdVal.innerText = '••••••••';
          toggleDirStaffPwdBtn.innerHTML = '<i class="fa-solid fa-eye"></i>';
        }
      }
    });
  }

  // Botón Jefa/Jefe: Alternar entre admin normal y jefas
  const dirToggleStaffRoleBtn = document.getElementById('dir-toggle-staff-role-btn');
  if (dirToggleStaffRoleBtn) {
    dirToggleStaffRoleBtn.addEventListener('click', async () => {
      if (!selectedStaff) return;
      
      const currentRole = selectedStaff.rol || 'admin';
      const isPromoting = (currentRole !== 'jefas');
      const newRole = isPromoting ? 'jefas' : 'admin';
      
      if (isPromoting) {
        const password = prompt('Ingrese la contraseña de autorización para asignar privilegios de Jefa o Jefe:');
        if (password === null) return; // Cancelado
        if (password !== 'SirioJefas2026*') {
          alert('Contraseña de autorización incorrecta.');
          return;
        }
      } else {
        const confirmDemote = confirm(`¿Está seguro de quitar el rol de Jefa/Jefe a ${selectedStaff.nombre} y volverlo Administrador Normal?`);
        if (!confirmDemote) return;
      }
      
      SirioAuth.showLoading(`Actualizando rol de Jefa/Jefe...`);
      
      try {
        const response = await fetch(`${SirioAuth.API_BASE}/api/admin/staff/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_usuario: selectedStaff.id_usuario,
            nombre: selectedStaff.nombre,
            identificacion: selectedStaff.identificacion,
            rol: newRole
          })
        });
        
        const result = await response.json();
        SirioAuth.hideLoading();
        
        if (result.success) {
          showGlobalAlert(`Rol actualizado correctamente.`, 'success');
          
          // Si el admin se editó a sí mismo, actualizar su rol en sesión y cabecera
          if (selectedStaff.id_usuario === currentUser.id_usuario) {
            currentUser.rol = newRole;
            localStorage.setItem('sirio_user', JSON.stringify(currentUser));
            SirioAuth.setCookie(SirioAuth.STORAGE_KEY, JSON.stringify(currentUser));
            updateHeaderRoleDisplay(newRole);
          }
          
          await loadStaff();
          
          const updated = allStaff.find(s => s.id_usuario === selectedStaff.id_usuario);
          if (updated) {
            selectStaff(updated);
          }
        } else {
          showGlobalAlert(result.message || 'Error al actualizar el rol.', 'error');
        }
      } catch (err) {
        SirioAuth.hideLoading();
        console.error('Error al actualizar rol:', err);
        showGlobalAlert('Error de red al intentar cambiar el rol.', 'error');
      }
    });
  }

  // Botón Programador: Alternar entre admin normal y programadores
  const dirToggleProgrammerRoleBtn = document.getElementById('dir-toggle-programmer-role-btn');
  if (dirToggleProgrammerRoleBtn) {
    dirToggleProgrammerRoleBtn.addEventListener('click', async () => {
      if (!selectedStaff) return;
      
      const currentRole = selectedStaff.rol || 'admin';
      const isPromoting = (currentRole !== 'programadores');
      const newRole = isPromoting ? 'programadores' : 'admin';
      
      if (isPromoting) {
        const password = prompt('Ingrese la contraseña de autorización para asignar privilegios de Programador:');
        if (password === null) return; // Cancelado
        if (password !== 'SirioJefas2026*') {
          alert('Contraseña de autorización incorrecta.');
          return;
        }
      } else {
        const confirmDemote = confirm(`¿Está seguro de quitar el rol de Programador a ${selectedStaff.nombre} y volverlo Administrador Normal?`);
        if (!confirmDemote) return;
      }
      
      SirioAuth.showLoading(`Actualizando rol de Programador...`);
      
      try {
        const response = await fetch(`${SirioAuth.API_BASE}/api/admin/staff/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_usuario: selectedStaff.id_usuario,
            nombre: selectedStaff.nombre,
            identificacion: selectedStaff.identificacion,
            rol: newRole
          })
        });
        
        const result = await response.json();
        SirioAuth.hideLoading();
        
        if (result.success) {
          showGlobalAlert(`Rol actualizado correctamente.`, 'success');
          
          // Si el admin se editó a sí mismo, actualizar su rol en sesión y cabecera
          if (selectedStaff.id_usuario === currentUser.id_usuario) {
            currentUser.rol = newRole;
            localStorage.setItem('sirio_user', JSON.stringify(currentUser));
            SirioAuth.setCookie(SirioAuth.STORAGE_KEY, JSON.stringify(currentUser));
            updateHeaderRoleDisplay(newRole);
          }
          
          await loadStaff();
          
          const updated = allStaff.find(s => s.id_usuario === selectedStaff.id_usuario);
          if (updated) {
            selectStaff(updated);
          }
        } else {
          showGlobalAlert(result.message || 'Error al actualizar el rol.', 'error');
        }
      } catch (err) {
        SirioAuth.hideLoading();
        console.error('Error al actualizar rol:', err);
        showGlobalAlert('Error de red al intentar cambiar el rol.', 'error');
      }
    });
  }

  // Filtrar directorio de personal
  if (searchDirStaffInput) {
    searchDirStaffInput.addEventListener('keyup', () => {
      const query = searchDirStaffInput.value.toLowerCase().trim();
      const filtered = allStaff.filter(s => 
        s.nombre.toLowerCase().includes(query) || 
        s.usuario.toLowerCase().includes(query) ||
        (s.identificacion || '').toString().includes(query)
      );
      renderDirStaff(filtered);
    });
  }

  // Botón mostrar edición de personal
  const dirEditStaffBtn = document.getElementById('dir-edit-staff-btn');
  const dirEditStaffForm = document.getElementById('dir-edit-staff-form');
  const cancelEditDirStaffBtn = document.getElementById('cancel-edit-dir-staff-btn');

  if (dirEditStaffBtn) {
    dirEditStaffBtn.addEventListener('click', () => {
      if (dirEditStaffForm) dirEditStaffForm.style.display = 'block';
    });
  }

  // Botón cancelar edición de personal
  if (cancelEditDirStaffBtn) {
    cancelEditDirStaffBtn.addEventListener('click', () => {
      if (dirEditStaffForm) dirEditStaffForm.style.display = 'none';
    });
  }

  // Formulario de edición del personal
  if (dirEditStaffForm) {
    dirEditStaffForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!selectedStaff) return;
      
      const nombre = document.getElementById('edit-dir-staff-name').value.trim();
      const identificacion = document.getElementById('edit-dir-staff-id').value.trim();
      const contrasena = document.getElementById('edit-dir-staff-password').value;
      
      SirioAuth.showLoading('Guardando cambios del personal...');
      
      try {
        const response = await fetch(`${SirioAuth.API_BASE}/api/admin/staff/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_usuario: selectedStaff.id_usuario,
            nombre,
            identificacion,
            contrasena
          })
        });
        
        const result = await response.json();
        SirioAuth.hideLoading();
        
        if (result.success) {
          showGlobalAlert('Perfil del personal actualizado correctamente.', 'success');
          if (dirEditStaffForm) dirEditStaffForm.style.display = 'none';
          
          // Actualizar nombre del admin si se editó a sí mismo
          if (selectedStaff.id_usuario === currentUser.id_usuario) {
            currentUser.nombre = nombre;
            document.getElementById('admin-name').innerText = nombre;
            localStorage.setItem('sirio_user', JSON.stringify(currentUser));
            SirioAuth.setCookie(SirioAuth.STORAGE_KEY, JSON.stringify(currentUser));
          }

          await loadStaff();
          
          const updated = allStaff.find(s => s.id_usuario === selectedStaff.id_usuario);
          if (updated) {
            selectStaff(updated);
          }
        } else {
          showGlobalAlert(result.message || 'Error al actualizar el personal.', 'error');
        }
      } catch (err) {
        SirioAuth.hideLoading();
        console.error('Error al actualizar personal:', err);
        showGlobalAlert('Error de red al intentar actualizar el personal.', 'error');
      }
    });
  }

  // Elementos del Modal de Eliminación de Personal
  const deleteStaffModal = document.getElementById('delete-staff-modal');
  const deleteStaffModalName = document.getElementById('delete-staff-modal-name');
  const deleteStaffModalUsername = document.getElementById('delete-staff-modal-username');
  const deleteStaffConfirmInput = document.getElementById('delete-staff-confirm-input');
  const confirmDeleteStaffBtn = document.getElementById('confirm-delete-staff-btn');
  const cancelDeleteStaffBtn = document.getElementById('cancel-delete-staff-btn');
  const closeDeleteStaffModalBtn = document.getElementById('close-delete-staff-modal');
  const dirDeleteStaffBtn = document.getElementById('dir-delete-staff-btn');

  function closeDeleteStaffModalFunc() {
    if (deleteStaffModal) deleteStaffModal.style.display = 'none';
    if (deleteStaffConfirmInput) deleteStaffConfirmInput.value = '';
    if (confirmDeleteStaffBtn) confirmDeleteStaffBtn.disabled = true;
  }

  function openDeleteStaffModal(member) {
    if (!member) return;
    if (deleteStaffModalName) deleteStaffModalName.innerText = member.nombre;
    if (deleteStaffModalUsername) deleteStaffModalUsername.innerText = member.usuario;
    if (deleteStaffConfirmInput) deleteStaffConfirmInput.value = '';
    if (confirmDeleteStaffBtn) confirmDeleteStaffBtn.disabled = true;
    if (deleteStaffModal) deleteStaffModal.style.display = 'flex';
  }

  if (deleteStaffConfirmInput) {
    deleteStaffConfirmInput.addEventListener('input', () => {
      const inputVal = deleteStaffConfirmInput.value.trim().toLowerCase();
      const expectedVal = selectedStaff ? selectedStaff.usuario.toLowerCase() : '';
      if (inputVal === expectedVal && expectedVal !== '') {
        if (confirmDeleteStaffBtn) confirmDeleteStaffBtn.disabled = false;
      } else {
        if (confirmDeleteStaffBtn) confirmDeleteStaffBtn.disabled = true;
      }
    });
  }

  if (cancelDeleteStaffBtn) cancelDeleteStaffBtn.addEventListener('click', closeDeleteStaffModalFunc);
  if (closeDeleteStaffModalBtn) closeDeleteStaffModalBtn.addEventListener('click', closeDeleteStaffModalFunc);

  if (confirmDeleteStaffBtn) {
    confirmDeleteStaffBtn.addEventListener('click', async () => {
      if (selectedStaff) {
        closeDeleteStaffModalFunc();
        
        SirioAuth.showLoading(`Eliminando al miembro del personal ${selectedStaff.nombre}...`);
        
        try {
          const response = await fetch(`${SirioAuth.API_BASE}/api/admin/staff/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id_usuario: selectedStaff.id_usuario,
              active_user_id: currentUser.id_usuario
            })
          });
          
          const result = await response.json();
          SirioAuth.hideLoading();
          
          if (result.success) {
            showGlobalAlert('Miembro del personal eliminado correctamente.', 'success');
            selectedStaff = null;
            if (dirStaffDetailView) dirStaffDetailView.style.display = 'none';
            if (dirNoStaffSelected) dirNoStaffSelected.style.display = 'flex';
            
            await loadStaff();
          } else {
            showGlobalAlert(result.message || 'Error al eliminar al personal.', 'error');
          }
        } catch (error) {
          SirioAuth.hideLoading();
          console.error('Error al eliminar personal:', error);
          showGlobalAlert('Error de red al intentar eliminar al personal.', 'error');
        }
      }
    });
  }

  if (dirDeleteStaffBtn) {
    dirDeleteStaffBtn.addEventListener('click', () => {
      if (selectedStaff) {
        // Validación de seguridad adicional
        if (selectedStaff.id_usuario === 'U000') {
          showGlobalAlert('No se puede eliminar la cuenta del administrador principal (U000).', 'error');
          return;
        }
        if (selectedStaff.id_usuario === currentUser.id_usuario) {
          showGlobalAlert('No puedes eliminar tu propio perfil mientras tienes la sesión activa.', 'error');
          return;
        }
        openDeleteStaffModal(selectedStaff);
      }
    });
  }

  // ==========================================================================
  // LÓGICA DE CONFIGURACIÓN DEL SISTEMA (GEMINI IA)
  // ==========================================================================
  const systemConfigForm = document.getElementById('system-config-form');
  const configGeminiKeyInput = document.getElementById('config-gemini-key');
  const toggleConfigKeyBtn = document.getElementById('toggle-config-key-btn');

  async function loadSystemConfig() {
    try {
      const response = await fetch(`${SirioAuth.API_BASE}/api/admin/config`);
      const data = await response.json();
      if (data.success && data.config) {
        if (configGeminiKeyInput) {
          configGeminiKeyInput.value = data.config.gemini_api_key || '';
        }
        
        // Cargar visibilidad en la pestaña de configuración
        const configVisibilityToggle = document.getElementById('config-portafolio-visibility-toggle');
        if (configVisibilityToggle) {
          configVisibilityToggle.checked = data.config.portafolio_visible !== 'false';
        }

        const configIngresoToggle = document.getElementById('config-ingreso-pacientes-visibility-toggle');
        if (configIngresoToggle) {
          configIngresoToggle.checked = data.config.ingreso_pacientes_visible !== 'false';
        }
        
        // Cargar el tema estacional activo
        const activeTheme = data.config.seasonal_theme || 'default';
        document.querySelectorAll('.theme-btn').forEach(btn => {
          if (btn.getAttribute('data-theme') === activeTheme) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });
      } else {
        showGlobalAlert(data.message || 'Error al cargar la configuración de IA.', 'error');
      }
    } catch (error) {
      console.error('Error al cargar la configuración:', error);
      showGlobalAlert('No se pudo conectar con el servidor para obtener la configuración.', 'error');
    }
  }

  // Lógica de cambio de tema estacional con autosave inmediato
  const themeButtons = document.querySelectorAll('.theme-btn');
  themeButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const selectedTheme = btn.getAttribute('data-theme');
      
      // Feedback visual de los botones de la interfaz
      themeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Aplicar tema en el DOM local
      if (typeof SirioThemes !== 'undefined') {
        SirioThemes.applyTheme(selectedTheme);
      }

      // Guardar de forma persistente en la hoja de cálculo / base de datos
      try {
        const response = await fetch(`${SirioAuth.API_BASE}/api/admin/config`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ seasonal_theme: selectedTheme })
        });
        
        const result = await response.json();
        if (!result.success) {
          console.error('[Temas] Error al guardar tema en servidor:', result.message);
          showGlobalAlert('Error al guardar el tema en el servidor.', 'error');
        }
      } catch (err) {
        console.error('[Temas] Fallo de red al guardar tema:', err);
        showGlobalAlert('Fallo de red al intentar guardar el tema.', 'error');
      }
    });
  });

  if (systemConfigForm) {
    systemConfigForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const gemini_api_key = configGeminiKeyInput.value.trim();
      const configVisibilityToggle = document.getElementById('config-portafolio-visibility-toggle');
      const portafolio_visible = configVisibilityToggle ? (configVisibilityToggle.checked ? 'true' : 'false') : 'true';

      const configIngresoToggle = document.getElementById('config-ingreso-pacientes-visibility-toggle');
      const ingreso_pacientes_visible = configIngresoToggle ? (configIngresoToggle.checked ? 'true' : 'false') : 'true';
      
      SirioAuth.showLoading('Guardando configuración...');
      
      try {
        const response = await fetch(`${SirioAuth.API_BASE}/api/admin/config`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ gemini_api_key, portafolio_visible, ingreso_pacientes_visible })
        });
        
        const result = await response.json();
        SirioAuth.hideLoading();
        
        if (result.success) {
          showGlobalAlert('Configuración guardada correctamente.', 'success');
          
          // Sincronizar el toggle del portafolio si existe
          const portafolioVisibilityToggle = document.getElementById('admin-portafolio-visibility-toggle');
          if (portafolioVisibilityToggle) {
            portafolioVisibilityToggle.checked = (portafolio_visible === 'true');
          }
        } else {
          showGlobalAlert(result.message || 'Error al guardar la configuración.', 'error');
        }
      } catch (error) {
        SirioAuth.hideLoading();
        console.error('Error al guardar la configuración:', error);
        showGlobalAlert('Error de red al intentar guardar la configuración.', 'error');
      }
    });
  }

  if (toggleConfigKeyBtn && configGeminiKeyInput) {
    toggleConfigKeyBtn.addEventListener('click', () => {
      const icon = toggleConfigKeyBtn.querySelector('i');
      if (configGeminiKeyInput.type === 'password') {
        configGeminiKeyInput.type = 'text';
        if (icon) icon.className = 'fa-solid fa-eye-slash';
      } else {
        configGeminiKeyInput.type = 'password';
        if (icon) icon.className = 'fa-solid fa-eye';
      }
    });
  }

  // Inicialización
  loadClients();
  loadGeneralOverview();

  // ==========================================================================
  // ADMIN: GESTIÓN DEL PORTAFOLIO DE SERVICIOS
  // ==========================================================================
  let adminAllExams = [];
  let adminCustomCategories = [];
  let adminPendingChanges = {};
  let adminPortafolioCategory = 'TODOS';

  const adminPortafolioTableBody = document.getElementById('admin-portafolio-table-body');
  const adminSearchPortafolio    = document.getElementById('admin-search-portafolio');
  const adminPortafolioCats      = document.getElementById('admin-portafolio-cats');
  const adminSaveBtn             = document.getElementById('admin-save-portafolio-btn');
  const adminDownloadBtn         = document.getElementById('admin-download-portafolio-btn');
  const adminPortafolioAlert     = document.getElementById('admin-portafolio-alert');

  async function loadAdminPortafolio() {
    try {
      const res = await fetch(`${SirioAuth.API_BASE}/api/client/portafolio`);
      const data = await res.json();
      if (data.success) {
        adminAllExams = data.portafolio || [];
        adminCustomCategories = data.categorias_adicionales || [];
        
        // Cargar estado de visibilidad
        const visibilityToggle = document.getElementById('admin-portafolio-visibility-toggle');
        if (visibilityToggle) {
          visibilityToggle.checked = data.visible !== false;
        }

        adminInitCategories();
        updateSectionsDatalist();
        renderAdminPortafolioTable();
      }
    } catch (err) {
      console.error('Error al cargar portafolio (admin):', err);
    }
  }

  function updateSectionsDatalist() {
    const listEl = document.getElementById('sections-datalist');
    if (!listEl) return;
    const sections = [...new Set([...adminAllExams.map(i => i.seccion), ...adminCustomCategories])];
    listEl.innerHTML = sections.map(sec => `<option value="${sec}"></option>`).join('');
  }

  function adminInitCategories() {
    if (!adminPortafolioCats) return;
    const sections = ['TODOS', ...new Set([...adminAllExams.map(i => i.seccion), ...adminCustomCategories])];
    adminPortafolioCats.innerHTML = sections.map(sec => {
      const active = sec === adminPortafolioCategory;
      return `<button class="admin-cat-pill" data-cat="${sec}" style="
        padding: 6px 14px; font-size: 0.78rem; border-radius: 20px; white-space: nowrap; height: 32px;
        border: 1px solid ${active ? 'var(--color-primary)' : 'var(--border-light)'};
        background: ${active ? 'var(--color-primary)' : 'rgba(255,255,255,0.03)'};
        color: ${active ? '#fff' : 'var(--text-muted)'}; cursor: pointer; transition: all 0.2s;
        font-family: inherit; font-weight: ${active ? '600' : '400'};
      ">${sec}</button>`;
    }).join('');

    adminPortafolioCats.querySelectorAll('.admin-cat-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        adminPortafolioCategory = btn.dataset.cat;
        adminPortafolioCats.querySelectorAll('.admin-cat-pill').forEach(b => {
          b.style.background = 'rgba(255,255,255,0.03)';
          b.style.color = 'var(--text-muted)';
          b.style.border = '1px solid var(--border-light)';
          b.style.fontWeight = '400';
        });
        btn.style.background = 'var(--color-primary)';
        btn.style.color = '#fff';
        btn.style.border = '1px solid var(--color-primary)';
        btn.style.fontWeight = '600';
        renderAdminPortafolioTable();
      });
    });
  }

  function renderAdminPortafolioTable() {
    if (!adminPortafolioTableBody) return;
    const query = adminSearchPortafolio ? adminSearchPortafolio.value.toLowerCase().trim() : '';
    const filtered = adminAllExams.filter(item => {
      const matchCat = adminPortafolioCategory === 'TODOS' || item.seccion === adminPortafolioCategory;
      const matchSearch = item.examen.toLowerCase().includes(query) || item.seccion.toLowerCase().includes(query);
      return matchCat && matchSearch;
    });

    if (filtered.length === 0) {
      adminPortafolioTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2.5rem 0;color:var(--text-dark);">No se encontraron exámenes.</td></tr>`;
      return;
    }

    // Group by section when showing ALL (6 columns)
    if (adminPortafolioCategory === 'TODOS') {
      const sections = [...new Set(filtered.map(i => i.seccion))];
      adminPortafolioTableBody.innerHTML = sections.map(sec => {
        const items = filtered.filter(i => i.seccion === sec);
        const rows = items.map(item => buildAdminRow(item)).join('');
        return `<tr><td colspan="6" style="padding:12px 10px 4px;background:rgba(14,165,233,0.06);border-bottom:none;">
          <span style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--color-primary);">${sec}</span>
        </td></tr>${rows}`;
      }).join('');
    } else {
      adminPortafolioTableBody.innerHTML = filtered.map(item => buildAdminRow(item)).join('');
    }

    // Attach edit events
    adminPortafolioTableBody.querySelectorAll('[contenteditable="true"]').forEach(cell => {
      cell.addEventListener('input', () => {
        const id = cell.closest('tr').dataset.id;
        const field = cell.dataset.field;
        if (!adminPendingChanges[id]) adminPendingChanges[id] = {};

        let value = cell.innerText.trim();
        // Clean price if needed
        if (field === 'precio') value = parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
        adminPendingChanges[id][field] = value;

        if (adminSaveBtn) adminSaveBtn.disabled = false;
        cell.closest('tr').style.background = 'rgba(234,179,8,0.06)';
      });
    });

    // Attach delete events
    adminPortafolioTableBody.querySelectorAll('.admin-delete-exam-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const idExamen = btn.dataset.id;
        const row = btn.closest('tr');
        const examName = row.cells[0].innerText;
        
        if (!confirm(`¿Está seguro de que desea eliminar el examen "${examName}" del portafolio?`)) {
          return;
        }

        try {
          const res = await fetch(`${SirioAuth.API_BASE}/api/admin/portafolio/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SirioAuth.getToken()}` },
            body: JSON.stringify({ id_examen: idExamen })
          });
          const result = await res.json();
          if (result.success) {
            // Remove from local memory
            adminAllExams = adminAllExams.filter(item => item.id_examen !== idExamen);
            renderAdminPortafolioTable();
            
            if (adminPortafolioAlert) {
              adminPortafolioAlert.style.display = 'block';
              adminPortafolioAlert.style.background = 'rgba(34,197,94,0.1)';
              adminPortafolioAlert.style.border = '1px solid rgba(34,197,94,0.3)';
              adminPortafolioAlert.style.color = '#86efac';
              adminPortafolioAlert.innerHTML = `<i class="fa-solid fa-circle-check" style="margin-right:6px;"></i>¡Examen eliminado correctamente!`;
              setTimeout(() => { if (adminPortafolioAlert) adminPortafolioAlert.style.display = 'none'; }, 4000);
            }
          } else {
            alert(result.message || 'Error al eliminar el examen.');
          }
        } catch (err) {
          console.error('Error al eliminar examen:', err);
        }
      });
    });
  }

  function buildAdminRow(item) {
    const saved = adminPendingChanges[item.id_examen] || {};
    const precio = saved.precio !== undefined ? saved.precio : item.precio;
    const tiempo = saved.tiempo_reporte !== undefined ? saved.tiempo_reporte : item.tiempo_reporte;
    const muestra = saved.muestra !== undefined ? saved.muestra : item.muestra;
    const recipiente = saved.recipiente !== undefined ? saved.recipiente : (item.recipiente || '');

    return `<tr data-id="${item.id_examen}" style="border-bottom:1px solid var(--border-light);transition:background 0.15s;">
      <td style="padding:10px;font-weight:600;color:var(--text-main);font-size:0.85rem;">${item.examen}</td>
      <td style="padding:10px;text-align:right;">
        <span contenteditable="true" data-field="precio"
          style="display:inline-block;min-width:90px;padding:4px 8px;border-radius:5px;border:1px solid var(--border-light);
                 background:rgba(255,255,255,0.03);font-weight:700;color:var(--color-accent);text-align:right;font-size:0.9rem;"
          spellcheck="false">${precio}</span>
      </td>
      <td style="padding:10px;">
        <span contenteditable="true" data-field="tiempo_reporte"
          style="display:inline-block;min-width:80px;padding:4px 8px;border-radius:5px;border:1px solid var(--border-light);
                 background:rgba(255,255,255,0.03);color:var(--text-main);font-size:0.82rem;"
          spellcheck="false">${tiempo}</span>
      </td>
      <td style="padding:10px;">
        <span contenteditable="true" data-field="muestra"
          style="display:inline-block;min-width:80px;padding:4px 8px;border-radius:5px;border:1px solid var(--border-light);
                 background:rgba(255,255,255,0.03);color:var(--text-main);font-size:0.82rem;"
          spellcheck="false">${muestra}</span>
      </td>
      <td style="padding:10px;">
        <span contenteditable="true" data-field="recipiente"
          style="display:inline-block;min-width:80px;padding:4px 8px;border-radius:5px;border:1px solid var(--border-light);
                 background:rgba(255,255,255,0.03);color:var(--text-muted);font-size:0.78rem;"
          spellcheck="false">${recipiente}</span>
      <td style="padding:10px;text-align:center;">
        <button class="admin-delete-exam-btn" data-id="${item.id_examen}" style="background:transparent;border:none;color:var(--error);cursor:pointer;font-size:0.95rem;padding:4px;" title="Eliminar examen del portafolio">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    </tr>`;
  }

  if (adminSearchPortafolio) adminSearchPortafolio.addEventListener('input', renderAdminPortafolioTable);

  // Switch de Visibilidad del Portafolio para Clientes
  const visibilityToggle = document.getElementById('admin-portafolio-visibility-toggle');
  if (visibilityToggle) {
    visibilityToggle.addEventListener('change', async () => {
      try {
        const visible = visibilityToggle.checked;
        const res = await fetch(`${SirioAuth.API_BASE}/api/admin/portafolio/visibility`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SirioAuth.getToken()}` },
          body: JSON.stringify({ visible })
        });
        const data = await res.json();
        
        if (data.success) {
          // Sincronizar con el toggle de configuración
          const configVisibilityToggle = document.getElementById('config-portafolio-visibility-toggle');
          if (configVisibilityToggle) {
            configVisibilityToggle.checked = visible;
          }
        }

        if (adminPortafolioAlert) {
          adminPortafolioAlert.style.display = 'block';
          adminPortafolioAlert.style.background = data.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)';
          adminPortafolioAlert.style.border = `1px solid ${data.success ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`;
          adminPortafolioAlert.style.color = data.success ? '#86efac' : '#fca5a5';
          adminPortafolioAlert.innerHTML = `<i class="fa-solid ${data.success ? 'fa-circle-check' : 'fa-circle-xmark'}" style="margin-right:6px;"></i>Visibilidad del portafolio actualizada: ${visible ? 'Visible para Clientes' : 'Oculto en Mantenimiento'}`;
          setTimeout(() => { if (adminPortafolioAlert) adminPortafolioAlert.style.display = 'none'; }, 4000);
        }
      } catch (err) {
        console.error('Error al cambiar visibilidad:', err);
      }
    });
  }

  // Modal para Añadir Examen
  const addExamenModal  = document.getElementById('add-examen-modal');
  const addExamenBtn    = document.getElementById('admin-add-examen-btn');
  const closeExamenBtn  = document.getElementById('close-add-examen-modal');
  const cancelExamenBtn = document.getElementById('cancel-add-examen-btn');
  const addExamenForm   = document.getElementById('add-examen-form');

  if (addExamenBtn && addExamenModal) {
    addExamenBtn.addEventListener('click', () => {
      if (addExamenForm) addExamenForm.reset();
      addExamenModal.style.display = 'flex';
    });
  }

  const hideAddExamenModal = () => {
    if (addExamenModal) addExamenModal.style.display = 'none';
  };

  if (closeExamenBtn) closeExamenBtn.addEventListener('click', hideAddExamenModal);
  if (cancelExamenBtn) cancelExamenBtn.addEventListener('click', hideAddExamenModal);

  if (addExamenForm) {
    addExamenForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const newExam = {
        examen: document.getElementById('new-exam-name').value.trim(),
        seccion: document.getElementById('new-exam-section').value.trim(),
        precio: parseFloat(document.getElementById('new-exam-price').value) || 0,
        tiempo_reporte: document.getElementById('new-exam-time').value.trim(),
        muestra: document.getElementById('new-exam-sample').value.trim(),
        recipiente: document.getElementById('new-exam-container').value.trim()
      };

      try {
        const res = await fetch(`${SirioAuth.API_BASE}/api/admin/portafolio/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SirioAuth.getToken()}` },
          body: JSON.stringify(newExam)
        });
        const data = await res.json();
        
        if (data.success) {
          hideAddExamenModal();
          // Volver a cargar el portafolio
          loadAdminPortafolio();
          
          if (adminPortafolioAlert) {
            adminPortafolioAlert.style.display = 'block';
            adminPortafolioAlert.style.background = 'rgba(34,197,94,0.1)';
            adminPortafolioAlert.style.border = '1px solid rgba(34,197,94,0.3)';
            adminPortafolioAlert.style.color = '#86efac';
            adminPortafolioAlert.innerHTML = `<i class="fa-solid fa-circle-check" style="margin-right:6px;"></i>¡Examen "${newExam.examen}" añadido exitosamente!`;
            setTimeout(() => { if (adminPortafolioAlert) adminPortafolioAlert.style.display = 'none'; }, 5000);
          }
        } else {
          alert(data.message || 'Error al añadir el examen.');
        }
      } catch (err) {
        console.error('Error al añadir examen:', err);
      }
    });
  }

  if (adminSaveBtn) {
    adminSaveBtn.addEventListener('click', async () => {
      if (Object.keys(adminPendingChanges).length === 0) return;
      adminSaveBtn.disabled = true;
      adminSaveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

      // Apply pending changes to in-memory data
      adminAllExams = adminAllExams.map(item => {
        if (adminPendingChanges[item.id_examen]) {
          return { ...item, ...adminPendingChanges[item.id_examen] };
        }
        return item;
      });

      try {
        const res = await fetch(`${SirioAuth.API_BASE}/api/admin/portafolio/precios`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SirioAuth.getToken()}` },
          body: JSON.stringify({ precios: adminPendingChanges })
        });
        const data = await res.json();
        adminPendingChanges = {};

        if (adminPortafolioAlert) {
          adminPortafolioAlert.style.display = 'block';
          adminPortafolioAlert.style.background = data.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)';
          adminPortafolioAlert.style.border = `1px solid ${data.success ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`;
          adminPortafolioAlert.style.color = data.success ? '#86efac' : '#fca5a5';
          adminPortafolioAlert.innerHTML = `<i class="fa-solid ${data.success ? 'fa-circle-check' : 'fa-circle-xmark'}" style="margin-right:6px;"></i>${data.message || (data.success ? '¡Precios actualizados exitosamente!' : 'Error al guardar.')}`;
          setTimeout(() => { if (adminPortafolioAlert) adminPortafolioAlert.style.display = 'none'; }, 5000);
        }
        renderAdminPortafolioTable();
      } catch (err) {
        console.error('Error guardando portafolio:', err);
      }

      adminSaveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios';
    });
  }

  if (adminDownloadBtn) {
    adminDownloadBtn.addEventListener('click', () => window.open('/portafolio-print.html', '_blank'));
  }

  // Cargar el portafolio al hacer click en la pestaña
  const portafolioAdminTabBtn = document.querySelector('[data-tab="tab-portafolio-admin"]');
  if (portafolioAdminTabBtn) {
    portafolioAdminTabBtn.addEventListener('click', () => {
      if (adminAllExams.length === 0) loadAdminPortafolio();
    });
  }

  // Modal para Añadir Categoría
  const addCategoriaModal  = document.getElementById('add-categoria-modal');
  const addCategoriaBtn    = document.getElementById('admin-add-category-btn');
  const closeCategoriaBtn  = document.getElementById('close-add-categoria-modal');
  const cancelCategoriaBtn = document.getElementById('cancel-add-categoria-btn');
  const addCategoriaForm   = document.getElementById('add-categoria-form');

  if (addCategoriaBtn && addCategoriaModal) {
    addCategoriaBtn.addEventListener('click', () => {
      if (addCategoriaForm) addCategoriaForm.reset();
      addCategoriaModal.style.display = 'flex';
    });
  }

  const hideAddCategoriaModal = () => {
    if (addCategoriaModal) addCategoriaModal.style.display = 'none';
  };

  if (closeCategoriaBtn) closeCategoriaBtn.addEventListener('click', hideAddCategoriaModal);
  if (cancelCategoriaBtn) cancelCategoriaBtn.addEventListener('click', hideAddCategoriaModal);

  if (addCategoriaForm) {
    addCategoriaForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const categoryName = document.getElementById('new-category-name').value.trim();

      try {
        const res = await fetch(`${SirioAuth.API_BASE}/api/admin/portafolio/category`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SirioAuth.getToken()}` },
          body: JSON.stringify({ category: categoryName })
        });
        const data = await res.json();
        
        if (data.success) {
          hideAddCategoriaModal();
          // Recargar el portafolio para ver la nueva categoría reflejada en las pills y datalist
          loadAdminPortafolio();
          
          if (adminPortafolioAlert) {
            adminPortafolioAlert.style.display = 'block';
            adminPortafolioAlert.style.background = 'rgba(34,197,94,0.1)';
            adminPortafolioAlert.style.border = '1px solid rgba(34,197,94,0.3)';
            adminPortafolioAlert.style.color = '#86efac';
            adminPortafolioAlert.innerHTML = `<i class="fa-solid fa-circle-check" style="margin-right:6px;"></i>¡Categoría "${categoryName.toUpperCase()}" añadida exitosamente!`;
            setTimeout(() => { if (adminPortafolioAlert) adminPortafolioAlert.style.display = 'none'; }, 5000);
          }
        } else {
          alert(data.message || 'Error al añadir la categoría.');
        }
      } catch (err) {
        console.error('Error al añadir categoría:', err);
      }
    });
  }

  // Lógica de Selección Masiva en el Historial General
  const selectAllChk = document.getElementById('select-all-results-chk');
  const deleteSelectedBtn = document.getElementById('delete-selected-results-btn');

  if (selectAllChk && deleteSelectedBtn) {
    selectAllChk.addEventListener('change', () => {
      const chks = allResultsTableBody.querySelectorAll('.select-result-chk');
      chks.forEach(chk => chk.checked = selectAllChk.checked);
      updateDeleteSelectedButtonState();
    });

    allResultsTableBody.addEventListener('change', (e) => {
      if (e.target.classList.contains('select-result-chk')) {
        updateDeleteSelectedButtonState();
      }
    });

    function updateDeleteSelectedButtonState() {
      const chks = allResultsTableBody.querySelectorAll('.select-result-chk');
      const selected = Array.from(chks).filter(chk => chk.checked);
      const count = selected.length;
      
      if (count > 0) {
        deleteSelectedBtn.style.display = 'flex';
        deleteSelectedBtn.querySelector('span').innerText = `Eliminar Seleccionados (${count})`;
      } else {
        deleteSelectedBtn.style.display = 'none';
      }

      // Actualizar estado del master checkbox
      selectAllChk.checked = (chks.length > 0 && count === chks.length);
    }

    // Acción de eliminar seleccionados (Masivo)
    deleteSelectedBtn.addEventListener('click', async () => {
      const chks = allResultsTableBody.querySelectorAll('.select-result-chk');
      const selectedIds = Array.from(chks)
        .filter(chk => chk.checked)
        .map(chk => chk.dataset.id);

      if (selectedIds.length === 0) return;

      const confirmDelete = confirm(`¿Está seguro de que desea eliminar los ${selectedIds.length} exámenes seleccionados? Se borrarán permanentemente de la base de datos y sus archivos PDF asociados.`);
      if (!confirmDelete) return;

      SirioAuth.showLoading('Eliminando exámenes...');

      try {
        const response = await fetch(`${SirioAuth.API_BASE}/api/admin/delete-results-bulk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ids: selectedIds })
        });
        const data = await response.json();

        if (data.success) {
          showGlobalAlert(data.message || 'Exámenes eliminados correctamente.', 'success');
          // Recargar historial general
          await loadGeneralOverview();
        } else {
          showGlobalAlert(data.message || 'Error al eliminar exámenes.', 'error');
        }
      } catch (error) {
        console.error('Error en eliminación masiva:', error);
        showGlobalAlert('Error de conexión al eliminar exámenes.', 'error');
      } finally {
        SirioAuth.hideLoading();
      }
    });
  }

  // Lógica de Eliminación por Rango de Fechas (Zona de Peligro)
  const deleteRangeBtn = document.getElementById('delete-range-btn');
  const deleteRangeStart = document.getElementById('delete-range-start');
  const deleteRangeEnd = document.getElementById('delete-range-end');

  if (deleteRangeBtn && deleteRangeStart && deleteRangeEnd) {
    deleteRangeBtn.addEventListener('click', async () => {
      const startVal = deleteRangeStart.value;
      const endVal = deleteRangeEnd.value;

      if (!startVal || !endVal) {
        alert('Por favor, selecciona tanto la fecha de inicio como la de fin.');
        return;
      }

      if (new Date(startVal) > new Date(endVal)) {
        alert('La fecha de inicio no puede ser posterior a la fecha fin.');
        return;
      }

      const confirmDelete = confirm(`⚠️ ADVERTENCIA CRÍTICA: Está a punto de eliminar de forma irreversible TODOS los exámenes publicados desde el ${startVal} hasta el ${endVal}. ¿Desea continuar?`);
      if (!confirmDelete) return;

      // Doble confirmación por seguridad
      const confirmText = prompt('Para confirmar esta acción de eliminación por rango de fechas, escriba "ELIMINAR RANGO" a continuación:');
      if (confirmText !== 'ELIMINAR RANGO') {
        alert('Confirmación incorrecta. Acción cancelada.');
        return;
      }

      SirioAuth.showLoading('Eliminando exámenes en el rango...');

      try {
        const response = await fetch(`${SirioAuth.API_BASE}/api/admin/delete-results-range`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fecha_inicio: startVal, fecha_fin: endVal })
        });
        const data = await response.json();

        if (data.success) {
          showGlobalAlert(data.message || 'Exámenes del rango eliminados correctamente.', 'success');
          deleteRangeStart.value = '';
          deleteRangeEnd.value = '';
          // Recargar historial general
          await loadGeneralOverview();
        } else {
          showGlobalAlert(data.message || 'Error al eliminar exámenes del rango.', 'error');
        }
      } catch (error) {
        console.error('Error al eliminar por rango:', error);
        showGlobalAlert('Error de conexión al eliminar por rango.', 'error');
      } finally {
        SirioAuth.hideLoading();
      }
    });
  }

  // === SECCIÓN DE MÉTRICAS Y ESTADÍSTICAS DEL SISTEMA ===
  let chartMonthlyTrend = null;
  let chartStaffDistribution = null;
  let chartTopClients = null;

  // DOM Elements para controles de estadísticas
  const statsFilterClient = document.getElementById('stats-filter-client');
  const statsFilterPeriod = document.getElementById('stats-filter-period');
  const statsCustomDates = document.getElementById('stats-custom-dates');
  const statsFilterDateFrom = document.getElementById('stats-filter-date-from');
  const statsFilterDateTo = document.getElementById('stats-filter-date-to');
  const statsResetFiltersBtn = document.getElementById('stats-reset-filters-btn');
  const refreshStatsBtn = document.getElementById('refresh-stats-btn');
  const statsActiveFilterBadge = document.getElementById('stats-active-filter-badge');

  // Banner y KPI Elements
  const statsClientFocusBanner = document.getElementById('stats-client-focus-banner');
  const statsClientFocusName = document.getElementById('stats-client-focus-name');
  const statsClientFocusId = document.getElementById('stats-client-focus-id');
  const statsClientFocusCount = document.getElementById('stats-client-focus-count');
  const statsClientFocusShare = document.getElementById('stats-client-focus-share');

  const statsKpiTotalLabel = document.getElementById('stats-kpi-total-label');
  const statsTotalResults = document.getElementById('stats-total-results');
  const statsKpi2Label = document.getElementById('stats-kpi2-label');
  const statsTopClient = document.getElementById('stats-top-client');
  const statsKpi2Icon = document.getElementById('stats-kpi2-icon');
  const statsKpi2IconWrap = document.getElementById('stats-kpi2-icon-wrap');
  const statsKpi3Label = document.getElementById('stats-kpi3-label');
  const statsTopUploader = document.getElementById('stats-top-uploader');
  const statsKpi4Label = document.getElementById('stats-kpi4-label');
  const statsKpi4Value = document.getElementById('stats-kpi4-value');

  const chartTrendTitle = document.getElementById('chart-trend-title');
  const chartTrendSubtitle = document.getElementById('chart-trend-subtitle');
  const chartStaffTitle = document.getElementById('chart-staff-title');
  const chartTopTitle = document.getElementById('chart-top-title');
  const statsRecentTableBody = document.getElementById('stats-recent-table-body');
  const statsRecentCountBadge = document.getElementById('stats-recent-count-badge');

  // Poblar dropdown de clientes en estadísticas
  function populateStatsFilters() {
    if (!statsFilterClient) return;
    const currentVal = statsFilterClient.value;
    statsFilterClient.innerHTML = '<option value="">📊 Todos los Clientes (Visión Global)</option>';

    // Unir clientes con exámenes existentes y ordenarlos
    const clientMap = new Map();
    allClients.forEach(c => clientMap.set(c.id_usuario, c.nombre));
    allResults.forEach(r => {
      if (r.id_usuario && !clientMap.has(r.id_usuario)) {
        clientMap.set(r.id_usuario, r.nombre_cliente || r.id_usuario);
      }
    });

    const sorted = Array.from(clientMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));
    sorted.forEach(([id, name]) => {
      // Contar resultados para este cliente
      const count = allResults.filter(r => r.id_usuario === id).length;
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = `${name} (${count} ${count === 1 ? 'examen' : 'exámenes'})`;
      if (id === currentVal) opt.selected = true;
      statsFilterClient.appendChild(opt);
    });
  }

  // Escuchar cambios de período (mes, año, personalizado)
  if (statsFilterPeriod) {
    statsFilterPeriod.addEventListener('change', () => {
      if (statsCustomDates) {
        statsCustomDates.style.display = statsFilterPeriod.value === 'custom' ? 'flex' : 'none';
      }
      loadAndRenderStats();
    });
  }
  if (statsFilterClient) statsFilterClient.addEventListener('change', loadAndRenderStats);
  if (statsFilterDateFrom) statsFilterDateFrom.addEventListener('change', loadAndRenderStats);
  if (statsFilterDateTo) statsFilterDateTo.addEventListener('change', loadAndRenderStats);

  if (statsResetFiltersBtn) {
    statsResetFiltersBtn.addEventListener('click', () => {
      if (statsFilterClient) statsFilterClient.value = '';
      if (statsFilterPeriod) statsFilterPeriod.value = 'all';
      if (statsCustomDates) statsCustomDates.style.display = 'none';
      if (statsFilterDateFrom) statsFilterDateFrom.value = '';
      if (statsFilterDateTo) statsFilterDateTo.value = '';
      loadAndRenderStats();
    });
  }

  if (refreshStatsBtn) {
    refreshStatsBtn.addEventListener('click', async () => {
      SirioAuth.showLoading('Actualizando datos estadísticos...');
      await loadGeneralOverview();
      SirioAuth.hideLoading();
    });
  }

  // Función principal para cargar y renderizar estadísticas interactivas
  function loadAndRenderStats() {
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js no está cargado.');
      return;
    }

    const selectedClientId = statsFilterClient ? statsFilterClient.value : '';
    const selectedPeriod = statsFilterPeriod ? statsFilterPeriod.value : 'all';
    const customFromStr = statsFilterDateFrom ? statsFilterDateFrom.value : '';
    const customToStr = statsFilterDateTo ? statsFilterDateTo.value : '';

    const isFiltered = !!selectedClientId || selectedPeriod !== 'all' || !!customFromStr || !!customToStr;
    if (statsActiveFilterBadge) {
      statsActiveFilterBadge.style.display = isFiltered ? 'inline-block' : 'none';
    }

    // Configurar tema de Chart.js
    const isLightMode = document.body.classList.contains('light-theme');
    Chart.defaults.font.family = "'Outfit', 'Inter', sans-serif";
    Chart.defaults.color = isLightMode ? 'rgba(30, 41, 59, 0.75)' : 'rgba(255, 255, 255, 0.65)';
    Chart.defaults.scale.grid.color = isLightMode ? 'rgba(30, 41, 59, 0.08)' : 'rgba(255, 255, 255, 0.05)';

    // Destruir gráficos previos
    if (chartMonthlyTrend) chartMonthlyTrend.destroy();
    if (chartStaffDistribution) chartStaffDistribution.destroy();
    if (chartTopClients) chartTopClients.destroy();

    // 1. Filtrar conjunto de datos para el análisis estadístico
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const filteredStatsResults = allResults.filter(res => {
      // Filtro de cliente
      if (selectedClientId && res.id_usuario !== selectedClientId) return false;

      // Filtro de fecha/período
      const resDate = parseFlexibleDate(res.fecha_subida);
      if (!resDate) return true; // si no tiene fecha identificable se deja por compatibilidad

      if (selectedPeriod === 'this_month') {
        if (resDate.getFullYear() !== currentYear || resDate.getMonth() !== currentMonth) return false;
      } else if (selectedPeriod === 'last_3_months') {
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        if (resDate < threeMonthsAgo) return false;
      } else if (selectedPeriod === 'this_year') {
        if (resDate.getFullYear() !== currentYear) return false;
      } else if (selectedPeriod === 'custom') {
        if (customFromStr) {
          const fromD = new Date(customFromStr + 'T00:00:00');
          if (resDate < fromD) return false;
        }
        if (customToStr) {
          const toD = new Date(customToStr + 'T23:59:59');
          if (resDate > toD) return false;
        }
      }

      return true;
    });

    const totalFilteredCount = filteredStatsResults.length;
    const globalTotalCount = allResults.length;

    // 2. Manejo de Banner y KPIs si hay Cliente Seleccionado
    const selectedClientObj = selectedClientId ? allClients.find(c => c.id_usuario === selectedClientId) : null;
    const selectedClientName = selectedClientObj ? selectedClientObj.nombre : selectedClientId;

    if (selectedClientId && statsClientFocusBanner) {
      statsClientFocusBanner.style.display = 'block';
      if (statsClientFocusName) statsClientFocusName.innerText = selectedClientName;
      if (statsClientFocusId) statsClientFocusId.innerText = `ID: ${selectedClientId}`;
      if (statsClientFocusCount) statsClientFocusCount.innerText = `${totalFilteredCount} exam.`;
      
      const sharePct = globalTotalCount > 0 ? ((totalFilteredCount / globalTotalCount) * 100).toFixed(1) : '0';
      if (statsClientFocusShare) statsClientFocusShare.innerText = `${sharePct}% del total`;
    } else if (statsClientFocusBanner) {
      statsClientFocusBanner.style.display = 'none';
    }

    // Actualizar KPI 1 (Total)
    if (statsTotalResults) statsTotalResults.innerText = totalFilteredCount;
    if (statsKpiTotalLabel) {
      statsKpiTotalLabel.innerText = selectedClientId ? 'Exámenes del Cliente' : (isFiltered ? 'Exámenes Filtrados' : 'Total Exámenes');
    }

    // Contadores auxiliares por cliente y uploader
    const clientCounts = {};
    const uploaderCounts = {};
    let latestUploadDate = null;
    let latestUploadResult = null;

    filteredStatsResults.forEach(res => {
      // Cliente
      if (res.id_usuario) {
        clientCounts[res.id_usuario] = (clientCounts[res.id_usuario] || 0) + 1;
      }
      // Colaborador / Uploader
      const uploader = res.admin_nombre || res.admin_id || 'Desconocido';
      uploaderCounts[uploader] = (uploaderCounts[uploader] || 0) + 1;

      // Calcular más reciente
      const rDate = parseFlexibleDate(res.fecha_subida);
      if (rDate && (!latestUploadDate || rDate > latestUploadDate)) {
        latestUploadDate = rDate;
        latestUploadResult = res;
      }
    });

    // Actualizar KPI 2: Si cliente seleccionado -> "Último Examen Enviado"; Si visión global -> "Cliente Estrella"
    if (selectedClientId) {
      if (statsKpi2Label) statsKpi2Label.innerText = 'Último Envío';
      if (statsKpi2Icon) statsKpi2Icon.className = 'fa-solid fa-clock-rotate-left';
      if (statsKpi2IconWrap) {
        statsKpi2IconWrap.style.background = 'rgba(56, 189, 248, 0.12)';
        statsKpi2IconWrap.style.color = '#38bdf8';
      }
      if (statsTopClient) {
        if (latestUploadResult) {
          const dateStr = SirioAuth.formatDate(latestUploadResult.fecha_subida).split(',')[0];
          statsTopClient.innerText = `${latestUploadResult.nombre_examen} (${dateStr})`;
          statsTopClient.title = `${latestUploadResult.nombre_examen} - ${SirioAuth.formatDate(latestUploadResult.fecha_subida)}`;
        } else {
          statsTopClient.innerText = 'Sin registros';
          statsTopClient.title = 'Sin registros';
        }
      }
    } else {
      if (statsKpi2Label) statsKpi2Label.innerText = 'Cliente Estrella';
      if (statsKpi2Icon) statsKpi2Icon.className = 'fa-solid fa-trophy';
      if (statsKpi2IconWrap) {
        statsKpi2IconWrap.style.background = 'rgba(236, 72, 153, 0.12)';
        statsKpi2IconWrap.style.color = '#f472b6';
      }

      let topCId = '';
      let topCCount = 0;
      for (const cid in clientCounts) {
        if (clientCounts[cid] > topCCount) {
          topCCount = clientCounts[cid];
          topCId = cid;
        }
      }
      let topCName = 'Ninguno';
      if (topCId) {
        const client = allClients.find(c => c.id_usuario === topCId);
        topCName = client ? `${client.nombre} (${topCCount} env.)` : `${topCId} (${topCCount} env.)`;
      }
      if (statsTopClient) {
        statsTopClient.innerText = topCName;
        statsTopClient.title = topCName;
      }
    }

    // Actualizar KPI 3: Colaborador Activo
    let topUploaderName = 'Ninguno';
    let topUploaderCount = 0;
    for (const name in uploaderCounts) {
      if (name !== 'Desconocido' && uploaderCounts[name] > topUploaderCount) {
        topUploaderCount = uploaderCounts[name];
        topUploaderName = `${name} (${topUploaderCount} env.)`;
      }
    }
    if (statsTopUploader) {
      statsTopUploader.innerText = topUploaderName;
      statsTopUploader.title = topUploaderName;
    }

    // Actualizar KPI 4: Promedio diario estimado o tipo de examen predominante
    if (selectedClientId) {
      if (statsKpi4Label) statsKpi4Label.innerText = 'Colaboradores que procesaron';
      const staffCount = Object.keys(uploaderCounts).filter(u => u !== 'Desconocido').length;
      if (statsKpi4Value) statsKpi4Value.innerText = `${staffCount} miembros`;
    } else {
      if (statsKpi4Label) statsKpi4Label.innerText = 'Promedio por Cliente';
      const activeClientsCount = Object.keys(clientCounts).length;
      const avg = activeClientsCount > 0 ? (totalFilteredCount / activeClientsCount).toFixed(1) : 0;
      if (statsKpi4Value) statsKpi4Value.innerText = `${avg} env./cliente`;
    }

    // === GRÁFICO 1: TENDENCIA TEMPORAL (Evolución de Envíos) ===
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthlyCounts = {};

    filteredStatsResults.forEach(res => {
      const d = parseFlexibleDate(res.fecha_subida);
      if (d) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const key = `${year}-${month}`;
        monthlyCounts[key] = (monthlyCounts[key] || 0) + 1;
      }
    });

    // Construir una línea de tiempo coherente y continua
    let timelineKeys = Object.keys(monthlyCounts).sort();

    if (timelineKeys.length === 0) {
      // Si no hay datos, mostrar los últimos 6 meses en cero
      timelineKeys = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        timelineKeys.push(`${y}-${m}`);
      }
    } else if (timelineKeys.length === 1) {
      // Si solo hay 1 mes con datos (ej. un solo punto), agregar contexto (2 meses antes y 1 después) para que no quede pegado a la izquierda
      const [onlyY, onlyM] = timelineKeys[0].split('-').map(Number);
      const expanded = [];
      for (let offset = -2; offset <= 2; offset++) {
        const d = new Date(onlyY, (onlyM - 1) + offset, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        expanded.push(`${y}-${m}`);
      }
      timelineKeys = expanded;
    } else {
      // Si hay 2 o más meses, rellenar los meses intermedios vacíos para que la escala temporal sea real
      const startParts = timelineKeys[0].split('-').map(Number);
      const endParts = timelineKeys[timelineKeys.length - 1].split('-').map(Number);
      const startDate = new Date(startParts[0], startParts[1] - 1, 1);
      const endDate = new Date(endParts[0], endParts[1] - 1, 1);
      
      const continuousKeys = [];
      const cursor = new Date(startDate);
      // Incluir 1 mes antes para margen estético
      cursor.setMonth(cursor.getMonth() - 1);
      const limitDate = new Date(endDate);
      limitDate.setMonth(limitDate.getMonth() + 1);

      while (cursor <= limitDate) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, '0');
        continuousKeys.push(`${y}-${m}`);
        cursor.setMonth(cursor.getMonth() + 1);
      }
      timelineKeys = continuousKeys;
    }

    const trendLabels = timelineKeys.map(k => {
      const [year, month] = k.split('-');
      const mIdx = parseInt(month, 10) - 1;
      return `${monthNames[mIdx]} ${year}`;
    });
    const trendValues = timelineKeys.map(k => monthlyCounts[k] || 0);

    const maxVal = Math.max(...trendValues, 0);
    const suggestedMax = maxVal === 0 ? 5 : (maxVal <= 5 ? maxVal + 2 : Math.ceil(maxVal * 1.25));

    if (chartTrendTitle) {
      chartTrendTitle.innerHTML = selectedClientId
        ? `<i class="fa-solid fa-chart-area"></i> Flujo Histórico para ${selectedClientName}`
        : `<i class="fa-solid fa-chart-area"></i> Flujo Histórico de Exámenes Enviados`;
    }
    if (chartTrendSubtitle) {
      chartTrendSubtitle.innerText = isFiltered ? `Filtrado (${totalFilteredCount} exámenes)` : 'Evolución mensual';
    }

    const ctxTrend = document.getElementById('chart-monthly-trend');
    if (ctxTrend) {
      chartMonthlyTrend = new Chart(ctxTrend, {
        type: 'line',
        data: {
          labels: trendLabels,
          datasets: [{
            label: selectedClientId ? `Exámenes para ${selectedClientName}` : 'Exámenes Enviados',
            data: trendValues,
            borderColor: selectedClientId ? '#a855f7' : '#38bdf8',
            backgroundColor: selectedClientId ? 'rgba(168, 85, 247, 0.15)' : 'rgba(56, 189, 248, 0.12)',
            borderWidth: 3,
            tension: 0.3,
            fill: true,
            pointBackgroundColor: selectedClientId ? '#c084fc' : '#38bdf8',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              titleColor: '#38bdf8',
              bodyColor: '#ffffff',
              padding: 10,
              cornerRadius: 8,
              callbacks: {
                label: (ctx) => ` ${ctx.parsed.y} ${ctx.parsed.y === 1 ? 'examen enviado' : 'exámenes enviados'}`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              suggestedMax: suggestedMax,
              ticks: {
                stepSize: 1,
                precision: 0
              },
              grid: {
                drawBorder: false
              }
            },
            x: {
              grid: {
                display: false
              },
              ticks: {
                maxRotation: 30,
                minRotation: 0,
                autoSkip: true,
                maxTicksLimit: 12
              }
            }
          }
        }
      });
    }

    // === GRÁFICO 2: PARTICIPACIÓN DEL PERSONAL ===
    const staffLabels = [];
    const staffValues = [];
    for (const name in uploaderCounts) {
      if (name !== 'Desconocido') {
        staffLabels.push(name);
        staffValues.push(uploaderCounts[name]);
      }
    }
    if (uploaderCounts['Desconocido']) {
      staffLabels.push('Otros / Sin dato');
      staffValues.push(uploaderCounts['Desconocido']);
    }

    if (chartStaffTitle) {
      chartStaffTitle.innerHTML = selectedClientId
        ? `<i class="fa-solid fa-users-gear"></i> Personal que procesó a este cliente`
        : `<i class="fa-solid fa-chart-pie"></i> Participación del Personal (Exámenes Subidos)`;
    }

    const ctxStaff = document.getElementById('chart-staff-distribution');
    if (ctxStaff) {
      chartStaffDistribution = new Chart(ctxStaff, {
        type: 'doughnut',
        data: {
          labels: staffLabels.length ? staffLabels : ['Sin Datos'],
          datasets: [{
            data: staffValues.length ? staffValues : [0],
            backgroundColor: [
              '#38bdf8', '#c084fc', '#f472b6', '#f59e0b', '#10b981', '#ec4899', '#6366f1', '#14b8a6'
            ],
            borderWidth: 1.5,
            borderColor: 'var(--panel-bg)'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { boxWidth: 12, padding: 12, font: { size: 11 } }
            }
          }
        }
      });
    }

    // === GRÁFICO 3: TOP CLIENTES (O EXÁMENES MÁS FRECUENTES DEL CLIENTE) ===
    const ctxClients = document.getElementById('chart-top-clients');
    if (ctxClients) {
      if (selectedClientId) {
        // Modo cliente individual: mostrar los nombres de exámenes más frecuentes solicitados
        if (chartTopTitle) {
          chartTopTitle.innerHTML = `<i class="fa-solid fa-vial"></i> Exámenes más solicitados por ${selectedClientName}`;
        }
        const examNameCounts = {};
        filteredStatsResults.forEach(r => {
          const ex = r.nombre_examen || 'Sin nombre';
          examNameCounts[ex] = (examNameCounts[ex] || 0) + 1;
        });
        const examList = Object.entries(examNameCounts).map(([name, count]) => ({ name, count }));
        examList.sort((a, b) => b.count - a.count);
        const top5Exams = examList.slice(0, 5);

        chartTopClients = new Chart(ctxClients, {
          type: 'bar',
          data: {
            labels: top5Exams.length ? top5Exams.map(e => e.name) : ['Sin Datos'],
            datasets: [{
              label: 'Cantidad',
              data: top5Exams.length ? top5Exams.map(e => e.count) : [0],
              backgroundColor: 'rgba(168, 85, 247, 0.45)',
              borderColor: '#c084fc',
              borderWidth: 1.5,
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            },
            scales: {
              y: { beginAtZero: true, ticks: { stepSize: 1 } },
              x: { ticks: { font: { size: 10 }, maxRotation: 30, minRotation: 0 } }
            }
          }
        });
      } else {
        // Modo global: Top 5 Clientes con mayor demanda
        if (chartTopTitle) {
          chartTopTitle.innerHTML = `<i class="fa-solid fa-ranking-star"></i> Top Clientes con Mayor Demanda`;
        }
        const clientDataList = [];
        for (const cid in clientCounts) {
          const client = allClients.find(c => c.id_usuario === cid);
          clientDataList.push({
            name: client ? client.nombre : cid,
            count: clientCounts[cid]
          });
        }
        clientDataList.sort((a, b) => b.count - a.count);
        const top5Clients = clientDataList.slice(0, 5);

        chartTopClients = new Chart(ctxClients, {
          type: 'bar',
          data: {
            labels: top5Clients.length ? top5Clients.map(c => c.name) : ['Sin Datos'],
            datasets: [{
              label: 'Exámenes Subidos',
              data: top5Clients.length ? top5Clients.map(c => c.count) : [0],
              backgroundColor: 'rgba(236, 72, 153, 0.45)',
              borderColor: '#f472b6',
              borderWidth: 1.5,
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            },
            scales: {
              y: { beginAtZero: true, ticks: { stepSize: 1 } },
              x: { ticks: { font: { size: 10 }, maxRotation: 25, minRotation: 0 } }
            }
          }
        });
      }
    }

    // === TABLA DE ÚLTIMOS EXÁMENES DEL SEGMENTO FILTRADO ===
    if (statsRecentTableBody) {
      if (filteredStatsResults.length === 0) {
        statsRecentTableBody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem 0;">
              No se encontraron exámenes para los criterios de filtro seleccionados.
            </td>
          </tr>
        `;
        if (statsRecentCountBadge) statsRecentCountBadge.innerText = '0 registros encontrados';
      } else {
        // Ordenar los más recientes primero y tomar hasta 8
        const sortedRecent = [...filteredStatsResults].reverse().slice(0, 8);
        if (statsRecentCountBadge) {
          statsRecentCountBadge.innerText = `Mostrando ${sortedRecent.length} de ${filteredStatsResults.length} resultados`;
        }
        statsRecentTableBody.innerHTML = sortedRecent.map(res => `
          <tr style="border-bottom: 1px solid var(--border-light);">
            <td style="padding: 10px 14px; font-weight: 500; color: var(--text-main); font-size: 0.85rem; max-width: 140px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${res.nombre_cliente}">
              ${res.nombre_cliente}
            </td>
            <td style="padding: 10px 14px; color: var(--text-main); font-weight: 600; font-size: 0.85rem; max-width: 220px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${res.nombre_examen}">
              <i class="fa-solid fa-file-pdf" style="color: var(--error); margin-right: 6px;"></i> ${res.nombre_examen}
            </td>
            <td style="padding: 10px 14px; color: var(--text-muted); font-size: 0.78rem;">
              ${SirioAuth.formatDate(res.fecha_subida)}
            </td>
            <td style="padding: 10px 14px; color: var(--text-main); font-size: 0.82rem;">
              <i class="fa-solid fa-user-shield" style="color: var(--color-primary); margin-right: 4px; font-size: 0.75rem;"></i>
              ${res.admin_nombre || res.admin_id || '<span style="color:var(--text-muted);">Sin dato</span>'}
            </td>
            <td style="padding: 10px 14px; text-align: center;">
              <a href="${getPdfUrl(res.nombre_archivo)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-icon" style="padding: 3px 7px;" title="Ver PDF">
                <i class="fa-solid fa-eye" style="font-size: 0.8rem;"></i>
              </a>
            </td>
          </tr>
        `).join('');
      }
    }
  }

  // ==========================================================================
  // MÓDULO DE INGRESO DE PACIENTES PARA ADMINISTRADORES (SIEMPRE ACTIVO)
  // ==========================================================================
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

  let selectedAdminIngresarExams = new Set();
  let currentAdminIngresarCat = 'COMUNES';

  // Poblar select de veterinarias/clientes para el admin
  function populateAdminClientSelect() {
    const select = document.getElementById('admin-ingresar-client-select');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="" disabled selected>Seleccione la veterinaria o cliente...</option>';

    const sortedClients = [...allClients].sort((a, b) => a.nombre.localeCompare(b.nombre));
    sortedClients.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id_usuario;
      opt.setAttribute('data-name', c.nombre);
      opt.setAttribute('data-email', c.correo || '');
      opt.setAttribute('data-phone', c.telefono || '');
      opt.setAttribute('data-address', c.direccion || '');
      opt.textContent = `${c.nombre} (ID: ${c.id_usuario} - DNI: ${c.identificacion})`;
      if (c.id_usuario === currentVal) opt.selected = true;
      select.appendChild(opt);
    });
  }

  // Renderizar la lista de exámenes según la categoría o búsqueda
  function renderAdminIngresarExams() {
    const listContainer = document.getElementById('admin-ingresar-exam-list');
    const searchInput = document.getElementById('admin-search-ingresar-exam');
    if (!listContainer) return;

    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let listToRender = [];
    if (query) {
      const all = [...EXAMS_COMUNES, ...EXAMS_PERFILES, ...EXAMS_CULTIVOS, ...EXAMS_TOXICOLOGIA, ...EXAMS_INDIVIDUALES];
      listToRender = [...new Set(all)].filter(name => name.toLowerCase().includes(query));
    } else {
      if (currentAdminIngresarCat === 'COMUNES') listToRender = EXAMS_COMUNES;
      else if (currentAdminIngresarCat === 'PERFILES') listToRender = EXAMS_PERFILES;
      else if (currentAdminIngresarCat === 'CULTIVOS') listToRender = EXAMS_CULTIVOS;
      else if (currentAdminIngresarCat === 'TOXICOLOGIA') listToRender = EXAMS_TOXICOLOGIA;
      else if (currentAdminIngresarCat === 'INDIVIDUALES') listToRender = EXAMS_INDIVIDUALES;
    }

    if (listToRender.length === 0) {
      listContainer.innerHTML = `<p style="padding: 1rem; color: var(--text-dark); text-align: center; font-size: 0.82rem; margin: 0;">Ningún examen coincide con la búsqueda.</p>`;
      return;
    }

    listContainer.innerHTML = listToRender.map(examName => {
      const isChecked = selectedAdminIngresarExams.has(examName);
      return `
        <label style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(255,255,255,0.03); border-radius: 6px; border: 1px solid var(--border-light); cursor: pointer; transition: all 0.2s;" class="admin-ingresar-exam-row">
          <span style="font-size: 0.85rem; color: var(--text-main); font-weight: 500; padding-right: 15px;">${examName}</span>
          <input type="checkbox" class="admin-ingresar-exam-cb" data-name="${examName}" ${isChecked ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
        </label>
      `;
    }).join('');

    listContainer.querySelectorAll('.admin-ingresar-exam-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        const name = cb.dataset.name;
        if (cb.checked) {
          selectedAdminIngresarExams.add(name);
        } else {
          selectedAdminIngresarExams.delete(name);
        }
        updateAdminIngresarSelectedPills();
      });
    });
  }

  function updateAdminIngresarSelectedPills() {
    const container = document.getElementById('admin-ingresar-selected-exams-pills');
    const countSpan = document.getElementById('admin-ingresar-selected-count');
    if (!container) return;

    countSpan.innerText = selectedAdminIngresarExams.size;

    if (selectedAdminIngresarExams.size === 0) {
      container.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-dark);">Ningún examen seleccionado. Agregue exámenes arriba.</span>`;
      return;
    }

    container.innerHTML = [...selectedAdminIngresarExams].map(examName => `
      <span style="font-size: 0.76rem; font-weight: 600; color: var(--color-accent); background: rgba(14, 165, 233, 0.1); border: 1px solid rgba(14, 165, 233, 0.2); padding: 5px 12px; border-radius: 20px; display: inline-flex; align-items: center; gap: 6px;">
        ${examName}
        <i class="fa-solid fa-circle-xmark remove-admin-exam-btn" data-name="${examName}" style="cursor: pointer; opacity: 0.7;"></i>
      </span>
    `).join('');

    container.querySelectorAll('.remove-admin-exam-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.name;
        selectedAdminIngresarExams.delete(name);
        updateAdminIngresarSelectedPills();
        renderAdminIngresarExams();
      });
    });
  }

  // Navegación por pasos
  function changeAdminStep(from, to) {
    if (to > from) {
      if (from === 1) {
        const clientSelect = document.getElementById('admin-ingresar-client-select');
        const medico = document.getElementById('admin-ingresar-medico');
        const propietario = document.getElementById('admin-ingresar-propietario');
        const pacienteHc = document.getElementById('admin-ingresar-paciente-hc');
        const especie = document.getElementById('admin-ingresar-especie');
        const raza = document.getElementById('admin-ingresar-raza');
        const edad = document.getElementById('admin-ingresar-edad');
        const sexo = document.getElementById('admin-ingresar-sexo');

        if (!clientSelect.value || !medico.checkValidity() || !propietario.checkValidity() || !pacienteHc.checkValidity() || !especie.checkValidity() || !raza.checkValidity() || !edad.checkValidity() || !sexo.checkValidity()) {
          showGlobalAlert('Por favor seleccione la veterinaria y complete todos los campos obligatorios del Paso 1.', 'error');
          document.getElementById('form-admin-ingreso-paciente').reportValidity();
          return;
        }
      }

      if (from === 2) {
        const muestrasChecked = document.querySelectorAll('input[name="admin-ingresar-muestra"]:checked');
        if (muestrasChecked.length === 0) {
          showGlobalAlert('Debe seleccionar al menos un tipo de muestra.', 'error');
          return;
        }

        const otros = document.getElementById('admin-ingresar-otros').value.trim();
        if (selectedAdminIngresarExams.size === 0 && otros === '') {
          showGlobalAlert('Debe seleccionar al menos un examen de la lista o indicar otro.', 'error');
          return;
        }

        const quien = document.getElementById('admin-ingresar-quien');
        if (!quien.checkValidity()) {
          showGlobalAlert('Por favor, indique quién diligencia o recibe el formulario.', 'error');
          quien.focus();
          return;
        }
      }
    }

    document.querySelectorAll('#tab-admin-ingresar .step-panel').forEach(p => p.style.display = 'none');
    document.getElementById(`admin-step-panel-${to}`).style.display = 'block';

    for (let i = 1; i <= 3; i++) {
      const ind = document.getElementById(`admin-step-ind-${i}`);
      if (!ind) continue;
      if (i === to) {
        ind.classList.add('active');
        ind.querySelector('.step-num').style.background = 'var(--color-accent)';
        ind.querySelector('.step-num').style.color = 'white';
        ind.querySelector('span').style.color = 'var(--text-main)';
      } else if (i < to) {
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
    }

    const progressLineFill = document.getElementById('admin-progress-line-fill');
    if (progressLineFill) {
      const widthPercent = ((to - 1) / 2) * 100;
      progressLineFill.style.width = `${widthPercent}%`;
    }
  }

  // Event Listeners de navegación por pasos
  const adminBtnStep1Next = document.getElementById('admin-btn-step-1-next');
  if (adminBtnStep1Next) adminBtnStep1Next.addEventListener('click', () => changeAdminStep(1, 2));

  const adminBtnStep2Prev = document.getElementById('admin-btn-step-2-prev');
  if (adminBtnStep2Prev) adminBtnStep2Prev.addEventListener('click', () => changeAdminStep(2, 1));

  const adminBtnStep2Next = document.getElementById('admin-btn-step-2-next');
  if (adminBtnStep2Next) adminBtnStep2Next.addEventListener('click', () => changeAdminStep(2, 3));

  const adminBtnStep3Prev = document.getElementById('admin-btn-step-3-prev');
  if (adminBtnStep3Prev) adminBtnStep3Prev.addEventListener('click', () => changeAdminStep(3, 2));

  // Clicks directos en los indicadores de paso
  for (let i = 1; i <= 3; i++) {
    const ind = document.getElementById(`admin-step-ind-${i}`);
    if (ind) {
      ind.addEventListener('click', () => changeAdminStep(1, i));
    }
  }

  // Categorías de exámenes
  const adminCatBtns = document.querySelectorAll('#admin-ingresar-exam-cats button');
  adminCatBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      adminCatBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentAdminIngresarCat = btn.dataset.cat;
      const searchInput = document.getElementById('admin-search-ingresar-exam');
      if (searchInput) searchInput.value = '';
      renderAdminIngresarExams();
    });
  });

  const adminSearchExam = document.getElementById('admin-search-ingresar-exam');
  if (adminSearchExam) adminSearchExam.addEventListener('input', renderAdminIngresarExams);

  // Datos especiales condicionales
  const adminDatosEspSelect = document.getElementById('admin-ingresar-datos-especiales-tipo');
  const adminCondBiopsia = document.getElementById('admin-condicional-biopsia');
  const adminCondPcr = document.getElementById('admin-condicional-pcr');

  if (adminDatosEspSelect) {
    adminDatosEspSelect.addEventListener('change', () => {
      const val = adminDatosEspSelect.value;
      if (val === 'Biopsia') {
        adminCondBiopsia.style.display = 'block';
        adminCondPcr.style.display = 'none';
      } else if (val === 'PCR') {
        adminCondBiopsia.style.display = 'none';
        adminCondPcr.style.display = 'block';
      } else {
        adminCondBiopsia.style.display = 'none';
        adminCondPcr.style.display = 'none';
      }
    });
  }

  // Dirección habitual toggle
  const adminDirHabitual = document.getElementById('admin-ingresar-dir-habitual');
  const adminCustomDelGrid = document.getElementById('admin-ingresar-custom-delivery-grid');
  if (adminDirHabitual) {
    adminDirHabitual.addEventListener('change', () => {
      adminCustomDelGrid.style.display = adminDirHabitual.checked ? 'none' : 'grid';
      if (adminDirHabitual.checked) {
        document.getElementById('admin-ingresar-direccion').value = '';
        document.getElementById('admin-ingresar-telefono').value = '';
      }
    });
  }

  // Envío del Formulario de Ingreso Admin
  const btnAdminSubmit = document.getElementById('btn-admin-submit-ingreso');
  if (btnAdminSubmit) {
    btnAdminSubmit.addEventListener('click', async () => {
      const clientSelect = document.getElementById('admin-ingresar-client-select');
      const selectedOption = clientSelect.options[clientSelect.selectedIndex];
      if (!clientSelect.value || !selectedOption) {
        showGlobalAlert('Debe seleccionar la veterinaria o clínica cliente.', 'error');
        changeAdminStep(3, 1);
        return;
      }

      const idCliente = clientSelect.value;
      const nombreVeterinaria = selectedOption.getAttribute('data-name') || selectedOption.textContent;
      const correoVeterinaria = selectedOption.getAttribute('data-email') || '';

      const tipoEsp = document.getElementById('admin-ingresar-datos-especiales-tipo').value;
      if (tipoEsp === 'Biopsia') {
        const muestra = document.getElementById('admin-biopsia-tipo-muestra').value;
        const aspecto = document.getElementById('admin-biopsia-aspecto').value;
        const consistencia = document.getElementById('admin-biopsia-consistencia').value;
        const ubicacion = document.getElementById('admin-biopsia-ubicacion').value.trim();
        const tiempo = document.getElementById('admin-biopsia-tiempo').value.trim();

        if (!muestra || !aspecto || !consistencia || !ubicacion || !tiempo) {
          showGlobalAlert('Por favor complete todos los datos obligatorios para la Biopsia.', 'error');
          return;
        }
      } else if (tipoEsp === 'PCR') {
        const pcrTipo = document.getElementById('admin-pcr-tipo').value;
        const pcrSintomatico = document.getElementById('admin-pcr-sintomatico').value;
        if (!pcrTipo || !pcrSintomatico) {
          showGlobalAlert('Por favor complete el tipo de PCR y si el paciente es sintomático.', 'error');
          return;
        }
      }

      SirioAuth.showLoading('Registrando paciente en el sistema...');

      const muestrasChecked = [];
      document.querySelectorAll('input[name="admin-ingresar-muestra"]:checked').forEach(cb => {
        muestrasChecked.push(cb.value);
      });

      let detalleEspecial = '';
      if (tipoEsp === 'Biopsia') {
        detalleEspecial = JSON.stringify({
          tipo_muestra: document.getElementById('admin-biopsia-tipo-muestra').value,
          aspecto: document.getElementById('admin-biopsia-aspecto').value,
          consistencia: document.getElementById('admin-biopsia-consistencia').value,
          ubicacion: document.getElementById('admin-biopsia-ubicacion').value.trim(),
          tiempo_evolucion: document.getElementById('admin-biopsia-tiempo').value.trim(),
          detalles_adicionales: document.getElementById('admin-biopsia-detalles-adicionales').value.trim()
        });
      } else if (tipoEsp === 'PCR') {
        const sintomas = [];
        document.querySelectorAll('input[name="admin-pcr-sintomas"]:checked').forEach(cb => {
          sintomas.push(cb.value);
        });
        detalleEspecial = JSON.stringify({
          tipo_pcr: document.getElementById('admin-pcr-tipo').value,
          estado_paciente: document.getElementById('admin-pcr-sintomatico').value,
          sintomas: sintomas,
          observaciones_pcr: document.getElementById('admin-pcr-observaciones').value.trim()
        });
      }

      const examenesComunes = [...selectedAdminIngresarExams].filter(name => EXAMS_COMUNES.includes(name));
      const examenesIndividuales = [...selectedAdminIngresarExams].filter(name => EXAMS_INDIVIDUALES.includes(name));
      const examenesCultivos = [...selectedAdminIngresarExams].filter(name => EXAMS_CULTIVOS.includes(name));
      const examenesPerfiles = [...selectedAdminIngresarExams].filter(name => EXAMS_PERFILES.includes(name));
      const examenesToxicologia = [...selectedAdminIngresarExams].filter(name => EXAMS_TOXICOLOGIA.includes(name));

      const payload = {
        id_usuario: idCliente,
        email: correoVeterinaria || '',
        veterinaria: nombreVeterinaria,
        medico: document.getElementById('admin-ingresar-medico').value.trim(),
        propietario: document.getElementById('admin-ingresar-propietario').value.trim(),
        paciente_nombre: document.getElementById('admin-ingresar-paciente-hc').value.trim(),
        especie: document.getElementById('admin-ingresar-especie').value,
        raza: document.getElementById('admin-ingresar-raza').value,
        edad: document.getElementById('admin-ingresar-edad').value,
        sexo: document.getElementById('admin-ingresar-sexo').value,
        esterilizado: tipoEsp === 'PCR' ? (document.getElementById('admin-ingresar-esterilizado') ? document.getElementById('admin-ingresar-esterilizado').value : '') : '',
        es_control: tipoEsp === 'PCR' ? (document.getElementById('admin-ingresar-es-control') ? document.getElementById('admin-ingresar-es-control').value : '') : '',
        tipo_muestra: muestrasChecked.join(', '),
        examenes_solicitados: [...selectedAdminIngresarExams].join(', '),
        examenes_comunes: examenesComunes.join(', '),
        examenes_individuales: examenesIndividuales.join(', '),
        examenes_cultivos: examenesCultivos.join(', '),
        examenes_perfiles: examenesPerfiles.join(', '),
        examenes_toxicologia: examenesToxicologia.join(', '),
        otros_examenes: document.getElementById('admin-ingresar-otros').value.trim(),
        observaciones: document.getElementById('admin-ingresar-observaciones').value.trim(),
        direccion_recoleccion: document.getElementById('admin-ingresar-dir-habitual').checked ? 'DIRECCIÓN REGISTRADA' : document.getElementById('admin-ingresar-direccion').value.trim(),
        contacto_recoleccion: document.getElementById('admin-ingresar-dir-habitual').checked ? 'TELÉFONO REGISTRADO' : document.getElementById('admin-ingresar-telefono').value.trim(),
        quien_diligencia: document.getElementById('admin-ingresar-quien').value.trim(),
        datos_especiales_tipo: tipoEsp,
        datos_especiales_detalle: detalleEspecial
      };

      try {
        const res = await fetch(`${SirioAuth.API_BASE}/api/admin/ingresar-paciente`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        SirioAuth.hideLoading();

        if (data.success) {
          showGlobalAlert('Paciente registrado exitosamente en el sistema.', 'success');

          // Generar comprobante impreso
          const regData = {
            fecha: data.fecha || new Date().toLocaleString('es-CO'),
            codigo_registro: data.codigo_registro || "2180001",
            correo_centro: correoVeterinaria || 'N/A',
            centro_veterinario: nombreVeterinaria || 'N/A',
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

          // Resetear formulario
          document.getElementById('form-admin-ingreso-paciente').reset();
          selectedAdminIngresarExams.clear();
          updateAdminIngresarSelectedPills();
          renderAdminIngresarExams();
          changeAdminStep(3, 1);
        } else {
          showGlobalAlert(data.message || 'Error al ingresar paciente.', 'error');
        }
      } catch (err) {
        SirioAuth.hideLoading();
        console.error('Error al ingresar paciente admin:', err);
        showGlobalAlert('Error de red al intentar registrar paciente.', 'error');
      }
    });
  }

  // Inicializar render de exámenes para el admin
  renderAdminIngresarExams();

  // Mostrar botón de métricas si corresponde
  const navTabStats = document.getElementById('nav-tab-stats');
  const hasSpecialAccess = currentUser && (currentUser.rol === 'jefas' || currentUser.rol === 'programadores');
  if (hasSpecialAccess && navTabStats) {
    navTabStats.style.display = 'flex';
  }

  // Restaurar pestaña activa guardada al iniciar
  const savedAdminTab = sessionStorage.getItem('sirio_active_tab_admin');
  if (savedAdminTab) {
    if (savedAdminTab === 'tab-stats' && !hasSpecialAccess) {
      switchTab('tab-history');
    } else {
      switchTab(savedAdminTab);
    }
  }

});

// ==========================================================================
//  MÓDULO DE SOPORTE TÉCNICO - VISTA DE ADMINISTRADOR
// ==========================================================================
(function initSupportAdmin() {
  const container = document.getElementById('soporte-list-container');
  const reloadBtn = document.getElementById('reload-soporte-btn');

  const TYPE_ICONS = {
    'Reporte de Error o Fallo Técnico': { icon: 'fa-bug', color: '#ef4444' },
    'Duda o Consulta General':           { icon: 'fa-circle-question', color: '#0ea5e9' },
    'Problema con un Examen o Paciente': { icon: 'fa-flask', color: '#f59e0b' },
    'Sugerencia o Mejora':               { icon: 'fa-lightbulb', color: '#10b981' },
    'Otro Asunto':                        { icon: 'fa-file-lines', color: '#8b5cf6' },
    'General':                            { icon: 'fa-headset', color: '#6b7280' }
  };

  function statusBadge(estado) {
    const map = {
      'Pendiente':  { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)', color: '#b45309', text: '⏳ Pendiente' },
      'En Proceso': { bg: 'rgba(14,165,233,0.1)',  border: 'rgba(14,165,233,0.4)',  color: '#0369a1', text: '🔍 En Proceso' },
      'Resuelto':   { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.35)', color: '#047857', text: '✅ Resuelto' }
    };
    const s = map[estado] || map['Pendiente'];
    return `<span style="background:${s.bg};border:1px solid ${s.border};color:${s.color};border-radius:20px;padding:2px 10px;font-size:0.75rem;font-weight:600;">${s.text}</span>`;
  }

  function renderTickets(tickets) {
    if (!container) return;
    if (!tickets || tickets.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:3rem 1rem;color:var(--text-muted);">
          <i class="fa-solid fa-inbox" style="font-size:2.5rem;margin-bottom:0.75rem;display:block;opacity:0.4;"></i>
          <p style="font-size:0.9rem;">No hay mensajes de soporte recibidos aún.</p>
        </div>`;
      return;
    }

    // Ordenar del más reciente al más antiguo
    const sorted = [...tickets].reverse();

    container.innerHTML = sorted.map(t => {
      const ti = TYPE_ICONS[t.tipo] || TYPE_ICONS['General'];
      const clinica = t.nombre_cliente || t.usuario || t.id_usuario || 'Clínica desconocida';
      const contacto = t.nombre_contacto && t.nombre_contacto !== t.nombre_cliente ? t.nombre_contacto : null;
      const estado = t.estado || 'Pendiente';
      return `
      <div id="ticket-card-${t.id_ticket}" style="border:1px solid var(--border-light);border-radius:10px;padding:1rem 1.25rem;margin-bottom:0.85rem;background:var(--bg-secondary);transition:opacity 0.3s,box-shadow 0.2s;">
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <div style="width:38px;height:38px;border-radius:50%;background:${ti.color}1a;border:1.5px solid ${ti.color}44;display:flex;align-items:center;justify-content:center;color:${ti.color};flex-shrink:0;font-size:1rem;">
            <i class="fa-solid ${ti.icon}"></i>
          </div>
          <div style="flex:1;min-width:0;">

            <!-- Asunto + badge estado -->
            <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:4px;">
              <span style="font-weight:700;font-size:0.92rem;color:var(--text-main);">${t.asunto}</span>
              <span id="badge-${t.id_ticket}">${statusBadge(estado)}</span>
            </div>

            <!-- Clínica / Cuenta origen -->
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
              <span style="background:rgba(14,165,233,0.1);border:1px solid rgba(14,165,233,0.3);color:#0369a1;border-radius:20px;padding:2px 10px;font-size:0.75rem;font-weight:600;">
                <i class="fa-solid fa-hospital"></i> ${clinica}
              </span>
              ${t.usuario ? `<span style="font-size:0.75rem;color:var(--text-muted);">@${t.usuario}</span>` : ''}
              ${contacto ? `<span style="font-size:0.75rem;color:var(--text-muted);">&#128100; ${contacto}</span>` : ''}
            </div>

            <!-- Tipo y fecha -->
            <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px;">
              <i class="fa-solid fa-tag"></i> ${t.tipo || 'General'} &nbsp;&middot;&nbsp;
              <i class="fa-regular fa-clock"></i> ${t.fecha_hora || ''}
              ${t.id_ticket ? ` &nbsp;&middot;&nbsp; <span style="opacity:0.6;">${t.id_ticket}</span>` : ''}
            </div>

            <!-- Mensaje -->
            <div style="background:var(--bg-primary);border:1px solid var(--border-light);border-radius:7px;padding:0.65rem 0.85rem;font-size:0.85rem;color:var(--text-main);line-height:1.55;white-space:pre-wrap;margin-bottom:0.85rem;">${t.mensaje}</div>

            <!-- Acciones: cambiar estado + eliminar -->
            <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;">
              <!-- Selector de estado -->
              <select id="sel-${t.id_ticket}"
                data-ticket="${t.id_ticket}"
                onchange="window.changeSupportStatus(this)"
                style="height:34px;font-size:0.8rem;border-radius:7px;border:1px solid var(--border-light);background:var(--bg-primary);color:var(--text-main);padding:0 10px;cursor:pointer;outline:none;">
                <option value="Pendiente"  ${estado === 'Pendiente'  ? 'selected' : ''}>⏳ Pendiente</option>
                <option value="En Proceso" ${estado === 'En Proceso' ? 'selected' : ''}>🔍 En Proceso</option>
                <option value="Resuelto"   ${estado === 'Resuelto'   ? 'selected' : ''}>✅ Resuelto</option>
              </select>

              <!-- Botón eliminar -->
              <button id="del-btn-${t.id_ticket}"
                data-ticket="${t.id_ticket}"
                onclick="window.initDeleteTicket(this)"
                style="height:34px;padding:0 12px;font-size:0.8rem;border-radius:7px;border:1px solid rgba(239,68,68,0.4);background:rgba(239,68,68,0.08);color:#b91c1c;cursor:pointer;display:flex;align-items:center;gap:6px;transition:background 0.2s;">
                <i class="fa-solid fa-trash-can"></i> Eliminar
              </button>

              <!-- Confirmación inline (oculta por defecto) -->
              <span id="del-confirm-${t.id_ticket}" style="display:none;align-items:center;gap:6px;">
                <span style="font-size:0.8rem;color:var(--text-muted);">¿Eliminar definitivamente?</span>
                <button onclick="window.confirmDeleteTicket('${t.id_ticket}')"
                  style="height:30px;padding:0 10px;font-size:0.78rem;border-radius:6px;border:none;background:#ef4444;color:#fff;cursor:pointer;font-weight:600;">
                  Sí, eliminar
                </button>
                <button onclick="window.cancelDeleteTicket('${t.id_ticket}')"
                  style="height:30px;padding:0 10px;font-size:0.78rem;border-radius:6px;border:1px solid var(--border-light);background:transparent;color:var(--text-muted);cursor:pointer;">
                  Cancelar
                </button>
              </span>
            </div>

          </div>
        </div>
      </div>`;
    }).join('');
  }

  async function loadSupportTickets() {
    if (!container) return;
    container.innerHTML = `
      <div style="text-align:center;padding:3rem 1rem;color:var(--text-muted);">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size:2rem;margin-bottom:0.75rem;display:block;"></i>
        <p style="font-size:0.88rem;">Cargando mensajes de soporte...</p>
      </div>`;
    try {
      const resp = await fetch(`${SirioAuth.API_BASE}/api/admin/soporte`);
      const data = await resp.json();
      if (data.success) {
        renderTickets(data.tickets || []);
      } else {
        container.innerHTML = `<p style="color:var(--error);padding:1rem;">Error al cargar mensajes: ${data.message || 'Error desconocido'}</p>`;
      }
    } catch (err) {
      console.error('[Soporte Admin]', err);
      container.innerHTML = `<p style="color:var(--error);padding:1rem;">Error de conexión al cargar mensajes de soporte.</p>`;
    }
  }

  // ── Cambiar estado ──────────────────────────────────────────────────────
  window.changeSupportStatus = async function(selectEl) {
    const id = selectEl.dataset.ticket;
    const nuevoEstado = selectEl.value;
    selectEl.disabled = true;
    try {
      const resp = await fetch(`${SirioAuth.API_BASE}/api/admin/soporte/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado })
      });
      const data = await resp.json();
      if (data.success) {
        const badge = document.getElementById(`badge-${id}`);
        if (badge) badge.innerHTML = statusBadge(nuevoEstado);
      } else {
        console.error('[Soporte] Error actualizando estado:', data.message);
      }
    } catch (err) {
      console.error('[Soporte] Error de conexión al cambiar estado:', err);
    } finally {
      selectEl.disabled = false;
    }
  };

  // ── Eliminar: paso 1 – mostrar confirmación ──────────────────────────────
  window.initDeleteTicket = function(btn) {
    const id = btn.dataset.ticket;
    btn.style.display = 'none';
    const confirm = document.getElementById(`del-confirm-${id}`);
    if (confirm) confirm.style.display = 'inline-flex';
  };

  // ── Eliminar: cancelar ────────────────────────────────────────────────────
  window.cancelDeleteTicket = function(id) {
    const btn = document.getElementById(`del-btn-${id}`);
    const confirm = document.getElementById(`del-confirm-${id}`);
    if (btn) btn.style.display = 'flex';
    if (confirm) confirm.style.display = 'none';
  };

  // ── Eliminar: confirmar ───────────────────────────────────────────────────
  window.confirmDeleteTicket = async function(id) {
    const card = document.getElementById(`ticket-card-${id}`);
    if (card) card.style.opacity = '0.4';
    try {
      const resp = await fetch(`${SirioAuth.API_BASE}/api/admin/soporte/${id}`, { method: 'DELETE' });
      const data = await resp.json();
      if (data.success) {
        if (card) {
          card.style.transition = 'opacity 0.35s, max-height 0.45s, margin 0.45s, padding 0.45s';
          card.style.maxHeight = card.offsetHeight + 'px';
          requestAnimationFrame(() => {
            card.style.opacity = '0';
            card.style.maxHeight = '0';
            card.style.marginBottom = '0';
            card.style.padding = '0';
            card.style.overflow = 'hidden';
          });
          setTimeout(() => card.remove(), 500);
        }
      } else {
        if (card) card.style.opacity = '1';
        window.cancelDeleteTicket(id);
        console.error('[Soporte] Error al eliminar:', data.message);
      }
    } catch (err) {
      if (card) card.style.opacity = '1';
      window.cancelDeleteTicket(id);
      console.error('[Soporte] Error de conexión al eliminar:', err);
    }
  };

  // Exponer para que el módulo de tabs pueda llamarla
  window.loadSupportTickets = loadSupportTickets;

  if (reloadBtn) reloadBtn.addEventListener('click', loadSupportTickets);
}());

// ==========================================================================
// MÓDULO: ALERTAS A CLIENTES
// ==========================================================================

(function () {
  'use strict';

  const API_BASE = SirioAuth.API_BASE;

  // ── Mapa de tipos de alerta ───────────────────────────────────────────────
  const TIPO_INFO = {
    informacion:    { label: 'Información General',      icon: 'fa-circle-info',       color: '#38bdf8' },
    actualizacion:  { label: 'Actualización de la App',  icon: 'fa-mobile-screen',     color: '#a78bfa' },
    mantenimiento:  { label: 'Mantenimiento Programado', icon: 'fa-screwdriver-wrench', color: '#fb923c' },
    cambio_servicio:{ label: 'Cambio en Servicios',      icon: 'fa-clipboard-list',    color: '#34d399' },
    personalizada:  { label: 'Personalizada',            icon: 'fa-tag',               color: '#f472b6' }
  };

  function getTipoInfo(tipo, tipoPersonalizado) {
    const base = TIPO_INFO[tipo] || TIPO_INFO.informacion;
    if (tipo === 'personalizada' && tipoPersonalizado) {
      return { ...base, label: tipoPersonalizado };
    }
    return base;
  }

  // ── Toggle categoría personalizada ────────────────────────────────────────
  window.toggleAlertaTipoPersonalizado = function () {
    const sel = document.getElementById('alerta-tipo');
    const wrapper = document.getElementById('alerta-tipo-personalizado-wrapper');
    if (!sel || !wrapper) return;
    wrapper.style.display = sel.value === 'personalizada' ? 'block' : 'none';
    if (sel.value !== 'personalizada') {
      const inp = document.getElementById('alerta-tipo-personalizado');
      if (inp) inp.value = '';
    }
  };

  // ── Toggle lista de clientes específicos ──────────────────────────────────
  window.toggleAlertaDestinatarios = async function () {
    const especificos = document.getElementById('alerta-dest-especificos');
    const lista = document.getElementById('alerta-clientes-lista');
    if (!lista) return;
    if (especificos && especificos.checked) {
      lista.style.display = 'block';
      await renderAlertaClientesList();
    } else {
      lista.style.display = 'none';
    }
  };

  async function renderAlertaClientesList() {
    const lista = document.getElementById('alerta-clientes-lista');
    if (!lista) return;

    let clients = window._alertaAllClients;
    if (!clients || clients.length === 0) {
      lista.innerHTML = '<div style="color: var(--text-muted); font-style: italic; font-size:0.81rem; padding: 4px 0;"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando lista de clientes...</div>';
      try {
        const res = await fetch(`${API_BASE}/api/admin/clients`);
        const data = await res.json();
        if (data.success && Array.isArray(data.clients)) {
          clients = data.clients;
          window._alertaAllClients = clients;
        }
      } catch (err) {
        console.error('Error cargando clientes para alertas:', err);
      }
    }

    if (!clients || clients.length === 0) {
      lista.innerHTML = '<div style="color: var(--text-dark); font-style: italic; font-size:0.81rem; padding: 4px 0;">No se encontraron clientes registrados en la base de datos.</div>';
      return;
    }

    lista.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid var(--border-light);">
        <input type="text" id="alerta-filtro-cliente" placeholder="Buscar cliente..." style="padding: 4px 8px; font-size: 0.78rem; border-radius: 6px; background: rgba(255,255,255,0.06); border: 1px solid var(--border-light); color: var(--text-main); width: 60%;">
        <div style="display: flex; gap: 6px;">
          <button type="button" id="alerta-select-all" style="background: none; border: none; font-size: 0.72rem; color: var(--color-primary); cursor: pointer; text-decoration: underline; padding: 0;">Todos</button>
          <button type="button" id="alerta-deselect-all" style="background: none; border: none; font-size: 0.72rem; color: var(--text-muted); cursor: pointer; text-decoration: underline; padding: 0;">Ninguno</button>
        </div>
      </div>
      <div id="alerta-clientes-checkboxes" style="display: flex; flex-direction: column; gap: 4px;">
        ${clients.map(c => `
          <label class="alerta-cliente-item" data-search="${(c.nombre + ' ' + (c.usuario || '')).toLowerCase()}" style="display: flex; align-items: center; gap: 8px; padding: 5px 6px; cursor: pointer; border-radius: 6px; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='transparent'">
            <input type="checkbox" class="alerta-cliente-check" value="${c.id_usuario}" style="accent-color: var(--color-accent); width:15px; height:15px; cursor: pointer;">
            <span style="flex:1; font-weight: 500; color: var(--text-main);">${c.nombre}</span>
            <span style="color: var(--text-dark); font-size:0.75rem;">@${c.usuario || c.id_usuario}</span>
          </label>
        `).join('')}
      </div>
    `;

    // Buscador interactivo en vivo
    const searchInp = document.getElementById('alerta-filtro-cliente');
    if (searchInp) {
      searchInp.addEventListener('input', () => {
        const query = searchInp.value.toLowerCase().trim();
        lista.querySelectorAll('.alerta-cliente-item').forEach(item => {
          const text = item.getAttribute('data-search') || '';
          item.style.display = text.includes(query) ? 'flex' : 'none';
        });
      });
    }

    // Botones de seleccionar/deseleccionar todos
    const selAllBtn = document.getElementById('alerta-select-all');
    const deselAllBtn = document.getElementById('alerta-deselect-all');
    if (selAllBtn) {
      selAllBtn.addEventListener('click', () => {
        lista.querySelectorAll('.alerta-cliente-check').forEach(cb => cb.checked = true);
      });
    }
    if (deselAllBtn) {
      deselAllBtn.addEventListener('click', () => {
        lista.querySelectorAll('.alerta-cliente-check').forEach(cb => cb.checked = false);
      });
    }
  }

  // ── Conteo de caracteres del mensaje ──────────────────────────────────────
  const mensajeTextarea = document.getElementById('alerta-mensaje');
  const mensajeCount = document.getElementById('alerta-mensaje-count');
  if (mensajeTextarea && mensajeCount) {
    mensajeTextarea.addEventListener('input', () => {
      mensajeCount.textContent = mensajeTextarea.value.length;
    });
  }

  // ── Cargar historial de alertas ───────────────────────────────────────────
  async function loadAlertas() {
    const lista = document.getElementById('alertas-historial-lista');
    if (!lista) return;
    lista.innerHTML = '<div style="text-align:center; padding: 1.5rem; color: var(--text-dark);"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando alertas...</div>';
    try {
      const res = await fetch(`${API_BASE}/api/admin/alertas`);
      const data = await res.json();
      if (data.success) {
        renderAlertasHistory(data.alertas || []);
      } else {
        lista.innerHTML = `<div style="color:#ef4444; font-size:0.82rem; padding:1rem;">${data.message}</div>`;
      }
    } catch (err) {
      lista.innerHTML = '<div style="color:#ef4444; font-size:0.82rem; padding:1rem;">Error de conexión al cargar alertas.</div>';
    }
  }
  window.loadAlertas = loadAlertas;

  // ── Renderizar historial ──────────────────────────────────────────────────
  function renderAlertasHistory(alertas) {
    const lista = document.getElementById('alertas-historial-lista');
    if (!lista) return;
    if (!alertas || alertas.length === 0) {
      lista.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: var(--text-dark);">
          <i class="fa-solid fa-bell-slash" style="font-size: 2rem; opacity: 0.3; display: block; margin-bottom: 0.75rem;"></i>
          <p style="font-size: 0.85rem;">No hay alertas enviadas aún.</p>
        </div>`;
      return;
    }
    lista.innerHTML = alertas.map(a => {
      const info = getTipoInfo(a.tipo, a.tipo_personalizado);
      const fecha = new Date(a.fecha_creacion).toLocaleString('es-CO', {
        timeZone: 'America/Bogota', year: 'numeric', month: 'short',
        day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const vistosCount = Array.isArray(a.vista_por) ? a.vista_por.length : 0;
      const destLabel = a.destinatarios === 'todos'
        ? '<i class="fa-solid fa-users"></i> Todos'
        : `<i class="fa-solid fa-user-check"></i> ${Array.isArray(a.destinatarios) ? a.destinatarios.length + ' cliente(s)' : '?'}`;
      return `
        <div id="alerta-card-${a.id_alerta}" style="border: 1px solid var(--border-light); border-radius: 10px; padding: 0.9rem 1rem; margin-bottom: 0.75rem; background: rgba(255,255,255,0.02); transition: opacity 0.3s, max-height 0.4s, padding 0.4s;">
          <div style="display: flex; align-items: flex-start; gap: 10px;">
            <div style="width:32px; height:32px; border-radius:50%; background: rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <i class="fa-solid ${info.icon}" style="color:${info.color}; font-size:0.85rem;"></i>
            </div>
            <div style="flex:1; min-width:0;">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; flex-wrap:wrap;">
                <strong style="font-size:0.88rem; color:var(--text-main); word-break:break-word;">${a.titulo}</strong>
                <button onclick="deleteAlerta('${a.id_alerta}')" title="Eliminar alerta"
                  style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:0.85rem; padding:2px 6px; opacity:0.7; transition:opacity 0.2s;"
                  onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
              <p style="font-size:0.78rem; color:var(--text-dark); margin:4px 0; line-height:1.4; word-break:break-word;">${a.mensaje}</p>
              <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:6px; font-size:0.72rem; color:var(--text-dark);">
                <span style="background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius:20px; border:1px solid var(--border-light);">
                  <i class="fa-solid ${info.icon}" style="color:${info.color};"></i> ${info.label}
                </span>
                <span>${destLabel}</span>
                <span><i class="fa-regular fa-clock"></i> ${fecha}</span>
                <span style="color:${vistosCount > 0 ? '#34d399' : 'var(--text-dark)'};">
                  <i class="fa-solid fa-eye"></i> ${vistosCount} visto(s)
                </span>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  // ── Enviar alerta ─────────────────────────────────────────────────────────
  window.sendAlerta = async function () {
    const titulo = (document.getElementById('alerta-titulo')?.value || '').trim();
    const tipo = document.getElementById('alerta-tipo')?.value || 'informacion';
    const tipoPersonalizado = tipo === 'personalizada'
      ? (document.getElementById('alerta-tipo-personalizado')?.value || '').trim() : '';
    const mensaje = (document.getElementById('alerta-mensaje')?.value || '').trim();

    if (!titulo) return showGlobalAlert('El título es obligatorio.', 'error');
    if (tipo === 'personalizada' && !tipoPersonalizado) return showGlobalAlert('Escribe el nombre de la categoría personalizada.', 'error');
    if (!mensaje) return showGlobalAlert('El mensaje es obligatorio.', 'error');

    const todosRadio = document.getElementById('alerta-dest-todos');
    let destinatarios = 'todos';
    if (!todosRadio || !todosRadio.checked) {
      const checks = Array.from(document.querySelectorAll('.alerta-cliente-check:checked')).map(c => c.value);
      if (checks.length === 0) return showGlobalAlert('Selecciona al menos un cliente destinatario.', 'error');
      destinatarios = checks;
    }

    const btn = document.getElementById('alerta-enviar-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Enviando...'; }

    try {
      const currentUser = SirioAuth.getCurrentUser();
      const res = await fetch(`${API_BASE}/api/admin/alertas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo, mensaje, tipo, tipo_personalizado: tipoPersonalizado, destinatarios,
          creada_por: currentUser?.id_usuario || '',
          creada_por_nombre: currentUser?.nombre || 'Administrador'
        })
      });
      const data = await res.json();
      if (data.success) {
        showGlobalAlert('✅ ' + data.message, 'success');
        document.getElementById('alerta-titulo').value = '';
        document.getElementById('alerta-mensaje').value = '';
        if (mensajeCount) mensajeCount.textContent = '0';
        document.getElementById('alerta-tipo').value = 'informacion';
        toggleAlertaTipoPersonalizado();
        const todosR = document.getElementById('alerta-dest-todos');
        if (todosR) todosR.checked = true;
        const listaEl = document.getElementById('alerta-clientes-lista');
        if (listaEl) listaEl.style.display = 'none';
        loadAlertas();
      } else {
        showGlobalAlert(data.message || 'Error al enviar la alerta.', 'error');
      }
    } catch (err) {
      showGlobalAlert('Error de conexión al enviar la alerta.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar Alerta'; }
    }
  };

  // ── Eliminar alerta ───────────────────────────────────────────────────────
  window.deleteAlerta = async function (id) {
    if (!confirm('¿Eliminar esta alerta del historial?')) return;
    const card = document.getElementById('alerta-card-' + id);
    if (card) card.style.opacity = '0.4';
    try {
      const res = await fetch(`${API_BASE}/api/admin/alertas/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        if (card) {
          card.style.maxHeight = '0'; card.style.padding = '0'; card.style.overflow = 'hidden';
          setTimeout(() => card.remove(), 400);
        }
        showGlobalAlert('Alerta eliminada correctamente.', 'success');
      } else {
        if (card) card.style.opacity = '1';
        showGlobalAlert(data.message || 'Error al eliminar.', 'error');
      }
    } catch (err) {
      if (card) card.style.opacity = '1';
      showGlobalAlert('Error de conexión.', 'error');
    }
  };

  // ── Precargar clientes para el selector ──────────────────────────────────
  async function preloadClientsForAlertas() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/clients`);
      const data = await res.json();
      if (data.success) window._alertaAllClients = data.clients || [];
    } catch (_) {}
  }

  // ── Activar tab de alertas → cargar datos ────────────────────────────────
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-tab="tab-alertas"]');
    if (btn) {
      loadAlertas();
      preloadClientsForAlertas();
    }
  });

  // =========================================================================
  // MÓDULO: CAMBIO RÁPIDO DE CUENTA DE ADMINISTRADOR (1-Clic Switcher)
  // =========================================================================
  (function initAdminAccountSwitcher() {
    const switchBtn = document.getElementById('admin-switch-account-btn');
    const modal = document.getElementById('modal-switch-account');
    const closeBtn = document.getElementById('close-switch-modal-btn');
    const closeSecBtn = document.getElementById('close-switch-modal-secondary-btn');
    const listContainer = document.getElementById('saved-admin-accounts-list');
    const form = document.getElementById('switch-account-form');
    const usernameInput = document.getElementById('switch-username-input');
    const passwordInput = document.getElementById('switch-password-input');
    const alertBox = document.getElementById('switch-modal-alert');
    const alertText = document.getElementById('switch-modal-alert-text');
    const togglePwdBtn = document.getElementById('toggle-switch-pwd');
    const togglePwdIcon = document.getElementById('toggle-switch-pwd-icon');
    const useAnotherBtn = document.getElementById('switch-use-another-btn');
    const cancelNewBtn = document.getElementById('switch-cancel-new-btn');
    const addNewContainer = document.getElementById('switch-add-new-container');

    if (!switchBtn || !modal) return;

    // Asegurar que el usuario actual quede registrado en la lista de cuentas
    const currentAdmin = SirioAuth.getCurrentUser();
    if (currentAdmin && SirioAuth.isAdminRole(currentAdmin.rol)) {
      SirioAuth.saveAdminProfile(currentAdmin);
    }

    function showAlert(msg) {
      if (!alertBox || !alertText) return;
      alertText.innerText = msg;
      alertBox.style.display = 'flex';
    }

    function hideAlert() {
      if (alertBox) alertBox.style.display = 'none';
    }

    function renderSavedAccounts() {
      if (!listContainer) return;
      const profiles = SirioAuth.getSavedAdminProfiles();
      const current = SirioAuth.getCurrentUser() || {};
      const rawCurrentUname = current.username !== undefined ? current.username : (current.usuario !== undefined ? current.usuario : '');
      const currentUname = String(rawCurrentUname || '').trim().toLowerCase();

      if (profiles.length === 0) {
        listContainer.innerHTML = `
          <div style="padding: 1.25rem; text-align: center; color: var(--text-dark); background: rgba(255,255,255,0.02); border-radius: 10px; border: 1px dashed var(--border-light); font-size: 0.85rem;">
            <i class="fa-solid fa-users" style="font-size: 1.5rem; opacity: 0.3; margin-bottom: 6px; display: block;"></i>
            Aún no hay otras cuentas de personal guardadas en este equipo.
          </div>
        `;
        return;
      }

      listContainer.innerHTML = profiles.map(p => {
        if (!p || typeof p !== 'object') return '';
        const rawUname = p.username !== undefined ? p.username : (p.usuario !== undefined ? p.usuario : '');
        const uname = String(rawUname || '').trim();
        if (!uname) return '';
        const isCurrent = uname.toLowerCase() === currentUname;
        
        let roleBadge = 'Personal';
        let roleColor = '#0ea5e9';
        let roleBg = 'rgba(14, 165, 233, 0.15)';
        const roleStr = String(p.rol || '').toLowerCase().trim();
        if (roleStr === 'jefas') {
          roleBadge = 'Jefa 👑';
          roleColor = '#f472b6';
          roleBg = 'rgba(244, 114, 182, 0.15)';
        } else if (roleStr === 'programadores') {
          roleBadge = 'Programador 💻';
          roleColor = '#c084fc';
          roleBg = 'rgba(192, 132, 252, 0.15)';
        }

        const borderStyle = isCurrent 
          ? 'border: 1.5px solid #10b981; background: rgba(16, 185, 129, 0.08);' 
          : 'border: 1px solid var(--border-light); background: rgba(255, 255, 255, 0.03);';

        return `
          <div class="admin-account-card" data-username="${uname}" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-radius: 12px; cursor: pointer; transition: all 0.2s; ${borderStyle}">
            <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
              <div style="width: 38px; height: 38px; border-radius: 50%; background: ${roleBg}; color: ${roleColor}; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1rem; flex-shrink: 0;">
                ${String(p.nombre || uname || 'A').charAt(0).toUpperCase()}
              </div>
              <div style="min-width: 0; flex: 1;">
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                  <span style="font-weight: 600; font-size: 0.92rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${String(p.nombre || uname)}
                  </span>
                  ${isCurrent ? '<span style="font-size: 0.68rem; background: rgba(16, 185, 129, 0.2); color: #10b981; padding: 2px 6px; border-radius: 6px; font-weight: 700;">Sesión Activa</span>' : ''}
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
                  <span style="font-size: 0.75rem; color: var(--text-muted);">@${uname}</span>
                  <span style="font-size: 0.68rem; color: ${roleColor}; background: ${roleBg}; padding: 1px 6px; border-radius: 4px; font-weight: 500;">${roleBadge}</span>
                </div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              ${!isCurrent ? `
                <button type="button" class="btn btn-primary btn-switch-now" data-username="${uname}" style="font-size: 0.75rem; padding: 6px 12px; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px;">
                  <i class="fa-solid fa-right-to-bracket"></i> Entrar
                </button>
              ` : `
                <span style="font-size: 0.8rem; color: #10b981; padding-right: 4px;"><i class="fa-solid fa-circle-check"></i></span>
              `}
              <button type="button" class="btn-remove-admin-profile" data-username="${uname}" title="Quitar de este equipo" style="background: none; border: none; color: var(--text-dark); cursor: pointer; padding: 6px; border-radius: 6px; transition: color 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='var(--text-dark)'">
                <i class="fa-solid fa-trash-can" style="font-size: 0.85rem;"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');

      // Clic en tarjeta -> CAMBIO INSTANTÁNEO 1-CLIC
      listContainer.querySelectorAll('.admin-account-card').forEach(card => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('.btn-remove-admin-profile')) return;
          const uname = card.getAttribute('data-username');
          executeImmediateSwitch(uname);
        });
      });

      // Clic en botón "Entrar"
      listContainer.querySelectorAll('.btn-switch-now').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const uname = btn.getAttribute('data-username');
          executeImmediateSwitch(uname);
        });
      });

      // Eliminar cuenta guardada de este equipo
      listContainer.querySelectorAll('.btn-remove-admin-profile').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const uname = btn.getAttribute('data-username');
          if (confirm(`¿Quitar la cuenta de @${uname} de la lista de este computador?`)) {
            SirioAuth.removeAdminProfile(uname);
            renderSavedAccounts();
          }
        });
      });
    }

    // Función que realiza el cambio de cuenta
    function executeImmediateSwitch(uname) {
      if (!uname) return;
      const current = SirioAuth.getCurrentUser() || {};
      const rawCurrentUname = current.username !== undefined ? current.username : (current.usuario !== undefined ? current.usuario : '');
      const currentUname = String(rawCurrentUname || '').trim().toLowerCase();
      
      if (String(uname).trim().toLowerCase() === currentUname) {
        // Ya es la cuenta activa, cerrar modal
        modal.style.display = 'none';
        return;
      }

      // Buscar perfil guardado
      const profiles = SirioAuth.getSavedAdminProfiles();
      const profile = profiles.find(p => String(p.username || p.usuario || '').trim().toLowerCase() === String(uname).trim().toLowerCase());
      const roleStr = String(profile?.rol || '').toLowerCase().trim();

      // REGLA DE SEGURIDAD:
      // Si el rol es 'programadores' o 'jefas', solicitar contraseña obligatoriamente
      if (roleStr === 'programadores' || roleStr === 'jefas') {
        if (form && addNewContainer) {
          form.style.display = 'block';
          addNewContainer.style.display = 'none';
          if (usernameInput) {
            usernameInput.value = uname;
          }
          if (passwordInput) {
            passwordInput.value = '';
            passwordInput.focus();
          }
          const roleLabel = roleStr === 'jefas' ? 'Jefa' : 'Programador';
          showAlert(`Por seguridad, ingresa la contraseña para cambiar a la cuenta de ${roleLabel} (@${uname}).`);
        }
        return;
      }

      SirioAuth.showLoading(`Cambiando a @${uname}...`);
      const ok = SirioAuth.switchToAdminProfile(uname);
      if (ok) {
        setTimeout(() => {
          window.location.reload();
        }, 300);
      } else {
        SirioAuth.hideLoading();
        showAlert('No se pudo cambiar de cuenta. Intenta iniciar sesión nuevamente.');
      }
    }

    // Alternar formulario para añadir nueva cuenta
    if (useAnotherBtn && form && addNewContainer) {
      useAnotherBtn.addEventListener('click', () => {
        form.style.display = 'block';
        addNewContainer.style.display = 'none';
        if (usernameInput) {
          usernameInput.value = '';
          usernameInput.focus();
        }
        if (passwordInput) passwordInput.value = '';
        hideAlert();
      });
    }

    if (cancelNewBtn && form && addNewContainer) {
      cancelNewBtn.addEventListener('click', () => {
        form.style.display = 'none';
        addNewContainer.style.display = 'block';
        hideAlert();
      });
    }

    // Toggle ver/ocultar contraseña
    if (togglePwdBtn && passwordInput) {
      togglePwdBtn.addEventListener('click', () => {
        const isHidden = passwordInput.type === 'password';
        passwordInput.type = isHidden ? 'text' : 'password';
        if (togglePwdIcon) togglePwdIcon.className = isHidden ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
        togglePwdBtn.style.color = isHidden ? 'var(--color-primary)' : 'var(--text-dark)';
      });
    }

    // Abrir modal
    switchBtn.addEventListener('click', () => {
      hideAlert();
      if (form) form.style.display = 'none';
      if (addNewContainer) addNewContainer.style.display = 'block';
      renderSavedAccounts();
      modal.style.display = 'flex';
    });

    // Cerrar modal
    const closeModal = () => {
      modal.style.display = 'none';
      if (passwordInput) passwordInput.value = '';
      hideAlert();
    };
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (closeSecBtn) closeSecBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Enviar formulario para autenticar y guardar nueva cuenta de personal
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert();

        const username = usernameInput ? usernameInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';

        if (!username || !password) {
          showAlert('Por favor ingresa usuario y contraseña.');
          return;
        }

        const submitBtn = document.getElementById('btn-submit-switch');
        const origBtnHtml = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Autenticando...';
        }

        try {
          const result = await SirioAuth.login(username, password, true);

          if (result.success) {
            if (SirioAuth.isAdminRole(result.user.rol)) {
              if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> ¡Cuenta Guardada!';
              setTimeout(() => {
                window.location.reload();
              }, 400);
            } else {
              window.location.href = 'client.html';
            }
          } else {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.innerHTML = origBtnHtml;
            }
            showAlert(result.message || 'Contraseña o usuario incorrecto.');
          }
        } catch (err) {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origBtnHtml;
          }
          showAlert('Error de conexión con el servidor.');
        }
      });
    }
  }());

}());



