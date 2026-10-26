// Onglet « Où jouer » : où emmener un enfant, rangé par âge, sur une carte.
//
// Module autonome, comme lignes.js et cartes.js. Il n'utilise rien de ui.js et
// n'y touche pas : il injecte son propre style, écrit son panneau à la demande,
// charge Leaflet au premier affichage et se réveille quand le panneau cesse
// d'être caché. Seules dépendances dans le reste du site : la présence de
// "jeux" dans PANNEAUX (app/ui.js) et l'entrée du menu (app/entete.js).
//
// Les données tiennent dans ce fichier : une poignée de lieux, aucune source
// ouverte ne les publie sous forme exploitable, et chaque ligne a été relevée à
// la main. Les coordonnées viennent du géocodeur officiel apiv3.geoportail.lu,
// figées ici pour que la carte s'affiche sans un appel de plus.
// Tout est générique et public, aucune donnée personnelle.

(function () {
  "use strict";

  var PANEL = "panel-jeux";
  var RELEVE = "26 octobre 2026";
  var LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  var LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

  // min et max en années révolues, max null = pas de limite affichée.
  // Un lieu entre dans une tranche dès qu'il la recoupe, même en partie.
  // couvert : ce qui tient un jour de pluie.
  var LIEUX = [
    {
      nom: "Spilly", commune: "Bertrange", couvert: true,
      adresse: "80 route de Longwy, L-8060 Bertrange, galerie City Concorde",
      tel: "+352 20 60 59 7", mail: "contact@spilly.lu",
      lat: 49.60126, lon: 6.06496, min: 0, max: 11,
      horaires: "Lundi à vendredi 9h à 18h, samedi 9h à 19h, dimanche 10h à 18h",
      quoi: "Mini-ville où l'on joue les métiers : pompier, médecin, boulanger, policier, coiffeur, restaurateur. Salles d'anniversaire et ateliers créatifs."
    },
    {
      nom: "ZigZag", commune: "Bertrange", couvert: true,
      adresse: "7 rue Pletzer, Helfent, L-8080 Bertrange",
      tel: "+352 26 45 87 87", mail: "",
      lat: 49.60343, lon: 6.07217, min: 0, max: 10,
      horaires: "Mardi à jeudi 10h à 18h, vendredi 10h à 19h, samedi et dimanche 9h30 à 19h. Fermé le lundi",
      quoi: "Structures à grimper et toboggans, avec un espace séparé pour les moins de 3 ans et un espace 3 à 10 ans."
    },
    {
      nom: "The Little Gym", commune: "Bertrange", couvert: true,
      adresse: "5 rue Pletzer, Helfent, L-8080 Bertrange",
      tel: "+352 26 45 99 13", mail: "",
      lat: 49.60339, lon: 6.07248, min: 0, max: 12,
      horaires: "Lundi 13h à 19h30, mardi à vendredi 9h30 à 19h30, samedi 8h30 à 19h, dimanche 8h30 à 14h",
      quoi: "Motricité et gymnastique encadrées, de 4 mois à 12 ans. Cours sur inscription, ce n'est pas une aire de jeux en accès libre."
    },
    {
      nom: "Yoyo", commune: "Howald", couvert: true,
      adresse: "105 rue des Bruyères, L-1274 Howald",
      tel: "", mail: "",
      lat: 49.57667, lon: 6.13734, min: 1, max: 12,
      horaires: "À vérifier auprès du lieu",
      quoi: "Grand espace couvert sur le thème de la jungle et des pirates, toboggan central de 9 m, coin pour les tout-petits, partie extérieure. Restaurant sur place."
    },
    {
      nom: "Fun City, la Ruée vers l'or", commune: "Pétange", couvert: true,
      adresse: "33 rue Robert Krieps, L-4702 Pétange",
      tel: "+352 26 55 13 33 40", mail: "",
      lat: 49.55579, lon: 5.86191, min: 0, max: 14,
      horaires: "Mardi à jeudi 14h à 20h, vendredi 14h à 22h, samedi 10h à 22h, dimanche 10h à 20h. Fermé le lundi",
      quoi: "Parcours et structures sur le thème des chercheurs d'or, avec une zone 0 à 3 ans et une zone 4 à 14 ans."
    },
    {
      nom: "Ozone Trampoline et Ninja Park", commune: "Foetz", couvert: true,
      adresse: "11 rue du Brill, L-3898 Foetz, Mondercange",
      tel: "+352 24 55 92 35", mail: "",
      lat: 49.52184, lon: 6.00636, min: 3, max: null,
      horaires: "Mardi et jeudi 14h à 18h, vendredi 16h à 18h, samedi 11h à 19h, dimanche 11h à 18h. Fermé lundi et mercredi",
      quoi: "Trampolines et parcours ninja à partir de 6 ans, aire de jeux séparée pour les moins de 6 ans, les 3 et 4 ans accompagnés d'un adulte."
    },
    {
      nom: "MIGO", commune: "Eschweiler", couvert: true,
      adresse: "2 Kiirchewee, L-9651 Eschweiler, Wiltz",
      tel: "+352 28 20 26 66", mail: "",
      lat: 49.99622, lon: 5.94850, min: 2, max: 12,
      horaires: "Mardi à jeudi 13h à 18h, samedi et dimanche 10h à 18h. Fermé lundi et vendredi",
      quoi: "Aire de jeux couverte pour les moins de 12 ans, avec une partie réservée aux plus petits et une partie 5 ans et plus."
    },
    {
      nom: "All In Family Fun Center", commune: "Heiderscheid", couvert: true,
      adresse: "22 Am Clemensbongert, L-9158 Heiderscheid, Esch-sur-Sûre",
      tel: "+352 26 88 93 28", mail: "",
      lat: 49.88594, lon: 5.98347, min: 0, max: null,
      horaires: "Mardi et jeudi 12h à minuit, mercredi et vendredi 16h à minuit, samedi 10h à 1h, dimanche 10h à minuit. Fermé le lundi",
      quoi: "Aire de jeux pour les petits et, pour les grands, bowling et jeux. Les moins d'un an entrent sans payer."
    },
    {
      nom: "Parc Merveilleux", commune: "Bettembourg", couvert: false,
      adresse: "Route de Mondorf, L-3260 Bettembourg",
      tel: "+352 51 10 48 1", mail: "parc@parc-merveilleux.lu",
      lat: 49.51430, lon: 6.10786, min: 0, max: null,
      horaires: "Fermé pour la pause hivernale, réouverture le 20 mars 2027",
      quoi: "Animaux, aires de jeux, contes et petit train, de quoi tenir la journée entière. L'école zoologique prend les enfants dès 3 ans, et les apprentis soigneurs de 6 à 12 ans."
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
  var demarre = false, map = null, couche = null, marqueurs = {};

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
      ".jx-scroll{overflow-x:auto;margin-top:16px}",
      ".jx-tbl{width:100%;border-collapse:collapse;font-size:14px;min-width:720px}",
      ".jx-tbl th{font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;",
      "  color:var(--muted,#5b6472);font-weight:600;text-align:left;padding:9px 10px;white-space:nowrap}",
      ".jx-tbl td{padding:11px 10px;border-top:1px solid var(--border,#dfe3ea);vertical-align:top}",
      ".jx-tbl tbody tr{cursor:pointer}",
      ".jx-tbl tbody tr:hover{background:var(--accent-soft,#eef3fb)}",
      ".jx-nom{font-weight:650}",
      ".jx-dehors{font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.04em;",
      "  color:#1d7a4c;background:#e6f5ec;border-radius:20px;padding:2px 8px;margin-left:7px;white-space:nowrap}",
      ".jx-quoi{color:var(--muted,#5b6472);margin-top:3px;line-height:1.45;max-width:46ch}",
      ".jx-ou{max-width:26ch}",
      ".jx-com{font-weight:600;display:block}",
      ".jx-h{color:var(--muted,#5b6472);max-width:26ch;line-height:1.45}",
      ".jx-age{display:inline-block;font-weight:700;font-size:12.5px;padding:3px 9px;border-radius:20px;",
      "  background:var(--accent-soft,#eef3fb);color:var(--accent,#2c6bed);white-space:nowrap}",
      ".jx-tel{white-space:nowrap}",
      ".jx-tel a{color:inherit}",
      ".jx-vide{color:var(--muted,#5b6472)}",
      "#jx-map{height:min(52vh,420px);border-radius:var(--r-m,14px);overflow:hidden;margin-top:18px;",
      "  border:1px solid var(--border,#dfe3ea);background:var(--surface,#fff)}",
      ".jx-pop b{font-size:14px}",
      ".jx-pop div{color:#5b6472;margin-top:3px;line-height:1.4}",
      ".jx-note{margin-top:16px;font-size:13.5px;color:var(--muted,#5b6472);line-height:1.6}",
      "@media(max-width:700px){.jx-quoi{display:none}}"
    ].join("\n");
    document.head.appendChild(s);
  }

  // ---------- données ----------

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

  // ---------- tableau ----------

  function ligne(l, i) {
    var tel = l.tel
      ? '<a href="tel:' + esc(l.tel.replace(/\s/g, "")) + '">' + esc(l.tel) + "</a>"
      : '<span class="jx-vide">à vérifier</span>';
    if (l.mail) tel += '<br><a href="mailto:' + esc(l.mail) + '">' + esc(l.mail) + "</a>";
    return '<tr data-i="' + i + '">' +
      '<td><div class="jx-nom">' + esc(l.nom) +
      (l.couvert ? "" : '<span class="jx-dehors">plein air</span>') + "</div>" +
      '<div class="jx-quoi">' + esc(l.quoi) + "</div></td>" +
      '<td><span class="jx-age">' + esc(libelleAge(l)) + "</span></td>" +
      '<td class="jx-ou"><span class="jx-com">' + esc(l.commune) + "</span>" + esc(l.adresse) + "</td>" +
      '<td class="jx-h">' + esc(l.horaires) + "</td>" +
      '<td class="jx-tel">' + tel + "</td></tr>";
  }

  function dessiner() {
    var corps = document.getElementById("jx-corps");
    if (!corps) return;
    var lst = retenus();
    corps.innerHTML = lst.length
      ? lst.map(function (l) { return ligne(l, LIEUX.indexOf(l)); }).join("")
      : '<tr><td colspan="5" class="jx-vide">Aucun lieu retenu pour cette tranche.</td></tr>';
    document.querySelectorAll("#jx-tranches .chip").forEach(function (c) {
      var actif = c.getAttribute("data-tranche") === choisie;
      c.classList.toggle("actif", actif);
      c.setAttribute("aria-pressed", actif ? "true" : "false");
    });
    poser(lst);
  }

  // ---------- carte ----------

  function charger(url, type, cb) {
    var n;
    if (type === "css") {
      n = document.createElement("link"); n.rel = "stylesheet"; n.href = url;
      document.head.appendChild(n); return cb && cb();
    }
    n = document.createElement("script"); n.src = url;
    n.onload = function () { cb && cb(); };
    document.head.appendChild(n);
  }

  function creerCarte() {
    map = L.map("jx-map", { scrollWheelZoom: false, zoomSnap: 1 }).setView([49.75, 6.1], 9);
    L.tileLayer("https://wmts{s}.geoportail.lu/opendata/wmts/topomap/GLOBAL_WEBMERCATOR/{z}/{x}/{y}.png", {
      subdomains: "1234", maxZoom: 19, updateWhenIdle: true,
      attribution: "Fond de carte : Administration du cadastre et de la topographie, geoportail.lu"
    }).addTo(map);
    couche = L.layerGroup().addTo(map);
  }

  function poser(lst) {
    if (!map || !couche) return;
    couche.clearLayers();
    marqueurs = {};
    if (!lst.length) return;
    lst.forEach(function (l) {
      var m = L.marker([l.lat, l.lon]).bindPopup(
        '<div class="jx-pop"><b>' + esc(l.nom) + "</b>" +
        "<div>" + esc(libelleAge(l)) + (l.couvert ? ", couvert" : ", plein air") + "</div>" +
        "<div>" + esc(l.adresse) + "</div>" +
        (l.tel ? "<div>" + esc(l.tel) + "</div>" : "") + "</div>");
      m.addTo(couche);
      marqueurs[LIEUX.indexOf(l)] = m;
    });
    map.fitBounds(L.latLngBounds(lst.map(function (l) { return [l.lat, l.lon]; })).pad(0.08));
  }

  function montrer(i) {
    var m = marqueurs[i];
    if (!m) return;
    map.setView(m.getLatLng(), Math.max(map.getZoom(), 13), { animate: true });
    m.openPopup();
    document.getElementById("jx-map").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // ---------- panneau ----------

  function chips() {
    return TRANCHES.map(function (t) {
      return '<button class="chip" type="button" data-tranche="' + t.id +
        '" aria-pressed="false">' + esc(t.nom) + "</button>";
    }).join("");
  }

  function ecrire(p) {
    p.innerHTML =
      "<h1>Où jouer avec les enfants</h1>" +
      '<p class="lead">Un lieu qui ferme ses trampolines aux moins de 6 ans ne sert à rien ' +
      "avec un enfant de 4 ans : choisissez l'âge, la liste et la carte ne gardent que ceux " +
      "qui l'accueillent vraiment.</p>" +
      '<div class="card">' +
      '<label for="jx-tranches">L\'âge de l\'enfant</label>' +
      '<div class="chips" id="jx-tranches">' + chips() + "</div>" +
      '<div class="jx-scroll"><table class="jx-tbl">' +
      "<thead><tr><th>Lieu</th><th>Âges</th><th>Où</th><th>Ouverture</th><th>Téléphone</th></tr></thead>" +
      '<tbody id="jx-corps"></tbody></table></div>' +
      '<div id="jx-map"></div>' +
      '<p class="jx-note">Cliquer une ligne la montre sur la carte. Horaires et tranches ' +
      "d'âge relevés le " + RELEVE + " auprès des annuaires et des pages des lieux, les " +
      "coordonnées auprès du géocodeur officiel. Les tarifs ne figurent pas ici : ils changent " +
      "souvent, varient selon la durée, le jour et l'âge, et aucune source publique ne les tient " +
      "à jour. Un appel avant de partir évite la porte fermée, en particulier le lundi, jour de " +
      "fermeture le plus fréquent.</p>" +
      "</div>" +
      '<div class="card">' +
      "<h2>Les autres sorties de plein air</h2>" +
      "<p>Le Park Sënnesräich à Lullange et le Jardin des Papillons à Grevenmacher pour les plus " +
      "jeunes, le Minett Park au Fond-de-Gras et le Vitarium de Luxlait à Roost à partir de 6 ans, " +
      "et l'accrobranche pour les plus grands : Accro-Park à Heiderscheid, Indian Forest à Vianden, " +
      "Adventure Island à Echternach. Chaque commune a aussi ses aires de jeux de quartier, " +
      "gratuites et souvent vides en semaine.</p>" +
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
    p.querySelector("#jx-corps").addEventListener("click", function (ev) {
      var tr = ev.target.closest("tr[data-i]");
      if (tr) montrer(Number(tr.getAttribute("data-i")));
    });
    dessiner();
    if (window.L) { creerCarte(); dessiner(); }
    else {
      charger(LEAFLET_CSS, "css");
      charger(LEAFLET_JS, "js", function () { creerCarte(); dessiner(); });
    }
  }

  // Le panneau est caché tant qu'on n'a pas cliqué son entrée de menu.
  function surveiller() {
    var p = document.getElementById(PANEL);
    if (!p) return;
    var obs = new MutationObserver(function () {
      if (p.hidden) return;
      init();
      if (map) setTimeout(function () { map.invalidateSize(); }, 60);
    });
    obs.observe(p, { attributes: true, attributeFilter: ["hidden"] });
    if (!p.hidden) init();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", surveiller);
  else surveiller();
})();
