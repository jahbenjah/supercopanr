// Convierte a .webp las imágenes JPG/PNG de public/img y mueve el original a
// imagenes-originales/ (fuera de public, no se publica).
// Uso: npm run imagenes            → todas
//      npm run imagenes -- <ruta>  → solo esos archivos
import { mkdirSync, readdirSync, renameSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import sharp from 'sharp';

const RAIZ = 'public/img';
const ORIGINALES = 'imagenes-originales';
// Ancho máximo por carpeta; las galerías (subcarpetas) usan el de 'galeria'.
const ANCHO = { equipos: 512, patrocinadores: 600, arbitros: 600, jugadores: 600, 'cuerpo-tecnico': 600, sedes: 1600, galeria: 1600, medios: 512 };

function archivos(dir) {
  return readdirSync(dir).flatMap((f) => {
    const ruta = join(dir, f);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

let n = 0;
const elegidos = process.argv.slice(2);
for (const ruta of (elegidos.length ? elegidos : archivos(RAIZ)).filter((f) => /\.(jpe?g|png)$/i.test(f))) {
  const partes = relative(RAIZ, ruta).split(/[\\/]/);
  const ancho = partes.length > 2 ? ANCHO.galeria : (ANCHO[partes[0]] ?? 1600);
  const destino = ruta.replace(/\.(jpe?g|png)$/i, '.webp').toLowerCase();
  await sharp(ruta).rotate().resize({ width: ancho, withoutEnlargement: true }).webp({ quality: 82 }).toFile(destino);
  const respaldo = join(ORIGINALES, relative(RAIZ, ruta));
  mkdirSync(dirname(respaldo), { recursive: true });
  renameSync(ruta, respaldo);
  console.log(`${ruta} → ${destino}`);
  n++;
}
console.log(n ? `${n} imágenes convertidas.` : 'No hay imágenes JPG/PNG por convertir.');
