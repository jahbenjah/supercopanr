# SuperCopa Nicolás Romero

Sitio oficial del torneo: https://supercopa.solofutbolamateur.com

Hecho con [Astro](https://astro.build). Todos los datos viven en `src/data/*.yaml`; las tablas de
posiciones, goleo y disciplina se calculan solas al publicar.

## Capturar resultados (lo más común)

1. Abre `src/data/partidos.yaml` y busca el partido por su `id` (p. ej. `j3-a1`).
2. Cambia `estado: programado` por `estado: jugado` y agrega:

   ```yaml
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
p. ej. 3-0, pero sin goleadores).

## Archivos de datos

| Archivo | Qué contiene |
|---|---|
| `torneo.yaml` | Nombre, temporada, categorías/grupos, formato, puntos, reglas de suspensión, WhatsApp comercial |
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

## Publicación (una sola vez)

1. Crear el repo en GitHub y hacer push.
2. GitHub → Settings → Pages → Source: **GitHub Actions**.
3. En el DNS de solofutbolamateur.com: registro `CNAME` `supercopa` → `<usuario>.github.io`.
4. Settings → Pages → Custom domain: `supercopa.solofutbolamateur.com` y activar **Enforce HTTPS**.
