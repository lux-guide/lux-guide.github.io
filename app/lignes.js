// Onglet Lignes : toutes les lignes de transport qui arrivent à une adresse.
//
// Module autonome. Il n'utilise rien de ui.js et n'y touche pas : il injecte son
// propre style, charge Leaflet et sa base de lignes à la demande, et se réveille
// quand son panneau cesse d'être caché. Seule dépendance dans le reste du site :
// la présence de "lignes" dans PANNEAUX, et le bouton d'onglet dans index.html.
//
// Données : lignes/lignes_kb.js, construit depuis le GTFS national par
// lignes/build_lignes.py. Aucune donnée personnelle, ici comme ailleurs.

(function () {
  "use strict";

  var PANEL = "panel-lignes";
  var KB = "lignes/lignes_kb.js?v=1";
  var LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  var LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

  var demarre = false, map = null, cur = null, masquees = {};
  var couchesLignes = {}, coucheArrets = null, coucheDest = null;

  // ---------- style ----------

  function injecterStyle() {
    if (document.getElementById("style-lignes")) return;
    var s = document.createElement("style");
    s.id = "style-lignes";
    s.textContent = [
      "#lignes-map{position:relative;height:min(62vh,520px);border-radius:var(--r-m,14px);overflow:hidden;",
      "  border:1px solid var(--border,#dfe3ea);margin-top:20px;background:var(--surface,#fff)}",
      ".lg-badge{display:inline-block;min-width:36px;text-align:center;font-weight:700;",
      "  padding:2px 7px;border-radius:6px;color:#fff;font-size:12.5px;line-height:1.35}",
      ".lg-legende{display:flex;flex-wrap:wrap;gap:14px;margin:16px 0 4px;font-size:13px}",
      ".lg-legende span{display:inline-flex;align-items:center;gap:6px;color:var(--muted,#5b6472)}",
      ".lg-legende i{width:13px;height:13px;border-radius:50%;display:inline-block}",
      ".lg-tbl{width:100%;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums}",
      ".lg-tbl th{font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;",
      "  color:var(--muted,#5b6472);font-weight:600;text-align:left;padding:8px 8px;white-space:nowrap}",
      ".lg-tbl td{padding:8px 8px;border-top:1px solid var(--border,#dfe3ea);vertical-align:top}",
      ".lg-tbl td.n,.lg-tbl th.n{text-align:right;white-space:nowrap}",
      ".lg-tbl tbody tr{cursor:pointer}",
      ".lg-tbl tbody tr:hover{background:var(--accent-soft,#eef3fb)}",
      ".lg-filtre{width:100%;margin:10px 0 2px}",
      ".lg-scroll{max-height:380px;overflow:auto;margin-top:4px}",
      ".lg-resume{margin:18px 0 0;padding:14px 16px;border-radius:var(--r-m,14px);",
      "  background:var(--accent-soft,#eef3fb);font-size:14.5px}",
      ".lg-curseurs{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));margin-top:14px}",
      ".lg-curseurs output{font-weight:600;color:var(--accent,#1d4ed8)}",
      ".lg-curseurs input[type=range]{width:100%}",
      ".lg-aide{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;",
      "  background:rgba(11,15,22,.42);color:#fff;font-size:15px;font-weight:600;z-index:600;",
      "  opacity:0;pointer-events:none;transition:opacity .18s;border-radius:var(--r-m,14px)}",
      ".lg-aide.on{opacity:1}",
      "@media(max-width:760px){#lignes-map{height:min(52vh,380px)}}"
    ].join("");
    document.head.appendChild(s);
  }

  // ---------- chargements paresseux ----------

  function charger(url, type, cb) {
    var n;
    if (type === "css") {
      n = document.createElement("link"); n.rel = "stylesheet"; n.href = url;
      document.head.appendChild(n); return cb && cb();
    }
    n = document.createElement("script"); n.src = url;
    n.onload = function () { cb && cb(); };
    n.onerror = function () { message("Ressource indisponible : " + url + ". Cet onglet demande un accès réseau."); };
    document.head.appendChild(n);
  }

  function chargerTout(cb) {
    var reste = 0, fini = function () { if (--reste === 0) cb(); };
    if (!window.L) { reste += 1; charger(LEAFLET_CSS, "css"); charger(LEAFLET_JS, "js", fini); }
    if (!window.LIGNES) { reste += 1; charger(KB, "js", fini); }
    if (reste === 0) cb();
  }

  function message(txt) {
    var k = document.getElementById("lg-sortie");
    if (k) k.innerHTML = '<p class="muted">' + esc(txt) + "</p>";
  }

  // ---------- utilitaires ----------

  function $(s) { return document.querySelector(s); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  function norm(s) {
    return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ").trim();
  }
  function hav(a, b) {
    var R = 6371000, la1 = a[0] * Math.PI / 180, la2 = b[0] * Math.PI / 180;
    var dl = (b[1] - a[1]) * Math.PI / 180, dp = la2 - la1;
    var h = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(la1) * Math.cos(la2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  var PAL = ["#1d4ed8", "#c0392b", "#0e7a5f", "#c2740b", "#6d28d9", "#b8206a", "#0e7490",
             "#4d7c0f", "#c2410c", "#4338ca", "#0f766e", "#991b1b", "#1e40af", "#7e22ce"];
  var couleurs = {};
  function couleur(l) {
    if (!couleurs[l]) couleurs[l] = PAL[Object.keys(couleurs).length % PAL.length];
    return couleurs[l];
  }
  function bande(min) { return min <= 15 ? "#0e7a5f" : min <= 30 ? "#c2740b" : min <= 45 ? "#c2410c" : "#991b1b"; }
  function badge(l) { return '<span class="lg-badge" style="background:' + couleur(l) + '">' + esc(l) + "</span>"; }

  // Tracés : polyline encodée à 5 décimales, comme Google.
  function decoder(s) {
    var pts = [], i = 0, lat = 0, lon = 0, b, sh, r;
    while (i < s.length) {
      sh = 0; r = 0;
      do { b = s.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20);
      lat += (r & 1) ? ~(r >> 1) : (r >> 1);
      sh = 0; r = 0;
      do { b = s.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20);
      lon += (r & 1) ? ~(r >> 1) : (r >> 1);
      pts.push([lat / 1e5, lon / 1e5]);
    }
    return pts;
  }
  var cacheTrace = {};
  function trace(pi) {
    if (!cacheTrace[pi]) {
      var p = window.LIGNES.patterns[pi];
      cacheTrace[pi] = p[6] ? decoder(p[6]) : p[3].map(function (id) {
        var s = window.LIGNES.stops[id]; return [s[1], s[2]];
      });
    }
    return cacheTrace[pi];
  }
  function segment(pi, i, j) {
    var p = window.LIGNES.patterns[pi];
    if (p[6] && p[7] && p[7].length === p[3].length) return trace(pi).slice(p[7][i], p[7][j] + 1);
    return p[3].slice(i, j + 1).map(function (id) {
      var s = window.LIGNES.stops[id]; return [s[1], s[2]];
    });
  }

  function arretsProches(p, r) {
    var S = window.LIGNES.stops, o = [];
    for (var id in S) {
      var s = S[id], d = hav(p, [s[1], s[2]]);
      if (d <= r) o.push({ id: id, d: d, n: s[0] });
    }
    o.sort(function (a, b) { return a.d - b.d; });
    return o;
  }
  function arretExact(q) {
    var S = window.LIGNES.stops, nq = norm(q);
    if (nq.length < 4) return null;
    for (var id in S) if (norm(S[id][0]) === nq) return { id: id, n: S[id][0], ll: [S[id][1], S[id][2]] };
    return null;
  }

  // Géocodage : géoportail luxembourgeois d'abord, OpenStreetMap en secours.
  function geocoder(q) {
    var st = arretExact(q);
    if (st) return Promise.resolve({ ll: st.ll, label: st.n, stop: st.id });
    return fetch("https://api.geoportail.lu/geocode/search?queryString=" + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var r = (j.results || [])[0];
        if (r && r.geomlonlat && r.accuracy >= 6) {
          var c = r.geomlonlat.coordinates;
          return { ll: [c[1], c[0]], label: r.address };
        }
        return fetch("https://nominatim.openstreetmap.org/search?format=json&countrycodes=lu&limit=1&q=" + encodeURIComponent(q))
          .then(function (x) { return x.json(); })
          .then(function (a) {
            if (a[0]) return { ll: [+a[0].lat, +a[0].lon], label: a[0].display_name.split(",").slice(0, 3).join(",") };
            throw new Error("Adresse introuvable : " + q);
          });
      });
  }

  // ---------- calcul ----------

  function calculer() {
    var D = window.LIGNES, S = D.stops, P = D.patterns;
    var rayon = +$("#lg-rayon").value, tmax = +$("#lg-tmax").value * 60;
    var nmax = +$("#lg-nmax").value, hors = $("#lg-hors").checked;

    var dest = arretsProches(cur.ll, rayon);
    if (cur.stop && !dest.some(function (s) { return s.id === cur.stop; })) {
      dest.unshift({ id: cur.stop, d: 0, n: cur.label });
    }
    var estDest = {};
    dest.forEach(function (s) { estDest[s.id] = s.d; });

    var atteints = {}, lignes = {};
    P.forEach(function (p, pi) {
      var j = -1;
      for (var k = 0; k < p[3].length; k++) { if (estDest[p[3][k]] !== undefined) { j = k; break; } }
      if (j < 0) return;
      var nom = p[0];
      var L0 = lignes[nom] || (lignes[nom] = { line: nom, stops: {}, pats: [], am: 0, heads: {} });
      L0.pats.push(pi);
      L0.heads[p[2]] = 1;
      var arrivees = p[5].map(function (d) { return d + p[4][j]; })
        .filter(function (a) { return a >= 6.5 * 3600 && a < 9.5 * 3600; }).length;
      L0.am += arrivees;
      for (var i = 0; i < j; i++) {
        var sid = p[3][i], t = p[4][j] - p[4][i], nb = j - i;
        if (t <= 0 || t > tmax || nb > nmax) continue;
        if (!hors && !S[sid][3]) continue;
        var r = atteints[sid] || (atteints[sid] = { id: sid, best: 1e9, nb: 0, lines: {} });
        if (t < r.best) { r.best = t; r.nb = nb; }
        if (!r.lines[nom] || t < r.lines[nom].t) r.lines[nom] = { t: t, nb: nb, am: arrivees };
        if (!L0.stops[sid] || t < L0.stops[sid]) L0.stops[sid] = t;
      }
    });
    return { dest: dest, atteints: atteints, lignes: lignes, rayon: rayon };
  }

  // ---------- rendu ----------

  function dessiner() {
    var X = calculer(), S = window.LIGNES.stops;
    Object.keys(couchesLignes).forEach(function (k) { map.removeLayer(couchesLignes[k]); });
    couchesLignes = {};
    coucheArrets.clearLayers();
    coucheDest.clearLayers();

    L.marker(cur.ll, {
      icon: L.divIcon({
        className: "",
        html: '<div style="background:#0e7a5f;color:#fff;border-radius:50%;width:26px;height:26px;' +
              'line-height:26px;text-align:center;font-weight:700;font-size:13px;border:2px solid #fff;' +
              'box-shadow:0 1px 5px rgba(0,0,0,.4)">D</div>',
        iconSize: [26, 26], iconAnchor: [13, 13]
      })
    }).addTo(coucheDest).bindPopup(esc(cur.label));
    L.circle(cur.ll, { radius: X.rayon, color: "#0e7a5f", weight: 1, fillOpacity: .05 }).addTo(coucheDest);

    var listeLignes = Object.keys(X.lignes).map(function (k) { return X.lignes[k]; })
      .sort(function (a, b) { return Object.keys(b.stops).length - Object.keys(a.stops).length; });

    listeLignes.forEach(function (L0) {
      var g = L.layerGroup();
      L0.pats.forEach(function (pi) {
        var p = window.LIGNES.patterns[pi], j = -1, i0 = -1, k;
        for (k = 0; k < p[3].length; k++) {
          if (j < 0 && X.dest.some(function (s) { return s.id === p[3][k]; })) j = k;
          if (i0 < 0 && X.atteints[p[3][k]] && X.atteints[p[3][k]].lines[L0.line]) i0 = k;
        }
        if (j < 0 || i0 < 0 || i0 >= j) return;
        L.polyline(segment(pi, i0, j), { color: couleur(L0.line), weight: 3, opacity: .6 })
          .addTo(g).bindTooltip("Ligne " + L0.line + " vers " + esc(p[2]));
      });
      couchesLignes[L0.line] = g;
      if (!masquees[L0.line]) g.addTo(map);
    });

    var arrets = Object.keys(X.atteints).map(function (k) { return X.atteints[k]; })
      .sort(function (a, b) { return a.best - b.best; });
    var cadre = [cur.ll];
    arrets.forEach(function (r) {
      if (Object.keys(r.lines).every(function (l) { return masquees[l]; })) return;
      var s = S[r.id], m = Math.round(r.best / 60);
      cadre.push([s[1], s[2]]);
      var pop = "<b>" + esc(s[0]) + "</b><br>" + Object.keys(r.lines)
        .sort(function (a, b) { return r.lines[a].t - r.lines[b].t; })
        .map(function (l) {
          return badge(l) + " " + Math.round(r.lines[l].t / 60) + " min, " + r.lines[l].nb +
                 " arrêt" + (r.lines[l].nb > 1 ? "s" : "") + ", " + r.lines[l].am + " arrivées 6h30 à 9h30";
        }).join("<br>");
      L.circleMarker([s[1], s[2]], {
        radius: m <= 15 ? 7 : m <= 30 ? 6 : 5, color: "#fff", weight: 1.5,
        fillColor: bande(m), fillOpacity: .95
      }).addTo(coucheArrets).bindTooltip(esc(s[0]) + " · " + m + " min · " + r.nb + " arrêt" + (r.nb > 1 ? "s" : ""))
        .bindPopup(pop);
    });
    if (cadre.length > 1) map.fitBounds(L.latLngBounds(cadre).pad(.08));

    ecrire(X, listeLignes, arrets);
  }

  function ecrire(X, listeLignes, arrets) {
    var S = window.LIGNES.stops;
    var n15 = arrets.filter(function (r) { return r.best <= 900; }).length;
    var n30 = arrets.filter(function (r) { return r.best <= 1800; }).length;
    var h = '<div class="lg-resume"><strong>' + esc(cur.label) + "</strong><br>" +
      X.dest.length + " arrêt" + (X.dest.length > 1 ? "s" : "") + " à moins de " + X.rayon + " m : " +
      X.dest.slice(0, 4).map(function (s) { return esc(s.n); }).join(", ") +
      (X.dest.length > 4 ? " et " + (X.dest.length - 4) + " autres" : "") + ".<br>" +
      listeLignes.length + " ligne" + (listeLignes.length > 1 ? "s" : "") + ", " + arrets.length +
      " arrêts d'où l'on arrive sans changer, dont " + n15 + " en 15 minutes ou moins et " +
      n30 + " en 30 minutes ou moins.</div>";

    h += '<div class="lg-legende"><span><i style="background:#0e7a5f"></i>15 min ou moins</span>' +
      '<span><i style="background:#c2740b"></i>16 à 30</span>' +
      '<span><i style="background:#c2410c"></i>31 à 45</span>' +
      '<span><i style="background:#991b1b"></i>plus de 45</span></div>';

    h += "<h2>Les lignes</h2><table class=\"lg-tbl\"><thead><tr><th></th><th>Ligne</th><th>Vers</th>" +
      '<th class="n">Arrêts</th><th class="n">Arrivées 6h30 à 9h30</th></tr></thead><tbody>';
    listeLignes.forEach(function (L0) {
      h += '<tr data-ligne="' + esc(L0.line) + '"><td><input type="checkbox" data-chk="' + esc(L0.line) + '"' +
        (masquees[L0.line] ? "" : " checked") + "></td><td>" + badge(L0.line) + '</td><td class="muted">' +
        Object.keys(L0.heads).slice(0, 2).map(esc).join(" / ") + '</td><td class="n">' +
        Object.keys(L0.stops).length + '</td><td class="n">' + L0.am + "</td></tr>";
    });
    h += "</tbody></table>";

    h += "<h2>Les arrêts, du plus proche en temps de trajet</h2>" +
      '<input class="lg-filtre" id="lg-filtre" placeholder="Filtrer par nom d\'arrêt ou de commune">' +
      '<div class="lg-scroll"><table class="lg-tbl"><thead><tr><th>Arrêt</th><th class="n">Temps</th>' +
      '<th class="n">Arrêts</th><th>Lignes</th></tr></thead><tbody id="lg-arrets">';
    arrets.forEach(function (r) {
      var s = S[r.id];
      h += '<tr data-arret="' + r.id + '" data-n="' + esc(norm(s[0])) + '"><td>' + esc(s[0]) +
        '</td><td class="n" style="color:' + bande(r.best / 60) + ';font-weight:700">' +
        Math.round(r.best / 60) + ' min</td><td class="n">' + r.nb + "</td><td>" +
        Object.keys(r.lines).sort(function (a, b) { return r.lines[a].t - r.lines[b].t; })
          .map(badge).join(" ") + "</td></tr>";
    });
    h += "</tbody></table></div>";

    var k = document.getElementById("lg-sortie");
    k.innerHTML = h;

    k.querySelectorAll("input[data-chk]").forEach(function (c) {
      c.addEventListener("change", function () { masquees[c.dataset.chk] = !c.checked; dessiner(); });
    });
    k.querySelectorAll("tr[data-ligne]").forEach(function (tr) {
      tr.addEventListener("click", function (e) {
        if (e.target.tagName === "INPUT") return;
        var l = tr.dataset.ligne;
        var seule = Object.keys(X.lignes).every(function (x) { return x === l || masquees[x]; });
        masquees = {};
        if (!seule) Object.keys(X.lignes).forEach(function (x) { if (x !== l) masquees[x] = 1; });
        dessiner();
      });
    });
    k.querySelectorAll("tr[data-arret]").forEach(function (tr) {
      tr.addEventListener("click", function () {
        var s = S[tr.dataset.arret];
        map.setView([s[1], s[2]], 15);
        coucheArrets.eachLayer(function (m) {
          var p = m.getLatLng && m.getLatLng();
          if (p && p.lat === s[1] && p.lng === s[2]) m.openPopup();
        });
      });
    });
    var f = document.getElementById("lg-filtre");
    f.addEventListener("input", function () {
      var q = norm(this.value);
      k.querySelectorAll("tr[data-arret]").forEach(function (tr) {
        tr.style.display = !q || tr.dataset.n.indexOf(q) >= 0 ? "" : "none";
      });
    });
  }

  // ---------- démarrage ----------

  function chercher() {
    var q = $("#lg-adresse").value.trim();
    if (!q) return;
    message("Recherche…");
    geocoder(q).then(function (b) {
      cur = b; masquees = {};
      try { localStorage.setItem("luxguide.lignes.dst", q); } catch (e) {}
      dessiner();
    }).catch(function (e) { message(e.message); });
  }

  function creerCarte() {
    map = L.map("lignes-map", {
      preferCanvas: true, scrollWheelZoom: false,
      zoomSnap: 1, zoomDelta: 1, zoomAnimation: true, markerZoomAnimation: false
    }).setView([49.6116, 6.1319], 10);
    // La molette fait défiler la page, elle ne zoome pas : une carte posée au
    // milieu d'un texte ne doit pas piéger le défilement, et les souris envoient
    // des deltas si variables qu'un seul geste valait plusieurs niveaux. Le zoom
    // se fait au Ctrl (ou Cmd), comme sur les cartes intégrées ailleurs, aux
    // boutons + et -, ou au double-clic. Un bandeau le rappelle au premier essai.
    var aide = document.createElement("div");
    aide.className = "lg-aide";
    aide.textContent = "Ctrl + molette pour zoomer";
    map.getContainer().appendChild(aide);
    var minuteur = null;
    function rappeler() {
      aide.classList.add("on");
      clearTimeout(minuteur);
      minuteur = setTimeout(function () { aide.classList.remove("on"); }, 1100);
    }
    var dernier = 0;
    map.getContainer().addEventListener("wheel", function (e) {
      if (!e.ctrlKey && !e.metaKey) { rappeler(); return; }
      e.preventDefault();
      var now = Date.now();
      if (now - dernier < 220) return;
      dernier = now;
      var z = Math.round(map.getZoom()) + (e.deltaY > 0 ? -1 : 1);
      z = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), z));
      map.setZoomAround(map.mouseEventToLatLng(e), z, { animate: true });
    }, { passive: false });

    L.tileLayer("https://wmts{s}.geoportail.lu/opendata/wmts/topomap/GLOBAL_WEBMERCATOR/{z}/{x}/{y}.png", {
      subdomains: "1234", maxZoom: 19, updateWhenZooming: false, updateWhenIdle: true, keepBuffer: 3,
      attribution: "Fond de carte : Administration du cadastre et de la topographie, geoportail.lu"
    }).addTo(map);
    coucheArrets = L.layerGroup().addTo(map);
    coucheDest = L.layerGroup().addTo(map);
    map.on("click", function (e) {
      $("#lg-adresse").value = e.latlng.lat.toFixed(5) + ", " + e.latlng.lng.toFixed(5);
      cur = { ll: [e.latlng.lat, e.latlng.lng], label: "Point choisi sur la carte" };
      masquees = {};
      dessiner();
    });
  }

  function init() {
    if (demarre) return;
    demarre = true;
    injecterStyle();
    message("Chargement de la carte et des lignes…");
    chargerTout(function () {
      if (!window.L || !window.LIGNES) return;
      var m = window.LIGNES.meta;
      var p = document.getElementById("lg-source");
      if (p) {
        p.textContent = "Horaires du GTFS national " + m.source + ", jour de référence " + m.jour +
          " (un mardi ordinaire), " + m.n_stops + " arrêts et " + m.n_routes +
          " lignes, bus RGTR et AVL, tram et trains CFL. Base construite le " + m.construit +
          ". Temps de trajet médians, sans le temps d'attente.";
      }
      creerCarte();
      $("#lg-chercher").addEventListener("click", chercher);
      $("#lg-adresse").addEventListener("keydown", function (e) { if (e.key === "Enter") chercher(); });
      ["rayon", "tmax", "nmax"].forEach(function (id) {
        var i = $("#lg-" + id), o = $("#lg-" + id + "-v");
        i.addEventListener("input", function () { o.textContent = i.value + (id === "rayon" ? " m" : id === "tmax" ? " min" : ""); });
        i.addEventListener("change", function () { if (cur) dessiner(); });
      });
      $("#lg-hors").addEventListener("change", function () { if (cur) dessiner(); });
      document.querySelectorAll("#lg-exemples .chip").forEach(function (c) {
        c.addEventListener("click", function () { $("#lg-adresse").value = c.textContent; chercher(); });
      });
      var dernier = null;
      try { dernier = localStorage.getItem("luxguide.lignes.dst"); } catch (e) {}
      if (dernier) { $("#lg-adresse").value = dernier; chercher(); }
      else message("Indiquez le lieu où vous devez vous rendre, ou choisissez un exemple.");
      setTimeout(function () { map.invalidateSize(); }, 80);
    });
  }

  // Le panneau est caché tant qu'on n'a pas cliqué son onglet : on démarre au
  // premier affichage, et on recale la carte à chaque retour sur l'onglet.
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
