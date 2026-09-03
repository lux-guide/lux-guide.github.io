# -*- coding: utf-8 -*-
# Le site epargne-retraite : trois onglets, un panneau, et les regles de fond.
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
    verifie(pg.locator("#tabs button").count() == 3, "trois onglets, l'assistant n'en est plus un")
    verifie(pg.locator("#assistant-btn").count() == 1, "il s'ouvre par un bouton a part")
    verifie(pg.locator("nav.tabs button[data-panel]").count() == 0, "aucune barre du guide d'installation")
    verifie("installation" not in pg.inner_text("header").lower(), "le mot installation n'est pas dans l'en-tete")
    verifie(pg.locator(".lien-guide").count() == 1, "un lien vers le guide, dans le pied")
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

    print("8. C'est le texte d'application qui fait foi, pas un resume")
    # Les pages A a Z de l'administration resument, et le resume laisse croire
    # que le remboursement anticipe est interdit. La circulaire d'application
    # dit l'inverse : il est prevu, integral ou partiel, et impose au tarif
    # normal. Une reponse qui s'arrete au resume se trompe.
    # Les questions sont des <details> replies : innerText ne rend que le
    # resume, il faut lire le texte du noeud.
    fq = pg.eval_on_selector("#q-liste", "e => e.textContent")
    verifie("intégral ou partiel" in fq, "le remboursement anticipe est dit possible")
    verifie("tarif normal" in fq, "et son cout est nomme")
    verifie("Circulaire" in fq, "la circulaire est citee en source")
    verifie("Pas nécessairement" in fq, "la nature du contrat n'est plus donnee pour une assurance vie")
    verifie("établissements de crédit" in fq, "les deux familles de prestataires figurent")

    print("9. L'assistant s'ouvre a cote de la page, pas a sa place")
    pg.set_viewport_size({"width": 1440, "height": 950})
    pg.goto(URL)
    pg.wait_for_timeout(600)
    verifie(not pg.locator("#panneau").is_visible(), "il est ferme au premier chargement")
    pg.click("#assistant-btn")
    pg.wait_for_timeout(500)
    verifie(pg.locator("#panneau").is_visible(), "le bouton l'ouvre")
    verifie(pg.locator("#vue-accueil").is_visible(), "et la vue qu'on lisait reste ouverte")
    # Au-dela de 1180 px, page et volet sont deux colonnes cote a cote. Ce
    # n'est pas cosmetique : pose par-dessus la page, le volet recouvrait sa
    # barre de defilement, collee au bord droit de la fenetre, et l'on
    # defilait a l'aveugle derriere lui.
    d = pg.evaluate("""() => {
      const p = document.querySelector('#page'), a = document.querySelector('#panneau');
      const rp = p.getBoundingClientRect(), ra = a.getBoundingClientRect();
      return {
        colle: Math.round(ra.left - rp.right),
        barre: Math.round(p.offsetWidth - p.clientWidth),
        colonne_defile: p.scrollHeight > p.clientHeight + 1,
        corps_defile: document.body.scrollHeight > innerHeight + 1,
        pleine_hauteur: Math.round(ra.height) === Math.round(innerHeight)
      };
    }""")
    verifie(abs(d["colle"]) <= 1, "page et volet se touchent sans se recouvrir")
    verifie(d["pleine_hauteur"], "le volet fait toute la hauteur")
    # La barre de defilement appartient a la colonne de page. Elle tombe donc
    # a la droite de celle-ci, c'est-a-dire juste a gauche du volet, et reste
    # visible au lieu de passer dessous.
    verifie(d["barre"] > 0, "la colonne de page porte sa propre barre (%d px)" % d["barre"])
    verifie(d["colonne_defile"] and not d["corps_defile"],
            "c'est elle qui defile, plus la fenetre")
    verifie(not pg.locator("#voile").is_visible(), "et rien n'est assombri, puisque rien n'est masque")
    imbrique = pg.evaluate("""() => {
      const log = document.querySelector('#as-log');
      const s = getComputedStyle(log);
      return s.overflowY === 'auto' || s.overflowY === 'scroll';
    }""")
    verifie(not imbrique, "la conversation ne defile pas dans son propre cadre")
    verifie(pg.locator("#as-perimetre .per-bloc").count() == 2, "ce qu'il sait et ce qu'il ne sait pas")
    per = pg.eval_on_selector("#as-perimetre", "e => e.textContent")
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
    for v in ["simulateur", "questions"]:
        pg.goto(URL + "#" + v)
        pg.wait_for_timeout(500)
        verifie(pg.locator("#vue-" + v).is_visible(), "#%s s'ouvre par son adresse" % v)
    # L'assistant n'est plus une vue, mais son adresse reste valable.
    pg.goto(URL + "#assistant")
    pg.wait_for_timeout(600)
    verifie(pg.locator("#panneau").is_visible(), "#assistant ouvre le panneau")

    print("16. Rien ne deborde, sur telephone comme sur bureau")
    # Les graphiques font 720 de large : c'est la vue qui les porte qu'il faut
    # eprouver, pas seulement l'accueil.
    for w, h in [(375, 667), (390, 844), (820, 1180), (1400, 900)]:
        for vue in ["", "#simulateur"]:
            pg.set_viewport_size({"width": w, "height": h})
            pg.goto(URL + vue)
            pg.wait_for_timeout(450)
            over = pg.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
            verifie(not over, "%d px %s sans debordement" % (w, vue or "#accueil"))

    print("17. Les champs tombent a la meme hauteur")
    # Un input et un select ne se mesurent pas pareil : le select suit les
    # metriques du systeme, l'input celles de la police. Avec le meme padding
    # ils ne tombent pas a la meme hauteur, et cela se voit des qu'ils sont
    # cote a cote. Le defaut se mesure, il ne se juge pas a l'oeil.
    pg.set_viewport_size({"width": 1280, "height": 900})
    pg.goto(URL + "#simulateur")
    pg.wait_for_timeout(700)
    m = pg.evaluate("""() => {
      const b = s => document.querySelector(s).getBoundingClientRect();
      const a = b('#ch-age'), e = b('#ch-enfants');
      const ch = getComputedStyle(document.querySelector('.champ-sel'), '::after');
      return { dh: Math.abs(a.height - e.height), dy: Math.abs(a.top - e.top),
               chevron: ch.content !== 'none' && ch.width !== 'auto' };
    }""")
    verifie(m["dh"] < 0.5, "meme hauteur (ecart %.2f px)" % m["dh"])
    verifie(m["dy"] < 0.5, "meme ligne de base (ecart %.2f px)" % m["dy"])
    verifie(m["chevron"], "le chevron du select est bien redessine")

    print("17b. Un seul theme, et des icones tracees et non ecrites")
    # Le site n'a plus de selecteur de theme : une seule palette, batie pour le
    # blanc. Et les icones sont des SVG du jeu, pas des caracteres : un glyphe
    # ne se colore pas, ne s'aligne pas et ne rend pas la meme chose partout.
    pg.goto(URL)
    pg.wait_for_timeout(500)
    verifie(pg.locator("#theme-btn").count() == 0, "aucun selecteur de theme")
    verifie(pg.locator("nav.tabs button .ic").count() == 3, "chaque onglet porte son icone")
    verifie(pg.locator(".etapes .etape-ic .ic").count() == 4, "chacun des quatre moments porte la sienne")
    verifie(pg.locator(".qcard-ic .ic").count() >= 3, "et chacune des trois conditions")
    glyphes = pg.evaluate("""() => {
      const t = document.body.innerText;
      return [...new Set([...t].filter(c => /[\\u2190-\\u21FF\\u2600-\\u27BF\\u2B00-\\u2BFF\\uFE0F]/.test(c)))];
    }""")
    verifie(not glyphes, "aucun caractere-image dans le texte rendu %s" % (glyphes or ""))

    print("17c. Le pied porte les sources, et elles ne sont pas ecrites a la main")
    # Une liste de sources recopiee finit par mentir le jour ou une source
    # change. Celle du pied est construite depuis les sources que le
    # repertoire cite reellement.
    citees = pg.evaluate("""() => {
      const u = new Set();
      window.QUESTIONS.entrees.forEach(e => (e.sources || []).forEach(s => u.add(s.u)));
      return [...u];
    }""")
    liens = pg.eval_on_selector_all("#pied-sources a", "e => e.map(x => x.href)")
    verifie(sorted(liens) == sorted(citees),
            "le pied liste exactement les %d sources citees" % len(citees))
    verifie(pg.locator(".pied-plus").count() == 0, "aucun accordeon pour trois lignes de mentions")
    verifie(pg.locator(".pied-bas").count() == 1, "la mention legale tient en un paragraphe")

    print("18. Le texte se lit, mesure et non juge a l'oeil")
    # Un gris trop clair passe l'inspection visuelle et rate la mesure. Celui
    # de la charte, #67768e, rendait 4.38 sur le fond de page : sous le seuil.
    CONTRASTE = """() => {
      const pot = document.createElement('canvas').getContext('2d');
      const lum = c => {
        pot.fillStyle = '#000'; pot.fillStyle = c;
        const h = pot.fillStyle;
        let r, g, b;
        if (h[0] === '#') { r = parseInt(h.slice(1,3),16); g = parseInt(h.slice(3,5),16); b = parseInt(h.slice(5,7),16); }
        else if (h.startsWith('color(')) { [r,g,b] = h.match(/[\\d.]+/g).slice(0,3).map(v => v*255); }
        else { [r,g,b] = h.match(/[\\d.]+/g).slice(0,3).map(Number); }
        const f = v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
        return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b);
      };
      const lisible = c => {
        if (!c || c === 'transparent' || c === 'rgba(0, 0, 0, 0)') return null;
        pot.fillStyle = '#123456'; pot.fillStyle = c;
        return pot.fillStyle === '#123456' ? null : c;
      };
      const fond = e => {
        let n = e;
        while (n && n !== document.documentElement) {
          const bg = lisible(getComputedStyle(n).backgroundColor);
          if (bg) return bg;
          n = n.parentElement;
        }
        return getComputedStyle(document.body).backgroundColor;
      };
      const out = [];
      document.querySelectorAll('p,li,td,th,label,a,button,summary,h1,h2,h3,.sous,.micro').forEach(e => {
        if (!e.offsetParent || !(e.innerText || '').trim()) return;
        const s = getComputedStyle(e);
        const c = (lum(s.color) + 0.05) / (lum(fond(e)) + 0.05);
        const ratio = c > 1 ? c : 1 / c;
        const t = parseFloat(s.fontSize);
        const seuil = (t >= 24 || (t >= 18.66 && parseInt(s.fontWeight) >= 700)) ? 3 : 4.5;
        if (ratio < seuil) out.push(ratio.toFixed(2) + ' < ' + seuil + '  ' + t + 'px  « ' +
          e.innerText.trim().slice(0, 34) + ' »');
      });
      return [...new Set(out)];
    }"""
    for vue in ["", "#simulateur", "#questions"]:
        pg.goto(URL + vue)
        pg.wait_for_timeout(600)
        mauvais = pg.evaluate(CONTRASTE)
        for x in mauvais:
            print("     ", x)
        verifie(not mauvais, "%s : tout le texte passe le seuil de contraste" % (vue or "#accueil"))

    print("19. Les graphiques disent la meme chose que les tableaux")
    pg.set_viewport_size({"width": 1280, "height": 900})
    pg.goto(URL + "#simulateur")
    pg.wait_for_timeout(800)
    verifie(pg.locator(".graphe").count() == 2, "deux graphiques")
    verifie(pg.locator(".graphe rect").count() == 4, "une barre par taux")
    verifie(pg.locator(".graphe path").count() == 4, "une courbe par taux")
    # Un graphique trace sans librairie doit encore etre un bon graphique : un
    # axe monte au palier rond superieur, jamais tres au-dela, faute de quoi la
    # plus haute barre reste a mi-hauteur et la comparaison ne se voit plus.
    ech = pg.evaluate("""() => {
      const b = document.querySelectorAll('.graphe-bloc')[0];
      const nb = s => Number(s.replace(/[^0-9]/g, ''));
      const axe = [...b.querySelectorAll('.g-lab-y')].map(e => nb(e.textContent));
      const val = [...b.querySelectorAll('.g-val')].map(e => nb(e.textContent));
      return { haut: Math.max(...axe), max: Math.max(...val) };
    }""")
    verifie(ech["haut"] >= ech["max"], "l'axe contient la plus haute valeur")
    verifie(ech["haut"] < ech["max"] * 1.5,
            "et ne la depasse pas de moitie (axe %d, valeur %d)" % (ech["haut"], ech["max"]))
    # Le SVG est marque aria-hidden : c'est le tableau qui suit qui porte
    # l'information pour un lecteur d'ecran, et la decrire deux fois la
    # ferait lire deux fois.
    verifie(pg.eval_on_selector_all(".graphe", "e => e.every(x => x.getAttribute('aria-hidden') === 'true')"),
            "les graphiques ne sont pas lus deux fois par un lecteur d'ecran")
    verifie(pg.locator("#sim-resultat table").count() >= 2, "les memes chiffres restent en tableau")

    print("19b. Le panneau se comporte comme un volet, pas comme une boite")
    pg.set_viewport_size({"width": 1440, "height": 900})
    pg.goto(URL)
    pg.wait_for_timeout(600)
    # Le panneau retient son etat d'une visite a l'autre : il faut le refermer
    # avant de verifier que le bouton l'ouvre, sans quoi le clic le ferme.
    pg.evaluate("""() => {
      localStorage.removeItem('prevoyance.panneau.largeur.v1');
      localStorage.setItem('prevoyance.panneau.v1', '0');
    }""")
    pg.reload()
    pg.wait_for_timeout(600)
    verifie(not pg.locator("#panneau").is_visible(), "ferme, il reste ferme au rechargement")
    pg.click("#assistant-btn")
    pg.wait_for_timeout(500)
    m = pg.evaluate("""() => {
      const p = document.querySelector('#panneau').getBoundingClientRect();
      return { haut: Math.round(p.top), bas: Math.round(innerHeight - p.bottom), large: Math.round(p.width) };
    }""")
    verifie(m["haut"] == 0 and m["bas"] == 0, "il va du haut au bas de l'ecran")
    # L'en-tete se decale avec le reste : sans cela le panneau monte par-dessus
    # lui et recouvre le bouton qui l'a ouvert, qu'on ne retrouve plus.
    bouton = pg.evaluate("""() => {
      const b = document.querySelector('#assistant-btn').getBoundingClientRect();
      const p = document.querySelector('#panneau').getBoundingClientRect();
      return b.right <= p.left + 1;
    }""")
    verifie(bouton, "et ne recouvre pas le bouton qui l'a ouvert")

    # La largeur se regle a la souris et se retient.
    poi = pg.locator("#pan-poignee").bounding_box()
    pg.mouse.move(poi["x"] + 5, poi["y"] + 400)
    pg.mouse.down()
    pg.mouse.move(poi["x"] - 150, poi["y"] + 400, steps=8)
    pg.mouse.up()
    pg.wait_for_timeout(400)
    large2 = pg.evaluate("Math.round(document.querySelector('#panneau').getBoundingClientRect().width)")
    verifie(large2 > m["large"] + 100, "la poignee l'elargit (%d puis %d px)" % (m["large"], large2))
    colle = pg.evaluate("""() => {
      const p = document.querySelector('#page').getBoundingClientRect();
      const a = document.querySelector('#panneau').getBoundingClientRect();
      return Math.round(a.left - p.right);
    }""")
    verifie(abs(colle) <= 1, "et la colonne de page se retrecit d'autant")
    pg.reload()
    pg.wait_for_timeout(700)
    verifie(pg.evaluate("Math.round(document.querySelector('#panneau').getBoundingClientRect().width)") == large2,
            "la largeur est retenue d'une visite a l'autre")

    print("19c. La conversation descend toute seule")
    # Depuis que le panneau porte le defilement, defiler #as-log ne fait plus
    # rien : c'est #pan-corps qu'il faut suivre. Le defaut ne se voit qu'avec
    # assez de messages pour depasser la hauteur.
    for q in ["combien je peux deduire", "un frontalier y a t il droit",
              "quand puis je recuperer", "comment declarer les versements",
              "sur quoi l argent est place", "puis je reporter"]:
        pg.fill("#as-input", q)
        pg.press("#as-input", "Enter")
        pg.wait_for_timeout(350)
    z = pg.evaluate("""() => {
      const z = document.querySelector('#pan-corps');
      return { reste: Math.round(z.scrollHeight - z.scrollTop - z.clientHeight),
               depasse: z.scrollHeight > z.clientHeight + 40 };
    }""")
    verifie(z["depasse"], "la conversation depasse la hauteur du panneau")
    verifie(z["reste"] < 8, "et reste collee au dernier message (%d px)" % z["reste"])
    pg.evaluate("document.querySelector('#pan-corps').scrollTop = 0")
    pg.wait_for_timeout(350)
    verifie(pg.locator("#pan-bas").is_visible(), "remonter fait apparaitre le retour au dernier message")
    pg.click("#pan-bas")
    pg.wait_for_timeout(700)
    verifie(not pg.locator("#pan-bas").is_visible(), "et il disparait une fois revenu")

    print("19d. La saisie et la remise a zero")
    pg.click("#pan-vider")
    pg.wait_for_timeout(400)
    verifie(pg.locator("#as-log .msg.moi").count() == 0, "la remise a zero efface les questions")
    verifie(pg.locator("#pan-debut").is_visible(), "et remontre ce que l'assistant sait")
    verifie(pg.locator("#pan-vider").is_disabled(), "puis se grise, n'ayant plus rien a effacer")
    # Un bouton actif qui ne fait rien apprend a ne plus lui faire confiance.
    verifie(pg.locator("#as-envoyer").is_disabled(), "le bouton d'envoi attend qu'il y ait une question")
    pg.fill("#as-input", "combien")
    pg.wait_for_timeout(200)
    verifie(not pg.locator("#as-envoyer").is_disabled(), "et s'allume des qu'on ecrit")
    # Maj+Entree passe a la ligne, comme dans n'importe quelle messagerie.
    pg.press("#as-input", "Shift+Enter")
    pg.wait_for_timeout(250)
    verifie(pg.locator("#as-log .msg.moi").count() == 0, "Maj+Entree n'envoie pas")
    pg.fill("#as-input", "une ligne")
    pg.wait_for_timeout(250)
    h1 = pg.evaluate("document.querySelector('#as-input').getBoundingClientRect().height")
    pg.fill("#as-input", "une question\nqui tient\nsur trois lignes")
    pg.wait_for_timeout(250)
    h2 = pg.evaluate("document.querySelector('#as-input').getBoundingClientRect().height")
    verifie(h2 > h1, "la saisie grandit avec la question (%d puis %d px)" % (h1, h2))

    print("19e. Le bouton de l'assistant, sans texte et nomme quand meme")
    # Une icone seule n'est comprise que si elle porte son nom autrement : un
    # bouton muet pour la souris comme pour un lecteur d'ecran n'est pas un
    # bouton, c'est une devinette.
    pg.goto(URL)
    pg.wait_for_timeout(500)
    bt = pg.locator("#assistant-btn")
    verifie(bt.inner_text().strip() == "", "il ne porte aucun texte visible")
    verifie((bt.get_attribute("aria-label") or "").strip() != "", "mais il a un nom accessible")
    verifie((bt.get_attribute("title") or "").strip() != "", "et une infobulle a la souris")
    verifie(bt.get_attribute("aria-expanded") in ("true", "false"), "il annonce s'il est ouvert")
    # Les etincelles sont ecrites en clair dans le bouton : ce qu'un <use>
    # instancie vit dans un arbre fantome, ou une regle de la page ne peut pas
    # entrer pour en animer une a la fois.
    verifie(pg.locator("#assistant-btn .ic-ia .et").count() == 2, "deux etincelles, tracees dans le bouton")
    anim = pg.evaluate("""() => {
      const e = document.querySelector('#assistant-btn .et-1');
      return getComputedStyle(e).transformBox === 'fill-box';
    }""")
    verifie(anim, "chacune tourne autour de son propre centre")

    print("20. L'assistant renvoie a l'endroit exact de la page")
    # Une reponse gagne a montrer d'ou elle vient. Le bouton ouvre la bonne
    # vue, y defile et surligne l'element, le temps de le trouver.
    pg.set_viewport_size({"width": 1440, "height": 950})
    pg.goto(URL + "#assistant")
    pg.wait_for_timeout(700)

    def demander_pan(q):
        pg.fill("#as-input", q)
        pg.press("#as-input", "Enter")
        pg.wait_for_timeout(700)

    for q, vue, ancre in [
        ("un frontalier y a t il droit", "accueil", "condition-1"),
        ("combien ca me rapporte selon mon taux", "simulateur", "graphe-taux"),
        ("l argent est il bloque dix ans", "accueil", "condition-2"),
    ]:
        demander_pan(q)
        vise = pg.locator("#as-log .chip.vise").last
        verifie(vise.count() > 0, "« %s » propose de voir sur la page" % q)
        vise.click()
        pg.wait_for_timeout(900)
        ouverte = pg.evaluate("[...document.querySelectorAll('.vue')].filter(v => !v.hidden).map(v => v.id)")
        verifie(ouverte == ["vue-" + vue], "elle ouvre %s" % vue)
        marque = pg.eval_on_selector_all(".surligne", "e => e.map(x => x.getAttribute('data-ancre'))")
        verifie(marque == [ancre], "et surligne %s, un seul element" % ancre)
        # Le panneau ne s'est pas ferme : on lit la reponse et l'endroit
        # qu'elle designe en meme temps.
        verifie(pg.locator("#panneau").is_visible(), "sans fermer le panneau")

    b.close()

if errs:
    print("\nERREURS JS :")
    for e in set(errs):
        print("  ", e)
print("\n" + ("TOUT PASSE" if not echecs and not errs else "%d ECHEC(S)" % len(echecs)))
sys.exit(1 if echecs or errs else 0)
