const axios = require('axios');
const fs = require('fs');
const path = require('path');

const GOOGLE_SHEET_URL = process.env.GOOGLE_SHEET_API_URL || '';
const API_KEY = process.env.API_KEY || 'SIRIO_SECRET_API_KEY';
const MOCK_DB_PATH = path.join(__dirname, 'mock_db.json');

// Verificar si estamos en modo Demo
const isDemoMode = !GOOGLE_SHEET_URL || GOOGLE_SHEET_URL.includes('xxxxxxxxx');

if (isDemoMode) {
  console.log('\x1b[33m%s\x1b[0m', '⚠️ ADVERTENCIA: Ejecutando en MODO DEMOSTRACIÓN.');
  console.log('\x1b[33m%s\x1b[0m', 'La URL de Google Sheets no está configurada en el archivo .env.');
  console.log('\x1b[33m%s\x1b[0m', 'Los datos se guardarán localmente en "server/mock_db.json".');
  
  // Inicializar mock_db.json si no existe
  if (!fs.existsSync(MOCK_DB_PATH)) {
    createDefaultMockDB();
  }
} else {
  console.log('\x1b[32m%s\x1b[0m', '✅ CONECTADO A GOOGLE SHEETS API.');
  console.log(`URL: ${GOOGLE_SHEET_URL}`);
}

const defaultPortafolio = [
  { id_examen: "E001", seccion: "MICROBIOLOGÍA", examen: "Cultivo 1 Oído (Bacteriológico con antibiograma + Micológico)", precio: 58000, tiempo_reporte: "2-5 días", muestra: "Hisopado", recipiente: "Hisopado en medio de transporte" },
  { id_examen: "E002", seccion: "MICROBIOLOGÍA", examen: "Cultivo 2 Oídos (Bacteriológico con antibiograma + Micológico)", precio: 68000, tiempo_reporte: "2-5 días", muestra: "Hisopado", recipiente: "Hisopado en medio de transporte" },
  { id_examen: "E003", seccion: "MICROBIOLOGÍA", examen: "Urocultivo (Bacteriológico + antibiograma)", precio: 58000, tiempo_reporte: "2-5 días", muestra: "Orina", recipiente: "Tubo tapa gris (Ácido Bórico)" },
  { id_examen: "E004", seccion: "MICROBIOLOGÍA", examen: "Coprocultivo (Bacteriológico + antibiograma)", precio: 58000, tiempo_reporte: "2-5 días", muestra: "Materia fecal", recipiente: "Frasco tapa rosca estéril" },
  { id_examen: "E005", seccion: "HEMATOLOGÍA", examen: "Hemograma automatizado (Extendido de sangre periférica, Proteínas, Reticulocitos)", precio: 14000, tiempo_reporte: "1 día", muestra: "300 ul Sangre total", recipiente: "Tubo tapa lila (EDTA)" },
  { id_examen: "E006", seccion: "COAGULACIÓN", examen: "Tiempo de Protrombina TP", precio: 14500, tiempo_reporte: "1 día", muestra: "a. 1 ml Sangre / b. 500 ul Plasma", recipiente: "a. Tubo celeste (Citrato)" },
  { id_examen: "E007", seccion: "COAGULACIÓN", examen: "Tiempo Parcial de Tromboplastina TPT", precio: 14500, tiempo_reporte: "1 día", muestra: "a. 1 ml Sangre / b. 500 ul Plasma", recipiente: "a. Tubo celeste (Citrato)" },
  { id_examen: "E008", seccion: "QUÍMICA SANGUÍNEA", examen: "Ácidos Biliares (Una muestra)", precio: 85000, tiempo_reporte: "1 día", muestra: "a. 500 ul Sangre / b. 500 ul Suero", recipiente: "Tubo tapa roja o amarilla" },
  { id_examen: "E009", seccion: "QUÍMICA SANGUÍNEA", examen: "Alanina aminotransferasa (ALT/GPT)", precio: 10500, tiempo_reporte: "1 día", muestra: "a. 500 ul Sangre / b. 500 ul Suero", recipiente: "Tubo tapa roja o amarilla" },
  { id_examen: "E010", seccion: "QUÍMICA SANGUÍNEA", examen: "Creatinina", precio: 10500, tiempo_reporte: "1 día", muestra: "a. 500 ul Sangre / b. 500 ul Suero", recipiente: "Tubo tapa roja o amarilla" },
  { id_examen: "E011", seccion: "QUÍMICA SANGUÍNEA", examen: "Dimetilarginina Simétrica (SDMA) + Creatinina", precio: 155000, tiempo_reporte: "1 día", muestra: "a. 500 ul Sangre / b. 500 ul Suero", recipiente: "Tubo tapa roja o amarilla" },
  { id_examen: "E012", seccion: "VITAMINAS", examen: "Ácido Fólico/Vitamina B9", precio: 50000, tiempo_reporte: "2-3 días", muestra: "a. 1 ml Sangre / b. 500 ul Suero", recipiente: "Tubo tapa roja o amarilla" },
  { id_examen: "E013", seccion: "UROANÁLISIS", examen: "Citoquímico de orina (Fisicoquímico, microscópico + GRAM)", precio: 11000, tiempo_reporte: "1 día", muestra: "Orina", recipiente: "Jeringa o frasco estéril" },
  { id_examen: "E014", seccion: "UROANÁLISIS", examen: "Relación Proteína/Creatinina en orina (UPC)", precio: 20000, tiempo_reporte: "1 día", muestra: "Orina", recipiente: "Jeringa o frasco estéril" },
  { id_examen: "E015", seccion: "COPROLOGÍA", examen: "Coprológico (Directo + Lugol + Flotación)", precio: 12000, tiempo_reporte: "1 día", muestra: "Materia fecal", recipiente: "Frasco tapa rosca estéril" },
  { id_examen: "E016", seccion: "COPROLOGÍA", examen: "Coprograma (Coprológico, azúcares, sangre oculta, pH, Gram, Wright)", precio: 25000, tiempo_reporte: "1 día", muestra: "Materia fecal", recipiente: "Frasco tapa rosca estéril" },
  { id_examen: "E017", seccion: "ANÁLISIS OTRAS MUESTRAS", examen: "Citología vaginal canina (Ciclo estral)", precio: 25000, tiempo_reporte: "1 día", muestra: "Extendido de muestra", recipiente: "Placas portaobjetos (protegidas)" },
  { id_examen: "E018", seccion: "PATOLOGÍA", examen: "Biopsia (Histopatológico de 3 fragmentos de tejido por animal)", precio: 135000, tiempo_reporte: "3-5 días", muestra: "Fragmento de tejido", recipiente: "Frasco con formol al 10%" },
  { id_examen: "E019", seccion: "HORMONAS", examen: "Cortisol en suero (Específico canino)", precio: 59000, tiempo_reporte: "1-2 días", muestra: "a. 500 ul Sangre / b. 500 ul Suero", recipiente: "Tubo tapa roja o amarilla" },
  { id_examen: "E020", seccion: "HORMONAS", examen: "Hormona estimulante de tiroides TSH específica canina", precio: 58000, tiempo_reporte: "1-2 días", muestra: "a. 500 ul Sangre / b. 500 ul Suero", recipiente: "Tubo tapa roja" },
  { id_examen: "E021", seccion: "PERFILES", examen: "Perfil Prequirúrgico 1 (Hemograma, ALT, Creatinina)", precio: 25000, tiempo_reporte: "1 día", muestra: "500 ul Sangre EDTA + 500 ul Sangre total", recipiente: "Tubo lila (EDTA) + Tubo tapa roja" },
  { id_examen: "E022", seccion: "PERFILES", examen: "Perfil Renal 1 (Hemograma + BUN + Urea + Creatinina)", precio: 28000, tiempo_reporte: "1 día", muestra: "500 ul Sangre EDTA + 1 ml Sangre total", recipiente: "Tubo lila (EDTA) + Tubo tapa roja" },
  { id_examen: "E023", seccion: "BIOLOGÍA MOLECULAR", examen: "PCR Hemoparásitos Felino - Tiempo Real (7 patógenos)", precio: 170000, tiempo_reporte: "2-4 días", muestra: "1 ml Sangre Total", recipiente: "Tubo tapa lila (EDTA)" },
  { id_examen: "E024", seccion: "INMUNOLOGÍA", examen: "Distemper Canino", precio: 35000, tiempo_reporte: "1 día", muestra: "Sangre total o Hisopado Ocular/Nasal", recipiente: "Tubo lila, roja o Frasco estéril" },
  { id_examen: "E025", seccion: "TOXICOLOGÍA", examen: "Antidepresivos tricíclicos - TCA", precio: 25000, tiempo_reporte: "1 día", muestra: "Orina", recipiente: "Frasco tapa rosca estéril" }
];

function createDefaultMockDB() {
  const defaultData = {
    Usuarios: [
      {
        id_usuario: "U000",
        nombre: "Administrador Laboratorio",
        identificacion: "00000000",
        usuario: "admin",
        contrasena: "admin123",
        rol: "admin",
        fecha_registro: new Date().toISOString().split('T')[0]
      },
      {
        id_usuario: "U001",
        nombre: "Clínica Veterinaria San Francisco",
        identificacion: "900123456",
        usuario: "sanfrancisco",
        contrasena: "vet123",
        rol: "cliente",
        direccion: "Calle 10 # 5-20, Envigado",
        correo: "contacto@vetsanfrancisco.com",
        telefono: "+57 300 123 4567",
        fecha_registro: new Date().toISOString().split('T')[0]
      }
    ],
    Resultados: [
      {
        id_resultado: "R001",
        id_usuario: "U001",
        nombre_paciente: "Dante (Pastor Alemán)",
        nombre_examen: "Hemograma Completo - Demostración",
        nombre_archivo: "ejemplo_examen.pdf", // archivo por defecto para pruebas
        fecha_subida: new Date().toISOString().split('T')[0],
        observaciones: "Niveles de hemoglobina y plaquetas estables. Se observa leve leucocitosis."
      }
    ],
    Accesos: [],
    Configuracion: {
      gemini_api_key: "CONFIGURAR_DESDE_PANEL_ADMIN"
    },
    Portafolio: defaultPortafolio
  };
  fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(defaultData, null, 2));
}

// Helper para leer base de datos local (Modo Demo)
function readMockDB() {
  try {
    const data = fs.readFileSync(MOCK_DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return { Usuarios: [], Resultados: [], Accesos: [] };
  }
}

// Helper para escribir base de datos local (Modo Demo)
function writeMockDB(data) {
  fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(data, null, 2));
}

/**
 * Realiza una consulta a la API de Google Apps Script.
 * Si la llamada falla (timeout, red caída, Apps Script desconectado), 
 * cae automáticamente al modo local (mock_db.json) para que el sistema
 * siga funcionando sin interrupciones.
 */
async function callSheetsAPI(action, data = {}) {
  if (isDemoMode) {
    return handleMockAction(action, data);
  }

  // Asegurar que el mock_db exista como respaldo
  if (!fs.existsSync(MOCK_DB_PATH)) {
    createDefaultMockDB();
  }

  try {
    const response = await axios.post(GOOGLE_SHEET_URL, {
      apiKey: API_KEY,
      action: action,
      data: data
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000 // 15 segundos de timeout
    });
    return response.data;
  } catch (error) {
    console.warn(`⚠️  Google Sheets no disponible para acción "${action}". Usando base de datos local como respaldo. (${error.message})`);
    // Fallback transparente al mock_db local
    return handleMockAction(action, data);
  }
}

/**
 * Simulador de operaciones de base de datos (Modo Demo)
 */
function handleMockAction(action, data) {
  const db = readMockDB();
  
  switch (action) {
    case 'login': {
      const username = data.username.trim().toLowerCase();
      const password = data.password;
      const user = db.Usuarios.find(u => u.usuario.toLowerCase() === username && u.contrasena === password);
      
      if (user) {
        return { success: true, user };
      }
      return { success: false, message: "Usuario o contraseña incorrectos (Modo Demo)." };
    }
    
    case 'getClients': {
      const clients = db.Usuarios
        .filter(u => u.rol === 'cliente');
      return { success: true, clients };
    }
    
    case 'addClient': {
      const username = data.usuario.trim().toLowerCase();
      const ident = data.identificacion.toString().trim();
      
      if (db.Usuarios.some(u => u.usuario.toLowerCase() === username)) {
        return { success: false, message: "El nombre de usuario ya existe." };
      }
      if (db.Usuarios.some(u => u.identificacion === ident)) {
        return { success: false, message: "Un cliente con esta identificación ya está registrado." };
      }
      
      // Generar ID
      const lastIdNum = db.Usuarios.reduce((max, u) => {
        const num = parseInt(u.id_usuario.substring(1));
        return num > max ? num : max;
      }, 0);
      const nextId = "U" + String(lastIdNum + 1).padStart(3, '0');
      
      const newClient = {
        id_usuario: nextId,
        nombre: data.nombre,
        identificacion: ident,
        usuario: username,
        contrasena: data.contrasena,
        rol: "cliente",
        direccion: data.direccion || "",
        correo: data.correo || "",
        telefono: data.telefono || "",
        fecha_registro: new Date().toISOString().split('T')[0]
      };
      
      db.Usuarios.push(newClient);
      writeMockDB(db);
      return { success: true, message: "Cliente registrado con éxito en modo Demo.", client: { id_usuario: nextId, nombre: data.nombre } };
    }
    
    case 'updateClient': {
      const idUsuario = data.id_usuario;
      const client = db.Usuarios.find(u => u.id_usuario === idUsuario);
      
      if (!client) {
        return { success: false, message: "El cliente especificado no existe." };
      }
      
      if (data.nombre !== undefined) client.nombre = data.nombre;
      if (data.direccion !== undefined) client.direccion = data.direccion;
      if (data.correo !== undefined) client.correo = data.correo;
      if (data.telefono !== undefined) client.telefono = data.telefono;
      if (data.moroso !== undefined) client.moroso = (data.moroso === true || data.moroso === 'true');
      if (data.contrasena !== undefined && data.contrasena.trim() !== "") {
        client.contrasena = data.contrasena;
      }
      
      writeMockDB(db);
      return { success: true, message: "Perfil actualizado correctamente.", user: client };
    }
    
    case 'addResult': {
      const items = Array.isArray(data) ? data : [data];
      let lastIdNum = db.Resultados.reduce((max, r) => {
        const num = parseInt(r.id_resultado.substring(1));
        return num > max ? num : max;
      }, 0);
      
      const addedIds = [];
      const today = new Date().toISOString();
      
      for (const item of items) {
        lastIdNum++;
        const nextId = "R" + String(lastIdNum).padStart(3, '0');
        const newResult = {
          id_resultado: nextId,
          id_usuario: item.id_usuario,
          nombre_paciente: "",
          nombre_examen: item.nombre_examen,
          nombre_archivo: item.nombre_archivo,
          fecha_subida: today,
          observaciones: "",
          admin_id: item.admin_id || "",
          admin_nombre: item.admin_nombre || "",
          retenido: item.retenido || false
        };
        db.Resultados.push(newResult);
        addedIds.push(nextId);
      }
      
      writeMockDB(db);
      return { 
        success: true, 
        message: items.length === 1 
          ? "Examen publicado en base de datos local correctamente." 
          : `${items.length} exámenes publicados en base de datos local correctamente.`, 
        ids: addedIds 
      };
    }
    
    case 'getClientResults': {
      const idCliente = data.id_usuario;
      const results = db.Resultados.filter(r => r.id_usuario === idCliente && !r.retenido);
      const hasRetained = db.Resultados.some(r => r.id_usuario === idCliente && r.retenido);
      results.sort((a, b) => new Date(b.fecha_subida) - new Date(a.fecha_subida));
      return { success: true, results, has_retained: hasRetained };
    }

    case 'deleteResult': {
      const idResultado = data.id_resultado;
      const index = db.Resultados.findIndex(r => r.id_resultado === idResultado);
      if (index !== -1) {
        const fileName = db.Resultados[index].nombre_archivo;
        db.Resultados.splice(index, 1);
        writeMockDB(db);
        return { 
          success: true, 
          message: "Resultado eliminado de la base de datos local.", 
          nombre_archivo: fileName 
        };
      }
      return { success: false, message: "El examen especificado no existe en la base de datos local." };
    }

    case 'deleteAllResults': {
      const deletedFiles = [];
      db.Resultados.forEach(r => {
        if (r.nombre_archivo && r.nombre_archivo !== 'ejemplo_examen.pdf') {
          deletedFiles.push(r.nombre_archivo);
        }
      });
      db.Resultados = [];
      writeMockDB(db);
      return {
        success: true,
        message: "Todos los examenes fueron eliminados de la base de datos local.",
        archivos_eliminados: deletedFiles
      };
    }

    case 'releaseRetainedResults': {
      const clientId = data.id_usuario;
      let count = 0;
      db.Resultados.forEach(r => {
        if (r.id_usuario === clientId && r.retenido) {
          r.retenido = false;
          count++;
        }
      });
      writeMockDB(db);
      return {
        success: true,
        message: count > 0 ? `${count} resultado(s) liberado(s) correctamente.` : 'No había resultados retenidos.',
        released: count
      };
    }
    
    case 'logAccess': {
      const nextId = "L" + String(db.Accesos.length + 1).padStart(5, '0');
      db.Accesos.push({
        id_log: nextId,
        usuario: data.usuario,
        rol: data.rol,
        fecha_hora: new Date().toLocaleString(),
        estado: data.estado
      });
      writeMockDB(db);
      return { success: true };
    }
    case 'getAllResults': {
      const db = readMockDB();
      const userMap = {};
      db.Usuarios.forEach(u => {
        userMap[u.id_usuario] = u.nombre;
      });
      const results = db.Resultados.map(r => ({
        id_resultado: r.id_resultado,
        id_usuario: r.id_usuario,
        nombre_cliente: userMap[r.id_usuario] || r.id_usuario || "Cliente Desconocido",
        nombre_examen: r.nombre_examen,
        nombre_archivo: r.nombre_archivo,
        fecha_subida: r.fecha_subida,
        admin_id: r.admin_id || "",
        admin_nombre: r.admin_nombre || ""
      }));
      results.sort((a, b) => new Date(b.fecha_subida) - new Date(a.fecha_subida));
      return { success: true, results };
    }
    
    case 'addAdmin': {
      const username = data.usuario.trim().toLowerCase();
      
      if (db.Usuarios.some(u => u.usuario.toLowerCase() === username)) {
        return { success: false, message: "El nombre de usuario ya existe." };
      }
      
      // Generar ID
      const lastIdNumA = db.Usuarios.reduce((max, u) => {
        const num = parseInt(u.id_usuario.substring(1));
        return num > max ? num : max;
      }, 0);
      const nextIdA = "U" + String(lastIdNumA + 1).padStart(3, '0');
      
      const newAdmin = {
        id_usuario: nextIdA,
        nombre: data.nombre,
        identificacion: data.identificacion || "00000000",
        usuario: username,
        contrasena: data.contrasena,
        rol: "admin",
        fecha_registro: new Date().toISOString().split('T')[0]
      };
      
      db.Usuarios.push(newAdmin);
      writeMockDB(db);
      return { success: true, message: "Administrador registrado con éxito en modo Demo.", user: { id_usuario: nextIdA, nombre: data.nombre, rol: "admin" } };
    }
    
    case 'deleteClient': {
      const idUsuario = data.id_usuario;
      const clientIndex = db.Usuarios.findIndex(u => u.id_usuario === idUsuario);
      
      if (clientIndex === -1) {
        return { success: false, message: "El cliente especificado no existe en la base de datos local." };
      }
      
      // Eliminar el cliente
      db.Usuarios.splice(clientIndex, 1);
      
      // Buscar todos los exámenes asociados y guardarlos en una lista para borrar los archivos físicos
      const deletedFiles = [];
      db.Resultados = db.Resultados.filter(r => {
        if (r.id_usuario === idUsuario) {
          if (r.nombre_archivo && r.nombre_archivo !== 'ejemplo_examen.pdf') {
            deletedFiles.push(r.nombre_archivo);
          }
          return false; // Eliminar de la base de datos
        }
        return true; // Conservar
      });
      
      writeMockDB(db);
      
      return {
        success: true,
        message: "Cliente y sus exámenes asociados eliminados de la base de datos local.",
        archivos_eliminados: deletedFiles
      };
    }

    case 'getConfig': {
      return { success: true, config: db.Configuracion || {} };
    }
    
    case 'saveConfig': {
      db.Configuracion = db.Configuracion || {};
      for (const key in data) {
        db.Configuracion[key] = data[key];
      }
      writeMockDB(db);
      return { success: true, message: "Configuración guardada correctamente en modo Demo." };
    }

    case 'getPortafolio': {
      if (!db.Portafolio) {
        db.Portafolio = defaultPortafolio;
        writeMockDB(db);
      }
      return { success: true, portafolio: db.Portafolio };
    }
    
    case 'savePortafolioPrecios': {
      db.Portafolio = db.Portafolio || defaultPortafolio;
      const preciosMap = data.precios || {};
      db.Portafolio.forEach(item => {
        if (preciosMap[item.id_examen] !== undefined) {
          item.precio = parseFloat(preciosMap[item.id_examen]);
        }
      });
      writeMockDB(db);
      return { success: true, message: "Precios del portafolio actualizados correctamente en modo Demo." };
    }

    case 'addPortafolioExamen': {
      db.Portafolio = db.Portafolio || defaultPortafolio;
      let maxId = 0;
      db.Portafolio.forEach(item => {
        const num = parseInt(item.id_examen.replace(/[^0-9]/g, '')) || 0;
        if (num > maxId) maxId = num;
      });
      const nextId = "E" + String(maxId + 1).padStart(3, '0');

      const newItem = {
        id_examen: nextId,
        seccion: data.seccion.toUpperCase().trim(),
        examen: data.examen.trim(),
        precio: parseFloat(data.precio) || 0,
        tiempo_reporte: data.tiempo_reporte.trim(),
        muestra: data.muestra.trim(),
        recipiente: data.recipiente.trim()
      };
      
      db.Portafolio.push(newItem);
      writeMockDB(db);
      return { success: true, message: "Examen añadido correctamente en modo Demo.", id_examen: nextId, examen: newItem };
    }

    case 'deletePortafolioExamen': {
      db.Portafolio = db.Portafolio || defaultPortafolio;
      const initialCount = db.Portafolio.length;
      db.Portafolio = db.Portafolio.filter(item => item.id_examen !== data.id_examen);
      
      if (db.Portafolio.length === initialCount) {
        return { success: false, message: "Examen no encontrado." };
      }
      
      writeMockDB(db);
      return { success: true, message: "Examen eliminado correctamente en modo Demo." };
    }

    default:
      return { success: false, message: `Acción desconocida en MockDB: ${action}` };
  }
}

// Funciones exportadas
module.exports = {
  isDemoMode: () => isDemoMode,
  resetDemoDB: () => createDefaultMockDB(),
  login: (username, password) => callSheetsAPI('login', { username, password }),
  getClients: () => callSheetsAPI('getClients'),
  addClient: (clientData) => callSheetsAPI('addClient', clientData),
  addAdmin: (adminData) => callSheetsAPI('addAdmin', adminData),
  updateClient: (clientData) => callSheetsAPI('updateClient', clientData),
  addResult: (resultData) => callSheetsAPI('addResult', resultData),
  getClientResults: (id_usuario) => callSheetsAPI('getClientResults', { id_usuario }),
  releaseRetainedResults: (id_usuario) => callSheetsAPI('releaseRetainedResults', { id_usuario }),
  deleteResult: (id_resultado) => callSheetsAPI('deleteResult', { id_resultado }),
  deleteClient: (id_usuario) => callSheetsAPI('deleteClient', { id_usuario }),
  deleteAllResults: () => callSheetsAPI('deleteAllResults'),
  getAllResults: () => callSheetsAPI('getAllResults'),
  logAccess: (usuario, rol, estado) => callSheetsAPI('logAccess', { usuario, rol, estado }),
  getConfig: () => callSheetsAPI('getConfig'),
  saveConfig: (configData) => callSheetsAPI('saveConfig', configData),
  getPortafolio: () => callSheetsAPI('getPortafolio'),
  savePortafolioPrecios: (preciosData) => callSheetsAPI('savePortafolioPrecios', preciosData),
  addPortafolioExamen: (examenData) => callSheetsAPI('addPortafolioExamen', examenData),
  deletePortafolioExamen: (id_examen) => callSheetsAPI('deletePortafolioExamen', { id_examen })
};
