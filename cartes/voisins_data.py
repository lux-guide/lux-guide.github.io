# -*- coding: utf-8 -*-
"""
Les chiffres des communes frontalières, source nationale par source nationale.

Ce module ne produit rien tout seul : il enrichit les zones construites par
build_frontaliers.py. Il est séparé parce que chaque pays publie ses propres
statistiques, avec ses propres définitions, et que le seul moyen honnête de
les présenter est de ne jamais les mélanger. Chaque pays reçoit donc sa liste
d'indicateurs, et la carte ne peint qu'un pays à la fois.

Ce qui est commun aux trois : le nombre d'habitants qui travaillent au
Luxembourg, publié par l'IGSS, la seule statistique qui compte les trois pays
de la même façon puisqu'elle vient de la sécurité sociale luxembourgeoise.

Sources :
 1. IGSS, emploi total par commune de résidence, data.public.lu, CC0.
 2. INSEE, base du dossier complet, communes françaises, licence ouverte.
 3. Statbel, statistique fiscale des revenus par commune, CC BY 4.0.
"""
import io, os, unicodedata, collections

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")

IGSS = {
    "FR": ("https://igss.gouvernement.lu/dam-assets/publications/statistiques/emploi/"
           "emploi-total-communeres-f.xlsx", "igss_f.xlsx", "Commune"),
    "BE": ("https://igss.gouvernement.lu/dam-assets/publications/statistiques/emploi/"
           "emploi-total-communeres-b.xlsx", "igss_b.xlsx", "Commune"),
    "DE": ("https://igss.gouvernement.lu/dam-assets/publications/statistiques/emploi/"
           "emploi-total-communeres-d.xlsx", "igss_d.xlsx", "Gemeinde"),
}
INSEE_PARQUET = ("https://www.insee.fr/fr/statistiques/fichier/5359146/dossier_complet.parquet",
                 "dossier_complet.parquet")
STATBEL_REV = ("https://statbel.fgov.be/sites/default/files/files/opendata/arbeid/"
               "TF_PSNL_INC_TAX_MUNTY.zip", "be_revenus.zip")


def cle(s):
    """Clé de rapprochement des noms de communes, d'une source à l'autre."""
    s = (s or "").strip().lower()
    s = "".join(c for c in unicodedata.normalize("NFD", s)
                if unicodedata.category(c) != "Mn")
    for a, b in ((" sur ", " "), ("-", " "), ("'", " "), ("/", " "), (".", " "), (",", " ")):
        s = s.replace(a, b)
    return " ".join(s.split())


# ---------------------------------------------------------------- IGSS
def frontaliers(telecharger):
    """Habitants de chaque commune qui travaillent au Luxembourg.

    L'IGSS compte les personnes affiliées à la sécurité sociale
    luxembourgeoise, par commune de résidence. C'est un comptage administratif,
    pas une enquête : il ne rate personne, mais il ne compte que ceux qui sont
    affiliés ici, donc ni les fonctionnaires européens détachés, ni les
    travailleurs détachés par une entreprise étrangère.
    """
    import pandas as pd
    out, dates = {}, set()
    for pays, (url, nom, col) in IGSS.items():
        p = telecharger(url, nom)
        d = pd.read_excel(p, sheet_name="Données source", header=0)
        d.columns = [str(c).strip() for c in d.columns]
        d["Date de référence"] = d["Date de référence"].astype(str)
        dern = sorted(d["Date de référence"].unique())[-1]
        dates.add(dern)
        sub = d[(d["Date de référence"] == dern) & d[col].notna()]
        tot = sub.groupby(col)["Nombre de personnes en emploi"].sum()
        for nom_com, v in tot.items():
            out[(pays, cle(nom_com))] = int(v)
        print("   IGSS %s : %d communes au %s" % (pays, len(tot), dern))
    return out, sorted(dates)[-1]


# ---------------------------------------------------------------- France
# Les mesures retenues dans la base du dossier complet. Sept cents sont
# publiées ; celles-ci sont celles qui aident à choisir où habiter, et dont la
# définition tient en une phrase. Le reste ne manque pas, il encombrerait.
INSEE_MESURES = {
    "MED_SL": "med_sl",
    "PR_MD60": "pauvrete",
    "SALAIRE_NET_EQTP_MENSUEL_MOYENNE": "salaire",
    "POP_EMPSTA_ENQ_2_AGE_Y15T64": "_chomeurs",
    "POP_EMPSTA_ENQ_1T2_AGE_Y15T64": "_actifs",
    "POP_EDUC_700_RP": "_bac5",
    "POP_EDUC_600_RP": "_bac3",
    "POP_EDUC_500_RP": "_bac2",
    "POP_EDUC_001T100_RP": "_sansdip",
    "DWELLINGS_OCS_DW_MAIN_TSH_100": "_proprio",
    "DWELLINGS_OCS_DW_MAIN": "_resprinc",
    "DWELLINGS_OCS_DW_VAC": "_vacants",
    "DWELLINGS": "_logements",
    "POP_WORK_AREA_10": "_surplace",
    "POP_AGE_Y_GE15_EMPSTA_ENQ_1": "_actocc",
}
INSEE_EQUIP = {
    "FACILITIES_FACILITY_TYPE_B105": "supermarches",
    "FACILITIES_FACILITY_TYPE_B207": "boulangeries",
    "FACILITIES_FACILITY_TYPE_C107": "maternelles",
    "FACILITIES_FACILITY_TYPE_C108": "primaires",
    "FACILITIES_FACILITY_TYPE_C201": "colleges",
    "FACILITIES_FACILITY_TYPE_D201": "medecins",
}


def france(zones, telecharger):
    """Les communes françaises, par la base du dossier complet de l'INSEE."""
    import duckdb
    p = telecharger(*INSEE_PARQUET)
    codes = sorted({z["lau"].split("_")[-1] for z in zones if z["pays"] == "FR"})
    liste = ",".join("'%s'" % c for c in codes)
    mesures = ",".join("'%s'" % m for m in list(INSEE_MESURES) + list(INSEE_EQUIP))
    c = duckdb.connect()
    q = """
      SELECT GEO, TAB_MEASURE, TIME_PERIOD, OBS_VALUE
      FROM read_parquet('%s')
      WHERE GEO_OBJECT='COM' AND GEO IN (%s) AND TAB_MEASURE IN (%s)
        AND OBS_VALUE IS NOT NULL
    """ % (os.path.join(CACHE, INSEE_PARQUET[1]).replace("\\", "/"), liste, mesures)
    lignes = c.execute(q).fetchall()
    print("   INSEE : %d observations pour %d communes" % (len(lignes), len(codes)))
    # On ne garde que l'année la plus récente de chaque mesure.
    brut = collections.defaultdict(dict)
    for geo, mes, an, val in lignes:
        cour = brut[geo].get(mes)
        if cour is None or an > cour[0]:
            brut[geo][mes] = (an, val)
    annees = collections.Counter()
    out = {}
    for geo, mesures_geo in brut.items():
        v = {}
        for mes, (an, val) in mesures_geo.items():
            nom = INSEE_MESURES.get(mes) or INSEE_EQUIP.get(mes)
            v[nom] = val
            annees[(nom, an)] += 1
        ind = {}
        if v.get("med_sl"):
            ind["med_sl"] = round(v["med_sl"])
        if v.get("pauvrete"):
            ind["pauvrete"] = round(v["pauvrete"], 1)
        if v.get("salaire"):
            ind["salaire"] = round(v["salaire"])
        if v.get("_actifs"):
            ind["chomage"] = round(100.0 * v.get("_chomeurs", 0) / v["_actifs"], 1)
        dip = v.get("_sansdip", 0) + v.get("_bac2", 0) + v.get("_bac3", 0) + v.get("_bac5", 0)
        sup = v.get("_bac2", 0) + v.get("_bac3", 0) + v.get("_bac5", 0)
        # La part de diplômés se rapporte à toute la population non scolarisée
        # de quinze ans ou plus, pas seulement aux quatre tranches lues ici :
        # on ne la publie que si le total des tranches connues est crédible.
        if v.get("_sansdip") and dip:
            ind["part_sup"] = round(100.0 * sup / dip, 1)
        if v.get("_resprinc"):
            ind["proprietaires"] = round(100.0 * v.get("_proprio", 0) / v["_resprinc"], 1)
        if v.get("_logements"):
            ind["vacants"] = round(100.0 * v.get("_vacants", 0) / v["_logements"], 1)
        if v.get("_actocc"):
            ind["travail_hors"] = round(100.0 * (1 - v.get("_surplace", 0) / v["_actocc"]), 1)
        for nom in INSEE_EQUIP.values():
            if v.get(nom):
                ind[nom] = int(v[nom])
        out[geo] = ind
    return out, annees


# ---------------------------------------------------------------- Belgique
def belgique(zones, telecharger):
    """Les communes belges, par la statistique fiscale des revenus."""
    import zipfile
    p = telecharger(*STATBEL_REV)
    z = zipfile.ZipFile(p)
    f = io.TextIOWrapper(z.open("TF_PSNL_INC_TAX_MUNTY.txt"), encoding="utf-8-sig")
    cols = f.readline().strip().split("|")
    idx = {c: i for i, c in enumerate(cols)}
    par_commune, annees = {}, set()
    for ligne in f:
        v = ligne.rstrip("\n").split("|")
        an = v[idx["CD_YEAR"]]
        nom = v[idx["TX_MUNTY_DESCR_FR"]]
        k = cle(nom)
        cour = par_commune.get(k)
        if cour and cour[0] >= an:
            continue
        par_commune[k] = (an, v)
        annees.add(an)
    dern = sorted(annees)[-1]
    out = {}
    for k, (an, v) in par_commune.items():
        if an != dern:
            continue
        def n(col):
            # Statbel masque les petites cellules par une étoile : c'est une
            # valeur absente, pas un zéro.
            x = v[idx[col]]
            try:
                return float(x)
            except (TypeError, ValueError):
                return None
        ind = {}
        net, nb = n("MS_TOT_NET_INC"), n("MS_NBR_TOT_NET_INC")
        if net and nb:
            ind["revenu_decl"] = round(net / nb)
        tot_decl = (n("MS_NBR_NON_ZERO_INC") or 0) + (n("MS_NBR_ZERO_INC") or 0)
        if tot_decl and n("MS_NBR_ZERO_INC") is not None:
            ind["decl_sans_revenu"] = round(100.0 * n("MS_NBR_ZERO_INC") / tot_decl, 1)
        etat, comm = n("MS_TOT_STATE_TAXES"), n("MS_TOT_MUNICIP_TAXES")
        if etat and comm:
            ind["taxe_communale"] = round(100.0 * comm / etat, 1)
        tot_taxes, nbt = n("MS_TOT_TAXES"), n("MS_NBR_TOT_TAXES")
        if tot_taxes and nbt:
            ind["impot_moyen"] = round(tot_taxes / nbt)
        out[k] = ind
    print("   Statbel : %d communes, exercice %s" % (len(out), dern))
    return out, dern
