/**
 * CÓDIGO PARA GOOGLE APPS SCRIPT (ACTUALIZADO CON SOPORTE PARA ELIMINACIÓN)
 * 
 * Instrucciones de instalación:
 * 1. Abre tu Google Sheet donde quieres guardar los datos.
 * 2. Ve a 'Extensiones' > 'Apps Script'.
 * 3. Borra el código existente en 'Código.gs'.
 * 4. Pega este código.
 * 5. Cambia el valor de API_KEY en la línea 17 por una clave secreta propia si lo deseas (recuerda poner la misma en tu archivo .env).
 * 6. Haz clic en 'Implementar' > 'Nueva implementación'.
 * 7. En 'Tipo de implementación', selecciona 'Aplicación web'.
 * 8. Configura:
 *    - Descripción: API SIRIO Portal
 *    - Ejecutar como: Tú (tu cuenta de Google)
 *    - Quién tiene acceso: Cualquier persona (Anyone)
 * 9. Haz clic en 'Implementar', autoriza los permisos y copia la 'URL de la aplicación web'.
 * 10. Pega esta URL en el archivo .env de tu servidor.
 */

var API_KEY = "SIRIO_SECRET_API_KEY"; // Cambia esto por una contraseña secreta para tu API

function doPost(e) {
  var response = { success: false, message: "" };
  
  try {
    if (!e || !e.postData || !e.postData.contents) {
      response.message = "No se recibieron datos en el cuerpo de la solicitud (POST body vacío).";
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
    
    // Inicializar hojas si no existen
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
      response.message = "Acción no reconocida: " + action;
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
 * Crea las pestañas necesarias si no existen al arrancar
 */
function checkAndInitSheets(doc) {
  var sheets = ["Usuarios", "Resultados", "Accesos"];
  var headers = {
    "Usuarios": ["id_usuario", "nombre", "identificacion", "usuario", "contrasena", "rol", "fecha_registro"],
    "Resultados": ["id_resultado", "id_usuario", "nombre_paciente", "nombre_examen", "nombre_archivo", "fecha_subida", "observaciones"],
    "Accesos": ["id_log", "usuario", "rol", "fecha_hora", "estado"]
  };
  
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i];
    var sheet = doc.getSheetByName(name);
    if (!sheet) {
      sheet = doc.insertSheet(name);
      sheet.appendRow(headers[name]);
      
      // Aplicar un estilo básico a la cabecera
      var headerRange = sheet.getRange(1, 1, 1, headers[name].length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#0a192f");
      headerRange.setFontColor("#ffffff");
      
      // Si creamos usuarios, agregar el administrador por defecto
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
 * Maneja el inicio de sesión
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
  
  return { success: false, message: "Usuario o contraseña incorrectos." };
}

/**
 * Obtiene todos los clientes
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
 * Agrega un nuevo cliente
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
      return { success: false, message: "Un cliente con esta identificación ya está registrado." };
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
  return { success: true, message: "Cliente registrado con éxito.", client: { id_usuario: nextId, nombre: data.nombre } };
}

/**
 * Agrega un resultado de examen (PDF) asociado a un cliente y su paciente
 */
function addResult(doc, data) {
  var sheet = doc.getSheetByName("Resultados");
  var rows = sheet.getDataRange().getValues();
  
  var lastIdNum = 0;
  for (var i = 1; i < rows.length; i++) {
    var currentId = rows[i][0].toString();
    if (currentId.startsWith("R")) {
      var num = parseInt(currentId.substring(1));
      if (!isNaN(num) && num > lastIdNum) {
        lastIdNum = num;
      }
    }
  }
  var nextId = "R" + String(lastIdNum + 1).padStart(3, '0');
  
  var newRow = [
    nextId,
    data.id_usuario,
    data.nombre_paciente,
    data.nombre_examen,
    data.nombre_archivo,
    new Date().toISOString().split('T')[0],
    data.observaciones || ""
  ];
  
  sheet.appendRow(newRow);
  return { success: true, message: "Examen publicado en Google Sheets correctamente.", id_resultado: nextId };
}

/**
 * Obtiene los exámenes de un cliente
 */
function getClientResults(doc, data) {
  var sheet = doc.getSheetByName("Resultados");
  var rows = sheet.getDataRange().getValues();
  var results = [];
  
  var idCliente = data.id_usuario;
  
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (row[1].toString() === idCliente) {
      results.push({
        id_resultado: row[0],
        nombre_paciente: row[2],
        nombre_examen: row[3],
        nombre_archivo: row[4],
        fecha_subida: row[5],
        observaciones: row[6]
      });
    }
  }
  
  results.sort(function(a, b) {
    return new Date(b.fecha_subida) - new Date(a.fecha_subida);
  });
  
  return { success: true, results: results };
}

/**
 * Elimina un resultado de examen por su ID
 */
function deleteResult(doc, data) {
  var sheet = doc.getSheetByName("Resultados");
  var rows = sheet.getDataRange().getValues();
  var idResultado = data.id_resultado.trim();
  
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (row[0].toString().trim() === idResultado) {
      var fileName = row[4].toString(); // Columna E (nombre_archivo)
      sheet.deleteRow(i + 1); // deleteRow es 1-indexed, i es 0-indexed pero el encabezado está en la fila 1
      return { 
        success: true, 
        message: "Examen eliminado de la hoja de cálculo.", 
        nombre_archivo: fileName 
      };
    }
  }
  
  return { success: false, message: "No se encontró ningún examen con el ID especificado en la hoja de cálculo." };
}

/**
 * Registra auditoría de accesos
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
