import { describe, expect, it } from 'vitest';
import {
  calcularPosiciones,
  disciplina,
  erroresDePartido,
  estadisticasCompetencia,
  estadisticasEquipo,
  estadisticasPlantillas,
  goleadores,
  proximaFecha,
  ultimaFechaJugada,
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
  fase: 'grupos',
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

  it('sin partidos jugados respeta la posición del sorteo', () => {
    const sorteo = [
      { ...equipos[0], posicion: 1 },
      { ...equipos[1], posicion: 3 },
      { ...equipos[2], posicion: 2 },
    ];
    const [t] = calcularPosiciones(sorteo, [], puntos);
    expect(t.filas.map((f) => f.equipo_id)).toEqual(['a', 'c', 'b']);
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

describe('fechas', () => {
  it('detecta la siguiente fecha programada y la última jugada', () => {
    const jugado = partido('a', 'b', 1, 0);
    const prox = partido('a', 'c');
    const despues = partido('b', 'c');
    expect(proximaFecha([jugado, despues, prox])).toEqual(prox.fecha);
    expect(ultimaFechaJugada([jugado, prox])).toEqual(jugado.fecha);
    expect(proximaFecha([jugado])).toBeNull();
  });
});

describe('fases', () => {
  it('la eliminatoria no suma a la tabla y los equipos sin grupo no aparecen', () => {
    const tablas = calcularPosiciones(
      [...equipos, { id: 'x', nombre: 'Sin grupo', categoria: 'primera' }],
      [partido('a', 'b', 2, 0, { fase: 'octavos' })],
      puntos,
    );
    expect(tablas).toHaveLength(1);
    expect(tablas[0].filas.every((f) => f.pj === 0)).toBe(true);
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

describe('estadisticasPlantillas', () => {
  const js = [
    { id: 'x1', equipo_id: 'a', nombre: 'Xavi', edad: 17, posicion: 'Medio', numero: 10 },
    { id: 'x2', equipo_id: 'a', nombre: 'Yago', edad: 30, posicion: 'Portero', numero: 1 },
    { id: 'x3', equipo_id: 'b', nombre: 'Zoe', edad: 22, posicion: 'Medio', numero: 10 },
    { id: 'x4', equipo_id: 'b', nombre: 'Abel', posicion: 'Defensa' },
  ];
  const s = estadisticasPlantillas(js, 2);

  it('promedia y ordena por edad ignorando a quien no la tiene', () => {
    expect(s.total).toBe(4);
    expect(s.conEdad).toBe(3);
    expect(s.promedioEdad).toBe(23);
    expect(s.medianaEdad).toBe(22);
    expect(s.menoresDeEdad).toBe(1);
    expect(s.masJovenes.map((j) => j.id)).toEqual(['x1', 'x3']);
    expect(s.veteranos.map((j) => j.id)).toEqual(['x2', 'x3']);
  });

  it('agrupa por rango, posición, equipo y dorsal', () => {
    expect(s.rangos.find((r) => r.etiqueta === '17 o menos')?.jugadores).toBe(1);
    expect(s.porPosicion.find((p) => p.posicion === 'Medio')).toEqual({ posicion: 'Medio', jugadores: 2, promedioEdad: 19.5 });
    expect(s.porEquipo.map((e) => [e.equipo_id, e.promedioEdad])).toEqual([['b', 22], ['a', 23.5]]);
    expect(s.dorsales[0]).toEqual({ numero: 10, jugadores: 2 });
  });

  it('omite los primeros jóvenes sin modificar el resto de estadísticas', () => {
    const siguiente = estadisticasPlantillas(js, 1, 1);
    expect(siguiente.masJovenes.map((j) => j.id)).toEqual(['x3']);
    expect(siguiente.veteranos.map((j) => j.id)).toEqual(['x2']);
    expect(siguiente.promedioEdad).toBe(s.promedioEdad);
    expect(estadisticasPlantillas(js, 5, 3).masJovenes).toEqual([]);
    expect(() => estadisticasPlantillas(js, 5, -1)).toThrow('skip debe ser un entero no negativo');
    expect(() => estadisticasPlantillas(js, 5, 1.5)).toThrow('skip debe ser un entero no negativo');
  });

  it('selecciona los puestos 6 al 10 al usar top 5 y skip 5', () => {
    const jugadores = Array.from({ length: 11 }, (_, i) => ({
      id: `j${i + 1}`, equipo_id: 'a', nombre: `Jugador ${i + 1}`, edad: 15 + i,
    })).reverse();
    expect(estadisticasPlantillas(jugadores, 5, 5).masJovenes.map((j) => j.id))
      .toEqual(['j6', 'j7', 'j8', 'j9', 'j10']);
  });
});

describe('estadisticasCompetencia', () => {
  it('sin partidos jugados no hay promedios', () => {
    const c = estadisticasCompetencia([partido('a', 'b')], []);
    expect(c).toMatchObject({ jugados: 0, programados: 1, goles: 0, golesPorPartido: null, masGoles: null });
  });

  it('cuenta goles, resultados, tarjetas y destaca partidos y equipos', () => {
    const ps = [
      partido('a', 'b', 3, 1, { tarjetas: [{ jugador_id: 'a1', tipo: 'amarilla' }, { jugador_id: 'b1', tipo: 'roja' }] }),
      partido('b', 'c', 0, 0),
      partido('a', 'c', 2, 4),
    ];
    const c = estadisticasCompetencia(ps, calcularPosiciones(equipos, ps, puntos));
    expect(c).toMatchObject({ jugados: 3, goles: 10, victoriasLocal: 1, empates: 1, victoriasVisitante: 1, sinGoles: 1, amarillas: 1, rojas: 1 });
    expect(c.golesPorPartido).toBeCloseTo(10 / 3);
    expect(c.masGoles?.id).toBe(ps[2].id);
    expect(c.mayorGoleada?.id).toBe(ps[0].id);
    expect(c.mejorOfensiva?.equipo_id).toBe('a');
    expect(c.mejorDefensa?.equipo_id).toBe('c');
  });
});

describe('estadisticasEquipo', () => {
  const plantel = [
    { id: 'x1', equipo_id: 'a', nombre: 'Xavi', edad: 30, posicion: 'Medio' },
    { id: 'x2', equipo_id: 'a', nombre: 'Yair', edad: 17, posicion: 'Portero' },
    { id: 'x3', equipo_id: 'a', nombre: 'Zoe', edad: 22, posicion: 'Medio' },
    { id: 'x4', equipo_id: 'b', nombre: 'Otro', edad: 50 },
  ];

  it('sin partidos jugados solo trae la plantilla y el próximo partido', () => {
    const prox = partido('b', 'a');
    const s = estadisticasEquipo('a', [prox, partido('b', 'c')], plantel);
    expect(s).toMatchObject({ jugadores: 3, medianaEdad: 22, menoresDeEdad: 1, pj: 0, golesFavorPorPartido: null, racha: [], pendientes: 1 });
    expect(s.promedioEdad).toBeCloseTo(23);
    expect(s.masJoven?.id).toBe('x2');
    expect(s.masGrande?.id).toBe('x1');
    expect(s.porPosicion.find((x) => x.posicion === 'Medio')?.jugadores).toBe(2);
    expect(s.proximo?.id).toBe(prox.id);
  });

  it('cuenta resultados como local y visitante, racha y porterías en cero', () => {
    const ps = [partido('a', 'b', 2, 0), partido('c', 'a', 1, 1), partido('b', 'a', 3, 0), partido('a', 'c', 4, 0), partido('b', 'c', 9, 0)];
    const goleo = [{ jugador_id: 'x1', equipo_id: 'a', goles: 4 }, { jugador_id: 'x4', equipo_id: 'b', goles: 9 }];
    const tarjetas = [{ jugador_id: 'x2', equipo_id: 'a', amarillas: 2, rojas: 1, pendientes: 1 }];
    const s = estadisticasEquipo('a', ps, plantel, goleo, tarjetas);
    expect(s).toMatchObject({ pj: 4, g: 2, e: 1, p: 1, gf: 7, gc: 4, porteriaEnCero: 2, sinAnotar: 1, amarillas: 2, rojas: 1 });
    expect(s.racha).toEqual(['G', 'E', 'P', 'G']);
    expect(s.golesFavorPorPartido).toBeCloseTo(7 / 4);
    expect(s.mayorVictoria?.partido.id).toBe(ps[3].id);
    expect(s.goleadores.map((g) => g.jugador_id)).toEqual(['x1']);
    expect(s.suspendidos).toHaveLength(1);
    expect(s.resultados[2]).toMatchObject({ rival_id: 'b', local: false, gf: 0, gc: 3 });
  });
});
