# 📖 Guía de Uso: Portal Web de Resultados - Laboratorio Clínico SIRIO

¡Bienvenido a la guía de usuario del sistema web del **Laboratorio SIRIO**! Este documento está escrito en un lenguaje sencillo y libre de términos técnicos para que tanto los clientes como el personal del laboratorio y las jefas puedan comprender y aprovechar todas las herramientas de la plataforma.

---

## 🐶 1. Manual para Clientes (Médicos y Clínicas Veterinarias)

El portal de clientes permite a las veterinarias afiliadas consultar exámenes, ingresar solicitudes de recolección de muestras y verificar tarifas vigentes.

### 📊 Sección 1: Mis Resultados
* **¿Qué es?**: Es tu buzón principal. Aquí aparecen todos los resultados de exámenes que el laboratorio ha subido para tus pacientes.
* **¿Cómo buscar?**:
  * Utiliza el **buscador** superior escribiendo el nombre de tu paciente o el tipo de examen.
  * Filtra por **Fecha** seleccionando un día específico en el calendario.
  * Activa la casilla **Recibidos Hoy** para ver de forma instantánea únicamente los análisis que ingresaron hoy.
* **Diseño Personalizable**: Puedes alternar entre la vista en **Mosaico** (tarjetas grandes de diseño moderno) o vista en **Lista** (una tabla compacta) según lo que te resulte más cómodo.
* **Descarga**: Para abrir o descargar un informe, simplemente haz clic en el botón con el icono de descarga en la tarjeta del examen.

### ✍️ Sección 2: Ingresar Paciente (Nueva Opción)
* **¿Qué es?**: Un formulario paso a paso para pre-registrar a un paciente y pedir que el personal del laboratorio pase a recoger las muestras directamente a tu veterinaria.
* **¿Cómo usarlo?**:
  * **Paso 1**: Completa los datos básicos del paciente (nombre de la mascota, especie, raza, edad, sexo) y el nombre del dueño.
  * **Paso 2**: Elige el tipo de muestra que vas a enviar (sangre, suero, orina, etc.) y selecciona los exámenes que estás solicitando en el listado.
  * **Paso 3**: Escribe indicaciones adicionales si es necesario y envía la solicitud. ¡El laboratorio recibirá la alerta de recolección inmediatamente!

### 📑 Sección 3: Portafolio de Servicios
* **¿Qué es?**: Un catálogo digital interactivo donde puedes consultar todos los análisis de laboratorio que SIRIO ofrece.
* **¿Qué información contiene?**: Nombre del examen, sección a la que pertenece, precio actual, tiempo estimado de entrega del reporte (en horas o días), tipo de muestra requerida y recipiente adecuado (ej. tubo lila con tapa roja).
* **Mantenimiento**: Si ves un mensaje de *"Sección en Mantenimiento"*, significa que el laboratorio está actualizando tarifas o el catálogo temporalmente.

### 👤 Sección 4: Mi Perfil
* Aquí puedes ver los datos de tu veterinaria y cambiar tu contraseña de acceso cuando lo desees para mantener tu cuenta segura.

### 🧭 Menú Desplegable Superior (Navegación Rápida)
* Si estás usando tu **celular o tablet**, verás un cajón desplegable en la parte superior que dice **"Seleccionar Sección"**. Haz clic en él para saltar de inmediato a cualquier pestaña de forma cómoda sin tener que deslizar la barra de botones.

---

## 👑 2. Manual para Jefas y Personal del Laboratorio

El panel de administración es el cerebro del laboratorio, desde donde se cargan resultados, se administra el catálogo, se gestiona el personal y se consultan estadísticas de rendimiento.

### 🔑 Roles Especiales y Contraseñas de Seguridad
Existen secciones críticas en la administración (como modificar el catálogo de precios o configuraciones generales) que requieren por seguridad la clave **`SirioJefas2026*`**.
Para evitar digitarla constantemente, hemos creado **permisos especiales**:
* **Admin Normal 👤**: Puede subir exámenes y registrar clientes. Para entrar a configuración o portafolio debe digitar la contraseña de seguridad.
* **Jefa / Jefe 👑**: Tiene acceso total. Puede ingresar directamente a todas las pestañas sin necesidad de digitar la contraseña.
* **Programador 💻**: Permiso técnico absoluto con acceso liberado de contraseñas.

> [!NOTE]
> **Identificador Visual**: Sabrás qué permisos tienes en todo momento mirando justo debajo de tu nombre en la esquina superior izquierda de la pantalla. Verás una etiqueta destacada: rosa para Jefas, morada para Programadores o una gris para administradores normales.

### 👤 Gestión del Personal y Asignación de Permisos
Desde la pestaña **Clientes y Perfiles** > **Personal**:
* Puedes ver el listado de todo tu personal, ordenado automáticamente colocando a las Jefas de primero, Programadores de segundo y Administradores Normales al final (y de forma alfabética).
* Las tarjetas ya no muestran números de identificación innecesarios (DNI); ahora muestran directamente el rol de cada colaborador de forma clara.
* **Cambiar Permisos**: Selecciona a un empleado. Verás dos botones en su perfil:
  * **Hacer Jefa o Jefe / Quitar Rol Jefa/Jefe**: Para promover o quitar permisos de dirección.
  * **Hacer Programador / Quitar Rol Programador**: Para promover o quitar permisos de desarrollo.
  * **Seguridad**: Al presionar cualquiera de estos botones para otorgar permisos elevados, el sistema te solicitará ingresar la contraseña **`SirioJefas2026*`**. Si no es correcta, el rol no se modificará.

### 🟢 Indicador de Presencia (Usuarios Activos en Tiempo Real)
* **¿Qué es?**: Ahora las jefas y administradores pueden saber de inmediato qué clientes y compañeros están navegando en la plataforma en ese mismo instante.
* **¿Cómo verlos?**:
  * En la pestaña **Clientes y Perfiles** (tanto en el listado de Clientes como de Personal), aparecerá una etiqueta parpadeante en verde brillante que dice **`ACTIVO`** junto al nombre de cualquier usuario que tenga la página abierta.
  * Al seleccionar a un cliente o miembro del personal para ver sus detalles en el panel lateral, también verás un indicador visual destacado de **`ACTIVO AHORA`** en la cabecera de su ficha de detalles.
  * **Actualización Automática**: El sistema rastrea la presencia en segundo plano de forma transparente y actualiza las etiquetas cada pocos segundos de manera dinámica sin necesidad de recargar la página.

### 🛠️ Activar o Desactivar el Portafolio de Clientes
* **¿Para qué sirve?**: Si vas a subir nuevos precios o actualizar el catálogo y no quieres que los veterinarios vean información incompleta, puedes apagar temporalmente el portafolio.
* **¿Cómo se hace?**:
  * Ve a la pestaña **Portafolio** y apaga el switch superior que dice **"Visibilidad Clientes"**.
  * O bien, ve a la pestaña **Configuración** y desmarca la casilla **"Habilitar Portafolio a Clientes"** y pulsa **Guardar**.
  * **Efecto**: A los clientes les aparecerá una pantalla indicando que el portafolio se encuentra en mantenimiento temporalmente.

### 📈 Panel de Estadísticas (Uso Exclusivo Jefas/Programadores)
Si tienes el rol de **Jefa** o **Programador**, verás una pestaña llamada **Estadísticas**:
* **KPIs Clave**: Muestra de un vistazo cuántos exámenes se han subido en total, cuál es la clínica veterinaria que más servicios solicita (Cliente Estrella), quién es el colaborador del laboratorio que más exámenes ha publicado y cuál es el análisis más demandado.
* **Gráficos Interactivos**:
  * **Flujo de Exámenes**: Una línea de tiempo que muestra cómo ha crecido la cantidad de exámenes procesados por mes.
  * **Distribución de Trabajo**: Un gráfico circular que representa qué porcentaje de exámenes ha subido cada empleado.
  * **Top 5 Clientes**: Un gráfico de barras con las 5 veterinarias que más demandan tus servicios.

---

## 📢 Importante: Sincronización de Base de Datos (Google Sheets)

Para que todos los cambios de roles y permisos se guarden de forma permanente en tu base de datos de Google Sheets, recuerda actualizar el código de Apps Script:
1. Copia todo el contenido del archivo local **`google_apps_script.js`**.
2. Abre tu hoja de cálculo de Google Sheets.
3. Ve a **Extensiones** > **Apps Script**.
4. Pega el código nuevo reemplazando todo lo anterior.
5. Presiona **Guardar** (icono de disquete).
6. Presiona **Implementar** > **Administrar implementaciones** > Edita (icono de lápiz) > Elige **Nueva Versión** > Presiona **Implementar**.

¡Listo! Con estos simples pasos, la hoja de cálculo se estructurará automáticamente y el sistema de roles quedará 100% activo en la nube.
