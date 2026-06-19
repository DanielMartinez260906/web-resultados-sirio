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
    var data   = requestData.data;
    var doc    = SpreadsheetApp.getActiveSpreadsheet();

    // Asegurar estructura correcta en cada request
    checkAndInitSheets(doc);
    migrateSheets(doc);

    if      (action === "login")            { response = handleLogin(doc, data); }
    else if (action === "getClients")       { response = getClients(doc); }
    else if (action === "addClient")        { response = addClient(doc, data); }
    else if (action === "addResult")        { response = addResult(doc, data); }
    else if (action === "getClientResults") { response = getClientResults(doc, data); }
    else if (action === "deleteResult")     { response = deleteResult(doc, data); }
    else if (action === "deleteAllResults")  { response = deleteAllResults(doc); }
    else if (action === "getAllResults")     { response = getAllResults(doc); }
    else if (action === "logAccess")        { response = logAccess(doc, data); }
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
  var sheet = doc.getSheetByName("Resultados");
  if (!sheet) return;

  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return;

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var colMap  = {};
  for (var i = 0; i < headers.length; i++) {
    colMap[headers[i].toString().trim().toLowerCase()] = i;
  }

  // Agregar columna admin_nombre si no existe
  if (!("admin_nombre" in colMap)) {
    var newCol = lastCol + 1;
    var cell   = sheet.getRange(1, newCol);
    cell.setValue("admin_nombre");
    cell.setFontWeight("bold");
    cell.setBackground("#0a192f");
    cell.setFontColor("#ffffff");
    SpreadsheetApp.flush();
  }
}

// ============================================================
// INICIALIZAR HOJAS
// ============================================================
function checkAndInitSheets(doc) {
  var sheetsConfig = {
    "Usuarios":  ["id_usuario","nombre","identificacion","usuario","contrasena","rol","fecha_registro"],
    "Resultados":["id_resultado","id_usuario","nombre_examen","nombre_archivo","fecha_subida","admin_nombre"],
    "Accesos":   ["id_log","usuario","rol","fecha_hora","estado"]
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
        sheet.appendRow(["U000","Administrador Laboratorio","00000000","admin","admin123","admin",
                         new Date().toISOString().split('T')[0]]);
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
  var rows  = sheet.getDataRange().getValues();
  var uname = data.username.trim().toLowerCase();
  var pass  = data.password;

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (r[3].toString().trim().toLowerCase() === uname && r[4].toString() === pass) {
      return {
        success: true,
        user: { id_usuario: r[0], nombre: r[1], identificacion: r[2], usuario: r[3], rol: r[5] }
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
  var rows  = sheet.getDataRange().getValues();
  var list  = [];
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][5] === "cliente") {
      list.push({ id_usuario: rows[i][0], nombre: rows[i][1],
                  identificacion: rows[i][2], usuario: rows[i][3], fecha_registro: rows[i][6] });
    }
  }
  return { success: true, clients: list };
}

// ============================================================
// CREAR CLIENTE
// ============================================================
function addClient(doc, data) {
  var sheet = doc.getSheetByName("Usuarios");
  var rows  = sheet.getDataRange().getValues();
  var uname = data.usuario.trim().toLowerCase();
  var ident = data.identificacion.toString().trim();

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][3].toString().toLowerCase() === uname)
      return { success: false, message: "El nombre de usuario ya existe." };
    if (rows[i][2].toString() === ident)
      return { success: false, message: "Un cliente con esta identificacion ya esta registrado." };
  }

  var lastNum = 0;
  for (var i = 1; i < rows.length; i++) {
    var id = rows[i][0].toString();
    if (id.startsWith("U")) {
      var n = parseInt(id.substring(1));
      if (!isNaN(n) && n > lastNum) lastNum = n;
    }
  }
  var nextId = "U" + String(lastNum + 1).padStart(3, '0');
  sheet.appendRow([nextId, data.nombre, ident, uname, data.contrasena, "cliente",
                   new Date().toISOString().split('T')[0]]);
  return { success: true, message: "Cliente registrado.", client: { id_usuario: nextId, nombre: data.nombre } };
}

// ============================================================
// PUBLICAR RESULTADOS (con admin_nombre)
// ============================================================
function addResult(doc, data) {
  var sheet   = doc.getSheetByName("Resultados");
  var rows    = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colMap  = buildColMap(headers);

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
  var today    = Utilities.formatDate(new Date(), timezone, "yyyy-MM-dd'T'HH:mm:ssXXX");
  var ids      = [];

  for (var k = 0; k < items.length; k++) {
    var item   = items[k];
    lastNum++;
    var nextId = "R" + String(lastNum).padStart(3, '0');

    // Fila vacía del tamaño exacto de cabeceras
    var newRow = new Array(headers.length).fill("");

    if ("id_resultado"  in colMap) newRow[colMap["id_resultado"]]  = nextId;
    if ("id_usuario"    in colMap) newRow[colMap["id_usuario"]]    = item.id_usuario    || "";
    if ("nombre_examen" in colMap) newRow[colMap["nombre_examen"]] = item.nombre_examen || "";
    if ("nombre_archivo"in colMap) newRow[colMap["nombre_archivo"]]= item.nombre_archivo|| "";
    if ("fecha_subida"  in colMap) newRow[colMap["fecha_subida"]]  = today;
    if ("admin_nombre"  in colMap) newRow[colMap["admin_nombre"]]  = item.admin_nombre  || "";

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
  var sheet   = doc.getSheetByName("Resultados");
  var rows    = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colMap  = buildColMap(headers);

  var idCliente   = data.id_usuario;
  var idxIdRes    = colMap["id_resultado"];
  var idxIdUser   = colMap["id_usuario"];
  var idxExamen   = colMap["nombre_examen"];
  var idxArchivo  = colMap["nombre_archivo"];
  var idxFecha    = colMap["fecha_subida"];
  var results     = [];

  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (idxIdUser === undefined) continue;
    if (row[idxIdUser].toString().trim() !== idCliente.toString().trim()) continue;

    var nombreExamen  = idxExamen  !== undefined && row[idxExamen]  ? row[idxExamen].toString().trim()  : "";
    var nombreArchivo = idxArchivo !== undefined && row[idxArchivo] ? row[idxArchivo].toString().trim() : "";
    var fechaSubida   = idxFecha   !== undefined                    ? cellToISOString(row[idxFecha])    : "";

    if (!nombreExamen && nombreArchivo) nombreExamen = nombreArchivo;

    results.push({
      id_resultado:  idxIdRes !== undefined ? row[idxIdRes] : "",
      nombre_examen: nombreExamen,
      nombre_archivo:nombreArchivo,
      fecha_subida:  fechaSubida
    });
  }

  results.sort(function(a, b) { return new Date(b.fecha_subida) - new Date(a.fecha_subida); });
  return { success: true, results: results };
}

// ============================================================
// OBTENER TODOS LOS RESULTADOS (historial general del admin)
// ============================================================
function getAllResults(doc) {
  var sheet    = doc.getSheetByName("Resultados");
  var rows     = sheet.getDataRange().getValues();
  var headers  = rows[0];
  var colMap   = buildColMap(headers);

  // Mapa id_usuario -> nombre de cliente
  var userMap = {};
  var uSheet  = doc.getSheetByName("Usuarios");
  var uRows   = uSheet.getDataRange().getValues();
  for (var j = 1; j < uRows.length; j++) {
    userMap[uRows[j][0].toString().trim()] = uRows[j][1].toString().trim();
  }

  var idxIdRes      = colMap["id_resultado"];
  var idxIdUser     = colMap["id_usuario"];
  var idxExamen     = colMap["nombre_examen"];
  var idxArchivo    = colMap["nombre_archivo"];
  var idxFecha      = colMap["fecha_subida"];
  var idxAdminNombre= colMap["admin_nombre"];  // puede ser undefined en filas viejas

  var results = [];

  for (var i = 1; i < rows.length; i++) {
    var row    = rows[i];
    var idUser = idxIdUser !== undefined && row[idxIdUser] ? row[idxIdUser].toString().trim() : "";

    var nombreExamen   = idxExamen      !== undefined && row[idxExamen]      ? row[idxExamen].toString().trim()      : "";
    var nombreArchivo  = idxArchivo     !== undefined && row[idxArchivo]     ? row[idxArchivo].toString().trim()     : "";
    var fechaSubida    = idxFecha       !== undefined                        ? cellToISOString(row[idxFecha])        : "";
    var adminNombre    = idxAdminNombre !== undefined && row[idxAdminNombre] ? row[idxAdminNombre].toString().trim() : "";

    if (!nombreExamen && nombreArchivo) nombreExamen = nombreArchivo;

    results.push({
      id_resultado:  idxIdRes !== undefined ? row[idxIdRes].toString() : "",
      id_usuario:    idUser,
      nombre_cliente:userMap[idUser] || idUser || "Cliente Desconocido",
      nombre_examen: nombreExamen,
      nombre_archivo:nombreArchivo,
      fecha_subida:  fechaSubida,
      admin_nombre:  adminNombre
    });
  }

  results.sort(function(a, b) { return new Date(b.fecha_subida) - new Date(a.fecha_subida); });
  return { success: true, results: results };
}

// ============================================================
// ELIMINAR RESULTADO
// ============================================================
function deleteResult(doc, data) {
  var sheet   = doc.getSheetByName("Resultados");
  var rows    = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colMap  = buildColMap(headers);

  var idResultado = data.id_resultado.trim();
  var idxIdRes    = colMap["id_resultado"];
  var idxArchivo  = colMap["nombre_archivo"];

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
// REGISTRO DE ACCESO
// ============================================================
function logAccess(doc, data) {
  var sheet   = doc.getSheetByName("Accesos");
  var rows    = sheet.getDataRange().getValues();
  var lastNum = 0;
  for (var i = 1; i < rows.length; i++) {
    var id = rows[i][0].toString();
    if (id.startsWith("L")) {
      var n = parseInt(id.substring(1));
      if (!isNaN(n) && n > lastNum) lastNum = n;
    }
  }
  var nextId = "L" + String(lastNum + 1).padStart(5, '0');
  var tz     = Session.getScriptTimeZone();
  var now    = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd HH:mm:ss");
  sheet.appendRow([nextId, data.usuario, data.rol, now, data.estado]);
  return { success: true };
}
