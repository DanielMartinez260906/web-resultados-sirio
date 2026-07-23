/**
 * CÓDIGO PARA GOOGLE APPS SCRIPT - LABORATORIO SIRIO
 * Versión con soporte de admin_nombre (quien envió cada resultado)
 *
 * INSTRUCCIONES DE INSTALACIÓN / ACTUALIZACIÓN:
 * 1. Abre tu Google Sheet.
 * 2. Ve a "Extensiones" > "Apps Script".
 * 3. Borra TODO el código existente (Ctrl+A, Delete).
 * 4. Pega este código completo.
 * 5. Guarda (Ctrl+S o ícono de disquete).
 * 6. Haz clic en "Implementar" > "Administrar implementaciones".
 * 7. Haz clic en el ícono de LÁPIZ (editar) de la implementación existente.
 * 8. En "Versión" selecciona "Nueva versión".
 * 9. Haz clic en "Implementar".
 * 10. Verifica abriendo en el navegador: TU_URL_DEL_SCRIPT
 *     Debe mostrar: {"status":"ok","version":"2.0","columnas":["id_resultado","id_usuario","nombre_examen","nombre_archivo","fecha_subida","admin_nombre"]}
 */

var API_KEY = "SIRIO_SECRET_API_KEY";

// ============================================================
// ENDPOINT DE PRUEBA (GET) - Verifica que el script está activo
// ============================================================
function doGet(e) {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  checkAndInitSheets(doc);
  migrateSheets(doc);

  var sheet = doc.getSheetByName("Resultados");
  var headers = [];
  if (sheet) {
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    version: "2.1",
    columnas: headers
  })).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// ENDPOINT PRINCIPAL (POST)
// ============================================================
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
    var data = requestData.data;
    var doc = SpreadsheetApp.getActiveSpreadsheet();

    // Asegurar estructura correcta en cada request
    checkAndInitSheets(doc);
    migrateSheets(doc);

    if (action === "login") { response = handleLogin(doc, data); }
    else if (action === "getClients") { response = getClients(doc); }
    else if (action === "addClient") { response = addClient(doc, data); }
    else if (action === "addAdmin") { response = addAdmin(doc, data); }
    else if (action === "updateClient") { response = updateClient(doc, data); }
    else if (action === "deleteClient") { response = deleteClient(doc, data); }
    else if (action === "addResult") { response = addResult(doc, data); }
    else if (action === "getClientResults") { response = getClientResults(doc, data); }
    else if (action === "deleteResult") { response = deleteResult(doc, data); }
    else if (action === "deleteResultsBulk") { response = deleteResultsBulk(doc, data); }
    else if (action === "deleteResultsRange") { response = deleteResultsRange(doc, data); }
    else if (action === "deleteAllResults") { response = deleteAllResults(doc); }
    else if (action === "getAllResults") { response = getAllResults(doc); }
    else if (action === "logAccess") { response = logAccess(doc, data); }
    else if (action === "getConfig") { response = getConfig(doc); }
    else if (action === "saveConfig") { response = saveConfig(doc, data); }
    else if (action === "getPortafolio") { response = getPortafolio(doc); }
    else if (action === "savePortafolioPrecios") { response = savePortafolioPrecios(doc, data); }
    else if (action === "addPortafolioExamen") { response = addPortafolioExamen(doc, data); }
    else if (action === "deletePortafolioExamen") { response = deletePortafolioExamen(doc, data); }
    else if (action === "releaseRetainedResults") { response = releaseRetainedResults(doc, data); }
    else if (action === "saveSubscription") { response = saveSubscription(doc, data); }
    else if (action === "deleteSubscription") { response = deleteSubscription(doc, data); }
    else if (action === "getSubscriptions") { response = getSubscriptions(doc, data); }
    else if (action === "getAdmins") { response = getAdmins(doc); }
    else if (action === "updateAdmin") { response = updateAdmin(doc, data); }
    else if (action === "deleteAdmin") { response = deleteAdmin(doc, data); }
    else { response.message = "Accion no reconocida: " + action; }

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

// ============================================================
// MIGRACIÓN: agrega columnas faltantes a hojas existentes
// ============================================================
function migrateSheets(doc) {
  // 1. Migración de Resultados
  var sheet = doc.getSheetByName("Resultados");
  if (sheet) {
    var lastCol = sheet.getLastColumn();
    if (lastCol > 0) {
      var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      var colMap = {};
      for (var i = 0; i < headers.length; i++) {
        colMap[headers[i].toString().trim().toLowerCase()] = i;
      }

      // Agregar columna admin_nombre si no existe
      if (!("admin_nombre" in colMap)) {
        var newCol = lastCol + 1;
        var cell = sheet.getRange(1, newCol);
        cell.setValue("admin_nombre");
        cell.setFontWeight("bold");
        cell.setBackground("#0a192f");
        cell.setFontColor("#ffffff");
        SpreadsheetApp.flush();
      }

      // Agregar columna admin_id si no existe
      if (!("admin_id" in colMap)) {
        var newColId = sheet.getLastColumn() + 1;
        var cellId = sheet.getRange(1, newColId);
        cellId.setValue("admin_id");
        cellId.setFontWeight("bold");
        cellId.setBackground("#0a192f");
        cellId.setFontColor("#ffffff");
        SpreadsheetApp.flush();
      }

      // Agregar columna retenido si no existe
      if (!("retenido" in colMap)) {
        var newCol2 = sheet.getLastColumn() + 1;
        var cell2 = sheet.getRange(1, newCol2);
        cell2.setValue("retenido");
        cell2.setFontWeight("bold");
        cell2.setBackground("#0a192f");
        cell2.setFontColor("#ffffff");
        SpreadsheetApp.flush();
      }
    }
  }

  // 2. Migración de Usuarios
  var userSheet = doc.getSheetByName("Usuarios");
  if (userSheet) {
    var uLastCol = userSheet.getLastColumn();
    if (uLastCol > 0) {
      var uHeaders = userSheet.getRange(1, 1, 1, uLastCol).getValues()[0];
      var uColMap = {};
      for (var i = 0; i < uHeaders.length; i++) {
        uColMap[uHeaders[i].toString().trim().toLowerCase()] = i;
      }

      var colsToAdd = ["rol", "direccion", "correo", "telefono", "moroso", "plan", "sirio_credits"];
      for (var j = 0; j < colsToAdd.length; j++) {
        var colName = colsToAdd[j];
        if (!(colName in uColMap)) {
          uLastCol = userSheet.getLastColumn();
          var newCol = uLastCol + 1;
          var cell = userSheet.getRange(1, newCol);
          cell.setValue(colName);
          cell.setFontWeight("bold");
          cell.setBackground("#0a192f");
          cell.setFontColor("#ffffff");
          SpreadsheetApp.flush();
        }
      }
    }
  }

  // 3. Migración de Estado_Portafolio
  var epSheet = doc.getSheetByName("Estado_Portafolio");
  if (epSheet) {
    var epRows = epSheet.getDataRange().getValues();
    var keysMap = {};
    for (var k = 1; k < epRows.length; k++) {
      if (epRows[k][0]) {
        keysMap[epRows[k][0].toString().trim()] = k;
      }
    }
    if (!("portafolio_visible" in keysMap)) {
      epSheet.appendRow(["portafolio_visible", "true"]);
      SpreadsheetApp.flush();
    }
    if (!("categorias_adicionales" in keysMap)) {
      epSheet.appendRow(["categorias_adicionales", ""]);
      SpreadsheetApp.flush();
    }
  }
}

// ============================================================
// INICIALIZAR HOJAS
// ============================================================
function checkAndInitSheets(doc) {
  var sheetsConfig = {
    "Usuarios": ["id_usuario", "nombre", "identificacion", "usuario", "contrasena", "rol", "fecha_registro", "direccion", "correo", "telefono", "moroso", "plan", "sirio_credits"],
    "Resultados": ["id_resultado", "id_usuario", "nombre_examen", "nombre_archivo", "fecha_subida", "admin_id", "admin_nombre", "retenido"],
    "Accesos": ["id_log", "usuario", "rol", "fecha_hora", "estado"],
    "Configuracion": ["clave", "valor"],
    "Estado_Portafolio": ["clave", "valor"],
    "Portafolio": ["id_examen", "seccion", "examen", "precio", "tiempo_reporte", "muestra", "recipiente"],
    "Push_Subscriptions": ["id_usuario", "endpoint", "p256dh", "auth"]
  };

  for (var name in sheetsConfig) {
    var sheet = doc.getSheetByName(name);
    if (!sheet) {
      sheet = doc.insertSheet(name);
      var hdr = sheetsConfig[name];
      sheet.appendRow(hdr);
      var rng = sheet.getRange(1, 1, 1, hdr.length);
      rng.setFontWeight("bold");
      rng.setBackground("#0a192f");
      rng.setFontColor("#ffffff");

      if (name === "Usuarios") {
        sheet.appendRow(["U000", "Administrador Laboratorio", "00000000", "admin", "admin123", "admin",
          new Date().toISOString().split('T')[0], "", "", "", "false", "Básico", 0]);
      }
      if (name === "Configuracion") {
        sheet.appendRow(["gemini_api_key", "CONFIGURAR_DESDE_PANEL_ADMIN"]);
      }
      if (name === "Estado_Portafolio") {
        sheet.appendRow(["portafolio_visible", "true"]);
        sheet.appendRow(["categorias_adicionales", ""]);
      }
      if (name === "Portafolio") {
        var defaultPortafolio = [
          ["E001", "MICROBIOLOGÍA", "Cultivo 1 Oído (Bacteriológico con antibiograma + Micológico)", 58000, "2-5 días", "Hisopado", "Hisopado en medio de transporte"],
          ["E002", "MICROBIOLOGÍA", "Cultivo 2 Oídos (Bacteriológico con antibiograma + Micológico)", 68000, "2-5 días", "Hisopado", "Hisopado en medio de transporte"],
          ["E003", "MICROBIOLOGÍA", "Urocultivo (Bacteriológico + antibiograma)", 58000, "2-5 días", "Orina", "Tubo tapa gris (Ácido Bórico)"],
          ["E004", "MICROBIOLOGÍA", "Coprocultivo (Bacteriológico + antibiograma)", 58000, "2-5 días", "Materia fecal", "Frasco tapa rosca estéril"],
          ["E005", "MICROBIOLOGÍA", "Cultivo de piel (Bacteriológico + antibiograma)", 58000, "2-5 días", "Pelos y/o escamas de piel", "Frasco estéril o placa de Petri"],
          ["E006", "MICROBIOLOGÍA", "Cultivo de secreciones (Bacteriológico + antibiograma)", 58000, "2-5 días", "Hisopado de secreción", "Hisopado en medio de transporte"],
          ["E007", "MICROBIOLOGÍA", "Cultivo de otras muestras (Bacteriológico + Antibiograma) (Aerotolerantes)", 58000, "2-5 días", "Según tipo de muestra", "Frasco estéril"],
          ["E008", "MICROBIOLOGÍA", "Hemocultivo + antibiograma", 110000, "3-10 días", "Sangre total", "Frasco para hemocultivos"],
          ["E009", "MICROBIOLOGÍA", "Antibiograma adicional", 40000, "1-2 días", "No aplica", "No aplica"],
          ["E010", "MICROBIOLOGÍA", "Cultivo micobacterias", 70000, "Indicaciones previas", "Según tipo de muestra", "Según tipo de muestra"],
          ["E011", "MICROBIOLOGÍA", "Cultivo bacteriológico + antibiograma MIC (Concentración Inhibitoria Mínima) Cualquier muestra", 95000, "2-5 días", "Según tipo de muestra", "Medio de transporte o Petri"],
          ["E012", "MICROBIOLOGÍA", "Cultivo anaerobios estrictos", 165000, "3-10 días", "Según tipo de muestra", "Según instrucción del laboratorio"],
          ["E013", "MICROBIOLOGÍA", "Cultivo bacteriológico + micológico* + antibiograma (cualquier muestra)", 68000, "2-6 días (micológico: 5-20 días)", "Según tipo de muestra", "Medio de transporte o Petri"],
          ["E014", "MICROBIOLOGÍA", "Cultivo micológico (Hongos) de cualquier muestra", 38000, "5-20 días", "Escamas, pelo o uñas", "Caja de Petri o frasco estéril"],
          ["E015", "HEMATOLOGÍA", "Hemograma automatizado (Extendido de sangre periférica, Proteínas plasmáticas, Reticulocitos)", 14000, "1 día", "300 ul Sangre total", "Tubo tapa lila (EDTA)"],
          ["E016", "COAGULACIÓN", "Tiempo de Protrombina TP (Coordinar hora de recolección)", 14500, "1 día", "a. 1 ml Sangre / b. 500 ul Plasma", "a. Tubo celeste (Citrato)"],
          ["E017", "COAGULACIÓN", "Tiempo Parcial de Tromboplastina TPT (Coordinar hora de recolección)", 14500, "1 día", "a. 1 ml Sangre / b. 500 ul Plasma", "a. Tubo celeste (Citrato)"],
          ["E018", "COAGULACIÓN", "Dímero D no específico", 90000, "1 día", "a. 1 ml Sangre / b. 500 ul Plasma", "a. Tubo celeste (Citrato)"],
          ["E019", "COAGULACIÓN", "Dímero D específico canino", 70000, "1 día", "a. 1 ml Sangre / b. 500 ul Plasma", "a. Tubo celeste (Citrato)"],
          ["E020", "COAGULACIÓN", "Fibrinógeno", 20000, "1 día", "a. 1 ml Sangre / b. 500 ul Plasma", "a. Tubo celeste (Citrato)"],
          ["E021", "QUÍMICA SANGUÍNEA", "Ácidos Biliares (Una muestra)", 85000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E022", "QUÍMICA SANGUÍNEA", "Ácidos Biliares Pre-Post", 160000, "1 día", "a. 1 ml Sangre / b. 1 ml Suero", "Tubo tapa roja o amarilla"],
          ["E023", "QUÍMICA SANGUÍNEA", "Ácido úrico", 15000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E024", "QUÍMICA SANGUÍNEA", "Albúmina", 10500, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E025", "QUÍMICA SANGUÍNEA", "Alanina aminotransferasa (ALT/GPT)", 10500, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E026", "QUÍMICA SANGUÍNEA", "Aspartato aminotransferasa (AST)", 10500, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E027", "QUÍMICA SANGUÍNEA", "Amilasa Pancreática", 30000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E028", "QUÍMICA SANGUÍNEA", "Bilirrubina directa", 10500, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E029", "QUÍMICA SANGUÍNEA", "Bilirrubina total", 10500, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E030", "QUÍMICA SANGUÍNEA", "BUN + Urea", 10500, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E031", "QUÍMICA SANGUÍNEA", "Calcio ionizado", 65000, "1 día", "1 ml Sangre total", "Tubo tapa verde (Heparina de litio)"],
          ["E032", "QUÍMICA SANGUÍNEA", "Calcio sérico", 16000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E033", "QUÍMICA SANGUÍNEA", "Cloro", 15000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E034", "QUÍMICA SANGUÍNEA", "Colesterol HDL", 17500, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E035", "QUÍMICA SANGUÍNEA", "Colesterol total", 10500, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E036", "QUÍMICA SANGUÍNEA", "Creatinina", 10500, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E037", "QUÍMICA SANGUÍNEA", "Creatina Quinasa MB (CK-MB)", 25000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E038", "QUÍMICA SANGUÍNEA", "Creatina Quinasa Total (CK o CPK total)", 21000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E039", "QUÍMICA SANGUÍNEA", "Dimetilarginina Simétrica (SDMA) + Creatinina", 155000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E040", "QUÍMICA SANGUÍNEA", "Fenobarbital", 54000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E041", "QUÍMICA SANGUÍNEA", "Ferritina", 40000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E042", "QUÍMICA SANGUÍNEA", "Fósforo", 14000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E043", "QUÍMICA SANGUÍNEA", "Fosfatasa alcalina (FA)", 10500, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E044", "QUÍMICA SANGUÍNEA", "Fructosamina", 50000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E045", "QUÍMICA SANGUÍNEA", "Gamma Glutamil Transferasa (GGT)", 10500, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E046", "QUÍMICA SANGUÍNEA", "Glucosa", 10500, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa gris (Fluoruro/Oxalato)"],
          ["E047", "QUÍMICA SANGUÍNEA", "Hemoglobina glicada (HBA1C)", 39000, "1 día", "1 ml Sangre total", "Tubo tapa lila (EDTA)"],
          ["E048", "QUÍMICA SANGUÍNEA", "Hierro", 25000, "1 día", "a. 1 ml Sangre / b. 1 ml Suero", "Tubo tapa roja o amarilla"],
          ["E049", "QUÍMICA SANGUÍNEA", "Lactato (Ácido láctico)", 64000, "1 día", "1 ml Sangre total", "Tubo tapa verde (Heparina de litio)"],
          ["E050", "QUÍMICA SANGUÍNEA", "Lactato Deshidrogenasa (LDH)", 28000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E051", "QUÍMICA SANGUÍNEA", "Lipasa pancreática específica canina", 65000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E052", "QUÍMICA SANGUÍNEA", "Lipasa pancreática específica felina", 65000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E053", "QUÍMICA SANGUÍNEA", "Magnesio", 20000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E054", "QUÍMICA SANGUÍNEA", "Potasio", 18000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E055", "QUÍMICA SANGUÍNEA", "Proteínas totales séricas", 10500, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E056", "QUÍMICA SANGUÍNEA", "Proteínas diferenciadas (Albúmina-Globulinas-P. Totales-Relación A/G)", 20000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E057", "QUÍMICA SANGUÍNEA", "Proteína C reactiva no específica (PCR cuantitativa)", 44000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E058", "QUÍMICA SANGUÍNEA", "Proteína C reactiva específica canina (PCR cuantitativa)", 56000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E059", "QUÍMICA SANGUÍNEA", "Sodio", 19000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E060", "QUÍMICA SANGUÍNEA", "Somatomedina C", 99000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E061", "QUÍMICA SANGUÍNEA", "Tripsina inmunorreactiva Canina", 125000, "1 día", "a. 1.5 ml Sangre / b. 1 ml Suero", "Tubo tapa roja o amarilla"],
          ["E062", "QUÍMICA SANGUÍNEA", "Triglicéridos", 10500, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E063", "QUÍMICA SANGUÍNEA", "Troponina I", 80000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E064", "VITAMINAS", "Ácido Fólico / Vitamina B9", 50000, "2-3 días", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E065", "VITAMINAS", "Vitamina B12 cianocobalamina", 58000, "2-3 días", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E066", "VITAMINAS", "Vitamina D 1,25 Dihidroxi (Calcitriol)", 285000, "2-3 días", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E067", "VITAMINAS", "Vitamina D25", 90000, "2-3 días", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E068", "UROANÁLISIS", "Análisis de cálculo urinario (Vesícula/Vejiga)", 95000, "1 día", "Cálculo renal", "Frasco tapa rosca estéril"],
          ["E069", "UROANÁLISIS", "Análisis de cálculo vesiculares", 115000, "1 día", "Cálculo vesicular", "Frasco tapa rosca estéril"],
          ["E070", "UROANÁLISIS", "Citoquímico de orina (Estudio fisicoquímico, microscópico + GRAM)", 11000, "1 día", "Orina", "Jeringa o frasco estéril"],
          ["E071", "UROANÁLISIS", "Cortisol en orina", 47000, "1 día", "Orina", "Jeringa o frasco estéril"],
          ["E072", "UROANÁLISIS", "Glucosa en orina (Cuantitativa)", 10500, "1 día", "Orina", "Jeringa o frasco estéril"],
          ["E073", "UROANÁLISIS", "Relación Proteína/Creatinina en orina (UPC)", 20000, "1 día", "Orina", "Jeringa o frasco estéril"],
          ["E074", "UROANÁLISIS", "Relación Cortisol/Creatinina en orina (UCCR)", 53000, "1 día", "Orina", "Jeringa o frasco estéril"],
          ["E075", "COPROLOGÍA", "Coprológico (Directo + Lugol + Flotación)", 12000, "1 día", "Materia fecal", "Frasco tapa rosca estéril"],
          ["E076", "COPROLOGÍA", "Coprológico seriado (3 muestras)", 30500, "1 día", "Materia fecal (3 muestras)", "Frasco tapa rosca estéril (Rotular #1, #2, #3)"],
          ["E077", "COPROLOGÍA", "Coprograma (Coprológico, azúcares, sangre oculta, pH, coloración Gram/Wright)", 25000, "1 día", "Materia fecal", "Frasco tapa rosca estéril"],
          ["E078", "COPROLOGÍA", "Coloración Ziehl-Neelsen / Kinyoun (Coccidias, Cryptosporidium, Micobacterias)", 20000, "1 día", "Materia fecal", "Frasco tapa rosca estéril"],
          ["E079", "COPROLOGÍA", "Análisis para diarrea persistente (Coprograma, Ziehl-Neelsen, Coprocultivo)", 70000, "2-5 días", "Materia fecal", "Frasco tapa rosca estéril"],
          ["E080", "COPROLOGÍA", "Detección semicuantitativa de grasa neutra y ácidos grasos en heces", 20000, "1 día", "Materia fecal", "Frasco tapa rosca estéril"],
          ["E081", "ANÁLISIS OTRAS MUESTRAS", "Análisis de líquidos corporales (Físico-químico, bioquímico, citológico, Gram/Wright)", 45000, "1-2 días", "1 ml Líquido (EDTA) + 3 ml Líquido", "Tubo lila (EDTA) + Tubo tapa roja / Jeringa"],
          ["E082", "ANÁLISIS OTRAS MUESTRAS", "Citología vaginal canina (Ciclo estral)", 25000, "1 día", "Extendido de secreción vaginal", "Placa portaobjetos (protegida)"],
          ["E083", "ANÁLISIS OTRAS MUESTRAS", "Coloración Wright (Diferenciación celular)", 15000, "1 día", "Frotis / Extendido", "Placa portaobjetos"],
          ["E084", "ANÁLISIS OTRAS MUESTRAS", "Coloración Ziehl-Neelsen", 15000, "1 día", "Frotis / Extendido", "Placa portaobjetos"],
          ["E085", "ANÁLISIS OTRAS MUESTRAS", "Coloración Kinyoun", 15000, "1 día", "Frotis / Extendido", "Placa portaobjetos"],
          ["E086", "ANÁLISIS OTRAS MUESTRAS", "Coloración GRAM (Infecciosa)", 15000, "1 día", "Frotis / Extendido", "Placa portaobjetos"],
          ["E087", "ANÁLISIS OTRAS MUESTRAS", "Examen directo (cualquier muestra)", 12000, "1 día", "Secreción / Raspado / Líquido", "Portaobjetos o frasco estéril"],
          ["E088", "ANÁLISIS OTRAS MUESTRAS", "Espermograma (Físico-químico, morfológico, citológico y microbiológico)", 40000, "1 día", "Líquido seminal (Coordinar hora)", "Frasco tapa rosca estéril"],
          ["E089", "ANÁLISIS OTRAS MUESTRAS", "Raspado de piel + Examen con luz de wood", 12000, "1 día", "Escamas de piel y pelos", "Caja de Petri o frasco estéril"],
          ["E090", "ANÁLISIS OTRAS MUESTRAS", "Tricograma + Examen con luz de wood", 18000, "1 día", "Pelos completos con folículo", "Caja de Petri o frasco estéril"],
          ["E091", "ANÁLISIS OTRAS MUESTRAS", "Raspado de piel + Tricograma + Examen con luz de wood", 23000, "1 día", "Escamas de piel y pelos completos", "Caja de Petri o frasco estéril"],
          ["E092", "PATOLOGÍA", "Biopsia (Histopatológico de 3 fragmentos de tejido por animal)", 135000, "3-5 días", "Fragmentos de tejido", "Frasco con formol al 10%"],
          ["E093", "PATOLOGÍA", "Biopsia (Análisis histopatológico de 1 fragmento adicional)", 40000, "3-5 días", "Fragmento adicional de tejido", "Frasco con formol al 10%"],
          ["E094", "PATOLOGÍA", "Citología tumoral/TVT/PAAF (Punción Aspirada por Aguja Fina)", 50000, "1-2 días", "Impronta de masa o secreción", "Placa portaobjetos (protegida)"],
          ["E095", "HORMONAS", "Hormona Adrenocorticótropica (ACTH)", 50000, "1-2 días", "a. 1 ml Sangre / b. 1 ml Suero", "Tubo tapa roja o amarilla"],
          ["E096", "HORMONAS", "Aldosterona (Paciente con ayuno 12h)", 55000, "1-2 días", "a. 1 ml Sangre / b. 1 ml Suero", "Tubo tapa roja o amarilla"],
          ["E097", "HORMONAS", "Cortisol en suero (Específico canino)", 59000, "1-2 días", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E098", "HORMONAS", "Cortisol en suero (No específico)", 46000, "1-2 días", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E099", "HORMONAS", "Cortisol en orina", 48000, "1-2 días", "1 ml Orina", "Frasco estéril o jeringa"],
          ["E100", "HORMONAS", "Cortisol en suero 3 muestras (No específico)", 115000, "1-2 días", "a. 1.5 ml Sangre / b. 1.5 ml Suero (Rotular #1, #2, #3)", "Tubo tapa roja o amarilla"],
          ["E101", "HORMONAS", "Cortisol en suero 3 muestras (Específico canino)", 147000, "1-2 días", "a. 1.5 ml Sangre / b. 1.5 ml Suero (Rotular #1, #2, #3)", "Tubo tapa roja o amarilla"],
          ["E102", "HORMONAS", "Estradiol", 47000, "1-2 días", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E103", "HORMONAS", "Hormona folículo estimulante (FSH)", 45000, "1-2 días", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E104", "HORMONAS", "Hormona de crecimiento (GH)", 51000, "1-2 días", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E105", "HORMONAS", "Hormona estimulante de tiroides TSH (Inespecífica para la especie)", 28000, "1-2 días", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E106", "HORMONAS", "Hormona estimulante de tiroides TSH (Específica canina)", 58000, "1-2 días", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja"],
          ["E107", "HORMONAS", "Hormona luteinizante (LH)", 45000, "1-2 días", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E108", "HORMONAS", "Insulina", 45000, "1-2 días", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E109", "HORMONAS", "Parathormona", 98000, "1-2 días", "a. 500 ul Sangre / b. 400 ul Plasma", "a. Tubo lila / b. Vial o jeringa"],
          ["E110", "HORMONAS", "Prolactina", 54000, "1-2 días", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E111", "HORMONAS", "Progesterona específica canina", 50000, "1-2 días", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E112", "HORMONAS", "Testosterona libre", 55000, "1-2 días", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E113", "HORMONAS", "Testosterona total", 50000, "1-2 días", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E114", "HORMONAS", "Tiroxina total T4T (Específico canino o felino)", 56000, "1-2 días", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja"],
          ["E115", "HORMONAS", "Tiroxina total T4T (Inespecífica para la especie)", 24000, "1-2 días", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E116", "HORMONAS", "Tiroxina libre T4L", 23000, "1-2 días", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E117", "HORMONAS", "Triyodotironina total T3T", 27000, "1-2 días", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E118", "OTROS SERVICIOS", "Suero autólogo", 11000, "1 día", "1-5 ml Sangre total", "Tubo tapa roja o amarilla"],
          ["E119", "OTROS SERVICIOS", "Plasma rico en plaquetas (PRP)", 25000, "1 día", "1-5 ml Sangre total", "Tubo tapa azul"],
          ["E120", "BIOLOGÍA MOLECULAR", "PCR Hemoparásitos Felino - Tiempo Real (Anaplasma spp, Rickettsia spp, Ehrlichia spp, Mycoplasma spp, Hepatozoon spp, Toxoplasma gondii y Bartonella spp)", 170000, "2-4 días", "1 ml Sangre Total (o Médula ósea, ganglios)", "Tubo tapa lila (EDTA)"],
          ["E121", "BIOLOGÍA MOLECULAR", "PCR Hemoparásitos Canino - Tiempo Real (Anaplasma spp, Ehrlichia spp, Mycoplasma spp, Hepatozoon spp, Babesia spp, Toxoplasma gondii y Dirofilaria spp)", 170000, "2-4 días", "1 ml Sangre Total (o Médula ósea, ganglios)", "Tubo tapa lila (EDTA)"],
          ["E122", "BIOLOGÍA MOLECULAR", "PCR Hemoparásitos Felino - Punto Final Positivo/Negativo (Anaplasma spp, Cytauxzoon felis, Mycoplasma sp, Babesia sp)", 140000, "2-4 días", "1 ml Sangre Total", "Tubo tapa lila (EDTA)"],
          ["E123", "BIOLOGÍA MOLECULAR", "PCR Hemoparásitos Canino - Punto Final Positivo/Negativo (Anaplasma spp, Ehrlichia spp, Hepatozoon spp, Babesia sp)", 140000, "2-4 días", "1 ml Sangre Total", "Tubo tapa lila (EDTA)"],
          ["E124", "INMUNOLOGÍA", "Distemper Canino", 35000, "1 día", "Sangre total / Hisopado / Orina", "Tubo lila, roja o Frasco estéril"],
          ["E125", "INMUNOLOGÍA", "Parvovirus Canino", 35000, "1 día", "Materia fecal / Hisopado rectal", "Frasco tapa rosca estéril"],
          ["E126", "INMUNOLOGÍA", "Parvovirus + Coronavirus Canino", 45000, "1 día", "Materia fecal / Hisopado rectal", "Frasco tapa rosca estéril"],
          ["E127", "INMUNOLOGÍA", "Parvovirus + Coronavirus + Giardia Canino", 50000, "1 día", "Materia fecal / Hisopado rectal", "Frasco tapa rosca estéril"],
          ["E128", "INMUNOLOGÍA", "Brucella canis", 45000, "1 día", "Sangre total / Suero", "Tubo roja, amarilla o lila"],
          ["E129", "INMUNOLOGÍA", "Virus de Inmunodeficiencia Felina / Leucemia / Dirofilaria IDEXX Felino", 115000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "a. Tubo roja o lila / b. Vial o jeringa"],
          ["E130", "INMUNOLOGÍA", "Virus de Inmunodeficiencia Felina + Virus de la Leucemia (VIF + VLEU) Felino", 44000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "a. Tubo roja o lila / b. Vial o jeringa"],
          ["E131", "INMUNOLOGÍA", "Triple viral felina IgG (Panleucopenia, Calicivirus, Herpesvirus) (Vaccicheck)", 120000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "a. Tubo roja o lila / b. Vial o jeringa"],
          ["E132", "INMUNOLOGÍA", "SNAP 4DX IDEXX (Dirofilaria, Enfermedad de Lyme, Ehrlichia, Anaplasma)", 110000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "a. Tubo roja o lila / b. Vial o jeringa"],
          ["E133", "INMUNOLOGÍA", "Coronavirus felino + Índice A/G + Prueba de Rivalta (Peritonitis Infecciosa Felina)", 125000, "1 día", "Sangre total + Líquido abdominal", "Tubo roja o amarilla + Tubo tapa roja o jeringa"],
          ["E134", "INMUNOLOGÍA", "Prueba de Coombs específica canina (Prueba de antiglobulina directa)", 155000, "1 día", "Sangre total", "Tubo tapa lila (EDTA)"],
          ["E135", "INMUNOLOGÍA", "Pruebas cruzadas de compatibilidad (mayor y menor)", 50000, "1 día", "1 ml Sangre donante + 1 ml Sangre receptor", "Tubo lila (EDTA) Donante + Receptor"],
          ["E136", "INMUNOLOGÍA", "Toxoplasma IgG", 40000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E137", "INMUNOLOGÍA", "Toxoplasma IgM", 40000, "1 día", "a. 500 ul Sangre / b. 500 ul Suero", "Tubo tapa roja o amarilla"],
          ["E138", "INMUNOLOGÍA", "Leptospira canino Ac IgG (4 serovares: Canicola, Icterohaemorrhagiae, Pomona, Grippotyphosa)", 130000, "1 día", "500 ul Sangre total", "Tubo tapa lila (EDTA), tapa roja o azul"],
          ["E139", "INMUNOLOGÍA", "Anticuerpos Tiroglobulina (TgAb)", 43000, "1 día", "a. 1 ml Sangre / b. 1 ml Suero", "a. Tubo tapa roja / b. Vial o jeringa"],
          ["E140", "INMUNOLOGÍA", "Títulos de rabia (Fluorescent Antibody Virus Neutralization - FAVN Test)", 740000, "Según indicaciones", "a. 2 ml Sangre / b. 1.5 ml Suero libre hemólisis", "a. Tubo tapa amarilla/roja / b. Vial o jeringa"],
          ["E141", "TOXICOLOGÍA", "Antidepresivos tricíclicos - TCA (Tamizaje cualitativo)", 25000, "1 día", "Orina", "Frasco tapa rosca estéril"],
          ["E142", "TOXICOLOGÍA", "Anfetamina - AMP (Tamizaje cualitativo)", 25000, "1 día", "Orina", "Frasco tapa rosca estéril"],
          ["E143", "TOXICOLOGÍA", "Barbitúricos - BAR (Tamizaje cualitativo)", 25000, "1 día", "Orina", "Frasco tapa rosca estéril"],
          ["E144", "TOXICOLOGÍA", "Benzodiazepinas - BZO (Tamizaje cualitativo)", 25000, "1 día", "Orina", "Frasco tapa rosca estéril"],
          ["E145", "TOXICOLOGÍA", "Cocaína - COC (Tamizaje cualitativo)", 25000, "1 día", "Orina", "Frasco tapa rosca estéril"],
          ["E146", "TOXICOLOGÍA", "Feniciclidina - PCP (Tamizaje cualitativo)", 25000, "1 día", "Orina", "Frasco tapa rosca estéril"],
          ["E147", "TOXICOLOGÍA", "Marihuana - THC (Tamizaje cualitativo)", 25000, "1 día", "Orina", "Frasco tapa rosca estéril"],
          ["E148", "TOXICOLOGÍA", "Metadona - MTD (Tamizaje cualitativo)", 25000, "1 día", "Orina", "Frasco tapa rosca estéril"],
          ["E149", "TOXICOLOGÍA", "Metanfetamina - MET (Tamizaje cualitativo)", 25000, "1 día", "Orina", "Frasco tapa rosca estéril"],
          ["E150", "TOXICOLOGÍA", "Metilendioximetanfetamina - MDMA (Tamizaje cualitativo)", 25000, "1 día", "Orina", "Frasco tapa rosca estéril"],
          ["E151", "TOXICOLOGÍA", "Morfina - MOP (Tamizaje cualitativo)", 25000, "1 día", "Orina", "Frasco tapa rosca estéril"],
          ["E152", "TOXICOLOGÍA", "Opiato - OPI (Tamizaje cualitativo)", 25000, "1 día", "Orina", "Frasco tapa rosca estéril"],
          ["E153", "TOXICOLOGÍA", "Combinación de 2 pruebas (Toxicología)", 35000, "1 día", "Orina", "Frasco tapa rosca estéril"],
          ["E154", "TOXICOLOGÍA", "Combinación de 3 pruebas (Toxicología)", 40000, "1 día", "Orina", "Frasco tapa rosca estéril"],
          ["E155", "TOXICOLOGÍA", "Combinación de 5 pruebas (Toxicología)", 45000, "1 día", "Orina", "Frasco tapa rosca estéril"],
          ["E156", "TOXICOLOGÍA", "Tamizaje Completo 12 Drogas (COC-AMP-THC-MTD-MET-MOP-OPI-MDMA-PCP-BAR-BZO-TCA)", 80000, "1 día", "Orina", "Frasco tapa rosca estéril"],
          ["E157", "TOXICOLOGÍA", "Tamizaje de intoxicación por warfarínicos (Raticidas)", 20000, "1 día", "Sangre (Coordinar)", "Tubo tapa celeste, por 3 días consecutivos"],
          ["E158", "PERFILES", "Perfil Prequirúrgico 1 (Hemograma, ALT, Creatinina)", 25000, "1 día", "500 ul Sangre EDTA + 500 ul Sangre total", "Tubo lila (EDTA) + Tubo tapa roja o amarilla"],
          ["E159", "PERFILES", "Perfil Prequirúrgico 2 (Hemograma, ALT, Creatinina, TP, TPT)", 40000, "1 día", "500 ul Sangre EDTA + 500 ul Sangre total + 500 ul Sangre total", "Tubo lila (EDTA) + Tubo tapa roja + Tubo tapa azul"],
          ["E160", "PERFILES", "TP-TPT (Coordinar hora de recolección)", 20000, "1 día", "a. 500 ul Sangre / b. 500 ul Plasma", "a. Tubo celeste (Citrato)"],
          ["E161", "PERFILES", "Diagnóstico Primario 1 (Hemograma, ALT, Creatinina y Citoquímico o Coprológico o Raspado de piel)", 35000, "1 día", "Sangre total + Orina / Materia fecal / Escamas de piel", "Tubo lila + Tubo roja + Frasco estéril"],
          ["E162", "PERFILES", "Diagnóstico Primario 2 (Hemograma, ALT, Creatinina y 2 exámenes (Coprológico + Raspado o Coprológico + Citoquímico o Raspado + Citoquímico))", 43000, "1 día", "Sangre total + 2 muestras biológicas", "Tubo lila + Tubo roja + Recipientes correspondientes"],
          ["E163", "PERFILES", "Diagnóstico Primario 3 (Hemograma + ALT + FA + Creatinina + Urea + BUN)", 39000, "1 día", "500 ul Sangre EDTA + 1 ml Sangre total", "Tubo lila (EDTA) + Tubo tapa roja o amarilla"],
          ["E164", "PERFILES", "Perfil Convulsivo (Hemograma, ALT, Albúmina, AST, Bil. T+D, BUN/Urea, Creatinina, FA, GGT, P. Diferenciadas, Glucosa)", 98000, "1 día", "a. 500 ul Sangre EDTA + 1 ml Sangre + 500 ul Sangre / b. 500 ul EDTA + 800 ul Suero", "a. Tubo lila + Tubo roja + Tubo gris / b. Tubo lila + Vial"],
          ["E165", "PERFILES", "Perfil Dermatológico 1 (Raspado de piel + Luz de wood + Cultivo bacteriológico + Cultivo micológico)", 78000, "2-6 días", "Pelos, escamas de piel e hisopado de piel", "Frasco estéril + Hisopado en medio de transporte"],
          ["E166", "PERFILES", "Perfil Dermatológico 2 (Hemograma, Raspado, Cultivo bact/micol, T4 Libre, Colesterol total)", 95000, "2-6 días", "500 ul Sangre EDTA + 500 ul Sangre + Pelos/Escamas/Hisopado", "Tubo lila + Tubo roja + Frasco estéril + Medio de transporte"],
          ["E167", "PERFILES", "Perfil Diabético 1 (Glucosa en sangre + Glucosa en orina cuantitativa)", 17000, "1 día", "500 ul Sangre + 3 ml Orina", "Tubo gris + Frasco estéril"],
          ["E168", "PERFILES", "Perfil Diabético 2 (Glucosa en sangre + Glucosa en orina cuantitativa + Citoquímico de orina)", 27000, "1 día", "500 ul Sangre + 3 ml Orina", "Tubo gris + Frasco estéril"],
          ["E169", "PERFILES", "Perfil Diabético 3 (Citoquímico de orina, Glucosa en sangre, Hemoglobina glicada HBA1C)", 55000, "1 día", "500 ul Sangre EDTA + 500 ul Sangre + 3 ml Orina", "Tubo lila + Tubo gris + Frasco estéril"],
          ["E170", "PERFILES", "Perfil Diabético 4 (Citoquímico de orina, Glucosa en sangre, Fructosamina, Hemoglobina glicada HBA1C)", 90000, "1 día", "500 ul Sangre EDTA + 1 ml Sangre + 3 ml Orina", "Tubo lila + Tubo roja/amarilla + Frasco estéril"],
          ["E171", "PERFILES", "Perfil Diabético 5 (Citoquímico de orina, Fructosamina, Insulina)", 90000, "1 día", "1 ml Sangre + 3 ml Orina", "Tubo roja/amarilla + Frasco estéril"],
          ["E172", "PERFILES", "Perfil Diabético 6 (Citoquímico, Glucosa en orina cuantitativa, Glucosa en sangre, Fructosamina, HBA1C)", 99000, "1 día", "500 ul Sangre EDTA + 1 ml Sangre + 3 ml Orina", "Tubo lila + Tubo gris + Frasco estéril"],
          ["E173", "PERFILES", "Perfil Gastrointestinal 1 (Coprológico + Parvovirus)", 48000, "1 día", "Materia fecal", "Frasco tapa rosca estéril"],
          ["E174", "PERFILES", "Perfil Gastrointestinal 2 (Coprológico + Parvovirus + Coronavirus canino)", 55000, "1 día", "Materia fecal", "Frasco tapa rosca estéril"],
          ["E175", "PERFILES", "Perfil Gastrointestinal 3 (Coprograma + Parvovirus + Coronavirus canino)", 65000, "1 día", "Materia fecal", "Frasco tapa rosca estéril"],
          ["E176", "PERFILES", "Perfil Gastrointestinal 4 (Hemograma + Coprograma + Parvovirus + Coronavirus canino)", 70000, "1 día", "300 ul Sangre total + Materia fecal", "Tubo lila + Frasco estéril"],
          ["E177", "PERFILES", "Perfil Gastrointestinal 5 (Análisis diarrea persistente: Hemograma, Coprograma, Ziehl-Neelsen, Coprocultivo, Parvo, Corona)", 100000, "2-5 días", "300 ul Sangre total + Materia fecal", "Tubo lila + Frasco estéril"],
          ["E178", "PERFILES", "Ionograma 1 (Sodio, Cloro, Potasio)", 50000, "1 día", "500 ul Sangre total", "Tubo tapa amarilla (activador de coágulo)"],
          ["E179", "PERFILES", "Ionograma 2 (Sodio, Cloro, Potasio, Calcio ionizado, pH)", 63000, "1 día", "500 ul Sangre total", "Tubo tapa verde (Heparina de litio)"],
          ["E180", "PERFILES", "Ionograma 3 (Sodio, Cloro, Potasio, pH, Calcio ionizado, Calcio sérico, Lactato, Creatinina)", 68000, "1 día", "500 ul Sangre total", "Tubo tapa verde (Heparina de litio)"],
          ["E181", "PERFILES", "Ionograma 4 (Sodio, Cloro, Potasio, Fósforo, pH, Calcio sérico, Calcio ionizado, Lactato, Hematocrito, Hemoglobina, Creatinina)", 75000, "1 día", "500 ul Sangre + 500 ul Sangre", "Tubo tapa verde + Tubo tapa amarilla"],
          ["E182", "PERFILES", "Perfil Geriátrico 1 (Hemograma, ALT, AST, FA, Colesterol, Creatinina, Glucosa, Urea, BUN, T4L, Citoquímico)", 90000, "1 día", "500 ul Sangre EDTA + 1 ml Sangre + 500 ul Sangre + 3 ml Orina", "Tubo lila + Tubo roja + Tubo gris + Frasco estéril"],
          ["E183", "PERFILES", "Perfil Geriátrico 2 (Hemograma, ALT, AST, FA, Colesterol, Creatinina, Glucosa, Urea, BUN, T4L, T4T específica, Citoquímico)", 110000, "1 día", "500 ul Sangre EDTA + 1 ml Sangre + 500 ul Sangre + 3 ml Orina", "Tubo lila + Tubo roja + Tubo gris + Frasco estéril"],
          ["E184", "PERFILES", "Perfil Hepático 1 (ALT + AST + FA + BIL T + BIL D + GGT)", 38000, "1 día", "a. 1 ml Sangre / b. 700 ul Suero", "a. Tubo tapa roja / b. Vial (Proteger de luz)"],
          ["E185", "PERFILES", "Perfil Hepático 3 (ALT + AST + FA + BIL T + BIL D + Proteínas diferenciadas + GGT)", 50000, "1 día", "a. 1 ml Sangre / b. 700 ul Suero", "a. Tubo tapa roja / b. Vial (Proteger de luz)"],
          ["E186", "PERFILES", "Perfil Hepático 4 (ALT + AST + FA + BIL T + BIL D + P. diferenciadas + GGT + Bun + Urea)", 60000, "1 día", "a. 1 ml Sangre / b. 700 ul Suero", "a. Tubo tapa roja / b. Vial (Proteger de luz)"],
          ["E187", "PERFILES", "Perfil Lipídico (Colesterol total, Triglicéridos, HDL, LDL, VLDL)", 36000, "1 día", "1 ml Sangre total", "Tubo tapa roja o amarilla"],
          ["E188", "PERFILES", "Perfil Pancreático 1 (Lipasa pancreática específica + Grasa neutra / ácidos grasos en heces)", 75000, "1 día", "1 ml Sangre + Materia fecal", "Tubo roja o amarilla + Frasco estéril"],
          ["E189", "PERFILES", "Perfil Pancreático 2 (Amilasa + Glucosa + Lipasa pancreática específica)", 85000, "1 día", "1 ml Sangre + 500 ul Sangre", "Tubo roja o amarilla + Tubo gris"],
          ["E190", "PERFILES", "Perfil Pancreático 3 (Amilasa + Glucosa + Lipasa espec. + Grasa neutra / ácidos grasos en heces)", 100000, "1 día", "1 ml Sangre + 500 ul Sangre + Materia fecal", "Tubo roja + Tubo gris + Frasco estéril"],
          ["E191", "PERFILES", "Perfil Renal 1 (Hemograma + BUN + Urea + Creatinina)", 28000, "1 día", "500 ul Sangre EDTA + 1 ml Sangre total", "Tubo lila (EDTA) + Tubo tapa roja o amarilla"],
          ["E192", "PERFILES", "Perfil Renal 2 (Hemograma + BUN + Urea + Creatinina + Fósforo)", 45000, "1 día", "500 ul Sangre EDTA + 1 ml Sangre + 500 ul Sangre", "Tubo lila + Tubo roja + Recipientes"],
          ["E193", "PERFILES", "Perfil Renal 3 (Hemograma + BUN + Urea + Creatinina + Fósforo + Citoquímico UPC Semicuantitativa)", 50000, "1 día", "500 ul Sangre EDTA + 1 ml Sangre + 3 ml Orina", "Tubo lila + Tubo roja + Frasco estéril"],
          ["E194", "PERFILES", "Perfil Renal 4 (Hemograma + Creatinina + SDMA)", 160000, "1 día", "500 ul Sangre EDTA + 1 ml Sangre total", "Tubo lila (EDTA) + Tubo tapa roja o amarilla"],
          ["E195", "PERFILES", "Perfil Renal 5 (Hemograma + Creatinina + SDMA + Urea + BUN + Citoquímico UPC Semicuantitativa)", 165000, "1 día", "500 ul Sangre EDTA + 1 ml Sangre + 3 ml Orina", "Tubo lila + Tubo roja + Frasco estéril"],
          ["E196", "PERFILES", "Perfil Renal 6 (Citoquímico + BUN + Urea + Creatinina)", 25000, "1 día", "500 ul Sangre total + 3 ml Orina", "Tubo roja o amarilla + Frasco estéril"],
          ["E197", "PERFILES", "Perfil Renal 7 (Citoquímico de orina + Índice UPC Cuantitativa)", 27000, "1 día", "3 ml Orina", "Frasco estéril o jeringa"],
          ["E198", "PERFILES", "Perfil Renal 8 (Citoquímico de orina + BUN + Urea + Creatinina + Fósforo + Índice UPC Cuantitativa)", 60000, "1 día", "1 ml Sangre + 3 ml Orina", "Tubo roja o amarilla + Frasco estéril"],
          ["E199", "PERFILES", "Perfil Tiroideo 1 (T4L + Colesterol)", 28000, "1-2 días", "500 ul Sangre total", "Tubo tapa roja o amarilla"],
          ["E200", "PERFILES", "Perfil Tiroideo 2 (T4L + Colesterol + Triglicéridos)", 35000, "1-2 días", "500 ul Sangre total", "Tubo tapa roja o amarilla"],
          ["E201", "PERFILES", "Perfil Tiroideo 3 (T4L + T4T no específica + Colesterol + Triglicéridos)", 56000, "1-2 días", "500 ul Sangre total", "Tubo tapa roja o amarilla"],
          ["E202", "PERFILES", "Perfil Tiroideo 4 (T4L + T4T no específica + TSH no específica)", 67000, "1-2 días", "500 ul Sangre total", "Tubo tapa roja o amarilla"],
          ["E203", "PERFILES", "Perfil Tiroideo 5 (T4L + T4T no específica + TSH no específica + Colesterol + Triglicéridos)", 84000, "1-2 días", "500 ul Sangre total", "Tubo tapa roja o amarilla"],
          ["E204", "PERFILES", "Perfil Tiroideo 6 (T4L + T4T específica + TSH específica canina)", 124000, "1-2 días", "1.5 ml Sangre total", "Tubo tapa roja o amarilla"],
          ["E205", "PERFILES", "Perfil Tiroideo 7 (T4L + T4T específica + TSH específica + Colesterol + Triglicéridos)", 130000, "1-2 días", "1.5 ml Sangre total", "Tubo tapa roja o amarilla"]
        ];
        for (var i = 0; i < defaultPortafolio.length; i++) {
          sheet.appendRow(defaultPortafolio[i]);
        }
      }
    }
  }
}

// ============================================================
// HELPER: construir colMap en minúsculas
// ============================================================
function buildColMap(headers) {
  var m = {};
  for (var i = 0; i < headers.length; i++) {
    m[headers[i].toString().trim().toLowerCase()] = i;
  }
  return m;
}

// ============================================================
// HELPER: convertir celda de fecha a ISO string
// ============================================================
function cellToISOString(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ssXXX");
  }
  return val.toString().trim();
}

// ============================================================
// LOGIN
// ============================================================
function handleLogin(doc, data) {
  var sheet = doc.getSheetByName("Usuarios");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colMap = buildColMap(headers);
  var uname = data.username.trim().toLowerCase();
  var pass = data.password;

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (r[colMap["usuario"]].toString().trim().toLowerCase() === uname && r[colMap["contrasena"]].toString() === pass) {
      return {
        success: true,
        user: {
          id_usuario: r[colMap["id_usuario"]],
          nombre: r[colMap["nombre"]],
          identificacion: r[colMap["identificacion"]],
          usuario: r[colMap["usuario"]],
          rol: r[colMap["rol"]],
          contrasena: r[colMap["contrasena"]],
          direccion: colMap["direccion"] !== undefined ? r[colMap["direccion"]] : "",
          correo: colMap["correo"] !== undefined ? r[colMap["correo"]] : "",
          telefono: colMap["telefono"] !== undefined ? r[colMap["telefono"]] : "",
          moroso: colMap["moroso"] !== undefined ? (r[colMap["moroso"]].toString().trim() === "true") : false,
          plan: colMap["plan"] !== undefined ? r[colMap["plan"]] : "Básico",
          sirio_credits: colMap["sirio_credits"] !== undefined ? Number(r[colMap["sirio_credits"]] || 0) : 0
        }
      };
    }
  }
  return { success: false, message: "Usuario o contrasena incorrectos." };
}

// ============================================================
// OBTENER CLIENTES
// ============================================================
function getClients(doc) {
  var sheet = doc.getSheetByName("Usuarios");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colMap = buildColMap(headers);
  var list = [];
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][colMap["rol"]] === "cliente") {
      list.push({
        id_usuario: rows[i][colMap["id_usuario"]],
        nombre: rows[i][colMap["nombre"]],
        identificacion: rows[i][colMap["identificacion"]],
        usuario: rows[i][colMap["usuario"]],
        contrasena: rows[i][colMap["contrasena"]],
        direccion: colMap["direccion"] !== undefined ? rows[i][colMap["direccion"]] : "",
        correo: colMap["correo"] !== undefined ? rows[i][colMap["correo"]] : "",
        telefono: colMap["telefono"] !== undefined ? rows[i][colMap["telefono"]] : "",
        fecha_registro: rows[i][colMap["fecha_registro"]],
        moroso: colMap["moroso"] !== undefined ? (rows[i][colMap["moroso"]].toString().trim() === "true") : false,
        plan: colMap["plan"] !== undefined ? rows[i][colMap["plan"]] : "Básico",
        sirio_credits: colMap["sirio_credits"] !== undefined ? Number(rows[i][colMap["sirio_credits"]] || 0) : 0
      });
    }
  }
  return { success: true, clients: list };
}

// ============================================================
// CREAR CLIENTE
// ============================================================
function addClient(doc, data) {
  var sheet = doc.getSheetByName("Usuarios");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colMap = buildColMap(headers);
  var uname = data.usuario.trim().toLowerCase();
  var ident = data.identificacion.toString().trim();

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][colMap["usuario"]].toString().toLowerCase() === uname)
      return { success: false, message: "El nombre de usuario ya existe." };
    if (rows[i][colMap["identificacion"]].toString() === ident)
      return { success: false, message: "Un cliente con esta identificacion ya esta registrado." };
  }

  var lastNum = 0;
  for (var i = 1; i < rows.length; i++) {
    var id = rows[i][colMap["id_usuario"]].toString();
    if (id.startsWith("U")) {
      var n = parseInt(id.substring(1));
      if (!isNaN(n) && n > lastNum) lastNum = n;
    }
  }
  var nextId = "U" + String(lastNum + 1).padStart(3, '0');

  // Crear fila ordenada por columnas
  var rowData = new Array(headers.length);
  rowData[colMap["id_usuario"]] = nextId;
  rowData[colMap["nombre"]] = data.nombre;
  rowData[colMap["identificacion"]] = ident;
  rowData[colMap["usuario"]] = uname;
  rowData[colMap["contrasena"]] = data.contrasena;
  rowData[colMap["rol"]] = "cliente";
  rowData[colMap["fecha_registro"]] = new Date().toISOString().split('T')[0];
  if (colMap["direccion"] !== undefined) rowData[colMap["direccion"]] = data.direccion || "";
  if (colMap["correo"] !== undefined) rowData[colMap["correo"]] = data.correo || "";
  if (colMap["telefono"] !== undefined) rowData[colMap["telefono"]] = data.telefono || "";
  if (colMap["moroso"] !== undefined) rowData[colMap["moroso"]] = "false";
  if (colMap["plan"] !== undefined) rowData[colMap["plan"]] = data.plan || "Básico";
  if (colMap["sirio_credits"] !== undefined) rowData[colMap["sirio_credits"]] = Number(data.sirio_credits || 0);

  sheet.appendRow(rowData);
  return { success: true, message: "Cliente registrado.", client: { id_usuario: nextId, nombre: data.nombre } };
}

// ============================================================
// REGISTRAR ADMINISTRADOR
// ============================================================
function addAdmin(doc, data) {
  var sheet = doc.getSheetByName("Usuarios");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colMap = buildColMap(headers);
  var uname = data.usuario.trim().toLowerCase();

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][colMap["usuario"]].toString().toLowerCase() === uname)
      return { success: false, message: "El nombre de usuario ya existe." };
  }

  var lastNum = 0;
  for (var i = 1; i < rows.length; i++) {
    var id = rows[i][colMap["id_usuario"]].toString();
    if (id.startsWith("U")) {
      var n = parseInt(id.substring(1));
      if (!isNaN(n) && n > lastNum) lastNum = n;
    }
  }
  var nextId = "U" + String(lastNum + 1).padStart(3, '0');

  // Crear fila con campos mínimos (admins no tienen direccion/correo/telefono)
  var rowData = new Array(headers.length).fill("");
  rowData[colMap["id_usuario"]] = nextId;
  rowData[colMap["nombre"]] = data.nombre;
  rowData[colMap["identificacion"]] = data.identificacion || "00000000";
  rowData[colMap["usuario"]] = uname;
  rowData[colMap["contrasena"]] = data.contrasena;
  rowData[colMap["rol"]] = "admin";
  rowData[colMap["fecha_registro"]] = new Date().toISOString().split('T')[0];

  sheet.appendRow(rowData);
  return { success: true, message: "Administrador registrado.", user: { id_usuario: nextId, nombre: data.nombre, rol: "admin" } };
}

// ============================================================
// PUBLICAR RESULTADOS (con admin_nombre)
// ============================================================
function addResult(doc, data) {
  var sheet = doc.getSheetByName("Resultados");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colMap = buildColMap(headers);

  var items = Array.isArray(data) ? data : [data];

  var lastNum = 0;
  var idxIdRes = (colMap["id_resultado"] !== undefined) ? colMap["id_resultado"] : 0;
  for (var i = 1; i < rows.length; i++) {
    var cid = rows[i][idxIdRes].toString();
    if (cid.startsWith("R")) {
      var n = parseInt(cid.substring(1));
      if (!isNaN(n) && n > lastNum) lastNum = n;
    }
  }

  var timezone = Session.getScriptTimeZone();
  var today = Utilities.formatDate(new Date(), timezone, "yyyy-MM-dd'T'HH:mm:ssXXX");
  var ids = [];

  for (var k = 0; k < items.length; k++) {
    var item = items[k];
    lastNum++;
    var nextId = "R" + String(lastNum).padStart(3, '0');

    // Fila vacía del tamaño exacto de cabeceras
    var newRow = new Array(headers.length).fill("");

    if ("id_resultado" in colMap) newRow[colMap["id_resultado"]] = nextId;
    if ("id_usuario" in colMap) newRow[colMap["id_usuario"]] = item.id_usuario || "";
    if ("nombre_examen" in colMap) newRow[colMap["nombre_examen"]] = item.nombre_examen || "";
    if ("nombre_archivo" in colMap) newRow[colMap["nombre_archivo"]] = item.nombre_archivo || "";
    if ("fecha_subida" in colMap) newRow[colMap["fecha_subida"]] = today;
    if ("admin_id" in colMap) newRow[colMap["admin_id"]] = item.admin_id || "";
    if ("admin_nombre" in colMap) newRow[colMap["admin_nombre"]] = item.admin_nombre || "";
    if ("retenido" in colMap) newRow[colMap["retenido"]] = item.retenido ? "true" : "false";

    sheet.appendRow(newRow);
    ids.push(nextId);
  }

  return {
    success: true,
    message: items.length === 1 ? "Examen publicado." : items.length + " examenes publicados.",
    ids: ids
  };
}

// ============================================================
// OBTENER RESULTADOS DE UN CLIENTE
// ============================================================
function getClientResults(doc, data) {
  var sheet = doc.getSheetByName("Resultados");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colMap = buildColMap(headers);

  var idCliente = data.id_usuario;
  var idxIdRes = colMap["id_resultado"];
  var idxIdUser = colMap["id_usuario"];
  var idxExamen = colMap["nombre_examen"];
  var idxArchivo = colMap["nombre_archivo"];
  var idxFecha = colMap["fecha_subida"];
  var idxRetenido = colMap["retenido"];
  var results = [];
  var hasRetained = false;

  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (idxIdUser === undefined) continue;
    if (row[idxIdUser].toString().trim() !== idCliente.toString().trim()) continue;

    if (idxRetenido !== undefined && row[idxRetenido] && row[idxRetenido].toString().trim() === "true") {
      hasRetained = true;
      continue;
    }

    var nombreExamen = idxExamen !== undefined && row[idxExamen] ? row[idxExamen].toString().trim() : "";
    var nombreArchivo = idxArchivo !== undefined && row[idxArchivo] ? row[idxArchivo].toString().trim() : "";
    var fechaSubida = idxFecha !== undefined ? cellToISOString(row[idxFecha]) : "";

    if (!nombreExamen && nombreArchivo) nombreExamen = nombreArchivo;

    results.push({
      id_resultado: idxIdRes !== undefined ? row[idxIdRes] : "",
      nombre_examen: nombreExamen,
      nombre_archivo: nombreArchivo,
      fecha_subida: fechaSubida
    });
  }

  results.sort(function (a, b) { return new Date(b.fecha_subida) - new Date(a.fecha_subida); });
  return { success: true, results: results, has_retained: hasRetained };
}

// ============================================================
// LIBERAR RESULTADOS RETENIDOS DE UN CLIENTE
// ============================================================
function releaseRetainedResults(doc, data) {
  var sheet = doc.getSheetByName("Resultados");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colMap = buildColMap(headers);

  var idCliente = data.id_usuario;
  var idxIdUser = colMap["id_usuario"];
  var idxRetenido = colMap["retenido"];
  var count = 0;

  if (idxRetenido === undefined || idxIdUser === undefined) {
    return { success: true, message: "No hay columna retenido. Sin cambios.", released: 0 };
  }

  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (row[idxIdUser].toString().trim() === idCliente.toString().trim() &&
      row[idxRetenido] && row[idxRetenido].toString().trim() === "true") {
      sheet.getRange(i + 1, idxRetenido + 1).setValue("false");
      count++;
    }
  }

  return {
    success: true,
    message: count > 0 ? count + " resultado(s) liberado(s) correctamente." : "No habia resultados retenidos.",
    released: count
  };
}

// ============================================================
// OBTENER TODOS LOS RESULTADOS (historial general del admin)
// ============================================================
function getAllResults(doc) {
  var sheet = doc.getSheetByName("Resultados");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colMap = buildColMap(headers);

  // Mapa id_usuario -> nombre de cliente
  var userMap = {};
  var uSheet = doc.getSheetByName("Usuarios");
  var uRows = uSheet.getDataRange().getValues();
  for (var j = 1; j < uRows.length; j++) {
    userMap[uRows[j][0].toString().trim()] = uRows[j][1].toString().trim();
  }

  var idxIdRes = colMap["id_resultado"];
  var idxIdUser = colMap["id_usuario"];
  var idxExamen = colMap["nombre_examen"];
  var idxArchivo = colMap["nombre_archivo"];
  var idxFecha = colMap["fecha_subida"];
  var idxAdminNombre = colMap["admin_nombre"];  // puede ser undefined en filas viejas

  var results = [];

  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var idUser = idxIdUser !== undefined && row[idxIdUser] ? row[idxIdUser].toString().trim() : "";

    var nombreExamen = idxExamen !== undefined && row[idxExamen] ? row[idxExamen].toString().trim() : "";
    var nombreArchivo = idxArchivo !== undefined && row[idxArchivo] ? row[idxArchivo].toString().trim() : "";
    var fechaSubida = idxFecha !== undefined ? cellToISOString(row[idxFecha]) : "";
    var adminNombre = idxAdminNombre !== undefined && row[idxAdminNombre] ? row[idxAdminNombre].toString().trim() : "";

    if (!nombreExamen && nombreArchivo) nombreExamen = nombreArchivo;

    results.push({
      id_resultado: idxIdRes !== undefined ? row[idxIdRes].toString() : "",
      id_usuario: idUser,
      nombre_cliente: userMap[idUser] || idUser || "Cliente Desconocido",
      nombre_examen: nombreExamen,
      nombre_archivo: nombreArchivo,
      fecha_subida: fechaSubida,
      admin_nombre: adminNombre
    });
  }

  results.sort(function (a, b) { return new Date(b.fecha_subida) - new Date(a.fecha_subida); });
  return { success: true, results: results };
}

// ============================================================
// ELIMINAR RESULTADO
// ============================================================
function deleteResult(doc, data) {
  var sheet = doc.getSheetByName("Resultados");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colMap = buildColMap(headers);

  var idResultado = data.id_resultado.trim();
  var idxIdRes = colMap["id_resultado"];
  var idxArchivo = colMap["nombre_archivo"];

  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (idxIdRes !== undefined && row[idxIdRes].toString().trim() === idResultado) {
      var fileName = idxArchivo !== undefined ? row[idxArchivo].toString() : "";
      sheet.deleteRow(i + 1);
      return { success: true, message: "Examen eliminado.", nombre_archivo: fileName };
    }
  }
  return { success: false, message: "No se encontro el examen con ID: " + idResultado };
}

// ============================================================
// ELIMINAR TODOS LOS RESULTADOS
// ============================================================
function deleteAllResults(doc) {
  var sheet = doc.getSheetByName("Resultados");
  if (!sheet) {
    return { success: false, message: "No se encontro la hoja Resultados." };
  }

  var lastRow = sheet.getLastRow();
  var deletedFiles = [];

  if (lastRow > 1) {
    var rows = sheet.getDataRange().getValues();
    var headers = rows[0];
    var colMap = buildColMap(headers);
    var idxArchivo = colMap["nombre_archivo"];

    // Obtener todos los archivos PDF a eliminar fisicamente
    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      var fileName = idxArchivo !== undefined && row[idxArchivo] ? row[idxArchivo].toString().trim() : "";
      if (fileName && fileName !== "ejemplo_examen.pdf") {
        deletedFiles.push(fileName);
      }
    }

    // Eliminar las filas de datos, conservando la cabecera (fila 1)
    sheet.deleteRows(2, lastRow - 1);
  }

  return {
    success: true,
    message: "Todos los examenes fueron eliminados del Google Sheet.",
    archivos_eliminados: deletedFiles
  };
}

// ============================================================
// ELIMINAR EXÁMENES SELECCIONADOS (MASIVO)
// ============================================================
function deleteResultsBulk(doc, data) {
  var sheet = doc.getSheetByName("Resultados");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colMap = buildColMap(headers);

  var idsToDelete = data.ids; // Array de id_resultado
  if (!idsToDelete || !Array.isArray(idsToDelete) || idsToDelete.length === 0) {
    return { success: false, message: "No se proporcionaron IDs de resultados para eliminar." };
  }

  var idxIdRes = colMap["id_resultado"];
  var idxArchivo = colMap["nombre_archivo"];

  var deletedFiles = [];
  var rowsDeleted = 0;

  // Recorrer las filas de abajo hacia arriba para evitar descalce de índices al eliminar
  for (var i = rows.length - 1; i >= 1; i--) {
    var row = rows[i];
    var idRes = idxIdRes !== undefined ? row[idxIdRes].toString().trim() : "";
    if (idsToDelete.indexOf(idRes) !== -1) {
      var fileName = idxArchivo !== undefined ? row[idxArchivo].toString().trim() : "";
      if (fileName && fileName !== "ejemplo_examen.pdf") {
        deletedFiles.push(fileName);
      }
      sheet.deleteRow(i + 1);
      rowsDeleted++;
    }
  }

  return {
    success: true,
    message: rowsDeleted + " exámenes eliminados.",
    archivos_eliminados: deletedFiles
  };
}

// ============================================================
// ELIMINAR EXÁMENES POR RANGO DE FECHAS
// ============================================================
function deleteResultsRange(doc, data) {
  var sheet = doc.getSheetByName("Resultados");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colMap = buildColMap(headers);

  var fechaInicio = data.fecha_inicio; // YYYY-MM-DD
  var fechaFin = data.fecha_fin;    // YYYY-MM-DD

  if (!fechaInicio || !fechaFin) {
    return { success: false, message: "Las fechas de inicio y fin son requeridas." };
  }

  var idxIdRes = colMap["id_resultado"];
  var idxArchivo = colMap["nombre_archivo"];
  var idxFechaSub = colMap["fecha_subida"];

  var deletedFiles = [];
  var rowsDeleted = 0;

  // Recorrer las filas de abajo hacia arriba
  for (var i = rows.length - 1; i >= 1; i--) {
    var row = rows[i];
    var fechaStr = idxFechaSub !== undefined ? row[idxFechaSub].toString().trim() : "";
    if (fechaStr.length >= 10) {
      var datePart = fechaStr.substring(0, 10); // Extraer YYYY-MM-DD
      if (datePart >= fechaInicio && datePart <= fechaFin) {
        var fileName = idxArchivo !== undefined ? row[idxArchivo].toString().trim() : "";
        if (fileName && fileName !== "ejemplo_examen.pdf") {
          deletedFiles.push(fileName);
        }
        sheet.deleteRow(i + 1);
        rowsDeleted++;
      }
    }
  }

  return {
    success: true,
    message: rowsDeleted + " exámenes eliminados en el rango especificado.",
    archivos_eliminados: deletedFiles
  };
}

// ============================================================
// ELIMINAR CLIENTE Y SUS RESULTADOS
// ============================================================
function deleteClient(doc, data) {
  var idUsuario = data.id_usuario.toString().trim();
  if (!idUsuario) {
    return { success: false, message: "ID de usuario requerido." };
  }

  var uSheet = doc.getSheetByName("Usuarios");
  var uRows = uSheet.getDataRange().getValues();
  var clientFound = false;

  // 1. Eliminar cliente de Usuarios
  for (var i = 1; i < uRows.length; i++) {
    if (uRows[i][0].toString().trim() === idUsuario) {
      uSheet.deleteRow(i + 1);
      clientFound = true;
      break;
    }
  }

  if (!clientFound) {
    return { success: false, message: "No se encontro el cliente con ID: " + idUsuario };
  }

  // 2. Eliminar resultados asociados del cliente en la hoja Resultados
  var rSheet = doc.getSheetByName("Resultados");
  var deletedFiles = [];

  if (rSheet) {
    var rRows = rSheet.getDataRange().getValues();
    var headers = rRows[0];
    var colMap = buildColMap(headers);
    var idxIdUser = colMap["id_usuario"];
    var idxArchivo = colMap["nombre_archivo"];

    // Recorremos de abajo hacia arriba para evitar problemas con cambios de indices al borrar filas
    for (var j = rRows.length - 1; j >= 1; j--) {
      var row = rRows[j];
      if (idxIdUser !== undefined && row[idxIdUser].toString().trim() === idUsuario) {
        var fileName = idxArchivo !== undefined ? row[idxArchivo].toString().trim() : "";
        if (fileName && fileName !== "ejemplo_examen.pdf") {
          deletedFiles.push(fileName);
        }
        rSheet.deleteRow(j + 1);
      }
    }
  }

  return {
    success: true,
    message: "Cliente y sus examenes asociados fueron eliminados del Google Sheet.",
    archivos_eliminados: deletedFiles
  };
}

// ============================================================
// REGISTRO DE ACCESO
// ============================================================
function logAccess(doc, data) {
  var sheet = doc.getSheetByName("Accesos");
  var rows = sheet.getDataRange().getValues();
  var lastNum = 0;
  for (var i = 1; i < rows.length; i++) {
    var id = rows[i][0].toString();
    if (id.startsWith("L")) {
      var n = parseInt(id.substring(1));
      if (!isNaN(n) && n > lastNum) lastNum = n;
    }
  }
  var nextId = "L" + String(lastNum + 1).padStart(5, '0');
  var tz = Session.getScriptTimeZone();
  var now = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd HH:mm:ss");
  sheet.appendRow([nextId, data.usuario, data.rol, now, data.estado]);
  return { success: true };
}

// ============================================================
// ACTUALIZAR CLIENTE
// ============================================================
function updateClient(doc, data) {
  var sheet = doc.getSheetByName("Usuarios");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colMap = buildColMap(headers);
  var idUsuario = data.id_usuario;

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][colMap["id_usuario"]] === idUsuario) {
      if (data.nombre !== undefined) {
        sheet.getRange(i + 1, colMap["nombre"] + 1).setValue(data.nombre);
      }
      if (colMap["direccion"] !== undefined && data.direccion !== undefined) {
        sheet.getRange(i + 1, colMap["direccion"] + 1).setValue(data.direccion);
      }
      if (colMap["correo"] !== undefined && data.correo !== undefined) {
        sheet.getRange(i + 1, colMap["correo"] + 1).setValue(data.correo);
      }
      if (colMap["telefono"] !== undefined && data.telefono !== undefined) {
        sheet.getRange(i + 1, colMap["telefono"] + 1).setValue(data.telefono);
      }
      if (data.contrasena !== undefined && data.contrasena.trim() !== "") {
        sheet.getRange(i + 1, colMap["contrasena"] + 1).setValue(data.contrasena);
      }
      if (colMap["moroso"] !== undefined && data.moroso !== undefined) {
        sheet.getRange(i + 1, colMap["moroso"] + 1).setValue(data.moroso === true || data.moroso === "true" ? "true" : "false");
      }
      if (colMap["plan"] !== undefined && data.plan !== undefined) {
        sheet.getRange(i + 1, colMap["plan"] + 1).setValue(data.plan);
      }
      if (colMap["sirio_credits"] !== undefined && data.sirio_credits !== undefined) {
        sheet.getRange(i + 1, colMap["sirio_credits"] + 1).setValue(Number(data.sirio_credits));
      }

      var updatedUser = {
        id_usuario: idUsuario,
        nombre: data.nombre !== undefined ? data.nombre : rows[i][colMap["nombre"]],
        identificacion: rows[i][colMap["identificacion"]],
        usuario: rows[i][colMap["usuario"]],
        rol: rows[i][colMap["rol"]],
        direccion: data.direccion !== undefined ? data.direccion : (colMap["direccion"] !== undefined ? rows[i][colMap["direccion"]] : ""),
        correo: data.correo !== undefined ? data.correo : (colMap["correo"] !== undefined ? rows[i][colMap["correo"]] : ""),
        telefono: data.telefono !== undefined ? data.telefono : (colMap["telefono"] !== undefined ? rows[i][colMap["telefono"]] : ""),
        moroso: data.moroso !== undefined ? (data.moroso === true || data.moroso === "true") : (colMap["moroso"] !== undefined ? (rows[i][colMap["moroso"]].toString().trim() === "true") : false),
        plan: data.plan !== undefined ? data.plan : (colMap["plan"] !== undefined ? rows[i][colMap["plan"]] : "Básico"),
        sirio_credits: data.sirio_credits !== undefined ? Number(data.sirio_credits) : (colMap["sirio_credits"] !== undefined ? Number(rows[i][colMap["sirio_credits"]] || 0) : 0)
      };

      return { success: true, message: "Perfil actualizado correctamente.", user: updatedUser };
    }
  }
  return { success: false, message: "Usuario no encontrado." };
}

// ============================================================
// CONFIGURACIÓN (GET)
// ============================================================
function getConfig(doc) {
  var config = {};

  // 1. Leer Configuracion
  var sheet = doc.getSheetByName("Configuracion");
  if (sheet) {
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      var key = rows[i][0];
      if (key) {
        var val = rows[i][1];
        config[key.toString().trim()] = (val !== undefined && val !== null && val !== "") ? val.toString().trim() : "";
      }
    }
  }

  // 2. Leer Estado_Portafolio
  var sheetEP = doc.getSheetByName("Estado_Portafolio");
  if (sheetEP) {
    var rowsEP = sheetEP.getDataRange().getValues();
    for (var j = 1; j < rowsEP.length; j++) {
      var keyEP = rowsEP[j][0];
      if (keyEP) {
        var valEP = rowsEP[j][1];
        config[keyEP.toString().trim()] = (valEP !== undefined && valEP !== null && valEP !== "") ? valEP.toString().trim() : "";
      }
    }
  }

  return { success: true, config: config };
}

// ============================================================
// CONFIGURACIÓN (SAVE)
// ============================================================
function saveConfig(doc, data) {
  var sheetConfig = doc.getSheetByName("Configuracion");
  var sheetEP = doc.getSheetByName("Estado_Portafolio");

  for (var key in data) {
    var targetSheet = sheetConfig;
    if (key === "portafolio_visible" || key === "categorias_adicionales") {
      targetSheet = sheetEP;
    }

    if (!targetSheet) continue;

    var rows = targetSheet.getDataRange().getValues();
    var found = false;
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] && rows[i][0].toString().trim() === key) {
        targetSheet.getRange(i + 1, 2).setValue(data[key]);
        found = true;
        break;
      }
    }
    if (!found) {
      targetSheet.appendRow([key, data[key]]);
    }
  }
  return { success: true, message: "Configuracion guardada correctamente." };
}

// ============================================================
// PORTAFOLIO (GET)
// ============================================================
function getPortafolio(doc) {
  var sheet = doc.getSheetByName("Portafolio");
  if (!sheet) return { success: false, message: "La hoja de Portafolio no existe." };

  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colMap = buildColMap(headers);
  var list = [];

  for (var i = 1; i < rows.length; i++) {
    list.push({
      id_examen: rows[i][colMap["id_examen"]].toString().trim(),
      seccion: rows[i][colMap["seccion"]].toString().trim(),
      examen: rows[i][colMap["examen"]].toString().trim(),
      precio: parseFloat(rows[i][colMap["precio"]]),
      tiempo_reporte: rows[i][colMap["tiempo_reporte"]].toString().trim(),
      muestra: rows[i][colMap["muestra"]].toString().trim(),
      recipiente: rows[i][colMap["recipiente"]].toString().trim()
    });
  }
  return { success: true, portafolio: list };
}

// ============================================================
// PORTAFOLIO (SAVE PRECIOS)
// ============================================================
function savePortafolioPrecios(doc, data) {
  var sheet = doc.getSheetByName("Portafolio");
  if (!sheet) return { success: false, message: "La hoja de Portafolio no existe." };

  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colMap = buildColMap(headers);
  var precioColIdx = colMap["precio"] + 1;

  var preciosMap = data.precios || {}; // Objeto { E001: 59000, E002: 69000 }

  for (var i = 1; i < rows.length; i++) {
    var idExamen = rows[i][colMap["id_examen"]].toString().trim();
    if (preciosMap[idExamen] !== undefined) {
      sheet.getRange(i + 1, precioColIdx).setValue(parseFloat(preciosMap[idExamen]));
    }
  }
  return { success: true, message: "Precios del portafolio actualizados correctamente." };
}

// ============================================================
// PORTAFOLIO (ADD EXAMEN)
// ============================================================
function addPortafolioExamen(doc, data) {
  var sheet = doc.getSheetByName("Portafolio");
  if (!sheet) return { success: false, message: "La hoja de Portafolio no existe." };

  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colMap = buildColMap(headers);

  var maxId = 0;
  for (var i = 1; i < rows.length; i++) {
    var idVal = rows[i][colMap["id_examen"]].toString();
    var num = parseInt(idVal.replace(/[^0-9]/g, '')) || 0;
    if (num > maxId) maxId = num;
  }
  var nextId = "E" + String(maxId + 1).padStart(3, '0');

  var newRow = [];
  for (var j = 0; j < headers.length; j++) {
    var header = headers[j];
    if (header === "id_examen") newRow.push(nextId);
    else if (header === "seccion") newRow.push(data.seccion.toUpperCase().trim());
    else if (header === "examen") newRow.push(data.examen.trim());
    else if (header === "precio") newRow.push(parseFloat(data.precio) || 0);
    else if (header === "tiempo_reporte") newRow.push(data.tiempo_reporte.trim());
    else if (header === "muestra") newRow.push(data.muestra.trim());
    else if (header === "recipiente") newRow.push(data.recipiente.trim());
    else newRow.push("");
  }

  sheet.appendRow(newRow);
  return { success: true, message: "Examen añadido correctamente.", id_examen: nextId };
}

// ============================================================
// PORTAFOLIO (DELETE EXAMEN)
// ============================================================
function deletePortafolioExamen(doc, data) {
  var sheet = doc.getSheetByName("Portafolio");
  if (!sheet) return { success: false, message: "La hoja de Portafolio no existe." };

  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colMap = buildColMap(headers);

  var idExamen = data.id_examen.toString().trim();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][colMap["id_examen"]].toString().trim() === idExamen) {
      sheet.deleteRow(i + 1);
      return { success: true, message: "Examen eliminado correctamente." };
    }
  }
  return { success: false, message: "Examen no encontrado." };
}

// ============================================================
// NOTIFICACIONES PUSH (GUARDAR SUSCRIPCIÓN)
// ============================================================
function saveSubscription(doc, data) {
  var sheet = doc.getSheetByName("Push_Subscriptions");
  if (!sheet) return { success: false, message: "La hoja Push_Subscriptions no existe." };

  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colMap = buildColMap(headers);

  var idUser = data.id_usuario;
  var sub = data.subscription;
  var endpoint = sub.endpoint;
  var p256dh = sub.keys.p256dh;
  var auth = sub.keys.auth;

  // Buscar si ya existe la suscripción de este usuario para este endpoint
  var foundIndex = -1;
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][colMap["id_usuario"]].toString().trim() === idUser.toString().trim() &&
      rows[i][colMap["endpoint"]].toString().trim() === endpoint.trim()) {
      foundIndex = i;
      break;
    }
  }

  if (foundIndex !== -1) {
    // Actualizar claves si cambiaron
    sheet.getRange(foundIndex + 1, colMap["p256dh"] + 1).setValue(p256dh);
    sheet.getRange(foundIndex + 1, colMap["auth"] + 1).setValue(auth);
  } else {
    // Insertar nueva fila
    var newRow = new Array(headers.length).fill("");
    newRow[colMap["id_usuario"]] = idUser;
    newRow[colMap["endpoint"]] = endpoint;
    newRow[colMap["p256dh"]] = p256dh;
    newRow[colMap["auth"]] = auth;
    sheet.appendRow(newRow);
  }

  return { success: true, message: "Suscripción registrada correctamente." };
}

// ============================================================
// NOTIFICACIONES PUSH (ELIMINAR SUSCRIPCIÓN)
// ============================================================
function deleteSubscription(doc, data) {
  var sheet = doc.getSheetByName("Push_Subscriptions");
  if (!sheet) return { success: false, message: "La hoja Push_Subscriptions no existe." };

  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colMap = buildColMap(headers);

  var idUser = data.id_usuario;
  var endpoint = data.endpoint;

  var count = 0;
  for (var i = rows.length - 1; i >= 1; i--) {
    if (rows[i][colMap["id_usuario"]].toString().trim() === idUser.toString().trim() &&
      rows[i][colMap["endpoint"]].toString().trim() === endpoint.trim()) {
      sheet.deleteRow(i + 1);
      count++;
    }
  }

  return { success: true, message: "Se eliminaron " + count + " suscripción(es)." };
}

// ============================================================
// NOTIFICACIONES PUSH (OBTENER SUSCRIPCIONES DE UN CLIENTE)
// ============================================================
function getSubscriptions(doc, data) {
  var sheet = doc.getSheetByName("Push_Subscriptions");
  if (!sheet) return { success: true, subscriptions: [] }; // Si no existe la hoja aún, retornar vacío sin fallar

  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colMap = buildColMap(headers);

  var idUser = data.id_usuario;
  var list = [];

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][colMap["id_usuario"]].toString().trim() === idUser.toString().trim()) {
      list.push({
        endpoint: rows[i][colMap["endpoint"]].toString().trim(),
        keys: {
          p256dh: rows[i][colMap["p256dh"]].toString().trim(),
          auth: rows[i][colMap["auth"]].toString().trim()
        }
      });
    }
  }

  return { success: true, subscriptions: list };
}

// ============================================================
// OBTENER PERSONAL DEL LABORATORIO (ADMINS) Y SUS ESTADÍSTICAS
// ============================================================
function getAdmins(doc) {
  var userSheet = doc.getSheetByName("Usuarios");
  var userRows = userSheet.getDataRange().getValues();
  var userHeaders = userRows[0];
  var userColMap = buildColMap(userHeaders);

  var resSheet = doc.getSheetByName("Resultados");
  var resRows = resSheet.getDataRange().getValues();
  var resHeaders = resRows[0];
  var resColMap = buildColMap(resHeaders);

  // Contar los resultados por admin_id
  var resultsCountMap = {};
  for (var k = 1; k < resRows.length; k++) {
    var adminId = resColMap["admin_id"] !== undefined ? resRows[k][resColMap["admin_id"]].toString().trim() : "";
    if (adminId) {
      resultsCountMap[adminId] = (resultsCountMap[adminId] || 0) + 1;
    }
  }

  var list = [];
  for (var i = 1; i < userRows.length; i++) {
    var userRol = (userColMap["rol"] !== undefined && userRows[i][userColMap["rol"]] !== undefined) ? userRows[i][userColMap["rol"]].toString().trim().toLowerCase() : "admin";
    if (userRol === "admin" || userRol === "jefas" || userRol === "programadores") {
      var id = userRows[i][userColMap["id_usuario"]].toString().trim();
      list.push({
        id_usuario: id,
        nombre: userRows[i][userColMap["nombre"]],
        identificacion: userRows[i][userColMap["identificacion"]],
        usuario: userRows[i][userColMap["usuario"]],
        contrasena: userRows[i][userColMap["contrasena"]],
        rol: userRol,
        fecha_registro: userRows[i][userColMap["fecha_registro"]],
        total_enviados: resultsCountMap[id] || 0
      });
    }
  }
  return { success: true, admins: list };
}

// ============================================================
// ACTUALIZAR ADMINISTRADOR (PERSONAL)
// ============================================================
function updateAdmin(doc, data) {
  var sheet = doc.getSheetByName("Usuarios");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colMap = buildColMap(headers);
  var idUsuario = data.id_usuario;

  for (var i = 1; i < rows.length; i++) {
    var userRol = (colMap["rol"] !== undefined && rows[i][colMap["rol"]] !== undefined) ? rows[i][colMap["rol"]].toString().trim().toLowerCase() : "admin";
    if (rows[i][colMap["id_usuario"]].toString().trim() === idUsuario.toString().trim() && (userRol === "admin" || userRol === "jefas" || userRol === "programadores")) {
      var rowNum = i + 1;
      if (data.nombre !== undefined) {
        sheet.getRange(rowNum, colMap["nombre"] + 1).setValue(data.nombre);
      }
      if (data.identificacion !== undefined) {
        sheet.getRange(rowNum, colMap["identificacion"] + 1).setValue(data.identificacion);
      }
      if (data.rol !== undefined && colMap["rol"] !== undefined) {
        sheet.getRange(rowNum, colMap["rol"] + 1).setValue(data.rol);
      }
      if (data.contrasena !== undefined && data.contrasena.trim() !== "") {
        sheet.getRange(rowNum, colMap["contrasena"] + 1).setValue(data.contrasena.trim());
      }
      SpreadsheetApp.flush();
      return { success: true, message: "Perfil de personal actualizado correctamente." };
    }
  }
  return { success: false, message: "El miembro del personal especificado no existe." };
}

// ============================================================
// ELIMINAR ADMINISTRADOR (PERSONAL)
// ============================================================
function deleteAdmin(doc, data) {
  var sheet = doc.getSheetByName("Usuarios");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colMap = buildColMap(headers);
  var idUsuario = data.id_usuario;

  for (var i = 1; i < rows.length; i++) {
    var userRol = (colMap["rol"] !== undefined && rows[i][colMap["rol"]] !== undefined) ? rows[i][colMap["rol"]].toString().trim().toLowerCase() : "admin";
    if (rows[i][colMap["id_usuario"]].toString().trim() === idUsuario.toString().trim() && (userRol === "admin" || userRol === "jefas" || userRol === "programadores")) {
      sheet.deleteRow(i + 1);
      SpreadsheetApp.flush();
      return { success: true, message: "Perfil de personal eliminado de la base de datos." };
    }
  }
  return { success: false, message: "El miembro del personal especificado no existe." };
}


