// Imagen para compartir de cada patrocinador con logo (ver src/lib/og.ts).
import type { APIRoute } from 'astro';
import { datos } from '../../../lib/datos';
import { imagenOg } from '../../../lib/og';

export async function getStaticPaths() {
  const d = await datos();
  return d.patrocinadores.filter((p) => p.logo).map((p) => ({ params: { id: p.id } }));
}

export const GET: APIRoute = async ({ params }) => {
  const p = (await datos()).por.patrocinadores.get(params.id!)!;
  return imagenOg(p.logo!, p.color);
};
