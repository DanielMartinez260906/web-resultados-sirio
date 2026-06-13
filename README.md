# 🧪 Portal Web de Resultados - Laboratorio Clínico SIRIO

Este es un portal web premium diseñado para el **Laboratorio Clínico SIRIO**. Cuenta con un diseño responsivo con estética moderna (glassmorphic y modo oscuro), control de accesos de doble rol (Empleados/Administradores y Clientes/Pacientes), subida local de PDF de resultados, registro de auditoría de accesos y una integración nativa y sencilla con **Google Sheets**.

---

## 🚀 Inicio Rápido (Modo Demostración)

El sistema incluye un **Modo Demo automático** que te permite ejecutar e interactuar con toda la aplicación de inmediato en tu computadora, sin necesidad de configurar Google Sheets primero. Los datos temporales se guardarán localmente en un archivo JSON.

### Pasos para ejecutar:

1. **Instalar Dependencias**:
   Abre una terminal (PowerShell o CMD) en la carpeta del proyecto y ejecuta:
   ```bash
   npm install
   ```

2. **Iniciar el Servidor**:
   Inicia la aplicación ejecutando:
   ```bash
   npm start
   ```

3. **Abrir la Aplicación**:
   Abre tu navegador de preferencia e ingresa a:
   [http://localhost:3000](http://localhost:3000)

### 🔑 Credenciales de Prueba (Modo Demo):
* **Panel de Administrador (Personal del Laboratorio)**:
  * **Usuario**: `admin`
  * **Contraseña**: `admin123`
* **Panel de Cliente (Paciente)**:
  * **Usuario**: `paciente`
  * **Contraseña**: `paciente123`

---

## 📊 Integración con Google Sheets

Para conectar la aplicación con tu propia hoja de cálculo de Google y guardar los datos allí en tiempo real, sigue estos sencillos pasos:

### Paso 1: Configurar la Hoja de Cálculo
1. Ve a tu cuenta de Google Drive y crea una nueva **Hoja de cálculo de Google (Google Sheets)**.
2. Nómbrala como gustes (ej: *Base de Datos SIRIO*). No necesitas crear pestañas ni cabeceras manualmente; el script las creará automáticamente por ti.

### Paso 2: Instalar el código en Apps Script
1. Dentro de tu hoja de cálculo, ve al menú superior y haz clic en **Extensiones** > **Apps Script**.
2. Borra cualquier código existente en el archivo `Código.gs`.
3. Abre el archivo [google_apps_script.js](file:///C:/Users/mdani/OneDrive/Desktop/RESULTADOS%20SIRIO%20WEB/google_apps_script.js) ubicado en la raíz de este proyecto, copia todo su contenido y pégalo en el editor de Apps Script.
4. Haz clic en el ícono del disquete (Guardar proyecto) en la parte superior.

### Paso 3: Desplegar como Aplicación Web
1. Haz clic en el botón azul **Implementar** (Deploy) en la esquina superior derecha y selecciona **Nueva implementación**.
2. En la ventana emergente, haz clic en el engranaje de configuración y selecciona **Aplicación web**.
3. Rellena los siguientes campos:
   * **Descripción**: *API SIRIO Portal*
   * **Ejecutar como**: *Yo (tu_cuenta@gmail.com)*
   * **Quién tiene acceso**: *Cualquier persona (Anyone)* *(Esto es crucial para que el servidor local de Node.js pueda comunicarse con ella)*.
4. Haz clic en el botón **Implementar**.
5. Google te pedirá que autorices los permisos. Haz clic en **Autorizar acceso**, selecciona tu cuenta de Google, ve a "Avanzado" (si aparece la advertencia de aplicación no verificada) y haz clic en **Ir a Proyecto sin título (no seguro)**, luego pulsa **Permitir**.
6. Una vez completado, copia el enlace provisto bajo **URL de la aplicación web** (debe terminar en `/exec`).

### Paso 4: Configurar el Servidor Local
1. Abre el archivo `.env` en la raíz de este proyecto.
2. Reemplaza `https://script.google.com/macros/s/xxxxxxxxx/exec` por la **URL de la aplicación web** que acabas de copiar.
3. Si cambiaste la clave `API_KEY` en el Apps Script de Google Sheets, modifícala también en el archivo `.env`.
4. Reinicia tu servidor Node.js en la terminal (presiona `Ctrl + C` para detenerlo y escribe `npm start` para iniciarlo de nuevo).

¡Listo! Al recargar el portal en tu navegador, el indicador flotante en la esquina inferior derecha cambiará de **"Modo Demo"** a **"Google Sheets Conectado"**. A partir de ahora, todos los accesos se registrarán en la pestaña *Accesos*, los clientes creados se guardarán en *Clientes*, y las referencias de los PDFs se indexarán en *Resultados*.

---

## 📁 Estructura del Proyecto

* **`server/`**: Código de Node.js + Express que maneja la lógica de subida de archivos (Multer) y la comunicación con Google Sheets.
* **`public/`**: Interfaz de usuario HTML, CSS Vanilla Premium, y JavaScript de control de vistas.
* **`uploads/`**: Carpeta donde se almacenan físicamente los archivos PDF de los exámenes en el servidor local.
* **`google_apps_script.js`**: Script de JavaScript para pegar en tu Google Sheets.
* **`.env`**: Archivo de configuración para variables de entorno del servidor.
"# web-resultados-sirio" 
