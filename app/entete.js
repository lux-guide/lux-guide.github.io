/* En-tete commune du site Vivre au Luxembourg : la marque, les entrees et leurs
   menus, les outils, et leur comportement (ouverture des menus, clavier, fondu
   de defilement). Une seule definition pour toutes les pages du site, pour que
   le menu ne diverge jamais d'une page a l'autre.

   Deux usages, choisis par les attributs de <header id="entete"> :

   1. La page du guide (index.html) est une application a panneaux. Ses entrees
      sont des boutons data-panel, que ui.js relie a ses panneaux. Attributs :
      data-racine="".
   2. Une rubrique qui vit dans sa propre page, comme l'epargne-retraite
      (prevoyance/), recoit les memes entrees en liens vers le guide
      (../#fiches). Attributs : data-racine="../", data-courant="<rubrique>",
      et data-assistant="<id du volet>" si la page a son propre assistant.

   Le script s'execute la ou il est inclus, juste apres <header id="entete"> :
   l'en-tete existe donc avant que les autres scripts ne le cherchent. */
(function () {
  "use strict";

  // ---------- Les entrees ----------
  // Dix sections alignees, c'etait une liste a lire en entier avant de choisir.
  // Elles sont rangees en trois familles : ce qu'il faut savoir, ce que ca
  // coute, ou habiter. L'accueil et l'assistant restent directs, ce sont les
  // deux entrees qu'on prend sans reflechir. Le menu a la place d'ecrire ce que
  // contient chaque section, ce que l'onglet nu ne pouvait pas faire.
  // « Où vivre » et non « Où habiter » : la famille tenait déjà les cartes du
  // pays, elle tient aussi ce qu'on y fait une fois installé. Une famille de
  // plus pour une seule entrée aurait allongé la barre sans rien ranger.
  var FAMILLES = [
    { id: "guide", libelle: "Guide d'installation", items: [
      { panneau: "fiches", nom: "Fiches pratiques", aide: "Chaque fiche est autonome, avec ses sources officielles" },
      { panneau: "parcours", nom: "Parcours d'installation", aide: "Les démarches dans l'ordre, celles qui conditionnent les autres d'abord" },
      { panneau: "faq", nom: "Questions et réponses", aide: "Toutes les questions recensées, chaque réponse adossée à une fiche" }
    ] },
    { id: "budget", libelle: "Budget", items: [
      { panneau: "simulateur", nom: "Simulateur", aide: "Salaire net, capacité d'emprunt, classe d'impôt" },
      { panneau: "comparateur", nom: "Comparateur", aide: "Habitation, auto, mobile et électricité, critère par critère" },
      { panneau: "avantages", nom: "Économies et avantages fiscaux", aide: "Ce que l'État rend ou ne prélève pas, et s'il faut le demander" },
      // Une rubrique dans sa propre page, et non un panneau : son code ne se
      // charge que si on l'ouvre.
      { rubrique: "epargne", page: "prevoyance/", nom: "Épargne et retraite", aide: "La déduction 111bis et les autres postes, chiffrée sur votre situation" }
    ] },
    { id: "lieu", libelle: "Où vivre", items: [
      { panneau: "carte", nom: "Comparer des logements", aide: "Écoles, crèches et transports autour de chaque adresse" },
      { panneau: "lignes", nom: "Bus, tram et train", aide: "Les arrêts d'où l'on rejoint le travail sans changement" },
      { panneau: "cartes", nom: "Les communes, chiffre par chiffre", aide: "Loyers, salaires, écoles et nationalités, au Luxembourg et chez les trois voisins" },
      { panneau: "jeux", nom: "Où jouer avec les enfants", aide: "Aires de jeux couvertes et parcs, filtrés par l'âge de l'enfant" }
    ] }
  ];

  // Une boussole : s'orienter, etre guide. La maison disait « s'installer », et
  // le site parle de toute la vie ici. Le blason de l'Etat a ete ecarte :
  // l'article 232bis du Code penal en reserve l'usage professionnel ou
  // publicitaire a une autorisation du gouvernement, et il ferait passer le
  // site pour une page officielle.
  var MARQUE =
    '<span class="mark" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" focusable="false">' +
    '<circle cx="12" cy="12" r="9"/><path d="M15.6 8.4 13.4 13.4 8.4 15.6 10.6 10.6z" fill="currentColor"/></svg></span>' +
    '<span class="brand-lock"><span class="brand-txt">Vivre</span><span class="brand-desc">au Luxembourg</span></span>';

  var ENGRENAGE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="3.1"/>' +
    '<path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.11a1.7 1.7 0 0 0-1.1-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.11a1.7 1.7 0 0 0 1.56-1.1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6h.08A1.7 1.7 0 0 0 10.13 3V3a2 2 0 1 1 4 0v.11a1.7 1.7 0 0 0 1.05 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.08a1.7 1.7 0 0 0 1.56 1.05H21a2 2 0 1 1 0 4h-.11a1.7 1.7 0 0 0-1.49 1z"/></svg>';

  var entete = document.getElementById("entete");
  if (!entete) return;
  var racine = entete.getAttribute("data-racine") || "";
  var guide = racine === "";
  var courant = entete.getAttribute("data-courant") || "";
  var volet = entete.getAttribute("data-assistant") || "";

  // ---------- Le theme ----------
  // Le reglage se fait dans les parametres du guide et se garde. Toute page du
  // site le suit, pas seulement celle ou on l'a choisi.
  try {
    var t = localStorage.getItem("luxguide.theme.v1");
    if (t === "clair") document.documentElement.setAttribute("data-theme", "light");
    else if (t === "sombre") document.documentElement.setAttribute("data-theme", "dark");
  } catch (e) { /* stockage indisponible : le systeme decide */ }

  // ---------- Le rendu ----------

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }

  function corps(it) { return "<b>" + esc(it.nom) + "</b><i>" + esc(it.aide) + "</i>"; }

  function item(it) {
    if (it.page) {
      var ici = it.rubrique === courant;
      // data-lien fait entrer un lien dans la navigation au clavier du menu,
      // comme les sections.
      return '<a role="menuitem" data-lien href="' + (ici ? "./" : esc(racine + it.page)) + '"' +
        (ici ? ' aria-current="page"' : "") + ">" + corps(it) + "</a>";
    }
    if (guide) {
      return '<button role="menuitem" id="tab-' + it.panneau + '" data-panel="' + it.panneau +
        '" aria-controls="panel-' + it.panneau + '">' + corps(it) + "</button>";
    }
    return '<a role="menuitem" data-lien href="' + esc(racine) + "#" + it.panneau + '">' + corps(it) + "</a>";
  }

  function famille(f) {
    var actif = f.items.some(function (it) { return it.rubrique && it.rubrique === courant; });
    return '<div class="grp"><button class="grp-btn' + (actif ? " actif" : "") + '" id="grp-' + f.id +
      '" aria-haspopup="true" aria-expanded="false" aria-controls="menu-' + f.id + '">' + esc(f.libelle) +
      '<span class="chev" aria-hidden="true"></span></button>' +
      '<div class="menu" id="menu-' + f.id + '" role="menu" aria-labelledby="grp-' + f.id + '" hidden>' +
      f.items.map(item).join("") + "</div></div>";
  }

  var h = '<div class="top-in">';
  h += guide
    ? '<button class="brand" id="brand" title="Vivre au Luxembourg. Revenir à l\'accueil" aria-label="Vivre au Luxembourg, revenir à l\'accueil">'
    : '<a class="brand" href="' + esc(racine) + '" title="Vivre au Luxembourg. Revenir à l\'accueil" aria-label="Vivre au Luxembourg, revenir à l\'accueil">';
  h += MARQUE + (guide ? "</button>" : "</a>");

  h += '<nav class="tabs" id="' + (guide ? "tabs" : "entete-tabs") + '" aria-label="Sections du guide">';
  h += guide
    ? '<button id="tab-accueil" data-panel="accueil" aria-controls="panel-accueil">Accueil</button>'
    : '<a class="entree" href="' + esc(racine) + '">Accueil</a>';
  h += FAMILLES.map(famille).join("");
  // L'assistant : celui du guide, ou celui de la rubrique quand elle a le sien.
  // Il est au meme endroit sur toutes les pages, et repond sur ce qu'on lit.
  if (guide) {
    h += '<button id="tab-assistant" data-panel="assistant" aria-controls="panel-assistant" class="tab-assistant">' +
      '<span class="tab-pt" aria-hidden="true"></span>Assistant</button>';
  } else if (volet) {
    h += '<button id="assistant-btn" class="tab-assistant" aria-expanded="false" aria-controls="' + esc(volet) + '">' +
      '<span class="tab-pt" aria-hidden="true"></span>Assistant</button>';
  } else {
    h += '<a class="entree tab-assistant" href="' + esc(racine) + '#assistant"><span class="tab-pt" aria-hidden="true"></span>Assistant</a>';
  }
  h += "</nav>";

  h += '<div class="top-outils">';
  h += guide
    ? '<button id="admin-btn" class="outil" data-panel="admin" title="Paramètres" aria-label="Paramètres">' + ENGRENAGE + "</button>"
    : '<a class="outil" href="' + esc(racine) + '#admin" title="Paramètres" aria-label="Paramètres">' + ENGRENAGE + "</a>";
  h += "</div></div>";
  entete.innerHTML = h;

  // ---------- Le comportement ----------

  var nav = entete.querySelector("nav.tabs");
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || entete).querySelectorAll(sel)); }

  // La barre tient sur une ligne et defile quand la fenetre est etroite. Un
  // fondu dit qu'il reste des entrees a gauche ou a droite, sinon on croit la
  // liste terminee.
  function majDefilement() {
    var reste = nav.scrollWidth - nav.clientWidth;
    if (reste <= 2) { nav.removeAttribute("data-defile"); return; }
    var g = nav.scrollLeft > 2, d = nav.scrollLeft < reste - 2;
    nav.setAttribute("data-defile", g && d ? "deux" : (g ? "gauche" : "droite"));
  }

  function menuDe(b) { return document.getElementById(b.getAttribute("aria-controls")); }

  function fermerMenus(sauf) {
    $$(".grp-btn").forEach(function (b) {
      if (b === sauf) return;
      b.setAttribute("aria-expanded", "false");
      var m = menuDe(b);
      if (m) m.hidden = true;
    });
  }

  // Place fixe : la bande de sections defile horizontalement sur telephone, et
  // un menu pose dedans y serait coupe. On le colle sous son bouton, sans le
  // laisser sortir de l'ecran par la droite.
  function placerMenu(b, m) {
    var r = b.getBoundingClientRect();
    m.style.top = Math.round(r.bottom + 7) + "px";
    m.style.left = "0px";
    var g = Math.min(r.left, window.innerWidth - m.offsetWidth - 10);
    m.style.left = Math.round(Math.max(8, g)) + "px";
  }

  function ouvrirMenu(b) {
    var m = menuDe(b);
    if (!m) return;
    fermerMenus(b);
    m.hidden = false;
    b.setAttribute("aria-expanded", "true");
    placerMenu(b, m);
  }

  $$(".grp-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      if (b.getAttribute("aria-expanded") === "true") fermerMenus(); else ouvrirMenu(b);
    });
    // Fleche bas : le menu s'ouvre et le premier choix prend le focus.
    b.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowDown") return;
      e.preventDefault();
      ouvrirMenu(b);
      var premier = menuDe(b).querySelector("[data-panel], [data-lien]");
      if (premier) premier.focus();
    });
  });

  // Dans un menu ouvert, les fleches circulent et Echap revient au bouton.
  $$(".menu").forEach(function (m) {
    m.addEventListener("keydown", function (e) {
      var b = m.parentNode.querySelector(".grp-btn");
      if (e.key === "Escape" || e.key === "Tab") {
        fermerMenus();
        if (e.key === "Escape" && b) { b.focus(); e.preventDefault(); }
        return;
      }
      var items = $$("[data-panel], [data-lien]", m);
      var i = items.indexOf(document.activeElement);
      if (i === -1) return;
      var j = null;
      if (e.key === "ArrowDown") j = (i + 1) % items.length;
      else if (e.key === "ArrowUp") j = (i - 1 + items.length) % items.length;
      else if (e.key === "Home") j = 0;
      else if (e.key === "End") j = items.length - 1;
      if (j === null) return;
      e.preventDefault();
      items[j].focus();
    });
  });

  // Un clic ailleurs, Echap ou un redimensionnement referment le menu : il est
  // place a la main, il ne suivrait pas la page.
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t && t.closest && t.closest("#entete .grp")) return;
    fermerMenus();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") fermerMenus(); });
  window.addEventListener("resize", function () { fermerMenus(); majDefilement(); });

  // Le defilement de la page ne ferme pas les menus : l'en-tete reste en haut,
  // le menu sous son bouton. Seul le defilement horizontal de la bande les
  // deplace, et donc les ferme.
  nav.addEventListener("scroll", function () { majDefilement(); fermerMenus(); }, { passive: true });

  // La molette verticale fait defiler la bande a la souris, ou le geste
  // horizontal n'existe pas.
  nav.addEventListener("wheel", function (e) {
    if (nav.scrollWidth <= nav.clientWidth + 2) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    nav.scrollLeft += e.deltaY;
    e.preventDefault();
  }, { passive: false });

  majDefilement();
  window.addEventListener("load", majDefilement);

  window.Entete = { nav: nav, fermerMenus: fermerMenus, majDefilement: majDefilement };
})();
