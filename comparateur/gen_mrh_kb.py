# -*- coding: utf-8 -*-
# Genere lux_guide/comparateur/mrh_kb.js : matrice de couverture (17 criteres),
# constats de la comparaison, et definitions des biens du profil (pour la reco
# calculee dans le navigateur). Assureurs anonymises A a D.
import json, io, re

SRC = r"C:\Users\shike\Documents\Github\rag\case_studies\fr\vol2_compar\comparatif_contrats_MRH_lu"
DST = r"c:\Users\shike\Documents\Github\foyer\lux_guide\comparateur\mrh_kb.js"

MAP = {"Assureur 2": "Assureur A", "Assureur 3": "Assureur B",
       "Assureur 4": "Assureur C", "Référence R": "Assureur D"}

cm = json.load(io.open(SRC + r"\coverage_matrix.json", encoding="utf-8"))

sources = []
for s in cm["sources"]:
    lab = MAP[s["label"]]
    sources.append({"nom": lab, "pages": s["pages"]})
sources.sort(key=lambda x: x["nom"])

cells = {}
for lab, vals in cm["cells"].items():
    cells[MAP[lab]] = vals

# Constats, reecrits depuis findings.md sans jargon interne ni nom d'assureur.
CONSTATS = [
    {
        "titre": "Le rachat de franchise n'existe nulle part",
        "texte": "Aucun des quatre contrats ne le mentionne, une seule fois. Sur le marché français, "
                 "c'est une option courante ; ici, elle n'est pas proposée sous ce nom. Inutile de la chercher "
                 "dans un devis luxembourgeois, ou alors elle porte un autre nom qu'il faut faire préciser par écrit.",
        "portee": "Les quatre contrats"
    },
    {
        "titre": "Le bris de glace sépare nettement les contrats",
        "texte": "Un contrat en fait un argument, avec quinze mentions dès la première page. Deux autres n'en parlent "
                 "qu'une seule fois, et très tard dans le document (page 9 pour l'un, page 96 pour l'autre), ce qui "
                 "ressemble davantage à une définition ou à une exclusion qu'à une garantie mise en avant. Le quatrième "
                 "est muet. Si vous avez une plaque vitrocéramique ou de grandes surfaces vitrées, c'est le critère à "
                 "faire préciser avant de signer.",
        "portee": "Différence la plus marquée du corpus"
    },
    {
        "titre": "L'assistance habitation n'est pas offerte par tout le monde",
        "texte": "Deux contrats la mettent en avant dès la deuxième page, les deux autres n'en parlent jamais. "
                 "Deux explications possibles, qu'il faut trancher en demandant : soit ils ne la proposent pas dans "
                 "leur produit habitation, soit ils l'appellent autrement. Un dépannage d'urgence un dimanche soir "
                 "se juge le jour où on en a besoin, pas à la signature.",
        "portee": "Deux contrats sur quatre"
    },
    {
        "titre": "La protection juridique manque à un contrat",
        "texte": "Trois contrats la traitent longuement, un n'en parle pas du tout. C'est une garantie standard sur "
                 "le marché européen : ce silence est très probablement un vrai trou, pas une question de vocabulaire. "
                 "Elle sert le jour où il faut opposer un litige à un voisin, un artisan ou un bailleur.",
        "portee": "Un contrat sur quatre"
    },
    {
        "titre": "Les catastrophes naturelles suivent un régime local",
        "texte": "Deux contrats détaillent le sujet dès les premières pages, deux le mentionnent à peine. "
                 "Attention au réflexe importé de France : il n'existe pas ici d'arrêté national de catastrophe "
                 "naturelle qui déclenche l'indemnisation. Ce que couvre le contrat, c'est le contrat qui le dit, "
                 "et rien d'autre.",
        "portee": "Différence de régime avec la France"
    },
    {
        "titre": "Le dégât des eaux est couvert partout, avec des conditions différentes",
        "texte": "C'est le sinistre numéro un en appartement, et les quatre contrats le traitent. La différence ne "
                 "porte pas sur le principe mais sur les détails : franchise, prise en charge de la recherche de fuite, "
                 "dommages causés au voisin du dessous. Un des quatre exclut d'ailleurs ces dommages au voisin de sa "
                 "responsabilité civile, ce qui est le genre de clause qu'on découvre trop tard.",
        "portee": "Les quatre contrats, à conditions inégales"
    }
]

# Biens du profil : memes cibles que reco_personnalisee.py, formules pour un habitant.
# cibles : [groupe, titre] ; titre null = tous les scenarios du groupe.
BIENS = [
    {"id": "contenu_eaux", "nom": "Mon mobilier face à un dégât des eaux",
     "aide": "Le sinistre le plus fréquent en appartement : fuite chez soi ou chez le voisin du dessus.",
     "poids": 8, "defaut": True,
     "cibles": [["Dégât des eaux", None]]},
    {"id": "velo_interieur", "nom": "Un vélo rangé à l'intérieur ou en cave",
     "aide": "Le lieu du vol change tout : à l'intérieur, en cave commune, ou attaché dans la rue.",
     "poids": 6, "defaut": True,
     "cibles": [["Vélo volé", "Dans l'appartement"], ["Vélo volé", "Dans le local à vélos commun"]]},
    {"id": "velo_dehors", "nom": "Un vélo souvent attaché dehors",
     "aide": "Attention : ce cas précis est exclu par les quatre contrats.",
     "poids": 6, "defaut": False,
     "cibles": [["Vélo volé", "Attaché dehors dans la rue"]]},
    {"id": "incendie", "nom": "Mon logement face à un incendie",
     "aide": "Départ de feu en cuisine : murs, électroménager et mobilier.",
     "poids": 4, "defaut": True,
     "cibles": [["Incendie", None]]},
    {"id": "valeur_neuf", "nom": "Être remboursé à neuf, sans mauvaise surprise",
     "aide": "Valeur à neuf ou vétusté déduite, et règle proportionnelle si le capital déclaré est trop bas.",
     "poids": 4, "defaut": True,
     "cibles": [["Valeur à neuf", None], ["Sous-assurance", None]]},
    {"id": "bijoux", "nom": "Des bijoux ou des objets de valeur",
     "aide": "Au-delà d'un seuil, les contrats appliquent des sous-limites, parfois un coffre-fort obligatoire.",
     "poids": 3, "defaut": True,
     "cibles": [["Cambriolage", None]]},
    {"id": "rc", "nom": "Des enfants, un animal, des invités",
     "aide": "La responsabilité civile vie privée couvre les dommages causés à d'autres.",
     "poids": 3, "defaut": True,
     "cibles": [["Responsabilité civile", None]]},
    {"id": "tempete", "nom": "Une maison ou un toit à ma charge",
     "aide": "Tuiles arrachées et infiltration : compte surtout pour un propriétaire.",
     "poids": 2, "defaut": False,
     "cibles": [["Tempête", None]]},
    {"id": "nomade", "nom": "J'emporte souvent ordinateur et téléphone",
     "aide": "Vol hors du domicile, en déplacement ou en vacances.",
     "poids": 3, "defaut": False,
     "cibles": [["Nomade", None]]},
    {"id": "bris_glace", "nom": "Plaque vitrocéramique, grandes vitres, véranda",
     "aide": "Le bris de glace est le poste où les contrats divergent le plus.",
     "poids": 2, "defaut": False,
     "cibles": [["Bris de glace", None]]},
]

out = {
    "assureurs": sorted(MAP.values()),
    "sources": sources,
    "criteres": cm["criteria"],
    "cellules": cells,
    "constats": CONSTATS,
    "biens": BIENS,
    # statut -> score de protection, memes valeurs que reco_personnalisee.py
    "scores": {"covered": 1.0, "covered_with_conditions": 0.85, "sub_limited": 0.5,
               "excluded": 0.0, "not_covered": 0.0, "not_found": None}
}

entete = (
    "// Comparateur habitation : matrice de couverture, constats et definition des biens.\n"
    "// Source : analyse documentaire de quatre conditions generales publiques du marche\n"
    "// luxembourgeois (editions 2017 a 2023), assureurs anonymises A a D.\n"
    "// Genere depuis la case study MRH LU, ne pas editer a la main.\n"
)
js = entete + "window.MRH_KB = " + json.dumps(out, ensure_ascii=False, indent=2) + ";\n"
io.open(DST, "w", encoding="utf-8").write(js)

reste = re.findall(r"Foyer|AXA|Lalux|LALUX|Allianz|Baloise|B\xe2loise|Assureur [0-9]|R\xe9f\xe9rence R", js)
print("ecrit:", DST, len(js), "octets")
print("criteres:", len(out["criteres"]), "| assureurs:", out["assureurs"], "| biens:", len(BIENS))
print("noms restants:", set(reste) or "aucun")

