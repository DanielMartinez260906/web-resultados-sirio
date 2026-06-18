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
        <div class="client-item-info">
          <h4>${client.nombre}</h4>
          <p><i class="fa-solid fa-id-card"></i> ID/NIT: ${client.identificacion}</p>
        </div>
        <span class="client-item-badge">${client.id_usuario}</span>
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
    generalOverviewView.style.display = 'none';
    activeClientView.style.display = 'block';

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
    generalOverviewView.style.display = 'block';
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

  // Registrar nuevo cliente
  createClientForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre = document.getElementById('new-client-name').value;
    const identificacion = document.getElementById('new-client-id').value;
    const usuario = document.getElementById('new-client-username').value;
    const contrasena = document.getElementById('new-client-password').value;

    SirioAuth.showLoading('Creando cuenta de cliente...');

    try {
      const response = await fetch(`${SirioAuth.API_BASE}/api/admin/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nombre, identificacion, usuario, contrasena })
      });

      const result = await response.json();
      SirioAuth.hideLoading();

      if (result.success) {
        showGlobalAlert(result.message, 'success');
        createClientForm.reset();
        
        // Recargar lista y seleccionar el nuevo cliente
        await loadClients();
        const newClient = allClients.find(c => c.id_usuario === result.client.id_usuario);
        if (newClient) {
          selectClient(newClient);
        }
      } else {
        showGlobalAlert(result.message || 'Error al registrar el cliente.', 'error');
      }
    } catch (error) {
      SirioAuth.hideLoading();
      console.error('Error al registrar cliente:', error);
      showGlobalAlert('Error de red al intentar registrar al cliente.', 'error');
    }
  });

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

  // Inicialización
  loadClients();
  loadGeneralOverview();
});
