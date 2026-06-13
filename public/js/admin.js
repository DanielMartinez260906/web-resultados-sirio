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
  let selectedFile = null;

  // Elementos del DOM
  const clientsContainer = document.getElementById('clients-container');
  const searchClientInput = document.getElementById('search-client');
  const createClientForm = document.getElementById('create-client-form');
  const placeholderDetail = document.getElementById('placeholder-detail');
  const activeClientView = document.getElementById('active-client-view');
  
  // Detalle de Cliente Activo
  const activeClientName = document.getElementById('active-client-name');
  const activeClientIdVal = document.getElementById('active-client-id-val');
  const activeClientUsernameVal = document.getElementById('active-client-username-val');
  const deselectClientBtn = document.getElementById('deselect-client-btn');
  const clientHistoryContainer = document.getElementById('client-history-container');

  // Formulario de Subida
  const uploadResultForm = document.getElementById('upload-result-form');
  const uploadClientIdInput = document.getElementById('upload-client-id');
  const patientNameInput = document.getElementById('patient-name');
  const examNameInput = document.getElementById('exam-name');
  const examObsInput = document.getElementById('exam-obs');
  const dropzone = document.getElementById('dropzone');
  const pdfInput = document.getElementById('pdf-input');
  const fileInfo = document.getElementById('file-info');
  const fileNameText = document.getElementById('file-name-text');
  const removeFileBtn = document.getElementById('remove-file-btn');

  // Alertas
  const globalAlert = document.getElementById('admin-global-alert');
  const globalAlertText = document.getElementById('admin-global-alert-text');

  // ==========================================================================
  // FUNCIONES DE API
  // ==========================================================================

  // Cargar lista de clientes
  async function loadClients() {
    try {
      const response = await fetch('/api/admin/clients');
      const data = await response.json();
      
      if (data.success) {
        allClients = data.clients;
        renderClients(allClients);
      } else {
        showGlobalAlert(data.message || 'Error al cargar los clientes.', 'error');
      }
    } catch (error) {
      console.error('Error al cargar clientes:', error);
      showGlobalAlert('No se pudo establecer conexión para cargar clientes.', 'error');
    }
  }

  // Cargar historial de exámenes del cliente activo
  async function loadClientHistory(clientId) {
    clientHistoryContainer.innerHTML = `
      <div style="text-align: center; color: var(--text-dark); padding: 1.5rem 0;">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
        <p>Cargando historial...</p>
      </div>
    `;

    try {
      const response = await fetch(`/api/client/results?id_usuario=${clientId}`);
      const data = await response.json();

      if (data.success) {
        renderHistory(data.results);
      } else {
        clientHistoryContainer.innerHTML = `<p style="color: var(--error); text-align: center; padding: 1rem;">${data.message || 'Error al obtener historial.'}</p>`;
      }
    } catch (error) {
      console.error('Error al cargar historial:', error);
      clientHistoryContainer.innerHTML = '<p style="color: var(--error); text-align: center; padding: 1rem;">Error de conexión al cargar historial.</p>';
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

  // Renderizar el historial de exámenes
  function renderHistory(results) {
    if (results.length === 0) {
      clientHistoryContainer.innerHTML = '<p style="text-align: center; color: var(--text-dark); padding: 1.5rem 0;">No hay exámenes publicados para este cliente.</p>';
      return;
    }

    clientHistoryContainer.innerHTML = '';
    results.forEach(res => {
      const div = document.createElement('div');
      div.className = 'client-item';
      div.style.cursor = 'default';
      div.style.borderLeft = '3px solid var(--color-accent)';
      
      div.innerHTML = `
        <div class="client-item-info" style="flex-grow: 1;">
          <h4 style="font-size: 0.95rem; font-weight: 600;">
            Paciente: <span style="color: var(--text-main);">${res.nombre_paciente}</span>
          </h4>
          <p style="font-size: 0.85rem; color: var(--color-primary); font-weight: 500; margin-top: 2px;">
            Examen: ${res.nombre_examen}
          </p>
          <p style="font-size: 0.75rem; margin-top: 4px; color: var(--text-dark);">
            <i class="fa-solid fa-calendar"></i> ${res.fecha_subida.split('T')[0]} 
            ${res.observaciones ? `| <i class="fa-solid fa-comment"></i> ${res.observaciones.substring(0, 30)}${res.observaciones.length > 30 ? '...' : ''}` : ''}
          </p>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <a href="/uploads/${res.nombre_archivo}" target="_blank" class="btn btn-secondary btn-icon" style="padding: 6px 10px;" title="Ver PDF">
            <i class="fa-solid fa-file-pdf" style="color: var(--error); font-size: 1.1rem;"></i>
          </a>
          <button class="btn btn-danger btn-icon delete-result-btn" data-id="${res.id_resultado}" style="padding: 6px 10px;" title="Eliminar examen">
            <i class="fa-solid fa-trash-can" style="font-size: 1rem;"></i>
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
    placeholderDetail.style.display = 'none';
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
    placeholderDetail.style.display = 'flex';
    resetUploadForm();
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
      const response = await fetch('/api/admin/clients', {
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
  // DRAG & DROP Y SELECCIÓN DE ARCHIVOS
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

  // Dropear archivo
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  // Selección tradicional
  pdfInput.addEventListener('change', () => {
    if (pdfInput.files.length > 0) {
      handleFileSelected(pdfInput.files[0]);
    }
  });

  // Validador y guardado del archivo
  function handleFileSelected(file) {
    if (file.type !== 'application/pdf') {
      showGlobalAlert('Solo se admiten archivos en formato PDF.', 'error');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB
      showGlobalAlert('El tamaño máximo permitido es 10MB.', 'error');
      return;
    }

    selectedFile = file;
    fileNameText.innerText = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    dropzone.style.display = 'none';
    fileInfo.style.display = 'flex';
  }

  // Quitar archivo seleccionado
  removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetFileSelection();
  });

  function resetFileSelection() {
    selectedFile = null;
    pdfInput.value = '';
    fileInfo.style.display = 'none';
    dropzone.style.display = 'flex';
  }

  function resetUploadForm() {
    patientNameInput.value = '';
    examNameInput.value = '';
    examObsInput.value = '';
    resetFileSelection();
  }

  // ==========================================================================
  // PUBLICAR EXAMEN (Subir PDF)
  // ==========================================================================

  uploadResultForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!selectedClient) {
      showGlobalAlert('Por favor, selecciona un cliente primero.', 'error');
      return;
    }

    if (!selectedFile) {
      showGlobalAlert('Por favor, selecciona un archivo PDF con los resultados.', 'error');
      return;
    }

    const id_usuario = uploadClientIdInput.value;
    const nombre_paciente = patientNameInput.value.trim();
    const nombre_examen = examNameInput.value.trim();
    const observaciones = examObsInput.value.trim();

    // Crear FormData
    const formData = new FormData();
    formData.append('id_usuario', id_usuario);
    formData.append('nombre_paciente', nombre_paciente);
    formData.append('nombre_examen', nombre_examen);
    formData.append('observaciones', observaciones);
    formData.append('pdf', selectedFile);

    SirioAuth.showLoading('Publicando examen PDF...');

    try {
      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      SirioAuth.hideLoading();

      if (result.success) {
        showGlobalAlert('¡Examen publicado con éxito en el portal!', 'success');
        resetUploadForm();
        
        // Recargar historial del cliente activo
        loadClientHistory(id_usuario);
      } else {
        showGlobalAlert(result.message || 'Error al subir los resultados.', 'error');
      }
    } catch (error) {
      SirioAuth.hideLoading();
      console.error('Error al publicar examen:', error);
      showGlobalAlert('Error de conexión al subir el PDF al servidor.', 'error');
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
    
    const confirmDelete = confirm('¿Estás seguro de que deseas eliminar este resultado? Se borrará de la base de datos de Google Sheets y se eliminará el archivo PDF permanentemente.');
    if (!confirmDelete) return;
    
    SirioAuth.showLoading('Eliminando examen del portal...');
    
    try {
      const response = await fetch('/api/admin/delete-result', {
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
});
