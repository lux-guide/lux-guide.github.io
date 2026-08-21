# -*- coding: utf-8 -*-
# Convertit sinistres_comparaison.json (case study MRH LU du depot rag) en
# lux_guide/comparateur/contrats_kb.js, avec anonymisation des assureurs.
import json, re, io

SRC = r"C:\Users\shike\Documents\Github\rag\case_studies\fr\vol2_compar\comparatif_contrats_MRH_lu\sinistres_comparaison.json"
DST = r"c:\Users\shike\Documents\Github\foyer\lux_guide\comparateur\contrats_kb.js"

# Meme mapping que les pages publiques : A=AXA, B=Lalux, C=Allianz, D=Foyer (la reference)
MAP = {
    "Foyer (mon contrat)": "Assureur D",
    "AXA": "Assureur A",
    "Lalux": "Assureur B",
    "Allianz": "Assureur C",
}

def anonymiser(t):
    if not isinstance(t, str):
        return t
    t = re.sub(r"Foyer Assurances|Foyer\s+Assurances", "l'assureur", t)
    t = re.sub(r"La Compagnie", "l'assureur", t)
    t = re.sub(r"\bFoyer\b(?! fiscal)", "l'assureur", t)
    t = re.sub(r"\bAXA\b", "l'assureur", t)
    t = re.sub(r"\bLALUX\b|\bLalux\b|\blalux\b", "l'assureur", t)
    t = re.sub(r"\bAllianz\b", "l'assureur", t)
    t = re.sub(r"\bB[aâ]loise\b", "l'assureur", t)
    return t

with io.open(SRC, encoding="utf-8") as f:
    data = json.load(f)

out = {"assureurs": [MAP[i] for i in data["insurers"]], "scenarios": []}
for sc in data["scenarios"]:
    s = {"groupe": sc["group"], "titre": sc["title"], "question": sc["question"], "verdicts": {}}
    for ins, v in sc["verdicts"].items():
        s["verdicts"][MAP[ins]] = {
            "statut": v.get("status", ""),
            "plafond": anonymiser(v.get("plafond", "")),
            "franchise": anonymiser(v.get("franchise", "")),
            "cle": anonymiser(v.get("key_condition_or_exclusion", "")),
            "citation": anonymiser(v.get("citation", "")),
            "page": v.get("page"),
            "verifiee": bool(v.get("citation_verified")),
        }
    out["scenarios"].append(s)

# tri des assureurs : A, B, C, D
out["assureurs"] = sorted(out["assureurs"])

entete = (
    "// Base du chat contrats : verdicts par sinistre extraits de conditions generales\n"
    "// publiques du marche luxembourgeois (editions 2017 a 2023), assureurs anonymises.\n"
    "// Genere depuis la case study MRH LU, ne pas editer a la main.\n"
)
js = entete + "window.CONTRATS_KB = " + json.dumps(out, ensure_ascii=False, indent=2) + ";\n"
with io.open(DST, "w", encoding="utf-8") as f:
    f.write(js)

reste = re.findall(r"Foyer|AXA|Lalux|LALUX|Allianz|Baloise|B\xe2loise", js)
print("ecrit:", DST, len(js), "octets ;", len(out["scenarios"]), "scenarios ; noms restants:", set(reste) or "aucun")
