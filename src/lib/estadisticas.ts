// Cálculos del torneo. Funciones puras: reciben datos planos y no dependen de Astro,
// así se pueden probar con vitest y reutilizar si los datos vienen de una base de datos.

export type EstadoPartido = 'programado' | 'jugado' | 'suspendido' | 'default';

export interface Evento {
  jugador_id: string;
  minuto?: number;
}

export interface Tarjeta extends Evento {
  tipo: 'amarilla' | 'roja';
}

export interface PartidoBase {
  id: string;
  jornada: number;
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
  grupo: string;
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
      a.jornada - b.jornada ||
      a.id.localeCompare(b.id),
  );
}

/** Una tabla por categoría y grupo, ordenada por puntos, diferencia, goles a favor y nombre. */
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
    if (!cuentaEnTabla(p)) continue;
    sumar(p.local_id, p.goles_local!, p.goles_visitante!);
    sumar(p.visitante_id, p.goles_visitante!, p.goles_local!);
  }

  const nombre = new Map(equipos.map((e) => [e.id, e.nombre]));
  const grupos = new Map<string, TablaGrupo>();
  for (const e of equipos) {
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
        (nombre.get(a.equipo_id) ?? '').localeCompare(nombre.get(b.equipo_id) ?? '', 'es'),
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

/** Primera jornada con partidos programados, o null si ya no hay. */
export function proximaJornada(partidos: PartidoBase[]): number | null {
  const js = partidos.filter((p) => p.estado === 'programado').map((p) => p.jornada);
  return js.length ? Math.min(...js) : null;
}

/** Última jornada con al menos un partido jugado, o null. */
export function ultimaJornadaJugada(partidos: PartidoBase[]): number | null {
  const js = partidos.filter(cuentaEnTabla).map((p) => p.jornada);
  return js.length ? Math.max(...js) : null;
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
