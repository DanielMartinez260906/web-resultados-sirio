require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const { uploadPDF, deletePDF, extractPublicId } = require('./cloudinary');

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

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../public')));

// Servir uploads locales (solo para archivos legacy o modo demo sin Cloudinary)
app.use('/uploads', express.static(UPLOADS_DIR, {
  setHeaders: function (res, filePath) {
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'inline');
  }
}));

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
  const { id_usuario, nombre, direccion, correo, telefono, contrasena, requested_by_admin } = req.body;
  
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
    const result = await db.updateClient({ id_usuario, nombre, direccion, correo, telefono, contrasena });
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

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

    if (!cloudinaryConfigured) {
      return res.status(500).json({ success: false, message: "El almacenamiento en la nube no está configurado. Contacta al administrador." });
    }

    // Subir cada PDF a Cloudinary en paralelo
    const uploadPromises = req.files.map(async (file) => {
      // Generar un public_id único y limpio
      const timestamp = Date.now();
      const safeName = file.originalname
        .replace(/\.pdf$/i, '')
        .replace(/[^a-zA-Z0-9_\-]/g, '_')
        .substring(0, 60);
      const publicId = `${id_usuario}_${safeName}_${timestamp}`;

      const cloudResult = await uploadPDF(file.buffer, publicId);
      return {
        originalname: file.originalname,
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
      admin_nombre:   admin_nombre || ''
    }));

    // Registrar en Google Sheets / MockDB
    const result = await db.addResult(resultsData);

    if (result.success) {
      console.log(`☁️  ${uploadedFiles.length} PDF(s) subidos a Cloudinary correctamente.`);
      res.status(200).json({
        success: true,
        message: req.files.length === 1
          ? 'Examen publicado con éxito.'
          : `${req.files.length} exámenes publicados con éxito.`,
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
