// Onglet « Où jouer » : les aires de jeux couvertes, rangées par âge.
//
// Module autonome, comme lignes.js et cartes.js. Il n'utilise rien de ui.js et
// n'y touche pas : il injecte son propre style, écrit son panneau à la demande
// et se réveille quand le panneau cesse d'être caché. Seules dépendances dans
// le reste du site : la présence de "jeux" dans PANNEAUX (app/ui.js) et
// l'entrée du menu (app/entete.js).
//
// Les données tiennent dans ce fichier : une poignée de lieux, aucune source
// ouverte ne les publie sous forme exploitable, et chaque ligne a été relevée à
// la main. Tout est générique et public, aucune donnée personnelle.

(function () {
  "use strict";

  var PANEL = "panel-jeux";
  var RELEVE = "26 octobre 2026";

  // min et max en années révolues. max null = pas de limite affichée.
  // Un lieu entre dans une tranche dès qu'il la recoupe, même en partie.
  var LIEUX = [
    {
      nom: "Spilly", commune: "Bertrange",
      adresse: "80 route de Longwy, L-8060 Bertrange, galerie City Concorde",
      tel: "+352 20 60 59 7", mail: "contact@spilly.lu",
      min: 0, max: 11,
      horaires: "Lundi à vendredi 9h à 18h, samedi 9h à 19h, dimanche 10h à 18h",
      quoi: "Mini-ville où l'on joue les métiers : pompier, médecin, boulanger, policier, coiffeur, restaurateur. Salles d'anniversaire et ateliers créatifs."
    },
    {
      nom: "ZigZag", commune: "Bertrange",
      adresse: "7 rue Pletzer, Helfent, Bertrange",
      tel: "+352 26 45 87 87", mail: "",
      min: 0, max: 10,
      horaires: "Mardi à jeudi 10h à 18h, vendredi 10h à 19h, samedi et dimanche 9h30 à 19h. Fermé le lundi",
      quoi: "Structures à grimper et toboggans, avec un espace séparé pour les moins de 3 ans et un espace 3 à 10 ans."
    },
    {
      nom: "The Little Gym", commune: "Bertrange",
      adresse: "5 rue Pletzer, Helfent, Bertrange",
      tel: "+352 26 45 99 13", mail: "",
      min: 0, max: 12,
      horaires: "Lundi 13h à 19h30, mardi à vendredi 9h30 à 19h30, samedi 8h30 à 19h, dimanche 8h30 à 14h",
      quoi: "Motricité et gymnastique encadrées, de 4 mois à 12 ans. Cours sur inscription, ce n'est pas une aire de jeux en accès libre."
    },
    {
      nom: "Yoyo", commune: "Howald",
      adresse: "105 rue des Bruyères, L-1274 Howald",
      tel: "", mail: "",
      min: 1, max: 12,
      horaires: "À vérifier auprès du lieu",
      quoi: "Grand espace couvert sur le thème de la jungle et des pirates, toboggan central de 9 m, coin pour les tout-petits, partie extérieure. Restaurant sur place."
    },
    {
      nom: "Fun City, la Ruée vers l'or", commune: "Pétange",
      adresse: "33 rue Robert Krieps, Pétange",
      tel: "+352 26 55 13 33 40", mail: "",
      min: 0, max: 14,
      horaires: "Mardi à jeudi 14h à 20h, vendredi 14h à 22h, samedi 10h à 22h, dimanche 10h à 20h. Fermé le lundi",
      quoi: "Parcours et structures sur le thème des chercheurs d'or, avec une zone 0 à 3 ans et une zone 4 à 14 ans."
    },
    {
      nom: "Ozone Trampoline et Ninja Park", commune: "Foetz",
      adresse: "11 rue du Brill, Foetz, Mondercange",
      tel: "+352 24 55 92 35", mail: "",
      min: 3, max: null,
      horaires: "Mardi et jeudi 14h à 18h, vendredi 16h à 18h, samedi 11h à 19h, dimanche 11h à 18h. Fermé lundi et mercredi",
      quoi: "Trampolines et parcours ninja à partir de 6 ans, aire de jeux séparée pour les moins de 6 ans, les 3 et 4 ans accompagnés d'un adulte."
    },
    {
      nom: "MIGO", commune: "Eschweiler",
      adresse: "2 Kirchewee, Eschweiler, Wiltz",
      tel: "+352 28 20 26 66", mail: "",
      min: 2, max: 12,
      horaires: "Mardi à jeudi 13h à 18h, samedi et dimanche 10h à 18h. Fermé lundi et vendredi",
      quoi: "Aire de jeux couverte pour les moins de 12 ans, avec une partie réservée aux plus petits et une partie 5 ans et plus."
    },
    {
      nom: "All In Family Fun Center", commune: "Heiderscheid",
      adresse: "22 Am Clemensbongert, Heiderscheid, Esch-sur-Sûre",
      tel: "+352 26 88 93 28", mail: "",
      min: 0, max: null,
      horaires: "Mardi et jeudi 12h à minuit, mercredi et vendredi 16h à minuit, samedi 10h à 1h, dimanche 10h à minuit. Fermé le lundi",
      quoi: "Aire de jeux pour les petits et, pour les grands, bowling et jeux. Les moins d'un an entrent sans payer."
    }
  ];

  var TRANCHES = [
    { id: "tout", nom: "Tous les âges", a: 0, b: 99 },
    { id: "bebe", nom: "Moins de 3 ans", a: 0, b: 2 },
    { id: "petit", nom: "3 à 6 ans", a: 3, b: 6 },
    { id: "moyen", nom: "7 à 10 ans", a: 7, b: 10 },
    { id: "grand", nom: "11 ans et plus", a: 11, b: 99 }
  ];

  var CLE = "luxguide.jeux.age";
  var choisie = "tout";
  var demarre = false;

  function $(s) { return document.querySelector(s); }

  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // ---------- style ----------

  function injecterStyle() {
    if (document.getElementById("style-jeux")) return;
    var s = document.createElement("style");
    s.id = "style-jeux";
    s.textContent = [
      ".jx-scroll{overflow-x:auto;margin-top:18px}",
      ".jx-tbl{width:100%;border-collapse:collapse;font-size:14px;min-width:720px}",
      ".jx-tbl th{font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;",
      "  color:var(--muted,#5b6472);font-weight:600;text-align:left;padding:9px 10px;white-space:nowrap}",
      ".jx-tbl td{padding:11px 10px;border-top:1px solid var(--border,#dfe3ea);vertical-align:top}",
      ".jx-tbl tbody tr:hover{background:var(--accent-soft,#eef3fb)}",
      ".jx-nom{font-weight:650}",
      ".jx-quoi{color:var(--muted,#5b6472);margin-top:3px;line-height:1.45;max-width:46ch}",
      ".jx-ou{white-space:normal;max-width:26ch}",
      ".jx-com{font-weight:600;display:block}",
      ".jx-h{color:var(--muted,#5b6472);max-width:26ch;line-height:1.45}",
      ".jx-age{display:inline-block;font-weight:700;font-size:12.5px;padding:3px 9px;border-radius:20px;",
      "  background:var(--accent-soft,#eef3fb);color:var(--accent,#2c6bed);white-space:nowrap}",
      ".jx-tel{white-space:nowrap}",
      ".jx-tel a{color:inherit}",
      ".jx-vide{color:var(--muted,#5b6472);padding:18px 2px}",
      ".jx-note{margin-top:18px;font-size:13.5px;color:var(--muted,#5b6472);line-height:1.6}",
      "@media(max-width:700px){.jx-quoi{display:none}}"
    ].join("\n");
    document.head.appendChild(s);
  }

  // ---------- rendu ----------

  function libelleAge(l) {
    if (l.min === 0 && l.max === null) return "Tous âges";
    if (l.max === null) return "Dès " + l.min + " ans";
    if (l.min === 0) return "Jusqu'à " + l.max + " ans";
    return l.min + " à " + l.max + " ans";
  }

  function retenus() {
    var t = TRANCHES.filter(function (x) { return x.id === choisie; })[0] || TRANCHES[0];
    return LIEUX.filter(function (l) {
      var max = l.max === null ? 99 : l.max;
      return l.min <= t.b && max >= t.a;
    });
  }

  function ligne(l) {
    var tel = l.tel
      ? '<a href="tel:' + esc(l.tel.replace(/\s/g, "")) + '">' + esc(l.tel) + "</a>"
      : '<span class="jx-vide">à vérifier</span>';
    if (l.mail) tel += '<br><a href="mailto:' + esc(l.mail) + '">' + esc(l.mail) + "</a>";
    return "<tr>" +
      '<td><div class="jx-nom">' + esc(l.nom) + "</div>" +
      '<div class="jx-quoi">' + esc(l.quoi) + "</div></td>" +
      '<td><span class="jx-age">' + esc(libelleAge(l)) + "</span></td>" +
      '<td class="jx-ou"><span class="jx-com">' + esc(l.commune) + "</span>" + esc(l.adresse) + "</td>" +
      '<td class="jx-h">' + esc(l.horaires) + "</td>" +
      '<td class="jx-tel">' + tel + "</td></tr>";
  }

  function dessiner() {
    var corps = $("#jx-corps");
    if (!corps) return;
    var lst = retenus();
    corps.innerHTML = lst.length
      ? lst.map(ligne).join("")
      : '<tr><td colspan="5" class="jx-vide">Aucun lieu retenu pour cette tranche.</td></tr>';
    document.querySelectorAll("#jx-tranches .chip").forEach(function (c) {
      var actif = c.getAttribute("data-tranche") === choisie;
      c.classList.toggle("actif", actif);
      c.setAttribute("aria-pressed", actif ? "true" : "false");
    });
  }

  function chips() {
    return TRANCHES.map(function (t) {
      return '<button class="chip" type="button" data-tranche="' + t.id +
        '" aria-pressed="false">' + esc(t.nom) + "</button>";
    }).join("");
  }

  function ecrire(p) {
    p.innerHTML =
      "<h1>Où jouer avec les enfants</h1>" +
      '<p class="lead">Les aires de jeux couvertes, par âge : un lieu qui ferme ses trampolines ' +
      "aux moins de 6 ans ne sert à rien avec un enfant de 4 ans.</p>" +
      '<div class="card">' +
      '<label for="jx-tranches">L\'âge de l\'enfant</label>' +
      '<div class="chips" id="jx-tranches">' + chips() + "</div>" +
      '<div class="jx-scroll"><table class="jx-tbl">' +
      "<thead><tr><th>Lieu</th><th>Âges</th><th>Où</th><th>Ouverture</th><th>Téléphone</th></tr></thead>" +
      '<tbody id="jx-corps"></tbody></table></div>' +
      '<p class="jx-note">Horaires et tranches d\'âge relevés le ' + RELEVE + " auprès des " +
      "annuaires et des pages des lieux. Les tarifs ne figurent pas ici : ils changent souvent, " +
      "varient selon la durée, le jour et l'âge, et aucune source publique ne les tient à jour. " +
      "Un appel avant de partir évite la porte fermée, en particulier le lundi, jour de fermeture " +
      "le plus fréquent.</p>" +
      "</div>" +
      '<div class="card">' +
      "<h2>Quand il fait beau</h2>" +
      "<p>Les mêmes journées se passent dehors, et là le pays est bien servi : le Parc Merveilleux " +
      "à Bettembourg (animaux, jeux et spectacles, tous âges), le Park Sënnesräich à Lullange et le " +
      "Jardin des Papillons à Grevenmacher pour les plus jeunes, le Minett Park au Fond-de-Gras et " +
      "le Vitarium de Luxlait à Roost à partir de 6 ans, et l'accrobranche pour les plus grands, " +
      "Accro-Park à Heiderscheid, Indian Forest à Vianden, Adventure Island à Echternach. " +
      "Chaque commune a aussi ses aires de jeux de quartier, gratuites et souvent vides en semaine.</p>" +
      "</div>";
  }

  function init() {
    if (demarre) return;
    var p = document.getElementById(PANEL);
    if (!p) return;
    demarre = true;
    injecterStyle();
    ecrire(p);
    try {
      var garde = localStorage.getItem(CLE);
      if (garde && TRANCHES.some(function (t) { return t.id === garde; })) choisie = garde;
    } catch (e) {}
    p.querySelector("#jx-tranches").addEventListener("click", function (ev) {
      var b = ev.target.closest(".chip");
      if (!b) return;
      choisie = b.getAttribute("data-tranche");
      try { localStorage.setItem(CLE, choisie); } catch (e) {}
      dessiner();
    });
    dessiner();
  }

  // Le panneau est caché tant qu'on n'a pas cliqué son entrée de menu.
  function surveiller() {
    var p = document.getElementById(PANEL);
    if (!p) return;
    var obs = new MutationObserver(function () { if (!p.hidden) init(); });
    obs.observe(p, { attributes: true, attributeFilter: ["hidden"] });
    if (!p.hidden) init();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", surveiller);
  else surveiller();
})();
