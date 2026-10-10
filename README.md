# Supercopa Nicolás Romero 2026

Sitio oficial del torneo: https://supercopa.solofutbolamateur.com

Hecho con [Astro](https://astro.build) y publicado en el hosting cPanel. Los datos viven en
`src/data/*.yaml`; las tablas de posiciones, goleo y disciplina se calculan solas al publicar.
La información oficial (fechas, costos, bases) sale de `SUPERCOPA 2026.pdf` y está en
`src/data/torneo.yaml` y `src/data/bases.yaml`.

## Estado y fases

- **Fase 1 (lista):** portada con cuenta regresiva, inscripción, bases (PDF y web), programación
  general, y páginas de calendario, posiciones, resultados, equipos, árbitros y sedes que se
  llenan conforme se capturan los datos.
- **Fase 2 (antes del 1 de noviembre):** Supabase (base de datos, login y archivos) para el panel de
  administración: equipos, jugadores, pagos y cuotas, cédula de equipo y credenciales con QR en PDF.
- **Fase 3 (antes del 11 de noviembre):** sorteo de grupos, calendario, designación de árbitros y
  cédulas de árbitro.
- **Fase 4 (durante el torneo):** captura de resultados desde el panel, eliminatoria e imágenes
  para redes sociales.

Mientras llega la fase 2, los datos se capturan en los YAML. Toda la lectura pasa por
`src/lib/datos.ts`; en la fase 2 esa capa leerá de Supabase y las páginas no cambian.

## Antes de publicar

- Pon el WhatsApp de la organización en `contacto_whatsapp` de `torneo.yaml`. Mientras no esté,
  los botones de contacto abren el Messenger de la página de Facebook.
- `equipos.yaml` = equipos **confirmados** (cuentan para "Equipos confirmados x de 24").
- Los paquetes de `paquetes.yaml` no tienen precio: aparecen como "Cotiza por mensaje" hasta que
  agregues `precio` y `periodo`.

## Capturar resultados (lo más común)

1. Abre `src/data/partidos.yaml` y busca el partido por su `id` (p. ej. `j3-a1`).
2. Cambia `estado: programado` por `estado: jugado` y agrega:

   ```yaml
     estado: jugado
     goles_local: 2
     goles_visitante: 1
     goles:
       - { jugador_id: deportivo-colmena-4, minuto: 12 }
       - { jugador_id: deportivo-colmena-4, minuto: 55 }
       - { jugador_id: real-progreso-4, minuto: 70 }
     tarjetas:
       - { jugador_id: real-progreso-2, tipo: amarilla, minuto: 30 }
   ```

3. Haz commit y push a `main`. GitHub Actions valida los datos y publica en ~2 minutos.

Si algo no cuadra (un equipo o jugador que no existe, más goles registrados que el marcador,
un goleador que no juega ese partido) el build falla y en la pestaña **Actions** de GitHub
aparece exactamente qué partido y qué dato corregir. El sitio publicado no se rompe.

Estados de partido: `programado`, `jugado`, `suspendido`, `default` (por default lleva marcador,
p. ej. 3-0, pero sin goleadores). `fase`: `grupos` (con `grupo: A`…`H`), `octavos`, `cuartos`,
`semifinal` o `final`. En eliminatoria, si hay empate se agregan `penales_local` y `penales_visitante`.

Para ver el sitio lleno, copia `ejemplos/*.yaml` a `src/data/` (24 equipos de ejemplo) y corre
`npm run dev`. **No lo subas así**: regresa los archivos con `git checkout src/data`.

## Archivos de datos

| Archivo | Qué contiene |
|---|---|
| `torneo.yaml` | Datos oficiales: fechas clave, programación, costos, cuotas, premios, grupos, contacto |
| `bases.yaml` | Los 21 requisitos de las bases oficiales |
| `equipos.yaml` | Equipos. `perfil_premium: true` activa galería, contacto y patrocinadores propios |
| `jugadores.yaml` | Plantillas. **Solo datos públicos** (nombre, número, posición, foto). Nada de CURP, teléfono o fecha de nacimiento |
| `partidos.yaml` | Rol de juegos y resultados |
| `sedes.yaml` | Canchas con dirección y ubicación (lat/lng para el mapa) |
| `arbitros.yaml` | Directorio. `destacado: true` = perfil pagado. Publica `whatsapp` solo con su permiso |
| `patrocinadores.yaml` | Marcas, nivel y `ubicaciones` donde aparecen (`home-top`, `tabla`, `partido`, `jornada`, `footer`) |
| `paquetes.yaml` | Paquetes y precios de la página Anúnciate |

Los `id` van en minúsculas con guiones (`deportivo-colmena`). Los logos y fotos van en
`public/img/...` y se referencian como `/img/equipos/colmena.png`.

## Monetización

- **Patrocinadores**: cada espacio vacío muestra "Tu marca aquí → Anúnciate".
- **Equipos premium** y **árbitros destacados**: se activan con un campo en el YAML.
- **Reporte para patrocinadores**: GA4 (`G-F9R7J9Z08H`, el mismo que solofutbolamateur.com) registra
  los eventos `click_patrocinador` y `click_whatsapp` con el `item_id` de cada marca/paquete/árbitro.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:4321
npm test         # pruebas de los cálculos (src/lib/estadisticas.test.ts)
npm run check    # tipos
npm run build
```

Toda la lectura de datos pasa por `src/lib/datos.ts`. Para que árbitros o delegados capturen
resultados desde un panel, se reemplaza esa capa por una base de datos (p. ej. Supabase) con las
mismas tablas y campos; las páginas no cambian.

## Publicación en cPanel (una sola vez)

1. **Subdominio:** cPanel → Dominios → Crear dominio: `supercopa.solofutbolamateur.com`, con raíz
   `public_html/supercopa` (o la que cPanel proponga).
2. **DNS:** donde administres el DNS de solofutbolamateur.com, registro `A` `supercopa` → IP del
   servidor cPanel (si el DNS lo maneja el propio cPanel, se crea solo).
3. **HTTPS:** cPanel → SSL/TLS Status → Run AutoSSL. El `.htaccess` incluido fuerza HTTPS.
4. **Cuenta FTP:** cPanel → Cuentas FTP → crear una con directorio la raíz del subdominio.
5. **Secretos en GitHub** (Settings → Secrets and variables → Actions):
   - `FTP_SERVER`: p. ej. `ftp.solofutbolamateur.com`
   - `FTP_USERNAME` / `FTP_PASSWORD`: los de la cuenta FTP
   - `FTP_SERVER_DIR`: `./` si la cuenta FTP ya apunta a la raíz del subdominio
6. Cada push a `main` corre pruebas, compila y sube solo los archivos que cambiaron.

Si el hosting no acepta FTPS, cambia `protocol: ftps` por `ftp` en `.github/workflows/deploy.yml`.
