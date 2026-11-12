#!/usr/bin/env bash
# Extrae los jugadores y el cuerpo técnico de cada equipo desde la API de
# copafinal.com y los guarda en src/data/jugadores.yaml y
# src/data/cuerpo-tecnico.yaml (reemplaza lo que ya tenía ese equipo).
# Las fotos se descargan a public/img/{jugadores,cuerpo-tecnico}/<id> y se
# convierten a .webp.
#
# Los datos personales (CURP y fecha de nacimiento) NO van al repo: se guardan
# en privado/jugadores.csv, que está en .gitignore. El sitio no los usa.
#
# Entrada: scripts/equipos-api.csv  (equipo_id,uuid); el uuid es el parámetro E
# de la API. Los equipos sin uuid se omiten.
#
# Uso: scripts/extraer-jugadores.sh               → todos los equipos con uuid
#      scripts/extraer-jugadores.sh acepi tlazala → solo esos equipos
set -euo pipefail
cd "$(dirname "$0")/.."

CSV=scripts/equipos-api.csv
DATA=src/data
IMG=public/img
PRIVADO=privado/jugadores.csv
API=https://plantilla1.copafinal.com/Categorias/Jugadores/Personal.php
L=871ea7444fd7108f5e34859ddf414262   # liga
C=5e99e2d08d54285828d62da4f6a9e521   # categoría

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

while IFS=, read -r -u 3 equipo uuid; do
  equipo=${equipo//[$'\r\t ']/}
  uuid=${uuid//[$'\r\t ']/}
  [[ -z $equipo || $equipo == equipo_id ]] && continue
  (($#)) && [[ " $* " != *" $equipo "* ]] && continue
  if [[ -z $uuid ]]; then echo "⏭  $equipo: sin uuid, se omite"; continue; fi

  echo "⬇  $equipo"
  curl -sS --fail --location "$API" \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    -H 'Origin: https://plantilla1.copafinal.com' \
    -H "Referer: https://plantilla1.copafinal.com/?l=$L" \
    -A 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36' \
    --data-urlencode "L=$L" --data-urlencode "C=$C" --data-urlencode "E=$uuid" \
    -o "$TMP/$equipo.json"

  python3 -I - "$TMP/$equipo.json" "$DATA" "$IMG" "$equipo" "$PRIVADO" <<'PY'
import csv, html, json, os, re, sys, unicodedata, urllib.request

resp, data_dir, img_dir, equipo, privado = sys.argv[1:6]
datos = json.load(open(resp, encoding='utf-8'))
if datos.get('Resultado') != 'Exitoso' or not datos.get('Personal'):
    sys.exit(f'   ✗ la API respondió: {datos.get("Resultado")} {datos.get("Mensaje") or ""}')
h = html.unescape(datos['Personal'])

PARTICULAS = {'DE', 'LA', 'DEL', 'LOS', 'LAS', 'Y'}
def capitaliza(w): return w.lower() if w.upper() in PARTICULAS else w.capitalize()
def toma_apellido(tok):
    out = []
    while tok and tok[0].upper() in PARTICULAS: out.append(tok.pop(0))
    if tok: out.append(tok.pop(0))
    return out
def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')

# La API da "APELLIDO1 APELLIDO2 NOMBRES"; se guarda como "Nombres Apellido1 Apellido2".
def nombre_legible(crudo):
    tok = crudo.split()
    ap = toma_apellido(tok)
    if len(tok) > 1: ap += toma_apellido(tok)
    n = ' '.join(capitaliza(w) for w in tok + ap)
    return n[:1].upper() + n[1:]

def foto_de(b, carpeta, jid):
    m = re.search(r"url\(([^)]*)\)", b)
    if not m: return '  foto: ""'
    if not os.path.exists(f'{img_dir}/{carpeta}/{jid}.webp'):
        os.makedirs(f'{img_dir}/{carpeta}', exist_ok=True)
        ext = m.group(1).rsplit('.', 1)[-1].lower()
        urllib.request.urlretrieve(m.group(1), f'{img_dir}/{carpeta}/{jid}.{ext}')
    return f'  foto: "/img/{carpeta}/{jid}.webp"'

# Reescribe un YAML conservando las entradas de los demás equipos.
# `generar(ids)` devuelve los bloques nuevos; `ids` son los ya ocupados.
def reescribe(archivo, generar):
    ruta = f'{data_dir}/{archivo}'
    texto = open(ruta, encoding='utf-8').read() if os.path.exists(ruta) else ''
    partes = re.split(r'(?m)^(?=- id:)', texto)
    cabecera, bloques = partes[0], [b.strip() for b in partes[1:]]
    bloques = [b for b in bloques if not re.search(rf'(?m)^\s+equipo_id:\s*{re.escape(equipo)}\s*$', b)]
    nuevos = generar(set(re.findall(r'^- id: (\S+)', '\n'.join(bloques), re.M)))
    with open(ruta, 'w', encoding='utf-8') as fh:
        fh.write(cabecera + '\n\n'.join(bloques + nuevos) + '\n')
    print(f'   ✓ {archivo}: {len(nuevos)}')

def id_unico(nombre, ids):
    jid = base = slug(nombre); k = 2
    while jid in ids: jid = f'{base}-{k}'; k += 1
    ids.add(jid)
    return jid

def jugadores(ids):
    nuevos = []
    for b in h.split("<div class='Jugador'>")[1:]:
        nombre = nombre_legible(re.search(r"JugadorInformacionNombre'>([^<]*)", b).group(1))
        campos = {k.strip(): v.strip() for k, v in re.findall(r"Titulo'>([^:<]*):</span>\s*([^<]*)", b)}
        numero = campos.get('Camiseta', '')
        posicion = campos.get('Posición', '')
        fn = re.search(r'(\d{2})/(\d{2})/(\d{4})', campos.get('Edad', ''))
        curp = campos.get('Folio', '').upper()
        jid = id_unico(nombre, ids)
        y = [f'- id: {jid}', f'  nombre: {nombre}']
        if numero.isdigit(): y.append(f'  numero: {int(numero)}')
        if posicion in ('Portero', 'Defensa', 'Medio', 'Delantero'): y.append(f'  posicion: "{posicion}"')
        y += [f'  equipo_id: {equipo}', foto_de(b, 'jugadores', jid)]
        nuevos.append('\n'.join(y))
        privados.append({'jugador_id': jid, 'equipo_id': equipo, 'nombre': nombre, 'curp': curp,
                         'fecha_nacimiento': f'{fn[3]}-{fn[2]}-{fn[1]}' if fn else ''})
    return nuevos

# El cuerpo técnico viene con el nombre en orden variable; solo se capitaliza.
def cuerpo_tecnico(ids):
    nuevos = []
    for b in h.split("<div class='CuerpoTecnico'>")[1:]:
        crudo = re.search(r"CuerpoTecnicoInformacionNombre'>([^<]*)", b).group(1).split()
        nombre = ' '.join(capitaliza(w) for w in crudo)
        nombre = nombre[:1].upper() + nombre[1:]
        funcion = re.search(r"CuerpoTecnicoInformacionFuncion'>([^<]*)", b).group(1).strip()
        cid = id_unico(nombre, ids)
        y = [f'- id: {cid}', f'  nombre: {nombre}']
        if funcion: y.append(f'  funcion: "{funcion}"')
        y += [f'  equipo_id: {equipo}', foto_de(b, 'cuerpo-tecnico', cid)]
        nuevos.append('\n'.join(y))
    return nuevos

privados = []
reescribe('jugadores.yaml', jugadores)
reescribe('cuerpo-tecnico.yaml', cuerpo_tecnico)

# Datos personales: fuera del repo, reemplazando las filas de este equipo.
CAMPOS = ['jugador_id', 'equipo_id', 'nombre', 'curp', 'fecha_nacimiento']
os.makedirs(os.path.dirname(privado), exist_ok=True)
filas = list(csv.DictReader(open(privado, encoding='utf-8'))) if os.path.exists(privado) else []
filas = [f for f in filas if f['equipo_id'] != equipo] + privados
with open(privado, 'w', encoding='utf-8', newline='') as fh:
    w = csv.DictWriter(fh, CAMPOS); w.writeheader(); w.writerows(filas)
os.chmod(privado, 0o600)
print(f'   ✓ {privado}: {len(privados)} (privado)')
PY
done 3< "$CSV"

# Convierte a .webp las fotos nuevas.
shopt -s nullglob nocaseglob
fotos=("$IMG"/{jugadores,cuerpo-tecnico}/*.{jpg,jpeg,png})
((${#fotos[@]})) && npm run --silent imagenes -- "${fotos[@]}"
echo "Listo."
