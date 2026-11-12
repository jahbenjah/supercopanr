// Cálculos del torneo. Funciones puras: reciben datos planos y no dependen de Astro,
// así se pueden probar con vitest y reutilizar si los datos vienen de una base de datos.

export type EstadoPartido = 'programado' | 'jugado' | 'suspendido' | 'default';
export type Fase = 'grupos' | 'octavos' | 'cuartos' | 'semifinal' | 'final';

export const NOMBRE_FASE: Record<Fase, string> = {
  grupos: 'Fase de grupos',
  octavos: 'Octavos de final',
  cuartos: 'Cuartos de final',
  semifinal: 'Semifinal',
  final: 'Gran Final',
};

export interface Evento {
  jugador_id: string;
  minuto?: number;
}

export interface Tarjeta extends Evento {
  tipo: 'amarilla' | 'roja';
}

export interface PartidoBase {
  id: string;
  fase: Fase;
  jornada?: number;
  categoria: string;
  fecha: Date;
  hora?: string;
  local_id: string;
  visitante_id: string;
  estado: EstadoPartido;
  goles_local?: number;
  goles_visitante?: number;
  goles: Evento[];
  tarjetas: Tarjeta[];
}

export interface EquipoBase {
  id: string;
  nombre: string;
  categoria: string;
  grupo?: string;
  /** Lugar en el grupo según el sorteo; desempate final antes de jugar. */
  posicion?: number;
}

export interface JugadorBase {
  id: string;
  equipo_id: string;
  nombre: string;
}

export interface Puntos {
  victoria: number;
  empate: number;
  derrota: number;
}

export interface FilaPosiciones {
  equipo_id: string;
  pj: number;
  g: number;
  e: number;
  p: number;
  gf: number;
  gc: number;
  dif: number;
  pts: number;
}

export interface TablaGrupo {
  categoria: string;
  grupo: string;
  filas: FilaPosiciones[];
}

export const cuentaEnTabla = (p: PartidoBase) =>
  (p.estado === 'jugado' || p.estado === 'default') && p.goles_local != null && p.goles_visitante != null;

/** Orden cronológico: fecha, hora y jornada. */
export function ordenarPartidos<T extends PartidoBase>(partidos: T[]): T[] {
  return [...partidos].sort(
    (a, b) =>
      a.fecha.getTime() - b.fecha.getTime() ||
      (a.hora ?? '').localeCompare(b.hora ?? '') ||
      (a.jornada ?? 0) - (b.jornada ?? 0) ||
      a.id.localeCompare(b.id),
  );
}

/**
 * Una tabla por categoría y grupo, ordenada por puntos, diferencia y goles a favor; en empate
 * total (p. ej. antes de jugar) respeta la posición del sorteo y luego el orden de equipos.yaml.
 * Solo cuentan partidos de fase de grupos; equipos sin grupo (antes del sorteo) no aparecen.
 */
export function calcularPosiciones(equipos: EquipoBase[], partidos: PartidoBase[], puntos: Puntos): TablaGrupo[] {
  const filas = new Map<string, FilaPosiciones>();
  for (const e of equipos) {
    filas.set(e.id, { equipo_id: e.id, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dif: 0, pts: 0 });
  }

  const sumar = (id: string, gf: number, gc: number) => {
    const f = filas.get(id);
    if (!f) return;
    f.pj++;
    f.gf += gf;
    f.gc += gc;
    f.dif = f.gf - f.gc;
    if (gf > gc) {
      f.g++;
      f.pts += puntos.victoria;
    } else if (gf === gc) {
      f.e++;
      f.pts += puntos.empate;
    } else {
      f.p++;
      f.pts += puntos.derrota;
    }
  };

  for (const p of partidos) {
    if (p.fase !== 'grupos' || !cuentaEnTabla(p)) continue;
    sumar(p.local_id, p.goles_local!, p.goles_visitante!);
    sumar(p.visitante_id, p.goles_visitante!, p.goles_local!);
  }

  const orden = new Map(equipos.map((e, i) => [e.id, [e.posicion ?? Infinity, i] as const]));
  const grupos = new Map<string, TablaGrupo>();
  for (const e of equipos) {
    if (!e.grupo) continue;
    const clave = `${e.categoria}|${e.grupo}`;
    if (!grupos.has(clave)) grupos.set(clave, { categoria: e.categoria, grupo: e.grupo, filas: [] });
    grupos.get(clave)!.filas.push(filas.get(e.id)!);
  }

  const tablas = [...grupos.values()];
  for (const t of tablas) {
    t.filas.sort(
      (a, b) =>
        b.pts - a.pts ||
        b.dif - a.dif ||
        b.gf - a.gf ||
        orden.get(a.equipo_id)![0] - orden.get(b.equipo_id)![0] ||
        orden.get(a.equipo_id)![1] - orden.get(b.equipo_id)![1],
    );
  }
  return tablas.sort((a, b) => a.categoria.localeCompare(b.categoria) || a.grupo.localeCompare(b.grupo));
}

export interface Goleador {
  jugador_id: string;
  equipo_id: string;
  goles: number;
}

/** Tabla de goleo. Solo cuenta goles de partidos jugados. */
export function goleadores(partidos: PartidoBase[], jugadores: JugadorBase[]): Goleador[] {
  const equipoDe = new Map(jugadores.map((j) => [j.id, j.equipo_id]));
  const nombre = new Map(jugadores.map((j) => [j.id, j.nombre]));
  const goles = new Map<string, number>();
  for (const p of partidos) {
    if (p.estado !== 'jugado') continue;
    for (const g of p.goles) goles.set(g.jugador_id, (goles.get(g.jugador_id) ?? 0) + 1);
  }
  return [...goles.entries()]
    .map(([jugador_id, n]) => ({ jugador_id, equipo_id: equipoDe.get(jugador_id) ?? '', goles: n }))
    .sort((a, b) => b.goles - a.goles || (nombre.get(a.jugador_id) ?? '').localeCompare(nombre.get(b.jugador_id) ?? '', 'es'));
}

export interface ReglasDisciplina {
  amarillas_para_suspension: number;
  partidos_suspension_roja: number;
}

export interface RegistroDisciplina {
  jugador_id: string;
  equipo_id: string;
  amarillas: number;
  rojas: number;
  /** Partidos de suspensión que aún debe cumplir. */
  pendientes: number;
}

/**
 * Tarjetas por jugador y suspensiones pendientes.
 * Una roja suspende `partidos_suspension_roja` partidos; cada vez que el acumulado
 * de amarillas llega a un múltiplo de `amarillas_para_suspension` suspende 1 partido.
 * Cada partido jugado posterior del equipo descuenta un partido de suspensión.
 */
export function disciplina(
  partidos: PartidoBase[],
  jugadores: JugadorBase[],
  reglas: ReglasDisciplina,
): RegistroDisciplina[] {
  const jugadosPorEquipo = new Map<string, PartidoBase[]>();
  for (const p of ordenarPartidos(partidos)) {
    if (p.estado !== 'jugado') continue;
    for (const eq of [p.local_id, p.visitante_id]) {
      if (!jugadosPorEquipo.has(eq)) jugadosPorEquipo.set(eq, []);
      jugadosPorEquipo.get(eq)!.push(p);
    }
  }

  const registros: RegistroDisciplina[] = [];
  for (const j of jugadores) {
    let amarillas = 0;
    let rojas = 0;
    let pendientes = 0;
    for (const p of jugadosPorEquipo.get(j.equipo_id) ?? []) {
      if (pendientes > 0) pendientes--;
      for (const t of p.tarjetas) {
        if (t.jugador_id !== j.id) continue;
        if (t.tipo === 'roja') {
          rojas++;
          pendientes += reglas.partidos_suspension_roja;
        } else {
          amarillas++;
          if (amarillas % reglas.amarillas_para_suspension === 0) pendientes++;
        }
      }
    }
    if (amarillas || rojas || pendientes) registros.push({ jugador_id: j.id, equipo_id: j.equipo_id, amarillas, rojas, pendientes });
  }
  return registros.sort((a, b) => b.pendientes - a.pendientes || b.rojas - a.rojas || b.amarillas - a.amarillas);
}

/** Fecha (día) del siguiente partido programado, o null si ya no hay. */
export function proximaFecha(partidos: PartidoBase[]): Date | null {
  const fs = partidos.filter((p) => p.estado === 'programado').map((p) => p.fecha.getTime());
  return fs.length ? new Date(Math.min(...fs)) : null;
}

/** Fecha (día) del último partido con resultado, o null. */
export function ultimaFechaJugada(partidos: PartidoBase[]): Date | null {
  const fs = partidos.filter(cuentaEnTabla).map((p) => p.fecha.getTime());
  return fs.length ? new Date(Math.max(...fs)) : null;
}

/** Problemas de consistencia de un partido jugado (marcador vs. goles, goleadores de otro equipo). */
export function erroresDePartido(p: PartidoBase, equipoDeJugador: Map<string, string>): string[] {
  const errores: string[] = [];
  const equipos = [p.local_id, p.visitante_id];
  for (const e of [...p.goles, ...p.tarjetas]) {
    const eq = equipoDeJugador.get(e.jugador_id);
    if (eq && !equipos.includes(eq)) errores.push(`el jugador "${e.jugador_id}" no juega en este partido`);
  }
  if (p.estado === 'jugado' && p.goles.length) {
    const gl = p.goles.filter((g) => equipoDeJugador.get(g.jugador_id) === p.local_id).length;
    const gv = p.goles.filter((g) => equipoDeJugador.get(g.jugador_id) === p.visitante_id).length;
    // Se permiten goles sin registrar (autogoles, goleador desconocido), pero no de más.
    if (gl > (p.goles_local ?? 0) || gv > (p.goles_visitante ?? 0)) {
      errores.push(`hay más goles registrados (${gl}-${gv}) que en el marcador (${p.goles_local}-${p.goles_visitante})`);
    }
  }
  return errores;
}

// ── Estadísticas de plantillas y de la competencia ───────────────────────────

export interface JugadorPlantilla extends JugadorBase {
  edad?: number;
  posicion?: string;
  numero?: number;
}

const promedio = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
function mediana(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export const RANGOS_EDAD = [
  { etiqueta: '17 o menos', desde: 0, hasta: 17 },
  { etiqueta: '18–20', desde: 18, hasta: 20 },
  { etiqueta: '21–24', desde: 21, hasta: 24 },
  { etiqueta: '25–29', desde: 25, hasta: 29 },
  { etiqueta: '30–34', desde: 30, hasta: 34 },
  { etiqueta: '35–39', desde: 35, hasta: 39 },
  { etiqueta: '40 o más', desde: 40, hasta: Infinity },
] as const;

export const POSICIONES = ['Portero', 'Defensa', 'Medio', 'Delantero'] as const;

/** Edad, posiciones y dorsales de todos los jugadores registrados. */
export function estadisticasPlantillas<J extends JugadorPlantilla>(jugadores: J[], top = 5) {
  const conEdad = jugadores.filter((j): j is J & { edad: number } => j.edad != null);
  const edades = conEdad.map((j) => j.edad);
  const porNombre = (a: J, b: J) => a.nombre.localeCompare(b.nombre, 'es');

  const porEquipo = [...Map.groupBy(jugadores, (j) => j.equipo_id)].map(([equipo_id, js]) => {
    const es = js.flatMap((j) => (j.edad != null ? [j.edad] : []));
    return {
      equipo_id,
      jugadores: js.length,
      promedioEdad: promedio(es),
      menor: es.length ? Math.min(...es) : null,
      mayor: es.length ? Math.max(...es) : null,
    };
  });

  const dorsales = [...Map.groupBy(jugadores.filter((j) => j.numero != null), (j) => j.numero!)]
    .map(([numero, js]) => ({ numero, jugadores: js.length }))
    .sort((a, b) => b.jugadores - a.jugadores || a.numero - b.numero);

  return {
    total: jugadores.length,
    conEdad: conEdad.length,
    promedioEdad: promedio(edades),
    medianaEdad: mediana(edades),
    menoresDeEdad: edades.filter((e) => e < 18).length,
    masJovenes: [...conEdad].sort((a, b) => a.edad - b.edad || porNombre(a, b)).slice(0, top),
    veteranos: [...conEdad].sort((a, b) => b.edad - a.edad || porNombre(a, b)).slice(0, top),
    rangos: RANGOS_EDAD.map((r) => ({ ...r, jugadores: edades.filter((e) => e >= r.desde && e <= r.hasta).length })),
    porPosicion: POSICIONES.map((posicion) => {
      const js = jugadores.filter((j) => j.posicion === posicion);
      return { posicion, jugadores: js.length, promedioEdad: promedio(js.flatMap((j) => (j.edad != null ? [j.edad] : []))) };
    }),
    /** Equipos del más joven al más veterano (promedio de edad). */
    porEquipo: porEquipo.sort((a, b) => (a.promedioEdad ?? Infinity) - (b.promedioEdad ?? Infinity)),
    dorsales,
  };
}

/** Goles, resultados y tarjetas de los partidos con resultado. */
export function estadisticasCompetencia(partidos: PartidoBase[], tablas: TablaGrupo[]) {
  const jugados = partidos.filter(cuentaEnTabla);
  const goles = jugados.reduce((n, p) => n + p.goles_local! + p.goles_visitante!, 0);
  const tarjetas = partidos.filter((p) => p.estado === 'jugado').flatMap((p) => p.tarjetas);
  const total = (p: PartidoBase) => p.goles_local! + p.goles_visitante!;
  const diferencia = (p: PartidoBase) => Math.abs(p.goles_local! - p.goles_visitante!);
  const mayor = (f: (p: PartidoBase) => number) =>
    jugados.reduce<PartidoBase | null>((m, p) => (!m || f(p) > f(m) ? p : m), null);
  const filas = tablas.flatMap((t) => t.filas).filter((f) => f.pj > 0);
  const mejor = (f: (x: FilaPosiciones) => number) =>
    filas.reduce<FilaPosiciones | null>((m, x) => (!m || f(x) > f(m) ? x : m), null);

  return {
    jugados: jugados.length,
    programados: partidos.filter((p) => p.estado === 'programado').length,
    goles,
    golesPorPartido: jugados.length ? goles / jugados.length : null,
    victoriasLocal: jugados.filter((p) => p.goles_local! > p.goles_visitante!).length,
    empates: jugados.filter((p) => p.goles_local === p.goles_visitante).length,
    victoriasVisitante: jugados.filter((p) => p.goles_local! < p.goles_visitante!).length,
    sinGoles: jugados.filter((p) => total(p) === 0).length,
    amarillas: tarjetas.filter((t) => t.tipo === 'amarilla').length,
    rojas: tarjetas.filter((t) => t.tipo === 'roja').length,
    masGoles: mayor(total),
    mayorGoleada: mayor(diferencia),
    mejorOfensiva: mejor((x) => x.gf / x.pj),
    mejorDefensa: mejor((x) => -x.gc / x.pj),
  };
}
