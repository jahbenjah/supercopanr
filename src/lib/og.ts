// Imagen para compartir (og:image): 1200×630 PNG con un logo y el de la Supercopa
// sobre un degradado del color dado. Sin texto, para no depender de las fuentes del
// servidor; el nombre va en og:title.
import sharp from 'sharp';

const ANCHO = 1200;
const ALTO = 630;

/** `logo` es la ruta pública (p. ej. /img/equipos/tigres-y.webp). */
export async function imagenOg(logo: string, color: string) {
  const fondo = `<svg width="${ANCHO}" height="${ALTO}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#0a0907"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect x="96" y="75" width="480" height="480" rx="48" fill="#ffffff"/>
  </svg>`;
  const imagen = await sharp(`public${logo}`).resize(440, 440, { fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' }).toBuffer();
  const supercopa = await sharp('public/logo-oficial.jpg').resize(400, 400).toBuffer();
  const png = await sharp(Buffer.from(fondo))
    .composite([
      { input: imagen, left: 116, top: 95 },
      { input: supercopa, left: 680, top: 115 },
    ])
    .png()
    .toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
}
