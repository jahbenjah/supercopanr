# 🚀 PROMPT PARA IA: Crear Sitio Web Super Copa Nicolás Romero 2026

---

## 📋 OBJETIVO GENERAL

Crear un **sitio web profesional, moderno y completamente funcional** para la Super Copa Nicolás Romero 2026 que permita:

1. **Gestionar la supercopa** (calendario, grupos, resultados)
2. **Generar automáticamente** material para redes sociales
3. **Crear documentos** para equipos (credenciales, convocatorias)
4. **Generar cédulas** para árbitros y delegados
5. **Proporcionar información** clara a participantes

---

## 🎨 CARACTERÍSTICAS PRINCIPALES DEL SITIO

### 1. **Landing Page / Página de Inicio**
- Información destacada del evento
- Conteo regresivo a sorteo (11 nov) e inauguración (13 nov)
- Información de inscripción y costos
- Galería de imágenes (o placeholder)
- Llamadas a acción claras (Inscribirse, Descargar bases)

### 2. **Panel de Administración (ADMIN)**
Requiere autenticación. Funcionalidades:
- Gestión de equipos (crear, editar, eliminar)
- Gestión de jugadores por equipo
- Gestión de árbitros y delegados
- Gestión de grupos (crear, asignar equipos)
- Carga de resultados de partidos
- Gestión de calendario

### 3. **Sección de Redes Sociales**
Generador automático de contenido para:
- Instagram (Posts, Historias, Reels)
- Facebook (Posts, eventos)
- WhatsApp (Mensajes programados)
- Twitter/X (Tweets)

**Tipos de contenido automatizado:**
- Conteos regresivos (día del evento, sorteo, inauguración)
- Presentación de equipos (con logo si aplica)
- Recordatorios de fechas límite de inscripción
- Clasificaciones y resultados actualizados
- Perfiles de árbitros destacados
- Estadísticas del torneo
- Invitaciones y convocatorias

**Características:**
- Galería de plantillas prediseñadas
- Editor visual para personalización
- Descargar en múltiples formatos (PNG, JPG, MP4)
- Calendario de publicación programada
- Multiidioma (español)

### 4. **Generador de Documentos para Equipos**
Descargables en PDF y Word:

#### a) **Cédula de Equipo**
- Nombre oficial del equipo
- Logo del equipo
- Datos del delegado responsable
- Teléfono y correo del delegado
- Fecha de inscripción
- Estado de inscripción (Pagado/Pendiente)
- Código QR único del equipo
- Firma autorizada

#### b) **Credenciales de Jugadores**
Documento individual por jugador:
- Nombre del jugador
- Número de cédula/ID
- Número del equipo
- Posición
- Número de dorsal
- Foto (espacio para foto)
- Código QR vinculado al registro
- Vigencia del torneo (Nov-Dic 2026)
- Firma del delegado y organización

#### c) **Comprobante de Inscripción**
- Nombre del equipo
- Monto pagado
- Descripción de pagos (cuotas)
- Fechas de pago
- Saldo pendiente (si aplica)
- Número de confirmación
- Instrucciones siguientes

#### d) **Convocatoria para Jugadores**
- Membrete de la supercopa
- Datos del equipo
- Fecha, hora y lugar del primer partido
- Instrucciones obligatorias
- Lista de lo que debe llevar
- Contacto de emergencia del delegado

### 5. **Generador de Cédulas para Árbitros**
Documento imprimible:
- Nombre del árbitro
- Cédula/ID
- Foto del árbitro
- Rol (Árbitro central, asistente, cuarto árbitro)
- Número de licencia
- Nivel de arbitraje
- Fecha de emisión
- Código QR para verificación
- Firma autorizada

**Funcionalidades adicionales:**
- Designación de árbitros por partido
- Horarios asignados
- Campos designados

### 6. **Sección Pública de Información**
- **Bases y Requisitos:** Descargable en PDF
- **Calendario de Partidos:** Visualización por fecha y grupo
- **Clasificaciones:** Tabla de grupos actualizada
- **Resultados:** Historiales de partidos jugados
- **Equipos:** Información de cada equipo participante
- **Árbitros:** Listado de árbitros asignados (opcional)
- **Galería:** Fotos del evento (cuando aplique)
- **Contacto:** Formulario para consultas

### 7. **Funcionalidades Especiales**

#### a) **Sistema de Notificaciones**
- Email a delegados (recordatorios de pago, cambios de horario)
- WhatsApp broadcasts (alertas importantes)
- SMS a árbitros (confirmación de designación)

#### b) **Generador Avanzado de Redes Sociales**
- **Plantillas preestablecidas** para cada tipo de evento
- **Inserción automática** de datos (fechas, equipos, resultados)
- **Múltiples tamaños:** Instagram (1080x1080, 1080x1920), Facebook, Twitter
- **Estilos visuales:** Profesional, deportivo, vibrante, etc.
- **Descarga en lote:** Generar varias publicaciones simultáneamente

#### c) **API de Integración**
- Posibilidad de conectar con redes sociales (auto-publicar)
- Integración con Google Calendar
- Exportar datos a Excel/CSV

---

## 🛠️ STACK TÉCNICO RECOMENDADO

### Frontend
- **React.js** o **Vue.js** (interfaz interactiva)
- **Tailwind CSS** o **Bootstrap** (diseño responsive)
- **Chart.js** o **ApexCharts** (gráficos y estadísticas)
- **html2canvas** (captura de pantalla para redes sociales)

### Backend
- **Node.js + Express** o **Python + Django/Flask**
- **Base de datos:** PostgreSQL o MongoDB
- **Autenticación:** JWT
- **Generación de PDFs:** PDFkit o ReportLab
- **QR Codes:** qrcode.js

### Hosting
- **Frontend:** Vercel, Netlify, GitHub Pages
- **Backend:** Heroku, Railway, AWS
- **Base de datos:** PostgreSQL en Render, MongoDB Atlas
- **Almacenamiento:** AWS S3 o Cloudinary (imágenes, logos)

---

## 📊 FLUJOS DE USUARIO PRINCIPALES

### 1. **Equipo (Delegado)**
```
Acceso a panel → Ver estado inscripción → Descargar credenciales → 
Consultar partidos → Ver calendario → Contactar organización
```

### 2. **Árbitro**
```
Recibir credencial → Acceder a panel → Ver designaciones → 
Descargar documentos → Consultar horarios
```

### 3. **Admin/Organizador**
```
Gestionar equipos → Crear grupos → Designar árbitros → 
Cargar resultados → Generar material social → Enviar notificaciones
```

### 4. **Público General**
```
Ver información → Consultar calendario → Ver clasificaciones → 
Ver resultados → Compartir en redes → Contactar
```

---

## 🎯 ESPECIFICACIONES DE DISEÑO

### Paleta de Colores
- **Color Principal:** Verde deportivo (#1B8B4D) o azul (#003DA5)
- **Color Secundario:** Blanco (#FFFFFF) y gris oscuro (#2D3748)
- **Acentos:** Oro/Amarillo (#FFD700) para destacados
- **Advertencias:** Rojo (#E53E3E) para límites críticos

### Tipografía
- **Títulos:** Montserrat Bold o Roboto Bold
- **Cuerpo:** Roboto o Inter
- **Tamaños:** Responsive (móvil y desktop)

### Iconografía
- Usar Font Awesome o Heroicons
- Emojis estratégicos para mejorar UX
- Iconos claros para cada sección

### Diseño Responsivo
- Mobile-first
- Tablet (768px)
- Desktop (1024px+)
- Pruebas en diferentes navegadores

---

## 📝 EJEMPLO DE TEMPLAT PARA REDES SOCIALES

### Instagram Post - Presentation de Equipo
```
TÍTULO: "⚽ ¡Conoce a los participantes! 🏆"
CONTENIDO VISUAL:
- Logo del equipo (centrado)
- Nombre del equipo (grande, destacado)
- "Super Copa Nicolás Romero 2026"
- Colores corporativos del equipo
- "¿Ya te inscribiste? Inscríbete antes del 1 de noviembre"

COPY (Ejemplo):
"🔥 [NOMBRE EQUIPO] se une a la Super Copa Nicolás Romero 2026
¿Buscan ser campeones? 👀
📍 Nicolás Romero, Estado de México
📅 Sorteo: 11 de noviembre
🎉 Inauguración: 13 de noviembre
🏆 $80,000 al campeón
¡Síguenos para más actualizaciones! #SuperCopa2026 #FútbolAmateur"
```

---

## 🔐 REQUISITOS DE SEGURIDAD

- SSL/TLS en toda la plataforma
- Autenticación de dos factores (2FA) para admin
- Encriptación de datos sensibles
- Backup automático diario
- Validación de entrada en formularios
- Rate limiting para prevenir spam
- Privacidad: Cumplir GDPR/LGPD (datos personales)

---

## 📈 MÉTRICAS Y ANALYTICS

- Número de equipos inscritos
- Visitantes al sitio
- Descargas de documentos
- Tasa de inscripción
- Engagement en redes sociales
- Errores y problemas reportados

---

## 📌 PRIORIDADES DE DESARROLLO

### Fase 1 (Crítica - Semana 1)
- [ ] Landing page completa
- [ ] Panel de inscripción de equipos
- [ ] Generador de cédulas (equipo y jugadores)
- [ ] Bases en PDF descargable
- [ ] Autenticación básica

### Fase 2 (Alta - Semana 2)
- [ ] Panel de admin
- [ ] Generador de posts para redes sociales
- [ ] Calendario de partidos
- [ ] Cédulas para árbitros
- [ ] Sistema de notificaciones

### Fase 3 (Media - Semana 3)
- [ ] Clasificaciones y resultados
- [ ] Galería de fotos
- [ ] Sistema de estadísticas
- [ ] Integración con redes sociales
- [ ] Reportes avanzados

---

## 🚀 INSTRUCCIONES FINALES PARA LA IA

**Crea un sitio web profesional que:**

1. ✅ Sea **visualmente atractivo** y fácil de usar
2. ✅ Permita **generar automáticamente** contenido para redes sociales con plantillas hermosas
3. ✅ Genere **cédulas profesionales en PDF** para equipos, jugadores y árbitros
4. ✅ Tenga un **panel de administración robusto** para gestionar todo
5. ✅ Sea **responsive** (móvil, tablet, desktop)
6. ✅ Integre **notificaciones automáticas** vía email/WhatsApp
7. ✅ Proporcione **información clara y organizada** al público
8. ✅ Sea **seguro** con autenticación y encriptación
9. ✅ Esté **completamente documentado** para facilitar mantenimiento
10. ✅ Sea **escalable** y preparado para futuras ediciones

**Incluir:**
- Documentación de instalación
- Variables de entorno
- Instrucciones de despliegue
- Guía de usuario para admin
- Ejemplos de uso

---

## 📞 SOPORTE POST-LANZAMIENTO

Incluir:
- Sistema de tickets de soporte
- FAQ interactivo
- Chat de soporte (chatbot básico)
- Documentación de troubleshooting

---

**¡Con este prompt tu IA podrá crear un sitio web completo y profesional para tu supercopa! 🎉**
