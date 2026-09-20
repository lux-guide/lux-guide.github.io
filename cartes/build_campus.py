# -*- coding: utf-8 -*-
"""Les sites scolaires : ce qui se trouve au même endroit.

Écrit `cartes/campus_kb.js`, lu par l'onglet Communes pour dire, sous la note
d'une commune, ce qu'un site regroupe : plusieurs bâtiments scolaires, une
maison relais, un hall sportif, une piscine, un terrain.

Pourquoi ce script existe. Le fichier d'adresses du ministère inscrit une
école par commune scolaire, pas un bâtiment par ligne : Bertrange y figure une
seule fois, sous « École de Bertrange », alors que la commune a le campus
Atert, qui porte trois bâtiments d'école, une maison relais et le Centre Atert
avec son hall sportif, sa salle des fêtes et sa piscine d'apprentissage. Une
note qui dit « 1 école fondamentale » donne donc une idée fausse de ce qui est
sur place.

Ce que fait le script. Il part des points déjà géocodés de `ecoles_kb.js`,
les regroupe par proximité en sites, puis demande à OpenStreetMap ce qui se
trouve autour de chaque site : écoles, crèches, halls et terrains de sport,
piscines, bibliothèques, maisons de jeunes. Un site n'est retenu que s'il
groupe plusieurs choses, ou si son nom ou son adresse porte le mot campus.

Ce que le script ne fait pas. Il n'invente aucun équipement : ce qui n'est pas
cartographié dans OpenStreetMap n'apparaît pas, et la note le dit. Le Centre
Atert, par exemple, n'y est pas encore décrit comme hall sportif, et il est
donc absent de la liste, alors qu'il est bien sur le site.

Sources : ministère de l'Éducation nationale pour les établissements,
OpenStreetMap, licence ODbL, © les contributeurs, pour ce qui les entoure.

    python cartes/build_campus.py
"""

import io
import json
import math
import os
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request

ICI = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(ICI, "cache")
ECOLES = os.path.join(ICI, "ecoles_kb.js")
SORTIE = os.path.join(ICI, "campus_kb.js")
BRUT = os.path.join(CACHE, "osm_sites.json")

SERVEURS = ["https://overpass.kumi.systems/api/interpreter",
            "https://overpass-api.de/api/interpreter"]

REQUETE = """[out:json][timeout:240];
area["ISO3166-1"="LU"][admin_level=2]->.lu;
(
  nwr["amenity"~"^(school|kindergarten|childcare|library|community_centre|music_school|theatre)$"](area.lu);
  nwr["leisure"~"^(sports_centre|sports_hall|swimming_pool|pitch|playground|stadium|track)$"](area.lu);
);
out tags geom;"""

# Ce qu'on nomme, et comment on le nomme dans la note. Un terrain de sport et
# une aire de jeux ne sont pas des établissements : ils disent ce qu'il y a
# autour de l'école, et c'est ce qu'une famille regarde.
LIBELLES = [
    ("amenity", "school", "école"),
    ("amenity", "kindergarten", "crèche ou précoce"),
    ("amenity", "childcare", "structure d'accueil"),
    ("amenity", "library", "bibliothèque"),
    ("amenity", "community_centre", "centre culturel ou maison de jeunes"),
    ("amenity", "music_school", "école de musique"),
    ("amenity", "theatre", "salle de spectacle"),
    ("leisure", "sports_centre", "hall sportif"),
    ("leisure", "sports_hall", "hall sportif"),
    ("leisure", "swimming_pool", "piscine"),
    ("leisure", "stadium", "stade"),
    ("leisure", "track", "piste d'athlétisme"),
    ("leisure", "pitch", "terrain de sport"),
    ("leisure", "playground", "aire de jeux"),
]

COMMUNES = os.path.join(ICI, "communes_kb.js")

RAYON_SITE = 130.0      # mètres : deux bâtiments plus proches que cela font un site
RAYON_AUTOUR = 220.0    # mètres autour du site, pour ce qu'OpenStreetMap y décrit


def norm(x):
    x = unicodedata.normalize("NFD", (x or "").strip().lower())
    x = "".join(c for c in x if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", x).strip()


def distance(a, b):
    """Mètres entre deux points, approximation plane, suffisante à cette échelle."""
    dy = (a[0] - b[0]) * 111320.0
    dx = (a[1] - b[1]) * 111320.0 * math.cos(math.radians((a[0] + b[0]) / 2))
    return math.hypot(dx, dy)


def charger_kb(path, variable):
    s = io.open(path, encoding="utf-8").read()
    return json.loads(s[s.index("=") + 1:].rstrip().rstrip(";"))


def overpass():
    if os.path.exists(BRUT):
        return json.load(io.open(BRUT, encoding="utf-8"))
    if not os.path.isdir(CACHE):
        os.makedirs(CACHE)
    corps = urllib.parse.urlencode({"data": REQUETE}).encode()
    for url in SERVEURS:
        try:
            sys.stderr.write("overpass %s\n" % url.split("/")[2])
            req = urllib.request.Request(url, data=corps,
                                         headers={"User-Agent": "lux-guide build_campus"})
            with urllib.request.urlopen(req, timeout=600) as r:
                d = json.loads(r.read().decode("utf-8"))
            io.open(BRUT, "w", encoding="utf-8").write(json.dumps(d))
            return d
        except Exception as e:
            sys.stderr.write("  échec : %s\n" % e)
            time.sleep(4)
    raise SystemExit("OpenStreetMap indisponible, rien n'est écrit")


def surface(anneau):
    """Mètres carrés d'un anneau en degrés, projeté à plat sur place. À cette
    latitude et sur quelques centaines de mètres, l'écart au calcul géodésique
    se compte en pour mille, et une surface d'école s'annonce à l'are près."""
    if len(anneau) < 3:
        return 0.0
    lat0 = sum(p[0] for p in anneau) / len(anneau)
    k = math.cos(math.radians(lat0))
    aire = 0.0
    for i in range(len(anneau)):
        x1, y1 = anneau[i][1] * k, anneau[i][0]
        x2, y2 = anneau[(i + 1) % len(anneau)][1] * k, anneau[(i + 1) % len(anneau)][0]
        aire += x1 * y2 - x2 * y1
    return abs(aire) / 2.0 * (111320.0 ** 2)


def decode_polyline(s):
    """L'inverse de encode_polyline de build_cartes.py, pour relire les
    contours des quartiers déjà publiés plutôt que de les retélécharger."""
    pts, i, lat, lon = [], 0, 0, 0
    while i < len(s):
        for quoi in (0, 1):
            shift, result = 0, 0
            while True:
                b = ord(s[i]) - 63
                i += 1
                result |= (b & 0x1f) << shift
                shift += 5
                if b < 0x20:
                    break
            d = ~(result >> 1) if result & 1 else (result >> 1)
            if quoi == 0:
                lat += d
            else:
                lon += d
        pts.append((lat / 1e5, lon / 1e5))
    return pts


def dans_anneau(point, anneau):
    """Point dans polygone, par le nombre de traversées."""
    y, x = point
    dedans = False
    n = len(anneau)
    for i in range(n):
        y1, x1 = anneau[i]
        y2, x2 = anneau[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xx = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if x < xx:
                dedans = not dedans
    return dedans


def quartiers():
    """Les contours des quartiers de la capitale, lus dans communes_kb.js."""
    if not os.path.exists(COMMUNES):
        return []
    kb = charger_kb(COMMUNES, "COMMUNES")
    q = (kb.get("quartiers") or {}).get("zones") or []
    return [(z["nom"], [decode_polyline(g) for g in z.get("g", [])]) for z in q]


def libelle(tags):
    for cle, valeur, mot in LIBELLES:
        if tags.get(cle) == valeur:
            return mot
    return None


def rue(adresse):
    """« 4, Campus Atert, Bertrange » donne « campus atert bertrange ». La rue
    seule ne suffit pas : « rue de l'École » existe dans presque chaque
    village, et deux écoles de deux localités se retrouvaient sur le même
    site. La localité est donc collée à la rue."""
    parts = (adresse or "").split(",")
    return norm(parts[1] + " " + parts[-1]) if len(parts) > 2 else ""


def nom_campus(textes):
    """« 4, Campus Atert, Bertrange » donne « Campus Atert »."""
    for t in textes:
        m = re.search(r"((?:Schoul|Kanner)?\s*[Cc]ampus[^,\"]*)", t or "")
        if m:
            return re.sub(r"\s+", " ", m.group(1)).strip(" \"'")
    return None


def main():
    kb = charger_kb(ECOLES, "ECOLES")
    points = [p for p in kb.get("points", []) if p.get("c") and p.get("k")]
    if not points:
        raise SystemExit("ecoles_kb.js ne porte pas de points : lancer build_ecoles.py d'abord")

    # 1. Les établissements du ministère se groupent par proximité.
    par_commune = {}
    for p in points:
        par_commune.setdefault(p["k"], []).append(p)

    sites = []
    for lau, liste in par_commune.items():
        restants = list(liste)
        while restants:
            base = restants.pop(0)
            groupe = [base]
            bouge = True
            while bouge:
                bouge = False
                for p in list(restants):
                    proche = any(distance(p["c"], q["c"]) <= RAYON_SITE for q in groupe)
                    # Même rue et même localité : deux points mal géocodés de
                    # la même adresse se rejoignent, mais jamais deux bâtiments
                    # éloignés d'un demi-kilomètre, qui ne partagent pas une cour.
                    meme_rue = rue(p.get("a")) and any(
                        rue(p.get("a")) == rue(q.get("a")) and distance(p["c"], q["c"]) <= 500
                        for q in groupe)
                    if proche or meme_rue:
                        groupe.append(p)
                        restants.remove(p)
                        bouge = True
            lat = sum(p["c"][0] for p in groupe) / len(groupe)
            lon = sum(p["c"][1] for p in groupe) / len(groupe)
            sites.append({"k": lau, "c": [lat, lon], "pts": groupe})

    # 2. Ce qu'OpenStreetMap décrit autour de chaque site.
    els = overpass().get("elements", [])
    autour = []
    for e in els:
        t = e.get("tags") or {}
        mot = libelle(t)
        if not mot:
            continue
        geom = e.get("geometry") or []
        pts = [(g["lat"], g["lon"]) for g in geom if g.get("lat") is not None]
        if pts:
            lat = sum(p[0] for p in pts) / len(pts)
            lon = sum(p[1] for p in pts) / len(pts)
            aire = surface(pts)
        elif e.get("lat") is not None:
            lat, lon, aire = e["lat"], e["lon"], 0.0
        elif e.get("center"):
            lat, lon, aire = e["center"]["lat"], e["center"]["lon"], 0.0
        else:
            continue
        autour.append({"c": [lat, lon], "m": mot, "n": (t.get("name") or "").strip(),
                       "s": int(round(aire))})
    print("OpenStreetMap : %d équipements retenus" % len(autour))

    # Un index par case de mille mètres : comparer chaque site à chaque
    # équipement ferait deux millions de distances pour rien.
    grille = {}
    for a in autour:
        cle = (round(a["c"][0] * 100), round(a["c"][1] * 100))
        grille.setdefault(cle, []).append(a)

    def voisins(c):
        out = []
        cy, cx = round(c[0] * 100), round(c[1] * 100)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                out.extend(grille.get((cy + dy, cx + dx), []))
        return out

    # Dans la capitale, un site se rattache à son quartier : « Luxembourg »
    # ne dit rien à qui regarde Cessange ou Merl.
    qz = quartiers()
    print("quartiers de la capitale : %d contours" % len(qz))

    def quartier_de(c, zones_q):
        for nom, anneaux in zones_q:
            for a in anneaux:
                if dans_anneau(c, a):
                    return nom
        return ""

    par_lau = {}
    TYPES = {"ef": "école fondamentale", "ly": "lycée", "sea": "crèche ou maison relais"}
    for s in sites:
        textes = [p.get("a", "") for p in s["pts"]] + [p.get("n", "") for p in s["pts"]]
        campus = nom_campus(textes)
        equip, vus = [], set()
        for a in voisins(s["c"]):
            if distance(a["c"], s["c"]) > RAYON_AUTOUR:
                continue
            cle = (a["m"], norm(a["n"]))
            if cle in vus:
                continue
            vus.add(cle)
            equip.append({"m": a["m"], "n": a["n"], "s": a.get("s") or 0})
        # Un site vaut la peine d'être montré s'il groupe plusieurs choses ou
        # s'il porte un nom de campus. Une école seule dans son village, sans
        # rien autour de cartographié, n'apprend rien de plus que la note.
        if not campus and len(s["pts"]) < 2 and len(equip) < 2:
            continue
        ecoles_osm = sorted({e["n"] for e in equip if e["m"] == "école" and e["n"]})
        resume = {}
        for e in equip:
            resume[e["m"]] = resume.get(e["m"], 0) + 1
        # Deux surfaces, qui ne disent pas la même chose : le terrain de
        # l'école et de l'accueil d'un côté, ce qui sert au sport de l'autre.
        SCOLAIRE = ("école", "crèche ou précoce", "structure d'accueil")
        SPORT = ("terrain de sport", "stade", "piscine", "hall sportif", "piste d'athlétisme")
        m2_ecole = sum(e["s"] for e in equip if e["m"] in SCOLAIRE)
        m2_sport = sum(e["s"] for e in equip if e["m"] in SPORT)
        par_lau.setdefault(s["k"], []).append({
            "nom": campus or "",
            "c": [round(s["c"][0], 5), round(s["c"][1], 5)],
            "etabs": [{"n": p.get("n", ""), "t": TYPES.get(p.get("t"), p.get("t"))} for p in s["pts"]],
            "osm": ecoles_osm,
            "equip": sorted(resume.items(), key=lambda x: -x[1]),
            "m2": m2_ecole,
            "m2sport": m2_sport,
            "q": quartier_de(s["c"], qz),
        })

    for lau in par_lau:
        # Les sites nommés d'abord, puis les plus fournis.
        par_lau[lau].sort(key=lambda x: (0 if x["nom"] else 1, -len(x["etabs"]) - len(x["equip"])))

    out = {
        "meta": {
            "construit": time.strftime("%Y-%m-%d"),
            "rayon_site": int(RAYON_SITE),
            "rayon_autour": int(RAYON_AUTOUR),
            "sources": [
                "Ministère de l'Éducation nationale, adresses des bâtiments scolaires, data.public.lu",
                "OpenStreetMap, contributeurs, licence ODbL, pour les équipements autour des sites",
            ],
            "limite": ("Un équipement absent d'OpenStreetMap n'apparaît pas ici, et le ministère "
                       "n'inscrit qu'une école par commune scolaire : ces listes disent ce qui est "
                       "cartographié, pas tout ce qui existe."),
        },
        "communes": par_lau,
    }
    io.open(SORTIE, "w", encoding="utf-8", newline="\n").write(
        "window.CAMPUS=" + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
    nq = sum(1 for l in par_lau.values() for s in l if s.get("q"))
    print("sites rattachés à un quartier de la capitale : %d" % nq)
    nommes = sum(1 for l in par_lau.values() for s in l if s["nom"])
    print("sites retenus : %d dans %d communes, dont %d portent un nom de campus"
          % (sum(len(v) for v in par_lau.values()), len(par_lau), nommes))
    print("écrit %s (%.0f ko)" % (SORTIE, os.path.getsize(SORTIE) / 1024.0))


if __name__ == "__main__":
    main()
