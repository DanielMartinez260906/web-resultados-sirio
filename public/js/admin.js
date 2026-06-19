/**
 * LÓGICA DEL PANEL DE ADMINISTRACIÓN - LABORATORIO SIRIO
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Verificar sesión de administrador
  const currentUser = SirioAuth.checkSession('admin');
  if (!currentUser) return;

  // Mostrar nombre del administrador en la cabecera
  document.getElementById('admin-name').innerText = currentUser.nombre;
  document.getElementById('logout-btn').addEventListener('click', () => SirioAuth.logout());

  // Variables de estado
  let allClients = [];
  let selectedClient = null;
  let selectedFiles = []; // Almacena el listado de archivos seleccionados/arrastrados
  let allResults = []; // Almacena todos los resultados para el historial general

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
        <td colspan="4" style="text-align: center; color: var(--text-dark); padding: 2.5rem 0;">
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
        renderGeneralOverview(allResults);
      } else {
        allResultsTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--error); padding: 1.5rem;">${data.message || 'Error al obtener historial general.'}</td></tr>`;
      }
    } catch (error) {
      console.error('Error al cargar historial general:', error);
      allResultsTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--error); padding: 1.5rem;">Error de conexion al cargar historial general.</td></tr>`;
    }
  }

  // Renderizar la tabla de historial general
  function renderGeneralOverview(results) {
    totalResultsCount.innerText = `${results.length} ${results.length === 1 ? 'examen' : 'examenes'}`;
    
    if (results.length === 0) {
      allResultsTableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 3rem 0;">
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
              <a href="/uploads/${res.nombre_archivo}" target="_blank" class="btn btn-secondary btn-icon" style="padding: 4px 8px;" title="Ver PDF">
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

  // Filtrado del historial general
  searchAllResults.addEventListener('keyup', () => {
    const query = searchAllResults.value.toLowerCase().trim();
    if (!query) {
      renderGeneralOverview(allResults);
      return;
    }
    const filtered = allResults.filter(res => 
      res.nombre_cliente.toLowerCase().includes(query) || 
      res.nombre_examen.toLowerCase().includes(query)
    );
    renderGeneralOverview(filtered);
  });

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
          <h4 style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${client.nombre}</h4>
          <p><i class="fa-solid fa-id-card"></i> ID/NIT: ${client.identificacion}</p>
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
          <a href="/uploads/${res.nombre_archivo}" target="_blank" class="btn btn-secondary btn-icon" style="padding: 6px 10px;" title="Ver PDF">
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
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;

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
        renderDirClients(allClients);
        selectedDirClient = null;
        if (dirClientDetailView) dirClientDetailView.style.display = 'none';
        if (dirNoClientSelected) dirNoClientSelected.style.display = 'flex';
      }
    });
  });

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

  let selectedDirClient = null;

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
      if (selectedDirClient && selectedDirClient.id_usuario === client.id_usuario) {
        item.classList.add('active');
      }
      
      item.innerHTML = `
        <div class="client-item-info">
          <h4>${client.nombre}</h4>
          <p><i class="fa-solid fa-passport"></i> DNI: ${client.identificacion}</p>
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
            contrasena
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

  // Inicialización
  loadClients();
  loadGeneralOverview();
});
