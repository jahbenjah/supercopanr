// Esquemas de los datos del torneo. Cada archivo YAML de src/data es una "tabla"
// con ids y llaves foráneas (*_id), igual que en una base de datos, para poder
// migrar a Supabase sin cambiar las páginas. La integridad entre tablas se
// verifica en src/lib/datos.ts.
import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';

const id = z.string().regex(/^[a-z0-9-]+$/, 'usa solo minúsculas, números y guiones');
const whatsapp = z.string().regex(/^\d{10,13}$/, 'número con lada, sin espacios ni +');

const torneo = defineCollection({
  loader: file('src/data/torneo.yaml'),
  schema: z.object({
    nombre: z.string(),
    temporada: z.string(),
    descripcion: z.string(),
    categorias: z.array(z.object({ id, nombre: z.string(), grupos: z.array(z.string()) })),
    formato: z.string(),
    puntos: z.object({ victoria: z.number(), empate: z.number(), derrota: z.number() }),
    desempate: z.array(z.string()),
    amarillas_para_suspension: z.number().int().positive(),
    partidos_suspension_roja: z.number().int().nonnegative(),
    contacto_whatsapp: whatsapp,
    facebook: z.url(),
    sitio_principal: z.url(),
  }),
});

const sedes = defineCollection({
  loader: file('src/data/sedes.yaml'),
  schema: z.object({
    nombre: z.string(),
    direccion: z.string(),
    maps_url: z.url(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    cancha: z.string().optional(),
    servicios: z.array(z.string()).default([]),
  }),
});

const equipos = defineCollection({
  loader: file('src/data/equipos.yaml'),
  schema: z.object({
    nombre: z.string(),
    categoria: id,
    grupo: z.string(),
    color: z.string().default('#0b6e4f'),
    logo: z.string().optional(),
    sede_id: id.optional(),
    delegado: z.string().optional(),
    descripcion: z.string().optional(),
    perfil_premium: z.boolean().default(false),
    whatsapp: whatsapp.optional(),
    facebook: z.url().optional(),
    fotos: z.array(z.string()).default([]),
    patrocinadores_ids: z.array(id).default([]),
  }),
});

const jugadores = defineCollection({
  loader: file('src/data/jugadores.yaml'),
  schema: z.object({
    equipo_id: id,
    nombre: z.string(),
    numero: z.number().int().nonnegative().optional(),
    posicion: z.enum(['Portero', 'Defensa', 'Medio', 'Delantero']).optional(),
    foto: z.string().optional(),
  }),
});

const arbitros = defineCollection({
  loader: file('src/data/arbitros.yaml'),
  schema: z.object({
    nombre: z.string(),
    foto: z.string().optional(),
    zona: z.string().optional(),
    experiencia: z.string().optional(),
    whatsapp: whatsapp.optional(),
    destacado: z.boolean().default(false),
  }),
});

const evento = z.object({ jugador_id: id, minuto: z.number().int().min(0).max(130).optional() });

const partidos = defineCollection({
  loader: file('src/data/partidos.yaml'),
  schema: z
    .object({
      jornada: z.number().int().positive(),
      categoria: id,
      fecha: z.coerce.date(),
      hora: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      sede_id: id.optional(),
      local_id: id,
      visitante_id: id,
      arbitro_id: id.optional(),
      estado: z.enum(['programado', 'jugado', 'suspendido', 'default']),
      goles_local: z.number().int().nonnegative().optional(),
      goles_visitante: z.number().int().nonnegative().optional(),
      goles: z.array(evento).default([]),
      tarjetas: z.array(evento.extend({ tipo: z.enum(['amarilla', 'roja']) })).default([]),
      patrocinador_jornada_id: id.optional(),
      notas: z.string().optional(),
    })
    .refine(
      (p) => !['jugado', 'default'].includes(p.estado) || (p.goles_local != null && p.goles_visitante != null),
      { message: 'un partido jugado o por default necesita goles_local y goles_visitante' },
    )
    .refine((p) => p.local_id !== p.visitante_id, { message: 'local y visitante no pueden ser el mismo equipo' }),
});

const patrocinadores = defineCollection({
  loader: file('src/data/patrocinadores.yaml'),
  schema: z.object({
    nombre: z.string(),
    nivel: z.enum(['oro', 'plata', 'bronce', 'equipo']),
    logo: z.string().optional(),
    url: z.url().optional(),
    whatsapp: whatsapp.optional(),
    ubicaciones: z.array(z.enum(['home-top', 'tabla', 'partido', 'jornada', 'footer'])).default([]),
  }),
});

const paquetes = defineCollection({
  loader: file('src/data/paquetes.yaml'),
  schema: z.object({
    nombre: z.string(),
    precio: z.number().nonnegative(),
    periodo: z.string(),
    destacado: z.boolean().default(false),
    beneficios: z.array(z.string()),
  }),
});

export const collections = { torneo, sedes, equipos, jugadores, arbitros, partidos, patrocinadores, paquetes };
