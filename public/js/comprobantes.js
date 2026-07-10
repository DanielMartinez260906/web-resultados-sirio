/**
 * GENERADOR DE COMPROBANTES IMPRIMIBLES Y DESCARGABLES - LABORATORIO SIRIO
 * Utiliza html2pdf.js para generar descargas automáticas en PDF con prevención de cortes de página.
 */

const SirioComprobantes = {
  /**
   * Genera y descarga el comprobante de ingreso del paciente.
   */
  printIngresoPaciente(data) {
    // Generar elemento temporal para la exportación a PDF
    const element = document.createElement('div');
    element.style.width = '750px'; // Ancho de visualización fijo para la escala
    element.style.backgroundColor = '#ffffff';
    element.style.color = '#1e293b';
    element.style.padding = '25px';

    const fechaStr = data.fecha || new Date().toLocaleString('es-CO');
    const codigoStr = data.codigo_registro || 'N/A';

    // Construir secciones especiales si las hay
    let especialSectionHtml = '';
    if (data.datos_especiales_tipo && data.datos_especiales_tipo !== 'Ninguno' && data.datos_especiales_detalle) {
      try {
        const detalle = JSON.parse(data.datos_especiales_detalle);
        let fieldsHtml = '';
        
        if (data.datos_especiales_tipo === 'Biopsia') {
          fieldsHtml = `
            <div class="field-row"><span class="field-label">Tipo Muestra:</span><span class="field-value">${detalle.tipo_muestra || 'N/A'}</span></div>
            <div class="field-row"><span class="field-label">Aspecto Lesión:</span><span class="field-value">${detalle.aspecto || 'N/A'}</span></div>
            <div class="field-row"><span class="field-label">Consistencia:</span><span class="field-value">${detalle.consistencia || 'N/A'}</span></div>
            <div class="field-row"><span class="field-label">Ubicación Lesión:</span><span class="field-value">${detalle.ubicacion || 'N/A'}</span></div>
            <div class="field-row"><span class="field-label">Tiempo Evolución:</span><span class="field-value">${detalle.tiempo_evolucion || 'N/A'}</span></div>
            <div class="field-row"><span class="field-label">Detalles Adicionales:</span><span class="field-value">${detalle.detalles_adicionales || 'N/A'}</span></div>
          `;
        } else if (data.datos_especiales_tipo === 'PCR') {
          fieldsHtml = `
            <div class="field-row"><span class="field-label">Tipo PCR:</span><span class="field-value">${detalle.tipo_pcr || 'N/A'}</span></div>
            <div class="field-row"><span class="field-label">Estado Paciente:</span><span class="field-value">${detalle.estado_paciente || 'N/A'}</span></div>
            <div class="field-row" style="grid-column: 1 / -1;"><span class="field-label">Síntomas:</span><span class="field-value">${(detalle.sintomas || []).join(', ') || 'Ninguno'}</span></div>
            <div class="field-row" style="grid-column: 1 / -1;"><span class="field-label">Observaciones PCR:</span><span class="field-value">${detalle.observaciones_pcr || 'Ninguna'}</span></div>
          `;
        }

        especialSectionHtml = `
          <div class="section-box">
            <h3 class="section-title">3. DATOS ESPECIALES DE ${data.datos_especiales_tipo.toUpperCase()}</h3>
            <div class="grid-2">
              ${fieldsHtml}
            </div>
          </div>
        `;
      } catch (e) {
        console.error('Error al parsear detalles especiales:', e);
      }
    }

    element.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
        
        .receipt-body {
          font-family: 'Outfit', sans-serif;
          color: #1e293b;
          background-color: #ffffff;
          padding: 10px;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        
        .header-left {
          display: flex;
          align-items: center;
        }
        
        .logo-img {
          height: 65px;
          width: auto;
          object-fit: contain;
        }
        
        .header-titles {
          margin-left: 15px;
        }
        
        .main-title {
          font-size: 1.35rem;
          font-weight: 700;
          color: #0b5a60;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        
        .subtitle {
          font-size: 0.8rem;
          color: #64748b;
          margin: 3px 0 0 0;
          font-weight: 500;
        }
        
        .header-right {
          text-align: right;
          font-size: 0.8rem;
          color: #334155;
        }
        
        .header-right p {
          margin: 3px 0;
        }
        
        .top-divider {
          border-top: 2.2px solid #0b5a60;
          margin-bottom: 15px;
          margin-top: 4px;
        }
        
        .section-box {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 12px;
          background-color: #ffffff;
        }
        
        .section-title {
          color: #0b5a60;
          font-size: 0.85rem;
          font-weight: 700;
          margin-top: 0;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 4px;
        }
        
        .grid-2 {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px 20px;
        }
        
        .field-row {
          display: flex;
          align-items: baseline;
          font-size: 0.82rem;
          line-height: 1.35;
        }
        
        .field-label {
          font-weight: 500;
          color: #64748b;
          width: 140px;
          flex-shrink: 0;
        }
        
        .field-value {
          color: #1e293b;
          font-weight: 400;
          flex-grow: 1;
          word-break: break-word;
        }
        
        .full-width {
          grid-column: 1 / -1;
        }
        
        .bottom-divider {
          border-top: 1px solid #e2e8f0;
          margin-top: 15px;
          margin-bottom: 10px;
        }
        
        .footer-box {
          text-align: center;
          font-size: 0.72rem;
          color: #64748b;
          line-height: 1.4;
        }
        
        .footer-note {
          margin-bottom: 2px;
          font-style: italic;
        }
        
        .footer-brand {
          font-weight: 600;
          color: #334155;
        }

        /* Prevenir cortes bruscos de texto */
        p, li, h1, h2, h3, h4, .field-row, .section-box {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      </style>
      
      <div class="receipt-body">
        <div class="header">
          <div class="header-left">
            <img src="/logo.png" alt="SIRIO Logo" class="logo-img">
            <div class="header-titles">
              <h1 class="main-title">Comprobante de Ingreso de Paciente</h1>
              <p class="subtitle">Sirio - Diagnóstico Veterinario Especializado</p>
            </div>
          </div>
          <div class="header-right">
            <p><strong>Fecha:</strong> ${fechaStr}</p>
            <p><strong>Código Reg:</strong> ${codigoStr}</p>
          </div>
        </div>
        
        <div class="top-divider"></div>
        
        <div class="section-box">
          <h3 class="section-title">1. DATOS GENERALES</h3>
          <div class="grid-2">
            <div class="field-row full-width">
              <span class="field-label">Correo Centro:</span>
              <span class="field-value">${data.correo_centro || 'N/A'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Centro Veterinario:</span>
              <span class="field-value">${data.centro_veterinario || 'N/A'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Médico Veterinario:</span>
              <span class="field-value">${data.medico || 'N/A'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Propietario Mascota:</span>
              <span class="field-value">${data.propietario || 'N/A'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Paciente (HC):</span>
              <span class="field-value">${data.paciente_nombre || 'N/A'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Especie / Raza:</span>
              <span class="field-value">${data.especie || 'N/A'} / ${data.raza || 'N/A'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Edad / Sexo:</span>
              <span class="field-value">${data.edad || 'N/A'} / ${data.sexo || 'N/A'}</span>
            </div>
          </div>
        </div>
        
        <div class="section-box">
          <h3 class="section-title">2. MUESTRAS Y EXÁMENES</h3>
          <div class="grid-2">
            <div class="field-row full-width">
              <span class="field-label">Muestra(s) Enviada(s):</span>
              <span class="field-value">${data.muestra || 'Ninguna'}</span>
            </div>
            <div class="field-row full-width" style="margin-top: 3px;">
              <span class="field-label">Exámenes Comunes:</span>
              <span class="field-value">${data.examenes_solicitados || 'Ninguno'}</span>
            </div>
            ${data.otros_examenes ? `
              <div class="field-row full-width" style="margin-top: 3px;">
                <span class="field-label">Otros Exámenes:</span>
                <span class="field-value">${data.otros_examenes}</span>
              </div>
            ` : ''}
            ${data.observaciones ? `
              <div class="field-row full-width" style="margin-top: 3px;">
                <span class="field-label">Observaciones:</span>
                <span class="field-value">${data.observaciones}</span>
              </div>
            ` : ''}
          </div>
        </div>
        
        ${especialSectionHtml}
        
        <div class="section-box">
          <h3 class="section-title">4. DATOS DE RECOLECCIÓN Y CONTROL</h3>
          <div class="grid-2">
            <div class="field-row full-width">
              <span class="field-label">Dirección de Recogida:</span>
              <span class="field-value">${data.direccion_recoleccion || 'Dirección registrada'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Teléfono de Contacto:</span>
              <span class="field-value">${data.contacto_recoleccion || 'Teléfono registrado'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Diligenciado por:</span>
              <span class="field-value">${data.quien_diligencia || 'N/A'}</span>
            </div>
          </div>
        </div>
        
        <div class="bottom-divider"></div>
        
        <div class="footer-box">
          <p class="footer-note">Este es un comprobante de diligenciamiento local para el control del centro veterinario y el transportador.</p>
          <p class="footer-brand">SIRIO - Laboratorio Veterinario Especializado &rarr; WhatsApp: 3148759148 - 3106606973</p>
        </div>
      </div>
    `;

    const opt = {
      margin:       [10, 10, 10, 10],
      filename:     `Comprobante_Ingreso_${codigoStr}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };

    if (typeof html2pdf !== 'undefined') {
      html2pdf().set(opt).from(element).save();
    } else {
      console.warn('html2pdf.js no disponible. Usando fallback de impresión.');
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(element.innerHTML);
        printWindow.document.close();
        printWindow.print();
      }
    }
  },

  /**
   * Genera y descarga el informe de interpretación de SirIA.
   */
  printInterpretacionIa(data) {
    const element = document.createElement('div');
    element.style.width = '750px';
    element.style.backgroundColor = '#ffffff';
    element.style.color = '#1e293b';
    element.style.padding = '25px';

    const fechaStr = data.fecha || new Date().toLocaleString('es-CO');
    const codigoStr = data.codigo_interpretacion || 'IA-' + Math.floor(100000 + Math.random() * 900000);

    element.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
        
        .receipt-body {
          font-family: 'Outfit', sans-serif;
          color: #1e293b;
          background-color: #ffffff;
          padding: 10px;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        
        .header-left {
          display: flex;
          align-items: center;
        }
        
        .avatar-img {
          height: 60px;
          width: 60px;
          border-radius: 50%;
          object-fit: cover;
          border: 2.2px solid #d4af37;
        }
        
        .header-titles {
          margin-left: 15px;
        }
        
        .main-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #b8952b;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        
        .subtitle {
          font-size: 0.8rem;
          color: #64748b;
          margin: 3px 0 0 0;
          font-weight: 500;
        }
        
        .header-right {
          text-align: right;
          font-size: 0.8rem;
          color: #334155;
        }
        
        .header-right p {
          margin: 3px 0;
        }
        
        .top-divider {
          border-top: 2.2px solid #d4af37;
          margin-bottom: 15px;
          margin-top: 4px;
        }
        
        .section-box {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 12px;
          background-color: #ffffff;
        }
        
        .section-title {
          color: #b8952b;
          font-size: 0.85rem;
          font-weight: 700;
          margin-top: 0;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 4px;
        }
        
        .grid-2 {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px 20px;
        }
        
        .field-row {
          display: flex;
          align-items: baseline;
          font-size: 0.82rem;
          line-height: 1.35;
        }
        
        .field-label {
          font-weight: 500;
          color: #64748b;
          width: 140px;
          flex-shrink: 0;
        }
        
        .field-value {
          color: #1e293b;
          font-weight: 400;
          flex-grow: 1;
          word-break: break-word;
        }
        
        .full-width {
          grid-column: 1 / -1;
        }
        
        .interpretation-content {
          font-size: 0.85rem;
          line-height: 1.6;
          color: #1e293b;
          white-space: pre-wrap;
        }
        
        .interpretation-content strong {
          color: #0f172a;
        }
        
        .bottom-divider {
          border-top: 1px solid #e2e8f0;
          margin-top: 15px;
          margin-bottom: 10px;
        }
        
        .footer-box {
          text-align: center;
          font-size: 0.72rem;
          color: #64748b;
          line-height: 1.4;
        }
        
        .footer-note {
          margin-bottom: 2px;
          color: #ef4444;
          font-weight: 500;
        }
        
        .footer-brand {
          font-weight: 600;
          color: #334155;
        }

        /* Prevenir cortes de página bruscos en párrafos, listas y cajas */
        p, li, h1, h2, h3, h4, .field-row, .section-box, .interpretation-content div {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      </style>
      
      <div class="receipt-body">
        <div class="header">
          <div class="header-left">
            <img src="/img/siria-avatar.png" alt="SirIA Avatar" class="avatar-img">
            <div class="header-titles">
              <h1 class="main-title">Informe de Interpretación Médica (SirIA)</h1>
              <p class="subtitle">Apoyo al Diagnóstico Clínico Asistido por Inteligencia Artificial</p>
            </div>
          </div>
          <div class="header-right">
            <p><strong>Fecha Emisión:</strong> ${fechaStr}</p>
            <p><strong>Código Reporte:</strong> ${codigoStr}</p>
          </div>
        </div>
        
        <div class="top-divider"></div>
        
        <div class="section-box">
          <h3 class="section-title">1. DATOS DEL EXAMEN</h3>
          <div class="grid-2">
            <div class="field-row full-width">
              <span class="field-label">Cliente (Veterinaria):</span>
              <span class="field-value">${data.centro_veterinario || 'N/A'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Paciente Analizado:</span>
              <span class="field-value">${data.nombre_examen || 'N/A'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Fecha del Examen:</span>
              <span class="field-value">${data.fecha_examen || 'N/A'}</span>
            </div>
          </div>
        </div>
        
        <div class="section-box">
          <h3 class="section-title">2. APOYO EN INTERPRETACIÓN MÉDICA</h3>
          <div class="interpretation-content">${data.analisis_html || 'Sin análisis disponible.'}</div>
        </div>
        
        <div class="section-box" style="background-color: rgba(239, 68, 68, 0.01); border-color: rgba(239, 68, 68, 0.1);">
          <h3 class="section-title" style="color: #ef4444; border-bottom-color: rgba(239, 68, 68, 0.06);">3. NOTA DE RESPONSABILIDAD PROFESIONAL</h3>
          <p style="font-size: 0.76rem; line-height: 1.45; color: #475569; margin: 0;">
            <strong>Importante:</strong> Este informe es una herramienta de apoyo interpretativo impulsada por Inteligencia Artificial y basado exclusivamente en la información estructurada del PDF proporcionado. No constituye un diagnóstico médico oficial, no sustituye el criterio, anamnesis ni examen físico del médico veterinario tratante, quien conserva la total responsabilidad del diagnóstico y plan terapéutico del paciente.
          </p>
        </div>
        
        <div class="bottom-divider"></div>
        
        <div class="footer-box">
          <p class="footer-note">SirIA - Módulo de Inteligencia Artificial de SIRIO Diagnóstico Veterinario Especializado</p>
          <p class="footer-brand">SIRIO - Laboratorio Veterinario Especializado &rarr; WhatsApp: 3148759148 - 3106606973</p>
        </div>
      </div>
    `;

    const opt = {
      margin:       [10, 10, 10, 10],
      filename:     `Informe_SirIA_${codigoStr}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };

    if (typeof html2pdf !== 'undefined') {
      html2pdf().set(opt).from(element).save();
    } else {
      console.warn('html2pdf.js no disponible. Usando fallback de impresión.');
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(element.innerHTML);
        printWindow.document.close();
        printWindow.print();
      }
    }
  }
};
