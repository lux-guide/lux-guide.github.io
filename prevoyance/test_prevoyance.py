# -*- coding: utf-8 -*-
# Le site epargne-retraite : quatre onglets, et les regles de fond.
#
# Lancer un serveur sur le dossier, puis ce fichier :
#   python -m http.server 8932 --directory prevoyance
#   python prevoyance/test_prevoyance.py
from playwright.sync_api import sync_playwright
import io, os, re, sys

URL = "http://localhost:8932/index.html"
APP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app")
errs, echecs = [], []
PLAT = "e => e.map(x => x.innerText.replace(/\\s+/g, ' '))"


def verifie(cond, msg):
    if not cond:
        echecs.append(msg)
        print("  ECHEC :", msg)
    else:
        print("  ok :", msg)


def lire(f):
    return io.open(os.path.join(APP, f), encoding="utf-8").read()


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1400, "height": 950})
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append("console " + m.text) if m.type == "error" else None)
    pg.goto(URL)
    pg.wait_for_timeout(900)

    print("1. Un site a part, pas un onglet du guide")
    verifie(pg.locator("#tabs button").count() == 4, "quatre onglets et pas davantage")
    verifie(pg.locator("nav.tabs button[data-panel]").count() == 0, "aucune barre du guide d'installation")
    verifie("installation" not in pg.inner_text("header").lower(), "le mot installation n'est pas dans l'en-tete")
    verifie(pg.locator(".lien-guide").count() == 1, "un lien discret vers le guide, dans le pied")
    verifie(pg.get_attribute(".lien-guide", "href") == "../", "il pointe vers le site voisin")

    print("2. L'accueil chiffre avant de demander quoi que ce soit")
    verifie(pg.locator("#acc-apercu .kpi").count() == 2, "deux totaux calcules des l'arrivee")
    mvt = pg.inner_text("#acc-mouvement").replace(" ", " ").replace(" ", " ")
    verifie("3 200" in mvt and "4 500" in mvt, "le plafond est montre comme un mouvement")
    verifie("1 300" in mvt, "l'ecart est derive de la table")

    print("3. Ce site s'adresse aussi a ceux qui sont deja la")
    acc = pg.inner_text("#vue-accueil")
    verifie("pas que les nouveaux arrivants" in acc or "quelle que soit la durée" in acc,
            "il est dit que le dispositif ne vise pas que les arrivants")

    print("4. Le simulateur")
    pg.click("#tabs button[data-vue='simulateur']")
    pg.wait_for_timeout(600)
    verifie(pg.locator("#vue-simulateur").is_visible(), "la vue s'ouvre")
    verifie(pg.locator("#sim-champs input, #sim-champs select").count() == 4, "quatre questions, pas une de plus")
    calculs = pg.eval_on_selector_all("#sim-resultat .calcul", PLAT)
    verifie(len(calculs) >= 3 and all(c.strip() for c in calculs), "chaque montant dit comment il est obtenu")
    txt = pg.inner_text("#sim-resultat")
    verifie("ne s'additionnent pas" in txt, "annuel et ponctuel ne s'additionnent pas")
    entetes = pg.eval_on_selector_all("#sim-resultat thead th", PLAT)
    verifie(len([e for e in entetes if "%" in e]) == 4, "une colonne par taux")
    verifie("ne le devine pas" in txt, "aucun taux devine")

    print("5. Le cas qui rend zero ne dessine rien")
    pg.locator("#sim-cas .chip").nth(2).click()
    pg.wait_for_timeout(500)
    verifie(pg.locator("#sim-resultat table").count() == 0, "aucun tableau")
    verifie(pg.locator("#sim-resultat .kpi").count() == 0, "aucun indicateur")
    verifie("lieu d'imposition" in pg.inner_text("#sim-resultat"), "le refus est motive")
    pg.locator("#sim-cas .chip").first.click()
    pg.wait_for_timeout(400)

    print("6. L'age de sortie est calcule, pas ecrit en dur")
    # Souscrire tard repousse l'echeance : la duree minimale du contrat prime
    # sur l'age legal. Ecrire « a partir de 60 ans » serait faux pour la
    # personne meme qui regarde le dispositif de plus pres.
    pg.fill("#ch-age", "55")
    pg.wait_for_timeout(500)
    t55 = pg.inner_text("#sim-resultat")
    verifie("65 ans" in t55, "a 55 ans, l'echeance annoncee est 65 ans")
    verifie("repousse l'échéance" in t55, "et la raison est donnee")
    pg.fill("#ch-age", "40")
    pg.wait_for_timeout(500)
    t40 = pg.inner_text("#sim-resultat")
    verifie("60 ans" in t40 and "repousse l'échéance" not in t40, "a 40 ans, l'echeance est l'age legal, sans mention inutile")
    pg.locator("#sim-cas .chip").first.click()
    pg.wait_for_timeout(400)

    print("7. La foire aux questions")
    pg.click("#tabs button[data-vue='questions']")
    pg.wait_for_timeout(600)
    n0 = pg.locator("#q-liste .qitem").count()
    print("   questions :", n0)
    verifie(n0 >= 25, "toutes les questions sont listees")
    verifie(pg.locator("#q-liste .srcs").count() == n0, "chacune porte ses sources")
    pg.fill("#q-filtre", "frontalier")
    pg.wait_for_timeout(400)
    n1 = pg.locator("#q-liste .qitem").count()
    pg.fill("#q-filtre", "frontalier impot")
    pg.wait_for_timeout(400)
    n2 = pg.locator("#q-liste .qitem").count()
    print("   'frontalier' :", n1, "| 'frontalier impot' :", n2)
    verifie(0 < n1 < n0, "le filtre reduit")
    verifie(n2 <= n1, "chaque mot restreint, il n'elargit pas")
    pg.fill("#q-filtre", "zzzz")
    pg.wait_for_timeout(400)
    verifie(pg.locator("#q-liste .notice").count() == 1, "un resultat vide propose l'assistant")
    pg.fill("#q-filtre", "")
    pg.wait_for_timeout(300)

    print("8. Une source qui se contredit ne se resume pas")
    # Sur le remboursement anticipe, le texte officiel dit dans le meme
    # paragraphe « integralement impose » et « est exclu ». Trancher a sa place
    # serait inventer une regle.
    # Les questions sont des <details> replies : innerText ne rend que le
    # resume, il faut lire le texte du noeud.
    fq = pg.eval_on_selector("#q-liste", "e => e.textContent")
    verifie("intégralement imposé" in fq and "exclu" in fq, "les deux lectures figurent")
    verifie("ne tranche" in fq, "le site dit qu'il ne tranche pas")

    print("9. L'assistant annonce son perimetre avant qu'on lui parle")
    pg.click("#tabs button[data-vue='assistant']")
    pg.wait_for_timeout(600)
    verifie(pg.locator("#as-perimetre .per-bloc").count() == 2, "ce qu'il sait et ce qu'il ne sait pas")
    per = pg.inner_text("#as-perimetre")
    verifie("rendement" in per and "contrat choisir" in per, "les limites sont nommees")

    print("10. Quatre statuts, quatre rendus")

    def demander(q, attente=700):
        pg.fill("#as-input", q)
        pg.press("#as-input", "Enter")
        pg.wait_for_timeout(attente)
        return pg.locator("#as-log .msg").last

    m = demander("combien je peux deduire par an")
    verifie("rep" in m.get_attribute("class") and "perso" not in m.get_attribute("class"), "une reponse")
    verifie(pg.locator("#as-log .srcs").count() >= 1, "elle cite ses sources")
    v = pg.locator("#as-log .msg").last.inner_text().replace(" ", " ").replace(" ", " ")
    verifie("4 500" in v, "le montant vient de la table, pas du texte")

    m = demander("quelle est la meteo demain")
    verifie("hors" in m.get_attribute("class"), "hors perimetre, rendu distinct")
    verifie("je préfère le dire" in m.inner_text(), "l'aveu d'ignorance est explicite")

    m = demander("mon iban est LU280019400644750000 pouvez vous verifier")
    verifie("perso" in m.get_attribute("class"), "donnee personnelle, rendu distinct")
    fil = pg.inner_text("#as-log")
    verifie("LU280019400644750000" not in fil.replace(" ", ""), "la saisie n'est pas repetee dans la reponse")

    print("11. Les idees fausses courantes trouvent leur reponse")
    # Elles viennent d'entretiens : aucun texte officiel ne dement une idee
    # fausse, il enonce la regle sans dire comment on la comprend de travers.
    for q, attendu in [
        ("est ce que l argent est bloque pendant dix ans", "idée fausse"),
        ("puis je recuperer une partie seulement", "en une fois"),
        ("mon conjoint travaille en france peut il en ouvrir un", "déclaration commune"),
        ("quand est ce que je touche le remboursement", "année suivante"),
    ]:
        m = demander(q)
        cl = m.get_attribute("class")
        verifie("rep" in cl and attendu.lower() in m.inner_text().lower(), "« %s » trouve sa reponse" % q)

    print("12. Aucun modele de langue, aucun appel reseau sortant")
    verifie("fetch(" not in lire("site.js") and "XMLHttpRequest" not in lire("site.js"),
            "le site ne fait aucun appel reseau")

    print("13. Aucun montant de loi ecrit hors de la table")
    for f in ["site.js", "questions.js"]:
        durs = re.findall(r'"[^"]*\b(?:4 ?500|3 ?200|1 ?344|6 ?000)\b[^"]*"', lire(f))
        verifie(not durs, "%s ne contient aucun plafond en dur" % f)

    print("14. Une demonstration ne porte aucune donnee d'entreprise")
    # Le repertoire s'est enrichi d'entretiens. Ce qui releve de la
    # connaissance du dispositif est repris, ce qui identifie une maison, un
    # fonds, un tarif ou une performance ne l'est pas.
    tout = " ".join(lire(f) for f in os.listdir(APP)) + \
        io.open(os.path.join(os.path.dirname(APP), "index.html"), encoding="utf-8").read()
    minus = tout.lower()
    for mot in ["capitalatwork", "myfoyer", "lalux", "swisslife", "cardif", "wealins"]:
        verifie(mot not in minus, "aucune mention de « %s »" % mot)
    # « foyer » est aussi un mot courant, « foyer fiscal », « le foyer compte ».
    # Ce qui est interdit, c'est la maison, donc l'emploi comme nom propre.
    verifie(not re.findall(r"(?<![a-zàâçéèêëîïôûùüÿ])Foyer", tout), "« Foyer » n'apparait pas comme nom propre")
    verifie(not re.search(r"\b\d+(?:[.,]\d+)?\s?%\s*(?:de\s+)?(?:rendement|performance|par\s+an\b)", minus),
            "aucun chiffre de rendement annonce")

    print("15. Chaque vue a son adresse")
    for v in ["simulateur", "questions", "assistant"]:
        pg.goto(URL + "#" + v)
        pg.wait_for_timeout(500)
        verifie(pg.locator("#vue-" + v).is_visible(), "#%s s'ouvre par son adresse" % v)

    print("16. Rien ne deborde, sur telephone comme sur bureau")
    for w, h in [(375, 667), (390, 844), (820, 1180), (1400, 900)]:
        pg.set_viewport_size({"width": w, "height": h})
        pg.goto(URL)
        pg.wait_for_timeout(400)
        over = pg.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
        verifie(not over, "%d px sans debordement" % w)

    b.close()

if errs:
    print("\nERREURS JS :")
    for e in set(errs):
        print("  ", e)
print("\n" + ("TOUT PASSE" if not echecs and not errs else "%d ECHEC(S)" % len(echecs)))
sys.exit(1 if echecs or errs else 0)
