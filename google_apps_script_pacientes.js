/**
 * CÓDIGO PARA GOOGLE APPS SCRIPT - INGRESO DE PACIENTES SIRIO
 * Mapeo exacto de 34 columnas (A hasta AH) alineado con Google Forms
 * 
 * Columnas:
 * A: Marca temporal
 * B: Dirección de correo electrónico
 * C: Centro veterinario o nombre médico veterinario en caso de no ser centro veterinario
 * D: Médico veterinario (Nombre y Apellido)
 * E: Propietario de la mascota
 * F: Nombre del paciente Y N° de historia clínica (si la tiene)
 * G: Especie
 * H: Raza
 * I: Edad
 * J: Sexo
 * K: Tipo de muestra enviada
 * L: EXAMENES MAS COMUNES. Selecciona el (los) examen(es) solicitado(s)
 * M: PRUEBAS INDIVIDUALES EN ORDEN ALFABÉTICO
 * N: CULTIVOS - MICROBIOLOGÍA . Todos los cultivos incluyen antibiograma.
 * O: EXAMENES SOLICITADOS: PERFILES
 * P: TOXICOLOGÍA
 * Q: OTROS EXÁMENES
 * R: OBSERVACIONES (Datos clínicos relevantes. Especificaciones para las pruebas solicitadas. Urgencias. Antibióticos de preferencia para el antibiograma, entre otros) :
 * S: DIRECCIÓN Y BARRIO. SI NO ES EL PUNTO DE RECOLECCIÓN HABITUAL
 * T: NÚMERO DE CONTACTO. SI NO ES EL PUNTO DE RECOLECCIÓN HABITUAL
 * U: NOMBRE DE QUIÉN DILIGENCIA ÉSTE FORMULARIO
 * V: ¿Programaste una Histopatología(Biopsia), Citología tumoral/TVT /PAAF o PCR?
 * W: Tipo de muestra
 * X: Aspecto de la lesión
 * Y: Consistencia
 * Z: Ubicación anatómica de la lesión
 * AA: Tiempo de evolución de la lesión
 * AB: Datos adicionales respecto a esta lesión
 * AC: Selecciona el tipo de PCR
 * AD: ¿El paciente es sintomático o asintomático?
 * AE: Sintomatología
 * AF: PCR a Solicitar y Observaciones adicionales
 * AG: ¿El paciente se encuentra esterilizado(a) /castrado?
 * AH: ¿Es un control?
 */

var API_KEY = "SIRIO_SECRET_API_KEY";

/**
 * EJECUTA ESTA FUNCIÓN DIRECTAMENTE EN EL EDITOR DE APPS SCRIPT (Botón 'Ejecutar')
 * para conceder los permisos de Google Forms que exige Google.
 */
function testAutorizarFormularios() {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var formUrl = doc.getFormUrl();
  Logger.log("Form URL vinculada: " + formUrl);
  if (formUrl) {
    var form = FormApp.openByUrl(formUrl);
    Logger.log("Formulario vinculado encontrado con éxito: " + form.getTitle());
    Logger.log("Total preguntas en el form: " + form.getItems().length);
  } else {
    Logger.log("No se detectó formulario vinculado directamente con getFormUrl().");
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    service: "Ingreso de Pacientes Laboratorio Sirio",
    version: "2.0 - 34 Columnas A-AH"
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var response = { success: false, message: "" };

  try {
    if (!e || !e.postData || !e.postData.contents) {
      response.message = "No se recibieron datos.";
      return returnJSON(response);
    }

    var requestData = JSON.parse(e.postData.contents);

    if (requestData.apiKey !== API_KEY) {
      response.message = "No autorizado: API Key incorrecta.";
      return returnJSON(response);
    }

    var action = requestData.action;
    var data = requestData.data || {};
    var doc = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "ingresarPaciente") {
      response = handleIngresarPaciente(doc, data);
    } else {
      response.message = "Acción no reconocida: " + action;
    }

  } catch (error) {
    response.success = false;
    response.message = "Error: " + error.toString();
  }

  return returnJSON(response);
}

function returnJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Inserta la fila de 34 columnas usando LockService para asegurar concurrencia sin colisiones
 */
function handleIngresarPaciente(doc, data) {
  var lock = LockService.getScriptLock();
  try {
    // Esperar hasta 30 segundos si hay otra inserción concurrente (ej: Google Form)
    lock.waitLock(30000);
  } catch (e) {
    return { success: false, message: "El servidor de hojas de cálculo está ocupado. Intenta nuevamente." };
  }

  try {
    // Usar específicamente la hoja 'Respuestas de formulario 4'
    var SHEET_NAME = "Respuestas de formulario 4";
    var sheet = doc.getSheetByName(SHEET_NAME);
    if (!sheet) {
      // Si por alguna razón de formato o espacios no la encuentra directa, buscar case-insensitive o primer hoja
      var allSheets = doc.getSheets();
      for (var s = 0; s < allSheets.length; s++) {
        if (allSheets[s].getName().trim().toLowerCase() === SHEET_NAME.toLowerCase()) {
          sheet = allSheets[s];
          break;
        }
      }
      if (!sheet) {
        sheet = doc.getSheets()[0] || doc.getActiveSheet();
      }
    }

    // Marca temporal formateada
    var now = new Date();
    var timezone = Session.getScriptTimeZone() || "America/Bogota";
    var fechaStr = Utilities.formatDate(now, timezone, "d/M/yyyy H:mm:ss");

    // Desglose de detalles especiales (Biopsia / PCR)
    var detEsp = {};
    if (data.datos_especiales_detalle) {
      try {
        detEsp = typeof data.datos_especiales_detalle === "string" ? JSON.parse(data.datos_especiales_detalle) : data.datos_especiales_detalle;
      } catch (e) {
        detEsp = {};
      }
    }

    var tipoEspecial = data.datos_especiales_tipo || "No";
    var tipoEspRespuestaForm = "No";
    if (tipoEspecial === "Biopsia") {
      tipoEspRespuestaForm = "Sí (Biopsia / Citología tumoral / PAAF)";
    } else if (tipoEspecial === "PCR") {
      tipoEspRespuestaForm = "Sí (PCR - Reacción en Cadena de la Polimerasa)";
    }

    // Biopsia fields
    var biopsiaTipoMuestra = (tipoEspecial === "Biopsia" && detEsp.tipo_muestra) ? detEsp.tipo_muestra : "";
    var biopsiaAspecto = (tipoEspecial === "Biopsia" && detEsp.aspecto) ? detEsp.aspecto : "";
    var biopsiaConsistencia = (tipoEspecial === "Biopsia" && detEsp.consistencia) ? detEsp.consistencia : "";
    var biopsiaUbicacion = (tipoEspecial === "Biopsia" && detEsp.ubicacion) ? detEsp.ubicacion : "";
    var biopsiaTiempo = (tipoEspecial === "Biopsia" && detEsp.tiempo_evolucion) ? detEsp.tiempo_evolucion : "";
    var biopsiaAdicional = (tipoEspecial === "Biopsia" && detEsp.detalles_adicionales) ? detEsp.detalles_adicionales : "";

    // PCR fields
    var pcrTipo = (tipoEspecial === "PCR" && detEsp.tipo_pcr) ? detEsp.tipo_pcr : "";
    var pcrSintomatico = (tipoEspecial === "PCR" && detEsp.estado_paciente) ? detEsp.estado_paciente : "";
    var pcrSintomas = "";
    if (tipoEspecial === "PCR" && detEsp.sintomas && Array.isArray(detEsp.sintomas)) {
      pcrSintomas = detEsp.sintomas.join(", ");
    }
    var pcrObservaciones = (tipoEspecial === "PCR" && detEsp.observaciones_pcr) ? detEsp.observaciones_pcr : "";

    // Esterilizado y Control solo aplican si es PCR
    var esterilizadoVal = (tipoEspecial === "PCR" && data.esterilizado) ? data.esterilizado : "";
    var esControlVal = (tipoEspecial === "PCR" && data.es_control) ? data.es_control : "";

    // Construcción del vector exacto de 34 columnas (A hasta AH)
    var rowData = [
      fechaStr,                                                       // A: Marca temporal
      data.email || "",                                               // B: Dirección de correo electrónico
      data.veterinaria || "",                                         // C: Centro veterinario o nombre médico veterinario...
      data.medico || "",                                              // D: Médico veterinario (Nombre y Apellido)
      data.propietario || "",                                         // E: Propietario de la mascota
      data.paciente_nombre || "",                                     // F: Nombre del paciente Y N° de historia clínica...
      data.especie || "",                                             // G: Especie
      data.raza || "",                                                // H: Raza
      data.edad || "",                                                // I: Edad
      data.sexo || "",                                                // J: Sexo
      data.tipo_muestra || "",                                        // K: Tipo de muestra enviada
      data.examenes_comunes || "",                                    // L: EXAMENES MAS COMUNES...
      data.examenes_individuales || "",                               // M: PRUEBAS INDIVIDUALES EN ORDEN ALFABÉTICO
      data.examenes_cultivos || "",                                   // N: CULTIVOS - MICROBIOLOGÍA...
      data.examenes_perfiles || "",                                   // O: EXAMENES SOLICITADOS: PERFILES
      data.examenes_toxicologia || "",                                // P: TOXICOLOGÍA
      data.otros_examenes || "",                                      // Q: OTROS EXÁMENES
      data.observaciones || "",                                       // R: OBSERVACIONES...
      data.direccion_recoleccion || "",                               // S: DIRECCIÓN Y BARRIO. SI NO ES EL PUNTO DE RECOLECCIÓN HABITUAL
      data.contacto_recoleccion || "",                                // T: NÚMERO DE CONTACTO. SI NO ES EL PUNTO DE RECOLECCIÓN HABITUAL
      data.quien_diligencia || "",                                    // U: NOMBRE DE QUIÉN DILIGENCIA ÉSTE FORMULARIO
      tipoEspRespuestaForm,                                           // V: ¿Programaste una Histopatología(Biopsia)...
      biopsiaTipoMuestra,                                             // W: Tipo de muestra
      biopsiaAspecto,                                                 // X: Aspecto de la lesión
      biopsiaConsistencia,                                            // Y: Consistencia
      biopsiaUbicacion,                                               // Z: Ubicación anatómica de la lesión
      biopsiaTiempo,                                                  // AA: Tiempo de evolución de la lesión
      biopsiaAdicional,                                               // AB: Datos adicionales respecto a esta lesión
      pcrTipo,                                                        // AC: Selecciona el tipo de PCR
      pcrSintomatico,                                                 // AD: ¿El paciente es sintomático o asintomático?
      pcrSintomas,                                                    // AE: Sintomatología
      pcrObservaciones,                                               // AF: PCR a Solicitar y Observaciones adicionales
      esterilizadoVal,                                                // AG: ¿El paciente se encuentra esterilizado(a) /castrado?
      esControlVal                                                    // AH: ¿Es un control?
    ];

    // ============================================================
    // INTEGRACIÓN NATIVA MEDIANTE FormApp (API de Google Forms)
    // Al usar FormApp para enviar una FormResponse oficial, Google Forms
    // actualiza su contador de respuestas y la inserta exactamente en su secuencia.
    // ============================================================
    var formSubmitted = false;
    var targetRow = sheet.getLastRow() + 1;

    try {
      var formUrl = doc.getFormUrl();
      if (!formUrl) {
        formUrl = "https://docs.google.com/forms/d/1FAIpQLSfgZR1FOANY3Qx2JIjcl0hNlGFCMn7View358teK4NPKPNunA/edit";
      }
      var form = FormApp.openByUrl(formUrl);
      if (form) {
        var formResponse = form.createResponse();
        var items = form.getItems();

        // Mapeo dinámico y seguro según las opciones reales del formulario
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          var title = item.getTitle().trim().toLowerCase();
          var itemType = item.getType();

          try {
            if (title.indexOf("correo") !== -1 || title.indexOf("email") !== -1) {
              if (itemType === FormApp.ItemType.TEXT) formResponse.withItemResponse(item.asTextItem().createResponse(data.email || ""));
            } else if (title.indexOf("centro veterinario") !== -1) {
              if (itemType === FormApp.ItemType.TEXT) formResponse.withItemResponse(item.asTextItem().createResponse(data.veterinaria || ""));
            } else if (title.indexOf("médico veterinario") !== -1 || title.indexOf("medico veterinario") !== -1) {
              if (itemType === FormApp.ItemType.TEXT) formResponse.withItemResponse(item.asTextItem().createResponse(data.medico || ""));
            } else if (title.indexOf("propietario") !== -1) {
              if (itemType === FormApp.ItemType.TEXT) formResponse.withItemResponse(item.asTextItem().createResponse(data.propietario || ""));
            } else if (title.indexOf("nombre del paciente") !== -1) {
              if (itemType === FormApp.ItemType.TEXT) formResponse.withItemResponse(item.asTextItem().createResponse(data.paciente_nombre || ""));
            } else if (title === "especie" || title.indexOf("especie") !== -1) {
              setSafeChoiceResponse(formResponse, item, data.especie || "Canino");
            } else if (title === "raza" || title.indexOf("raza") !== -1) {
              setSafeChoiceResponse(formResponse, item, data.raza || "Criollo");
            } else if (title === "edad" || title.indexOf("edad") !== -1) {
              setSafeChoiceResponse(formResponse, item, data.edad || "1 AÑO");
            } else if (title === "sexo" || title.indexOf("sexo") !== -1) {
              setSafeChoiceResponse(formResponse, item, data.sexo || "Macho");
            } else if (title.indexOf("tipo de muestra enviada") !== -1) {
              setSafeCheckboxResponse(formResponse, item, data.tipo_muestra);
            } else if (title.indexOf("examenes mas comunes") !== -1 || title.indexOf("exámenes más comunes") !== -1) {
              setSafeCheckboxResponse(formResponse, item, data.examenes_comunes);
            } else if (title.indexOf("pruebas individuales") !== -1) {
              setSafeCheckboxResponse(formResponse, item, data.examenes_individuales);
            } else if (title.indexOf("cultivos") !== -1) {
              setSafeCheckboxResponse(formResponse, item, data.examenes_cultivos);
            } else if (title.indexOf("perfiles") !== -1) {
              setSafeCheckboxResponse(formResponse, item, data.examenes_perfiles);
            } else if (title.indexOf("toxicología") !== -1 || title.indexOf("toxicologia") !== -1) {
              setSafeCheckboxResponse(formResponse, item, data.examenes_toxicologia);
            } else if (title.indexOf("otros exámenes") !== -1 || title.indexOf("otros examenes") !== -1) {
              if (itemType === FormApp.ItemType.TEXT || itemType === FormApp.ItemType.PARAGRAPH_TEXT) {
                if (data.otros_examenes) formResponse.withItemResponse(item.asTextItem().createResponse(data.otros_examenes));
              }
            } else if (title.indexOf("observaciones") !== -1 && title.indexOf("pcr") === -1) {
              if (itemType === FormApp.ItemType.PARAGRAPH_TEXT || itemType === FormApp.ItemType.TEXT) {
                if (data.observaciones) formResponse.withItemResponse(item.asParagraphTextItem().createResponse(data.observaciones));
              }
            } else if (title.indexOf("dirección y barrio") !== -1 || title.indexOf("direccion y barrio") !== -1) {
              if (itemType === FormApp.ItemType.TEXT) formResponse.withItemResponse(item.asTextItem().createResponse(data.direccion_recoleccion || ""));
            } else if (title.indexOf("número de contacto") !== -1 || title.indexOf("numero de contacto") !== -1) {
              if (itemType === FormApp.ItemType.TEXT) formResponse.withItemResponse(item.asTextItem().createResponse(data.contacto_recoleccion || ""));
            } else if (title.indexOf("diligencia") !== -1) {
              if (itemType === FormApp.ItemType.TEXT) formResponse.withItemResponse(item.asTextItem().createResponse(data.quien_diligencia || ""));
            } else if (title.indexOf("programaste una histopatología") !== -1 || title.indexOf("histopatologia") !== -1) {
              setSafeChoiceResponse(formResponse, item, tipoEspRespuestaForm);
            } else if (title === "tipo de muestra" && tipoEspecial === "Biopsia" && biopsiaTipoMuestra) {
              setSafeChoiceResponse(formResponse, item, biopsiaTipoMuestra);
            } else if (title.indexOf("aspecto de la lesión") !== -1 && tipoEspecial === "Biopsia" && biopsiaAspecto) {
              setSafeChoiceResponse(formResponse, item, biopsiaAspecto);
            } else if (title.indexOf("consistencia") !== -1 && tipoEspecial === "Biopsia" && biopsiaConsistencia) {
              setSafeChoiceResponse(formResponse, item, biopsiaConsistencia);
            } else if (title.indexOf("ubicación anatómica") !== -1 && tipoEspecial === "Biopsia" && biopsiaUbicacion) {
              if (itemType === FormApp.ItemType.TEXT) formResponse.withItemResponse(item.asTextItem().createResponse(biopsiaUbicacion));
            } else if (title.indexOf("tiempo de evolución") !== -1 && tipoEspecial === "Biopsia" && biopsiaTiempo) {
              if (itemType === FormApp.ItemType.TEXT) formResponse.withItemResponse(item.asTextItem().createResponse(biopsiaTiempo));
            } else if (title.indexOf("datos adicionales respecto a esta lesión") !== -1 && tipoEspecial === "Biopsia" && biopsiaAdicional) {
              if (itemType === FormApp.ItemType.PARAGRAPH_TEXT || itemType === FormApp.ItemType.TEXT) formResponse.withItemResponse(item.asParagraphTextItem().createResponse(biopsiaAdicional));
            } else if (title.indexOf("selecciona el tipo de pcr") !== -1 && tipoEspecial === "PCR" && pcrTipo) {
              setSafeChoiceResponse(formResponse, item, pcrTipo);
            } else if (title.indexOf("sintomático o asintomático") !== -1 && tipoEspecial === "PCR" && pcrSintomatico) {
              setSafeChoiceResponse(formResponse, item, pcrSintomatico);
            } else if (title.indexOf("sintomatología") !== -1 && tipoEspecial === "PCR" && detEsp.sintomas && Array.isArray(detEsp.sintomas) && detEsp.sintomas.length > 0) {
              setSafeCheckboxResponse(formResponse, item, detEsp.sintomas.join(", "));
            } else if (title.indexOf("pcr a solicitar y observaciones") !== -1 && tipoEspecial === "PCR" && pcrObservaciones) {
              if (itemType === FormApp.ItemType.PARAGRAPH_TEXT || itemType === FormApp.ItemType.TEXT) formResponse.withItemResponse(item.asParagraphTextItem().createResponse(pcrObservaciones));
            } else if (title.indexOf("esterilizado") !== -1 && tipoEspecial === "PCR" && esterilizadoVal) {
              setSafeChoiceResponse(formResponse, item, esterilizadoVal);
            } else if (title.indexOf("es un control") !== -1 && tipoEspecial === "PCR" && esControlVal) {
              setSafeChoiceResponse(formResponse, item, esControlVal);
            }
          } catch (eItem) {
            // Ignorar campo individual si no aplica
          }
        }

        formResponse.submit();
        formSubmitted = true;
        SpreadsheetApp.flush();
        targetRow = sheet.getLastRow();
      }
    } catch (eForm) {
      formSubmitted = false;
      var errDetail = eForm.toString();
    }

    // Fallback: si por permisos de cuenta FormApp no pudiera abrir el formulario, escribir en la fila real
    if (!formSubmitted) {
      var lastFilledRow = 1;
      var maxRows = sheet.getMaxRows();
      if (maxRows > 1) {
        var colAValues = sheet.getRange(1, 1, maxRows, 1).getValues();
        for (var r = colAValues.length - 1; r >= 0; r--) {
          if (colAValues[r][0] !== "" && colAValues[r][0] !== null && colAValues[r][0] !== undefined) {
            lastFilledRow = r + 1;
            break;
          }
        }
      }
      targetRow = lastFilledRow + 1;
      if (targetRow > sheet.getMaxRows()) {
        sheet.insertRowAfter(sheet.getMaxRows());
      }
      sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
      SpreadsheetApp.flush();
    }

    var codigoRegistro = "218" + Math.floor(1000 + Math.random() * 9000);

    return {
      success: true,
      message: formSubmitted ? "Paciente ingresado con éxito mediante Formulario." : "Paciente ingresado (Directo en hoja): " + (errDetail || ""),
      form_submitted: formSubmitted,
      codigo_registro: codigoRegistro,
      fecha: fechaStr,
      fila: targetRow
    };

  } catch (err) {
    return {
      success: false,
      message: "Error al escribir en Google Sheets: " + err.toString()
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Asigna una respuesta a un campo de tipo Lista, Opción Múltiple o Texto validando que exista en sus opciones
 */
function setSafeChoiceResponse(formResponse, item, value) {
  if (!value) return;
  var itemType = item.getType();
  var strVal = value.toString().trim();

  if (itemType === FormApp.ItemType.LIST) {
    var listItem = item.asListItem();
    var choices = listItem.getChoices();
    for (var c = 0; c < choices.length; c++) {
      if (choices[c].getValue().trim().toLowerCase() === strVal.toLowerCase()) {
        formResponse.withItemResponse(listItem.createResponse(choices[c].getValue()));
        return;
      }
    }
    // Si no coincide exactamente, usar el primer valor si existe
    if (choices.length > 0) {
      formResponse.withItemResponse(listItem.createResponse(choices[0].getValue()));
    }
  } else if (itemType === FormApp.ItemType.MULTIPLE_CHOICE) {
    var mcItem = item.asMultipleChoiceItem();
    var mcChoices = mcItem.getChoices();
    for (var m = 0; m < mcChoices.length; m++) {
      if (mcChoices[m].getValue().trim().toLowerCase() === strVal.toLowerCase()) {
        formResponse.withItemResponse(mcItem.createResponse(mcChoices[m].getValue()));
        return;
      }
    }
    if (mcChoices.length > 0) {
      formResponse.withItemResponse(mcItem.createResponse(mcChoices[0].getValue()));
    }
  } else if (itemType === FormApp.ItemType.TEXT) {
    formResponse.withItemResponse(item.asTextItem().createResponse(strVal));
  }
}

/**
 * Asigna respuestas a casillas de verificación validando que cada opción exista en las opciones del formulario
 */
function setSafeCheckboxResponse(formResponse, item, csvValues) {
  if (!csvValues) return;
  var itemType = item.getType();
  if (itemType !== FormApp.ItemType.CHECKBOX) return;

  var cbItem = item.asCheckboxItem();
  var choices = cbItem.getChoices();
  var requested = csvValues.split(",").map(function(s){ return s.trim().toLowerCase(); }).filter(function(s){ return s.length > 0; });
  
  var validResponses = [];
  for (var c = 0; c < choices.length; c++) {
    var chVal = choices[c].getValue();
    if (requested.indexOf(chVal.trim().toLowerCase()) !== -1) {
      validResponses.push(chVal);
    }
  }

  if (validResponses.length > 0) {
    formResponse.withItemResponse(cbItem.createResponse(validResponses));
  }
}

