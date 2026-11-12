#!/usr/bin/env bash
# Extrae los próximos partidos de la API de copafinal.com y actualiza
# src/data/partidos.yaml y src/data/sedes.yaml.
#
# Partidos: el id es <grupo>-j<jornada> (p. ej. a-j1). Si ya existe se actualizan
# fecha, hora, sede_id, local_id y visitante_id; el resto (estado, goles,
# tarjetas, notas…) no se toca. Si no existe, se agrega como "programado".
# La API solo devuelve partidos pendientes: los ya jugados no se modifican.
#
# Sedes: el campo se busca por su liga de Maps, por id o por nombre. Si existe
# se actualizan maps_url, lat y lng (las coordenadas salen de la liga de Maps);
# si no, se agrega una sede nueva con dirección genérica para completar a mano.
#
# Uso: scripts/extraer-partidos.sh   (o npm run partidos)
set -euo pipefail
cd "$(dirname "$0")/.."

API=https://plantilla1.copafinal.com/Categorias/Partidos/ProximosPartidos.php
L=871ea7444fd7108f5e34859ddf414262   # liga
C=5e99e2d08d54285828d62da4f6a9e521   # categoría

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "⬇  próximos partidos"
curl -sS --fail --location "$API" \
  -H 'Accept: application/json' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'Origin: https://plantilla1.copafinal.com' \
  -H "Referer: https://plantilla1.copafinal.com/?l=$L" \
  -A 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36' \
  --data-urlencode "L=$L" --data-urlencode "C=$C" \
  -o "$TMP/partidos.json"

python3 -I - "$TMP/partidos.json" src/data <<'PY'
import html, http.client, json, re, sys, unicodedata, urllib.parse

resp, data_dir = sys.argv[1:3]
datos = json.load(open(resp, encoding='utf-8'))
if datos.get('Resultado') != 'Exitoso':
    sys.exit(f'   ✗ la API respondió: {datos.get("Resultado")} {datos.get("Mensaje") or ""}')
h = html.unescape(datos.get('Partidos') or '')

def plano(s):
    return unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', plano(s).lower()).strip('-')
VACIAS = {'DE', 'DEL', 'LA', 'LAS', 'LOS', 'EL', 'FC', 'CLUB', 'DEPORTIVO', 'CAMPO', 'UNIDAD'}
def palabras(s):
    return set(re.findall(r'[A-Z0-9]+', plano(s).upper())) - VACIAS
def q(v):
    if isinstance(v, (int, float)): return str(v)
    return json.dumps(v, ensure_ascii=False) if re.search(r'^\d+:\d+$|:\s|\s#|^[-?:,\[\]{}#&*!|>\'"%@`]|^\s|\s$|:$', v) or v == '' else v
def titulo(s):
    return ' '.join(w.capitalize() if w.isupper() or w.islower() else w for w in s.split()) if s.isupper() else s

# ---------- YAML por bloques (conserva comentarios y orden) ----------
def lee(archivo):
    texto = open(f'{data_dir}/{archivo}', encoding='utf-8').read()
    partes = re.split(r'(?m)^(?=- id:)', texto)
    return partes[0], [b.rstrip() for b in partes[1:]]
def escribe(archivo, cabecera, bloques):
    with open(f'{data_dir}/{archivo}', 'w', encoding='utf-8') as fh:
        fh.write(cabecera + '\n'.join(bloques) + '\n')
def campo(b, k):
    m = re.search(rf'(?m)^(?:- |  ){k}:[ \t]*(.*?)\s*$', b)
    return m.group(1).strip('"') if m else None
def pon(b, k, v, despues):
    """Cambia `k` en el bloque o lo inserta después del primer campo de `despues` que exista."""
    linea = f'  {k}: {q(v)}'
    if re.search(rf'(?m)^  {k}:', b):
        return re.sub(rf'(?m)^  {k}:.*$', lambda _: linea, b, count=1)
    for d in despues:
        m = re.search(rf'(?m)^(?:- |  ){d}:.*$', b)
        if m: return b[:m.end()] + '\n' + linea + b[m.end():]
    return b + '\n' + linea

# ---------- Lectura de la API ----------
MESES = {m: i for i, m in enumerate('enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre'.split(), 1)}
FASES = {'regular': 'grupos', 'octavos': 'octavos', 'cuartos': 'cuartos', 'semifinal': 'semifinal', 'final': 'final'}
def texto(b, clase):
    m = re.search(rf"class='{clase}'>(.*?)</div>", b, re.S)
    return re.sub(r'<[^>]+>', '', m.group(1)).strip() if m else ''

api = []
for b in h.split("<div class='ProximoPartido'>")[1:]:
    jornada = re.search(r'\d+', texto(b, 'ProximoPartidoTipo'))
    fase_txt = plano(texto(b, 'ProximoPartidoFase').split('|')[0]).strip().lower()
    grupo = re.search(r'GRUPO\s+(\w+)', b, re.I)
    fh = re.search(r'(\d{1,2}) de (\w+) de (\d{4})\s*-\s*(\d{1,2}):(\d{2})', plano(texto(b, 'ProximoPartidoDiaHora')))
    campo_nombre = re.search(r"ProximoPartidoCampoNombre'>([^<]*)", b)
    mapa = re.search(r"<a href='([^']*)'", b)
    equipos = re.findall(r"ProximoPartidoEquipoNombre'>([^<]*)", b)
    if not (jornada and fh and len(equipos) == 2):
        print(f'   ⚠ partido no reconocido, se omite: {re.sub(r"<[^>]+>", " ", b)[:120]}'); continue
    api.append({
        'fase': FASES.get(fase_txt.split()[0] if fase_txt else '', fase_txt),
        'jornada': int(jornada.group()),
        'grupo': grupo.group(1).upper() if grupo else None,
        'fecha': f'{fh[3]}-{MESES[fh[2].lower()]:02d}-{int(fh[1]):02d}',
        'hora': f'{int(fh[4]):02d}:{fh[5]}',
        'sede': campo_nombre.group(1).strip() if campo_nombre else '',
        'mapa': mapa.group(1) if mapa else '',
        'local': equipos[0].strip(), 'visitante': equipos[1].strip(),
    })
print(f'   {len(api)} partidos en la API')

# ---------- Equipos: nombre de la API → equipo_id ----------
_, bloques_eq = lee('equipos.yaml')
equipos = [{'id': campo(b, 'id'), 'nombre': campo(b, 'nombre'), 'grupo': campo(b, 'grupo')} for b in bloques_eq]
def equipo_id(nombre, grupo):
    candidatos = [e for e in equipos if e['grupo'] == grupo] or equipos
    p = palabras(nombre)
    puntos = sorted(((len(p & palabras(f"{e['nombre']} {e['id'].replace('-', ' ')}")), e['id']) for e in candidatos), reverse=True)
    if not puntos or puntos[0][0] == 0 or (len(puntos) > 1 and puntos[0][0] == puntos[1][0]):
        sys.exit(f'   ✗ no sé qué equipo es "{nombre}" (grupo {grupo}). Ajusta su nombre en equipos.yaml.')
    return puntos[0][1]

# ---------- Sedes ----------
def coordenadas(url):
    """Sigue la liga corta de Maps y toma el pin del lugar (!3d lat !4d lng)."""
    for _ in range(3):
        u = urllib.parse.urlsplit(url)
        if not u.hostname: return None
        try:
            c = http.client.HTTPSConnection(u.hostname, timeout=15)
            c.request('HEAD', u.path + (f'?{u.query}' if u.query else ''))
            r = c.getresponse()
        except OSError:
            return None
        url = r.getheader('Location') or url
        m = re.search(r'!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)', url) or re.search(r'@(-?\d+\.\d+),(-?\d+\.\d+)', url)
        if m: return round(float(m[1]), 6), round(float(m[2]), 6)
        if r.status not in (301, 302, 303, 307, 308): return None
    return None

cab_sedes, bloques_sd = lee('sedes.yaml')
def sede_id(nombre, mapa):
    ids = [campo(b, 'id') for b in bloques_sd]
    for i, b in enumerate(bloques_sd):
        if mapa and campo(b, 'maps_url') == mapa: return i
    s = slug(nombre)
    for cand in (s, f'deportivo-{s}', f'campo-{s}'):
        if cand in ids: return ids.index(cand)
    p = palabras(nombre)
    hits = [i for i, b in enumerate(bloques_sd) if p and p <= palabras(campo(b, 'nombre') or '')]
    return hits[0] if len(hits) == 1 else None

sedes_de = {}
for clave in dict.fromkeys((a['sede'], a['mapa']) for a in api if a['sede']):
    nombre, mapa = clave
    i = sede_id(nombre, mapa)
    coord = coordenadas(mapa) if mapa else None
    if i is None:
        nuevo = slug(nombre)
        b = '\n'.join([f'- id: {nuevo}', f'  nombre: {q(titulo(nombre))}', '  direccion: Cd. Nicolás Romero, Méx.',
                       f'  maps_url: {q(mapa or "https://maps.google.com/?q=" + urllib.parse.quote_plus(nombre + " Nicolas Romero"))}'] +
                      ([f'  lat: {coord[0]}', f'  lng: {coord[1]}'] if coord else []) + ['  servicios: []']) + '\n'
        bloques_sd.append(b)
        i = len(bloques_sd) - 1
        print(f'   + sede nueva: {nuevo} (completa dirección y servicios a mano)')
    else:
        b = bloques_sd[i]
        if mapa: b = pon(b, 'maps_url', mapa, ['direccion'])
        if coord:
            b = pon(b, 'lat', coord[0], ['maps_url'])
            b = pon(b, 'lng', coord[1], ['lat'])
        if b != bloques_sd[i]: print(f'   ~ sede {campo(b, "id")}: liga de Maps y coordenadas')
        bloques_sd[i] = b
    sedes_de[clave] = campo(bloques_sd[i], 'id')
# separa bloques con una línea en blanco
escribe('sedes.yaml', cab_sedes, [b.rstrip() + '\n' for b in bloques_sd[:-1]] + [bloques_sd[-1].rstrip()])

# ---------- Partidos ----------
cab_pt, bloques_pt = lee('partidos.yaml')
indice = {campo(b, 'id'): i for i, b in enumerate(bloques_pt)}
nuevos = cambios = 0
for a in api:
    if a['fase'] != 'grupos' or not a['grupo']:
        print(f'   ⚠ fase "{a["fase"]}" aún no soportada, se omite: {a["local"]} vs {a["visitante"]}'); continue
    pid = f'{a["grupo"].lower()}-j{a["jornada"]}'
    valores = {'fecha': a['fecha'], 'hora': a['hora'], 'sede_id': sedes_de.get((a['sede'], a['mapa'])),
               'local_id': equipo_id(a['local'], a['grupo']), 'visitante_id': equipo_id(a['visitante'], a['grupo'])}
    if pid not in indice:
        b = '\n'.join([f'- id: {pid}', '  fase: grupos', f'  grupo: {a["grupo"]}', f'  jornada: {a["jornada"]}', '  categoria: unica'] +
                      [f'  {k}: {q(v)}' for k, v in valores.items() if v] + ['  estado: programado'])
        bloques_pt.append(b); indice[pid] = len(bloques_pt) - 1; nuevos += 1
        print(f'   + {pid}: {valores["local_id"]} vs {valores["visitante_id"]}, {a["fecha"]} {a["hora"]}')
        continue
    b = antes = bloques_pt[indice[pid]]
    orden = {'fecha': ['categoria', 'jornada'], 'hora': ['fecha'], 'sede_id': ['hora', 'fecha'],
             'local_id': ['sede_id', 'hora', 'fecha'], 'visitante_id': ['local_id']}
    dif = []
    for k, v in valores.items():
        if v and campo(b, k) != str(v):
            dif.append(f'{k} {campo(b, k) or "—"} → {v}')
            b = pon(b, k, v, orden[k])
    if b != antes:
        bloques_pt[indice[pid]] = b; cambios += 1
        print(f'   ~ {pid}: ' + '; '.join(dif))
escribe('partidos.yaml', cab_pt, bloques_pt)
print(f'   ✓ partidos.yaml: {cambios} actualizados, {nuevos} nuevos')

# ---------- Programación en torneo.yaml ----------
# Las fechas que trae la API se recuentan; las demás (fechas futuras aún sin rol
# y fases eliminatorias) se quedan como estén.
from collections import Counter
cuenta = Counter((a['fecha'], a['fase']) for a in api if a['fase'] in FASES.values())
ruta = f'{data_dir}/torneo.yaml'
t = open(ruta, encoding='utf-8').read()
m = re.search(r'(?m)^(\s*)programacion:\n((?:\1  - \{.*\}\n?)+)', t)
if m:
    sangria = m.group(1) + '  '
    filas = {}
    for linea in m.group(2).splitlines():
        f = re.search(r'fecha: (\S+?),\s*fase: (\S+?),\s*partidos: (\d+)', linea)
        if f: filas[(f[1], f[2])] = int(f[3])
    fechas_api = {f for f, _ in cuenta}
    filas = {k: v for k, v in filas.items() if k[0] not in fechas_api} | dict(cuenta)
    nuevo = ''.join(f'{sangria}- {{ fecha: {f}, fase: {fa}, partidos: {n} }}\n' for (f, fa), n in sorted(filas.items()))
    if nuevo != m.group(2).rstrip('\n') + '\n':
        t = t[:m.start(2)] + (nuevo if m.group(2).endswith('\n') else nuevo.rstrip('\n')) + t[m.end(2):]
        open(ruta, 'w', encoding='utf-8').write(t)
        print('   ✓ torneo.yaml: programación ' + ', '.join(f'{f[5:]} {n}' for (f, _), n in sorted(cuenta.items())))
PY
echo "Listo."
