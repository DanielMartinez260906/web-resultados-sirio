require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const webpush = require('web-push');
const db = require('./db');
const { uploadPDF, deletePDF, extractPublicId } = require('./cloudinary');

// Configurar Web Push (VAPID)
let vapidKeys;
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY
  };
} else {
  // Generar llaves al vuelo si no están en el .env
  vapidKeys = webpush.generateVAPIDKeys();
  console.log('\x1b[33m%s\x1b[0m', '⚠️  ADVERTENCIA: VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY no configuradas en el .env.');
  console.log('\x1b[33m%s\x1b[0m', 'Se han generado llaves temporales para esta sesión de desarrollo:');
  console.log('VAPID_PUBLIC_KEY=' + vapidKeys.publicKey);
  console.log('VAPID_PRIVATE_KEY=' + vapidKeys.privateKey);
  console.log('\x1b[33m%s\x1b[0m', 'Guárdalas en tu archivo .env para mantener las suscripciones de los clientes.');
}

let vapidEmail = process.env.VAPID_EMAIL || 'contacto@laboratoriosirio.com';
if (!vapidEmail.startsWith('mailto:') && !vapidEmail.startsWith('https://') && !vapidEmail.startsWith('http://')) {
  vapidEmail = `mailto:${vapidEmail}`;
}

webpush.setVapidDetails(
  vapidEmail,
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

const app = express();
const PORT = process.env.PORT || 3000;

// Habilitar CORS y JSON Parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mantener carpeta uploads solo para compatibilidad local/demo
const UPLOADS_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Verificar configuración de Cloudinary
const cloudinaryConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (cloudinaryConfigured) {
  console.log('\x1b[32m%s\x1b[0m', '☁️  Cloudinary configurado correctamente. Los PDFs se almacenarán en la nube.');
} else {
  console.log('\x1b[33m%s\x1b[0m', '⚠️  Cloudinary NO configurado. Verifica las variables CLOUDINARY_* en el .env.');
}

// Multer: almacenamiento en MEMORIA (buffer), no en disco
// Los archivos van directo a Cloudinary sin tocar el disco del servidor
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos en formato PDF (.pdf)'), false);
  }
};

const upload = multer({
  storage: multer.memoryStorage(),  // Buffer en memoria, no en disco
  fileFilter: fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 } // Límite de 20MB
});

// Middleware para prevenir el almacenamiento en caché de los archivos HTML (para manejo de navegación atrás/adelante)
app.use((req, res, next) => {
  const ext = path.extname(req.path);
  if (ext === '.html' || req.path === '/' || req.path.endsWith('/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../public')));

// Servir uploads locales (solo para archivos legacy o modo demo sin Cloudinary)
app.use('/uploads', express.static(UPLOADS_DIR, {
  setHeaders: function (res, filePath) {
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'inline');
  }
}));

// Almacén de sesiones activas (rastreo de presencia en tiempo real)
const activeSessions = {};

// API: Recibir heartbeat de presencia activa de un usuario
app.post('/api/heartbeat', (req, res) => {
  const { id_usuario, rol } = req.body;
  if (id_usuario) {
    activeSessions[id_usuario] = {
      lastSeen: Date.now(),
      rol: rol || 'client'
    };
  }
  res.json({ success: true });
});

// API: Obtener lista de usuarios activos para administradores
app.get('/api/admin/active-sessions', (req, res) => {
  const now = Date.now();
  const activeList = [];
  
  for (const id in activeSessions) {
    // Si el usuario tuvo actividad en los últimos 30 segundos
    if (now - activeSessions[id].lastSeen < 30000) {
      activeList.push({
        id_usuario: id,
        rol: activeSessions[id].rol
      });
    } else {
      // Limpiar registros antiguos para evitar consumo de memoria
      delete activeSessions[id];
    }
  }
  res.json({ success: true, activeUsers: activeList });
});

// Almacén de conexiones SSE activas por usuario
const sseClients = new Map();

// API: Server-Sent Events para actualización en tiempo real
app.get('/api/client/events', (req, res) => {
  const { id_usuario } = req.query;
  if (!id_usuario) {
    return res.status(400).json({ success: false, message: "id_usuario es requerido" });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Registrar cliente
  if (!sseClients.has(id_usuario)) {
    sseClients.set(id_usuario, []);
  }
  sseClients.get(id_usuario).push(res);
  console.log(`[SSE] Cliente conectado para id_usuario: ${id_usuario}. Total activos: ${sseClients.get(id_usuario).length}`);

  // Ping para mantener la conexión activa (cada 25s para evitar timeouts de proxies/etc.)
  const pingInterval = setInterval(() => {
    res.write('event: ping\ndata: keepalive\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(pingInterval);
    const clients = sseClients.get(id_usuario) || [];
    const idx = clients.indexOf(res);
    if (idx !== -1) {
      clients.splice(idx, 1);
    }
    if (clients.length === 0) {
      sseClients.delete(id_usuario);
    }
    console.log(`[SSE] Cliente desconectado para id_usuario: ${id_usuario}`);
  });
});

// Función para enviar eventos en tiempo real al cliente (SSE)
function sendSSEEvent(id_usuario, eventName, data) {
  const clients = sseClients.get(String(id_usuario));
  if (clients && clients.length > 0) {
    const eventPayload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    clients.forEach(clientRes => {
      try {
        clientRes.write(eventPayload);
      } catch (err) {
        console.error(`[SSE] Error al escribir al cliente para id_usuario ${id_usuario}:`, err.message);
      }
    });
  }
}

// API: Endpoint de Ping para Cron Job / Keep-Alive
app.get('/ping', (req, res) => {
  res.status(200).send('OK');
});

// API: Obtener estado del servidor
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    demoMode: db.isDemoMode(),
    message: db.isDemoMode() ? "Ejecutando en Modo Demo" : "Conectado a Google Sheets"
  });
});

// API: Autenticación
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Usuario y contraseña son requeridos." });
  }
  
  try {
    const result = await db.login(username, password);
    
    if (result.success) {
      // Registrar log de acceso exitoso
      await db.logAccess(username, result.user.rol, "Exitoso");
      res.json(result);
    } else {
      // Registrar log de acceso fallido
      await db.logAccess(username, "desconocido", "Fallido");
      res.status(401).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Obtener clientes (Solo Admins)
app.get('/api/admin/clients', async (req, res) => {
  try {
    const result = await db.getClients();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Registrar usuario (cliente o administrador - Solo Admins)
app.post('/api/admin/users', async (req, res) => {
  const { nombre, identificacion, usuario, contrasena, direccion, correo, telefono, rol } = req.body;
  
  if (!nombre || !usuario || !contrasena) {
    return res.status(400).json({ success: false, message: "Nombre, usuario y contraseña son obligatorios." });
  }

  const rolNormalizado = (rol || 'cliente').toLowerCase().trim();

  try {
    let result;
    if (rolNormalizado === 'admin') {
      // Registrar administrador
      result = await db.addAdmin({ nombre, identificacion: identificacion || '00000000', usuario, contrasena });
    } else {
      // Registrar cliente (requiere identificación)
      if (!identificacion) {
        return res.status(400).json({ success: false, message: "La identificación es obligatoria para registrar un cliente." });
      }
      result = await db.addClient({ nombre, identificacion, usuario, contrasena, direccion, correo, telefono });
    }

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Registrar cliente (Solo Admins) – ruta legacy para compatibilidad
app.post('/api/admin/clients', async (req, res) => {
  const { nombre, identificacion, usuario, contrasena, direccion, correo, telefono } = req.body;
  
  if (!nombre || !identificacion || !usuario || !contrasena) {
    return res.status(400).json({ success: false, message: "Todos los campos obligatorios del cliente deben ser diligenciados." });
  }
  
  try {
    const result = await db.addClient({ nombre, identificacion, usuario, contrasena, direccion, correo, telefono });
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Actualizar perfil de cliente (Solo permitido si lo solicita el Administrador)
app.post('/api/client/update-profile', async (req, res) => {
  const { id_usuario, nombre, direccion, correo, telefono, contrasena, moroso, plan, sirio_credits, ia_trial_expiry, requested_by_admin } = req.body;
  
  if (!id_usuario) {
    return res.status(400).json({ success: false, message: "El ID de usuario es requerido." });
  }

  // Restringir actualización para que solo la pueda ejecutar el rol de admin
  if (!requested_by_admin) {
    return res.status(403).json({ 
      success: false, 
      message: "No tiene permisos para modificar este perfil. Los clientes no pueden editar sus propios datos." 
    });
  }
  
  try {
    const result = await db.updateClient({ id_usuario, nombre, direccion, correo, telefono, contrasena, moroso, plan, sirio_credits, ia_trial_expiry });
    if (result.success) {
      // Si se desmarca como moroso, liberar resultados retenidos automáticamente
      if (moroso === false || moroso === 'false') {
        try {
          const releaseResult = await db.releaseRetainedResults(id_usuario);
          if (releaseResult.success && releaseResult.released > 0) {
            notifyUser(id_usuario, {
              title: 'Resultados Liberados 🔓',
              body: `Tus resultados pendientes han sido liberados y ya están disponibles para consulta.`,
              icon: '/logo.png',
              data: { url: '/client.html' }
            });
            // Enviar evento SSE en tiempo real
            sendSSEEvent(id_usuario, 'new_result', {
              success: true,
              message: 'Resultados liberados'
            });
          }
        } catch (err) {
          console.error("Error al liberar resultados retenidos:", err);
        }
      }
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Función para enviar notificaciones Push a un usuario
async function notifyUser(id_usuario, payloadData) {
  try {
    const subsRes = await db.getSubscriptions(id_usuario);
    if (!subsRes.success || !subsRes.subscriptions || subsRes.subscriptions.length === 0) {
      console.log(`[Push] No hay suscripciones activas para el usuario: ${id_usuario}`);
      return;
    }

    const payload = JSON.stringify(payloadData);

    console.log(`[Push] Enviando notificación a ${subsRes.subscriptions.length} dispositivo(s) del usuario ${id_usuario}...`);
    
    const sendPromises = subsRes.subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payload);
      } catch (err) {
        // Si la suscripción ha expirado o ya no es válida (código 410 o 404), la eliminamos
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.warn(`[Push] Suscripción expirada. Eliminando: ${sub.endpoint}`);
          await db.deleteSubscription(id_usuario, sub.endpoint).catch(e => {});
        } else {
          console.error('[Push] Error al enviar notificación a dispositivo:', err.message);
        }
      }
    });

    await Promise.all(sendPromises);
  } catch (error) {
    console.error('[Push] Error en proceso de notificación:', error);
  }
}

// API: Subir Examen PDF a Cloudinary (Solo Admins)
app.post('/api/admin/upload', upload.array('pdf', 20), async (req, res) => {
  try {
    const { id_usuario, admin_id, admin_nombre } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "Por favor, selecciona al menos un archivo PDF válido." });
    }

    if (!id_usuario) {
      return res.status(400).json({ success: false, message: "El ID de usuario (cliente) es requerido." });
    }

    // Verificar si el cliente es moroso para marcar resultados como retenidos
    let clienteEsMoroso = false;
    const clientsRes = await db.getClients();
    if (clientsRes.success) {
      const client = clientsRes.clients.find(c => c.id_usuario === id_usuario);
      if (client && client.moroso) {
        clienteEsMoroso = true;
      }
    }

    if (!cloudinaryConfigured) {
      return res.status(500).json({ success: false, message: "El almacenamiento en la nube no está configurado. Contacta al administrador." });
    }

    // Subir cada PDF a Cloudinary en paralelo
    const uploadPromises = req.files.map(async (file) => {
      // Corregir codificación incorrecta de caracteres especiales (ej: Ñ, tildes) en Multer
      let originalNameCorrected = file.originalname;
      try {
        originalNameCorrected = Buffer.from(file.originalname, 'latin1').toString('utf8');
      } catch (err) {
        console.error('Error al decodificar originalname:', err);
      }

      // Generar un public_id único y limpio
      const timestamp = Date.now();
      const safeName = originalNameCorrected
        .replace(/\.pdf$/i, '')
        .replace(/[^a-zA-Z0-9_\-]/g, '_')
        .substring(0, 60);
      const publicId = `${id_usuario}_${safeName}_${timestamp}`;

      const cloudResult = await uploadPDF(file.buffer, publicId);
      return {
        originalname: originalNameCorrected,
        cloudinary_url: cloudResult.secure_url,
        public_id: cloudResult.public_id
      };
    });

    const uploadedFiles = await Promise.all(uploadPromises);

    // Crear lote de registros — nombre_archivo ahora es la URL de Cloudinary
    const resultsData = uploadedFiles.map(f => ({
      id_usuario:     id_usuario,
      nombre_paciente: '',
      nombre_examen:  f.originalname,
      nombre_archivo: f.cloudinary_url,  // URL completa de Cloudinary
      observaciones:  '',
      admin_id:       admin_id || '',
      admin_nombre:   admin_nombre || '',
      retenido:       clienteEsMoroso
    }));

    // Registrar en Google Sheets / MockDB
    const result = await db.addResult(resultsData);

    if (result.success) {
      console.log(`☁️  ${uploadedFiles.length} PDF(s) subidos a Cloudinary correctamente.`);
      
      // Enviar evento SSE en tiempo real al cliente
      sendSSEEvent(id_usuario, 'new_result', {
        success: true,
        message: 'Nuevos resultados cargados',
        count: resultsData.length
      });

      // Enviar notificación Push (sin bloquear la respuesta HTTP)
      if (!clienteEsMoroso) {
        notifyUser(id_usuario, {
          title: 'Nuevo Resultado Disponible 🧪',
          body: resultsData.length === 1 
            ? `Se ha publicado el resultado de tu examen: ${resultsData[0].nombre_examen}`
            : `Has recibido ${resultsData.length} nuevos resultados de exámenes.`,
          icon: '/logo.png',
          data: { url: '/client.html' }
        });
      }

      const morosoNote = clienteEsMoroso ? ' (retenidos hasta que el cliente esté al día)' : '';
      res.status(200).json({
        success: true,
        retenido: clienteEsMoroso,
        message: req.files.length === 1
          ? `Examen publicado con éxito${morosoNote}.`
          : `${req.files.length} exámenes publicados con éxito${morosoNote}.`,
        filenames: uploadedFiles.map(f => f.cloudinary_url)
      });
    } else {
      // Si falla el registro en BD, eliminar los archivos ya subidos a Cloudinary
      for (const f of uploadedFiles) {
        await deletePDF(f.public_id);
      }
      res.status(500).json(result);
    }

  } catch (error) {
    console.error('Error en subida de PDFs a Cloudinary:', error);
    res.status(500).json({ success: false, message: `Error al subir archivos: ${error.message}` });
  }
});

// ============================================================
// ENDPOINTS PARA NOTIFICACIONES PUSH (WEB PUSH)
// ============================================================

// API: Obtener clave pública VAPID
app.get('/api/push/key', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

// API: Suscribirse a notificaciones
app.post('/api/push/subscribe', async (req, res) => {
  const { id_usuario, subscription } = req.body;

  if (!id_usuario || !subscription) {
    return res.status(400).json({ success: false, message: 'El ID de usuario y el objeto de suscripción son obligatorios.' });
  }

  try {
    const result = await db.saveSubscription(id_usuario, subscription);
    res.json(result);
  } catch (error) {
    console.error('Error al guardar suscripción push:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Desuscribirse de notificaciones
app.post('/api/push/unsubscribe', async (req, res) => {
  const { id_usuario, endpoint } = req.body;

  if (!id_usuario || !endpoint) {
    return res.status(400).json({ success: false, message: 'El ID de usuario y el endpoint son obligatorios.' });
  }

  try {
    const result = await db.deleteSubscription(id_usuario, endpoint);
    res.json(result);
  } catch (error) {
    console.error('Error al eliminar suscripción push:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Enviar notificación de prueba (Para depuración/verificación de clientes)
app.post('/api/push/test', async (req, res) => {
  const { id_usuario } = req.body;
  if (!id_usuario) {
    return res.status(400).json({ success: false, message: 'El ID de usuario es obligatorio.' });
  }

  try {
    await notifyUser(id_usuario, {
      title: 'Notificación de Prueba 🧪',
      body: '¡Hola! Las notificaciones del Laboratorio SIRIO están activas y listas en este dispositivo.',
      icon: '/logo.png',
      data: { url: '/client.html' }
    });
    res.json({ success: true, message: 'Notificación de prueba enviada.' });
  } catch (error) {
    console.error('Error al enviar notificación de prueba:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Obtener perfil de un cliente (Para verificar el plan/créditos más recientes)
app.get('/api/client/profile', async (req, res) => {
  const { id_usuario } = req.query;
  if (!id_usuario) {
    return res.status(400).json({ success: false, message: 'El ID de usuario es requerido.' });
  }

  try {
    const clientsRes = await db.getClients();
    const user = clientsRes.success ? clientsRes.clients.find(c => c.id_usuario === id_usuario) : null;
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Obtener exámenes (Para Clientes)
app.get('/api/client/results', async (req, res) => {
  const { id_usuario } = req.query;
  
  if (!id_usuario) {
    return res.status(400).json({ success: false, message: "ID de usuario requerido." });
  }
  
  try {
    const result = await db.getClientResults(id_usuario);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Ingresar Paciente (Para Clientes)
app.post('/api/client/ingresar-paciente', async (req, res) => {
  const { 
    id_usuario, veterinaria, medico, propietario, paciente_nombre, especie, raza, edad, sexo, 
    tipo_muestra, examenes_solicitados, otros_examenes, observaciones, 
    direccion_recoleccion, contacto_recoleccion, quien_diligencia, 
    datos_especiales_tipo, datos_especiales_detalle 
  } = req.body;

  if (!id_usuario || !paciente_nombre || !especie || !sexo) {
    return res.status(400).json({ success: false, message: "Los campos de usuario, nombre de paciente, especie y sexo son requeridos." });
  }

  try {
    const configRes = await db.getConfig();
    const config = configRes.config || {};
    if (config.ingreso_pacientes_visible === 'false' || config.ingreso_pacientes_visible === false) {
      return res.status(403).json({
        success: false,
        message: "El ingreso de pacientes se encuentra inhabilitado por el momento. Por favor comuníquese directamente con el laboratorio."
      });
    }

    const result = await db.ingresarPaciente({
      id_usuario, veterinaria, medico, propietario, paciente_nombre, especie, raza, edad, sexo,
      tipo_muestra, examenes_solicitados, otros_examenes, observaciones,
      direccion_recoleccion, contacto_recoleccion, quien_diligencia,
      datos_especiales_tipo, datos_especiales_detalle
    });
    
    if (result.success) {
      if (!result.codigo_registro) {
        result.codigo_registro = "218" + Math.floor(1000 + Math.random() * 9000);
      }
      if (!result.fecha) {
        const now = new Date();
        result.fecha = now.toLocaleString('es-CO', { 
          timeZone: 'America/Bogota',
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
      }
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Obtener todos los exámenes (Solo Admins)
app.get('/api/admin/results', async (req, res) => {
  try {
    const result = await db.getAllResults();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Eliminar Examen PDF (Solo Admins)
app.post('/api/admin/delete-result', async (req, res) => {
  const { id_resultado } = req.body;

  if (!id_resultado) {
    return res.status(400).json({ success: false, message: 'El ID del resultado es requerido.' });
  }

  try {
    const result = await db.deleteResult(id_resultado);

    if (result.success) {
      const archivo = result.nombre_archivo || '';

      if (archivo && archivo.includes('cloudinary.com')) {
        // Archivo en Cloudinary: eliminarlo por su public_id
        const publicId = extractPublicId(archivo);
        if (publicId) await deletePDF(publicId);
      } else if (archivo && archivo !== 'ejemplo_examen.pdf') {
        // Archivo local legacy: eliminar del disco
        const filePath = path.join(UPLOADS_DIR, archivo);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Archivo local eliminado: ${archivo}`);
        }
      }

      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error al eliminar resultado:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Eliminar Exámenes Seleccionados (Masivo - Solo Admins)
app.post('/api/admin/delete-results-bulk', async (req, res) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, message: 'Se requiere una lista de IDs de resultados para eliminar.' });
  }

  try {
    const result = await db.deleteResultsBulk(ids);

    if (result.success) {
      const archivos = result.archivos_eliminados || [];
      for (const archivo of archivos) {
        if (archivo && archivo.includes('cloudinary.com')) {
          const publicId = extractPublicId(archivo);
          if (publicId) await deletePDF(publicId);
        } else if (archivo && archivo !== 'ejemplo_examen.pdf') {
          const filePath = path.join(UPLOADS_DIR, archivo);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Archivo local eliminado en lote: ${archivo}`);
          }
        }
      }
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error al eliminar resultados en lote:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Eliminar Exámenes por Rango de Fechas (Solo Admins)
app.post('/api/admin/delete-results-range', async (req, res) => {
  const { fecha_inicio, fecha_fin } = req.body;

  if (!fecha_inicio || !fecha_fin) {
    return res.status(400).json({ success: false, message: 'Las fechas de inicio y fin son requeridas.' });
  }

  try {
    const result = await db.deleteResultsRange(fecha_inicio, fecha_fin);

    if (result.success) {
      const archivos = result.archivos_eliminados || [];
      for (const archivo of archivos) {
        if (archivo && archivo.includes('cloudinary.com')) {
          const publicId = extractPublicId(archivo);
          if (publicId) await deletePDF(publicId);
        } else if (archivo && archivo !== 'ejemplo_examen.pdf') {
          const filePath = path.join(UPLOADS_DIR, archivo);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Archivo local eliminado por rango de fechas: ${archivo}`);
          }
        }
      }
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error al eliminar resultados por rango de fechas:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Eliminar Cliente e Historial Asociado (Solo Admins)
app.post('/api/admin/delete-client', async (req, res) => {
  const { id_usuario } = req.body;

  if (!id_usuario) {
    return res.status(400).json({ success: false, message: 'El ID de usuario es requerido.' });
  }

  try {
    const result = await db.deleteClient(id_usuario);

    if (result.success) {
      let deleteCount = 0;
      if (result.archivos_eliminados && Array.isArray(result.archivos_eliminados)) {
        for (const archivo of result.archivos_eliminados) {
          if (!archivo || archivo === 'ejemplo_examen.pdf') continue;

          if (archivo.includes('cloudinary.com')) {
            const publicId = extractPublicId(archivo);
            if (publicId) {
              await deletePDF(publicId);
              deleteCount++;
            }
          } else {
            const filePath = path.join(UPLOADS_DIR, archivo);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              deleteCount++;
            }
          }
        }
        console.log(`🗑️ Se eliminaron ${deleteCount} archivos del cliente ${id_usuario}.`);
      }

      res.json({
        success: true,
        message: result.message || `Cliente eliminado correctamente. Se borraron ${deleteCount} archivos PDF.`
      });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error al eliminar cliente:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Obtener personal del laboratorio (Solo Admins)
app.get('/api/admin/staff', async (req, res) => {
  try {
    const result = await db.getAdmins();
    res.json(result);
  } catch (error) {
    console.error('Error al obtener personal:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Actualizar perfil de personal del laboratorio (Solo Admins)
app.post('/api/admin/staff/update', async (req, res) => {
  const { id_usuario, nombre, identificacion, contrasena, rol } = req.body;
  if (!id_usuario) {
    return res.status(400).json({ success: false, message: 'El ID de usuario es requerido.' });
  }
  try {
    const result = await db.updateAdmin({ id_usuario, nombre, identificacion, contrasena, rol });
    res.json(result);
  } catch (error) {
    console.error('Error al actualizar personal:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Eliminar personal del laboratorio (Solo Admins)
app.post('/api/admin/staff/delete', async (req, res) => {
  const { id_usuario, active_user_id } = req.body;
  if (!id_usuario) {
    return res.status(400).json({ success: false, message: 'El ID de usuario es requerido.' });
  }

  // Evitar que el administrador principal o la cuenta activa se auto-elimine
  if (id_usuario === 'U000') {
    return res.status(400).json({ success: false, message: 'No se puede eliminar la cuenta del administrador principal (U000).' });
  }
  if (active_user_id && id_usuario === active_user_id) {
    return res.status(400).json({ success: false, message: 'No puedes eliminar tu propio perfil mientras tienes la sesión activa.' });
  }

  try {
    const result = await db.deleteAdmin(id_usuario);
    res.json(result);
  } catch (error) {
    console.error('Error al eliminar personal:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Eliminar todos los exámenes y sus PDFs (Solo Admins)
app.post('/api/admin/delete-all-results', async (req, res) => {
  try {
    const result = await db.deleteAllResults();

    if (result.success) {
      let deleteCount = 0;
      if (result.archivos_eliminados && Array.isArray(result.archivos_eliminados)) {
        for (const archivo of result.archivos_eliminados) {
          if (!archivo || archivo === 'ejemplo_examen.pdf') continue;

          if (archivo.includes('cloudinary.com')) {
            const publicId = extractPublicId(archivo);
            if (publicId) {
              await deletePDF(publicId);
              deleteCount++;
            }
          } else {
            const filePath = path.join(UPLOADS_DIR, archivo);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              deleteCount++;
            }
          }
        }
        console.log(`🗑️ Se eliminaron ${deleteCount} archivos del servidor/nube.`);
      }
      res.json({
        success: true,
        message: `Se eliminaron todos los exámenes del portal (${deleteCount} archivos borrados).`
      });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error al eliminar todos los resultados:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// ENDPOINT DE DESCARGA (PROXY)
// ============================================================

// API: Descarga forzada de PDF a través del servidor (evita restricción CORS de Cloudinary)
app.get('/api/client/download', async (req, res) => {
  const { url, nombre } = req.query;

  if (!url) {
    return res.status(400).json({ success: false, message: 'Falta el parámetro url.' });
  }

  try {
    const response = await axios.get(decodeURIComponent(url), { responseType: 'stream' });

    // Nombre de archivo para la descarga
    const filename = nombre ? decodeURIComponent(nombre) : 'resultado_examen.pdf';
    const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);

    response.data.pipe(res);
  } catch (error) {
    console.error('Error al descargar PDF:', error.message);
    res.status(500).json({ success: false, message: 'No se pudo descargar el archivo.' });
  }
});

// ============================================================
// ENDPOINTS DE CONFIGURACIÓN Y GEMINI IA
// ============================================================

// API: Obtener el tema estacional activo (Público para Clientes y Admins)
app.get('/api/client/theme', async (req, res) => {
  try {
    const configRes = await db.getConfig();
    const config = configRes.config || {};
    res.json({ success: true, theme: config.seasonal_theme || 'default' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Obtener configuraciones del sistema (Solo Admins)
app.get('/api/admin/config', async (req, res) => {
  try {
    const result = await db.getConfig();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Guardar configuraciones del sistema (Solo Admins)
app.post('/api/admin/config', async (req, res) => {
  const configData = req.body;
  if (!configData || typeof configData !== 'object') {
    return res.status(400).json({ success: false, message: 'Los datos de configuración son requeridos.' });
  }

  try {
    const result = await db.saveConfig(configData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Obtener estado de configuración pública (Para Clientes)
app.get('/api/client/config', async (req, res) => {
  try {
    const configRes = await db.getConfig();
    const config = configRes.config || {};
    res.json({
      success: true,
      portafolio_visible: config.portafolio_visible !== 'false',
      ingreso_pacientes_visible: config.ingreso_pacientes_visible !== 'false',
      seasonal_theme: config.seasonal_theme || 'default'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Enviar Ticket de Soporte Técnico (Para Clientes)
app.post('/api/client/soporte', async (req, res) => {
  const { id_usuario, nombre_cliente, usuario, nombre_contacto, tipo, asunto, mensaje } = req.body;

  if (!asunto || !asunto.trim() || !mensaje || !mensaje.trim()) {
    return res.status(400).json({ success: false, message: "El asunto y el detalle de la consulta o error son requeridos." });
  }

  try {
    const result = await db.createSupportTicket({
      id_usuario: id_usuario || "",
      nombre_cliente: nombre_cliente || "",
      usuario: usuario || "",
      nombre_contacto: nombre_contacto || nombre_cliente || "",
      tipo: tipo || "General",
      asunto: asunto.trim(),
      mensaje: mensaje.trim()
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Obtener Tickets de Soporte (Solo Admins)
app.get('/api/admin/soporte', async (req, res) => {
  try {
    const result = await db.getSupportTickets();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Actualizar estado de un Ticket de Soporte (Solo Admins)
app.patch('/api/admin/soporte/:id', async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  const VALID_STATES = ['Pendiente', 'En Proceso', 'Resuelto'];
  if (!estado || !VALID_STATES.includes(estado)) {
    return res.status(400).json({ success: false, message: `Estado inválido. Use: ${VALID_STATES.join(', ')}` });
  }
  try {
    const result = await db.updateSupportTicketStatus(id, estado);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Eliminar un Ticket de Soporte (Solo Admins)
app.delete('/api/admin/soporte/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.deleteSupportTicket(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// API: Obtener el portafolio de servicios (Para Admins y Clientes)
app.get('/api/client/portafolio', async (req, res) => {
  try {
    const result = await db.getPortafolio();
    const configRes = await db.getConfig();
    const config = configRes.config || {};
    const visible = config.portafolio_visible !== 'false';
    const customCats = config.categorias_adicionales ? config.categorias_adicionales.split(',') : [];
    res.json({
      success: result.success,
      portafolio: result.portafolio,
      visible: visible,
      categorias_adicionales: customCats
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Cambiar visibilidad del portafolio (Solo Admins)
app.post('/api/admin/portafolio/visibility', async (req, res) => {
  const { visible } = req.body;
  try {
    const result = await db.saveConfig({ portafolio_visible: String(visible) });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Guardar los precios del portafolio (Solo Admins)
app.post('/api/admin/portafolio/precios', async (req, res) => {
  const preciosData = req.body;
  if (!preciosData || !preciosData.precios) {
    return res.status(400).json({ success: false, message: 'Se requiere el mapa de precios.' });
  }
  try {
    const result = await db.savePortafolioPrecios(preciosData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Añadir examen al portafolio (Solo Admins)
app.post('/api/admin/portafolio/add', async (req, res) => {
  const examData = req.body;
  if (!examData || !examData.examen || !examData.seccion) {
    return res.status(400).json({ success: false, message: 'El nombre del examen y la sección son obligatorios.' });
  }
  try {
    const result = await db.addPortafolioExamen(examData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Eliminar examen del portafolio (Solo Admins)
app.post('/api/admin/portafolio/delete', async (req, res) => {
  const { id_examen } = req.body;
  if (!id_examen) {
    return res.status(400).json({ success: false, message: 'Se requiere el id_examen.' });
  }
  try {
    const result = await db.deletePortafolioExamen(id_examen);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Añadir categoría al portafolio (Solo Admins)
app.post('/api/admin/portafolio/category', async (req, res) => {
  const { category } = req.body;
  if (!category || !category.trim()) {
    return res.status(400).json({ success: false, message: 'El nombre de la categoría es obligatorio.' });
  }
  try {
    const configRes = await db.getConfig();
    const config = configRes.config || {};
    let customCats = config.categorias_adicionales ? config.categorias_adicionales.split(',') : [];
    
    const newCat = category.toUpperCase().trim();
    if (!customCats.includes(newCat)) {
      customCats.push(newCat);
      await db.saveConfig({ categorias_adicionales: customCats.join(',') });
    }
    
    res.json({ success: true, message: 'Categoría añadida exitosamente.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Interpretar examen con IA de Gemini (Para Clientes)
app.post('/api/client/interpret-exam', async (req, res) => {
  const { id_resultado, nombre_archivo, id_usuario } = req.body;

  if (!id_resultado || !nombre_archivo) {
    return res.status(400).json({ success: false, message: 'El ID del resultado y el archivo son requeridos.' });
  }

  try {
    // 1. Obtener la clave API de Gemini desde la base de datos
    const configResult = await db.getConfig();
    const geminiApiKey = configResult.success && configResult.config ? configResult.config.gemini_api_key : null;

    if (!geminiApiKey || geminiApiKey.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'La Inteligencia Artificial de Gemini no está configurada. El administrador debe guardar una clave API de Google AI Studio en la pestaña Configuración del panel de administración.' 
      });
    }

    // 2. Descargar o leer el archivo PDF en un buffer
    let pdfBuffer;
    if (nombre_archivo.startsWith('http://') || nombre_archivo.startsWith('https://')) {
      // Descargar de Cloudinary
      const downloadRes = await axios.get(nombre_archivo, { responseType: 'arraybuffer' });
      pdfBuffer = Buffer.from(downloadRes.data);
    } else {
      // Leer archivo local legacy o de demostración
      const filePath = path.join(UPLOADS_DIR, nombre_archivo);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'El archivo PDF no se encuentra disponible localmente en el servidor.' });
      }
      pdfBuffer = fs.readFileSync(filePath);
    }

    // 3. Convertir el buffer a Base64
    const base64Pdf = pdfBuffer.toString('base64');

    // 4. Preparar el prompt y payload para Gemini API
    const promptText = `Eres SirIA, el asistente de apoyo interpretativo del Laboratorio Clínico SIRIO para médicos veterinarios.

Analiza el PDF de resultados de laboratorio adjunto y genera un informe interpretativo COMPLETO dirigido exclusivamente al Médico Veterinario Tratante. IMPORTANTE: escribe el informe completo sin truncarlo, sin resúmenes parciales ni interrupciones.

USA EL SIGUIENTE FORMATO EXACTO (con negritas y guiones, NO con # o ## o ###):

---
Estimado/a Médico Veterinario Tratante,
[Saludo breve y presentación del informe]

---
**1. RESUMEN CLÍNICO**
[Síntesis clara de los parámetros evaluados, especie, tipo de examen y hallazgos generales]

---
**2. HALLAZGOS DE RELEVANCIA DIAGNÓSTICA**
[Análisis detallado de CADA valor alterado fuera del rango de referencia. Explica su significado clínico, causas probables y diagnósticos diferenciales relevantes para la especie]

---
**3. CONSIDERACIONES CLÍNICAS**
[Recomendaciones específicas de exámenes complementarios, seguimiento o monitorización para el caso]

---
**AVISO IMPORTANTE:** *Este reporte es un apoyo tecnológico automatizado generado por SirIA. Laboratorio SIRIO no presta asesoría veterinaria directa. La responsabilidad final del diagnóstico y plan terapéutico recae únicamente en el profesional de la salud veterinaria a cargo del paciente.*

Responde siempre en español. Sé riguroso, completo y profesional. No omitas ninguna sección.`;

    const payload = {
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: 'application/pdf',
                data: base64Pdf
              }
            },
            {
              text: promptText
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192
      }
    };

    // 5. Lista de modelos a intentar en orden de velocidad y disponibilidad
    const modelsToTry = [
      'gemini-2.0-flash',
      'gemini-2.5-flash',
      'gemini-1.5-flash'
    ];

    let interpretationText = null;
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;
        const response = await axios.post(geminiUrl, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 55000 // 55 segundos por intento
        });

        const candidate = response.data?.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text;
        if (text && text.trim().length > 0) {
          interpretationText = text;
          console.log(`✅ Interpretación exitosa con modelo: ${modelName}`);
          break;
        }
      } catch (err) {
        lastError = err;
        const status = err.response?.status;
        const errDetail = err.response?.data?.error?.message || err.message;
        console.warn(`⚠️ Modelo ${modelName} falló [HTTP ${status || 'N/A'}]: ${errDetail}`);
        // Si el error es de API key inválida (401/403), no seguir intentando
        if (status === 400 && errDetail && errDetail.toLowerCase().includes('api key')) break;
        if (status === 403) break;
      }
    }

    if (!interpretationText) {
      const status = lastError?.response?.status;
      const errDetail = lastError?.response?.data?.error?.message || lastError?.message || 'Error desconocido';
      console.error(`❌ Error Gemini tras probar todos los modelos. Último error [HTTP ${status || 'N/A'}]: ${errDetail}`);

      let customMsg = 'Hubo un inconveniente temporal con el servicio de Inteligencia Artificial. Por favor inténtalo de nuevo en unos minutos.';

      if (status === 400 && errDetail.toLowerCase().includes('api key')) {
        customMsg = 'La clave API de Gemini configurada no es válida o ha expirado. El administrador debe actualizar la clave en Configuración.';
      } else if (status === 403) {
        customMsg = 'Acceso denegado al servicio de IA. Verifica que la clave API tenga los permisos correctos en Google AI Studio.';
      } else if (status === 429) {
        customMsg = 'Se alcanzó el límite de solicitudes de la IA. Por favor espera unos minutos antes de intentarlo de nuevo.';
      } else if (lastError?.code === 'ECONNABORTED' || errDetail.includes('timeout')) {
        customMsg = 'El análisis del examen tomó más tiempo del esperado. Por favor inténtalo de nuevo (PDFs muy grandes pueden tardar más).';
      } else if (status === 503 || status === 500) {
        customMsg = 'El servicio de Google Gemini está temporalmente no disponible. Inténtalo de nuevo en unos minutos.';
      }

      return res.status(503).json({ success: false, message: customMsg });
    }

    res.json({
      success: true,
      interpretation: interpretationText
    });

  } catch (error) {
    console.error('Error general al interpretar el examen:', error);
    res.status(500).json({
      success: false,
      message: 'Hubo un error al procesar la interpretación del examen. Estamos trabajando en resolverlo, por favor inténtalo de nuevo más tarde.'
    });
  }
});

// Manejo de errores de Multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: `Error de subida: ${err.message}` });
  } else if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log('\x1b[36m%s\x1b[0m', '--------------------------------------------------');
  console.log('\x1b[32m%s\x1b[0m', `🚀 Servidor SIRIO ejecutándose en: http://localhost:${PORT}`);
  console.log('\x1b[36m%s\x1b[0m', '--------------------------------------------------');
});
