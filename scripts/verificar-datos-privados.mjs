// Falla si encuentra datos personales (CURP o fecha de nacimiento) en archivos
// que se publican o se suben al repo. Se ejecuta después de `npm run build`
// sobre dist/ y desde los tests sobre src/data y public.
// Uso: node scripts/verificar-datos-privados.mjs <carpeta> [...]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// CURP: 4 letras, AAMMDD, sexo, 2 letras de estado, 3 consonantes, 2 caracteres.
const CURP = /\b[A-Z0-9][A-Z]{3}\d{6}[HMX][A-Z]{5}[A-Z0-9]\d\b/;
const CAMPOS = /^\s*(curp|fecha_nacimiento)\s*:/m;
const TEXTO = /\.(html?|xml|json|ya?ml|js|mjs|css|txt|csv|md|webmanifest)$/i;

function archivos(dir) {
  return readdirSync(dir).flatMap((f) => {
    const ruta = join(dir, f);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

export function buscarDatosPrivados(carpetas) {
  const hallazgos = [];
  for (const dir of carpetas) {
    for (const ruta of archivos(dir).filter((f) => TEXTO.test(f))) {
      const texto = readFileSync(ruta, 'utf8');
      const m = texto.match(CURP) ?? texto.match(CAMPOS);
      if (m) hallazgos.push(`${ruta}: «${m[0].trim()}»`);
    }
  }
  return hallazgos;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const hallazgos = buscarDatosPrivados(process.argv.slice(2));
  if (hallazgos.length) {
    console.error('✗ Datos personales en archivos públicos:\n  ' + hallazgos.join('\n  '));
    process.exit(1);
  }
  console.log('✓ Sin datos personales en', process.argv.slice(2).join(', '));
}
