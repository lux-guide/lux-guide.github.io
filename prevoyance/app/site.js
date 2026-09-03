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

  // L'assistant n'est plus une vue : c'est un panneau qui s'ouvre par-dessus
  // celle qu'on lit. Son adresse, #assistant, l'ouvre quand meme.
  var VUES = ["accueil", "simulateur", "questions"];

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
    // C'est la colonne de page qui defile quand le volet est ouvert, et la
    // fenetre sinon. Remonter la mauvaise des deux ne fait rien du tout.
    var pg = $("#page");
    if (pg && pg.scrollHeight > pg.clientHeight + 1 && pg.scrollTop > 0) pg.scrollTop = 0;
    else window.scrollTo(0, 0);
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

  // ---------- Le panneau de l'assistant ----------
  //
  // Un onglet obligeait a quitter le simulateur pour poser une question, puis
  // a y revenir pour verifier. Le panneau reste ouvert a cote de ce qu'on lit,
  // et c'est de la qu'il peut renvoyer vers un endroit precis de la page.
  //
  // Il est fixe et porte son propre defilement. Un cadre qui defile a
  // l'interieur d'une page qui defile oblige a viser pour choisir lequel bouge.

  var CLE_PAN = "prevoyance.panneau.v1";
  var panOuvert = false, avantPan = null;

  function largeEcran() {
    return window.matchMedia && window.matchMedia("(min-width: 1180px)").matches;
  }

  function majPanneau() {
    var p = $("#panneau"), v = $("#voile"), b = $("#assistant-btn");
    if (!p) return;
    p.hidden = !panOuvert;
    // Le voile n'a de sens que quand le panneau recouvre la page. Au-dela de
    // 1180 px il pousse le contenu au lieu de le masquer : rien a assombrir.
    if (v) v.hidden = !panOuvert || largeEcran();
    document.body.setAttribute("data-panneau", panOuvert ? "1" : "0");
    if (b) {
      b.setAttribute("aria-expanded", String(panOuvert));
      b.classList.toggle("actif", panOuvert);
    }
  }

  function ouvrirPanneau(focus) {
    if (!panOuvert) {
      // Connu, donc plus rien a signaler. Peu importe par ou l'on est passe :
      // le bouton, l'adresse #assistant, ou un volet reste ouvert depuis la
      // derniere visite.
      connu();
      avantPan = document.activeElement;
      panOuvert = true;
      majPanneau();
      demarrerAssistant();
      try { localStorage.setItem(CLE_PAN, "1"); } catch (e) {}
    }
    if (focus !== false) {
      var i = $("#as-input");
      if (i) i.focus();
    }
  }

  function fermerPanneau() {
    if (!panOuvert) return;
    panOuvert = false;
    majPanneau();
    try { localStorage.setItem(CLE_PAN, "0"); } catch (e) {}
    // Le clavier revient d'ou il venait, et non en haut de la page.
    var c = avantPan && avantPan.focus ? avantPan : $("#assistant-btn");
    if (c && c.focus) c.focus();
    avantPan = null;
  }

  // ---------- La largeur du panneau ----------
  // 420 px conviennent a une question courte, pas a une reponse qui porte
  // quatre sources et trois suggestions. La largeur se regle et se retient.

  var CLE_LARGEUR = "prevoyance.panneau.largeur.v1";
  var L_MIN = 320, L_MAX = 720;

  // La largeur voulue et la largeur affichee sont deux choses. Le plafond des
  // deux tiers borne l'affichage, jamais la preference : sinon un passage par
  // une fenetre etroite efface un reglage qu'on avait pris la peine de faire,
  // et l'on ne le retrouve plus en reagrandissant.
  var largeurVoulue = 420;

  function poserLargeur(px) {
    if (px !== null && px !== undefined) {
      largeurVoulue = Math.max(L_MIN, Math.min(L_MAX, Math.round(px)));
    }
    var l = Math.min(largeurVoulue, Math.round(window.innerWidth * 0.66));
    document.documentElement.style.setProperty("--pan-l", l + "px");
    var p = $("#pan-poignee");
    if (p) p.setAttribute("aria-valuenow", String(l));
    return largeurVoulue;
  }

  function initLargeur() {
    var l = 420;
    try {
      var v = parseInt(localStorage.getItem(CLE_LARGEUR), 10);
      if (v >= L_MIN && v <= L_MAX) l = v;
    } catch (e) {}
    poserLargeur(l);

    var p = $("#pan-poignee");
    if (!p) return;

    function glisser(e) {
      var x = e.touches ? e.touches[0].clientX : e.clientX;
      poserLargeur(window.innerWidth - x);
      if (e.cancelable) e.preventDefault();
    }
    function finir() {
      document.body.removeAttribute("data-redim");
      document.removeEventListener("mousemove", glisser);
      document.removeEventListener("touchmove", glisser);
      document.removeEventListener("mouseup", finir);
      document.removeEventListener("touchend", finir);
      try { localStorage.setItem(CLE_LARGEUR, String(largeurVoulue)); } catch (e) {}
    }
    function commencer(e) {
      document.body.setAttribute("data-redim", "1");
      document.addEventListener("mousemove", glisser);
      document.addEventListener("touchmove", glisser, { passive: false });
      document.addEventListener("mouseup", finir);
      document.addEventListener("touchend", finir);
      if (e.cancelable) e.preventDefault();
    }
    p.addEventListener("mousedown", commencer);
    p.addEventListener("touchstart", commencer, { passive: false });

    // Au clavier : les fleches deplacent la separation, comme n'importe quel
    // separateur. Sans cela, la largeur ne serait reglable qu'a la souris.
    p.addEventListener("keydown", function (e) {
      var pas = e.shiftKey ? 60 : 16, l = null;
      if (e.key === "ArrowLeft") l = largeurVoulue + pas;
      else if (e.key === "ArrowRight") l = largeurVoulue - pas;
      else if (e.key === "Home") l = L_MAX;
      else if (e.key === "End") l = L_MIN;
      if (l === null) return;
      e.preventDefault();
      var n = poserLargeur(l);
      try { localStorage.setItem(CLE_LARGEUR, String(n)); } catch (x) {}
    });
  }

  // ---------- Revenir au dernier message ----------
  // Un bouton qui n'apparait que si l'on a vraiment remonte : affiche en
  // permanence, il masquerait la conversation pour ne rien dire.

  function majBoutonBas() {
    var z = $("#pan-corps"), b = $("#pan-bas");
    if (!z || !b) return;
    var reste = z.scrollHeight - z.scrollTop - z.clientHeight;
    b.hidden = reste < 120;
  }

  var CLE_VU = "prevoyance.assistant.vu.v1";

  function connu() {
    var b = $("#assistant-btn");
    if (b) b.classList.remove("appel");
    try { localStorage.setItem(CLE_VU, "1"); } catch (e) {}
  }

  function initPanneau() {
    var b = $("#assistant-btn");
    if (b) b.addEventListener("click", function () {
      if (panOuvert) fermerPanneau(); else ouvrirPanneau();
      connu();
    });
    var f = $("#pan-fermer");
    if (f) f.addEventListener("click", fermerPanneau);
    var v = $("#voile");
    if (v) v.addEventListener("click", fermerPanneau);

    // Echap ferme, que le panneau recouvre la page ou qu'il la pousse. La
    // regle ne doit pas dependre de la largeur de la fenetre : on ne se
    // souvient pas d'un raccourci qui marche une fois sur deux.
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panOuvert) { fermerPanneau(); return; }

      // Quand le panneau recouvre la page, le clavier reste dedans. Sans cela
      // la tabulation part se promener dans une page qu'on ne voit plus, et
      // l'on ne sait plus ou l'on est. Quand il pousse la page au lieu de la
      // couvrir, les deux sont visibles et il n'y a rien a retenir.
      if (e.key !== "Tab" || !panOuvert || largeEcran()) return;
      var p = $("#panneau");
      var f = p.querySelectorAll("button, [href], input, textarea, select, [tabindex]:not([tabindex=\"-1\"])");
      var vis = [];
      for (var i = 0; i < f.length; i++) if (f[i].offsetParent !== null && !f[i].disabled) vis.push(f[i]);
      if (!vis.length) return;
      var prem = vis[0], der = vis[vis.length - 1];
      if (e.shiftKey && document.activeElement === prem) { e.preventDefault(); der.focus(); }
      else if (!e.shiftKey && document.activeElement === der) { e.preventDefault(); prem.focus(); }
    });
    window.addEventListener("resize", function () {
      if (panOuvert) majPanneau();
      // Sans argument : on recalcule l'affichage sans toucher a la preference.
      poserLargeur(null);
    });

    var vider = $("#pan-vider");
    if (vider) vider.addEventListener("click", function () {
      var log = $("#as-log");
      if (log) log.innerHTML = "";
      assistantDemarre = false;
      var d = $("#pan-debut");
      if (d) d.hidden = false;
      demarrerAssistant();
      var i = $("#as-input");
      if (i) i.focus();
      majOutils();
    });

    var z = $("#pan-corps");
    if (z) z.addEventListener("scroll", majBoutonBas);
    var bb = $("#pan-bas");
    if (bb) bb.addEventListener("click", function () {
      z.scrollTo({ top: z.scrollHeight, behavior: doux() });
    });

    initLargeur();

    var ouvre = false;
    try { ouvre = localStorage.getItem(CLE_PAN) === "1"; } catch (e) {}
    if (ouvre) { panOuvert = true; majPanneau(); demarrerAssistant(); connu(); }
    else majPanneau();

    // L'appel du regard se pose en dernier, une fois su si le volet se rouvre
    // de lui-meme : appeler le regard vers un volet deja ouvert n'attire rien
    // et fait douter de ce que le bouton demande.
    var vu = true;
    try { vu = localStorage.getItem(CLE_VU) === "1"; } catch (e) {}
    if (b && !vu && !panOuvert) b.classList.add("appel");
  }

  // Le bouton « repartir de zero » n'a de sens qu'une fois qu'on a demande
  // quelque chose. Grise avant, il dit ce qu'il attend.
  function majOutils() {
    var v = $("#pan-vider"), log = $("#as-log");
    if (v && log) v.disabled = log.querySelectorAll(".msg.moi").length === 0;
  }

  // ---------- Renvoyer vers un endroit de la page ----------
  //
  // Une reponse gagne a montrer d'ou elle vient. Chaque element visable porte
  // un data-ancre, pose au moment ou il est construit : un selecteur ecrit a
  // la main casserait au premier remaniement, un data-ancre se voit.
  //
  // Cette table vit ici et non dans questions.js : le repertoire de questions
  // ne connait pas le DOM de ce site, et doit rester lisible sans lui.

  var ANCRES = {
    "mouvement":        { vue: "accueil",    sel: '[data-ancre="mouvement"]' },
    "moments":          { vue: "accueil",    sel: '[data-ancre="moments"]' },
    "condition-age":    { vue: "accueil",    sel: '[data-ancre="condition-0"]' },
    "condition-lieu":   { vue: "accueil",    sel: '[data-ancre="condition-1"]' },
    "condition-duree":  { vue: "accueil",    sel: '[data-ancre="condition-2"]' },
    "totaux":           { vue: "simulateur", sel: '[data-ancre="totaux"]' },
    "leviers":          { vue: "simulateur", sel: '[data-ancre="leviers"]' },
    "graphe-taux":      { vue: "simulateur", sel: '[data-ancre="graphe-taux"]' },
    "graphe-cumul":     { vue: "simulateur", sel: '[data-ancre="graphe-cumul"]' }
  };

  var OU_VOIR = {
    "cest-quoi": "moments",
    "plafond-montant": "mouvement",
    "plafond-couple": "totaux",
    "conjoint-etranger": "totaux",
    "qui-a-droit": "condition-lieu",
    "frontalier": "condition-lieu",
    "age-limite": "condition-age",
    "mythe-10-ans": "condition-duree",
    "quand-recuperer": "condition-duree",
    "avant-60": "condition-duree",
    "combien-ca-rend": "graphe-taux",
    "marginal-vs-moyen": "graphe-taux",
    "impot-sortie": "graphe-taux",
    "declarer": "moments",
    "vs-epargne-logement": "leviers",
    "supports": "leviers"
  };

  var tSurligne = null;

  function surligner(n) {
    if (!n) return;
    if (n.tagName === "DETAILS") n.open = true;
    n.scrollIntoView({ behavior: doux(), block: "center" });
    // Un seul endroit surligne a la fois. Deux marques en meme temps, dont une
    // qui repond a une question deja oubliee, ne designent plus rien.
    var d = document.querySelectorAll(".surligne");
    for (var i = 0; i < d.length; i++) d[i].classList.remove("surligne");
    // Retirer puis reposer la classe relance l'animation quand on redemande le
    // meme endroit ; sans la lecture forcee, le navigateur regroupe les deux.
    void n.offsetWidth;
    n.classList.add("surligne");
    clearTimeout(tSurligne);
    tSurligne = setTimeout(function () { n.classList.remove("surligne"); }, 2800);
  }

  function montrer(cle) {
    var a = ANCRES[cle];
    if (!a) return false;
    ouvrir(a.vue);
    // La vue vient d'etre rendue : on laisse le navigateur poser la mise en
    // page avant de mesurer ou defiler.
    setTimeout(function () { surligner(document.querySelector(a.sel)); }, 90);
    return true;
  }

  function ouVoir(e) {
    if (OU_VOIR[e.id] && ANCRES[OU_VOIR[e.id]]) return OU_VOIR[e.id];
    return null;
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

  // L'etat de depart ne declare rien. Ni age, ni enfant, ni pret : ce sont
  // des faits sur une personne, et ce site s'adresse a tout le monde. Seul
  // « impose au Luxembourg » est pose, parce que ce n'est pas un trait de
  // caractere, c'est le champ du dispositif dont la page parle.
  var entree = { age: null, enfants: 0, pret: false, imposeLuxembourg: true };



  function rendreChamps() {
    var z = $("#sim-champs");
    if (!z) return;
    z.innerHTML = "";

    var da = el("div");
    da.appendChild(el("label", null, "Votre âge, si vous voulez le préciser"));
    // « type=number » ne suffit pas : il laisse passer « e », « + », un
    // collage de texte, et ne fait respecter min et max qu'a la validation
    // d'un formulaire, qu'il n'y a pas ici. Pire, sur une saisie invalide sa
    // propriete value rend une chaine vide : le champ affichait des lettres
    // pendant que le site se comportait comme s'il etait vide, sans rien dire.
    // On filtre donc soi-meme, et on borne.
    var ia = el("input");
    ia.type = "text";
    ia.inputMode = "numeric";
    ia.autocomplete = "off";
    ia.maxLength = 2;
    ia.setAttribute("aria-describedby", "ch-age-note");
    ia.value = entree.age === null ? "" : String(entree.age);
    ia.placeholder = "non renseigné";
    ia.id = "ch-age";

    var note = el("p", "champ-note");
    note.id = "ch-age-note";

    function direAge(msg) {
      note.textContent = msg || "";
      note.hidden = !msg;
    }

    function lireAge(borner) {
      // Seuls les chiffres sont retenus, et la longueur est limitee a deux :
      // 255555 ne devrait jamais pouvoir s'ecrire, pas seulement ne pas etre
      // pris en compte.
      var v = ia.value.replace(/[^0-9]/g, "").slice(0, 2);
      if (v !== ia.value) ia.value = v;
      if (v === "") { entree.age = null; direAge(""); return; }
      var n = Number(v);
      if (borner) {
        // On ne borne qu'a la sortie du champ : sinon taper « 1 » en route
        // vers « 18 » ferait bondir la valeur a 18 sous les doigts.
        if (n < T.bornes.ageMin) {
          n = T.bornes.ageMin;
          ia.value = String(n);
          direAge("Le dispositif s'adresse aux personnes majeures : âge ramené à " +
            T.bornes.ageMin + " ans.");
        } else if (n > T.bornes.ageMax) {
          n = T.bornes.ageMax;
          ia.value = String(n);
          direAge("Au-delà de " + T.prevoyance.ageMaxSouscription + " ans la souscription " +
            "n'est plus possible : âge ramené à " + T.bornes.ageMax + " ans.");
        } else direAge("");
      } else if (n >= T.bornes.ageMin && n <= T.bornes.ageMax) direAge("");
      entree.age = n;
    }

    ia.addEventListener("input", function () {
      lireAge(false);
      rendreSimulateur(true); rendreApercu();
    });
    ia.addEventListener("blur", function () {
      lireAge(true);
      rendreSimulateur(true); rendreApercu();
    });
    da.appendChild(ia); da.appendChild(note); z.appendChild(da);
    direAge("");

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

    // Un indicateur a zero se lit comme un refus. Le deductible ponctuel vaut
    // zero tant qu'aucun pret n'est declare, ce qui n'est pas la meme chose
    // que « vous n'y avez pas droit » : on le dit, au lieu d'afficher 0 €.
    var k = el("div", "kpis");
    [["Déductible chaque année", r.totalAnnuel, null],
     ["Déductible une seule fois", r.totalPonctuel,
      "Se calcule à la souscription d'un prêt immobilier"]].forEach(function (x) {
      var d = el("div", "kpi");
      d.appendChild(el("div", "k", x[0]));
      if (!x[1] && x[2]) {
        d.classList.add("vide");
        d.appendChild(el("div", "v", "—"));
        d.appendChild(el("span", "sous", x[2]));
      } else {
        d.appendChild(el("div", "v", eur(x[1])));
      }
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
    var bt = bloc("Économie d'impôt chaque année",
      "Le même versement ne rend pas la même chose à tout le monde : c'est le taux qui décide.",
      grapheBarres(valAn, libTaux));
    bt.setAttribute("data-ancre", "graphe-taux");
    f.appendChild(bt);

    var series = T.taux.map(function (x) {
      return r.serieCumulParTaux[String(Math.round(x * 100))] || [];
    }).filter(function (s) { return s.length; });
    if (series.length) {
      var bc = bloc("Ce que cela cumule sur " + T.horizonAns + " ans",
        "À versement constant et à taux constant. Ni rendement ni revalorisation : ce graphique " +
        "n'additionne que des économies d'impôt.",
        grapheCourbes(series, libTaux, T.horizonAns));
      bc.setAttribute("data-ancre", "graphe-cumul");
      f.appendChild(bc);
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
    d2.appendChild(el("summary", null, "Ce que ce site ne dit pas"));
    var uh = el("ul");
    r.hypotheses.forEach(function (x) { uh.appendChild(el("li", null, x)); });
    d2.appendChild(uh);
    f.appendChild(d2);
    return f;
  }

  function rendreSimulateur(sansChamps) {
    if (!sansChamps) rendreChamps();
    var z = $("#sim-resultat");
    if (!z) return;
    z.innerHTML = "";
    z.appendChild(tableauResultat(window.PREVOYANCE.simuler(entree), false));
  }

  function rendreApercu() {
    var z = $("#acc-apercu");
    if (!z) return;
    z.innerHTML = "";
    z.appendChild(tableauResultat(window.PREVOYANCE.simuler(entree), true));
    var c = el("div", "chips");
    var b = el("button", "chip", "Ajouter ma situation et voir le détail");
    b.addEventListener("click", function () { ouvrir("simulateur"); });
    c.appendChild(b);
    z.appendChild(c);
  }

  // ---------- Accueil ----------

  function rendreAccueil() {
    var m = $("#acc-mouvement");
    if (m) {
      m.innerHTML = "";
      var bm = blocMouvement();
      bm.setAttribute("data-ancre", "mouvement");
      m.appendChild(bm);
    }

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
        "À condition que le contrat ait duré au moins " + T.prevoyance.dureeMinimaleAns + " ans : " +
        "souscrire à 55 ans, c'est donc sortir à 65 et non à " + T.prevoyance.sortieMin + ". " +
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
      ol.setAttribute("data-ancre", "moments");
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
        "au Luxembourg y a droit, un résident imposé ailleurs n'y a pas droit."],
       ["Une épargne de long terme",
        "Récupérable entre " + T.prevoyance.sortieMin + " et " + T.prevoyance.sortieMax + " ans. " +
        "Sortir avant reste possible, mais la somme est alors imposée au tarif normal et " +
        "l'avantage obtenu à l'entrée est repris. Deux motifs y échappent, la maladie grave et " +
        "l'invalidité."]].forEach(function (x, i) {
        var d = el("div", "qcard");
        d.setAttribute("data-ancre", "condition-" + i);
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
    var s2 = $("#sim-reserves");
    if (s2) { s2.innerHTML = ""; s2.appendChild(blocReserves()); }
  }

  function blocReserves() {
    var f = document.createDocumentFragment();
    f.appendChild(el("strong", null, "Ce que ce site ne dit pas. "));
    f.appendChild(document.createTextNode(
      "Il chiffre des plafonds de déduction et l'impôt que vous ne payez pas. Il ne chiffre ni le " +
      "capital que vous récupérerez, ce qui supposerait un rendement, ni le rendement d'un " +
      "contrat, ni votre taux d'imposition réel. Il ne compare aucun contrat du marché et ne " +
      "recommande aucun placement. La réglementation évolue, et ce sont les sources du pied de " +
      "page qui font foi, pas cette page."));
    return f;
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
  // ---------- La fiche d'une source ----------
  //
  // Sur telephone, un titre de source tient sur trois lignes et l'on tape
  // dessus sans savoir ou l'on va. La fiche dit d'abord ce que la source est,
  // ce qu'elle etablit ici, et quand le lien a ete verifie. On y va ensuite
  // en connaissance de cause, ou l'on copie l'adresse pour plus tard.
  //
  // Elle ne montre pas la page officielle : aucune ne se laisse encadrer, et
  // un document de seize pages ouvert sur un telephone, sans savoir ou
  // regarder, ne prouve rien a personne.

  var sourceAvant = null;

  function fermerFiche() {
    var f = $("#fiche");
    if (!f || f.hidden) return;
    f.hidden = true;
    var v = $("#fiche-voile");
    if (v) v.hidden = true;
    if (sourceAvant && sourceAvant.focus) sourceAvant.focus();
    sourceAvant = null;
  }

  function ouvrirFiche(s) {
    var f = $("#fiche"), c = $("#fiche-corps"), v = $("#fiche-voile");
    if (!f || !c) return;
    sourceAvant = document.activeElement;
    c.innerHTML = "";

    var haut = el("div", "fiche-haut");
    haut.appendChild(el("span", "fiche-organisme", s.court || "Source"));
    var nat = el("span", "fiche-nature");
    nat.appendChild(icone(s.type === "document" ? "source" : "lien"));
    nat.appendChild(document.createTextNode(
      s.type === "document"
        ? "Document" + (s.pages ? " de " + s.pages + " pages" : "")
        : "Page du site officiel"));
    haut.appendChild(nat);
    c.appendChild(haut);

    c.appendChild(el("h3", null, s.t));
    if (s.porte) c.appendChild(el("p", "fiche-porte", s.porte));

    var d = el("p", "fiche-verif");
    d.appendChild(icone("valide"));
    d.appendChild(document.createTextNode(
      s.verifie ? "Lien ouvert et vérifié le " + s.verifie : "Lien non daté"));
    c.appendChild(d);

    var adr = el("p", "fiche-adresse", s.u);
    c.appendChild(adr);

    var acts = el("div", "fiche-actions");
    var a = el("a", "btn");
    a.href = s.u; a.target = "_blank"; a.rel = "noopener noreferrer";
    a.appendChild(document.createTextNode("Ouvrir le site officiel"));
    a.appendChild(icone("lien"));
    a.addEventListener("click", fermerFiche);
    acts.appendChild(a);

    // Copier vaut mieux qu'ouvrir quand on lit dans les transports : on
    // retrouve l'adresse plus tard, sans perdre ce qu'on etait en train de
    // lire.
    var cp = el("button", "btn contour", "Copier le lien");
    cp.addEventListener("click", function () {
      var fini = function (ok) { cp.textContent = ok ? "Lien copié" : "Copie impossible"; };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(s.u).then(function () { fini(true); }, function () { fini(false); });
      } else fini(false);
    });
    acts.appendChild(cp);
    c.appendChild(acts);

    f.hidden = false;
    if (v) v.hidden = false;
    var p = f.querySelector(".fiche-fermer");
    if (p) p.focus();
  }

  function initFiche() {
    var v = $("#fiche-voile"), x = $("#fiche-fermer");
    if (v) v.addEventListener("click", fermerFiche);
    if (x) x.addEventListener("click", fermerFiche);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") fermerFiche();
    });
  }

  // Sous 760 px, un lien de source ouvre sa fiche au lieu de quitter le site.
  // Au-dessus, la place ne manque pas et le lien reste un lien : une fiche
  // serait une etape de plus pour rien.
  function fichePlutotQueLien() {
    return window.matchMedia && window.matchMedia("(max-width: 760px)").matches;
  }

  function blocCitations(e) {
    var d = el("div", "srcs");
    d.appendChild(el("strong", null, "Sources"));
    (e.sources || []).forEach(function (s) {
      var a = el("a");
      a.href = s.u; a.target = "_blank"; a.rel = "noopener noreferrer";
      // Le nom court sur telephone, le titre entier des qu'il y a la place :
      // « Circulaire L.I.R. n° 111bis/1 - 111ter/1 du 27 avril 2022 » tient
      // sur trois lignes dans une bulle de 300 px.
      a.appendChild(el("span", "src-court", s.court || s.t));
      a.appendChild(el("span", "src-long", s.t));
      a.addEventListener("click", function (ev) {
        if (!fichePlutotQueLien()) return;
        ev.preventDefault();
        ouvrirFiche(s);
      });
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
    // C'est le corps du panneau qui defile, pas la conversation : defiler
    // #as-log ne faisait plus rien depuis qu'il a cesse de porter sa barre.
    // Le report a la frame suivante laisse le navigateur mesurer la bulle
    // qu'on vient d'ajouter, sinon on defile vers une hauteur perimee.
    var z = $("#pan-corps");
    if (z) requestAnimationFrame(function () { z.scrollTop = z.scrollHeight; });
    return m;
  }

  function repondre(q) {
    // Ce qu'on a lu une fois n'a pas a occuper l'ecran ensuite : le perimetre
    // se replie de lui-meme des la premiere question, sans qu'on ait a le
    // fermer.
    var deb = $("#pan-debut");
    if (deb) deb.hidden = true;

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
    var cible = ouVoir(e);
    if (cible) {
      var bv = el("button", "chip vise");
      bv.appendChild(icone("cible"));
      bv.appendChild(document.createTextNode("Voir sur la page"));
      bv.addEventListener("click", function () { montrer(cible); });
      ch.appendChild(bv);
    }
    if (e.ouvreSimulateur && (!cible || ANCRES[cible].vue !== "simulateur")) {
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
    // L'intro du panneau dit deja comment les reponses sont faites : la
    // repeter ici ferait lire deux fois la meme phrase avant d'avoir rien
    // demande. Cette bulle ne porte que l'invitation et de quoi commencer.
    var m = bulle("rep", null, "Par où commencer ?");
    var ch = el("div", "chips");
    ["Combien puis-je déduire par an ?", "Un frontalier y a-t-il droit ?",
     "Puis-je sortir avant soixante ans ?"].forEach(function (t) {
      var b = el("button", "chip", t);
      b.addEventListener("click", function () { repondre(t); majOutils(); });
      ch.appendChild(b);
    });
    m.appendChild(ch);
  }

  function initAssistant() {
    var i = $("#as-input"), b = $("#as-envoyer");
    if (!i || !b) return;

    // La saisie grandit avec la question, jusqu'a la hauteur que le style
    // autorise. Un champ d'une ligne pour une question de deux la fait defiler
    // sous les yeux pendant qu'on l'ecrit.
    function ajuster() {
      i.style.height = "auto";
      i.style.height = Math.min(i.scrollHeight, 136) + "px";
    }
    function envoyer() {
      var q = i.value.trim();
      if (!q) return;
      i.value = "";
      ajuster();
      b.disabled = true;
      repondre(q);
      majOutils();
    }
    b.addEventListener("click", envoyer);
    i.addEventListener("input", function () {
      ajuster();
      // Un bouton actif qui ne fait rien apprend a ne plus lui faire
      // confiance : il ne s'allume que quand il y a quelque chose a envoyer.
      b.disabled = !i.value.trim();
    });
    i.addEventListener("keydown", function (e) {
      // Entree envoie, Maj+Entree passe a la ligne : c'est ce que fait
      // n'importe quelle messagerie, et la saisie tient plusieurs lignes.
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyer(); }
    });
    ajuster();
    majOutils();
  }

  // ---------- Pied de page ----------

  function initPied() {
    // Les sources du pied sont celles que le repertoire cite reellement, sans
    // doublon : une liste ecrite a la main finirait par mentir le jour ou une
    // source change.
    var z = $("#pied-sources");
    if (z) {
      z.innerHTML = "";
      var vues = {};
      Q.entrees.forEach(function (e) {
        (e.sources || []).forEach(function (src) {
          if (vues[src.u]) return;
          vues[src.u] = 1;
          var li = el("li"), a = el("a");
          a.href = src.u;
          a.target = "_blank";
          a.rel = "noopener";
          a.appendChild(document.createTextNode(src.t));
          a.appendChild(icone("lien"));
          li.appendChild(a);
          z.appendChild(li);
        });
      });
    }

    var l = $("#pied-liens");
    if (l) {
      l.innerHTML = "";
      var li2 = el("li"), g = el("a", "lien-guide");
      g.href = "../";
      g.appendChild(document.createTextNode("Guide d'installation au Luxembourg"));
      g.appendChild(icone("fleche"));
      li2.appendChild(g);
      l.appendChild(li2);

      var li3 = el("li"), q = el("a");
      q.href = "#questions";
      q.appendChild(document.createTextNode("Toutes les questions"));
      q.appendChild(icone("fleche"));
      li3.appendChild(q);
      l.appendChild(li3);
    }
  }

  // ---------- Demarrage ----------

  function depuisHash() {
    var h = (window.location.hash || "").replace("#", "");
    // #assistant reste une adresse valable : elle ouvre le panneau, sans
    // changer la vue qu'on regardait.
    if (h === "assistant") { ouvrirPanneau(); return; }
    ouvrir(h || "accueil", true);
  }

  initNav();
  initQuestions();
  initAssistant();
  initPanneau();
  initFiche();
  initPied();
  rendreAccueil();
  rendreSimulateur();
  depuisHash();
  window.addEventListener("hashchange", depuisHash);
})();
