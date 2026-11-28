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

export interface Gol extends Evento {
  /** Gol en propia puerta: jugador_id es de quien lo metió y cuenta para el rival. */
  autogol?: boolean;
}

/** Equipo al que le cuenta un gol (en un autogol, el rival del jugador). */
export function equipoDelGol(g: Gol, p: Pick<PartidoBase, 'local_id' | 'visitante_id'>, equipoDeJugador: Map<string, string>) {
  const eq = equipoDeJugador.get(g.jugador_id);
  if (!g.autogol || !eq) return eq;
  return eq === p.local_id ? p.visitante_id : eq === p.visitante_id ? p.local_id : undefined;
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
  /** Solo en eliminatoria cuando termina empatado. */
  penales_local?: number;
  penales_visitante?: number;
  goles: Gol[];
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

export interface FilaGeneral extends FilaPosiciones {
  categoria: string;
  grupo: string;
  /** Lugar que ocupa en su grupo (1 = primero). */
  lugarGrupo: number;
}

/**
 * Tabla general: todos los equipos de las tablas de grupo en una sola, por puntos,
 * diferencia y goles a favor; luego el lugar en su grupo y la letra del grupo.
 */
export function tablaGeneral(tablas: TablaGrupo[]): FilaGeneral[] {
  return tablas
    .flatMap((t) => t.filas.map((f, i) => ({ ...f, categoria: t.categoria, grupo: t.grupo, lugarGrupo: i + 1 })))
    .sort(
      (a, b) =>
        b.pts - a.pts ||
        b.dif - a.dif ||
        b.gf - a.gf ||
        a.lugarGrupo - b.lugarGrupo ||
        a.grupo.localeCompare(b.grupo),
    );
}

export interface Goleador {
  jugador_id: string;
  equipo_id: string;
  goles: number;
}

/** Tabla de goleo. Solo cuenta goles de partidos jugados; los autogoles no suman. */
export function goleadores(partidos: PartidoBase[], jugadores: JugadorBase[]): Goleador[] {
  const equipoDe = new Map(jugadores.map((j) => [j.id, j.equipo_id]));
  const nombre = new Map(jugadores.map((j) => [j.id, j.nombre]));
  const goles = new Map<string, number>();
  for (const p of partidos) {
    if (p.estado !== 'jugado') continue;
    for (const g of p.goles) if (!g.autogol) goles.set(g.jugador_id, (goles.get(g.jugador_id) ?? 0) + 1);
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

export interface FilaFairPlay {
  equipo_id: string;
  pj: number;
  amarillas: number;
  rojas: number;
  /** Puntos de conducta: cada tarjeta suma su valor; menos es mejor. */
  puntos: number;
}

/**
 * Tabla de fair play: equipos de menos a más tarjetas, ponderadas por `valor`
 * (por defecto amarilla 1, roja 3). Empates: menos rojas, menos amarillas y nombre.
 * Solo cuentan partidos jugados; la tarjeta se asigna al equipo del jugador.
 */
export function fairPlay(
  equipos: EquipoBase[],
  partidos: PartidoBase[],
  jugadores: JugadorBase[],
  valor = { amarilla: 1, roja: 3 },
): FilaFairPlay[] {
  const equipoDe = new Map(jugadores.map((j) => [j.id, j.equipo_id]));
  const filas = new Map(equipos.map((e) => [e.id, { equipo_id: e.id, pj: 0, amarillas: 0, rojas: 0, puntos: 0 }]));
  for (const p of partidos) {
    if (p.estado !== 'jugado') continue;
    for (const id of [p.local_id, p.visitante_id]) {
      const f = filas.get(id);
      if (f) f.pj++;
    }
    for (const t of p.tarjetas) {
      const f = filas.get(equipoDe.get(t.jugador_id) ?? '');
      if (!f) continue;
      if (t.tipo === 'roja') f.rojas++;
      else f.amarillas++;
      f.puntos += valor[t.tipo];
    }
  }
  const nombre = new Map(equipos.map((e) => [e.id, e.nombre]));
  return [...filas.values()].sort(
    (a, b) =>
      a.puntos - b.puntos ||
      a.rojas - b.rojas ||
      a.amarillas - b.amarillas ||
      (nombre.get(a.equipo_id) ?? '').localeCompare(nombre.get(b.equipo_id) ?? '', 'es'),
  );
}

export interface FilaGoles {
  equipo_id: string;
  pj: number;
  gf: number;
  gc: number;
  /** Puntos de conducta del fair play (desempate: menos es mejor). */
  tarjetas: number;
}

/**
 * Goles a favor y en contra de los equipos con partidos con resultado (todas las fases),
 * en el orden de la tabla de fair play (de menos a más tarjetas).
 */
function golesPorEquipo(partidos: PartidoBase[], tablaFairPlay: FilaFairPlay[]): FilaGoles[] {
  const goles = new Map<string, { pj: number; gf: number; gc: number }>();
  const sumar = (id: string, gf: number, gc: number) => {
    const g = goles.get(id) ?? { pj: 0, gf: 0, gc: 0 };
    g.pj++;
    g.gf += gf;
    g.gc += gc;
    goles.set(id, g);
  };
  for (const p of partidos) {
    if (!cuentaEnTabla(p)) continue;
    sumar(p.local_id, p.goles_local!, p.goles_visitante!);
    sumar(p.visitante_id, p.goles_visitante!, p.goles_local!);
  }
  return tablaFairPlay
    .filter((f) => goles.has(f.equipo_id))
    .map((f) => ({ equipo_id: f.equipo_id, ...goles.get(f.equipo_id)!, tarjetas: f.puntos }));
}

// Las filas ya vienen de menos a más tarjetas: el sort estable conserva ese desempate.

/** Mejor ofensiva: de más a menos goles a favor; desempate, menos tarjetas. */
export const mejorOfensiva = (partidos: PartidoBase[], tablaFairPlay: FilaFairPlay[]) =>
  golesPorEquipo(partidos, tablaFairPlay).sort((a, b) => b.gf - a.gf);

/** Mejor defensa: de menos a más goles en contra; desempate, menos tarjetas. */
export const mejorDefensa = (partidos: PartidoBase[], tablaFairPlay: FilaFairPlay[]) =>
  golesPorEquipo(partidos, tablaFairPlay).sort((a, b) => a.gc - b.gc);

export interface Expulsion {
  jugador_id: string;
  equipo_id: string;
  partido_id: string;
  fecha: Date;
  rival_id: string;
  minuto?: number;
}

/** Tarjetas rojas de partidos jugados, de la más reciente a la más antigua. */
export function expulsados(partidos: PartidoBase[], jugadores: JugadorBase[]): Expulsion[] {
  const equipoDe = new Map(jugadores.map((j) => [j.id, j.equipo_id]));
  return ordenarPartidos(partidos.filter((p) => p.estado === 'jugado'))
    .reverse()
    .flatMap((p) =>
      p.tarjetas
        .filter((t) => t.tipo === 'roja')
        .sort((a, b) => (b.minuto ?? 0) - (a.minuto ?? 0))
        .map((t) => {
          const equipo_id = equipoDe.get(t.jugador_id) ?? '';
          return {
            jugador_id: t.jugador_id,
            equipo_id,
            partido_id: p.id,
            fecha: p.fecha,
            rival_id: equipo_id === p.local_id ? p.visitante_id : p.local_id,
            minuto: t.minuto,
          };
        }),
    );
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

// ── Eliminatoria (llaves) ────────────────────────────────────────────────────

export type FaseEliminatoria = Exclude<Fase, 'grupos'>;
/** Rondas de la eliminatoria, de la primera a la final. */
export const RONDAS: FaseEliminatoria[] = ['octavos', 'cuartos', 'semifinal', 'final'];

/** Ganador y perdedor de un partido con resultado; en empate decide la tanda de penales. */
export function ganadorDe(p: PartidoBase): { ganador: string; perdedor: string } | null {
  if (!cuentaEnTabla(p)) return null;
  let [l, v] = [p.goles_local!, p.goles_visitante!];
  if (l === v && p.penales_local != null && p.penales_visitante != null) [l, v] = [p.penales_local, p.penales_visitante];
  if (l === v) return null;
  return l > v ? { ganador: p.local_id, perdedor: p.visitante_id } : { ganador: p.visitante_id, perdedor: p.local_id };
}

/** Orden de siembra de un cuadro de n equipos: 1, 16, 8, 9, 4, 13… (así 1 y 2 solo se cruzan en la final). */
export function ordenSiembra(n: number): number[] {
  let orden = [1];
  while (orden.length < n) {
    const m = orden.length * 2 + 1;
    orden = orden.flatMap((s) => [s, m - s]);
  }
  return orden;
}

export interface LadoLlave {
  equipo_id?: string;
  /** Lugar en la tabla general. */
  siembra?: number;
  goles?: number;
  penales?: number;
  /** true si gana la llave, false si queda eliminado, undefined si aún no se juega. */
  avanza?: boolean;
  /** Texto cuando aún no hay equipo, p. ej. "Ganador O1". */
  pendiente?: string;
}

export interface Llave<P extends PartidoBase = PartidoBase> {
  ronda: FaseEliminatoria;
  /** Clave corta: O1…O8, C1…C4, S1, S2, F. */
  clave: string;
  /** Partido de partidos.yaml; sin él, la llave es una proyección. */
  partido?: P;
  local: LadoLlave;
  visitante: LadoLlave;
  ganador_id?: string;
}

export interface Cuadro<P extends PartidoBase = PartidoBase> {
  rondas: { fase: FaseEliminatoria; llaves: Llave<P>[] }[];
  campeon_id?: string;
  /** Equipos fuera del torneo y la fase en que quedaron eliminados. */
  eliminados: { equipo_id: string; fase: Fase; siembra?: number }[];
  /** true cuando ya no quedan partidos de grupos por jugar. */
  gruposTerminados: boolean;
}

const CLAVE: Record<FaseEliminatoria, string> = { octavos: 'O', cuartos: 'C', semifinal: 'S', final: 'F' };

/**
 * Cuadro de eliminatoria a partir de la tabla general: clasifican los `clasifican` primeros
 * (potencia de 2) y se cruzan 1 vs último, 2 vs penúltimo… con el orden de ordenSiembra.
 * Cada llave toma su partido de partidos.yaml si existe (por los equipos que vienen de su
 * lado del cuadro); si no, muestra a los equipos proyectados o "Ganador X".
 */
export function cuadroEliminatoria<P extends PartidoBase>(general: { equipo_id: string }[], partidos: P[], clasifican: number): Cuadro<P> {
  const n = Math.min(clasifican, 2 ** Math.floor(Math.log2(Math.max(general.length, 1))));
  const rondas = RONDAS.slice(RONDAS.length - Math.log2(n));
  const siembra = new Map(general.slice(0, n).map((f, i) => [f.equipo_id, i + 1]));
  const porSiembra = (s: number) => general[s - 1]?.equipo_id;
  const gruposTerminados = partidos.some((p) => p.fase === 'grupos') && partidos.every((p) => p.fase !== 'grupos' || p.estado !== 'programado');

  const lado = (p: PartidoBase | undefined, equipo_id: string | undefined, pendiente?: string): LadoLlave => {
    const l: LadoLlave = { equipo_id, siembra: equipo_id ? siembra.get(equipo_id) : undefined };
    if (!equipo_id) l.pendiente = pendiente;
    if (p && equipo_id && cuentaEnTabla(p)) {
      const esLocal = p.local_id === equipo_id;
      l.goles = esLocal ? p.goles_local : p.goles_visitante;
      l.penales = (esLocal ? p.penales_local : p.penales_visitante) ?? undefined;
      const g = ganadorDe(p);
      if (g) l.avanza = g.ganador === equipo_id;
    }
    return l;
  };

  const salida: Cuadro<P>['rondas'] = [];
  // Equipos que pueden llegar a cada llave de la ronda anterior (su "lado" del cuadro).
  let subarboles: Set<string>[] = [];
  let anteriores: Llave<P>[] = [];
  const orden = ordenSiembra(n);

  rondas.forEach((fase, r) => {
    const disponibles = partidos.filter((p) => p.fase === fase);
    const tomar = (equipos: Set<string>) => {
      const i = disponibles.findIndex((p) => equipos.has(p.local_id) || equipos.has(p.visitante_id));
      return i < 0 ? undefined : disponibles.splice(i, 1)[0];
    };
    const llaves: Llave<P>[] = [];
    const nuevosSub: Set<string>[] = [];
    const total = n / 2 ** (r + 1);
    for (let k = 0; k < total; k++) {
      const clave = fase === 'final' ? 'F' : `${CLAVE[fase]}${k + 1}`;
      let sub: Set<string>;
      let proyeccion: [string | undefined, string | undefined];
      let pendientes: [string, string];
      if (r === 0) {
        const [a, b] = [orden[2 * k], orden[2 * k + 1]];
        proyeccion = [porSiembra(a), porSiembra(b)];
        sub = new Set(proyeccion.filter((x): x is string => !!x));
        pendientes = [`${a}.º general`, `${b}.º general`];
      } else {
        const [A, B] = [anteriores[2 * k], anteriores[2 * k + 1]];
        sub = new Set([...subarboles[2 * k], ...subarboles[2 * k + 1]]);
        proyeccion = [A.ganador_id, B.ganador_id];
        pendientes = [`Ganador ${A.clave}`, `Ganador ${B.clave}`];
      }
      const p = tomar(sub);
      // Con partido, el local va arriba si viene del lado de arriba del cuadro.
      let [arriba, abajo] = proyeccion;
      if (p) {
        const arribaEsVisita = r === 0 ? p.visitante_id === proyeccion[0] : subarboles[2 * k].has(p.visitante_id);
        [arriba, abajo] = arribaEsVisita ? [p.visitante_id, p.local_id] : [p.local_id, p.visitante_id];
      }
      const llave: Llave<P> = { ronda: fase, clave, partido: p, local: lado(p, arriba, pendientes[0]), visitante: lado(p, abajo, pendientes[1]) };
      const g = p && ganadorDe(p);
      if (g) llave.ganador_id = g.ganador;
      llaves.push(llave);
      nuevosSub.push(p ? new Set([...sub, p.local_id, p.visitante_id]) : sub);
    }
    // Partidos que no caen en su lado del cuadro (p. ej. si la organización reacomoda): van a las llaves sin partido.
    for (const p of disponibles) {
      const k = llaves.findIndex((l) => !l.partido);
      if (k < 0) break;
      const g = ganadorDe(p);
      llaves[k] = { ...llaves[k], partido: p, local: lado(p, p.local_id), visitante: lado(p, p.visitante_id), ganador_id: g?.ganador };
      nuevosSub[k] = new Set([...nuevosSub[k], p.local_id, p.visitante_id]);
    }
    salida.push({ fase, llaves });
    anteriores = llaves;
    subarboles = nuevosSub;
  });

  const eliminados: Cuadro<P>['eliminados'] = [];
  for (const { fase, llaves } of salida) {
    for (const l of llaves) {
      for (const s of [l.local, l.visitante]) if (s.equipo_id && s.avanza === false) eliminados.push({ equipo_id: s.equipo_id, fase, siembra: s.siembra });
    }
  }
  if (gruposTerminados) {
    general.slice(n).forEach((f, i) => eliminados.push({ equipo_id: f.equipo_id, fase: 'grupos', siembra: n + i + 1 }));
  }
  const final = salida.at(-1)?.llaves[0];
  return { rondas: salida, campeon_id: final?.ganador_id, eliminados, gruposTerminados };
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
    const gl = p.goles.filter((g) => equipoDelGol(g, p, equipoDeJugador) === p.local_id).length;
    const gv = p.goles.filter((g) => equipoDelGol(g, p, equipoDeJugador) === p.visitante_id).length;
    // Se permiten goles sin registrar (goleador desconocido), pero no de más.
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
  skip?: number;
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

/** Edad, posiciones y dorsales; skip omite los primeros jugadores del ranking de jóvenes. */
export function estadisticasPlantillas<J extends JugadorPlantilla>(jugadores: J[], top = 5, skip = 0) {
  if (!Number.isSafeInteger(skip) || skip < 0) throw new RangeError('skip debe ser un entero no negativo');
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
    masJovenes: [...conEdad].sort((a, b) => a.edad - b.edad || porNombre(a, b)).slice(skip, skip + top),
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

/** Goles, resultados y tarjetas de los partidos con resultado (ofensiva y defensa: mejorOfensiva/mejorDefensa). */
export function estadisticasCompetencia(partidos: PartidoBase[]) {
  const jugados = partidos.filter(cuentaEnTabla);
  const goles = jugados.reduce((n, p) => n + p.goles_local! + p.goles_visitante!, 0);
  const tarjetas = partidos.filter((p) => p.estado === 'jugado').flatMap((p) => p.tarjetas);
  const total = (p: PartidoBase) => p.goles_local! + p.goles_visitante!;
  const diferencia = (p: PartidoBase) => Math.abs(p.goles_local! - p.goles_visitante!);
  const mayor = (f: (p: PartidoBase) => number) =>
    jugados.reduce<PartidoBase | null>((m, p) => (!m || f(p) > f(m) ? p : m), null);

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
  };
}

export type Resultado = 'G' | 'E' | 'P';

/**
 * Estadísticas de un equipo: su plantilla (edades y posiciones) y lo que lleva en
 * la cancha (resultados, goles, porterías en cero, racha, goleadores y tarjetas).
 * Solo cuentan los partidos con resultado; `proximo` es el siguiente programado.
 */
export function estadisticasEquipo<J extends JugadorPlantilla, P extends PartidoBase>(
  equipoId: string,
  partidos: P[],
  jugadores: J[],
  tablaGoleo: Goleador[] = [],
  tarjetas: RegistroDisciplina[] = [],
) {
  const plantilla = jugadores.filter((j) => j.equipo_id === equipoId);
  const conEdad = plantilla.filter((j): j is J & { edad: number } => j.edad != null);
  const edades = conEdad.map((j) => j.edad);
  const porNombre = (a: J, b: J) => a.nombre.localeCompare(b.nombre, 'es');

  const propios = ordenarPartidos(partidos.filter((p) => p.local_id === equipoId || p.visitante_id === equipoId));
  const jugados = propios.filter(cuentaEnTabla).map((p) => {
    const local = p.local_id === equipoId;
    const gf = local ? p.goles_local! : p.goles_visitante!;
    const gc = local ? p.goles_visitante! : p.goles_local!;
    const resultado: Resultado = gf > gc ? 'G' : gf < gc ? 'P' : 'E';
    return { partido: p, rival_id: local ? p.visitante_id : p.local_id, local, gf, gc, resultado };
  });
  const suma = (f: (x: (typeof jugados)[number]) => number) => jugados.reduce((n, x) => n + f(x), 0);
  const gf = suma((x) => x.gf);
  const gc = suma((x) => x.gc);
  const victorias = jugados.filter((x) => x.resultado === 'G');
  const disc = tarjetas.filter((r) => r.equipo_id === equipoId);

  return {
    jugadores: plantilla.length,
    promedioEdad: promedio(edades),
    medianaEdad: mediana(edades),
    menoresDeEdad: edades.filter((e) => e < 18).length,
    masJoven: [...conEdad].sort((a, b) => a.edad - b.edad || porNombre(a, b))[0] ?? null,
    masGrande: [...conEdad].sort((a, b) => b.edad - a.edad || porNombre(a, b))[0] ?? null,
    porPosicion: POSICIONES.map((posicion) => ({ posicion, jugadores: plantilla.filter((j) => j.posicion === posicion).length })),

    pj: jugados.length,
    g: victorias.length,
    e: jugados.filter((x) => x.resultado === 'E').length,
    p: jugados.filter((x) => x.resultado === 'P').length,
    gf,
    gc,
    golesFavorPorPartido: jugados.length ? gf / jugados.length : null,
    golesContraPorPartido: jugados.length ? gc / jugados.length : null,
    /** Partidos sin recibir gol. */
    porteriaEnCero: jugados.filter((x) => x.gc === 0).length,
    sinAnotar: jugados.filter((x) => x.gf === 0).length,
    /** Últimos 5 resultados, del más antiguo al más reciente. */
    racha: jugados.slice(-5).map((x) => x.resultado),
    resultados: jugados,
    mayorVictoria: victorias.reduce<(typeof jugados)[number] | null>((m, x) => (!m || x.gf - x.gc > m.gf - m.gc ? x : m), null),
    proximo: propios.find((p) => p.estado === 'programado') ?? null,
    pendientes: propios.filter((p) => p.estado === 'programado').length,

    goleadores: tablaGoleo.filter((g) => g.equipo_id === equipoId),
    amarillas: disc.reduce((n, r) => n + r.amarillas, 0),
    rojas: disc.reduce((n, r) => n + r.rojas, 0),
    suspendidos: disc.filter((r) => r.pendientes > 0),
  };
}
