// Imágenes para compartir en redes, una por cada entrada de imagenesCompartir().
import type { APIRoute, GetStaticPaths } from 'astro';
import { imagenesCompartir, renderizar, type ImagenCompartir } from '../../lib/imagenes';

export const getStaticPaths = (async () =>
  (await imagenesCompartir()).map((imagen) => ({ params: { id: imagen.id }, props: { imagen } }))) satisfies GetStaticPaths;

export const GET: APIRoute<{ imagen: ImagenCompartir }> = async ({ props }) =>
  new Response(new Uint8Array(await renderizar(props.imagen)), { headers: { 'Content-Type': 'image/png' } });
