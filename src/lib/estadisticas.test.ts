import { describe, expect, it } from 'vitest';
import {
  calcularPosiciones,
  disciplina,
  erroresDePartido,
  goleadores,
  proximaJornada,
  ultimaJornadaJugada,
  type PartidoBase,
} from './estadisticas';

const equipos = [
  { id: 'a', nombre: 'Águilas', categoria: 'primera', grupo: 'A' },
  { id: 'b', nombre: 'Búhos', categoria: 'primera', grupo: 'A' },
  { id: 'c', nombre: 'Cóndores', categoria: 'primera', grupo: 'A' },
];
const jugadores = [
  { id: 'a1', equipo_id: 'a', nombre: 'Ana' },
  { id: 'b1', equipo_id: 'b', nombre: 'Beto' },
  { id: 'c1', equipo_id: 'c', nombre: 'Ciro' },
];
const puntos = { victoria: 3, empate: 1, derrota: 0 };

let n = 0;
const partido = (local: string, visita: string, gl?: number, gv?: number, extra: Partial<PartidoBase> = {}): PartidoBase => ({
  id: `p${++n}`,
  jornada: 1,
  categoria: 'primera',
  fecha: new Date(Date.UTC(2026, 9, n)),
  local_id: local,
  visitante_id: visita,
  estado: gl == null ? 'programado' : 'jugado',
  goles_local: gl,
  goles_visitante: gv,
  goles: [],
  tarjetas: [],
  ...extra,
});

describe('calcularPosiciones', () => {
  it('suma victorias, empates y derrotas', () => {
    const [t] = calcularPosiciones(equipos, [partido('a', 'b', 2, 0), partido('b', 'c', 1, 1)], puntos);
    expect(t.filas.map((f) => [f.equipo_id, f.pts, f.pj])).toEqual([
      ['a', 3, 1],
      ['c', 1, 1],
      ['b', 1, 2],
    ]);
    expect(t.filas[2]).toMatchObject({ g: 0, e: 1, p: 1, gf: 1, gc: 3, dif: -2 });
  });

  it('desempata por diferencia de goles y luego goles a favor', () => {
    const [t] = calcularPosiciones(equipos, [partido('a', 'b', 1, 0), partido('c', 'b', 3, 2)], puntos);
    // a y c con 3 pts y +1; c tiene más goles a favor.
    expect(t.filas.map((f) => f.equipo_id)).toEqual(['c', 'a', 'b']);
  });

  it('cuenta partidos por default e ignora programados y suspendidos', () => {
    const ps = [
      partido('a', 'b', 3, 0, { estado: 'default' }),
      partido('a', 'c'),
      partido('b', 'c', undefined, undefined, { estado: 'suspendido' }),
    ];
    const [t] = calcularPosiciones(equipos, ps, puntos);
    expect(t.filas.find((f) => f.equipo_id === 'a')).toMatchObject({ pj: 1, pts: 3 });
    expect(t.filas.find((f) => f.equipo_id === 'c')).toMatchObject({ pj: 0 });
  });
});

describe('goleadores', () => {
  it('ordena por goles y no cuenta partidos por default', () => {
    const ps = [
      partido('a', 'b', 2, 1, { goles: [{ jugador_id: 'a1' }, { jugador_id: 'a1' }, { jugador_id: 'b1' }] }),
      partido('c', 'b', 1, 0, { estado: 'default', goles: [{ jugador_id: 'c1' }] }),
    ];
    expect(goleadores(ps, jugadores)).toEqual([
      { jugador_id: 'a1', equipo_id: 'a', goles: 2 },
      { jugador_id: 'b1', equipo_id: 'b', goles: 1 },
    ]);
  });
});

describe('disciplina', () => {
  const reglas = { amarillas_para_suspension: 2, partidos_suspension_roja: 1 };

  it('una roja suspende el siguiente partido y se cumple al jugarlo', () => {
    const roja = partido('a', 'b', 0, 0, { tarjetas: [{ jugador_id: 'a1', tipo: 'roja' }] });
    expect(disciplina([roja], jugadores, reglas)[0]).toMatchObject({ jugador_id: 'a1', rojas: 1, pendientes: 1 });
    const cumplida = disciplina([roja, partido('a', 'c', 1, 0)], jugadores, reglas);
    expect(cumplida[0]).toMatchObject({ jugador_id: 'a1', pendientes: 0 });
  });

  it('acumular amarillas suspende un partido', () => {
    const ps = [
      partido('a', 'b', 0, 0, { tarjetas: [{ jugador_id: 'a1', tipo: 'amarilla' }] }),
      partido('a', 'c', 0, 0, { tarjetas: [{ jugador_id: 'a1', tipo: 'amarilla' }] }),
    ];
    expect(disciplina(ps, jugadores, reglas)[0]).toMatchObject({ amarillas: 2, pendientes: 1 });
  });
});

describe('jornadas', () => {
  it('detecta la próxima jornada y la última jugada', () => {
    const ps = [partido('a', 'b', 1, 0), { ...partido('a', 'c'), jornada: 2 }, { ...partido('b', 'c'), jornada: 3 }];
    expect(proximaJornada(ps)).toBe(2);
    expect(ultimaJornadaJugada(ps)).toBe(1);
  });
});

describe('erroresDePartido', () => {
  const equipoDe = new Map(jugadores.map((j) => [j.id, j.equipo_id]));
  it('marca goleadores ajenos y más goles que el marcador', () => {
    const p = partido('a', 'b', 1, 0, { goles: [{ jugador_id: 'a1' }, { jugador_id: 'a1' }, { jugador_id: 'c1' }] });
    const errores = erroresDePartido(p, equipoDe);
    expect(errores).toHaveLength(2);
    expect(errores[0]).toContain('c1');
  });
});
