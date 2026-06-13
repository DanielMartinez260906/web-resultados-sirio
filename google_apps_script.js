/**
 * CÓDIGO PARA GOOGLE APPS SCRIPT (ESTRUCTURA DE 5 COLUMNAS DE RESULTADOS)
 * 
 * Instrucciones de instalación:
 * 1. Abre tu Google Sheet.
 * 2. ELIMINA la pestaña 'Resultados' existente (haz clic derecho sobre la pestaña abajo y selecciona 'Eliminar').
 *    *Nota: Esto es necesario para que el script la vuelva a crear con la estructura limpia de 5 columnas sin errores de orden.*
 * 3. Ve a 'Extensiones' > 'Apps Script'.
 * 4. Borra todo el código existente.
 * 5. Pega este código.
 * 6. Guarda el proyecto (ícono de disquete).
 * 7. Haz clic en 'Implementar' > 'Administrar implementaciones'.
 *    - Edita la implementación existente de tipo 'Aplicación web'.
 *    - Cambia la versión a 'Nueva versión'.
 *    - Haz clic en 'Implementar'.
 */

var API_KEY = "SIRIO_SECRET_API_KEY"; // Debe coincidir con la de tu archivo .env

function doPost(e) {
  var response = { success: false, message: "" };
  
  try {
    if (!e || !e.postData || !e.postData.contents) {
      response.message = "No se recibieron datos en el cuerpo de la solicitud.";
      return returnJSON(response);
    }
    
    var requestData = JSON.parse(e.postData.contents);
    
    // Verificar API Key
    if (requestData.apiKey !== API_KEY) {
      response.message = "No autorizado: API Key incorrecta.";
      return returnJSON(response);
    }
    
    var action = requestData.action;
    var data = requestData.data;
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    
    // Inicializar hojas
    checkAndInitSheets(doc);
    
    if (action === "login") {
      response = handleLogin(doc, data);
    } else if (action === "getClients") {
      response = getClients(doc);
    } else if (action === "addClient") {
      response = addClient(doc, data);
    } else if (action === "addResult") {
      response = addResult(doc, data);
    } else if (action === "getClientResults") {
      response = getClientResults(doc, data);
    } else if (action === "deleteResult") {
      response = deleteResult(doc, data);
    } else if (action === "logAccess") {
      response = logAccess(doc, data);
    } else {
      response.message = "Accion no reconocida: " + action;
    }
    
  } catch (error) {
    response.success = false;
    response.message = "Error en el servidor de Google Sheets: " + error.toString();
  }
  
  return returnJSON(response);
}

function returnJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Inicializa las pestañas con las cabeceras exactas
 */
function checkAndInitSheets(doc) {
  var sheets = ["Usuarios", "Resultados", "Accesos"];
  var headers = {
    "Usuarios": ["id_usuario", "nombre", "identificacion", "usuario", "contrasena", "rol", "fecha_registro"],
    // Estructura limpia de 5 columnas
    "Resultados": ["id_resultado", "id_usuario", "nombre_examen", "nombre_archivo", "fecha_subida"],
    "Accesos": ["id_log", "usuario", "rol", "fecha_hora", "estado"]
  };
  
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i];
    var sheet = doc.getSheetByName(name);
    if (!sheet) {
      sheet = doc.insertSheet(name);
      sheet.appendRow(headers[name]);
      
      var headerRange = sheet.getRange(1, 1, 1, headers[name].length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#0a192f");
      headerRange.setFontColor("#ffffff");
      
      if (name === "Usuarios") {
        sheet.appendRow([
          "U000",
          "Administrador Laboratorio",
          "00000000",
          "admin",
          "admin123",
          "admin",
          new Date().toISOString().split('T')[0]
        ]);
      }
    }
  }
}

/**
 * Login
 */
function handleLogin(doc, data) {
  var sheet = doc.getSheetByName("Usuarios");
  var rows = sheet.getDataRange().getValues();
  
  var username = data.username.trim().toLowerCase();
  var password = data.password;
  
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var dbUser = row[3].toString().trim().toLowerCase();
    var dbPass = row[4].toString();
    
    if (dbUser === username && dbPass === password) {
      return {
        success: true,
        user: {
          id_usuario: row[0],
          nombre: row[1],
          identificacion: row[2],
          usuario: row[3],
          rol: row[5]
        }
      };
    }
  }
  
  return { success: false, message: "Usuario o contrasena incorrectos." };
}

/**
 * Obtener clientes
 */
function getClients(doc) {
  var sheet = doc.getSheetByName("Usuarios");
  var rows = sheet.getDataRange().getValues();
  var clients = [];
  
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (row[5] === "cliente") {
      clients.push({
        id_usuario: row[0],
        nombre: row[1],
        identificacion: row[2],
        usuario: row[3],
        fecha_registro: row[6]
      });
    }
  }
  
  return { success: true, clients: clients };
}

/**
 * Crear cliente
 */
function addClient(doc, data) {
  var sheet = doc.getSheetByName("Usuarios");
  var rows = sheet.getDataRange().getValues();
  
  var username = data.usuario.trim().toLowerCase();
  var ident = data.identificacion.toString().trim();
  
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][3].toString().toLowerCase() === username) {
      return { success: false, message: "El nombre de usuario ya existe." };
    }
    if (rows[i][2].toString() === ident) {
      return { success: false, message: "Un cliente con esta identificacion ya esta registrado." };
    }
  }
  
  var lastIdNum = 0;
  for (var i = 1; i < rows.length; i++) {
    var currentId = rows[i][0].toString();
    if (currentId.startsWith("U")) {
      var num = parseInt(currentId.substring(1));
      if (!isNaN(num) && num > lastIdNum) {
        lastIdNum = num;
      }
    }
  }
  var nextId = "U" + String(lastIdNum + 1).padStart(3, '0');
  
  var newRow = [
    nextId,
    data.nombre,
    ident,
    username,
    data.contrasena,
    "cliente",
    new Date().toISOString().split('T')[0]
  ];
  
  sheet.appendRow(newRow);
  return { success: true, message: "Cliente registrado con exito.", client: { id_usuario: nextId, nombre: data.nombre } };
}

/**
 * Publicar resultados en lote (Adaptativo al esquema)
 */
function addResult(doc, data) {
  var sheet = doc.getSheetByName("Resultados");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colMap = {};
  for (var i = 0; i < headers.length; i++) {
    colMap[headers[i].toString().trim()] = i;
  }
  
  var items = Array.isArray(data) ? data : [data];
  
  var lastIdNum = 0;
  var idxIdRes = colMap["id_resultado"] !== undefined ? colMap["id_resultado"] : 0;
  
  for (var i = 1; i < rows.length; i++) {
    var currentId = rows[i][idxIdRes].toString();
    if (currentId.startsWith("R")) {
      var num = parseInt(currentId.substring(1));
      if (!isNaN(num) && num > lastIdNum) {
        lastIdNum = num;
      }
    }
  }
  
  var idsResponse = [];
  var today = new Date().toISOString().split('T')[0];
  
  for (var k = 0; k < items.length; k++) {
    var item = items[k];
    lastIdNum++;
    var nextId = "R" + String(lastIdNum).padStart(3, '0');
    
    // Crear fila vacía con longitud exacta de cabeceras
    var newRow = new Array(headers.length);
    for (var j = 0; j < newRow.length; j++) {
      newRow[j] = "";
    }
    
    // Rellenar valores en las columnas correspondientes
    if ("id_resultado" in colMap) newRow[colMap["id_resultado"]] = nextId;
    if ("id_usuario" in colMap) newRow[colMap["id_usuario"]] = item.id_usuario;
    if ("nombre_examen" in colMap) newRow[colMap["nombre_examen"]] = item.nombre_examen;
    if ("nombre_archivo" in colMap) newRow[colMap["nombre_archivo"]] = item.nombre_archivo;
    if ("fecha_subida" in colMap) newRow[colMap["fecha_subida"]] = today;
    
    sheet.appendRow(newRow);
    idsResponse.push(nextId);
  }
  
  return { 
    success: true, 
    message: items.length === 1 ? "Examen publicado." : items.length + " examenes publicados correctamente.", 
    ids: idsResponse 
  };
}

/**
 * Obtener resultados del cliente (Adaptativo a 5 o 7 columnas)
 */
function getClientResults(doc, data) {
  var sheet = doc.getSheetByName("Resultados");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colMap = {};
  for (var i = 0; i < headers.length; i++) {
    colMap[headers[i].toString().trim()] = i;
  }
  
  var results = [];
  var idCliente = data.id_usuario;
  
  var idxIdRes = colMap["id_resultado"];
  var idxIdUser = colMap["id_usuario"];
  var idxExamen = colMap["nombre_examen"];
  var idxArchivo = colMap["nombre_archivo"];
  var idxFecha = colMap["fecha_subida"];
  var idxPaciente = colMap["nombre_paciente"]; // Indica formato viejo si existe
  
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    
    if (idxIdUser !== undefined && row[idxIdUser].toString().trim() === idCliente.toString().trim()) {
      var nombreExamen = "";
      var nombreArchivo = "";
      var fechaSubida = "";
      
      // Manejar retrocompatibilidad si la hoja tiene "nombre_paciente"
      if (idxPaciente !== undefined && idxPaciente < idxExamen) {
        var valCol2 = row[2] ? row[2].toString().trim() : "";
        var valCol3 = row[3] ? row[3].toString().trim() : "";
        var valCol4 = row[4] ? row[4].toString().trim() : "";
        var valCol5 = row[5] ? row[5].toString().trim() : "";
        
        if (valCol2.toLowerCase().endsWith('.pdf')) {
          // Caso nuevo en hoja vieja (original en Col C, archivo en Col D, fecha en Col E)
          nombreExamen = valCol2;
          nombreArchivo = valCol3;
          fechaSubida = valCol4;
        } else if (valCol3.toLowerCase().endsWith('.pdf')) {
          // Caso intermedio/viejo donde la Col D contiene el archivo PDF
          nombreExamen = valCol3;
          nombreArchivo = valCol3;
          fechaSubida = valCol4;
        } else if (valCol4.toLowerCase().endsWith('.pdf')) {
          // Caso viejo real (paciente en Col C, examen en Col D, archivo en Col E)
          nombreExamen = valCol4; // Nombre del PDF como título principal
          nombreArchivo = valCol4;
          fechaSubida = valCol5;
        } else {
          nombreExamen = valCol3;
          nombreArchivo = valCol4;
          fechaSubida = valCol5;
        }
      } else {
        // Formato nuevo limpio de 5 columnas
        nombreExamen = idxExamen !== undefined && row[idxExamen] ? row[idxExamen].toString().trim() : "";
        nombreArchivo = idxArchivo !== undefined && row[idxArchivo] ? row[idxArchivo].toString().trim() : "";
        fechaSubida = idxFecha !== undefined && row[idxFecha] ? row[idxFecha].toString().trim() : "";
      }
      
      // Asegurar título del PDF como nombre del examen si no se cargó
      if (!nombreExamen && nombreArchivo) {
        nombreExamen = nombreArchivo;
      }
      
      results.push({
        id_resultado: idxIdRes !== undefined ? row[idxIdRes] : "",
        nombre_examen: nombreExamen,
        nombre_archivo: nombreArchivo,
        fecha_subida: fechaSubida
      });
    }
  }
  
  results.sort(function(a, b) {
    return new Date(b.fecha_subida) - new Date(a.fecha_subida);
  });
  
  return { success: true, results: results };
}

/**
 * Eliminar resultado (Adaptativo)
 */
function deleteResult(doc, data) {
  var sheet = doc.getSheetByName("Resultados");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colMap = {};
  for (var i = 0; i < headers.length; i++) {
    colMap[headers[i].toString().trim()] = i;
  }
  
  var idResultado = data.id_resultado.trim();
  var idxIdRes = colMap["id_resultado"];
  var idxArchivo = colMap["nombre_archivo"];
  var idxPaciente = colMap["nombre_paciente"];
  
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (idxIdRes !== undefined && row[idxIdRes].toString().trim() === idResultado) {
      var fileName = "";
      
      if (idxPaciente !== undefined && idxPaciente < colMap["nombre_examen"]) {
        var valCol2 = row[2] ? row[2].toString().trim() : "";
        var valCol3 = row[3] ? row[3].toString().trim() : "";
        var valCol4 = row[4] ? row[4].toString().trim() : "";
        
        if (valCol2.toLowerCase().endsWith('.pdf')) {
          fileName = valCol3;
        } else if (valCol3.toLowerCase().endsWith('.pdf')) {
          fileName = valCol3;
        } else if (valCol4.toLowerCase().endsWith('.pdf')) {
          fileName = valCol4;
        } else {
          fileName = valCol4;
        }
      } else {
        fileName = idxArchivo !== undefined ? row[idxArchivo].toString() : "";
      }
      
      sheet.deleteRow(i + 1);
      return { 
        success: true, 
        message: "Examen eliminado de la hoja de calculo.", 
        nombre_archivo: fileName 
      };
    }
  }
  
  return { success: false, message: "No se encontro ningun examen con el ID especificado." };
}

/**
 * Registro de acceso
 */
function logAccess(doc, data) {
  var sheet = doc.getSheetByName("Accesos");
  
  var timezone = Session.getScriptTimeZone();
  var formattedDate = Utilities.formatDate(new Date(), timezone, "yyyy-MM-dd HH:mm:ss");
  
  var rows = sheet.getDataRange().getValues();
  var lastIdNum = 0;
  for (var i = 1; i < rows.length; i++) {
    var currentId = rows[i][0].toString();
    if (currentId.startsWith("L")) {
      var num = parseInt(currentId.substring(1));
      if (!isNaN(num) && num > lastIdNum) {
        lastIdNum = num;
      }
    }
  }
  var nextId = "L" + String(lastIdNum + 1).padStart(5, '0');
  
  var newRow = [
    nextId,
    data.usuario,
    data.rol,
    formattedDate,
    data.estado
  ];
  
  sheet.appendRow(newRow);
  return { success: true };
}
