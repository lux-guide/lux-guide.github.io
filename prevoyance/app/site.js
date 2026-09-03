// Site épargne-retraite : rendu des quatre vues.
//
// Aucun montant de loi n'est ecrit ici. Tout vient de window.PREVOYANCE.table,
// et les textes du repertoire portent des marques remplies au rendu.

(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined && txt !== null) e.textContent = txt;
    return e;
  }

  function eur(n) {
    return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n)) + " €";
  }

  function doux() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto" : "smooth";
  }

  var T = window.PREVOYANCE.table;
  var Q = window.QUESTIONS;

  // ---------- Les marques ----------
  // Un texte du repertoire ne contient jamais de montant : il porte {plafond},
  // {annee}... et c'est ici, et seulement ici, que la table les remplit.

  var MARQUES = {
    plafond: eur(T.prevoyance.plafond),
    plafondPrecedent: eur(T.prevoyance.plafondPrecedent),
    annee: String(T.annee),
    anneePrecedente: String(T.anneePrecedente),
    duree: String(T.prevoyance.dureeMinimaleAns),
    ageMax: String(T.prevoyance.ageMaxSouscription),
    sortieMin: String(T.prevoyance.sortieMin),
    sortieMax: String(T.prevoyance.sortieMax)
  };

  function remplir(texte) {
    return String(texte || "").replace(/\{(\w+)\}/g, function (tout, cle) {
      return MARQUES[cle] !== undefined ? MARQUES[cle] : tout;
    });
  }

  // ---------- Navigation ----------

  var VUES = ["accueil", "simulateur", "questions", "assistant"];

  function majDefilement() {
    var n = $("#tabs");
    if (!n) return;
    var reste = n.scrollWidth - n.clientWidth;
    if (reste <= 2) { n.removeAttribute("data-defile"); return; }
    var g = n.scrollLeft > 2, d = n.scrollLeft < reste - 2;
    n.setAttribute("data-defile", g && d ? "deux" : (g ? "gauche" : "droite"));
  }

  function ouvrir(nom, sansHash) {
    if (VUES.indexOf(nom) === -1) nom = "accueil";
    $$("#tabs button").forEach(function (b) {
      var actif = b.dataset.vue === nom;
      b.setAttribute("aria-selected", String(actif));
      b.tabIndex = actif ? 0 : -1;
      if (actif && b.scrollIntoView) b.scrollIntoView({ block: "nearest", inline: "nearest", behavior: doux() });
    });
    VUES.forEach(function (v) {
      var z = $("#vue-" + v);
      if (z) z.hidden = v !== nom;
    });
    if (!sansHash && window.location.hash !== "#" + nom) {
      try { history.pushState(null, "", "#" + nom); } catch (e) { /* file:// */ }
    }
    if (nom === "questions") rendreQuestions();
    if (nom === "assistant") demarrerAssistant();
    window.scrollTo(0, 0);
    setTimeout(majDefilement, 320);
  }

  function initNav() {
    $$("#tabs button").forEach(function (b) {
      b.addEventListener("click", function () { ouvrir(b.dataset.vue); });
    });
    $$("[data-aller]").forEach(function (b) {
      b.addEventListener("click", function () { ouvrir(b.dataset.aller); });
    });
    var m = $("#brand");
    if (m) m.addEventListener("click", function () { ouvrir("accueil"); });

    var n = $("#tabs");
    n.addEventListener("scroll", majDefilement, { passive: true });
    window.addEventListener("resize", majDefilement);
    // role=tablist est une promesse : les fleches doivent circuler.
    n.addEventListener("keydown", function (e) {
      var t = $$("#tabs button"), i = t.indexOf(document.activeElement);
      if (i === -1) return;
      var j = null;
      if (e.key === "ArrowRight") j = (i + 1) % t.length;
      else if (e.key === "ArrowLeft") j = (i - 1 + t.length) % t.length;
      else if (e.key === "Home") j = 0;
      else if (e.key === "End") j = t.length - 1;
      if (j === null) return;
      e.preventDefault();
      ouvrir(t[j].dataset.vue);
      t[j].focus();
    });
    majDefilement();
  }

  // ---------- Les icones ----------
  // Le trace vit dans le sprite de index.html. Ici on ne pose qu'une
  // reference : une icone affichee cent fois reste un seul trace en memoire.

  function icone(nom, cls) {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("class", "ic" + (cls ? " " + cls : ""));
    s.setAttribute("aria-hidden", "true");
    s.setAttribute("focusable", "false");
    var u = document.createElementNS("http://www.w3.org/2000/svg", "use");
    u.setAttribute("href", "#i-" + nom);
    s.appendChild(u);
    return s;
  }

  // ---------- Les graphiques ----------
  //
  // Traces a la main en SVG, depuis les memes donnees que les tableaux qui les
  // suivent. Trois raisons de ne pas charger une librairie : elle pesterait
  // cent fois le poids de ce code pour quatre series, elle imposerait sa
  // palette et ses polices contre celles du site, et elle rendrait du canvas,
  // qu'on ne peut ni selectionner ni relire a la loupe.
  //
  // Chaque graphique est accompagne du tableau des memes chiffres. C'est lui
  // qui porte l'information pour un lecteur d'ecran : le SVG est donc marque
  // aria-hidden plutot que decrit deux fois.

  var SVGNS = "http://www.w3.org/2000/svg";

  function n(nom, attrs, texte) {
    var e = document.createElementNS(SVGNS, nom);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) e.setAttribute(k, String(attrs[k]));
    if (texte !== undefined) e.textContent = texte;
    return e;
  }

  // Une echelle sequentielle tiree de la charte, du plus clair au plus fonce :
  // le taux le plus eleve porte la couleur la plus dense, ce qui se lit sans
  // legende.
  var TEINTES = ["#a9bce9", "#7c9ade", "#2957c8", "#041d58"];

  // Un axe qui monte jusqu'au maximum exact donne des graduations illisibles
  // (3 217, 6 434...). On arrondit vers le haut au pas rond superieur.
  function plafondRond(v) {
    if (v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10));
    // Une echelle a quatre paliers laisse la plus haute barre a mi-hauteur : sur
    // 2 737, elle monte l'axe a 5 000. Des paliers plus serres collent au
    // chiffre sans donner de graduations illisibles.
    var pas = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
    for (var i = 0; i < pas.length; i++) {
      if (v <= pas[i] * p) return pas[i] * p;
    }
    return 10 * p;
  }

  function grapheBarres(valeurs, libelles) {
    var L = 720, H = 250, mg = 60, mb = 34, mh = 26;
    var s = n("svg", { viewBox: "0 0 " + L + " " + H, class: "graphe",
                       preserveAspectRatio: "xMidYMid meet", "aria-hidden": "true", focusable: "false" });
    var max = plafondRond(Math.max.apply(null, valeurs));
    var y = function (v) { return mh + (H - mh - mb) * (1 - v / max); };

    for (var g = 0; g <= 4; g++) {
      var v = max * g / 4;
      s.appendChild(n("line", { x1: mg, x2: L - 8, y1: y(v), y2: y(v), class: "g-grille" }));
      s.appendChild(n("text", { x: mg - 10, y: y(v) + 4, class: "g-lab g-lab-y" }, eur(v)));
    }

    var large = (L - mg - 8) / valeurs.length;
    valeurs.forEach(function (v, i) {
      var l = Math.min(74, large * 0.5);
      var x = mg + large * i + (large - l) / 2;
      s.appendChild(n("rect", { x: x, y: y(v), width: l, height: Math.max(1, y(0) - y(v)),
                                rx: 3, fill: TEINTES[i % TEINTES.length] }));
      s.appendChild(n("text", { x: x + l / 2, y: y(v) - 9, class: "g-lab g-val" }, eur(v)));
      s.appendChild(n("text", { x: x + l / 2, y: H - 11, class: "g-lab" }, libelles[i]));
    });
    s.appendChild(n("line", { x1: mg, x2: L - 8, y1: y(0), y2: y(0), class: "g-axe" }));
    return s;
  }

  function grapheCourbes(series, libelles, ans) {
    var L = 720, H = 270, mg = 66, mb = 34, mh = 22, md = 56;
    var s = n("svg", { viewBox: "0 0 " + L + " " + H, class: "graphe",
                       preserveAspectRatio: "xMidYMid meet", "aria-hidden": "true", focusable: "false" });
    var tout = [];
    series.forEach(function (se) { tout = tout.concat(se); });
    var max = plafondRond(Math.max.apply(null, tout));
    var x = function (i) { return mg + (L - mg - md) * (i / (ans - 1)); };
    var y = function (v) { return mh + (H - mh - mb) * (1 - v / max); };

    for (var g = 0; g <= 4; g++) {
      var v = max * g / 4;
      s.appendChild(n("line", { x1: mg, x2: L - md, y1: y(v), y2: y(v), class: "g-grille" }));
      s.appendChild(n("text", { x: mg - 10, y: y(v) + 4, class: "g-lab g-lab-y" }, eur(v)));
    }
    [0, Math.floor((ans - 1) / 2), ans - 1].forEach(function (i) {
      s.appendChild(n("text", { x: x(i), y: H - 11, class: "g-lab" }, "an " + (i + 1)));
    });

    series.forEach(function (se, k) {
      var d = se.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1); }).join(" ");
      s.appendChild(n("path", { d: d, fill: "none", stroke: TEINTES[k % TEINTES.length],
                                "stroke-width": 2.4, "stroke-linecap": "round", "stroke-linejoin": "round" }));
      var fin = se[se.length - 1];
      s.appendChild(n("circle", { cx: x(ans - 1), cy: y(fin), r: 3.4, fill: TEINTES[k % TEINTES.length] }));
      // L'etiquette reste dans la couleur du texte : la teinte la plus claire
      // de l'echelle rend 1.9 sur blanc, illisible des qu'elle sert a ecrire.
      // C'est le point qui relie la ligne a son etiquette, pas la couleur des
      // lettres.
      s.appendChild(n("text", { x: L - md + 9, y: y(fin) + 4, class: "g-lab g-fin" }, libelles[k]));
    });
    s.appendChild(n("line", { x1: mg, x2: L - md, y1: y(0), y2: y(0), class: "g-axe" }));
    return s;
  }

  function bloc(titre, legende, svg) {
    var d = el("div", "graphe-bloc");
    d.appendChild(el("div", "graphe-titre", titre));
    d.appendChild(svg);
    if (legende) d.appendChild(el("p", "graphe-note", legende));
    return d;
  }

  // ---------- Le plafond comme un mouvement ----------

  function blocMouvement() {
    var p = T.prevoyance;
    var c = el("div", "mouvement");
    var g = el("div", "mvt-chiffres");
    function bloc(cls, lab, val) {
      var d = el("div", cls);
      d.appendChild(el("span", "mvt-lab", lab));
      d.appendChild(el("span", "mvt-val", val));
      return d;
    }
    g.appendChild(bloc("mvt-av", "En " + T.anneePrecedente, eur(p.plafondPrecedent)));
    var fl = el("span", "mvt-fleche");
    fl.appendChild(icone("fleche"));
    g.appendChild(fl);
    g.appendChild(bloc("mvt-ap", "Depuis " + T.annee, eur(p.plafond)));
    g.appendChild(bloc("mvt-delta", "Soit", "+ " + eur(p.plafond - p.plafondPrecedent)));
    c.appendChild(g);
    c.appendChild(el("p", null,
      "Le plafond déductible a été relevé au 1er janvier " + T.annee + ". C'est le montant que " +
      "vous pouvez sortir de votre revenu imposable chaque année, par personne."));
    return c;
  }

  // ---------- Le simulateur ----------

  var entree = null;

  function casParDefaut() {
    var c = window.PREVOYANCE.cas[0];
    return { id: c.id, age: c.e.age, enfants: c.e.enfants, pret: c.e.pret, imposeLuxembourg: c.e.imposeLuxembourg };
  }

  function rendreCas(zone) {
    var z = $(zone);
    if (!z) return;
    z.innerHTML = "";
    window.PREVOYANCE.cas.forEach(function (c) {
      var actif = entree && entree.id === c.id;
      var b = el("button", "chip" + (actif ? " actif" : ""), c.titre);
      b.setAttribute("aria-pressed", String(!!actif));
      b.addEventListener("click", function () {
        entree = { id: c.id, age: c.e.age, enfants: c.e.enfants, pret: c.e.pret, imposeLuxembourg: c.e.imposeLuxembourg };
        rendreSimulateur();
        rendreApercu();
      });
      z.appendChild(b);
    });
  }

  function rendreChamps() {
    var z = $("#sim-champs");
    if (!z) return;
    z.innerHTML = "";

    var da = el("div");
    da.appendChild(el("label", null, "Votre âge"));
    var ia = el("input");
    ia.type = "number"; ia.min = String(T.bornes.ageMin); ia.max = String(T.bornes.ageMax);
    ia.value = String(entree.age);
    ia.id = "ch-age";
    ia.addEventListener("input", function () {
      entree.age = Number(ia.value) || entree.age; entree.id = null;
      rendreSimulateur(true); rendreApercu();
    });
    da.appendChild(ia); z.appendChild(da);

    var de = el("div", "champ-sel");
    de.appendChild(el("label", null, "Enfants à charge"));
    var se = el("select");
    se.id = "ch-enfants";
    for (var n = 0; n <= T.bornes.enfantsMax; n++) {
      var o = el("option", null, String(n));
      o.value = String(n);
      if (n === entree.enfants) o.selected = true;
      se.appendChild(o);
    }
    se.addEventListener("change", function () {
      entree.enfants = Number(se.value) || 0; entree.id = null;
      rendreSimulateur(true); rendreApercu();
    });
    de.appendChild(se); z.appendChild(de);

    [["pret", "Un prêt immobilier en cours"], ["imposeLuxembourg", "Imposé au Luxembourg"]].forEach(function (c) {
      var d = el("div", "check");
      var i = el("input");
      i.type = "checkbox"; i.id = "ch-" + c[0]; i.checked = !!entree[c[0]];
      i.addEventListener("change", function () {
        entree[c[0]] = i.checked; entree.id = null;
        rendreSimulateur(true); rendreApercu();
      });
      var l = el("label", null, c[1]);
      l.setAttribute("for", i.id);
      d.appendChild(i); d.appendChild(l);
      z.appendChild(d);
    });
  }

  function tableauResultat(r, compact) {
    var f = document.createDocumentFragment();

    // Le cas qui rend zero ne dessine rien : ni tableau, ni indicateur. Un
    // tableau sans montants laisse croire a un defaut d'affichage.
    if (r.refus.length && !r.lignes.length) {
      var n = el("div", "notice");
      n.appendChild(el("strong", null, "Aucune déduction ouverte. "));
      r.refus.forEach(function (m) { n.appendChild(document.createTextNode(m + " ")); });
      f.appendChild(n);
      return f;
    }

    var k = el("div", "kpis");
    [["Déductible chaque année", eur(r.totalAnnuel)],
     ["Déductible une seule fois", eur(r.totalPonctuel)]].forEach(function (x) {
      var d = el("div", "kpi");
      d.appendChild(el("div", "k", x[0]));
      d.appendChild(el("div", "v", x[1]));
      k.appendChild(d);
    });
    f.appendChild(k);
    f.appendChild(el("p", "hint",
      "Ces deux montants ne s'additionnent pas. Le premier revient chaque année, le second se " +
      "déduit une seule fois."));

    if (compact) return f;

    var w = el("div", "table-wrap"), t = el("table");
    var th = el("thead"), tr0 = el("tr");
    ["Levier", "Plafond", "Rythme", "Comment ce montant est obtenu"].forEach(function (c, i) {
      tr0.appendChild(el("th", i === 1 ? "num" : null, c));
    });
    th.appendChild(tr0); t.appendChild(th);
    var tb = el("tbody");
    r.lignes.forEach(function (l) {
      var tr = el("tr");
      var td = el("td");
      td.appendChild(el("strong", null, l.nom));
      td.appendChild(el("span", "sous", l.condition));
      if (l.reserve) td.appendChild(el("span", "sous reserve", l.reserve));
      tr.appendChild(td);
      tr.appendChild(el("td", "num", eur(l.plafond)));
      tr.appendChild(el("td", null, l.annuel ? "chaque année" : "une seule fois"));
      tr.appendChild(el("td", "calcul", l.calcul));
      tb.appendChild(tr);
    });
    t.appendChild(tb); w.appendChild(t); f.appendChild(w);

    f.appendChild(el("h2", null, "Ce que cela vous rend, selon votre taux"));
    f.appendChild(el("p", "hint",
      "Votre taux dépend de votre revenu et de votre classe d'impôt. Ce site ne le devine pas : " +
      "situez-vous dans la colonne qui vous correspond."));

    var libTaux = T.taux.map(function (x) { return Math.round(x * 100) + " %"; });
    var valAn = T.taux.map(function (x) {
      return r.economieAnnuelleParTaux[String(Math.round(x * 100))] || 0;
    });
    f.appendChild(bloc("Économie d'impôt chaque année",
      "Le même versement ne rend pas la même chose à tout le monde : c'est le taux qui décide.",
      grapheBarres(valAn, libTaux)));

    var series = T.taux.map(function (x) {
      return r.serieCumulParTaux[String(Math.round(x * 100))] || [];
    }).filter(function (s) { return s.length; });
    if (series.length) {
      f.appendChild(bloc("Ce que cela cumule sur " + T.horizonAns + " ans",
        "À versement constant et à taux constant. Ni rendement ni revalorisation : ce graphique " +
        "n'additionne que des économies d'impôt.",
        grapheCourbes(series, libTaux, T.horizonAns)));
    }

    var w2 = el("div", "table-wrap"), t2 = el("table");
    var th2 = el("thead"), tr1 = el("tr");
    tr1.appendChild(el("th", null, "Taux d'imposition"));
    T.taux.forEach(function (x) { tr1.appendChild(el("th", "num", Math.round(x * 100) + " %")); });
    th2.appendChild(tr1); t2.appendChild(th2);
    var tb2 = el("tbody");
    [["Économie chaque année", r.economieAnnuelleParTaux],
     ["Économie une seule fois", r.economiePonctuelleParTaux],
     ["Ce qu'il vous reste à sortir par an", r.effortAnnuelParTaux]].forEach(function (l) {
      var tr = el("tr");
      tr.appendChild(el("td", null, l[0]));
      T.taux.forEach(function (x) {
        var v = l[1][String(Math.round(x * 100))];
        tr.appendChild(el("td", "num", v === undefined ? "—" : eur(v)));
      });
      tb2.appendChild(tr);
    });
    var trc = el("tr", "total");
    trc.appendChild(el("td", null, "Cumul sur " + T.horizonAns + " ans"));
    T.taux.forEach(function (x) {
      var s = r.serieCumulParTaux[String(Math.round(x * 100))];
      trc.appendChild(el("td", "num", s ? eur(s[s.length - 1]) : "—"));
    });
    tb2.appendChild(trc);
    t2.appendChild(tb2); w2.appendChild(t2); f.appendChild(w2);

    if (r.pistes.length) {
      f.appendChild(el("h2", null, "Ce qui pourrait s'y ajouter"));
      var ul = el("ul");
      r.pistes.forEach(function (p) {
        var li = el("li");
        li.appendChild(el("strong", null, p.nom));
        li.appendChild(document.createTextNode(", " + p.ordre + ". Pour le chiffrer, il manque " + p.manque + "."));
        ul.appendChild(li);
      });
      f.appendChild(ul);
    }

    if (r.refus.length) {
      var nr = el("div", "notice small");
      nr.appendChild(el("strong", null, "Un levier fermé. "));
      r.refus.forEach(function (m) { nr.appendChild(document.createTextNode(m + " ")); });
      f.appendChild(nr);
    }

    var d2 = el("details");
    d2.appendChild(el("summary", null, "Ce que ce calcul suppose"));
    var uh = el("ul");
    r.hypotheses.forEach(function (x) { uh.appendChild(el("li", null, x)); });
    d2.appendChild(uh);
    f.appendChild(d2);
    return f;
  }

  function rendreSimulateur(sansChamps) {
    if (!entree) entree = casParDefaut();
    rendreCas("#sim-cas");
    if (!sansChamps) rendreChamps();
    var z = $("#sim-resultat");
    if (!z) return;
    z.innerHTML = "";
    z.appendChild(tableauResultat(window.PREVOYANCE.simuler(entree), false));
  }

  function rendreApercu() {
    var z = $("#acc-apercu");
    if (!z) return;
    if (!entree) entree = casParDefaut();
    z.innerHTML = "";
    z.appendChild(tableauResultat(window.PREVOYANCE.simuler(entree), true));
    var c = el("div", "chips");
    var b = el("button", "chip", "Changer la situation et voir le détail");
    b.addEventListener("click", function () { ouvrir("simulateur"); });
    c.appendChild(b);
    z.appendChild(c);
  }

  // ---------- Accueil ----------

  function rendreAccueil() {
    var m = $("#acc-mouvement");
    if (m) { m.innerHTML = ""; m.appendChild(blocMouvement()); }

    if (!entree) entree = casParDefaut();
    rendreCas("#acc-cas");
    rendreApercu();

    var p = $("#acc-principe");
    if (p && !p.children.length) {
      var ol = el("ol", "etapes");
      var ICO_ETAPE = ["verser", "retrancher", "declarer", "recuperer"];
      [["Vous versez", "Sur un contrat de prévoyance-vieillesse, jusqu'au plafond de l'année. " +
        "Ce que vous ne versez pas est perdu : le plafond ne se reporte pas."],
       ["Le montant sort de votre revenu imposable", "Vous ne payez pas d'impôt dessus. Ce que " +
        "cela vous rend dépend donc de votre taux, pas seulement du montant versé."],
       ["Vous le déclarez", "Rien n'est automatique. Sans la ligne dans votre déclaration, le " +
        "versement ne produit aucun effet fiscal."],
       ["Vous récupérez entre " + T.prevoyance.sortieMin + " et " + T.prevoyance.sortieMax + " ans",
        "En capital, en rente viagère, ou les deux. Le capital est imposé à la moitié du taux " +
        "global, la rente sur la moitié de son montant."]].forEach(function (e) {
        var li = el("li");
        var b = el("span", "etape-ic");
        b.appendChild(icone(ICO_ETAPE[ol.children.length]));
        li.appendChild(b);
        var t = el("div");
        t.appendChild(el("strong", null, e[0]));
        t.appendChild(el("p", null, e[1]));
        li.appendChild(t);
        ol.appendChild(li);
      });
      p.appendChild(ol);
    }

    var c = $("#acc-concerne");
    if (c && !c.children.length) {
      var g = el("div", "grid");
      [["Avant " + T.prevoyance.ageMaxSouscription + " ans",
        "La souscription n'est plus possible ensuite, et le contrat doit durer au moins " +
        T.prevoyance.dureeMinimaleAns + " ans."],
       ["Imposé au Luxembourg",
        "C'est le lieu d'imposition qui décide, pas le lieu d'habitation. Un frontalier imposé " +
        "au Luxembourg y a droit, un résident imposé ailleurs n'y a pas droit. C'est la " +
        "confusion la plus fréquente sur ce dispositif."],
       ["Une épargne de long terme",
        "Récupérable entre " + T.prevoyance.sortieMin + " et " + T.prevoyance.sortieMax + " ans. " +
        "Sortir avant reste possible, mais la somme est alors imposée au tarif normal et " +
        "l'avantage obtenu à l'entrée est repris. Deux motifs y échappent, la maladie grave et " +
        "l'invalidité."]].forEach(function (x, i) {
        var d = el("div", "qcard");
        var b = el("span", "qcard-ic");
        b.appendChild(icone(["calendrier", "territoire", "duree"][i]));
        d.appendChild(b);
        d.appendChild(el("h3", null, x[0]));
        d.appendChild(el("p", null, x[1]));
        g.appendChild(d);
      });
      c.appendChild(g);
    }

    var q = $("#acc-questions");
    if (q && !q.children.length) {
      ["frontalier", "plafond-montant", "avant-60", "declarer", "report", "supports"].forEach(function (id) {
        var e = Q.entrees.filter(function (x) { return x.id === id; })[0];
        if (!e) return;
        var d = el("div", "qcard");
        d.appendChild(el("h3", null, e.question));
        d.appendChild(el("p", null, remplir(e.reponse).slice(0, 120) + "…"));
        d.addEventListener("click", function () {
          ouvrir("questions");
          filtreQ = "";
          themeQ = e.theme;
          var f = $("#q-filtre"); if (f) f.value = "";
          rendreQuestions(e.id);
        });
        q.appendChild(d);
      });
    }

    var r = $("#acc-reserves");
    if (r) { r.innerHTML = ""; r.appendChild(blocReserves()); }
    var s = $("#acc-sources");
    if (s) { s.innerHTML = ""; s.appendChild(blocSources()); }
    var s2 = $("#sim-reserves");
    if (s2) { s2.innerHTML = ""; s2.appendChild(blocReserves()); }
    var s3 = $("#sim-sources");
    if (s3) { s3.innerHTML = ""; s3.appendChild(blocSources()); }
  }

  function blocReserves() {
    var f = document.createDocumentFragment();
    f.appendChild(el("strong", null, "Ce que ce site ne dit pas. "));
    f.appendChild(document.createTextNode(
      "Il chiffre des plafonds de déduction et l'impôt que vous ne payez pas. Il ne chiffre ni le " +
      "capital que vous récupérerez, ce qui supposerait un rendement, ni le rendement d'un " +
      "contrat, ni votre taux d'imposition réel. Il ne compare aucun contrat du marché et ne " +
      "recommande aucun placement. La réglementation évolue, la source ci-dessous fait foi."));
    return f;
  }

  function blocSources() {
    var b = el("div", "srcbox");
    b.appendChild(el("strong", null, "Sources officielles"));
    var ul = el("ul");
    T.sources.forEach(function (x) {
      var li = el("li");
      var a = el("a", null, x.t);
      a.href = x.u; a.target = "_blank"; a.rel = "noopener noreferrer";
      li.appendChild(a);
      ul.appendChild(li);
    });
    b.appendChild(ul);
    return b;
  }

  // ---------- Questions frequentes ----------

  var filtreQ = "", themeQ = null;

  function normaliser(s) {
    return String(s || "").toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/\b([cdjlmnst]|qu|jusqu|lorsqu|puisqu)'/g, "$1 ")
      .replace(/111\s?bis/g, "111bis")
      .replace(/[^a-z0-9]+/g, " ").trim();
  }

  function correspond(e, mots) {
    // Le filtre exige CHAQUE mot, pas l'un d'eux. « frontalier impot » est plus
    // precis que « frontalier », la ou un « ou » elargirait a chaque mot ajoute.
    var foin = normaliser(e.question + " " + remplir(e.reponse) + " " + (e.variantes || []).join(" "));
    return mots.every(function (m) { return foin.indexOf(m) !== -1; });
  }

  function rendreQuestions(ouvrirId) {
    var z = $("#q-liste");
    if (!z) return;
    z.innerHTML = "";

    var th = $("#q-themes");
    if (th) {
      th.innerHTML = "";
      var tous = el("button", "chip" + (themeQ ? "" : " actif"), "Tous les thèmes (" + Q.entrees.length + ")");
      tous.addEventListener("click", function () { themeQ = null; rendreQuestions(); });
      th.appendChild(tous);
      Q.themes.forEach(function (t) {
        var n = Q.entrees.filter(function (e) { return e.theme === t.id; }).length;
        if (!n) return;
        var b = el("button", "chip" + (themeQ === t.id ? " actif" : ""), t.nom + " (" + n + ")");
        b.addEventListener("click", function () {
          themeQ = themeQ === t.id ? null : t.id;
          rendreQuestions();
        });
        th.appendChild(b);
      });
    }

    var mots = normaliser(filtreQ).split(" ").filter(function (m) { return m.length > 1; });
    var liste = Q.entrees.filter(function (e) {
      if (themeQ && e.theme !== themeQ) return false;
      if (mots.length && !correspond(e, mots)) return false;
      return true;
    });

    var c = $("#q-compte");
    if (c) c.textContent = liste.length + (liste.length > 1 ? " questions" : " question");

    if (!liste.length) {
      var v = el("div", "notice");
      v.appendChild(document.createTextNode("Aucune question ne correspond. "));
      var b2 = el("button", "chip", "Poser la question à l'assistant");
      b2.addEventListener("click", function () {
        ouvrir("assistant");
        var i = $("#as-input");
        if (i) { i.value = filtreQ; i.focus(); }
      });
      v.appendChild(b2);
      z.appendChild(v);
      return;
    }

    var parTheme = {}, ordre = [];
    liste.forEach(function (e) {
      if (!parTheme[e.theme]) { parTheme[e.theme] = []; ordre.push(e.theme); }
      parTheme[e.theme].push(e);
    });
    ordre.forEach(function (t) {
      var nom = (Q.themes.filter(function (x) { return x.id === t; })[0] || {}).nom || t;
      z.appendChild(el("h2", "qtheme", nom));
      parTheme[t].forEach(function (e) {
        var d = el("details", "qitem");
        d.id = "q-" + e.id;
        if (ouvrirId === e.id) d.open = true;
        d.appendChild(el("summary", null, e.question));
        var corps = el("div", "qcorps");
        corps.appendChild(el("p", null, remplir(e.reponse)));
        if (e.reserve) {
          var r = el("p", "sous reserve", e.reserve);
          corps.appendChild(r);
        }
        corps.appendChild(blocCitations(e));
        if (e.ouvreSimulateur) {
          var ch = el("div", "chips");
          var bs = el("button", "chip", "Chiffrer sur ma situation");
          bs.addEventListener("click", function () { ouvrir("simulateur"); });
          ch.appendChild(bs);
          corps.appendChild(ch);
        }
        d.appendChild(corps);
        z.appendChild(d);
      });
    });

    if (ouvrirId) {
      var cible = $("#q-" + ouvrirId);
      if (cible) setTimeout(function () { cible.scrollIntoView({ behavior: doux(), block: "center" }); }, 60);
    }
  }

  // Pas de source, pas de reponse : le rendu refuse d'afficher un texte sans
  // ses citations.
  function blocCitations(e) {
    var d = el("div", "srcs");
    d.appendChild(el("strong", null, "Sources"));
    (e.sources || []).forEach(function (s) {
      var a = el("a", null, s.t);
      a.href = s.u; a.target = "_blank"; a.rel = "noopener noreferrer";
      d.appendChild(a);
    });
    return d;
  }

  function initQuestions() {
    var f = $("#q-filtre");
    if (!f) return;
    f.addEventListener("input", function () {
      filtreQ = f.value;
      rendreQuestions();
    });
  }

  // ---------- L'assistant, sans modele de langue ----------

  var SEUIL = 0.45, MASSE_MIN = 4.0, ECART_AMBIGUITE = 0.98, PENALITE_INCONNU = 0.7;

  // Un mot de question ne discrimine rien, mais s'il est rare dans le repertoire
  // il recolte un poids eleve et emporte la decision : « quelle est la meteo
  // demain » se rattachait ainsi a « Quelle forme... ». On les ecarte avant de
  // peser, plutot que de relever le seuil au risque de perdre de vraies
  // questions.
  var VIDES = ("le la les un une des de du au aux et ou en pour dans sur par avec est sont " +
    "il elle je tu nous vous ils que qui quoi quel quelle quels quelles comment quand " +
    "dois doit puis peux peut faut etre avoir mon ma mes son sa ses ce cette ces mais si ne " +
    "pas plus tres bien alors donc car ai as ont fait faire dit dire veux veut savoir sais " +
    "sait pourquoi vraiment cela ca").split(" ");

  function utile(m) { return m.length > 2 && VIDES.indexOf(m) === -1; }

  var poidsMot = (function () {
    var total = Q.entrees.length, compte = {};
    Q.entrees.forEach(function (e) {
      var vus = {};
      normaliser(e.question + " " + (e.variantes || []).join(" ")).split(" ").forEach(function (m) {
        if (utile(m) && !vus[m]) { vus[m] = 1; compte[m] = (compte[m] || 0) + 1; }
      });
    });
    return function (m) {
      if (!compte[m]) return 0;
      var v = Math.log(1 + total / compte[m]);
      return v * v;
    };
  })();

  function candidats(q) {
    var mots = normaliser(q).split(" ").filter(utile);
    if (!mots.length) return [];
    return Q.entrees.map(function (e) {
      var cles = normaliser(e.question + " " + (e.variantes || []).join(" ")).split(" ").filter(utile);
      var masse = 0, total = 0;
      mots.forEach(function (m) {
        var p = poidsMot(m);
        total += p || PENALITE_INCONNU;
        // Correspondance EN PREFIXE du mot-cle vers le terme tape : c'est la
        // forme tapee qu'il faut ecrire dans les variantes, pas l'infinitif.
        if (p && cles.some(function (c) { return c.indexOf(m) === 0 || m.indexOf(c) === 0; })) masse += p;
      });
      return { entree: e, masse: masse, score: total ? masse / total : 0 };
    }).filter(function (x) { return x.masse > 0; })
      .sort(function (a, b) { return b.score - a.score; });
  }

  var MOTIFS_PERSO = [
    { re: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,}\b/i, quoi: "un IBAN" },
    { re: /\b\d{8,}\b/, quoi: "un numéro long, peut-être un contrat ou un identifiant" },
    { re: /\b(\+352|00352)?[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2,3}\b/, quoi: "un numéro de téléphone" },
    { re: /[\w.\-]+@[\w.\-]+\.\w{2,}/, quoi: "une adresse électronique" }
  ];

  function bulle(cls, statut, texte) {
    var log = $("#as-log");
    var m = el("div", "msg " + cls);
    if (statut) m.appendChild(el("span", "statut", statut));
    if (texte) m.appendChild(document.createTextNode(texte));
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
    return m;
  }

  function repondre(q) {
    // Aucune donnee personnelle n'est lue ni affichee. Un echo est deja une
    // conservation : meme le message de l'utilisateur n'est pas rendu tel quel,
    // il resterait dans la page et dans une capture d'ecran.
    var perso = null;
    for (var k = 0; k < MOTIFS_PERSO.length; k++) {
      if (MOTIFS_PERSO[k].re.test(q)) { perso = MOTIFS_PERSO[k]; break; }
    }
    bulle("moi", null, perso ? "(message masqué : il contenait " + perso.quoi + ")" : q);

    for (var i = 0; i < MOTIFS_PERSO.length; i++) {
      if (MOTIFS_PERSO[i].re.test(q)) {
        bulle("rep perso", "Donnée personnelle",
          "Votre message semble contenir " + MOTIFS_PERSO[i].quoi + ". Je ne le lis pas et je ne " +
          "le répète pas. Ce site ne traite aucune donnée personnelle et n'a accès à aucun " +
          "dossier : posez la question en termes généraux.");
        return;
      }
    }

    var c = candidats(q);
    var best = c[0];

    if (!best || best.score < SEUIL || best.masse < MASSE_MIN) {
      var m = bulle("rep hors", "Hors de ce que je sais",
        "Je n'ai pas de réponse écrite à cette question, et je préfère le dire plutôt que " +
        "d'improviser. Ce site couvre la déduction de la prévoyance-vieillesse : les plafonds, " +
        "qui y a droit, quand et comment l'épargne se récupère, et comment déclarer.");
      var ch = el("div", "chips");
      ["Combien puis-je déduire par an ?", "Un frontalier y a-t-il droit ?",
       "Quand puis-je récupérer mon épargne ?"].forEach(function (t) {
        var b = el("button", "chip", t);
        b.addEventListener("click", function () { repondre(t); });
        ch.appendChild(b);
      });
      m.appendChild(ch);
      return;
    }

    // Deux candidats trop proches : on ne tranche pas a la place du lecteur.
    if (c[1] && c[1].score / best.score >= ECART_AMBIGUITE) {
      var ma = bulle("rep preciser", "Je peux comprendre deux choses",
        "Votre question peut porter sur deux sujets. Lequel vous intéresse ?");
      var cha = el("div", "chips");
      [c[0], c[1]].forEach(function (x) {
        var b = el("button", "chip", x.entree.question);
        b.addEventListener("click", function () { repondreEntree(x.entree); });
        cha.appendChild(b);
      });
      ma.appendChild(cha);
      return;
    }

    repondreEntree(best.entree);
  }

  function repondreEntree(e) {
    var m = bulle("rep", "Réponse", remplir(e.reponse));
    if (e.reserve) m.appendChild(el("span", "sous reserve", e.reserve));
    m.appendChild(blocCitations(e));
    var ch = el("div", "chips");
    if (e.ouvreSimulateur) {
      var bs = el("button", "chip", "Chiffrer sur ma situation");
      bs.addEventListener("click", function () { ouvrir("simulateur"); });
      ch.appendChild(bs);
    }
    (e.voisines || []).forEach(function (id) {
      var v = Q.entrees.filter(function (x) { return x.id === id; })[0];
      if (!v) return;
      var b = el("button", "chip", v.question);
      b.addEventListener("click", function () { repondreEntree(v); });
      ch.appendChild(b);
    });
    if (ch.children.length) m.appendChild(ch);
  }

  var assistantDemarre = false;

  function demarrerAssistant() {
    var p = $("#as-perimetre");
    if (p && !p.children.length) {
      [["sait", "Ce que je sais", Q.perimetre.sait],
       ["pas", "Ce que je ne sais pas", Q.perimetre.neSaitPas]].forEach(function (b) {
        var d = el("div", "per-bloc " + b[0]);
        d.appendChild(el("h3", null, b[1]));
        var ul = el("ul");
        b[2].forEach(function (x) { ul.appendChild(el("li", null, x)); });
        d.appendChild(ul);
        p.appendChild(d);
      });
    }
    if (assistantDemarre) return;
    assistantDemarre = true;
    var m = bulle("rep", null,
      "Posez votre question en français courant. Les réponses sont écrites et relues à l'avance, " +
      "chacune avec sa source, et je dis quand je ne sais pas.");
    var ch = el("div", "chips");
    ["Combien puis-je déduire par an ?", "Un frontalier y a-t-il droit ?",
     "Puis-je sortir avant soixante ans ?"].forEach(function (t) {
      var b = el("button", "chip", t);
      b.addEventListener("click", function () { repondre(t); });
      ch.appendChild(b);
    });
    m.appendChild(ch);
  }

  function initAssistant() {
    var i = $("#as-input"), b = $("#as-envoyer");
    if (!i || !b) return;
    function envoyer() {
      var q = i.value.trim();
      if (!q) return;
      i.value = "";
      repondre(q);
    }
    b.addEventListener("click", envoyer);
    i.addEventListener("keydown", function (e) { if (e.key === "Enter") envoyer(); });
  }

  // ---------- Pied de page ----------

  function initPied() {
    var z = $("#pied-sources");
    if (!z) return;
    z.innerHTML = "";
    var a = el("a", "lien-guide");
    a.href = "../";
    a.appendChild(document.createTextNode("Guide d'installation au Luxembourg"));
    a.appendChild(icone("fleche"));
    z.appendChild(a);
  }

  // ---------- Demarrage ----------

  function depuisHash() {
    var h = (window.location.hash || "").replace("#", "");
    ouvrir(h || "accueil", true);
  }

  initNav();
  initQuestions();
  initAssistant();
  initPied();
  rendreAccueil();
  rendreSimulateur();
  depuisHash();
  window.addEventListener("hashchange", depuisHash);
})();
