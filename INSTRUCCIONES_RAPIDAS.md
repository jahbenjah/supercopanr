# 🚀 INSTRUCCIONES RÁPIDAS - Supercopa Nicolás Romero 2026

## ✅ Estado Actual

**El servidor está FUNCIONANDO en:** `http://localhost:4321`

---

## 🌐 Acceso Inmediato

Abre en tu navegador:
```
http://localhost:4321
```

---

## ❌ Se Solucionó: Error de Conexión DNS

### ¿Qué pasó?
El sitio estaba configurado para apuntar a `supercopanr.solofutbolamateur.com`, pero ese dominio no estaba resolviendo localmente durante el build.

### ✅ La Solución
Cambié temporalmente `astro.config.mjs` para usar `localhost:4321` en desarrollo.

**Cuando el dominio esté listo en producción**, cambiaremos de vuelta a:
```javascript
site: 'https://supercopanr.solofutbolamateur.com'
```

---

## 📁 Estructura del Proyecto

```
├── src/
│   ├── components/     → Componentes Astro reutilizables
│   ├── layouts/        → Plantillas de página
│   ├── pages/          → Páginas públicas
│   ├── data/           → Archivos YAML con datos del torneo
│   └── lib/            → Lógica y utilidades
├── public/             → Archivos estáticos (logos, imágenes)
├── dist/               → Versión compilada (NO editar)
├── package.json        → Dependencias
├── astro.config.mjs    → Configuración de Astro
└── DATOS/
    ├── Claude.md                 → Información básica de la supercopa (para tu IA)
    ├── BASES.md                  → Bases oficiales formateadas
    ├── COMPARATIVA.md            → Análisis entre archivos
    ├── PROMPT_SITIO_WEB.md       → Prompt para crear sitio web
    ├── SOLUCION_ERROR_DNS.md     → Solución al error (este)
    └── SUPERCOPA 2026.pdf        → PDF oficial
```

---

## 🛠️ Comandos Útiles

### Desarrollo
```bash
npm run dev           # Inicia servidor en localhost:4321
npm run dev -- --force  # Fuerza reinicio si hay conflicto
```

### Build y Deploy
```bash
npm run build          # Compila para producción
npm test             # Ejecuta pruebas
npm run check        # Verifica tipos TypeScript
```

### Gestionar el Servidor
```bash
astro dev stop       # Detiene el servidor dev
astro dev --force    # Fuerza el inicio (mata procesos antiguos)
```

---

## 📝 Archivos de Datos (Editar estos para actualizar el sitio)

| Archivo | Descripción |
|---------|-------------|
| `src/data/torneo.yaml` | Fechas, costos, premios, contacto |
| `src/data/bases.yaml` | Los 21 requisitos de participación |
| `src/data/equipos.yaml` | Equipos inscritos |
| `src/data/jugadores.yaml` | Jugadores por equipo |
| `src/data/partidos.yaml` | Programación y resultados |
| `src/data/sedes.yaml` | Canchas y ubicaciones |
| `src/data/arbitros.yaml` | Árbitros designados |
| `src/data/patrocinadores.yaml` | Marcas patrocinadoras |

---

## 🎯 Próximos Pasos

### Fase 1 ✅ (Completada)
- [x] Landing page con información básica
- [x] Bases formateadas en markdown y web
- [x] Información de equipos, jugadores, árbitros
- [x] Calendario y programación

### Fase 2 (Antes del 1 de noviembre)
- [ ] Supabase: base de datos + autenticación
- [ ] Panel de administración
- [ ] Cédula de equipo con QR
- [ ] Credenciales de jugadores

### Fase 3 (Antes del 11 de noviembre)
- [ ] Sorteo de grupos
- [ ] Designación de árbitros
- [ ] Cédulas de árbitro

### Fase 4 (Durante torneo)
- [ ] Captura de resultados
- [ ] Generador automático para redes sociales
- [ ] Imágenes para Instagram, Facebook, TikTok

---

## 🔑 Variables de Entorno (Para Producción)

Cuando depliegues a cPanel, necesitarás:

**En GitHub Secrets:**
- `FTP_SERVER`: Dirección FTP del servidor
- `FTP_USERNAME`: Usuario FTP
- `FTP_PASSWORD`: Contraseña FTP
- `FTP_SERVER_DIR`: Directorio raíz (usualmente `./`)

**En .env.local (local, no subir a GitHub):**
- `SUPABASE_URL`: (cuando agregues Supabase en Fase 2)
- `SUPABASE_ANON_KEY`: (cuando agregues Supabase en Fase 2)

---

## 🔗 Enlaces Importantes

- 🌐 **Desarrollo Local:** http://localhost:4321
- 📚 **Documentos de Referencia:**
  - [Claude.md](./Claude.md) - Información para tu IA
  - [BASES.md](./BASES.md) - Bases oficiales
  - [PROMPT_SITIO_WEB.md](./PROMPT_SITIO_WEB.md) - Prompt para crear features
  
- 🚀 **Cuando esté en producción:**
  - https://supercopanr.solofutbolamateur.com

---

## ❓ Troubleshooting

### "El servidor no responde"
```bash
# Detén y reinicia
astro dev stop
npm run dev
```

### "Puerto 4321 en uso"
```bash
# Usa otro puerto
npm run dev -- --port 3000
# Abre: http://localhost:3000
```

### "Error de permisos en dist/"
```bash
# Limpia y reconstruye
rm -rf dist/
npm run build
```

### "Cambios no se ven"
```bash
# Recarga el navegador con Ctrl+F5 (caché duro)
# O abre en navegación privada
```

---

## 📞 Resumen Rápido

✅ **Servidor corriendo:** http://localhost:4321  
✅ **Errores DNS solucionados**  
✅ **Listo para desarrollo**  
✅ **Documentación completa disponible**  

**¿Qué necesitas hacer ahora?**
1. Abre http://localhost:4321 en tu navegador
2. Revisa el sitio y valida que se ve correcto
3. Edita archivos en `src/data/*.yaml` para actualizar contenido
4. Guarda y el sitio se actualiza automáticamente (hot reload)

¡**Listo para crear contenido!** 🎉
