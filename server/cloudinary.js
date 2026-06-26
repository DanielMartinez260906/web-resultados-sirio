/**
 * MÓDULO DE CLOUDINARY - LABORATORIO SIRIO
 * Gestiona la subida y eliminación de PDFs en Cloudinary.
 * Usa resource_type: 'raw' para que los PDFs se entreguen
 * con Content-Type: application/pdf y sean visualizables en el navegador.
 */

const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// Configurar SDK de Cloudinary con variables de entorno
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true // Siempre usar HTTPS
});

/**
 * Sube un buffer de PDF a Cloudinary.
 * @param {Buffer} buffer - Contenido del archivo en memoria
 * @param {string} publicId - Nombre público del archivo (sin extensión)
 * @returns {Promise<{secure_url: string, public_id: string}>}
 */
function uploadPDF(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',       // CLAVE: 'raw' para PDFs, no 'image'
        folder: 'sirio-resultados', // Carpeta en Cloudinary
        public_id: publicId,        // ID público del archivo
        format: 'pdf',              // Forzar extensión .pdf en la URL
        overwrite: false,
        use_filename: false,
        unique_filename: false
      },
      (error, result) => {
        if (error) {
          console.error('Error al subir a Cloudinary:', error);
          reject(error);
        } else {
          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id
          });
        }
      }
    );
    // Convertir el buffer en stream y enviarlo
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

/**
 * Elimina un archivo de Cloudinary por su public_id.
 * @param {string} publicId - El public_id retornado al subir el archivo
 * @returns {Promise<void>}
 */
async function deletePDF(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
    console.log(`☁️  Archivo eliminado de Cloudinary: ${publicId}`);
  } catch (error) {
    console.warn(`⚠️  No se pudo eliminar de Cloudinary (${publicId}):`, error.message);
  }
}

/**
 * Extrae el public_id de Cloudinary desde una URL completa.
 * Ejemplo: "https://res.cloudinary.com/cloud/raw/upload/v123/sirio-resultados/file.pdf"
 * → "sirio-resultados/file"
 * @param {string} url
 * @returns {string|null}
 */
function extractPublicId(url) {
  if (!url || !url.includes('cloudinary.com')) return null;
  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.pdf)?$/i);
    return match ? match[1] : null;
  } catch (e) {
    return null;
  }
}

module.exports = { uploadPDF, deletePDF, extractPublicId };
