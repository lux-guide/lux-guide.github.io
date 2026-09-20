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

    python cartes/build_ecoles.py
"""

import collections
import csv
import io
import json
import os
import re
import sys
import unicodedata
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
    """Localité et code postal vers commune, d'après le cadastre."""
    par_loc, par_cp, par_couple = {}, {}, {}
    with io.open(telecharger(ADRESSES, "act_adresses.csv"), encoding="utf-8", errors="replace") as f:
        for r in csv.DictReader(f, delimiter=";"):
            cle = (r["commune"], r["lau2"])
            par_loc.setdefault(norm(r["localite"]), collections.Counter())[cle] += 1
            par_cp.setdefault(r["code_postal"].strip(), collections.Counter())[cle] += 1
            par_couple.setdefault((r["code_postal"].strip(), norm(r["localite"])), collections.Counter())[cle] += 1
    return par_loc, par_cp, par_couple


def commune_de(cp, localite, ann):
    """Le couple code postal et localité d'abord : 91 codes postaux sont à
    cheval sur deux communes, la localité les départage."""
    par_loc, par_cp, par_couple = ann
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


def main():
    ann = annuaire()
    par_commune = collections.defaultdict(lambda: {"ef": [], "ly": [], "sea": {"tot": 0, "conv": 0, "nc": 0, "je": 0, "es": 0}})
    perdus = []

    for r in lignes_xlsx("ecoles", "FINAL"):
        nom, cp, ville = propre(r[1]), propre(r[2]), titre_localite(r[3])
        c = commune_de(cp, ville, ann)
        if not c:
            perdus.append(("ecole", nom, cp, ville))
            continue
        par_commune[c[1]]["ef"].append({"n": nom, "l": ville})

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
        },
        "communes": dict(par_commune),
    }
    js = "window.ECOLES=" + json.dumps(kb, ensure_ascii=False, separators=(",", ":")) + ";\n"
    with io.open(SORTIE, "w", encoding="utf-8", newline="\n") as f:
        f.write(js)

    n_ef = sum(len(d["ef"]) for d in par_commune.values())
    n_ly = sum(len(d["ly"]) for d in par_commune.values())
    n_sea = sum(d["sea"]["tot"] for d in par_commune.values())
    print("communes : %d | ecoles fondamentales : %d | lycees : %d | accueil : %d | offre internationale : %d"
          % (len(par_commune), n_ef, n_ly, n_sea, n_offre))
    print("campus : %s" % ", ".join(sorted(n for d in par_commune.values() for n in d["campus"])))
    print("ecrit %s (%.0f ko)" % (SORTIE, os.path.getsize(SORTIE) / 1024.0))
    if perdus:
        print("\nadresses non rattachees (%d), a regarder :" % len(perdus))
        for p in perdus[:20]:
            print("   ", p)


if __name__ == "__main__":
    main()
