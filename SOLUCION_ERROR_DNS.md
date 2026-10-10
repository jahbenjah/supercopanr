# 🔧 Solución: Error EAI_NONAME - Fallo de conexión DNS

## ❌ El Problema

```
Error: EAI_NONAME - No se ha proporcionado ni el nombre de nodo ni el nombre de servidor, o no se conocen
No se pudo conectar al servidor
```

**Causa:** El sitio en `astro.config.mjs` está configurado con:
```javascript
site: 'https://supercopanr.solofutbolamateur.com'
```

Pero este dominio **no está resolviendo en DNS** desde tu máquina local.

---

## ✅ SOLUCIONES (Elige una)

### **OPCIÓN 1: Desarrollo Local (RECOMENDADO mientras no esté en producción)**

Cambia `astro.config.mjs` para desarrollo local:

```javascript
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'http://localhost:4321', // Para desarrollo local
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  vite: { plugins: [tailwindcss()] },
});
```

**Luego:**
```bash
npm run dev
# Abre: http://localhost:4321
```

✅ **Ventajas:**
- Funciona sin internet/DNS
- Desarrollo local completo
- Rápido y ágil

❌ **Desventajas:**
- El sitemap apuntará a localhost

---

### **OPCIÓN 2: Usar hostname.local (Desarrollo + Testing)**

Edita tu archivo `hosts` local:

**En Linux/Mac:**
```bash
sudo nano /etc/hosts
```

**Agrega esta línea:**
```
127.0.0.1  supercopanr.local
```

**Guarda** (Ctrl+O, Enter, Ctrl+X)

Luego actualiza `astro.config.mjs`:
```javascript
site: 'http://supercopanr.local:4321'
```

Ejecuta:
```bash
npm run dev
# Abre: http://supercopanr.local:4321
```

✅ **Ventajas:**
- Simula un dominio real
- Útil para testing
- Sin cambiar DNS real

---

### **OPCIÓN 3: Esperar a que el DNS se propague (PRODUCCIÓN)**

Si ya configuraste el dominio en cPanel y Cloudflare:

1. **Verifica que el DNS esté configurado en Cloudflare:**
   ```bash
   nslookup supercopanr.solofutbolamateur.com
   # Debe devolver una IP
   ```

2. **Espera a que se propague** (puede tomar 24-48 horas)

3. **Una vez que resuelva, funciona todo**

✅ **Para desarrollo mientras tanto:** Usa OPCIÓN 1 o 2

---

### **OPCIÓN 4: Deshabilitar temporalmente el sitemap**

Si solo quieres que funcione el dev sin esperar DNS:

```javascript
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://supercopanr.solofutbolamateur.com',
  trailingSlash: 'ignore',
  integrations: [], // Quita sitemap temporalmente
  vite: { plugins: [tailwindcss()] },
});
```

Luego agrega sitemap de vuelta cuando el DNS funcione.

---

## 🚀 RECOMENDACIÓN INMEDIATA

**Para seguir desarrollando AHORA:**

### Paso 1: Edita `astro.config.mjs`
```bash
nano astro.config.mjs
```

Cambia a:
```javascript
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'http://localhost:4321', // Cambio temporal
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  vite: { plugins: [tailwindcss()] },
});
```

### Paso 2: Guarda (Ctrl+O, Enter, Ctrl+X)

### Paso 3: Ejecuta
```bash
npm run dev
```

### Paso 4: Abre en el navegador
```
http://localhost:4321
```

---

## 📋 Checklist de DNS (Cuando vayas a Producción)

- [ ] Dominio configurado en cPanel
- [ ] Registro A apuntando a IP del servidor cPanel
- [ ] Registro en Cloudflare (nube gris, sin proxy)
- [ ] AutoSSL ejecutado en cPanel
- [ ] DNS propagado (verifica con `nslookup`)
- [ ] Certificado HTTPS activo
- [ ] GitHub Secrets configurados (FTP_SERVER, FTP_USERNAME, FTP_PASSWORD)
- [ ] Workflow de deploy en `.github/workflows/deploy.yml`

---

## 🔍 Verificar DNS

Desde terminal:

```bash
# Linux/Mac
nslookup supercopanr.solofutbolamateur.com
dig supercopanr.solofutbolamateur.com

# Windows (PowerShell)
nslookup supercopanr.solofutbolamateur.com
```

Si devuelve una IP: ✅ DNS funcionando
Si devuelve error: ❌ Aún no propagado

---

## 📞 Resumen

| Escenario | Solución |
|-----------|----------|
| Desarrollando localmente | OPCIÓN 1 (localhost:4321) |
| Simulando dominio real | OPCIÓN 2 (hosts local) |
| DNS no propagado aún | Esperar + OPCIÓN 1 para dev |
| Producción con DNS listo | OPCIÓN 3 (actual config) |
| Urgencia total | OPCIÓN 4 (sin sitemap) |

**Haz el cambio a la OPCIÓN 1 ahora y podrás seguir desarrollando. ¿Necesitas ayuda? Avísame.** 🚀
