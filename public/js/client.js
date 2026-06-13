/**
 * LÓGICA DEL PORTAL DEL PACIENTE - LABORATORIO SIRIO
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Verificar sesión del cliente
  const currentUser = SirioAuth.checkSession('cliente');
  if (!currentUser) return;

  // Mostrar nombre del cliente y DNI en la cabecera
  document.getElementById('client-name').innerText = currentUser.nombre;
  document.getElementById('client-id-text').innerText = currentUser.identificacion;
  
  // Botón de cerrar sesión
  document.getElementById('logout-btn').addEventListener('click', () => SirioAuth.logout());

  // Variables de estado
  let allResults = [];

  // Elementos del DOM
  const resultsContainer = document.getElementById('results-container');
  const searchExamInput = document.getElementById('search-exam');
  const globalAlert = document.getElementById('client-global-alert');
  const globalAlertText = document.getElementById('client-global-alert-text');

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
        resultsContainer.innerHTML = '<p style="text-align: center; color: var(--error); padding: 2rem 0; grid-column: 1 / -1;">No se pudieron cargar los resultados.</p>';
      }
    } catch (error) {
      console.error('Error al cargar resultados:', error);
      showGlobalAlert('No se pudo establecer conexión con el servidor.', 'error');
      resultsContainer.innerHTML = '<p style="text-align: center; color: var(--error); padding: 2rem 0; grid-column: 1 / -1;">Error de conexión con el servidor.</p>';
    }
  }

  // Renderizar exámenes como tarjetas
  function renderResults(results) {
    if (results.length === 0) {
      resultsContainer.innerHTML = `
        <div class="detail-view-placeholder" style="grid-column: 1 / -1; padding: 4rem 1rem;">
          <i class="fa-solid fa-file-waveform" style="font-size: 3rem; color: var(--text-dark); opacity: 0.3; margin-bottom: 1rem;"></i>
          <h3>No hay Exámenes Disponibles</h3>
          <p>Aún no se han publicado resultados de exámenes para tu cuenta. Te notificaremos cuando estén disponibles.</p>
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = '';
    results.forEach(res => {
      const card = document.createElement('div');
      card.className = 'result-card';
      
      // Formatear la fecha a un formato amigable (ej: 13 de junio, 2026)
      const dateStr = res.fecha_subida.split('T')[0];
      const dateParts = dateStr.split('-');
      let dateLabel = dateStr;
      
      if (dateParts.length === 3) {
        const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        const dia = parseInt(dateParts[2]);
        const mes = meses[parseInt(dateParts[1]) - 1];
        const anio = dateParts[0];
        dateLabel = `${dia} ${mes}, ${anio}`;
      }

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

  // Filtrar exámenes por nombre del archivo PDF
  searchExamInput.addEventListener('keyup', () => {
    const query = searchExamInput.value.toLowerCase().trim();
    const filtered = allResults.filter(res => 
      res.nombre_examen.toLowerCase().includes(query)
    );
    renderResults(filtered);
  });

  // Mostrar alertas
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

  // Inicializar cargando los resultados
  loadResults();
});
