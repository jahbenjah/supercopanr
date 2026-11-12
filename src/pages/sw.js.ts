// Service worker. Se genera en cada build con una versión nueva para que los
// teléfonos descarten la caché anterior. Si hay onesignal_app_id, importa el
// worker de OneSignal para recibir notificaciones push.
import type { APIRoute } from 'astro';
import { datos } from '../lib/datos';

const VERSION = Date.now().toString(36);

export const GET: APIRoute = async () => {
  const { torneo } = await datos();
  const onesignal = torneo.onesignal_app_id
    ? `importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');\n`
    : '';
  const js = `${onesignal}
const CACHE = 'supercopa-${VERSION}';
const OFFLINE = '/offline/';
const PRECACHE = ['/', OFFLINE, '/manifest.webmanifest', '/favicon-192.png', '/logo-header.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('supercopa-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const guardar = (req, res) => {
  if (res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
  return res;
};

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  // Páginas: primero la red (resultados al día); sin conexión, la última copia guardada.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => guardar(req, res))
        .catch(() => caches.match(req).then((r) => r || caches.match(OFFLINE))),
    );
    return;
  }
  // CSS/JS con hash: nunca cambian, primero la caché.
  if (url.pathname.startsWith('/_astro/')) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => guardar(req, res))));
    return;
  }
  // Imágenes: la caché al instante y se actualiza en segundo plano. Las de
  // /compartir/ cambian con cada resultado: siempre de la red.
  if (url.pathname.startsWith('/compartir/')) return;
  if (url.pathname.startsWith('/img/') || /\\.(png|jpe?g|webp|svg)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((r) => {
        const red = fetch(req).then((res) => guardar(req, res)).catch(() => r);
        return r || red;
      }),
    );
  }
});
`;
  return new Response(js, { headers: { 'Content-Type': 'application/javascript' } });
};
