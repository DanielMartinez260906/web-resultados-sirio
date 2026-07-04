/**
 * GOOGLE APPS SCRIPT - INGRESO DE PACIENTES SIRIO (PROYECTO INDEPENDIENTE)
 * 
 * Instrucciones:
 * 1. Cree una nueva hoja de cálculo en Google Drive.
 * 2. Vaya a "Extensiones" -> "Apps Script".
 * 3. Copie y pegue este código.
 * 4. Haga clic en "Implementar" -> "Nueva implementación".
 * 5. Seleccione tipo: "Aplicación web".
 * 6. Configuración:
 *    - Ejecutar como: "Yo" (tu cuenta de Google).
 *    - Quién tiene acceso: "Cualquiera".
 * 7. Copie la URL de la aplicación web y agréguela al archivo .env como GOOGLE_PACIENTES_SCRIPT_URL.
 */

function doGet(e) {
  return HtmlService.createHtmlOutput("Servicio de Ingreso de Pacientes SIRIO activo.");
}

function doPost(e) {
  var response = { success: false, message: "" };
  try {
    var postData = JSON.parse(e.postData.contents);
    var action   = postData.action;
    var data     = postData.data;
    var doc      = SpreadsheetApp.getActiveSpreadsheet();

    // Inicializar hojas si es necesario
    checkAndInitSheets(doc);

    if (action === "ingresarPaciente") {
      response = ingresarPaciente(doc, data);
    } else {
      response.message = "Acción no reconocida: " + action;
    }
  } catch (error) {
    response.success = false;
    response.message = "Error en el script: " + error.toString();
  }

  return ContentService.createTextOutput(JSON.stringify(response))
                       .setMimeType(ContentService.MimeType.JSON);
}

function checkAndInitSheets(doc) {
  var sheetName = "Pacientes_Ingresados";
  var headers = [
    "fecha_ingreso", "id_usuario", "veterinaria", "medico", "propietario", 
    "paciente_nombre", "especie", "raza", "edad", "sexo", "tipo_muestra", 
    "examenes_solicitados", "otros_examenes", "observaciones", 
    "direccion_recoleccion", "contacto_recoleccion", "quien_diligencia", 
    "datos_especiales_tipo", "datos_especiales_detalle"
  ];

  var sheet = doc.getSheetByName(sheetName);
  if (!sheet) {
    sheet = doc.insertSheet(sheetName);
    sheet.appendRow(headers);
    var rng = sheet.getRange(1, 1, 1, headers.length);
    rng.setFontWeight("bold");
    rng.setBackground("#005a9c");
    rng.setFontColor("#ffffff");
    SpreadsheetApp.flush();
  }
}

function ingresarPaciente(doc, data) {
  var sheet = doc.getSheetByName("Pacientes_Ingresados");
  if (!sheet) {
    return { success: false, message: "La hoja Pacientes_Ingresados no existe." };
  }

  var headers = sheet.getDataRange().getValues()[0];
  var colMap = {};
  for (var i = 0; i < headers.length; i++) {
    colMap[headers[i].toString().trim()] = i;
  }

  var timezone = Session.getScriptTimeZone();
  var today = Utilities.formatDate(new Date(), timezone, "yyyy-MM-dd'T'HH:mm:ssXXX");

  // Crear fila vacía del tamaño de cabeceras
  var newRow = new Array(headers.length).fill("");

  // Mapear datos a columnas según los nombres de cabecera
  if ("fecha_ingreso" in colMap)          newRow[colMap["fecha_ingreso"]] = today;
  if ("id_usuario" in colMap)             newRow[colMap["id_usuario"]] = data.id_usuario || "";
  if ("veterinaria" in colMap)            newRow[colMap["veterinaria"]] = data.veterinaria || "";
  if ("medico" in colMap)                 newRow[colMap["medico"]] = data.medico || "";
  if ("propietario" in colMap)            newRow[colMap["propietario"]] = data.propietario || "";
  if ("paciente_nombre" in colMap)        newRow[colMap["paciente_nombre"]] = data.paciente_nombre || "";
  if ("especie" in colMap)                newRow[colMap["especie"]] = data.especie || "";
  if ("raza" in colMap)                   newRow[colMap["raza"]] = data.raza || "";
  if ("edad" in colMap)                   newRow[colMap["edad"]] = data.edad || "";
  if ("sexo" in colMap)                   newRow[colMap["sexo"]] = data.sexo || "";
  if ("tipo_muestra" in colMap)           newRow[colMap["tipo_muestra"]] = data.tipo_muestra || "";
  if ("examenes_solicitados" in colMap)   newRow[colMap["examenes_solicitados"]] = data.examenes_solicitados || "";
  if ("otros_examenes" in colMap)         newRow[colMap["otros_examenes"]] = data.otros_examenes || "";
  if ("observaciones" in colMap)          newRow[colMap["observaciones"]] = data.observaciones || "";
  if ("direccion_recoleccion" in colMap)   newRow[colMap["direccion_recoleccion"]] = data.direccion_recoleccion || "";
  if ("contacto_recoleccion" in colMap)    newRow[colMap["contacto_recoleccion"]] = data.contacto_recoleccion || "";
  if ("quien_diligencia" in colMap)       newRow[colMap["quien_diligencia"]] = data.quien_diligencia || "";
  if ("datos_especiales_tipo" in colMap)  newRow[colMap["datos_especiales_tipo"]] = data.datos_especiales_tipo || "No";
  if ("datos_especiales_detalle" in colMap) newRow[colMap["datos_especiales_detalle"]] = data.datos_especiales_detalle || "";

  sheet.appendRow(newRow);
  return { success: true, message: "Paciente ingresado y recolección programada correctamente." };
}
