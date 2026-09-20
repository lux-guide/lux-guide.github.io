# -*- coding: utf-8 -*-
"""Écoles, lycées et structures d'accueil, commune par commune.

Écrit `cartes/ecoles_kb.js`, lu par l'onglet Communes pour afficher une note
par commune : combien d'écoles fondamentales et où, quels lycées, quelle offre
internationale, combien de crèches et de maisons relais.

Pourquoi ce script existe. Les indicateurs chiffrés de `communes_kb.js` disent
combien d'élèves et combien de classes, ce qui ne répond pas à la question que
se pose quelqu'un qui cherche où habiter : y a-t-il une école ici, un campus,
un lycée, une école européenne gratuite. Ces faits ne sont pas des chiffres, ce
sont des noms d'établissements, et ils viennent d'une autre source.

Sources, toutes publiques :

1. Ministère de l'Éducation nationale, de l'Enfance et de la Jeunesse,
   « Adresses des bâtiments scolaires », publié sur data.public.lu. Trois
   fichiers : écoles fondamentales publiques, lycées, services d'éducation et
   d'accueil. Situation 2021, c'est la dernière version publiée.
2. Administration du cadastre et de la topographie, « Adresses géoréférencées
   (BD-Adresses) », pour rattacher chaque adresse à sa commune : les fichiers
   du ministère donnent une localité, pas une commune.
3. Pour l'offre internationale, les pages du ministère et de la Maison de
   l'orientation, recopiées ici dans OFFRE avec leur lien. Elles ne sont pas
   publiées en données ouvertes.

Rien n'est deviné : une adresse qui ne se rattache à aucune commune est
signalée en fin d'exécution, pas rangée au hasard.

Le script écrit aussi les points : chaque école, chaque lycée et chaque
structure d'accueil avec ses coordonnées, pour les poser sur la carte, et pour
chaque école la liste des structures d'accueil d'enfants scolarisés qui sont
sur le même site. Deux règles pour « le même site », et pas d'autre : la même
adresse écrite, ou deux bâtiments situés à 150 mètres ou moins. Une adresse
située seulement à la rue ne sert jamais à la seconde règle, le point serait
le milieu d'une rue qui peut faire trois kilomètres.

    python cartes/build_ecoles.py
"""

import collections
import csv
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
SORTIE = os.path.join(ICI, "ecoles_kb.js")

MENJE = {
    "ecoles": "https://download.data.public.lu/resources/adresses-des-batiments-scolaires-2021/20230328-230233/adr-ecoles-fondamentales-2021.xlsx",
    "lycees": "https://download.data.public.lu/resources/adresses-des-batiments-scolaires-2021/20230328-230256/adr-lycees-2021.xlsx",
    "sea": "https://download.data.public.lu/resources/adresses-des-batiments-scolaires-2021/20230328-230303/adr-sea-2021.xlsx",
}
ADRESSES = "https://download.data.public.lu/resources/adresses-georeferencees-bd-adresses/20260914-023121/addresses.csv"

# L'offre internationale, école par école. Les fichiers d'adresses ne la
# portent pas : elle est recopiée des pages officielles, vérifiées le
# 20 septembre 2026, et chaque ligne dit d'où elle vient.
#   t : ce que l'établissement propose, en une phrase.
#   g : gratuit (école publique) ou payant.
MENJE_OFFRE = "https://men.public.lu/fr/systeme-educatif/secondaire/offre-scolaire-organisation/offre-scolaire.html"
ORIENTATION = "https://maison-orientation.public.lu/fr/etudes/portes-ouvertes-des-lycees-luxembourg/lycees-offre-internationale-luxembourg.html"
EURSC = "https://www.eursc.eu/fr/European-Schools/locations"

OFFRE = {
    "Ecole Internationale de Differdange": {
        "t": "Baccalauréat européen, sections française, anglaise et allemande, du fondamental au secondaire", "g": True, "u": ORIENTATION},
    "Ecole internationale de Mondorf-les-Bains": {
        "t": "Baccalauréat européen, sections française, anglaise et allemande", "g": True, "u": ORIENTATION},
    "Lënster Lycée International School": {
        "t": "Baccalauréat européen, sections française, anglaise et allemande", "g": True, "u": ORIENTATION},
    "Lycée Edward Steichen": {
        "t": "École internationale Edward Steichen, baccalauréat européen, pour le nord du pays", "g": True, "u": ORIENTATION},
    "Ecole Internationale Mersch - Anne Beffort": {
        "t": "Baccalauréat européen, sections française, anglaise et allemande", "g": True, "u": ORIENTATION},
    "Lycée Michel Lucius": {
        "t": "International School Michel Lucius, programme britannique Cambridge, IGCSE puis A-levels", "g": True, "u": ORIENTATION},
    "Athénée de Luxembourg": {
        "t": "Baccalauréat international en anglais, à partir de la classe de 7e", "g": True, "u": ORIENTATION},
    "Lycée Technique du Centre": {
        "t": "Baccalauréat international en français", "g": True, "u": ORIENTATION},
    "Lycée Mathias Adam": {
        "t": "Baccalauréat international en français", "g": True, "u": ORIENTATION},
    "Lycée Technique Ettelbruck": {
        "t": "Baccalauréat international en français", "g": True, "u": ORIENTATION},
    "Schengen-Lyzeum Perl": {
        "t": "Lycée germano-luxembourgeois, programme des deux pays, situé à Perl en Allemagne", "g": True, "u": MENJE_OFFRE},
    "Lycée Ermesinde": {
        "t": "Journée continue et évaluation sans notes chiffrées, pédagogie alternative", "g": True, "u": MENJE_OFFRE},
    "Sportlycée": {
        "t": "Horaires aménagés pour les sportifs de haut niveau", "g": True, "u": MENJE_OFFRE},
    "Europaschoul 1": {
        "t": "École européenne Luxembourg I, Kirchberg, baccalauréat européen ; frais pour les familles hors institutions européennes", "g": False, "u": EURSC},
    "Europaschoul 2": {
        "t": "École européenne Luxembourg II, Mamer et Bertrange, baccalauréat européen ; frais pour les familles hors institutions européennes", "g": False, "u": EURSC},
    "International School Luxembourg": {
        "t": "École privée payante, baccalauréat international et programme américain", "g": False, "u": ORIENTATION},
    "St. Georges": {
        "t": "École privée payante, programme britannique", "g": False, "u": ORIENTATION},
    "Lycée Vauban": {
        "t": "Établissement français conventionné, programme et baccalauréat français", "g": False, "u": ORIENTATION},
    "Waldorfschoul": {
        "t": "Pédagogie Steiner-Waldorf, école privée", "g": False, "u": ORIENTATION},
}

# Écoles ouvertes après la publication des adresses de 2021, ajoutées à la
# main avec leur source. Sans cela, la note d'une commune serait fausse par
# omission, ce qui est pire qu'une note vieille de quelques années.
AJOUTS = [
    {"n": "École internationale Gaston Thorn", "loc": "Luxembourg-Cessange et Luxembourg-Merl",
     "cp": "2667", "type": "lycee", "depuis": 2022,
     "src": "https://www.eigt.lu/about-us/"},
]
OFFRE["École internationale Gaston Thorn"] = {
    "t": "Baccalauréat européen, sections française, anglaise et allemande, ouverte en 2022", "g": True, "u": ORIENTATION}


def norm(x):
    x = unicodedata.normalize("NFD", (x or "").strip().lower())
    x = "".join(c for c in x if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", x).strip()


def telecharger(url, nom):
    p = os.path.join(CACHE, nom)
    if not os.path.exists(p):
        if not os.path.isdir(CACHE):
            os.makedirs(CACHE)
        sys.stderr.write("telechargement %s\n" % nom)
        urllib.request.urlretrieve(url, p)
    return p


def annuaire():
    """Localité et code postal vers commune, d'après le cadastre, et les
    coordonnées de chaque adresse : par adresse écrite, et par rue pour
    retrouver le numéro voisin quand le numéro cherché manque au registre."""
    par_loc, par_cp, par_couple, par_adresse, par_rue = {}, {}, {}, {}, {}
    with io.open(telecharger(ADRESSES, "act_adresses.csv"), encoding="utf-8-sig", errors="replace") as f:
        for r in csv.DictReader(f, delimiter=";"):
            cle = (r["commune"], r["lau2"])
            par_loc.setdefault(norm(r["localite"]), collections.Counter())[cle] += 1
            par_cp.setdefault(r["code_postal"].strip(), collections.Counter())[cle] += 1
            par_couple.setdefault((r["code_postal"].strip(), norm(r["localite"])), collections.Counter())[cle] += 1
            try:
                pt = (round(float(r["lat_wgs84"]), 6), round(float(r["lon_wgs84"]), 6))
            except ValueError:
                continue
            par_adresse[(r["code_postal"].strip(), norm(r["rue"]), norm(r["numero"]))] = pt
            par_rue.setdefault(r["id_caclr_rue"].strip(), []).append((r["numero"].strip(), pt))
    return par_loc, par_cp, par_couple, par_adresse, par_rue


def commune_de(cp, localite, ann):
    """Le couple code postal et localité d'abord : 91 codes postaux sont à
    cheval sur deux communes, la localité les départage."""
    par_loc, par_cp, par_couple = ann[:3]
    cp = (cp or "").replace("L-", "").replace("D-", "").strip()
    loc = norm(localite)
    for source, cle in ((par_couple, (cp, loc)), (par_loc, loc), (par_cp, cp)):
        c = source.get(cle)
        if c:
            return c.most_common(1)[0][0]
    return None


def lignes_xlsx(nom, feuille):
    import openpyxl
    wb = openpyxl.load_workbook(telecharger(MENJE[nom], "menje_%s.xlsx" % nom), read_only=True)
    ws = wb[feuille if feuille in wb.sheetnames else wb.sheetnames[0]]
    return [r for r in ws.iter_rows(min_row=2, values_only=True) if r and r[0] is not None]


def cp_localite(adr):
    """« L-6315 Beaufort », « L- 9776 Wilwerwiltz » ou « L-7445 » : le code
    postal est partout écrit de la même manière à un espace près, la localité
    manque parfois."""
    adr = propre(adr)
    m = re.search(r"(\d{4,5})", adr)
    cp = m.group(1) if m else ""
    ville = propre(adr[m.end():] if m else adr)
    return cp, ville


def propre(x):
    return re.sub(r"\s+", " ", str(x or "").strip())


def titre_localite(x):
    x = propre(x)
    return "-".join(m.capitalize() if m.isupper() else m for m in x.split("-"))


# ---------- situer une adresse ----------
#
# Trois précisions, écrites dans chaque point pour que la carte le dise :
#   0  le bâtiment : l'adresse est dans le registre du cadastre ;
#   1  le numéro voisin : le numéro manque au registre, le point est estimé
#      entre les deux numéros du même côté qui l'encadrent, sinon posé au plus
#      proche. C'est le cas du campus de Mamer, 42 route d'Arlon ;
#   2  la rue : aucun numéro exploitable, le point est le milieu de la rue.
GEOCODEUR = "https://apiv3.geoportail.lu/geocode/search?"
GEO_CACHE = os.path.join(CACHE, "geocode_menje.json")
RAYON_SITE = 150


def charger_geo():
    if os.path.exists(GEO_CACHE):
        with io.open(GEO_CACHE, encoding="utf-8") as f:
            return json.load(f)
    return {}


def geocoder(adresse, geo):
    """Le géocodeur du Géoportail, pour les rues que le ministère écrit
    autrement que le cadastre. Chaque réponse est gardée en cache."""
    if adresse in geo:
        return geo[adresse]
    res = None
    for _ in range(3):
        try:
            url = GEOCODEUR + urllib.parse.urlencode({"queryString": adresse})
            with urllib.request.urlopen(url, timeout=30) as r:
                d = json.loads(r.read().decode("utf-8"))
            if d.get("results"):
                x = d["results"][0]
                lon, lat = x["geomlonlat"]["coordinates"]
                res = {"lat": round(lat, 6), "lon": round(lon, 6), "acc": x.get("accuracy") or 0,
                       "rue": str((x.get("AddressDetails") or {}).get("id_caclr_street") or "")}
            break
        except Exception:
            time.sleep(1.5)
    geo[adresse] = res
    time.sleep(0.1)
    return res


def situer(num, rue, cp, localite, ann, geo):
    """Rend (point, précision, numéro voisin utilisé)."""
    cp = re.sub(r"\D", "", cp or "")[:4]
    num = propre(num)
    if num:
        pt = ann[3].get((cp, norm(rue), norm(num)))
        if pt:
            return pt, 0, None
    g = geocoder("%s, %s, %s %s" % (num, propre(rue), cp, propre(localite)), geo)
    if not g:
        return None, None, None
    if g["acc"] >= 8:
        return (g["lat"], g["lon"]), 0, None
    m = re.match(r"\d+", num)
    if m and g["rue"]:
        n0 = int(m.group())
        # Les numéros de la rue, du même côté d'abord : les pairs et les
        # impairs se font face, et un campus n'est pas en face de son adresse.
        du_cote, en_face = [], []
        for numero, pt in ann[4].get(g["rue"], []):
            mm = re.match(r"\d+", numero)
            if mm:
                (du_cote if (int(mm.group()) - n0) % 2 == 0 else en_face).append((int(mm.group()), pt))
        avant = [x for x in du_cote if x[0] < n0 and n0 - x[0] <= 10]
        apres = [x for x in du_cote if x[0] > n0 and x[0] - n0 <= 10]
        if avant and apres:
            # Encadré par deux numéros du même côté : le point est entre les
            # deux, à proportion. Le 42 route d'Arlon à Mamer manque au
            # registre, le 40 et le 46 y sont.
            a, b = max(avant), min(apres)
            t = (n0 - a[0]) / float(b[0] - a[0])
            pt = (round(a[1][0] + t * (b[1][0] - a[1][0]), 6), round(a[1][1] + t * (b[1][1] - a[1][1]), 6))
            return pt, 1, "entre les n° %d et %d" % (a[0], b[0])
        proches = sorted(du_cote, key=lambda x: abs(x[0] - n0))
        if proches and abs(proches[0][0] - n0) <= 6:
            return proches[0][1], 1, "au n° %d" % proches[0][0]
        proches = sorted(en_face, key=lambda x: abs(x[0] - n0))
        if proches and abs(proches[0][0] - n0) <= 3:
            return proches[0][1], 1, "au n° %d, en face" % proches[0][0]
    return (g["lat"], g["lon"]), 2, None


def casse_rue(x):
    """« ROUTE D'ARLON » devient « Route d'Arlon » : le fichier des écoles
    écrit les rues en capitales, et title() met une majuscule après
    l'apostrophe et aux articles."""
    x = propre(x)
    if not x.isupper():
        return x
    x = x.title()
    x = re.sub(r"\b([DL])'", lambda m: m.group(1).lower() + "'", x)
    x = re.sub(r"(?<=.)\b(De|Du|Des|La|Le|Les|Et|Aux?|En|Sur)\b", lambda m: m.group(1).lower(), x)
    return x


def metres(a, b):
    la = math.radians((a[0] + b[0]) / 2)
    return math.hypot((a[1] - b[1]) * 111320 * math.cos(la), (a[0] - b[0]) * 110540)


def numero_rue(adr):
    """« 57, route de Dillingen » : le numéro, puis la rue."""
    adr = propre(adr)
    m = re.match(r"^([0-9][0-9a-zA-Z\-/ ]*?)\s*,\s*(.+)$", adr)
    return (m.group(1), m.group(2)) if m else ("", adr)


def main():
    ann = annuaire()
    geo = charger_geo()
    points = []
    perdus = []

    def point(t, nom, num, rue, cp, ville, lau, **plus):
        pt, prec, voisin = situer(num, rue, cp, ville, ann, geo)
        if not pt:
            perdus.append(("point " + t, nom, cp, ville))
            return
        d = {"t": t, "n": nom, "a": propre("%s, %s, %s" % (num, propre(rue), ville)).strip(", "),
             "c": [pt[0], pt[1]], "p": prec, "k": lau,
             "_cle": (re.sub(r"\D", "", cp or "")[:4], norm(rue), norm(num))}
        if voisin:
            d["v"] = voisin
        d.update(plus)
        points.append(d)

    par_commune = collections.defaultdict(lambda: {"ef": [], "ly": [], "sea": {"tot": 0, "conv": 0, "nc": 0, "je": 0, "es": 0}})

    for r in lignes_xlsx("ecoles", "FINAL"):
        nom, cp, ville = propre(r[1]), propre(r[2]), titre_localite(r[3])
        c = commune_de(cp, ville, ann)
        if not c:
            perdus.append(("ecole", nom, cp, ville))
            continue
        par_commune[c[1]]["ef"].append({"n": nom, "l": ville})
        point("ef", nom, propre(r[5]), casse_rue(r[4]), cp, ville, c[1])

    for r in lignes_xlsx("lycees", "Sheet1"):
        nom, adr = propre(r[0]), propre(r[1])
        cp, ville = cp_localite(adr)
        c = commune_de(cp, ville, ann)
        if not c:
            # Le Schengen-Lyzeum est en Allemagne : il n'a pas de commune
            # luxembourgeoise, et il est rangé avec sa voisine Schengen.
            if "Perl" in ville:
                c = commune_de("", "Schengen", ann)
            if not c:
                perdus.append(("lycee", nom, cp, ville))
                continue
        par_commune[c[1]]["ly"].append({"n": nom, "l": ville})
        if "Perl" not in ville:
            num, rue = numero_rue(r[2])
            point("ly", nom, num, rue, cp, ville, c[1])

    for r in lignes_xlsx("sea", "Sheet1"):
        cp, ville = cp_localite(r[2])
        c = commune_de(cp, ville, ann)
        if not c:
            perdus.append(("sea", propre(r[0]), cp, ville))
            continue
        s = par_commune[c[1]]["sea"]
        s["tot"] += 1
        s["conv"] += 1 if propre(r[3]) else 0
        s["nc"] += 1 if propre(r[4]) else 0
        s["je"] += 1 if propre(r[5]) else 0
        s["es"] += 1 if propre(r[6]) else 0
        num, rue = numero_rue(r[1])
        point("sea", propre(r[0]), num, rue, cp, ville, c[1], cv=1 if propre(r[3]) else 0,
              je=1 if propre(r[5]) else 0, es=1 if propre(r[6]) else 0)

    for a in AJOUTS:
        c = commune_de(a["cp"], a["loc"].split(" et ")[0], ann)
        if not c:
            perdus.append(("ajout", a["n"], a["cp"], a["loc"]))
            continue
        par_commune[c[1]]["ly"].append({"n": a["n"], "l": a["loc"], "depuis": a["depuis"], "src": a["src"]})

    # L'offre internationale se colle à l'établissement qui la porte.
    cles = {norm(k): v for k, v in OFFRE.items()}
    n_offre = 0
    for d in par_commune.values():
        for ly in d["ly"]:
            o = cles.get(norm(ly["n"]))
            if o:
                ly["o"] = o["t"]
                ly["g"] = o["g"]
                ly["u"] = o["u"]
                n_offre += 1
        d["ef"].sort(key=lambda x: (x["l"], x["n"]))
        d["ly"].sort(key=lambda x: x["n"])
        d["campus"] = [e["n"] for e in d["ef"] if "campus" in norm(e["n"])]

    # Le même site : la même adresse écrite, ou deux bâtiments à 150 m ou moins.
    accueils = [q for q in points if q["t"] == "sea" and q.get("es")]
    n_sites = 0
    for e in points:
        if e["t"] != "ef":
            continue
        ens = []
        for q in accueils:
            if e["_cle"][2] and e["_cle"] == q["_cle"]:
                ens.append(q["n"])
            elif e["p"] == 0 and q["p"] == 0 and metres(e["c"], q["c"]) <= RAYON_SITE:
                ens.append(q["n"])
        if ens:
            e["mr"] = sorted(set(ens))
            n_sites += 1
    for q in points:
        del q["_cle"]
    with io.open(GEO_CACHE, "w", encoding="utf-8") as f:
        json.dump(geo, f, ensure_ascii=False)

    kb = {
        "meta": {
            "construit": "2026-09-20",
            "sources": [
                "Ministère de l'Éducation nationale, de l'Enfance et de la Jeunesse, adresses des bâtiments scolaires 2021, data.public.lu",
                "Administration du cadastre et de la topographie, adresses géoréférencées, data.public.lu, pour le rattachement à la commune",
                "Ministère de l'Éducation nationale et Maison de l'orientation, offre scolaire internationale, pages consultées le 20 septembre 2026",
            ],
            "vintage": "Adresses arrêtées en 2021, dernière version publiée par le ministère. Les écoles ouvertes depuis sont ajoutées une à une, avec leur source.",
            "liens": {"menje": MENJE_OFFRE, "orientation": ORIENTATION},
            "points": "Chaque établissement est posé à son adresse, d'après le registre des adresses du cadastre. "
                      "Quand le numéro manque au registre, le point est au numéro le plus proche dans la même rue, "
                      "et la carte le dit. Une école et une structure d'accueil sont dites sur le même site quand "
                      "elles ont la même adresse, ou quand leurs deux bâtiments sont à %d mètres ou moins." % RAYON_SITE,
        },
        "communes": dict(par_commune),
        "points": points,
    }
    js = "window.ECOLES=" + json.dumps(kb, ensure_ascii=False, separators=(",", ":")) + ";\n"
    with io.open(SORTIE, "w", encoding="utf-8", newline="\n") as f:
        f.write(js)

    n_ef = sum(len(d["ef"]) for d in par_commune.values())
    n_ly = sum(len(d["ly"]) for d in par_commune.values())
    n_sea = sum(d["sea"]["tot"] for d in par_commune.values())
    print("communes : %d | ecoles fondamentales : %d | lycees : %d | accueil : %d | offre internationale : %d"
          % (len(par_commune), n_ef, n_ly, n_sea, n_offre))
    prec = collections.Counter(q["p"] for q in points)
    print("points : %d | au batiment %d, au numero voisin %d, a la rue %d" % (
        len(points), prec[0], prec[1], prec[2]))
    print("ecoles avec un accueil d'enfants scolarises sur le meme site : %d sur %d" % (
        n_sites, sum(1 for q in points if q["t"] == "ef")))
    print("campus : %s" % ", ".join(sorted(n for d in par_commune.values() for n in d["campus"])))
    print("ecrit %s (%.0f ko)" % (SORTIE, os.path.getsize(SORTIE) / 1024.0))
    if perdus:
        print("\nadresses non rattachees (%d), a regarder :" % len(perdus))
        for p in perdus[:20]:
            print("   ", p)


if __name__ == "__main__":
    main()
