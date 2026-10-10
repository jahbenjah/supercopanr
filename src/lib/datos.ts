// Única capa de acceso a datos del sitio. Hoy lee los YAML de src/data; para migrar
// a una base de datos (p. ej. Supabase) basta con reimplementar cargar() devolviendo
// las mismas estructuras.
import { getCollection, type CollectionEntry, type CollectionKey } from 'astro:content';
import {
  calcularPosiciones,
  disciplina,
  erroresDePartido,
  goleadores,
  ordenarPartidos,
  proximaFecha,
  ultimaFechaJugada,
} from './estadisticas';

async function tabla<C extends CollectionKey>(nombre: C): Promise<Array<CollectionEntry<C>['data'] & { id: string }>> {
  const entradas = await getCollection(nombre);
  return entradas.map((e) => ({ ...e.data, id: e.id }));
}

async function cargar() {
  const [torneos, bases, sedes, equipos, jugadores, arbitros, partidosSinOrden, patrocinadores, paquetes] = await Promise.all([
    tabla('torneo'),
    tabla('bases'),
    tabla('sedes'),
    tabla('equipos'),
    tabla('jugadores'),
    tabla('arbitros'),
    tabla('partidos'),
    tabla('patrocinadores'),
    tabla('paquetes'),
  ]);
  const torneo = torneos.find((t) => t.id === 'actual');
  if (!torneo) throw new Error('src/data/torneo.yaml debe tener una entrada con id: actual');
  const partidos = ordenarPartidos(partidosSinOrden);

  const idx = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));
  const m = {
    sedes: idx(sedes),
    equipos: idx(equipos),
    jugadores: idx(jugadores),
    arbitros: idx(arbitros),
    partidos: idx(partidos),
    patrocinadores: idx(patrocinadores),
  };

  // Integridad referencial: el build falla con un mensaje claro si algo no cuadra.
  const errores: string[] = [];
  const existe = (mapa: Map<string, unknown>, id: string | undefined, donde: string, que: string) => {
    if (id && !mapa.has(id)) errores.push(`${donde}: ${que} "${id}" no existe`);
  };
  for (const e of equipos) {
    const donde = `equipos.yaml (${e.id})`;
    const cat = torneo.categorias.find((c) => c.id === e.categoria);
    if (!cat) errores.push(`${donde}: categoría "${e.categoria}" no está en torneo.yaml`);
    else if (e.grupo && !cat.grupos.includes(e.grupo)) errores.push(`${donde}: el grupo "${e.grupo}" no existe en la categoría`);
    existe(m.sedes, e.sede_id, donde, 'sede_id');
    for (const p of e.patrocinadores_ids) existe(m.patrocinadores, p, donde, 'patrocinador');
  }
  const porGrupo = Map.groupBy(equipos.filter((e) => e.grupo), (e) => `${e.categoria} grupo ${e.grupo}`);
  for (const [g, es] of porGrupo) {
    if (es.length > torneo.equipos_por_grupo) errores.push(`equipos.yaml: ${g} tiene ${es.length} equipos (máximo ${torneo.equipos_por_grupo})`);
  }
  const plantillas = Map.groupBy(jugadores, (j) => j.equipo_id);
  for (const [eq, js] of plantillas) {
    if (js.length > torneo.max_jugadores) errores.push(`jugadores.yaml: ${eq} tiene ${js.length} jugadores (máximo ${torneo.max_jugadores})`);
  }
  for (const j of jugadores) existe(m.equipos, j.equipo_id, `jugadores.yaml (${j.id})`, 'equipo_id');
  const equipoDeJugador = new Map(jugadores.map((j) => [j.id, j.equipo_id]));
  for (const p of partidos) {
    const donde = `partidos.yaml (${p.id})`;
    existe(m.equipos, p.local_id, donde, 'local_id');
    existe(m.equipos, p.visitante_id, donde, 'visitante_id');
    existe(m.sedes, p.sede_id, donde, 'sede_id');
    existe(m.arbitros, p.arbitro_id, donde, 'arbitro_id');
    existe(m.patrocinadores, p.patrocinador_jornada_id, donde, 'patrocinador_jornada_id');
    for (const e of [...p.goles, ...p.tarjetas]) existe(m.jugadores, e.jugador_id, donde, 'jugador_id');
    for (const err of erroresDePartido(p, equipoDeJugador)) errores.push(`${donde}: ${err}`);
  }
  if (errores.length) throw new Error(`Datos inválidos en src/data:\n  - ${errores.join('\n  - ')}`);

  return {
    torneo,
    bases: [...bases].sort((a, b) => a.numero - b.numero),
    sedes,
    equipos: [...equipos].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    jugadores,
    arbitros: [...arbitros].sort((a, b) => Number(b.destacado) - Number(a.destacado) || a.nombre.localeCompare(b.nombre, 'es')),
    partidos,
    patrocinadores,
    paquetes: [...paquetes].sort((a, b) => (b.precio ?? 0) - (a.precio ?? 0)),
    // Índices por id: d.por.equipos.get(id), etc.
    por: m,
    posiciones: calcularPosiciones(equipos, partidos, torneo.puntos),
    goleadores: goleadores(partidos, jugadores),
    disciplina: disciplina(partidos, jugadores, torneo),
    proximaFecha: proximaFecha(partidos),
    ultimaFecha: ultimaFechaJugada(partidos),
  };
}

let cache: ReturnType<typeof cargar> | undefined;

/** Todos los datos del torneo ya validados, con índices por id y estadísticas calculadas. */
export function datos() {
  return (cache ??= cargar());
}

export type Datos = Awaited<ReturnType<typeof cargar>>;
export type Partido = Datos['partidos'][number];
export type Equipo = Datos['equipos'][number];
export type Patrocinador = Datos['patrocinadores'][number];
export type Ubicacion = 'home-top' | 'tabla' | 'partido' | 'jornada' | 'footer';

const orden = { oro: 0, plata: 1, bronce: 2, equipo: 3 } as const;

export function patrocinadoresEn(d: Datos, ubicacion: Ubicacion) {
  return d.patrocinadores.filter((p) => p.ubicaciones.includes(ubicacion)).sort((a, b) => orden[a.nivel] - orden[b.nivel]);
}

export function partidosDeEquipo(d: Datos, equipoId: string) {
  return d.partidos.filter((p) => p.local_id === equipoId || p.visitante_id === equipoId);
}

export function nombreCategoria(d: Datos, id: string) {
  return d.torneo.categorias.find((c) => c.id === id)?.nombre ?? id;
}

const fmtFecha = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtFechaLarga = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export const fecha = (f: Date) => fmtFecha.format(f);
export const fechaLarga = (f: Date) => fmtFechaLarga.format(f);
export const linkWhatsApp = (numero: string, texto: string) => `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
export const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^[A-ZÁÉÍÓÚ]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

export const mismoDia = (a: Date, b: Date) => a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
export const pesos = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

/** Enlace de contacto con la organización: WhatsApp si hay número, si no Messenger de Facebook. */
export function contacto(d: Datos, texto: string) {
  return d.torneo.contacto_whatsapp
    ? { href: linkWhatsApp(d.torneo.contacto_whatsapp, texto), canal: 'WhatsApp' as const }
    : { href: d.torneo.messenger, canal: 'Messenger' as const };
}

/** Primera letra en mayúscula ("Viernes, 13 de noviembre"), sin tocar el resto. */
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "viernes, 13 de noviembre" (sin año). */
export const fechaSinAnio = (f: Date) => fechaLarga(f).replace(/ de \d{4}$/, '');
