# -*- coding: utf-8 -*-
"""
Construit cartes/communes_kb.js : la géométrie des 100 communes et une série
d'indicateurs par commune, pour les cartes thématiques du guide.

Usage :
    python build_cartes.py            télécharge tout et reconstruit
    python build_cartes.py --cache    réutilise les fichiers déjà dans cache/

Sources, toutes en licence CC0 sur data.public.lu :
 1. Limites administratives du Grand-Duché (ACT), limadmin.geojson, 100 communes.
 2. STATEC, API SDMX lustat.statec.lu :
    DF_X021 population, DF_X020 densité, DF_C1600 salaires par commune,
    DF_X026 emploi et chômage, DSD_CENSUS_GROUP7_10@DF_B1625 nationalités (recensement 2021).
 3. Observatoire de l'Habitat, prix annoncés des logements par commune.

Sortie : window.COMMUNES = { meta, indicateurs, communes: [...] }
Chaque commune porte son nom, son canton, son code LAU2, sa géométrie simplifiée
(polyline encodée par anneau) et un dictionnaire d'indicateurs.
"""
import csv, io, json, math, os, sys, urllib.request, datetime, collections

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")

GEOJSON = "https://download.data.public.lu/resources/limites-administratives-du-grand-duche-de-luxembourg/20260905-030016/limadmin.geojson"
PRIX_APPT = "https://download.data.public.lu/resources/prix-annonces-des-logements-par-commune/20260625-080844/vente-appartement-2025-26.xls"
PRIX_MAISON = "https://download.data.public.lu/resources/prix-annonces-des-logements-par-commune/20260625-080909/vente-maison-2025-2026.xls"
SDMX = "https://lustat.statec.lu/rest/data/%s/all?format=csvfilewithlabels"

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


def lire_prix(path):
    import pandas as pd
    x = pd.ExcelFile(path)
    d = pd.read_excel(path, sheet_name=x.sheet_names[0], header=None)
    # trouver la ligne d'en-tête : celle dont une cellule vaut "Commune"
    hdr = None
    for i in range(len(d)):
        if any(str(v).strip() == "Commune" for v in d.iloc[i]):
            hdr = i
            break
    if hdr is None:
        return {}, {}, x.sheet_names[0]
    cols = [str(v).strip() for v in d.iloc[hdr]]
    ic = cols.index("Commune")
    def col(mot):
        for j, c in enumerate(cols):
            if mot in c.lower():
                return j
        return None
    im2 = col("au m")
    itot = None
    for j, c in enumerate(cols):
        cl = c.lower()
        if "prix moyen" in cl and "au m" not in cl:
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

    an_pop = derniere_annee(pop_rows)
    an_dens = derniere_annee(dens_rows)
    an_sal = derniere_annee(sal_rows, lambda r: r["INDICATOR"] == "M030")
    an_emp = derniere_annee(emp_rows, lambda r: r["VARIABLE"] == "C6")
    print("   population", an_pop, "| densité", an_dens, "| salaires", an_sal, "| chômage", an_emp)

    pop = par_commune(pop_rows, "Canton", an_pop)
    pop10 = par_commune(pop_rows, "Canton", an_pop - 10)
    dens = par_commune(dens_rows, "Canton", an_dens)
    sal = {k: par_commune(sal_rows, "Municipality", an_sal, lambda r, i=k: r["INDICATOR"] == i)
           for k in ("M010", "M020", "M030", "M040", "M050")}
    chom = par_commune(emp_rows, "Specification", an_emp, lambda r: r["VARIABLE"] == "C6")
    emploi = par_commune(emp_rows, "Specification", an_emp, lambda r: r["VARIABLE"] == "C1")

    nat = collections.defaultdict(dict)
    for r in nat_rows:
        if r["SEX"] != "_T" or r.get("OBS_VALUE") in (None, ""):
            continue
        nat[cle(r["Geographic level"])][r["CITIZEN"]] = float(r["OBS_VALUE"])

    print("3. prix des logements")
    appt_m2, appt_tot, feuille_a = lire_prix(telecharger(PRIX_APPT, "appt.xls"))
    mais_m2, mais_tot, feuille_m = lire_prix(telecharger(PRIX_MAISON, "maison.xls"))
    print("   appartements :", len(appt_m2), "communes chiffrées |", feuille_a)
    print("   maisons      :", len(mais_m2), "communes chiffrées |", feuille_m)

    print("4. assemblage")
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

        communes.append({
            "nom": nom, "canton": p.get("CANTON", ""), "lau": p.get("LAU2", ""),
            "c": centroide(rings),
            "g": [encode_polyline(r) for r in rings],
            "i": ind,
        })

    if manquants:
        print("   valeurs absentes :", dict(manquants))

    INDICATEURS = [
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
    ]

    out = {
        "meta": {
            "construit": datetime.date.today().isoformat(),
            "n": len(communes),
            "sources": [
                "Limites administratives, Administration du cadastre et de la topographie, data.public.lu, CC0",
                "STATEC, lustat.statec.lu, API SDMX",
                "Observatoire de l'Habitat, prix annoncés des logements par commune, data.public.lu, CC0",
            ],
        },
        "indicateurs": INDICATEURS,
        "communes": communes,
    }
    dst = os.path.join(HERE, "communes_kb.js")
    with io.open(dst, "w", encoding="utf-8") as f:
        f.write("window.COMMUNES=")
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    print("écrit", dst, "%.2f Mo" % (os.path.getsize(dst) / 1e6))

    # contrôle : combien de communes chiffrées par indicateur
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
