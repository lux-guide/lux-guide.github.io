# -*- coding: utf-8 -*-
"""
Construit cartes/frontaliers_kb.js : les communes des trois pays voisins d'où
l'on vient travailler au Luxembourg, et les repères comparables de la Grande
Région.

Pourquoi un second script, et non des indicateurs de plus dans le premier. Les
cent communes luxembourgeoises se comparent entre elles, avec les chiffres du
STATEC. Dès qu'on passe la frontière, plus aucune statistique nationale n'est
comparable : le revenu médian français est un niveau de vie par unité de
consommation, le belge un revenu imposable par déclaration, l'allemand un
revenu disponible par habitant, et il n'existe qu'au Kreis. Mettre ces trois
nombres sur la même échelle de couleurs serait une comparaison fausse.

Ce script s'en tient donc à deux registres, séparés :

 1. Ce qui est mesuré de la même façon partout, commune par commune : la
    géométrie et la population du référentiel européen LAU, la superficie, la
    densité, et la distance à Luxembourg-Ville. Cela suffit pour choisir un
    endroit où habiter.
 2. Ce qui n'est comparable qu'à l'échelle régionale, et qui est donné comme
    tel, sans être peint sur la carte des communes : revenu disponible des
    ménages par habitant en standards de pouvoir d'achat, produit intérieur
    brut par habitant, chômage, et les niveaux de prix par pays.

Usage :
    python build_frontaliers.py            télécharge tout et reconstruit
    python build_frontaliers.py --cache    réutilise les fichiers de cache/

Sources :
 1. Eurostat GISCO, LAU 2021, géométrie et population des unités
    administratives locales des 27 pays (© EuroGeographics pour les limites).
 2. Eurostat prc_ppp_ind, indices de niveau des prix par pays et catégorie.
 3. Eurostat nama_10r_2hhinc, revenu des ménages par région NUTS 2.
 4. Eurostat nama_10r_3gdp, produit intérieur brut par région NUTS 3.
 5. Eurostat lfst_r_lfu3rt, taux de chômage par région NUTS 2.

Sortie : window.FRONTALIERS = { meta, indicateurs, groupes, zones, regions,
prix, pays }.
"""
import io, json, math, os, sys, urllib.parse, urllib.request, datetime, collections

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
USE_CACHE = "--cache" in sys.argv

# Les fonctions de géométrie sont déjà écrites et éprouvées pour les cent
# communes : les recopier ici ferait deux versions à corriger au lieu d'une.
sys.path.insert(0, HERE)
from build_cartes import anneaux, encode_polyline, centroide  # noqa: E402

LAU = "https://gisco-services.ec.europa.eu/distribution/v2/lau/geojson/LAU_RG_01M_2021_4326.geojson"
EUROSTAT = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/%s?format=JSON&lang=FR&%s"

# Luxembourg-Ville, place d'Armes. Le centre du pays pour qui vient travailler.
LUX = (49.6113, 6.1292)
# Au-delà, ce n'est plus un trajet quotidien. Soixante-cinq kilomètres à vol
# d'oiseau place Metz et Trèves dedans, Nancy et Sarrebruck dehors.
RAYON_KM = 65

# Les six régions de la Grande Région, au sens officiel, en codes NUTS 2.
REGIONS = [
    ("LU00", "Luxembourg", "LU"),
    ("FRF3", "Lorraine", "FR"),
    ("BE34", "Province de Luxembourg", "BE"),
    ("BE33", "Province de Liège", "BE"),
    ("DEB2", "Trèves (Trier)", "DE"),
    ("DEC0", "Sarre", "DE"),
]
PAYS = {"LU": "Luxembourg", "FR": "France", "BE": "Belgique", "DE": "Allemagne"}

# Les catégories de prix qui parlent à quelqu'un qui vient de s'installer. La
# nomenclature en compte soixante et une, la plupart sans usage ici (formation
# brute de capital fixe, consommation collective).
CATEGORIES_PRIX = [
    ("A01", "Tout ce qu'un ménage consomme"),
    ("A0101", "Alimentation et boissons sans alcool"),
    ("A01010102", "Viande"),
    ("A01010104", "Lait, fromage et œufs"),
    ("A01010106", "Fruits, légumes, pommes de terre"),
    ("A010201", "Boissons alcoolisées"),
    ("A010202", "Tabac"),
    ("A0103", "Habillement et chaussures"),
    ("A010405", "Électricité, gaz et autres combustibles"),
    ("A0105", "Ameublement et équipement du ménage"),
    ("A0106", "Santé"),
    ("A010701", "Voiture et carburant"),
    ("A010703", "Transports collectifs"),
    ("A0108", "Communications"),
    ("A0109", "Loisirs et culture"),
    ("A0111", "Restaurants et hôtels"),
]


def telecharger(url, nom, binaire=True):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, nom)
    if USE_CACHE and os.path.exists(p):
        return p
    print("  télécharge", nom)
    req = urllib.request.Request(url, headers={"User-Agent": "lux_guide build_frontaliers"})
    with urllib.request.urlopen(req, timeout=900) as r, open(p, "wb") as f:
        while True:
            bloc = r.read(1 << 20)
            if not bloc:
                break
            f.write(bloc)
    return p


def eurostat(code, params, nom):
    """Une série Eurostat, rendue comme un dictionnaire {géo: {année: valeur}}.

    Le format JSON-stat range les valeurs dans un tableau plat indexé par le
    produit des dimensions. On le déplie une fois ici plutôt qu'à chaque appel.
    """
    p = telecharger(EUROSTAT % (code, params), nom)
    d = json.load(io.open(p, encoding="utf-8"))
    dims = d["id"]
    tailles = d["size"]
    index = {k: d["dimension"][k]["category"]["index"] for k in dims}
    inverse = {k: {v: kk for kk, v in index[k].items()} for k in dims}
    out = collections.defaultdict(dict)
    for pos, val in d["value"].items():
        pos = int(pos)
        coord = []
        for t in reversed(tailles):
            coord.append(pos % t)
            pos //= t
        coord.reverse()
        cle = {dims[i]: inverse[dims[i]][coord[i]] for i in range(len(dims))}
        out[cle.get("geo")][cle.get("time")] = val
    return dict(out)


# Le fichier européen pèse 126 Mo et contient les cent mille communes des vingt-
# sept pays. Le charger d'un bloc demande plus d'un giga-octet de mémoire pour
# n'en garder que quelques centaines. On le lit donc morceau par morceau : le
# fichier est produit par une machine, chaque objet y commence exactement par la
# même chaîne, ce qui suffit à les séparer sans analyser tout le document.
DEBUT = '{"type": "Feature", "properties":'


def lire_features(chemin, pays=("FR", "BE", "DE")):
    texte = io.open(chemin, encoding="utf-8").read()
    morceaux = texte.split(DEBUT)
    del texte
    for m in morceaux[1:]:
        # Le pays est dans les deux cents premiers caractères : on écarte 97 %
        # des communes sans jamais construire leur objet.
        tete = m[:200]
        if not any('"CNTR_CODE": "%s"' % c in tete for c in pays):
            continue
        fin = m.rfind("}")
        while fin > 0:
            try:
                yield json.loads(DEBUT + m[:fin + 1])
                break
            except ValueError:
                fin = m.rfind("}", 0, fin)


# Le référentiel européen donne un seul nom par commune, et ce n'est pas
# toujours celui qu'on lit sur les panneaux : les communes wallonnes y portent
# parfois leur nom néerlandais, et les communes allemandes traînent leur rang
# administratif. On nettoie, sans traduire : c'est ce nom-là qu'il faudra taper
# sur un site d'annonces ou dans un GPS.
ALIAS = {
    "Aarlen": "Arlon",
    "Bastenaken": "Bastogne",
    "Saint-Léger (Virton)": "Saint-Léger",
    "Neufchâteau (Neufchâteau)": "Neufchâteau",
}
SUFFIXES = (", Stadt", ", Kreisstadt", ", Landstadt", ", Universitätsstadt",
            ", kreisfreie Stadt", ", Hansestadt")


def nom_propre(nom):
    nom = (nom or "").strip()
    nom = ALIAS.get(nom, nom)
    for suf in SUFFIXES:
        if nom.endswith(suf):
            nom = nom[: -len(suf)]
    return " ".join(nom.replace("/ ", "/").split())


def distance_km(a, b):
    """Haversine. Les distances utiles ici font moins de cent kilomètres, mais
    une approximation plane fausserait déjà le classement des communes."""
    r = 6371.0
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def frontiere_luxembourgeoise():
    """Les points du contour du pays, pour mesurer la distance à la frontière.

    Le fichier des limites administratives est déjà téléchargé par l'autre
    script ; on se contente de le lire s'il est là.
    """
    p = os.path.join(CACHE, "limadmin.geojson")
    if not os.path.exists(p):
        return []
    g = json.load(io.open(p, encoding="utf-8"))
    pts = []
    for f in g["communes"]["features"]:
        for ring in anneaux(f["geometry"], 400 / 111000.0):
            pts.extend(ring[::3])
    return pts


def main():
    print("1. limites communales européennes (LAU 2021)")
    p = telecharger(LAU, "lau.geojson")
    print("   lecture en flux de %.0f Mo" % (os.path.getsize(p) / 1e6))
    feats = list(lire_features(p))
    print("  ", len(feats), "unités administratives locales des trois pays voisins")

    bord = frontiere_luxembourgeoise()
    print("  ", len(bord), "points de contour du Luxembourg")

    TOL = 90 / 111000.0  # 90 m : la carte des voisins se regarde de plus loin
    zones, par_pays = [], collections.Counter()
    for f in feats:
        pr = f["properties"]
        pays = (pr.get("CNTR_CODE") or "")[:2]
        if pays not in ("FR", "BE", "DE"):
            continue
        geom = f.get("geometry")
        if not geom:
            continue
        rings = anneaux(geom, TOL)
        if not rings:
            continue
        c = centroide(rings)
        d_lux = distance_km(c, LUX)
        if d_lux > RAYON_KM:
            continue
        d_bord = min((distance_km(c, b) for b in bord), default=None)
        pop = pr.get("POP_2021") or pr.get("POP_2020") or pr.get("POP")
        aire = pr.get("AREA_KM2") or pr.get("_AREA")
        ind = {"dist_lux": round(d_lux, 1)}
        if d_bord is not None:
            ind["dist_frontiere"] = round(d_bord, 1)
        if pop:
            ind["pop"] = int(pop)
        if aire:
            ind["aire"] = round(float(aire), 1)
            if pop:
                ind["dens"] = round(float(pop) / float(aire))
        zones.append({
            "nom": nom_propre(pr.get("LAU_NAME") or pr.get("LAU_ID")),
            "canton": PAYS[pays],
            "lau": pr.get("GISCO_ID") or pr.get("LAU_ID"),
            "pays": pays,
            "c": c,
            "g": [encode_polyline(r) for r in rings],
            "i": ind,
        })
        par_pays[pays] += 1

    # Deux communes homonymes existent des deux côtés de la frontière. Le nom
    # sert de clé dans toute l'interface : on le rend unique en y accolant le
    # pays, plutôt que de laisser deux zones se confondre.
    vus = collections.Counter(z["nom"] for z in zones)
    for z in zones:
        if vus[z["nom"]] > 1:
            z["nom"] = "%s (%s)" % (z["nom"], PAYS[z["pays"]])
    # Deux Wawern voisins existent en Allemagne : le pays ne les sépare pas,
    # le code de la commune si.
    vus = collections.Counter(z["nom"] for z in zones)
    for z in zones:
        if vus[z["nom"]] > 1:
            z["nom"] = "%s %s" % (z["nom"], z["lau"].split("_")[-1])
    zones.sort(key=lambda z: (z["pays"], z["nom"] or ""))
    print("   retenues à moins de %d km de Luxembourg-Ville :" % RAYON_KM, dict(par_pays))
    manquants = collections.Counter()
    for z in zones:
        for champ in ("pop", "aire", "dens"):
            if champ not in z["i"]:
                manquants[champ] += 1
    if manquants:
        print("   valeurs absentes :", dict(manquants))

    print("2. Eurostat, revenu des ménages par région (NUTS 2)")
    codes2 = "&".join("geo=" + r[0] for r in REGIONS)
    rev = eurostat("nama_10r_2hhinc",
                   "unit=PPS_EU27_2020_HAB&direct=BAL&na_item=B6N&" + codes2, "hhinc.json")
    chom = eurostat("lfst_r_lfu3rt", "unit=PC&sex=T&age=Y20-64&isced11=TOTAL&" + codes2, "chom.json")
    print("3. Eurostat, produit intérieur brut par région")
    pib = eurostat("nama_10r_2gdp", "unit=PPS_EU27_2020_HAB&" + codes2, "pib.json")

    regions = []
    for code, nom, pays in REGIONS:
        def dernier(serie):
            s = serie.get(code) or {}
            if not s:
                return None, None
            an = max(s)
            return s[an], an
        r_rev, an_rev = dernier(rev)
        r_pib, an_pib = dernier(pib)
        r_chom, an_chom = dernier(chom)
        regions.append({
            "code": code, "nom": nom, "pays": pays,
            "revenu": r_rev, "an_revenu": an_rev,
            "pib": r_pib, "an_pib": an_pib,
            "chomage": r_chom, "an_chomage": an_chom,
        })
        print("   %-24s revenu %s (%s) | PIB %s | chômage %s"
              % (nom, r_rev, an_rev, r_pib, r_chom))

    print("4. Eurostat, niveaux de prix par pays")
    cats = "&".join("ppp_cat=" + c for c, _ in CATEGORIES_PRIX)
    pays_codes = "&".join("geo=" + p for p in ("LU", "FR", "BE", "DE"))
    brut = telecharger(EUROSTAT % ("prc_ppp_ind",
                       "na_item=PLI_EU27_2020&" + cats + "&" + pays_codes), "pli.json")
    d = json.load(io.open(brut, encoding="utf-8"))
    dims, tailles = d["id"], d["size"]
    index = {k: d["dimension"][k]["category"]["index"] for k in dims}
    inverse = {k: {v: kk for kk, v in index[k].items()} for k in dims}
    valeurs = collections.defaultdict(dict)
    annees = set()
    for pos, val in d["value"].items():
        pos = int(pos)
        coord = []
        for t in reversed(tailles):
            coord.append(pos % t)
            pos //= t
        coord.reverse()
        cle = {dims[i]: inverse[dims[i]][coord[i]] for i in range(len(dims))}
        valeurs[(cle["ppp_cat"], cle["geo"])][cle["time"]] = val
        annees.add(cle["time"])
    an_prix = max(annees) if annees else None
    prix = []
    for code, nom in CATEGORIES_PRIX:
        ligne = {"id": code, "nom": nom}
        complet = True
        for pays in ("LU", "FR", "BE", "DE"):
            v = valeurs.get((code, pays), {}).get(an_prix)
            if v is None:
                complet = False
            ligne[pays] = v
        if complet:
            prix.append(ligne)
        else:
            print("   écartée, série incomplète en %s : %s" % (an_prix, nom))
    print("   %d catégories de prix, année %s" % (len(prix), an_prix))

    INDICATEURS = [
        {"id": "dist_lux", "nom": "Distance de Luxembourg-Ville", "unite": "km", "sens": -1,
         "fmt": "dec", "source": "Calculée à vol d'oiseau depuis le centre de la commune",
         "aide": "À vol d'oiseau, et non en temps de trajet. Une commune à 30 km sur l'autoroute "
                 "A31 aux heures de pointe est plus loin, en temps, qu'une commune à 45 km sur "
                 "une ligne de train directe."},
        {"id": "dist_frontiere", "nom": "Distance de la frontière", "unite": "km", "sens": -1,
         "fmt": "dec", "source": "Calculée depuis les limites administratives luxembourgeoises",
         "aide": "Utile pour les courses et les services du quotidien, moins pour le trajet du "
                 "travail : la frontière n'est pas l'endroit où l'on va travailler."},
        {"id": "pop", "nom": "Population", "unite": "habitants", "sens": 0, "fmt": "ent",
         "source": "Eurostat GISCO, référentiel LAU 2021",
         "aide": "Comptée de la même façon dans les trois pays, ce que les recensements "
                 "nationaux ne permettent pas."},
        {"id": "dens", "nom": "Densité de population", "unite": "hab/km²", "sens": 0, "fmt": "ent",
         "source": "Eurostat GISCO, référentiel LAU 2021",
         "aide": "Un village de 800 habitants sur 20 km² et un quartier de 800 habitants sur "
                 "un demi-kilomètre carré ne se vivent pas pareil."},
        {"id": "aire", "nom": "Superficie", "unite": "km²", "sens": 0, "fmt": "dec",
         "source": "Eurostat GISCO, référentiel LAU 2021", "aide": ""},
    ]
    GROUPES = [
        ["Distance", ["dist_lux", "dist_frontiere"]],
        ["Population", ["pop", "dens", "aire"]],
    ]

    out = {
        "meta": {
            "construit": datetime.date.today().isoformat(),
            "n": len(zones),
            "rayon": RAYON_KM,
            "sources": [
                "Eurostat GISCO, unités administratives locales LAU 2021, limites © EuroGeographics",
                "Eurostat, indices de niveau des prix prc_ppp_ind",
                "Eurostat, revenu des ménages par région nama_10r_2hhinc",
                "Eurostat, produit intérieur brut par région nama_10r_2gdp",
                "Eurostat, taux de chômage régional lfst_r_lfu3rt",
            ],
        },
        "indicateurs": INDICATEURS,
        "groupes": GROUPES,
        "zones": zones,
        "regions": regions,
        "prix": {"annee": an_prix, "categories": prix},
        "pays": PAYS,
    }
    dst = os.path.join(HERE, "frontaliers_kb.js")
    with io.open(dst, "w", encoding="utf-8") as f:
        f.write("window.FRONTALIERS=")
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    print("écrit", dst, "%.2f Mo" % (os.path.getsize(dst) / 1e6))

    print("\ncouverture par indicateur :")
    for ind in INDICATEURS:
        vals = [z["i"][ind["id"]] for z in zones if ind["id"] in z["i"]]
        if vals:
            print("  %-16s %4d/%d  de %s à %s" % (ind["id"], len(vals), len(zones),
                  round(min(vals), 1), round(max(vals), 1)))
        else:
            print("  %-16s AUCUNE VALEUR" % ind["id"])


if __name__ == "__main__":
    main()
