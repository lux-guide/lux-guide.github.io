# -*- coding: utf-8 -*-
"""
Construit cartes/communes_kb.js : la géométrie des 100 communes et une série
d'indicateurs par commune, pour les cartes thématiques du guide.

Usage :
    python build_cartes.py            télécharge tout et reconstruit
    python build_cartes.py --cache    réutilise les fichiers déjà dans cache/

Règle de ce script : une source téléchargée est une source publiée. Tout ce
qu'un flux porte et qui a un sens pour quelqu'un qui s'installe est repris,
plutôt qu'un exemple choisi. Un flux annuel donne en plus sa série complète,
pour que la carte puisse se dérouler année par année.

Sources, toutes en licence CC0 ou domaine public sur data.public.lu :
 1. Limites administratives du Grand-Duché (ACT), limadmin.geojson, 100 communes.
 2. STATEC, API SDMX lustat.statec.lu :
    DF_X021 population (1821-2026), DF_X020 densité (1821-2026),
    DF_X024 naissances et décès (1987-), DF_X025 arrivées et départs (1990-),
    DF_X026 emploi et chômage (2001-), DF_C1600 salaires (2013-),
    DF_X046 élèves et classes de l'enseignement fondamental (2010-),
    DSD_CENSUS_GROUP7_10@DF_B1625 nationalités, DSD_CENSUS_GROUP1_3@DF_B1607 âges,
    DSD_CENSUS_MENAGE_PV@DF_B1703 ménages, DSD_CENSUS_NB_LOG_CLA@DF_B1707 logements
    (recensement 2021), DSD_SILC_2@DF_C1102 inégalités de revenu (pays entier).
 3. Observatoire de l'Habitat, prix et loyers annoncés par commune et par quartier.
 4. Registre national des personnes physiques, ressortissants par nationalité et
    par commune, dernier trimestre publié.

Sortie : window.COMMUNES = { meta, indicateurs, groupes, series, communes,
quartiers, nations, national }. Chaque commune porte son nom, son canton, son
code LAU2, sa géométrie simplifiée (polyline encodée par anneau), un
dictionnaire d'indicateurs et un dictionnaire de séries annuelles.
"""
import csv, io, json, math, os, re, sys, urllib.request, datetime, collections

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")

GEOJSON = "https://download.data.public.lu/resources/limites-administratives-du-grand-duche-de-luxembourg/20260905-030016/limadmin.geojson"
PRIX_APPT = "https://download.data.public.lu/resources/prix-annonces-des-logements-par-commune/20260625-080844/vente-appartement-2025-26.xls"
PRIX_MAISON = "https://download.data.public.lu/resources/prix-annonces-des-logements-par-commune/20260625-080909/vente-maison-2025-2026.xls"
LOYER_APPT = "https://download.data.public.lu/resources/loyers-annonces-des-logements-par-commune/20260625-081047/location-appartement-2025-26.xls"
LOYER_MAISON = "https://download.data.public.lu/resources/loyers-annonces-des-logements-par-commune/20260625-081113/location-maison-2025-26.xls"
# Niveau plus fin : les 24 quartiers de la Ville de Luxembourg.
VDL_GEOJSON = "https://maps.vdl.lu/arcgis/rest/services/OPENDATA/GEOJSON/FeatureServer/24/query?where=1%3D1&outFields=*&outSR=4326&f=geojson"
VDL_VENTE_APPT = "https://download.data.public.lu/resources/prix-annonces-des-logements-a-luxembourg-ville-par-quartier/20260625-081238/vdl-vente-appartements-2025-26.xlsx"
VDL_VENTE_MAISON = "https://download.data.public.lu/resources/prix-annonces-des-logements-a-luxembourg-ville-par-quartier/20260625-081258/vdl-vente-maisons-2025-26.xlsx"
VDL_LOYER_APPT = "https://download.data.public.lu/resources/loyers-annonces-des-logements-a-luxembourg-ville-par-quartier/20260625-081413/vdl-location-appartements-2025-26.xlsx"
VDL_LOYER_MAISON = "https://download.data.public.lu/resources/loyers-annonces-des-logements-a-luxembourg-ville-par-quartier/20260625-081432/vdl-location-maisons-2025-26.xlsx"
SDMX = "https://lustat.statec.lu/rest/data/%s/all?format=csvfilewithlabels"
# Registre national, ressortissants par nationalité et par commune. Le jeu est
# republié chaque trimestre sous une nouvelle adresse : on demande à l'API du
# portail la ressource CSV la plus récente plutôt que de figer un lien.
RNPP_DATASET = "https://data.public.lu/api/1/datasets/589822cf111e9b303d3b0fc0/"
# Table ISO3 vers ISO2, pour les drapeaux. Le registre ne donne que l'ISO3.
NATIONS_ISO = os.path.join(HERE, "nations_iso.json")

USE_CACHE = "--cache" in sys.argv


def telecharger(url, nom):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, nom)
    if USE_CACHE and os.path.exists(p):
        return p
    print("  télécharge", nom)
    req = urllib.request.Request(url, headers={"User-Agent": "lux_guide build_cartes"})
    with urllib.request.urlopen(req) as r, open(p, "wb") as f:
        f.write(r.read())
    return p


def sdmx(flow, nom):
    return telecharger(SDMX % urllib.parse.quote(flow, safe=""), nom)


import urllib.parse

# ---------- appariement des noms de communes ----------

def cle(s):
    s = (s or "").strip().lower()
    s = s.replace("œ", "oe")
    s = "".join(c for c in __import__("unicodedata").normalize("NFD", s)
                if __import__("unicodedata").category(c) != "Mn")
    for a, b in ((" sur ", " "), ("-", " "), ("'", " "), ("/", " "), (".", " ")):
        s = s.replace(a, b)
    s = " ".join(s.split())
    # variantes connues d'une source à l'autre
    alias = {
        "luxembourg ville": "luxembourg",
        "redange": "redange attert",
        "redange sur attert": "redange attert",
        "esch alzette": "esch sur alzette",
        "esch sure": "esch sur sure",
        "la ville de luxembourg": "luxembourg",
        "differdange ville": "differdange",
        "clervaux commune": "clervaux",
        "rosport mompach": "rosport mompach",
        "kaerjeng": "kaerjeng",
        "haute sure": "lac de la haute sure",
    }
    return alias.get(s, s)


# ---------- géométrie ----------

def encode_polyline(pts):
    out, plat, plon = [], 0, 0
    for lat, lon in pts:
        for v, pv in ((lat, plat), (lon, plon)):
            d = int(round(v * 1e5)) - int(round(pv * 1e5))
            d = ~(d << 1) if d < 0 else d << 1
            while d >= 0x20:
                out.append(chr((0x20 | (d & 0x1f)) + 63))
                d >>= 5
            out.append(chr(d + 63))
        plat, plon = lat, lon
    return "".join(out)


def simplifier(ring, tol):
    """Douglas-Peucker sur un anneau [(lat, lon), ...], tolérance en degrés."""
    if len(ring) < 4:
        return ring
    keep = {0, len(ring) - 1}
    stack = [(0, len(ring) - 1)]
    def dist(p, a, b):
        ax, ay, bx, by, px, py = a[1], a[0], b[1], b[0], p[1], p[0]
        dx, dy = bx - ax, by - ay
        if dx == 0 and dy == 0:
            return math.hypot(px - ax, py - ay)
        t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
        return math.hypot(px - (ax + t * dx), py - (ay + t * dy))
    while stack:
        a, b = stack.pop()
        if b - a < 2:
            continue
        dm, im = -1, -1
        for i in range(a + 1, b):
            d = dist(ring[i], ring[a], ring[b])
            if d > dm:
                dm, im = d, i
        if dm > tol:
            keep.add(im)
            stack.append((a, im))
            stack.append((im, b))
    return [ring[i] for i in sorted(keep)]


def anneaux(geom, tol):
    """MultiPolygon ou Polygon -> liste d'anneaux extérieurs simplifiés, en (lat, lon)."""
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    out = []
    for poly in polys:
        ring = [(p[1], p[0]) for p in poly[0]]
        r = simplifier(ring, tol)
        if len(r) >= 4:
            out.append(r)
    return out


def centroide(rings):
    """Centroïde pondéré par l'aire des anneaux, pour poser l'étiquette."""
    sx = sy = sa = 0.0
    for r in rings:
        a = cx = cy = 0.0
        for i in range(len(r) - 1):
            x1, y1 = r[i][1], r[i][0]
            x2, y2 = r[i + 1][1], r[i + 1][0]
            f = x1 * y2 - x2 * y1
            a += f
            cx += (x1 + x2) * f
            cy += (y1 + y2) * f
        if a == 0:
            continue
        a *= 0.5
        sx += cx / 6.0
        sy += cy / 6.0
        sa += a
    if sa == 0:
        r = rings[0]
        return [sum(p[0] for p in r) / len(r), sum(p[1] for p in r) / len(r)]
    return [round(sy / sa, 5), round(sx / sa, 5)]


# ---------- lecture des sources STATEC ----------

def lire_csv(path):
    return list(csv.DictReader(io.open(path, encoding="utf-8")))


def derniere_annee(rows, filtre=None):
    ans = {int(r["TIME_PERIOD"]) for r in rows if r["TIME_PERIOD"].isdigit()
           and r.get("OBS_VALUE") not in (None, "")
           and (filtre is None or filtre(r))}
    return max(ans) if ans else None


def par_commune(rows, nom_col, an, filtre=None):
    out = {}
    for r in rows:
        if r["TIME_PERIOD"] != str(an):
            continue
        if filtre and not filtre(r):
            continue
        v = r.get("OBS_VALUE")
        if v in (None, ""):
            continue
        out[cle(r[nom_col])] = float(v)
    return out


def age_median(a):
    """Âge médian à partir des tranches quinquennales du recensement.

    Interpolation linéaire dans la tranche qui contient la moitié des
    habitants. C'est une approximation, la tranche vaut cinq ans : elle est
    annoncée comme telle dans l'aide de l'indicateur.
    """
    tranches = [("Y_LT5", 0, 5), ("Y5T9", 5, 5), ("Y10T14", 10, 5), ("Y15T19", 15, 5),
                ("Y20T24", 20, 5), ("Y25T29", 25, 5), ("Y30T34", 30, 5), ("Y35T39", 35, 5),
                ("Y40T44", 40, 5), ("Y45T49", 45, 5), ("Y50T54", 50, 5), ("Y55T59", 55, 5),
                ("Y60T64", 60, 5), ("Y65T69", 65, 5), ("Y70T74", 70, 5), ("Y75T79", 75, 5),
                ("Y80T84", 80, 5), ("Y85T89", 85, 5), ("Y90T94", 90, 5), ("Y95T99", 95, 5),
                ("Y_GE100", 100, 5)]
    tot = sum(a.get(c, 0) for c, _, _ in tranches)
    if not tot:
        return None
    cible, cum = tot / 2.0, 0.0
    for code, bas, large in tranches:
        n = a.get(code, 0)
        if cum + n >= cible and n:
            return bas + large * (cible - cum) / n
        cum += n
    return None


def taille_menage(m):
    """Nombre moyen de personnes par ménage, par les milieux de tranche.

    Les deux dernières tranches sont ouvertes (6 à 10, 11 et plus) : leur
    milieu est pris à 8 et à 12, ce qui pèse peu, elles font moins de 2 % des
    ménages.
    """
    poids = [("1", 1), ("2", 2), ("3", 3), ("4", 4), ("5", 5), ("6-10", 8), ("GE11", 12)]
    n = sum(m.get(c, 0) for c, _ in poids)
    if not n:
        return None
    return sum(m.get(c, 0) * v for c, v in poids) / n


def construire_nations(pop_pays):
    """Ressortissants par nationalité et par commune, registre national.

    Le portail republie ce jeu chaque trimestre sous une nouvelle adresse : on
    demande à son API la ressource CSV la plus récente. Rend la liste des
    nationalités du pays, le détail par commune, et la date de situation.
    """
    import json as _json
    req = urllib.request.Request(RNPP_DATASET, headers={"User-Agent": "lux_guide build_cartes"})
    with urllib.request.urlopen(req, timeout=120) as r:
        meta = _json.loads(r.read().decode("utf-8"))
    csvs = [x for x in meta["resources"] if x["format"] == "csv"]
    if not csvs:
        raise SystemExit("registre national : aucune ressource CSV")
    dernier = max(csvs, key=lambda x: x.get("created_at") or "")
    p = telecharger(dernier["url"], "rnpp.csv")
    # La date de situation est dans le nom du fichier, en tête : 01-07-2026.
    m = re.match(r"(\d{1,2})[- ](\d{1,2})[- ](\d{4})", dernier["title"])
    situation = "%s/%s/%s" % (m.group(1).zfill(2), m.group(2).zfill(2), m.group(3)) if m else ""

    iso2 = _json.load(io.open(NATIONS_ISO, encoding="utf-8"))
    par_commune_nat, totaux, noms = collections.defaultdict(dict), collections.Counter(), {}
    # Le registre publie en Windows-1252 selon les trimestres, en UTF-8 selon
    # d'autres : on essaie l'un puis l'autre plutôt que de figer le mauvais.
    try:
        io.open(p, encoding="utf-8-sig").read()
        enc = "utf-8-sig"
    except UnicodeDecodeError:
        enc = "cp1252"
    for r in csv.DictReader(io.open(p, encoding=enc)):
        code = (r.get("NATIONALITE_ISO3") or "").strip()
        val = (r.get("NOMBRE_TOTAL") or "").strip()
        if not code or not val.isdigit():
            continue
        n = int(val)
        k = cle(r["COMMUNE_NOM"])
        par_commune_nat[k][code] = par_commune_nat[k].get(code, 0) + n
        totaux[code] += n
        nom = (r.get("NATIONALITE_NOM") or "").strip()
        if nom and code not in noms:
            noms[code] = nom[:1].upper() + nom[1:]

    nations = []
    for code, t in totaux.most_common():
        a2 = iso2.get(code, "")
        drapeau = "".join(chr(0x1F1E6 + ord(c) - 97) for c in a2) if len(a2) == 2 else ""
        nations.append({"c": code, "n": noms.get(code, code), "a2": a2, "f": drapeau, "t": t})

    total = sum(totaux.values())
    ecart = round(100.0 * (total / pop_pays - 1)) if pop_pays else None
    aide = ("Comptages du registre national, une nationalité à la fois. Le registre compte "
            "environ %d %% de personnes de plus que la population officielle du STATEC, parce "
            "que les départs sont déclarés tard et que les radiations suivent. Les effectifs "
            "sont donc à lire comme des ordres de grandeur, et la part comme le poids d'une "
            "nationalité dans une commune par rapport aux autres communes, pas comme un "
            "pourcentage officiel." % ecart)
    print("   %d nationalités, %s personnes inscrites, %+d %% par rapport au STATEC"
          % (len(nations), format(total, ",").replace(",", " "), ecart))
    return nations, par_commune_nat, situation, aide


def serie_par_commune(rows, nom_col, filtre=None, entier=True):
    """Toutes les années d'un flux, et non la dernière seulement.

    Rend ({cle commune: {année: valeur}}, [années triées]). Une carte qui se
    déroule dans le temps a besoin de la série entière, et l'échelle de
    couleurs doit se calculer sur la période complète : sinon les couleurs
    changent de sens d'une année à l'autre et l'animation ment.
    """
    out, annees = collections.defaultdict(dict), set()
    for r in rows:
        an = r.get("TIME_PERIOD", "")
        if not an.isdigit():
            continue
        if filtre and not filtre(r):
            continue
        v = r.get("OBS_VALUE")
        if v in (None, ""):
            continue
        an = int(an)
        annees.add(an)
        out[cle(r[nom_col])][an] = round(float(v)) if entier else float(v)
    return out, sorted(annees)


def somme(rows, nom_col, filtre):
    """Additionne les observations qui passent le filtre, par commune."""
    out = collections.Counter()
    for r in rows:
        if not filtre(r):
            continue
        v = r.get("OBS_VALUE")
        if v in (None, ""):
            continue
        out[cle(r[nom_col])] += float(v)
    return out


def part(num, den, k):
    """Part en % de num sur den pour la commune k, ou None si le compte manque."""
    d = den.get(k)
    if not d:
        return None
    return 100.0 * num.get(k, 0) / d


def lire_prix(path):
    import pandas as pd
    x = pd.ExcelFile(path)
    d = pd.read_excel(path, sheet_name=x.sheet_names[0], header=None)
    # trouver la ligne d'en-tête : celle dont une cellule vaut "Commune"
    hdr, ic = None, None
    for i in range(len(d)):
        for j, v in enumerate(d.iloc[i]):
            if str(v).strip() in ("Commune", "Quartier"):
                hdr, ic = i, j
                break
        if hdr is not None:
            break
    if hdr is None:
        return {}, {}, x.sheet_names[0]
    cols = [str(v).strip() for v in d.iloc[hdr]]
    def col(mot):
        for j, c in enumerate(cols):
            if mot in c.lower():
                return j
        return None
    im2 = col("au m")
    itot = None
    for j, c in enumerate(cols):
        cl = c.lower()
        if ("prix moyen" in cl or "loyer moyen" in cl) and "au m" not in cl:
            itot = j
            break
    prix_m2, prix_tot = {}, {}
    for i in range(hdr + 1, len(d)):
        nom = d.iloc[i, ic]
        if not isinstance(nom, str) or not nom.strip():
            continue
        k = cle(nom)
        for src, dst in ((im2, prix_m2), (itot, prix_tot)):
            if src is None:
                continue
            v = d.iloc[i, src]
            try:
                f = float(v)
                if f > 0:
                    dst[k] = f
            except (TypeError, ValueError):
                pass
    return prix_m2, prix_tot, x.sheet_names[0]


# ---------- programme ----------

def construire_quartiers():
    """Les 24 quartiers de la Ville de Luxembourg : géométrie de la VDL, prix et
    loyers annoncés de l'Observatoire de l'Habitat. Les deux sources ne découpent
    pas la ville pareil : la VDL sépare Bonnevoie-Nord et Bonnevoie-Sud là où
    l'Observatoire publie un seul Bonnevoie, et de même pour Belair. Un quartier
    sans correspondance reste sans chiffre plutôt que d'hériter d'un voisin."""
    g = json.load(io.open(telecharger(VDL_GEOJSON, "vdl_quartiers.geojson"), encoding="utf-8"))
    feats = g.get("features") or []
    if not feats:
        print("   géométrie des quartiers indisponible, couche ignorée")
        return None

    va_m2, va_tot, f_va = lire_prix(telecharger(VDL_VENTE_APPT, "vdl_vente_appt.xlsx"))
    vm_m2, vm_tot, f_vm = lire_prix(telecharger(VDL_VENTE_MAISON, "vdl_vente_maison.xlsx"))
    la_m2, la_tot, f_la = lire_prix(telecharger(VDL_LOYER_APPT, "vdl_loyer_appt.xlsx"))
    lm_m2, lm_tot, f_lm = lire_prix(telecharger(VDL_LOYER_MAISON, "vdl_loyer_maison.xlsx"))

    # Les quartiers composés de la VDL retrouvent le libellé de l'Observatoire.
    RACCORDS = {
        "bonnevoie nord verlorenkost": "bonnevoie",
        "bonnevoie sud": "bonnevoie",
        "rollingergrund belair nord": "rollingergrund",
        "neudorf weimershof": "neudorf",
    }

    TOL = 20 / 111000.0
    zones = []
    for f in feats:
        nom = (f["properties"].get("FK_QUART_NAME") or "").strip()
        if not nom:
            continue
        k = cle(nom)
        k = RACCORDS.get(k, k)
        rings = anneaux(f["geometry"], TOL)
        if not rings:
            continue
        ind = {}
        for champ, src, arr in (("prix_appt", va_tot, 0), ("prix_appt_m2", va_m2, 0),
                                ("prix_maison", vm_tot, 0), ("prix_maison_m2", vm_m2, 0),
                                ("loyer_appt", la_tot, 0), ("loyer_appt_m2", la_m2, 1),
                                ("loyer_maison", lm_tot, 0)):
            v = src.get(k)
            if v is not None:
                ind[champ] = round(v, arr)
        zones.append({"nom": nom, "canton": "Luxembourg", "lau": "",
                      "c": centroide(rings),
                      "g": [encode_polyline(r) for r in rings],
                      "i": ind})
    zones.sort(key=lambda z: z["nom"])

    AIDE_M2 = ("Les deux colonnes de la source sont moyennées séparément : le prix au m² "
               "n'est pas le prix total divisé par une surface moyenne, et les petits "
               "logements le tirent vers le haut.")
    INDS = [
        {"id": "loyer_appt", "nom": "Loyer d'un appartement", "unite": "€/mois", "sens": -1,
         "fmt": "eur", "source": "Observatoire de l'Habitat, " + f_la,
         "aide": "Loyers demandés dans les annonces, hors charges."},
        {"id": "prix_appt_m2", "nom": "Prix d'un appartement au m²", "unite": "€/m²", "sens": -1,
         "fmt": "eur", "source": "Observatoire de l'Habitat, " + f_va, "aide": AIDE_M2},
        {"id": "prix_appt", "nom": "Prix d'un appartement, total", "unite": "€", "sens": -1,
         "fmt": "eur", "source": "Observatoire de l'Habitat, " + f_va, "aide": ""},
        {"id": "loyer_appt_m2", "nom": "Loyer d'un appartement au m²", "unite": "€/m² par mois",
         "sens": -1, "fmt": "dec", "source": "Observatoire de l'Habitat, " + f_la, "aide": AIDE_M2},
        {"id": "prix_maison_m2", "nom": "Prix d'une maison au m²", "unite": "€/m²", "sens": -1,
         "fmt": "eur", "source": "Observatoire de l'Habitat, " + f_vm, "aide": AIDE_M2},
        {"id": "prix_maison", "nom": "Prix d'une maison, total", "unite": "€", "sens": -1,
         "fmt": "eur", "source": "Observatoire de l'Habitat, " + f_vm, "aide": ""},
    ]
    return {
        "titre": "Luxembourg-Ville, par quartier",
        "note": ("La Ville de Luxembourg pèse à elle seule 137 000 habitants, plus que les "
                 "quinze communes suivantes réunies : la traiter comme une seule zone masque "
                 "l'essentiel. Ce niveau ne couvre que le logement, aucune statistique de "
                 "revenu ou de population n'est publiée par quartier."),
        "source_geo": "Ville de Luxembourg, quartiers, data.public.lu, CC BY",
        "indicateurs": INDS,
        "zones": zones,
    }


def main():
    print("1. limites administratives")
    g = json.load(io.open(telecharger(GEOJSON, "limadmin.geojson"), encoding="utf-8"))
    feats = g["communes"]["features"]
    print("  ", len(feats), "communes")

    print("2. STATEC")
    pop_rows = lire_csv(sdmx("DF_X021", "x021.csv"))
    dens_rows = lire_csv(sdmx("DF_X020", "x020.csv"))
    sal_rows = lire_csv(sdmx("DF_C1600", "c1600.csv"))
    emp_rows = lire_csv(sdmx("DF_X026", "x026.csv"))
    nat_rows = lire_csv(sdmx("DSD_CENSUS_GROUP7_10@DF_B1625", "b1625.csv"))
    nais_rows = lire_csv(sdmx("DF_X024", "x024.csv"))
    mig_rows = lire_csv(sdmx("DF_X025", "x025.csv"))
    eco_rows = lire_csv(sdmx("DF_X046", "x046.csv"))
    age_rows = lire_csv(sdmx("DSD_CENSUS_GROUP1_3@DF_B1607", "b1607.csv"))
    men_rows = lire_csv(sdmx("DSD_CENSUS_MENAGE_PV@DF_B1703", "b1703.csv"))
    log_rows = lire_csv(sdmx("DSD_CENSUS_NB_LOG_CLA@DF_B1707", "b1707.csv"))
    ineg_rows = lire_csv(sdmx("DSD_SILC_2@DF_C1102", "c1102.csv"))

    # Un flux mélange trois niveaux sous la même étiquette : le canton de
    # Luxembourg et la commune de Luxembourg s'appellent tous les deux
    # « Luxembourg ». Le niveau ne se lit donc jamais sur le nom, toujours sur
    # la longueur du code, sinon une commune reçoit les chiffres de son canton.
    com_canton = lambda r: len(r["CANTON"]) == 4          # noqa: E731
    com_spec = lambda r: len(r["SPECIFICATION"]) == 7     # noqa: E731
    com_geo = lambda r: len(r["GEO"]) == 9                # noqa: E731

    # Séries annuelles : chaque flux qui a une dimension temps la donne en
    # entier. La dernière valeur de la série sert d'indicateur du jour, ce qui
    # évite de lire deux fois le même fichier avec deux résultats possibles.
    S = {}
    S["pop"] = serie_par_commune(pop_rows, "Canton", com_canton)
    S["dens"] = serie_par_commune(dens_rows, "Canton", com_canton)
    S["naissances"] = serie_par_commune(nais_rows, "Canton", lambda r: r["VARIABLE"] == "A01" and com_canton(r))
    S["deces"] = serie_par_commune(nais_rows, "Canton", lambda r: r["VARIABLE"] == "A02" and com_canton(r))
    S["arrivees"] = serie_par_commune(mig_rows, "Canton", lambda r: r["POP_MOVEMENT"] == "M001" and com_canton(r))
    S["departs"] = serie_par_commune(mig_rows, "Canton", lambda r: r["POP_MOVEMENT"] == "M002" and com_canton(r))
    S["chomage"] = serie_par_commune(emp_rows, "Specification",
                                     lambda r: r["VARIABLE"] == "C6" and com_spec(r), entier=False)
    S["emploi"] = serie_par_commune(emp_rows, "Specification",
                                    lambda r: r["VARIABLE"] == "C1" and com_spec(r))
    S["sal_med"] = serie_par_commune(sal_rows, "Municipality", lambda r: r["INDICATOR"] == "M030")
    S["sal_ratio"] = serie_par_commune(sal_rows, "Municipality",
                                       lambda r: r["INDICATOR"] == "M050", entier=False)
    S["eleves"] = serie_par_commune(eco_rows, "School",
                                    lambda r: r["SPECIFICATION"] == "E01" and r["CYCLE"] == "C04")
    S["classes"] = serie_par_commune(eco_rows, "School",
                                     lambda r: r["SPECIFICATION"] == "E02" and r["CYCLE"] == "C04")

    ANS = {k: (v[1][-1] if v[1] else None) for k, v in S.items()}
    for k in sorted(S):
        print("   %-11s %4d valeurs, %s a %s" % (k, len(S[k][0]), S[k][1][0], S[k][1][-1]))

    def der(nom, k):
        """Dernière valeur connue de la série, pour la commune k."""
        return S[nom][0].get(k, {}).get(ANS[nom])

    an_pop, an_dens, an_emp = ANS["pop"], ANS["dens"], ANS["chomage"]
    an_sal = ANS["sal_med"]
    an_nais, an_mig, an_eco = ANS["naissances"], ANS["arrivees"], ANS["eleves"]

    pop = par_commune(pop_rows, "Canton", an_pop, com_canton)
    pop10 = par_commune(pop_rows, "Canton", an_pop - 10, com_canton)
    dens = par_commune(dens_rows, "Canton", an_dens, com_canton)
    sal = {k: par_commune(sal_rows, "Municipality", an_sal, lambda r, i=k: r["INDICATOR"] == i)
           for k in ("M010", "M020", "M030", "M040", "M050", "M060", "M070")}
    def emp(var):
        return par_commune(emp_rows, "Specification", an_emp,
                           lambda r: r["VARIABLE"] == var and com_spec(r))

    chom, emploi = emp("C6"), emp("C1")
    salaries, independants = emp("C2"), emp("C3")
    chomeurs, actifs = emp("C4"), emp("C5")

    # Recensement 2021 : âges, ménages, logements. Ces trois flux ne connaissent
    # qu'une année, ils ne peuvent pas se dérouler dans le temps.
    ages = collections.defaultdict(dict)
    for r in age_rows:
        if r["SEX"] != "_T" or r.get("OBS_VALUE") in (None, "") or not com_geo(r):
            continue
        ages[cle(r["Geographic level"])][r["AGE"]] = float(r["OBS_VALUE"])

    menages = collections.defaultdict(dict)
    for r in men_rows:
        if r.get("OBS_VALUE") in (None, "") or not com_geo(r):
            continue
        menages[cle(r["Geographic level"])][r["SIZE_PRV_HH"]] = float(r["OBS_VALUE"])

    logements = collections.defaultdict(dict)
    for r in log_rows:
        if r.get("OBS_VALUE") in (None, "") or not com_geo(r):
            continue
        logements[cle(r["Geographic level"])][(r["OCC_STATUS_CONV"], r["TYPE_BUILD_DWE"])] = float(r["OBS_VALUE"])

    nat = collections.defaultdict(dict)
    for r in nat_rows:
        if r["SEX"] != "_T" or r.get("OBS_VALUE") in (None, "") or not com_geo(r):
            continue
        nat[cle(r["Geographic level"])][r["CITIZEN"]] = float(r["OBS_VALUE"])

    # Inégalités de revenu : le STATEC ne les publie qu'au niveau du pays, par
    # l'enquête SILC. Un Gini par commune n'existe pas, et il ne se déduit pas
    # de quatre points de la distribution des salaires. La carte garde donc le
    # rapport interdécile, et le Gini du pays sert de repère daté.
    national = {"annees": [], "gini": [], "s80_s20": [], "s90_s10": []}
    codes = {"GINI": "gini", "S80_S20": "s80_s20", "S90_S10": "s90_s10"}
    par_an = collections.defaultdict(dict)
    for r in ineg_rows:
        if r["MEASURE"] in codes and r.get("OBS_VALUE") not in (None, ""):
            par_an[int(r["TIME_PERIOD"])][codes[r["MEASURE"]]] = float(r["OBS_VALUE"])
    for a in sorted(par_an):
        national["annees"].append(a)
        for c in ("gini", "s80_s20", "s90_s10"):
            national[c].append(par_an[a].get(c))
    print("   inégalités du pays :", national["annees"][0], "à", national["annees"][-1])

    print("3. prix et loyers des logements")
    appt_m2, appt_tot, feuille_a = lire_prix(telecharger(PRIX_APPT, "appt.xls"))
    mais_m2, mais_tot, feuille_m = lire_prix(telecharger(PRIX_MAISON, "maison.xls"))
    loya_m2, loya_tot, feuille_la = lire_prix(telecharger(LOYER_APPT, "loyer_appt.xls"))
    loym_m2, loym_tot, feuille_lm = lire_prix(telecharger(LOYER_MAISON, "loyer_maison.xls"))
    print("   vente appartements :", len(appt_m2), "communes |", feuille_a)
    print("   vente maisons      :", len(mais_m2), "communes |", feuille_m)
    print("   loyer appartements :", len(loya_m2), "communes |", feuille_la)
    print("   loyer maisons      :", len(loym_m2), "communes |", feuille_lm)

    print("4. registre national, nationalités par commune")
    pop_pays = sum(v for k, v in pop.items())
    nations, nat_commune, nat_situation, nat_aide = construire_nations(pop_pays)

    print("5. assemblage")
    TOL = 60 / 111000.0  # 60 m
    communes, manquants = [], collections.Counter()
    for f in feats:
        p = f["properties"]
        nom = p["COMMUNE"]
        k = cle(nom)
        rings = anneaux(f["geometry"], TOL)
        ind = {}

        def pose(champ, val, arrondi=None):
            if val is None:
                manquants[champ] += 1
                return
            ind[champ] = round(val, arrondi) if arrondi is not None else val

        pose("pop", pop.get(k), 0)
        if pop.get(k) and pop10.get(k):
            pose("pop_evol", (pop[k] / pop10[k] - 1) * 100, 1)
        else:
            manquants["pop_evol"] += 1
        pose("dens", dens.get(k), 0)
        pose("sal_moy", sal["M010"].get(k), 0)
        pose("sal_med", sal["M030"].get(k), 0)
        pose("sal_p10", sal["M020"].get(k), 0)
        pose("sal_p90", sal["M040"].get(k), 0)
        pose("sal_ratio", sal["M050"].get(k), 2)
        pose("chomage", chom.get(k), 2)
        pose("emploi", emploi.get(k), 0)
        # Fusions de communes de 2023 : le recensement de 2021 connaît encore les
        # anciennes communes, on additionne leurs effectifs.
        FUSIONS = {"groussbus wal": ["grosbous", "wahl"],
                   "bous waldbredimus": ["bous", "waldbredimus"]}
        n = nat.get(k)
        if not n and k in FUSIONS:
            n = collections.Counter()
            for part in FUSIONS[k]:
                for cit, v in (nat.get(part) or {}).items():
                    n[cit] += v
        if n and n.get("_T"):
            t = n["_T"]
            pose("pct_lux", 100.0 * n.get("NAT", 0) / t, 1)
            pose("pct_eu", 100.0 * n.get("EU_FOR", 0) / t, 1)
            pose("pct_noneu", 100.0 * n.get("NEU", 0) / t, 1)
            pose("pct_etr", 100.0 * n.get("FOR", 0) / t, 1)
        else:
            for c in ("pct_lux", "pct_eu", "pct_noneu", "pct_etr"):
                manquants[c] += 1
        pose("prix_appt_m2", appt_m2.get(k), 0)
        pose("prix_appt", appt_tot.get(k), 0)
        pose("prix_maison_m2", mais_m2.get(k), 0)
        pose("prix_maison", mais_tot.get(k), 0)
        pose("loyer_appt", loya_tot.get(k), 0)
        pose("loyer_appt_m2", loya_m2.get(k), 1)
        pose("loyer_maison", loym_tot.get(k), 0)
        pose("loyer_maison_m2", loym_m2.get(k), 1)
        rn = nat_commune.get(k)
        pose("nat_tot", sum(rn.values()) if rn else None, 0)

        def taux(num, den, mult):
            return None if (num is None or not den) else mult * num / den

        # Qui arrive, qui part. Les effectifs bruts disent la taille de la
        # commune autant que son mouvement : les taux les accompagnent.
        hab = pop.get(k)
        nais, dec = der("naissances", k), der("deces", k)
        arr, dep = der("arrivees", k), der("departs", k)
        pose("naissances", nais, 0)
        pose("deces", dec, 0)
        pose("arrivees", arr, 0)
        pose("departs", dep, 0)
        pose("solde_mig", None if (arr is None or dep is None) else arr - dep, 0)
        pose("solde_naturel", None if (nais is None or dec is None) else nais - dec, 0)
        pose("natalite", taux(nais, hab, 1000.0), 1)
        pose("renouvellement",
             None if (arr is None or dep is None) else taux(arr + dep, hab, 100.0), 1)

        pose("salaries", salaries.get(k), 0)
        pose("independants", independants.get(k), 0)
        pose("chomeurs", chomeurs.get(k), 0)
        pose("actifs", actifs.get(k), 0)
        pose("part_independants", taux(independants.get(k), emploi.get(k), 100.0), 1)
        pose("sal_p50_p10", sal["M060"].get(k), 2)
        pose("sal_p90_p50", sal["M070"].get(k), 2)

        el, cl = der("eleves", k), der("classes", k)
        pose("eleves", el, 0)
        pose("classes", cl, 0)
        pose("eleves_classe", None if (el is None or not cl) else el / cl, 1)
        pose("eleves_pour_100", taux(el, hab, 100.0), 1)

        a = ages.get(k) or {}
        tot_a = a.get("_T")
        pose("age_median", age_median(a), 1)
        pose("part_moins15", taux(a.get("Y_LT15"), tot_a, 100.0), 1)
        pose("part_65plus",
             None if tot_a is None else taux(a.get("Y65T84", 0) + a.get("Y_GE85", 0), tot_a, 100.0), 1)

        mn = menages.get(k) or {}
        pose("menages", mn.get("_T"), 0)
        pose("taille_menage", taille_menage(mn), 2)
        pose("part_menage_1p", taux(mn.get("1"), mn.get("_T"), 100.0), 1)

        lg = logements.get(k) or {}
        pose("logements", lg.get(("_T", "_T")), 0)
        pose("part_vacants", taux(lg.get(("DW_NOC", "_T")), lg.get(("_T", "_T")), 100.0), 1)
        pose("part_maisons", taux(lg.get(("_T", "RES1")), lg.get(("_T", "RES")), 100.0), 1)

        # Séries annuelles, alignées sur les années déclarées dans meta.series.
        ser = {}
        for id_serie, (vals, annees) in S.items():
            v = vals.get(k)
            if not v:
                continue
            ser[id_serie] = [v.get(y) for y in annees]

        communes.append({
            "nom": nom, "canton": p.get("CANTON", ""), "lau": p.get("LAU2", ""),
            "c": centroide(rings),
            "g": [encode_polyline(r) for r in rings],
            "i": ind,
            "s": ser,
            "n": nat_commune.get(k, {}),
        })

    if manquants:
        print("   valeurs absentes :", dict(manquants))

    AIDE_M2 = ("Attention à ce chiffre : les deux colonnes de la source sont moyennées "
               "séparément, si bien que le loyer au m² n'est pas le loyer total divisé par "
               "une surface moyenne. Les petits logements, chers au m², le tirent vers le "
               "haut. Pour comparer des communes, le loyer total est plus sûr.")
    INDICATEURS = [
        {"id": "loyer_appt", "nom": "Loyer d'un appartement", "unite": "€/mois", "sens": -1,
         "fmt": "eur", "source": "Observatoire de l'Habitat, loyers annoncés " + feuille_la,
         "aide": "Loyers demandés dans les annonces, hors charges. C'est le chiffre qui compte "
                 "d'abord quand on arrive : presque personne n'achète la première année."},
        {"id": "loyer_appt_m2", "nom": "Loyer d'un appartement au m²", "unite": "€/m² par mois", "sens": -1,
         "fmt": "dec", "source": "Observatoire de l'Habitat, " + feuille_la, "aide": AIDE_M2},
        {"id": "prix_appt_m2", "nom": "Prix d'un appartement au m²", "unite": "€/m²", "sens": -1,
         "fmt": "eur", "source": "Observatoire de l'Habitat, prix annoncés " + feuille_a,
         "aide": "Prix annoncés dans les offres de vente, pas des prix de transaction. Les communes sans chiffre ont trop peu d'offres pour publier une moyenne."},
        {"id": "prix_maison_m2", "nom": "Prix d'une maison au m²", "unite": "€/m²", "sens": -1,
         "fmt": "eur", "source": "Observatoire de l'Habitat, prix annoncés " + feuille_m,
         "aide": "Même réserve : ce sont les prix demandés, pas les prix signés."},
        {"id": "prix_appt", "nom": "Prix d'un appartement, total", "unite": "€", "sens": -1,
         "fmt": "eur", "source": "Observatoire de l'Habitat, " + feuille_a,
         "aide": "Le prix total dépend autant de la taille des biens proposés que du niveau du marché."},
        {"id": "prix_maison", "nom": "Prix d'une maison, total", "unite": "€", "sens": -1,
         "fmt": "eur", "source": "Observatoire de l'Habitat, " + feuille_m, "aide": ""},
        {"id": "sal_med", "nom": "Salaire mensuel médian", "unite": "€/mois", "sens": 1,
         "fmt": "eur", "source": "STATEC DF_C1600, %d" % an_sal,
         "aide": "Salaire des résidents qui travaillent, avant impôt. La moitié des salariés de la commune gagne moins."},
        {"id": "sal_p10", "nom": "Salaire du premier décile", "unite": "€/mois", "sens": 1,
         "fmt": "eur", "source": "STATEC DF_C1600, %d" % an_sal,
         "aide": "Un salarié sur dix gagne moins que ce montant."},
        {"id": "sal_p90", "nom": "Salaire du neuvième décile", "unite": "€/mois", "sens": 1,
         "fmt": "eur", "source": "STATEC DF_C1600, %d" % an_sal,
         "aide": "Un salarié sur dix gagne plus que ce montant."},
        {"id": "sal_ratio", "nom": "Écart de salaire, neuvième décile sur premier", "unite": "×", "sens": -1,
         "fmt": "dec", "source": "STATEC DF_C1600, %d" % an_sal,
         "aide": "Mesure la dispersion des salaires dans la commune. 3 signifie que le haut gagne trois fois le bas."},
        {"id": "sal_moy", "nom": "Salaire mensuel moyen", "unite": "€/mois", "sens": 1,
         "fmt": "eur", "source": "STATEC DF_C1600, %d" % an_sal,
         "aide": "Toujours au dessus de la médiane, tiré par les hauts salaires."},
        {"id": "pop", "nom": "Population", "unite": "habitants", "sens": 0,
         "fmt": "ent", "source": "STATEC DF_X021, 1er janvier %d" % an_pop, "aide": ""},
        {"id": "pop_evol", "nom": "Croissance de la population sur dix ans", "unite": "%", "sens": 0,
         "fmt": "pct", "source": "STATEC DF_X021, %d comparé à %d" % (an_pop, an_pop - 10),
         "aide": "Une croissance forte signale des constructions récentes, et souvent des écoles et des crèches sous tension."},
        {"id": "dens", "nom": "Densité de population", "unite": "hab/km²", "sens": 0,
         "fmt": "ent", "source": "STATEC DF_X020, 1er janvier %d" % an_dens,
         "aide": "Faible densité veut dire village et voiture, forte densité veut dire ville et transports."},
        {"id": "pct_lux", "nom": "Part de résidents luxembourgeois", "unite": "%", "sens": 0,
         "fmt": "pct", "source": "STATEC, recensement 2021",
         "aide": "Recensement décennal : le chiffre date de 2021 et la population a changé depuis."},
        {"id": "pct_etr", "nom": "Part de résidents étrangers", "unite": "%", "sens": 0,
         "fmt": "pct", "source": "STATEC, recensement 2021", "aide": ""},
        {"id": "pct_eu", "nom": "Part de résidents d'un autre pays de l'Union", "unite": "%", "sens": 0,
         "fmt": "pct", "source": "STATEC, recensement 2021", "aide": ""},
        {"id": "pct_noneu", "nom": "Part de résidents hors Union européenne", "unite": "%", "sens": 0,
         "fmt": "pct", "source": "STATEC, recensement 2021", "aide": ""},
        {"id": "chomage", "nom": "Taux de chômage", "unite": "%", "sens": -1,
         "fmt": "pct", "source": "STATEC DF_X026, %d" % an_emp,
         "aide": "STATEC recommande la prudence : les administrations rattachent les personnes par code postal, et certains codes couvrent plusieurs communes."},
        {"id": "emploi", "nom": "Résidents ayant un emploi", "unite": "personnes", "sens": 0,
         "fmt": "ent", "source": "STATEC DF_X026, %d" % an_emp, "aide": ""},
        {"id": "actifs", "nom": "Population active", "unite": "personnes", "sens": 0,
         "fmt": "ent", "source": "STATEC DF_X026, %d" % an_emp,
         "aide": "Les résidents qui travaillent ou cherchent du travail. Le reste de la population est en études, à la retraite, ou au foyer."},
        {"id": "salaries", "nom": "Résidents salariés", "unite": "personnes", "sens": 0,
         "fmt": "ent", "source": "STATEC DF_X026, %d" % an_emp, "aide": ""},
        {"id": "independants", "nom": "Résidents indépendants", "unite": "personnes", "sens": 0,
         "fmt": "ent", "source": "STATEC DF_X026, %d" % an_emp, "aide": ""},
        {"id": "part_independants", "nom": "Part d'indépendants parmi ceux qui travaillent",
         "unite": "%", "sens": 0, "fmt": "pct", "source": "STATEC DF_X026, %d" % an_emp,
         "aide": "Élevée dans les communes viticoles et agricoles, basse autour de la capitale et du bassin sidérurgique."},
        {"id": "chomeurs", "nom": "Résidents au chômage", "unite": "personnes", "sens": -1,
         "fmt": "ent", "source": "STATEC DF_X026, %d" % an_emp, "aide": ""},
        {"id": "sal_p50_p10", "nom": "Écart de salaire, médiane sur premier décile", "unite": "×",
         "sens": -1, "fmt": "dec", "source": "STATEC DF_C1600, %d" % an_sal,
         "aide": "Mesure le bas de la distribution : combien de fois le salaire médian vaut celui des dix pour cent les moins payés."},
        {"id": "sal_p90_p50", "nom": "Écart de salaire, neuvième décile sur médiane", "unite": "×",
         "sens": -1, "fmt": "dec", "source": "STATEC DF_C1600, %d" % an_sal,
         "aide": "Mesure le haut de la distribution. Comparé au précédent, il dit de quel côté l'écart se creuse dans la commune."},

        {"id": "arrivees", "nom": "Arrivées dans l'année", "unite": "personnes", "sens": 0,
         "fmt": "ent", "source": "STATEC DF_X025, %d" % an_mig,
         "aide": "Emménagements déclarés à la commune, depuis l'étranger comme depuis une autre commune du pays."},
        {"id": "departs", "nom": "Départs dans l'année", "unite": "personnes", "sens": 0,
         "fmt": "ent", "source": "STATEC DF_X025, %d" % an_mig, "aide": ""},
        {"id": "solde_mig", "nom": "Solde migratoire", "unite": "personnes", "sens": 0,
         "fmt": "ent", "source": "STATEC DF_X025, %d" % an_mig,
         "aide": "Arrivées moins départs. Un solde négatif ne veut pas dire que la commune se vide : elle peut gagner des habitants par les naissances."},
        {"id": "renouvellement", "nom": "Renouvellement de la population", "unite": "% des habitants",
         "sens": 0, "fmt": "pct", "source": "STATEC DF_X025 et DF_X021, %d" % an_mig,
         "aide": "Arrivées et départs additionnés, rapportés à la population. C'est le chiffre qui dit si l'on s'installe parmi des gens installés depuis longtemps, ou dans un lieu de passage."},
        {"id": "naissances", "nom": "Naissances dans l'année", "unite": "enfants", "sens": 0,
         "fmt": "ent", "source": "STATEC DF_X024, %d" % an_nais, "aide": ""},
        {"id": "deces", "nom": "Décès dans l'année", "unite": "personnes", "sens": 0,
         "fmt": "ent", "source": "STATEC DF_X024, %d" % an_nais, "aide": ""},
        {"id": "solde_naturel", "nom": "Solde naturel", "unite": "personnes", "sens": 0,
         "fmt": "ent", "source": "STATEC DF_X024, %d" % an_nais,
         "aide": "Naissances moins décès. Négatif dans les communes âgées, très positif dans les communes de jeunes familles."},
        {"id": "natalite", "nom": "Taux de natalité", "unite": "naissances pour 1 000 habitants",
         "sens": 0, "fmt": "dec", "source": "STATEC DF_X024 et DF_X021, %d" % an_nais,
         "aide": "Comparable d'une commune à l'autre, contrairement au nombre de naissances qui suit d'abord la taille de la commune."},

        {"id": "age_median", "nom": "Âge médian", "unite": "ans", "sens": 0, "fmt": "dec",
         "source": "STATEC, recensement 2021",
         "aide": "La moitié des habitants est plus jeune. Calculé par interpolation dans les tranches de cinq ans du recensement : l'ordre de grandeur est juste, la décimale est indicative."},
        {"id": "part_moins15", "nom": "Part des moins de 15 ans", "unite": "%", "sens": 0,
         "fmt": "pct", "source": "STATEC, recensement 2021",
         "aide": "Un bon indice de la pression sur les écoles et les crèches, mais il date de 2021."},
        {"id": "part_65plus", "nom": "Part des 65 ans et plus", "unite": "%", "sens": 0,
         "fmt": "pct", "source": "STATEC, recensement 2021", "aide": ""},

        {"id": "eleves", "nom": "Élèves de l'enseignement fondamental", "unite": "élèves", "sens": 0,
         "fmt": "ent", "source": "STATEC DF_X046, rentrée %d" % an_eco,
         "aide": "Les communes qui se sont regroupées en syndicat scolaire ne déclarent pas séparément : elles n'ont pas de chiffre ici."},
        {"id": "classes", "nom": "Classes de l'enseignement fondamental", "unite": "classes",
         "sens": 0, "fmt": "ent", "source": "STATEC DF_X046, rentrée %d" % an_eco, "aide": ""},
        {"id": "eleves_classe", "nom": "Élèves par classe", "unite": "élèves", "sens": -1,
         "fmt": "dec", "source": "STATEC DF_X046, rentrée %d" % an_eco,
         "aide": "Moyenne sur les quatre cycles du fondamental. Elle ne dit rien de la classe où votre enfant sera placé, seulement du niveau de charge de la commune."},
        {"id": "eleves_pour_100", "nom": "Élèves pour 100 habitants", "unite": "%", "sens": 0,
         "fmt": "pct", "source": "STATEC DF_X046 et DF_X021, rentrée %d" % an_eco, "aide": ""},

        {"id": "menages", "nom": "Ménages privés", "unite": "ménages", "sens": 0, "fmt": "ent",
         "source": "STATEC, recensement 2021", "aide": ""},
        {"id": "taille_menage", "nom": "Personnes par ménage", "unite": "personnes", "sens": 0,
         "fmt": "dec", "source": "STATEC, recensement 2021",
         "aide": "Moyenne calculée sur les tranches de taille du recensement, les deux dernières étant ouvertes. Une commune de familles tourne autour de 2,8, une commune de studios autour de 1,8."},
        {"id": "part_menage_1p", "nom": "Part des ménages d'une personne", "unite": "%", "sens": 0,
         "fmt": "pct", "source": "STATEC, recensement 2021",
         "aide": "Élevée là où le parc est fait de petits logements, ce qui se voit aussi dans le loyer au m²."},
        {"id": "logements", "nom": "Logements", "unite": "logements", "sens": 0, "fmt": "ent",
         "source": "STATEC, recensement 2021", "aide": ""},
        {"id": "part_maisons", "nom": "Part de maisons individuelles", "unite": "% des logements",
         "sens": 0, "fmt": "pct", "source": "STATEC, recensement 2021",
         "aide": "Le reste est en immeubles collectifs. C'est ce qui décide de ce que vous trouverez à louer sur place."},
        {"id": "part_vacants", "nom": "Part de logements inoccupés", "unite": "%", "sens": 0,
         "fmt": "pct", "source": "STATEC, recensement 2021",
         "aide": "Un logement inoccupé au moment du recensement : résidence secondaire, logement en travaux, bien en attente de vente. Ce n'est pas une mesure de la vacance longue."},
        {"id": "loyer_maison", "nom": "Loyer d'une maison", "unite": "€/mois", "sens": -1,
         "fmt": "eur", "source": "Observatoire de l'Habitat, loyers annoncés " + feuille_lm,
         "aide": "Peu d'annonces dans beaucoup de communes : là où le chiffre manque, le marché locatif de maisons est trop mince pour être publié."},
        {"id": "loyer_maison_m2", "nom": "Loyer d'une maison au m²", "unite": "€/m² par mois",
         "sens": -1, "fmt": "dec", "source": "Observatoire de l'Habitat, " + feuille_lm,
         "aide": AIDE_M2},
    ]

    # Les groupes de boutons de l'onglet. Ils vivent ici et non dans le code de
    # l'interface : ajouter un indicateur au script suffit pour qu'il apparaisse.
    GROUPES = [
        ["Louer", ["loyer_appt", "loyer_appt_m2", "loyer_maison", "loyer_maison_m2"]],
        ["Acheter", ["prix_appt_m2", "prix_maison_m2", "prix_appt", "prix_maison"]],
        ["Salaires", ["sal_med", "sal_moy", "sal_p10", "sal_p90"]],
        ["Écarts de salaire", ["sal_ratio", "sal_p50_p10", "sal_p90_p50"]],
        ["Population", ["pop", "pop_evol", "dens", "age_median", "part_moins15", "part_65plus"]],
        ["Qui arrive, qui part", ["renouvellement", "arrivees", "departs", "solde_mig",
                                  "natalite", "naissances", "deces", "solde_naturel"]],
        ["Nationalités", ["pct_etr", "pct_lux", "pct_eu", "pct_noneu"]],
        ["Emploi", ["chomage", "emploi", "actifs", "salaries", "independants",
                    "part_independants", "chomeurs"]],
        ["Écoles", ["eleves_classe", "eleves", "classes", "eleves_pour_100"]],
        ["Ménages et logements", ["taille_menage", "part_menage_1p", "menages",
                                  "part_maisons", "part_vacants", "logements"]],
    ]

    # Séries annuelles publiées, avec l'axe du temps de chacune. La carte s'en
    # sert pour dérouler les années ; l'indicateur du même nom porte, lui, la
    # dernière valeur connue.
    SERIES = {
        "pop": {"nom": "Population", "annees": S["pop"][1]},
        "dens": {"nom": "Densité de population", "annees": S["dens"][1]},
        "naissances": {"nom": "Naissances", "annees": S["naissances"][1]},
        "deces": {"nom": "Décès", "annees": S["deces"][1]},
        "arrivees": {"nom": "Arrivées", "annees": S["arrivees"][1]},
        "departs": {"nom": "Départs", "annees": S["departs"][1]},
        "chomage": {"nom": "Taux de chômage", "annees": S["chomage"][1]},
        "emploi": {"nom": "Résidents ayant un emploi", "annees": S["emploi"][1]},
        "sal_med": {"nom": "Salaire médian", "annees": S["sal_med"][1]},
        "sal_ratio": {"nom": "Écart de salaire D9/D1", "annees": S["sal_ratio"][1]},
        "eleves": {"nom": "Élèves du fondamental", "annees": S["eleves"][1]},
        "classes": {"nom": "Classes du fondamental", "annees": S["classes"][1]},
    }

    # Un indicateur chiffré dans quatre communes ne fait pas une carte : six
    # classes de couleur sur quatre valeurs ne veulent rien dire. En dessous de
    # vingt communes, la donnée existe mais elle n'est pas publiée, et le
    # script le dit pour que la décision reste visible.
    SEUIL = 20
    couverture = {i["id"]: sum(1 for c in communes if i["id"] in c["i"]) for i in INDICATEURS}
    maigres = [i["id"] for i in INDICATEURS if couverture[i["id"]] < SEUIL]
    if maigres:
        for i in maigres:
            print("   écarté, %d communes seulement : %s" % (couverture[i], i))
        INDICATEURS = [i for i in INDICATEURS if i["id"] not in maigres]
        GROUPES = [[t, [x for x in l if x not in maigres]] for t, l in GROUPES]
        GROUPES = [g for g in GROUPES if g[1]]
        for c in communes:
            for i in maigres:
                c["i"].pop(i, None)

    print("6. quartiers de la Ville de Luxembourg")
    quartiers = construire_quartiers()

    out = {
        "meta": {
            "construit": datetime.date.today().isoformat(),
            "n": len(communes),
            "sources": [
                "Limites administratives, Administration du cadastre et de la topographie, data.public.lu, CC0",
                "STATEC, lustat.statec.lu, API SDMX",
                "Observatoire de l'Habitat, prix et loyers annoncés des logements par commune, data.public.lu, CC0",
                "Registre national des personnes physiques, nationalité par commune, data.public.lu, CC0",
            ],
        },
        "indicateurs": INDICATEURS,
        "groupes": GROUPES,
        "series": SERIES,
        "communes": communes,
        "quartiers": quartiers,
        "nations": nations,
        "nat_source": "Registre national des personnes physiques, situation au " + nat_situation,
        "nat_aide": nat_aide,
        "national": national,
    }
    dst = os.path.join(HERE, "communes_kb.js")
    with io.open(dst, "w", encoding="utf-8") as f:
        f.write("window.COMMUNES=")
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    print("écrit", dst, "%.2f Mo" % (os.path.getsize(dst) / 1e6))

    # contrôle : aucun indicateur ne doit être publié sans valeurs, et chaque
    # id de groupe doit exister dans la liste des indicateurs.
    ids = {i["id"] for i in INDICATEURS}
    for titre, liste in GROUPES:
        for i in liste:
            assert i in ids, "groupe %s : indicateur inconnu %s" % (titre, i)
    orphelins = ids - {i for _, l in GROUPES for i in l} - {"nat_tot"}
    if orphelins:
        print("   indicateurs sans groupe, invisibles dans l'onglet :", sorted(orphelins))

    print("\ncouverture par indicateur :")
    for ind in INDICATEURS:
        n = sum(1 for c in communes if ind["id"] in c["i"])
        vals = [c["i"][ind["id"]] for c in communes if ind["id"] in c["i"]]
        if vals:
            print("  %-16s %3d/%d  de %s à %s" % (ind["id"], n, len(communes),
                  ("%.1f" % min(vals)).rstrip("0").rstrip("."), ("%.1f" % max(vals)).rstrip("0").rstrip(".")))
        else:
            print("  %-16s AUCUNE VALEUR" % ind["id"])


if __name__ == "__main__":
    main()
