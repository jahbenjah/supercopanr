// Imagen para compartir de cada medio con logo (ver src/lib/og.ts).
import type { APIRoute } from 'astro';
import { datos } from '../../../lib/datos';
import { imagenOg } from '../../../lib/og';

export async function getStaticPaths() {
  const d = await datos();
  return d.medios.filter((m) => m.logo).map((m) => ({ params: { id: m.id } }));
}

export const GET: APIRoute = async ({ params }) => {
  const m = (await datos()).por.medios.get(params.id!)!;
  return imagenOg(m.logo!, m.color);
};
