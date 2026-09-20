# -*- coding: utf-8 -*-
"""Les emprises des écoles et des structures d'accueil, pour la carte.

Écrit `cartes/emprises_kb.js`, lu par l'onglet Communes quand on affiche les
établissements : un point dit où est une école, il ne dit pas que le campus de
Mamer ou celui de Belval occupent tout un îlot. L'emprise le montre.

Source : OpenStreetMap, les surfaces portant `amenity=school`, `college`,
`kindergarten` ou `childcare` au Luxembourg, lues par l'interface Overpass.
Licence ODbL, © les contributeurs d'OpenStreetMap : la carte le crédite déjà.
Le fichier du ministère donne des adresses, pas des contours ; le cadastre
publie des parcelles, mais sans dire lesquelles portent une école. OpenStreetMap
est la seule source ouverte qui dessine le terrain d'une école.

Ce que le script ne fait pas : il ne rapproche pas ces surfaces des noms du
ministère. Les deux couches se superposent sur la carte, et l'oeil fait le lien.
Un rapprochement par le nom serait faux une fois sur cinq, les noms diffèrent.

    python cartes/build_emprises.py
"""

import io
import json
import math
import os
import sys
import urllib.parse
import urllib.request

ICI = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(ICI, "cache")
SORTIE = os.path.join(ICI, "emprises_kb.js")
BRUT = os.path.join(CACHE, "osm_ecoles.json")

REQUETE = """[out:json][timeout:180];
area["ISO3166-1"="LU"][admin_level=2]->.lu;
(
  way["amenity"~"^(school|college|kindergarten|childcare)$"](area.lu);
  relation["amenity"~"^(school|college|kindergarten|childcare)$"](area.lu);
);
out tags geom;"""
SERVEURS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]

TOLERANCE = 1.5      # mètres, simplification des contours
SURFACE_MIN = 60     # m², en dessous c'est un abri ou une erreur de saisie


def telecharger():
    if os.path.exists(BRUT):
        with io.open(BRUT, encoding="utf-8") as f:
            return json.load(f)
    if not os.path.isdir(CACHE):
        os.makedirs(CACHE)
    for url in SERVEURS:
        try:
            sys.stderr.write("overpass %s\n" % url)
            req = urllib.request.Request(url, data=urllib.parse.urlencode({"data": REQUETE}).encode("utf-8"),
                                         headers={"User-Agent": "lux-guide.github.io, construction des emprises scolaires"})
            with urllib.request.urlopen(req, timeout=240) as r:
                brut = r.read().decode("utf-8")
            d = json.loads(brut)
            with io.open(BRUT, "w", encoding="utf-8") as f:
                f.write(brut)
            return d
        except Exception as e:
            sys.stderr.write("   echec : %s\n" % e)
    raise SystemExit("aucun serveur Overpass n'a repondu")


def plan(pt, lat0):
    """Degrés vers mètres, autour d'une latitude : suffisant pour un îlot."""
    return (pt[1] * 111320 * math.cos(math.radians(lat0)), pt[0] * 110540)


def simplifier(pts, tol):
    """Douglas-Peucker, en mètres."""
    if len(pts) < 5:
        return pts
    lat0 = pts[0][0]
    xy = [plan(p, lat0) for p in pts]
    garde = [False] * len(pts)
    garde[0] = garde[-1] = True
    pile = [(0, len(pts) - 1)]
    while pile:
        a, b = pile.pop()
        ax, ay = xy[a]
        bx, by = xy[b]
        dx, dy = bx - ax, by - ay
        n = math.hypot(dx, dy) or 1e-9
        pire, ipire = 0, None
        for i in range(a + 1, b):
            d = abs(dy * (xy[i][0] - ax) - dx * (xy[i][1] - ay)) / n
            if d > pire:
                pire, ipire = d, i
        if ipire is not None and pire > tol:
            garde[ipire] = True
            pile.append((a, ipire))
            pile.append((ipire, b))
    return [p for p, g in zip(pts, garde) if g]


def surface(pts):
    lat0 = pts[0][0]
    xy = [plan(p, lat0) for p in pts]
    return abs(sum(xy[i][0] * xy[i + 1][1] - xy[i + 1][0] * xy[i][1] for i in range(len(xy) - 1))) / 2


def encoder(pts):
    """Le même codage que les limites de communes : polyligne à cinq décimales."""
    out, plat, plon = [], 0, 0
    for lat, lon in pts:
        for v, prec in ((int(round(lat * 1e5)), "lat"), (int(round(lon * 1e5)), "lon")):
            d = v - (plat if prec == "lat" else plon)
            if prec == "lat":
                plat = v
            else:
                plon = v
            d = ~(d << 1) if d < 0 else d << 1
            while d >= 0x20:
                out.append(chr((0x20 | (d & 0x1f)) + 63))
                d >>= 5
            out.append(chr(d + 63))
    return "".join(out)


def anneaux(el):
    """Les contours extérieurs d'un élément, en listes de (lat, lon) fermées."""
    if el["type"] == "way":
        g = [(p["lat"], p["lon"]) for p in el.get("geometry", [])]
        return [g] if len(g) >= 4 and g[0] == g[-1] else []
    morceaux = [[(p["lat"], p["lon"]) for p in m.get("geometry", [])]
                for m in el.get("members", []) if m.get("role") in ("outer", "") and m.get("geometry")]
    fermes, ouverts = [m for m in morceaux if m[0] == m[-1]], [m for m in morceaux if m[0] != m[-1]]
    # Un contour de relation arrive parfois en plusieurs tronçons : on les
    # recolle bout à bout, et on laisse tomber ce qui ne se referme pas.
    while ouverts:
        cours = ouverts.pop(0)
        avance = True
        while avance and cours[0] != cours[-1]:
            avance = False
            for i, m in enumerate(ouverts):
                if m[0] == cours[-1]:
                    cours += m[1:]
                elif m[-1] == cours[-1]:
                    cours += m[::-1][1:]
                else:
                    continue
                ouverts.pop(i)
                avance = True
                break
        if cours[0] == cours[-1] and len(cours) >= 4:
            fermes.append(cours)
    return fermes


def main():
    d = telecharger()
    zones, ecartes = [], 0
    for el in d["elements"]:
        tags = el.get("tags", {})
        genre = "ec" if tags.get("amenity") in ("school", "college") else "ac"
        contours, total = [], 0
        for a in anneaux(el):
            s = surface(a)
            if s < SURFACE_MIN:
                continue
            total += s
            contours.append(encoder(simplifier(a, TOLERANCE)))
        if not contours:
            ecartes += 1
            continue
        zones.append({"t": genre, "n": (tags.get("name") or tags.get("official_name") or "").strip(),
                      "s": int(round(total)), "g": contours})
    zones.sort(key=lambda z: -z["s"])
    kb = {
        "meta": {
            "construit": "2026-09-20",
            "source": "OpenStreetMap, surfaces amenity=school, college, kindergarten et childcare au Luxembourg, © les contributeurs d'OpenStreetMap, licence ODbL",
            "note": "Ces contours sont dessinés par des bénévoles : ils sont en général justes pour les écoles, plus inégaux pour les crèches, souvent saisies comme un simple point et donc absentes ici.",
        },
        "zones": zones,
    }
    with io.open(SORTIE, "w", encoding="utf-8", newline="\n") as f:
        f.write("window.EMPRISES=" + json.dumps(kb, ensure_ascii=False, separators=(",", ":")) + ";\n")
    ec = [z for z in zones if z["t"] == "ec"]
    print("emprises : %d ecoles et lycees, %d accueils, %d elements ecartes" % (len(ec), len(zones) - len(ec), ecartes))
    print("les dix plus grandes :")
    for z in zones[:10]:
        print("   %5.1f ha  %s" % (z["s"] / 10000.0, z["n"] or "(sans nom)"))
    print("ecrit %s (%.0f ko)" % (SORTIE, os.path.getsize(SORTIE) / 1024.0))


if __name__ == "__main__":
    main()
