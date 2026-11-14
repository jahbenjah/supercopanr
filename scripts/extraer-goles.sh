#!/usr/bin/env bash
# Extrae los resultados, goles y tarjetas de los partidos jugados desde la API de
# copafinal.com y actualiza src/data/partidos.yaml.
#
# Por cada partido jugado que trae la API (id <grupo>-j<jornada>, p. ej. a-j1):
#   - estado: jugado, goles_local y goles_visitante (el marcador)
#   - goles: la lista completa de goles con jugador_id y minuto (se reemplaza)
#   - tarjetas: amarillas y rojas con jugador_id, tipo y minuto (se reemplaza);
#     se copian tal como vienen en la cédula, incluida la doble amarilla
# El resto del partido (notas, sede, hora…) no se toca.
#
# El jugador se busca por nombre entre los jugadores de su equipo en
# jugadores.yaml (sin importar el orden de nombres y apellidos ni acentos). Si
# no se encuentra, se avisa y ese gol o tarjeta no se agrega; el marcador sí se guarda.
#
# Uso: scripts/extraer-goles.sh   (o npm run goles)
set -euo pipefail
cd "$(dirname "$0")/.."

BASE=https://plantilla1.copafinal.com/Categorias/Partidos
L=871ea7444fd7108f5e34859ddf414262   # liga
C=5e99e2d08d54285828d62da4f6a9e521   # categoría

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

api() { # api <archivo.php> <salida> [campo=valor]
  curl -sS --fail --location "$BASE/$1" \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    -H 'Origin: https://plantilla1.copafinal.com' \
    -H "Referer: https://plantilla1.copafinal.com/?l=$L" \
    -A 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36' \
    --data-urlencode "L=$L" --data-urlencode "C=$C" ${3:+--data-urlencode "$3"} \
    -o "$TMP/$2"
}

# Las jornadas de la fase de grupos; cada una tiene su propio identificador.
echo "⬇  jornadas"
api Fases.php fases.json TP=Jornada
FASES=$(python3 -I -c '
import html, json, re, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
if d.get("Resultado") != "Exitoso": sys.exit("   ✗ la API respondió: %s %s" % (d.get("Resultado"), d.get("Mensaje") or ""))
print(" ".join(dict.fromkeys(re.findall(r"JSMuestraResultados\(\x27([0-9a-f]{32})\x27\)", html.unescape(d.get("Fases") or "")))))
' "$TMP/fases.json")
[ -n "$FASES" ] || { echo "   no hay jornadas con resultados"; exit 0; }

n=0
for f in $FASES; do
  n=$((n + 1))
  echo "⬇  resultados de la jornada $n"
  api Resultados.php "resultados-$n.json" "TP=$f"
done

python3 -I - src/data "$TMP"/resultados-*.json <<'PY'
import html, json, re, sys, unicodedata

data_dir, *archivos = sys.argv[1:]

def plano(s):
    return unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
VACIAS = {'DE', 'DEL', 'LA', 'LAS', 'LOS', 'EL', 'FC', 'CLUB', 'DEPORTIVO', 'Y'}
def palabras(s):
    return set(re.findall(r'[A-Z0-9]+', plano(s).upper())) - VACIAS
def sin_tags(s):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', s)).strip()

# ---------- YAML por bloques (conserva comentarios y orden) ----------
def lee(archivo):
    texto = open(f'{data_dir}/{archivo}', encoding='utf-8').read()
    partes = re.split(r'(?m)^(?=- id:)', texto)
    return partes[0], partes[1:]
def campo(b, k):
    m = re.search(rf'(?m)^(?:- |  ){k}:[ \t]*(.*?)\s*$', b)
    return m.group(1).strip('"') if m else None
def pon(b, k, v, despues):
    """Cambia `k` en el bloque o lo inserta después del primer campo de `despues` que exista."""
    linea = f'  {k}: {v}'
    if re.search(rf'(?m)^  {k}:', b):
        return re.sub(rf'(?m)^  {k}:.*$', lambda _: linea, b, count=1)
    for d in despues:
        m = re.search(rf'(?m)^(?:- |  ){d}:.*$', b)
        if m: return b[:m.end()] + '\n' + linea + b[m.end():]
    return b.rstrip('\n') + '\n' + linea + '\n'
def pon_lista(b, k, items, despues):
    """Reemplaza la lista `k` (en línea o con guiones) por `items`, o la inserta."""
    nuevo = f'  {k}: []' if not items else f'  {k}:\n' + '\n'.join(f'    - {i}' for i in items)
    m = re.search(rf'(?m)^  {k}:.*(?:\n(?:    |  - ).*)*', b)
    if m: return b[:m.start()] + nuevo + b[m.end():]
    for d in despues:
        # Después del campo y de su lista, si la tiene (p. ej. tarjetas va tras todos los goles).
        m = re.search(rf'(?m)^(?:- |  ){d}:.*(?:\n(?:    |  - ).*)*', b)
        if m: return b[:m.end()] + '\n' + nuevo + b[m.end():]
    return b.rstrip('\n') + '\n' + nuevo + '\n'

# ---------- Lectura de la API ----------
def eventos(lado):
    """Un renglón por evento: «<ícono> 3' Nombre» (local) o «Nombre 3' <ícono>» (visitante).
    El ícono dice qué fue: balón = gol, Amonestados = amarilla, Expulsados = roja."""
    goles, tarjetas = [], []
    for r in re.split(r'<br\s*/?>', lado):
        t = sin_tags(r)
        if not t: continue
        m = re.search(r"(\d+)\s*'", t)
        e = {'nombre': re.sub(r'\s+', ' ', re.sub(r"\d+\s*'", ' ', t).strip(" '")), 'minuto': int(m[1]) if m else None}
        if "class='Balon'" in r: goles.append(e)
        elif 'Amonestados' in r: tarjetas.append(e | {'tipo': 'amarilla'})
        elif 'Expulsados' in r: tarjetas.append(e | {'tipo': 'roja'})
        else: print(f'   ⚠ evento no reconocido, se omite: {t}')
    return goles, tarjetas

api = []
for archivo in archivos:
    d = json.load(open(archivo, encoding='utf-8'))
    if d.get('Resultado') != 'Exitoso':
        sys.exit(f'   ✗ la API respondió: {d.get("Resultado")} {d.get("Mensaje") or ""}')
    for b in html.unescape(d.get('Resultados') or '').split("<div class='Resultado'>")[1:]:
        jornada = re.search(r"ResultadoTipo'>\D*(\d+)", b)
        grupo = re.search(r'GRUPO\s+(\w+)', b, re.I)
        equipos = re.findall(r"ResultadoEquipoNombre'>([^<]*)", b)
        marcador = re.findall(r"ResultadoGol'>\s*(\d+)\s*<", b)
        local = re.search(r"ResultadoInformacionLocal'>(.*?)</div>", b, re.S)
        visita = re.search(r"ResultadoInformacionVisitante'>(.*?)</div>", b, re.S)
        if not (jornada and grupo and len(equipos) == 2):
            print(f'   ⚠ resultado no reconocido, se omite: {sin_tags(b)[:120]}'); continue
        if len(marcador) != 2:
            continue  # aún sin marcador
        ev = [eventos(local[1] if local else ''), eventos(visita[1] if visita else '')]
        api.append({
            'id': f'{grupo[1].lower()}-j{jornada[1]}',
            'equipos': [e.strip() for e in equipos],
            'marcador': [int(x) for x in marcador],
            'goles': [ev[0][0], ev[1][0]],
            'tarjetas': [ev[0][1], ev[1][1]],
        })
print(f'   {len(api)} partidos jugados en la API')

# ---------- Equipos y jugadores ----------
_, bloques_eq = lee('equipos.yaml')
nombre_eq = {campo(b, 'id'): campo(b, 'nombre') for b in bloques_eq}
_, bloques_jg = lee('jugadores.yaml')
plantilla = {}
for b in bloques_jg:
    plantilla.setdefault(campo(b, 'equipo_id'), []).append((campo(b, 'id'), campo(b, 'nombre') or ''))

def parecido(nombre_api, equipo_id):
    return len(palabras(nombre_api) & palabras(f"{nombre_eq.get(equipo_id) or ''} {equipo_id.replace('-', ' ')}"))

def jugador_id(nombre, equipo_id):
    """El jugador del equipo que comparte más palabras con el nombre (mínimo 2, o todas si es una sola)."""
    p = palabras(nombre)
    puntos = sorted(((len(p & palabras(n)), j) for j, n in plantilla.get(equipo_id, [])), reverse=True)
    if not puntos: return None
    mejor, jid = puntos[0]
    empate = len(puntos) > 1 and puntos[1][0] == mejor
    return jid if mejor >= min(2, len(p)) and not empate else None

# ---------- Partidos ----------
cab, bloques = lee('partidos.yaml')
indice = {campo(b, 'id'): i for i, b in enumerate(bloques)}
cambios = sin_jugador = 0
for a in api:
    if a['id'] not in indice:
        print(f'   ⚠ {a["id"]} no está en partidos.yaml ({a["equipos"][0]} vs {a["equipos"][1]}); corre antes npm run partidos'); continue
    b = antes = bloques[indice[a['id']]]
    lados = [campo(b, 'local_id'), campo(b, 'visitante_id')]
    # Si la API trae a los equipos al revés que el YAML, se voltea el resultado.
    if parecido(a['equipos'][0], lados[1]) + parecido(a['equipos'][1], lados[0]) > parecido(a['equipos'][0], lados[0]) + parecido(a['equipos'][1], lados[1]):
        for k in ('marcador', 'goles', 'tarjetas'): a[k].reverse()

    def lista(clave, que):
        """Eventos de ambos lados con su jugador_id, ordenados por minuto, como líneas YAML."""
        global sin_jugador
        filas = []
        for lado, eq in zip(a[clave], lados):
            for e in lado:
                jid = jugador_id(e['nombre'], eq)
                if not jid:
                    sin_jugador += 1
                    print(f'   ⚠ {a["id"]}: no encontré a "{e["nombre"]}" en {eq} ({que(e)} al {e["minuto"]}\'); no se agrega')
                    continue
                campos = [f'jugador_id: {jid}'] + ([f'tipo: {e["tipo"]}'] if 'tipo' in e else []) + ([f'minuto: {e["minuto"]}'] if e['minuto'] is not None else [])
                filas.append((e['minuto'] if e['minuto'] is not None else 999, '{ ' + ', '.join(campos) + ' }'))
        return [f for _, f in sorted(filas, key=lambda x: x[0])]  # sort estable: respeta el orden de la cédula

    items = lista('goles', lambda e: 'gol')
    tarjetas = lista('tarjetas', lambda e: f'tarjeta {e["tipo"]}')
    b = pon(b, 'estado', 'jugado', ['visitante_id'])
    b = pon(b, 'goles_local', a['marcador'][0], ['estado'])
    b = pon(b, 'goles_visitante', a['marcador'][1], ['goles_local'])
    b = pon_lista(b, 'goles', items, ['penales_visitante', 'penales_local', 'goles_visitante'])
    b = pon_lista(b, 'tarjetas', tarjetas, ['goles', 'goles_visitante'])
    if b != antes:
        bloques[indice[a['id']]] = b; cambios += 1
        print(f'   ~ {a["id"]}: {lados[0]} {a["marcador"][0]}-{a["marcador"][1]} {lados[1]}, {len(items)} goles, {len(tarjetas)} tarjetas')
with open(f'{data_dir}/partidos.yaml', 'w', encoding='utf-8') as fh:
    fh.write(cab + ''.join(bloques))
print(f'   ✓ partidos.yaml: {cambios} actualizados' + (f', {sin_jugador} eventos sin jugador (revisa los avisos)' if sin_jugador else ''))
PY
echo "Listo."
