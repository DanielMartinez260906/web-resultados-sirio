require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const streamifier= require('streamifier');
const cloudinary = require('cloudinary').v2;
const db         = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Configurar Cloudinary ────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const cloudinaryEnabled =
  process.env.CLOUDINARY_CLOUD_NAME &&
  !process.env.CLOUDINARY_CLOUD_NAME.includes('xxxxxxxxx');

if (cloudinaryEnabled) {
  console.log('\x1b[32m%s\x1b[0m', '☁️  Cloudinary configurado correctamente.');
} else {
  console.log('\x1b[33m%s\x1b[0m', '⚠️  Cloudinary NO configurado. Los PDFs se guardarán localmente.');
}

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Carpeta local de subidas (fallback si Cloudinary no está activo) ─────────
const UPLOADS_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ── PDF de ejemplo para modo Demo ────────────────────────────────────────────
const SAMPLE_PDF_PATH = path.join(UPLOADS_DIR, 'ejemplo_examen.pdf');
if (!fs.existsSync(SAMPLE_PDF_PATH)) {
  const minimalPDF = Buffer.from(
    "%PDF-1.4\n" +
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n" +
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n" +
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n" +
    "5 0 obj\n<< /Length 121 >>\nstream\nBT\n/F1 18 Tf\n70 700 Td\n(LABORATORIO CLINICO SIRIO - RESULTADOS) Tj\n0 -40 Td\n/F1 12 Tf\n(Archivo de ejemplo.) Tj\nET\nendstream\nendobj\n" +
    "xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \n0000000250 00000 n \n0000000319 00000 n \n" +
    "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n507\n%%EOF"
  );
  fs.writeFileSync(SAMPLE_PDF_PATH, minimalPDF);
}

// ── Multer: memoria (el buffer se sube a Cloudinary) ─────────────────────────
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos PDF (.pdf)'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

// ── Helper: subir buffer a Cloudinary ────────────────────────────────────────
function uploadToCloudinary(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder:        'sirio-resultados',
        public_id:     publicId,
        resource_type: 'raw',          // PDFs son "raw" en Cloudinary
        format:        'pdf',
        overwrite:     false
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

// ── Servir archivos estáticos ────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(UPLOADS_DIR, {
  setHeaders: (res) => {
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'inline');
  }
}));

// ── API: Estado del servidor ─────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({
    success:          true,
    demoMode:         db.isDemoMode(),
    cloudinaryActive: cloudinaryEnabled,
    message:          db.isDemoMode() ? 'Modo Demo activo' : 'Conectado a Google Sheets'
  });
});

// ── API: Login ───────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ success: false, message: 'Usuario y contraseña requeridos.' });

  try {
    const result = await db.login(username, password);
    if (result.success) {
      await db.logAccess(username, result.user.rol, 'Exitoso');
      res.json(result);
    } else {
      await db.logAccess(username, 'desconocido', 'Fallido');
      res.status(401).json(result);
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── API: Obtener clientes ────────────────────────────────────────────────────
app.get('/api/admin/clients', async (req, res) => {
  try {
    res.json(await db.getClients());
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── API: Registrar cliente ───────────────────────────────────────────────────
app.post('/api/admin/clients', async (req, res) => {
  const { nombre, identificacion, usuario, contrasena } = req.body;
  if (!nombre || !identificacion || !usuario || !contrasena)
    return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios.' });

  try {
    const result = await db.addClient({ nombre, identificacion, usuario, contrasena });
    res.status(result.success ? 201 : 400).json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── API: Subir PDFs ──────────────────────────────────────────────────────────
app.post('/api/admin/upload', upload.array('pdf', 20), async (req, res) => {
  try {
    const { id_usuario, admin_id, admin_nombre } = req.body;

    if (!req.files || req.files.length === 0)
      return res.status(400).json({ success: false, message: 'Selecciona al menos un PDF.' });

    if (!id_usuario) {
      return res.status(400).json({ success: false, message: 'ID de usuario requerido.' });
    }

    const resultsData = [];

    for (const file of req.files) {
      let url_archivo   = '';
      let nombre_archivo = file.originalname;

      if (cloudinaryEnabled) {
        // ── Subir a Cloudinary ──────────────────────────────────────────────
        const safeName  = file.originalname.replace(/[^a-zA-Z0-9]/g, '_');
        const publicId  = `${safeName}_${Date.now()}`;
        const uploaded  = await uploadToCloudinary(file.buffer, publicId);
        url_archivo     = uploaded.secure_url;
        nombre_archivo  = uploaded.public_id; // guardamos el public_id para eliminar luego
      } else {
        // ── Fallback: guardar en disco local ────────────────────────────────
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext          = path.extname(file.originalname);
        const baseName     = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
        nombre_archivo     = `${baseName}-${uniqueSuffix}${ext}`;
        fs.writeFileSync(path.join(UPLOADS_DIR, nombre_archivo), file.buffer);
        url_archivo        = `/uploads/${nombre_archivo}`;
      }

      resultsData.push({
        id_usuario,
        nombre_examen:  file.originalname,
        nombre_archivo,
        url_archivo,
        admin_id:       admin_id    || '',
        admin_nombre:   admin_nombre|| ''
      });
    }

    const result = await db.addResult(resultsData);

    if (result.success) {
      res.json({
        success: true,
        message: req.files.length === 1
          ? 'Examen publicado con éxito.'
          : `${req.files.length} exámenes publicados con éxito.`
      });
    } else {
      res.status(500).json(result);
    }

  } catch (err) {
    console.error('Error en subida:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── API: Exámenes de un cliente ──────────────────────────────────────────────
app.get('/api/client/results', async (req, res) => {
  const { id_usuario } = req.query;
  if (!id_usuario)
    return res.status(400).json({ success: false, message: 'ID de usuario requerido.' });

  try {
    res.json(await db.getClientResults(id_usuario));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── API: Todos los exámenes (admin) ──────────────────────────────────────────
app.get('/api/admin/results', async (req, res) => {
  try {
    res.json(await db.getAllResults());
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── API: Eliminar examen ─────────────────────────────────────────────────────
app.post('/api/admin/delete-result', async (req, res) => {
  const { id_resultado } = req.body;
  if (!id_resultado)
    return res.status(400).json({ success: false, message: 'ID de resultado requerido.' });

  try {
    const result = await db.deleteResult(id_resultado);

    if (result.success) {
      const archivo = result.nombre_archivo || '';

      if (cloudinaryEnabled && archivo && archivo.startsWith('sirio-resultados/')) {
        // Eliminar de Cloudinary
        try {
          await cloudinary.uploader.destroy(archivo, { resource_type: 'raw' });
          console.log(`☁️  PDF eliminado de Cloudinary: ${archivo}`);
        } catch (e) {
          console.warn('No se pudo eliminar de Cloudinary:', e.message);
        }
      } else if (archivo && !archivo.startsWith('sirio-resultados/')) {
        // Eliminar del disco local
        const filePath = path.join(UPLOADS_DIR, archivo);
        if (fs.existsSync(filePath) && archivo !== 'ejemplo_examen.pdf') {
          fs.unlinkSync(filePath);
        }
      }

      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Manejo de errores Multer ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
});

// ── Iniciar servidor ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\x1b[36m%s\x1b[0m', '--------------------------------------------------');
  console.log('\x1b[32m%s\x1b[0m', `🚀 Servidor SIRIO en: http://localhost:${PORT}`);
  console.log('\x1b[36m%s\x1b[0m', '--------------------------------------------------');
});
