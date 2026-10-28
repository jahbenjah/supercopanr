// Imagen para compartir de cada equipo con logo (ver src/lib/og.ts).
import type { APIRoute } from 'astro';
import { datos } from '../../../lib/datos';
import { imagenOg } from '../../../lib/og';

export async function getStaticPaths() {
  const d = await datos();
  return d.equipos.filter((e) => e.logo).map((e) => ({ params: { id: e.id } }));
}

export const GET: APIRoute = async ({ params }) => {
  const e = (await datos()).por.equipos.get(params.id!)!;
  return imagenOg(e.logo!, e.color);
};
