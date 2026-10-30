// Manifest de la web app (instalable en el teléfono).
import type { APIRoute } from 'astro';
import { datos } from '../lib/datos';

export const GET: APIRoute = async () => {
  const { torneo } = await datos();
  const manifest = {
    name: `${torneo.nombre} ${torneo.temporada}`,
    short_name: 'Supercopa NR',
    description: torneo.descripcion,
    lang: 'es-MX',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0907',
    theme_color: '#0a0907',
    icons: [
      { src: '/favicon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Calendario', url: '/calendario/' },
      { name: 'Posiciones', url: '/posiciones/' },
      { name: 'Resultados', url: '/resultados/' },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/manifest+json' } });
};
