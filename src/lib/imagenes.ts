// Imágenes para compartir en redes (Facebook/Instagram) generadas en el build.
//  - 'post': 1080×1350 (4:5), el formato que más espacio ocupa en el feed.
//  - 'og':   1200×630, vista previa de enlaces (og:image).
// Se dibujan con Satori, que convierte el texto en trazos con las fuentes de
// src/assets/fonts: el resultado no depende de las fuentes del servidor.
import { readFileSync } from 'node:fs';
import satori from 'satori';
import sharp from 'sharp';
import { datos, fechaSinAnio, iniciales, type Datos } from './datos';
import { NOMBRE_FASE } from './estadisticas';

export type Formato = 'post' | 'og';
export const TAMANO: Record<Formato, { ancho: number; alto: number }> = {
  post: { ancho: 1080, alto: 1350 },
  og: { ancho: 1200, alto: 630 },
};

const C = {
  oro: '#e2b33a',
  oroClaro: '#fbe045',
  cancha: '#1c1a17',
  oscuro: '#0a0907',
  blanco: '#ffffff',
  tenue: 'rgba(255,255,255,0.62)',
  linea: 'rgba(255,255,255,0.12)',
  panel: 'rgba(255,255,255,0.06)',
};

// ── Mini "JSX" para Satori ────────────────────────────────────────────────────
type Hijo = Nodo | string | number | null | undefined | false | Hijo[];
interface Nodo {
  type: string;
  props: Record<string, unknown>;
}
type Estilo = Record<string, string | number>;

function h(type: string, style: Estilo, ...hijos: Hijo[]): Nodo {
  const children = hijos.flat(Infinity as 1).filter((x) => x != null && x !== false) as (Nodo | string | number)[];
  const base = type === 'div' ? { display: 'flex', boxSizing: 'border-box' } : {};
  return { type, props: { style: { ...base, ...style }, children: children.map((c) => (typeof c === 'number' ? String(c) : c)) } };
}
const img = (src: string, size: number, style: Estilo = {}): Nodo => ({
  type: 'img',
  props: { src, width: size, height: size, style: { width: size, height: size, ...style } },
});
const texto = (s: Estilo, t: string | number) => h('div', s, String(t));
const unaLinea: Estilo = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const titular = (size: number, extra: Estilo = {}): Estilo => ({
  fontFamily: 'Barlow Condensed',
  fontWeight: 700,
  fontSize: size,
  lineHeight: 1,
  textTransform: 'uppercase',
  ...extra,
});

// ── Recursos ─────────────────────────────────────────────────────────────────
// Ruta relativa a la raíz del proyecto (el build se ejecuta desde ahí, igual que sharp('public/...')).
const fuente = (f: string) => readFileSync(`src/assets/fonts/${f}`);
let fuentes: Parameters<typeof satori>[1]['fonts'] | undefined;
function cargarFuentes() {
  return (fuentes ??= [
    { name: 'Barlow', data: fuente('Barlow-Regular.ttf'), weight: 400, style: 'normal' },
    { name: 'Barlow', data: fuente('Barlow-SemiBold.ttf'), weight: 600, style: 'normal' },
    { name: 'Barlow', data: fuente('Barlow-Bold.ttf'), weight: 700, style: 'normal' },
    { name: 'Barlow Condensed', data: fuente('BarlowCondensed-SemiBold.ttf'), weight: 600, style: 'normal' },
    { name: 'Barlow Condensed', data: fuente('BarlowCondensed-Bold.ttf'), weight: 700, style: 'normal' },
  ]);
}

const cacheImg = new Map<string, Promise<string>>();
/** Imagen de public/ como data URI, al doble del tamaño en que se dibuja. */
function dataUri(ruta: string, size: number, recorte: 'contain' | 'cover') {
  const clave = `${ruta}|${size}|${recorte}`;
  if (!cacheImg.has(clave)) {
    cacheImg.set(
      clave,
      (async () => {
        let s = sharp(`public${ruta}`).resize(size * 2, size * 2, { fit: recorte, background: { r: 0, g: 0, b: 0, alpha: 0 } });
        const buf = recorte === 'cover' ? await s.jpeg({ quality: 85 }).toBuffer() : await s.png().toBuffer();
        return `data:image/${recorte === 'cover' ? 'jpeg' : 'png'};base64,${buf.toString('base64')}`;
      })(),
    );
  }
  return cacheImg.get(clave)!;
}

type Equipo = Datos['equipos'][number];
type Jugador = Datos['jugadores'][number];

/** Escudo en círculo blanco, o círculo del color del equipo con sus iniciales. */
async function escudo(e: Equipo, size: number): Promise<Nodo> {
  if (e.logo) {
    const interior = Math.round(size * 0.84);
    return h('div', { width: size, height: size, borderRadius: size, background: C.blanco, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }, img(await dataUri(e.logo, interior, 'contain'), interior));
  }
  return h(
    'div',
    { width: size, height: size, borderRadius: size, background: e.color, alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `2px solid ${C.blanco}` },
    texto(titular(Math.round(size * 0.4)), iniciales(e.nombre)),
  );
}

async function foto(j: Jugador, size: number, borde = C.oro): Promise<Nodo> {
  const marco: Estilo = { width: size, height: size, borderRadius: size, border: `4px solid ${borde}`, flexShrink: 0, overflow: 'hidden' };
  if (j.foto) return h('div', marco, img(await dataUri(j.foto, size, 'cover'), size - 8, { objectFit: 'cover' }));
  return h('div', { ...marco, background: C.cancha, alignItems: 'center', justifyContent: 'center' }, texto(titular(size * 0.4, { color: C.oro }), j.numero ?? '?'));
}

// ── Marcos ───────────────────────────────────────────────────────────────────
const dominio = () => new URL(import.meta.env.SITE ?? 'https://supercopanr.solofutbolamateur.com').host;

async function marcoPost(d: Datos, titulo: string, subtitulo: string | undefined, contenido: Hijo): Promise<Nodo> {
  const { ancho, alto } = TAMANO.post;
  return h(
    'div',
    {
      width: ancho,
      height: alto,
      flexDirection: 'column',
      padding: '56px 64px 44px',
      color: C.blanco,
      fontFamily: 'Barlow',
      backgroundColor: C.oscuro,
      backgroundImage: `radial-gradient(circle at 100% 0%, rgba(226,179,58,0.28), rgba(226,179,58,0) 45%), linear-gradient(160deg, ${C.cancha}, ${C.oscuro} 65%)`,
    },
    h(
      'div',
      { alignItems: 'center', gap: 28 },
      img(await dataUri('/logo-oficial.jpg', 120, 'cover'), 120, { borderRadius: 120, border: `4px solid ${C.oro}` }),
      h(
        'div',
        { flexDirection: 'column', flex: 1 },
        texto(titular(28, { color: C.oro, letterSpacing: 3, fontWeight: 600 }), `${d.torneo.nombre} ${d.torneo.temporada}`),
        texto(titular(titulo.length > 16 ? 72 : 84, { marginTop: 4 }), titulo),
        subtitulo ? texto({ fontSize: 28, color: C.tenue, marginTop: 6 }, subtitulo) : null,
      ),
    ),
    h('div', { width: 140, height: 6, background: C.oro, borderRadius: 3, marginTop: 22, marginBottom: 26, flexShrink: 0 }),
    // Área de contenido: ~1040 px de alto.
    h('div', { flex: 1, flexDirection: 'column', minHeight: 0, overflow: 'hidden' }, contenido),
    h(
      'div',
      { justifyContent: 'space-between', alignItems: 'center', borderTop: `2px solid ${C.linea}`, paddingTop: 18, marginTop: 20, flexShrink: 0 },
      texto(titular(30, { color: C.oro, textTransform: 'none', letterSpacing: 1 }), dominio()),
      texto({ fontSize: 24, color: C.tenue }, `${d.torneo.edicion} · ${d.torneo.sede_general.split(',')[0]}`),
    ),
  );
}

async function marcoOg(d: Datos, titulo: string, subtitulo: string, cifras: [string, string][]): Promise<Nodo> {
  const { ancho, alto } = TAMANO.og;
  return h(
    'div',
    {
      width: ancho,
      height: alto,
      padding: '56px 64px',
      alignItems: 'center',
      gap: 48,
      color: C.blanco,
      fontFamily: 'Barlow',
      backgroundColor: C.oscuro,
      backgroundImage: `radial-gradient(circle at 100% 0%, rgba(226,179,58,0.3), rgba(226,179,58,0) 50%), linear-gradient(150deg, ${C.cancha}, ${C.oscuro} 70%)`,
    },
    h(
      'div',
      { flex: 1, flexDirection: 'column' },
      texto(titular(28, { color: C.oro, letterSpacing: 3, fontWeight: 600 }), `${d.torneo.nombre} ${d.torneo.temporada}`),
      texto(titular(104, { marginTop: 8 }), titulo),
      texto({ fontSize: 30, color: C.tenue, marginTop: 12, lineHeight: 1.25 }, subtitulo),
      h('div', { width: 120, height: 6, background: C.oro, borderRadius: 3, marginTop: 28, marginBottom: 28 }),
      h(
        'div',
        { gap: 44 },
        cifras.map(([v, t]) => h('div', { flexDirection: 'column' }, texto(titular(64, { color: C.oro }), v), texto({ fontSize: 22, color: C.tenue, marginTop: 4 }, t))),
      ),
    ),
    img(await dataUri('/logo-oficial.jpg', 340, 'cover'), 340, { borderRadius: 340, border: `6px solid ${C.oro}` }),
  );
}

// ── Piezas reutilizables ──────────────────────────────────────────────────────
const diaCorto = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
const dec = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const panel = (extra: Estilo = {}): Estilo => ({ background: C.panel, border: `2px solid ${C.linea}`, borderRadius: 20, ...extra });

const ordenGrupo = (d: Datos, g: string) =>
  d.equipos.filter((e) => e.grupo === g).sort((a, b) => (a.posicion ?? 99) - (b.posicion ?? 99));

async function filaJugador(d: Datos, j: Jugador, i: number, dato: string, sufijo: string, alto: number) {
  const e = d.por.equipos.get(j.equipo_id)!;
  const fotoSize = alto - 24;
  return h(
    'div',
    { ...panel({ padding: '12px 24px 12px 16px' }), alignItems: 'center', gap: 22, height: alto },
    texto(titular(44, { color: 'rgba(255,255,255,0.35)', width: 34 }), i + 1),
    await foto(j, fotoSize, i === 0 ? C.oroClaro : C.oro),
    h(
      'div',
      { flexDirection: 'column', flex: 1, minWidth: 0 },
      texto(titular(i === 0 ? 46 : 40, { ...unaLinea, textTransform: 'none' }), j.nombre),
      h('div', { alignItems: 'center', gap: 10, marginTop: 8 }, await escudo(e, 32), texto({ fontSize: 24, color: C.tenue, ...unaLinea }, [e.nombre, j.posicion].filter(Boolean).join(' · '))),
    ),
    h('div', { flexDirection: 'column', alignItems: 'center' }, texto(titular(i === 0 ? 92 : 76, { color: C.oro }), dato), texto(titular(22, { color: C.tenue, fontWeight: 600 }), sufijo)),
  );
}

// ── Catálogo de imágenes ─────────────────────────────────────────────────────
export interface ImagenCompartir {
  id: string;
  seccion: string;
  titulo: string;
  formato: Formato;
  /** Texto sugerido para la publicación. */
  texto: string;
  /** Página del sitio a la que corresponde. */
  pagina: string;
  dibujar: () => Promise<Nodo>;
}

export async function imagenesCompartir(): Promise<ImagenCompartir[]> {
  const d = await datos();
  const t = d.torneo;
  const sitio = `https://${dominio()}`;
  const hashtags = '#SupercopaNicolasRomero #FutbolAmateur #NicolasRomero';
  const s = d.plantillas;
  const c = d.competencia;
  const grupos = t.categorias.flatMap((x) => x.grupos).filter((g) => d.equipos.some((e) => e.grupo === g));
  const lista: ImagenCompartir[] = [];

  // Grupos
  if (grupos.length) {
    lista.push({
      id: 'grupos',
      seccion: 'Grupos',
      titulo: 'Todos los grupos',
      formato: 'post',
      pagina: '/grupos/',
      texto: `🏆 ¡Así quedaron los grupos de la ${t.nombre} ${t.temporada}! ${d.equipos.length} equipos en ${grupos.length} grupos. ¿Quién se lleva la copa? ⚽\n\n👉 ${sitio}/grupos/\n\n${hashtags}`,
      dibujar: async () =>
        marcoPost(
          d,
          'Grupos',
          `${d.equipos.length} equipos · ${grupos.length} grupos`,
          h(
            'div',
            { flexWrap: 'wrap', gap: 18, alignContent: 'flex-start' },
            await Promise.all(
              grupos.map(async (g) =>
                h(
                  'div',
                  { ...panel({ padding: '10px 18px' }), flexDirection: 'column', width: 467, gap: 4 },
                  texto(titular(30, { color: C.oro, letterSpacing: 2 }), `Grupo ${g}`),
                  await Promise.all(
                    ordenGrupo(d, g).map(async (e) =>
                      h('div', { alignItems: 'center', gap: 14, height: 52 }, await escudo(e, 48), texto(titular(28, { textTransform: 'none', fontWeight: 600, ...unaLinea, flex: 1 }), e.nombre)),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
    });
  }

  // Posiciones: todas y por grupo
  if (d.posiciones.length) {
    const col = (v: string | number, ancho: number, estilo: Estilo = {}) => texto({ width: ancho, justifyContent: 'center', fontSize: 24, ...estilo }, v);
    lista.push({
      id: 'posiciones',
      seccion: 'Posiciones',
      titulo: 'Tabla general por grupos',
      formato: 'post',
      pagina: '/posiciones/',
      texto: `📊 Tabla de posiciones de la ${t.nombre}${d.ultimaFecha ? ` después de la fecha del ${fechaSinAnio(d.ultimaFecha)}` : ''}. Avanzan los ${t.clasifican_por_grupo} primeros de cada grupo.\n\n👉 ${sitio}/posiciones/\n\n${hashtags}`,
      dibujar: async () =>
        marcoPost(
          d,
          'Posiciones',
          d.ultimaFecha ? `Actualizada al ${fechaSinAnio(d.ultimaFecha)}` : 'Antes de la primera jornada',
          h(
            'div',
            { flexWrap: 'wrap', gap: 18, alignContent: 'flex-start' },
            await Promise.all(
              d.posiciones.map(async (tabla) =>
                h(
                  'div',
                  { ...panel({ padding: '12px 16px' }), flexDirection: 'column', width: 467 },
                  h('div', { alignItems: 'center', marginBottom: 4 }, texto(titular(28, { color: C.oro, letterSpacing: 2, flex: 1 }), `Grupo ${tabla.grupo}`), col('PJ', 50, { color: C.tenue, fontSize: 18 }), col('DIF', 54, { color: C.tenue, fontSize: 18 }), col('PTS', 56, { color: C.tenue, fontSize: 18 })),
                  await Promise.all(
                    tabla.filas.map(async (f, i) => {
                      const e = d.por.equipos.get(f.equipo_id)!;
                      const clasifica = i < t.clasifican_por_grupo;
                      return h(
                        'div',
                        { alignItems: 'center', gap: 10, height: 52, borderTop: `1px solid ${C.linea}` },
                        h('div', { width: 5, height: 30, borderRadius: 3, background: clasifica ? C.oro : 'transparent' }),
                        await escudo(e, 38),
                        texto(titular(25, { textTransform: 'none', fontWeight: 600, flex: 1, ...unaLinea }), e.nombre),
                        col(f.pj, 50),
                        col(f.dif > 0 ? `+${f.dif}` : f.dif, 54),
                        col(f.pts, 56, { ...titular(32, { color: C.oro }), display: 'flex', justifyContent: 'center' }),
                      );
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
    });

    for (const tabla of d.posiciones) {
      const partidosGrupo = d.partidos.filter((p) => p.fase === 'grupos' && p.grupo === tabla.grupo);
      lista.push({
        id: `posiciones-grupo-${tabla.grupo.toLowerCase()}`,
        seccion: 'Posiciones',
        titulo: `Grupo ${tabla.grupo}`,
        formato: 'post',
        pagina: '/posiciones/',
        texto: `📊 Así va el Grupo ${tabla.grupo} de la ${t.nombre}: ${tabla.filas.map((f, i) => `${i + 1}. ${d.por.equipos.get(f.equipo_id)!.nombre} (${f.pts} pts)`).join(', ')}.\n\n👉 ${sitio}/posiciones/\n\n${hashtags}`,
        dibujar: async () =>
          marcoPost(
            d,
            `Grupo ${tabla.grupo}`,
            'Tabla de posiciones',
            h(
              'div',
              { flexDirection: 'column', gap: 26 },
              h(
                'div',
                { ...panel({ padding: '8px 20px 12px' }), flexDirection: 'column' },
                h('div', { alignItems: 'center', height: 44, color: C.tenue }, texto({ flex: 1, fontSize: 20 }, 'EQUIPO'), ['PJ', 'G', 'E', 'P', 'GF', 'GC', 'DIF'].map((x) => col(x, 52, { fontSize: 20 })), col('PTS', 70, { fontSize: 20 })),
                await Promise.all(
                  tabla.filas.map(async (f, i) => {
                    const e = d.por.equipos.get(f.equipo_id)!;
                    return h(
                      'div',
                      { alignItems: 'center', height: 104, borderTop: `1px solid ${C.linea}`, gap: 14 },
                      h('div', { width: 6, height: 60, borderRadius: 3, background: i < t.clasifican_por_grupo ? C.oro : 'transparent' }),
                      await escudo(e, 72),
                      texto(titular(32, { textTransform: 'none', fontWeight: 600, flex: 1 }), e.nombre),
                      [f.pj, f.g, f.e, f.p, f.gf, f.gc, f.dif > 0 ? `+${f.dif}` : f.dif].map((x) => col(x, 52, { fontSize: 28 })),
                      col(f.pts, 70, { ...titular(46, { color: C.oro }), display: 'flex', justifyContent: 'center' }),
                    );
                  }),
                ),
              ),
              partidosGrupo.length
                ? h(
                    'div',
                    { flexDirection: 'column', gap: 10 },
                    texto(titular(28, { color: C.oro, letterSpacing: 2 }), 'Partidos del grupo'),
                    partidosGrupo.map((p) => {
                      const jugado = p.goles_local != null && p.goles_visitante != null && p.estado !== 'programado';
                      return h(
                        'div',
                        { ...panel({ padding: '0 20px', borderRadius: 14 }), alignItems: 'center', height: 64, gap: 16 },
                        texto({ width: 150, fontSize: 22, color: C.tenue }, p.jornada ? `Jornada ${p.jornada}` : fechaSinAnio(p.fecha)),
                        texto(titular(26, { textTransform: 'none', fontWeight: 600, flex: 1, justifyContent: 'flex-end', ...unaLinea }), d.por.equipos.get(p.local_id)!.nombre),
                        texto(titular(30, { color: jugado ? C.oro : C.tenue, width: 96, justifyContent: 'center' }), jugado ? `${p.goles_local} – ${p.goles_visitante}` : 'vs'),
                        texto(titular(26, { textTransform: 'none', fontWeight: 600, flex: 1, ...unaLinea }), d.por.equipos.get(p.visitante_id)!.nombre),
                      );
                    }),
                  )
                : null,
            ),
          ),
      });
    }
  }

  // Jornadas (partidos por fecha de juego)
  const jornadas = Map.groupBy(d.partidos, (p) => (p.fase === 'grupos' ? `jornada-${p.jornada ?? 0}` : p.fase));
  for (const [clave, ps] of jornadas) {
    const nombre = ps[0].fase === 'grupos' ? `Jornada ${ps[0].jornada ?? ''}`.trim() : NOMBRE_FASE[ps[0].fase];
    const fechas = [...new Set(ps.map((p) => fechaSinAnio(p.fecha)))];
    const jugados = ps.filter((p) => p.goles_local != null && p.goles_visitante != null && p.estado !== 'programado');
    const conResultado = jugados.length === ps.length;
    lista.push({
      id: clave,
      seccion: 'Jornadas',
      titulo: `${nombre}${conResultado ? ' · resultados' : ''}`,
      formato: 'post',
      pagina: conResultado ? '/resultados/' : '/calendario/',
      texto: conResultado
        ? `⚽ Resultados de la ${nombre} de la ${t.nombre}:\n${ps.map((p) => `${d.por.equipos.get(p.local_id)!.nombre} ${p.goles_local}-${p.goles_visitante} ${d.por.equipos.get(p.visitante_id)!.nombre}`).join('\n')}\n\n👉 ${sitio}/resultados/\n\n${hashtags}`
        : `🗓️ ${nombre} de la ${t.nombre}: ${cap(fechas.join(' y '))}. ¡Ven a apoyar a tu equipo!\n${ps.map((p) => `${d.por.equipos.get(p.local_id)!.nombre} vs ${d.por.equipos.get(p.visitante_id)!.nombre}${p.hora ? ` · ${p.hora}` : ''}`).join('\n')}\n\n👉 ${sitio}/calendario/\n\n${hashtags}`,
      dibujar: async () => {
        const alto = Math.min(118, Math.floor((930 - 12 * (ps.length - 1)) / ps.length));
        const logo = Math.min(64, alto - 26);
        return marcoPost(
          d,
          nombre,
          cap(fechas.join(' y ')),
          h(
            'div',
            { flexDirection: 'column', gap: 12 },
            await Promise.all(
              ps.map(async (p) => {
                const local = d.por.equipos.get(p.local_id)!;
                const visita = d.por.equipos.get(p.visitante_id)!;
                const jugado = jugados.includes(p);
                const nombreEq = (e: Equipo, lado: 'izq' | 'der') =>
                  texto(titular(28, { textTransform: 'none', fontWeight: 600, flex: 1, lineHeight: 1.05, justifyContent: lado === 'izq' ? 'flex-end' : 'flex-start', textAlign: lado === 'izq' ? 'right' : 'left' }), e.nombre);
                const detalle = [p.grupo && `Grupo ${p.grupo}`, fechas.length > 1 && diaCorto.format(p.fecha).replace('.', ''), p.hora].filter(Boolean).join(' · ');
                return h(
                  'div',
                  { ...panel({ padding: '0 20px' }), alignItems: 'center', gap: 16, height: alto },
                  nombreEq(local, 'izq'),
                  await escudo(local, logo),
                  h(
                    'div',
                    { flexDirection: 'column', alignItems: 'center', width: 150 },
                    texto(titular(jugado ? 46 : 36, { color: jugado ? C.oro : C.blanco }), jugado ? `${p.goles_local}–${p.goles_visitante}` : 'VS'),
                    detalle ? texto({ fontSize: 18, color: C.tenue, marginTop: 4, whiteSpace: 'nowrap' }, detalle) : null,
                  ),
                  await escudo(visita, logo),
                  nombreEq(visita, 'der'),
                );
              }),
            ),
          ),
        );
      },
    });
  }

  // Goleadores
  if (d.goleadores.length) {
    const top = d.goleadores.slice(0, 8);
    lista.push({
      id: 'goleadores',
      seccion: 'Goleadores',
      titulo: 'Tabla de goleo',
      formato: 'post',
      pagina: '/goleadores/',
      texto: `⚽🔥 Tabla de goleo de la ${t.nombre}. ${d.por.jugadores.get(top[0].jugador_id)!.nombre} manda con ${top[0].goles} goles.\n\n👉 ${sitio}/goleadores/\n\n${hashtags}`,
      dibujar: async () =>
        marcoPost(
          d,
          'Goleadores',
          d.ultimaFecha ? `Actualizada al ${fechaSinAnio(d.ultimaFecha)}` : undefined,
          h('div', { flexDirection: 'column', gap: 12 }, await Promise.all(top.map((g, i) => filaJugador(d, d.por.jugadores.get(g.jugador_id)!, i, String(g.goles), g.goles === 1 ? 'gol' : 'goles', 112)))),
        ),
    });
  }

  // Estadísticas de jugadores
  if (s.conEdad) {
    const masJoven = s.masJovenes[0];
    const masGrande = s.veteranos[0];
    const tarjetaRecord = async (titulo: string, j: Jugador & { edad: number }, fondo: string, tinta: string) =>
      h(
        'div',
        { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 24, padding: '28px 20px', background: fondo, color: tinta },
        texto(titular(28, { letterSpacing: 2, fontWeight: 600 }), titulo),
        h('div', { marginTop: 18 }, await foto(j, 200, tinta === C.oscuro ? C.oscuro : C.oro)),
        texto(titular(40, { marginTop: 18, textTransform: 'none', textAlign: 'center', justifyContent: 'center' }), j.nombre),
        texto({ fontSize: 22, marginTop: 6, opacity: 0.8, textAlign: 'center' }, d.por.equipos.get(j.equipo_id)!.nombre),
        h('div', { alignItems: 'flex-end', gap: 8, marginTop: 14 }, texto(titular(110), j.edad), texto(titular(32, { marginBottom: 12 }), 'años')),
      );

    lista.push({
      id: 'estadisticas-resumen',
      seccion: 'Estadísticas',
      titulo: 'El torneo en números',
      formato: 'post',
      pagina: '/estadisticas/',
      texto: `🔢 La ${t.nombre} en números: ${s.total} jugadores, ${d.equipos.length} equipos y una edad promedio de ${dec.format(s.promedioEdad!)} años. El más joven tiene ${masJoven.edad} y el más experimentado ${masGrande.edad}. 💪\n\n👉 ${sitio}/estadisticas/\n\n${hashtags}`,
      dibujar: async () =>
        marcoPost(
          d,
          'En números',
          'Las plantillas de la Supercopa',
          h(
            'div',
            { flexDirection: 'column', gap: 24, flex: 1 },
            h(
              'div',
              { gap: 18 },
              [
                [String(s.total), 'jugadores'],
                [String(d.equipos.length), 'equipos'],
                [dec.format(s.promedioEdad!), 'edad promedio'],
                [String(s.menoresDeEdad), 'menores de 18'],
              ].map(([v, l]) => h('div', { ...panel({ padding: '20px 10px' }), flex: 1, flexDirection: 'column', alignItems: 'center' }, texto(titular(72, { color: C.oro }), v), texto({ fontSize: 22, color: C.tenue, marginTop: 6 }, l))),
            ),
            h('div', { gap: 20, flex: 1 }, await tarjetaRecord('El más joven', masJoven, C.oro, C.oscuro), await tarjetaRecord('El más experimentado', masGrande, C.cancha, C.blanco)),
          ),
        ),
    });

    for (const [id, titulo, sub, lista5, emoji] of [
      ['estadisticas-jovenes', 'Los más jóvenes', 'Las promesas del torneo', s.masJovenes, '🌟'],
      ['estadisticas-veteranos', 'Los más experimentados', 'La experiencia también juega', s.veteranos, '🎖️'],
    ] as const) {
      lista.push({
        id,
        seccion: 'Estadísticas',
        titulo,
        formato: 'post',
        pagina: '/estadisticas/',
        texto: `${emoji} ${titulo} de la ${t.nombre}:\n${lista5.map((j, i) => `${i + 1}. ${j.nombre} (${d.por.equipos.get(j.equipo_id)!.nombre}) · ${j.edad} años`).join('\n')}\n\n👉 ${sitio}/estadisticas/\n\n${hashtags}`,
        dibujar: async () =>
          marcoPost(d, titulo, sub, h('div', { flexDirection: 'column', gap: 16 }, await Promise.all(lista5.map((j, i) => filaJugador(d, j, i, String(j.edad), 'años', 166))))),
      });
    }

    lista.push({
      id: 'estadisticas-edad-equipos',
      seccion: 'Estadísticas',
      titulo: 'Edad promedio por equipo',
      formato: 'post',
      pagina: '/estadisticas/',
      texto: `👶👴 ¿Qué equipo es el más joven de la ${t.nombre}? ${d.por.equipos.get(s.porEquipo[0].equipo_id)!.nombre} promedia ${dec.format(s.porEquipo[0].promedioEdad!)} años y ${d.por.equipos.get(s.porEquipo.at(-1)!.equipo_id)!.nombre} es el más experimentado con ${dec.format(s.porEquipo.at(-1)!.promedioEdad!)}.\n\n👉 ${sitio}/estadisticas/\n\n${hashtags}`,
      dibujar: async () => {
        const filas = s.porEquipo.filter((e) => e.promedioEdad != null);
        const min = Math.min(...filas.map((e) => e.menor!));
        const max = Math.max(...filas.map((e) => e.mayor!));
        const pista = 330;
        const x = (v: number) => ((v - min) / Math.max(1, max - min)) * pista;
        const alto = Math.floor(920 / filas.length);
        return marcoPost(
          d,
          'Edad por equipo',
          'Del más joven al más experimentado',
          h(
            'div',
            { flexDirection: 'column' },
            h('div', { alignItems: 'center', height: 28, color: C.tenue, fontSize: 18 }, texto({ flex: 1 }, `Barra: del más joven (${min}) al más grande (${max}) · punto: promedio`), texto({ width: 80, justifyContent: 'flex-end' }, 'PROM.')),
            await Promise.all(
              filas.map(async (e, i) =>
                h(
                  'div',
                  { alignItems: 'center', height: alto, gap: 12, borderTop: `1px solid ${C.linea}` },
                  texto(titular(22, { width: 30, color: 'rgba(255,255,255,0.4)' }), i + 1),
                  await escudo(d.por.equipos.get(e.equipo_id)!, alto - 10),
                  texto(titular(Math.min(26, alto - 12), { textTransform: 'none', fontWeight: 600, flex: 1, ...unaLinea }), d.por.equipos.get(e.equipo_id)!.nombre),
                  h(
                    'div',
                    { width: pista, height: alto, position: 'relative' },
                    h('div', { position: 'absolute', left: x(e.menor!), width: Math.max(4, x(e.mayor!) - x(e.menor!)), top: alto / 2 - 3, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.25)' }),
                    h('div', { position: 'absolute', left: x(e.promedioEdad!) - 9, top: alto / 2 - 9, width: 18, height: 18, borderRadius: 18, background: C.oro, border: `3px solid ${C.oscuro}` }),
                  ),
                  texto(titular(30, { width: 80, justifyContent: 'flex-end', color: i === 0 || i === filas.length - 1 ? C.oro : C.blanco }), dec.format(e.promedioEdad!)),
                ),
              ),
            ),
          ),
        );
      },
    });

    lista.push({
      id: 'estadisticas-edades',
      seccion: 'Estadísticas',
      titulo: 'Edades y posiciones',
      formato: 'post',
      pagina: '/estadisticas/',
      texto: `📈 ¿Cuántos años tienen los jugadores de la ${t.nombre}? El grupo más numeroso es el de ${[...s.rangos].sort((a, b) => b.jugadores - a.jugadores)[0].etiqueta} años. Hay ${s.porPosicion.map((p) => `${p.jugadores} ${p.posicion === 'Portero' ? 'porteros' : p.posicion.toLowerCase() + 's'}`).join(', ')}.\n\n👉 ${sitio}/estadisticas/\n\n${hashtags}`,
      dibujar: async () => {
        const maxR = Math.max(...s.rangos.map((r) => r.jugadores));
        const pct = (n: number, de: number) => `${Math.round((n / de) * 100)}%`;
        return marcoPost(
          d,
          'Edades',
          `${s.conEdad} jugadores por rango de edad`,
          h(
            'div',
            { flexDirection: 'column', gap: 28 },
            h(
              'div',
              { ...panel({ padding: '20px 28px' }), flexDirection: 'column', gap: 12 },
              s.rangos.map((r) =>
                h(
                  'div',
                  { alignItems: 'center', height: 58, gap: 18 },
                  texto(titular(28, { width: 150, fontWeight: 600, textTransform: 'none' }), r.etiqueta),
                  h('div', { flex: 1, height: 40 }, h('div', { width: `${(r.jugadores / maxR) * 100}%`, minWidth: 6, height: 40, background: C.oro, borderRadius: '0 8px 8px 0' })),
                  texto(titular(36, { width: 70, justifyContent: 'flex-end' }), r.jugadores),
                  texto({ width: 66, justifyContent: 'flex-end', fontSize: 22, color: C.tenue }, pct(r.jugadores, s.conEdad)),
                ),
              ),
            ),
            texto(titular(28, { color: C.oro, letterSpacing: 2 }), 'Por posición'),
            h(
              'div',
              { gap: 16 },
              s.porPosicion.map((p) =>
                h(
                  'div',
                  { ...panel({ padding: '18px 10px' }), flex: 1, flexDirection: 'column', alignItems: 'center' },
                  texto(titular(26, { fontWeight: 600 }), p.posicion),
                  texto(titular(64, { color: C.oro, marginTop: 6 }), p.jugadores),
                  texto({ fontSize: 20, color: C.tenue, marginTop: 4 }, `${pct(p.jugadores, s.total)} · ${p.promedioEdad != null ? dec.format(p.promedioEdad) : '—'} años`),
                ),
              ),
            ),
          ),
        );
      },
    });
  }

  // Vistas previas de enlaces (og:image) de las páginas
  const pts = (n: number) => String(n);
  const og = (id: string, pagina: string, titulo: string, sub: string, cifras: [string, string][]) =>
    lista.push({ id: `og-${id}`, seccion: 'Vista previa de enlaces', titulo, formato: 'og', pagina, texto: '', dibujar: () => marcoOg(d, titulo, sub, cifras) });
  if (s.conEdad)
    og('estadisticas', '/estadisticas/', 'Estadísticas', 'Edades, plantillas, goles y tarjetas', [
      [pts(s.total), 'jugadores'],
      [dec.format(s.promedioEdad!), 'edad promedio'],
      [c.jugados ? dec.format(c.golesPorPartido!) : pts(s.masJovenes[0].edad), c.jugados ? 'goles por partido' : 'años, el más joven'],
    ]);
  og('grupos', '/grupos/', 'Grupos', `${d.equipos.length} equipos en ${grupos.length} grupos`, [
    [pts(d.equipos.length), 'equipos'],
    [pts(grupos.length), 'grupos'],
    [pts(t.clasifican_por_grupo), 'avanzan por grupo'],
  ]);
  og('posiciones', '/posiciones/', 'Posiciones', d.ultimaFecha ? `Actualizada al ${fechaSinAnio(d.ultimaFecha)}` : 'Tabla por grupo', [
    [pts(c.jugados), 'partidos jugados'],
    [pts(c.goles), 'goles'],
    [pts(grupos.length), 'grupos'],
  ]);
  og('goleadores', '/goleadores/', 'Goleadores', 'Tabla de goleo individual', [
    [pts(c.goles), 'goles'],
    [c.golesPorPartido != null ? dec.format(c.golesPorPartido) : '—', 'por partido'],
  ]);

  return lista;
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

/** PNG listo para subir. */
export async function renderizar(imagen: ImagenCompartir) {
  const { ancho, alto } = TAMANO[imagen.formato];
  const svg = await satori((await imagen.dibujar()) as Parameters<typeof satori>[0], { width: ancho, height: alto, fonts: cargarFuentes() });
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9, effort: 10 }).toBuffer();
}
