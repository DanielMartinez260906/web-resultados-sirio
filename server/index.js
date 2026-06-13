require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Habilitar CORS y JSON Parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Asegurar que exista la carpeta de subidas (uploads)
const UPLOADS_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Generar PDF de ejemplo si no existe (para que el modo Demo funcione al instante)
const SAMPLE_PDF_PATH = path.join(UPLOADS_DIR, 'ejemplo_examen.pdf');
if (!fs.existsSync(SAMPLE_PDF_PATH)) {
  // Un archivo PDF minimalista y válido
  const minimalPDF = Buffer.from(
    "%PDF-1.4\n" +
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n" +
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n" +
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n" +
    "5 0 obj\n<< /Length 121 >>\nstream\n" +
    "BT\n" +
    "/F1 18 Tf\n" +
    "70 700 Td\n" +
    "(LABORATORIO CLINICO SIRIO - RESULTADOS) Tj\n" +
    "0 -40 Td\n" +
    "/F1 12 Tf\n" +
    "(Este es un archivo PDF de ejemplo generado para demostracion.) Tj\n" +
    "0 -20 Td\n" +
    "(El sistema de subidas funciona correctamente.) Tj\n" +
    "ET\n" +
    "endstream\nendobj\n" +
    "xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \n0000000250 00000 n \n0000000319 00000 n \n" +
    "trailer\n<< /Size 6 /Root 1 0 R >>\n" +
    "startxref\n507\n%%EOF"
  );
  fs.writeFileSync(SAMPLE_PDF_PATH, minimalPDF);
  console.log('📄 Creado archivo PDF de demostración "ejemplo_examen.pdf" en la carpeta "uploads/".');
}

// Configurar almacenamiento para subidas con Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    // Sanitizar nombre de archivo y añadir timestamp para evitar colisiones
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9]/g, '_'); // Reemplazar caracteres no alfanuméricos
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  }
});

// Filtro para solo aceptar PDFs
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos en formato PDF (.pdf)'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // Límite de 10MB
});

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../public')));

// Servir la carpeta de PDFs subidos con cabeceras de visualización en navegador
app.use('/uploads', express.static(UPLOADS_DIR, {
  setHeaders: function (res, path) {
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'inline'); // Abre en vez de descargar directamente
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

// API: Registrar cliente (Solo Admins)
app.post('/api/admin/clients', async (req, res) => {
  const { nombre, identificacion, usuario, contrasena } = req.body;
  
  if (!nombre || !identificacion || !usuario || !contrasena) {
    return res.status(400).json({ success: false, message: "Todos los campos del cliente son obligatorios." });
  }
  
  try {
    const result = await db.addClient({ nombre, identificacion, usuario, contrasena });
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Subir Examen PDF (Solo Admins)
app.post('/api/admin/upload', upload.single('pdf'), async (req, res) => {
  try {
    const { id_usuario, nombre_paciente, nombre_examen, observaciones } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Por favor, selecciona un archivo PDF válido." });
    }
    
    if (!id_usuario || !nombre_paciente || !nombre_examen) {
      // Borrar el archivo si faltan datos
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: "El ID de usuario (cliente), el nombre del paciente y el nombre del examen son requeridos." });
    }
    
    const nombre_archivo = req.file.filename;
    
    // Registrar en Google Sheets / MockDB
    const result = await db.addResult({
      id_usuario,
      nombre_paciente,
      nombre_examen,
      nombre_archivo,
      observaciones
    });
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: "Examen publicado con éxito.",
        filename: nombre_archivo
      });
    } else {
      // Eliminar el archivo subido si falla el registro en la BD
      fs.unlinkSync(req.file.path);
      res.status(500).json(result);
    }
    
  } catch (error) {
    console.error("Error en subida de PDF:", error);
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

// API: Eliminar Examen PDF (Solo Admins)
app.post('/api/admin/delete-result', async (req, res) => {
  const { id_resultado } = req.body;
  
  if (!id_resultado) {
    return res.status(400).json({ success: false, message: "El ID del resultado es requerido." });
  }
  
  try {
    const result = await db.deleteResult(id_resultado);
    
    if (result.success) {
      // Intentar borrar el archivo físico del servidor local si no es el ejemplo
      if (result.nombre_archivo && result.nombre_archivo !== 'ejemplo_examen.pdf') {
        const filePath = path.join(UPLOADS_DIR, result.nombre_archivo);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Archivo PDF eliminado físicamente: ${result.nombre_archivo}`);
        }
      }
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error("Error al eliminar resultado:", error);
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
