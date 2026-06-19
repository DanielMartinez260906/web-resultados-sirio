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
    Accesos: []
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
 * Realiza una consulta a la API de Google Apps Script
 */
async function callSheetsAPI(action, data = {}) {
  if (isDemoMode) {
    return handleMockAction(action, data);
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
      timeout: 10000 // 10 segundos de timeout
    });
    return response.data;
  } catch (error) {
    console.error(`Error en llamada a Sheets API (${action}):`, error.message);
    return { 
      success: false, 
      message: `Error al conectar con Google Sheets: ${error.message}. ¿Has iniciado tu servidor web del Apps Script y publicado la URL correctamente?`
    };
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
        const { contrasena, ...safeUser } = user;
        return { success: true, user: safeUser };
      }
      return { success: false, message: "Usuario o contraseña incorrectos (Modo Demo)." };
    }
    
    case 'getClients': {
      const clients = db.Usuarios
        .filter(u => u.rol === 'cliente')
        .map(({ contrasena, ...c }) => c);
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
        fecha_registro: new Date().toISOString().split('T')[0]
      };
      
      db.Usuarios.push(newClient);
      writeMockDB(db);
      return { success: true, message: "Cliente registrado con éxito en modo Demo.", client: { id_usuario: nextId, nombre: data.nombre } };
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
          admin_nombre: item.admin_nombre || ""
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
      const results = db.Resultados.filter(r => r.id_usuario === idCliente);
      results.sort((a, b) => new Date(b.fecha_subida) - new Date(a.fecha_subida));
      return { success: true, results };
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
  addResult: (resultData) => callSheetsAPI('addResult', resultData),
  getClientResults: (id_usuario) => callSheetsAPI('getClientResults', { id_usuario }),
  deleteResult: (id_resultado) => callSheetsAPI('deleteResult', { id_resultado }), // Exportado
  getAllResults: () => callSheetsAPI('getAllResults'),
  logAccess: (usuario, rol, estado) => callSheetsAPI('logAccess', { usuario, rol, estado })
};
