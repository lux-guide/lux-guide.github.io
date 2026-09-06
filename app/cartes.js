// Onglet Cartes : les 100 communes coloriées par indicateur.
//
// Module autonome, même principe que app/lignes.js : style injecté, Leaflet et
// base de données chargés à la demande, réveil quand le panneau cesse d'être caché.
// Rien de personnel ici, uniquement des statistiques publiques par commune.
//
// Données : cartes/communes_kb.js, construit par cartes/build_cartes.py depuis
// les limites administratives de l'ACT, l'API SDMX du STATEC et l'Observatoire
// de l'Habitat. Toutes ces sources sont en licence CC0 sur data.public.lu.
//
// Choix de représentation, et pourquoi :
//  1. Une seule teinte, du clair au foncé. Une carte de magnitude ne se lit pas
//     en arc-en-ciel : le lecteur doit pouvoir ordonner les couleurs sans légende.
//  2. Six classes par quantiles, pas par intervalles égaux. Luxembourg-Ville et
//     quelques communes du sud écrasent toute échelle linéaire : à intervalles
//     égaux, quatre-vingt-dix communes tomberaient dans la première classe.
//  3. Les bornes réelles de chaque classe sont écrites dans la légende, sinon la
//     couleur ne veut rien dire.
//  4. Les communes sans donnée sont grises et translucides, jamais peintes de la
//     couleur la plus claire : absence de mesure et valeur basse ne sont pas la
//     même chose, et les confondre ferait lire un prix bas là où il n'y a rien.

(function () {
  "use strict";

  var PANEL = "panel-cartes";
  var KB = "cartes/communes_kb.js?v=1";
  var LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  var LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

  // Rampe séquentielle bleue, du clair au foncé. Six pas retenus sur les onze
  // de la rampe de référence, assez écartés pour rester distincts en impression
  // et pour les daltonismes courants, qui ne touchent pas la clarté.
  var RAMPE = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#104281"];
  var SANS = "#e8e8e6";

  var demarre = false, map = null, kb = null, courant = null;
  var couche = null, formes = {}, classes = null, selection = null, cadreTotal = null;

  // ---------- style ----------

  function injecterStyle() {
    if (document.getElementById("style-cartes")) return;
    var s = document.createElement("style");
    s.id = "style-cartes";
    s.textContent = [
      ".ct-vue{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px;margin-top:18px;align-items:start}",
      "#cartes-map{height:min(74vh,620px);border-radius:var(--r-m,14px);overflow:hidden;",
      "  border:1px solid var(--border,#e6eaef);background:var(--surface,#fff)}",
      "#ct-cote{border:1px solid var(--border,#e6eaef);border-radius:var(--r-m,14px);overflow:hidden;",
      "  background:var(--surface,#fff)}",
      "#ct-cote h3{margin:0;padding:12px 14px 10px;font-size:13px;text-transform:uppercase;",
      "  letter-spacing:.05em;color:var(--muted,#6a7583);border-bottom:1px solid var(--border,#e6eaef)}",
      ".ct-choix{display:flex;flex-wrap:wrap;gap:7px;margin-top:6px}",
      ".ct-groupe{margin-top:14px}",
      ".ct-groupe > span{display:block;font-size:11.5px;text-transform:uppercase;letter-spacing:.06em;",
      "  color:var(--muted,#6a7583);font-weight:600;margin-bottom:6px}",
      ".ct-legende{display:flex;flex-wrap:wrap;align-items:center;gap:2px;margin:16px 0 2px}",
      ".ct-legende .lg{display:flex;flex-direction:column;align-items:stretch;min-width:74px}",
      ".ct-legende .lg b{height:14px;border-radius:2px;display:block}",
      ".ct-legende .lg span{font-size:11.5px;color:var(--muted,#6a7583);margin-top:5px;text-align:center;",
      "  font-variant-numeric:tabular-nums}",
      ".ct-legende .na{margin-left:14px;display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted,#6a7583)}",
      ".ct-legende .na i{width:16px;height:14px;border-radius:2px;display:inline-block;",
      "  background:#e8e8e6;border:1px solid #cfcfcb}",
      ".ct-tbl{width:100%;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums}",
      ".ct-tbl th{font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted,#6a7583);",
      "  font-weight:600;text-align:left;padding:8px;white-space:nowrap;cursor:pointer}",
      ".ct-tbl td{padding:7px 8px;border-top:1px solid var(--border,#e6eaef)}",
      ".ct-tbl td.n,.ct-tbl th.n{text-align:right;white-space:nowrap}",
      ".ct-tbl tbody tr{cursor:pointer}",
      ".ct-tbl tbody tr:hover,.ct-tbl tbody tr.on{background:var(--accent-soft,#eaf1fb)}",
      ".ct-jauge{height:7px;border-radius:4px;background:var(--border,#e6eaef);position:relative;min-width:60px}",
      ".ct-jauge i{position:absolute;left:0;top:0;bottom:0;border-radius:4px;display:block}",
      ".ct-scroll{max-height:min(74vh,620px);overflow:auto}",
      "#ct-cote .ct-scroll{max-height:calc(min(74vh,620px) - 42px)}",
      "#ct-cote .ct-tbl td{padding:6px 10px;font-size:13.5px}",
      "#ct-cote .ct-tbl th{padding:8px 10px}",
      ".ct-fiche{margin-top:18px}",
      ".ct-fiche dl{display:grid;grid-template-columns:1fr auto;gap:7px 18px;margin:12px 0 0}",
      ".ct-fiche dt{color:var(--muted,#6a7583);font-size:13.5px}",
      ".ct-fiche dd{margin:0;font-weight:600;font-variant-numeric:tabular-nums;text-align:right}",
      ".ct-fiche dd small{font-weight:400;color:var(--muted,#6a7583);margin-left:6px}",
      ".ct-tip{font-weight:600}",
      ".ct-tip small{display:block;font-weight:400;opacity:.75}",
      "@media(max-width:1000px){.ct-vue{grid-template-columns:1fr}#ct-cote .ct-scroll{max-height:340px}}",
      "@media(max-width:760px){#cartes-map{height:min(54vh,400px)}}"
    ].join("");
    document.head.appendChild(s);
  }

  // ---------- chargements ----------

  function charger(url, type, cb) {
    var n;
    if (type === "css") {
      n = document.createElement("link"); n.rel = "stylesheet"; n.href = url;
      document.head.appendChild(n); return cb && cb();
    }
    n = document.createElement("script"); n.src = url;
    n.onload = function () { cb && cb(); };
    n.onerror = function () { msg("Ressource indisponible : " + url + ". Cet onglet demande un accès réseau."); };
    document.head.appendChild(n);
  }

  function chargerTout(cb) {
    var reste = 0, fini = function () { if (--reste === 0) cb(); };
    if (!window.L) { reste += 1; charger(LEAFLET_CSS, "css"); charger(LEAFLET_JS, "js", fini); }
    if (!window.COMMUNES) { reste += 1; charger(KB, "js", fini); }
    if (reste === 0) cb();
  }

  function msg(t) {
    var k = document.getElementById("ct-sortie");
    if (k) k.innerHTML = '<p class="muted">' + esc(t) + "</p>";
  }

  // ---------- utilitaires ----------

  function $(s) { return document.querySelector(s); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

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

  function nf(v, fmt) {
    if (v === undefined || v === null) return "pas de donnée";
    if (fmt === "eur") return Math.round(v).toLocaleString("fr-FR") + " €";
    if (fmt === "pct") return v.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " %";
    if (fmt === "dec") return v.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
    return Math.round(v).toLocaleString("fr-FR");
  }

  // Quantiles : chaque classe reçoit à peu près le même nombre de communes.
  function bornes(vals, n) {
    var t = vals.slice().sort(function (a, b) { return a - b; }), out = [];
    for (var i = 1; i < n; i++) out.push(t[Math.floor(i * t.length / n)]);
    return out;
  }
  function classe(v, br) {
    for (var i = 0; i < br.length; i++) if (v < br[i]) return i;
    return br.length;
  }

  // ---------- rendu ----------

  function indic() {
    return kb.indicateurs.filter(function (i) { return i.id === courant; })[0];
  }

  function dessiner() {
    var ind = indic();
    var vals = kb.communes.filter(function (c) { return c.i[courant] !== undefined; })
      .map(function (c) { return c.i[courant]; });
    var br = bornes(vals, RAMPE.length);
    classes = br;

    kb.communes.forEach(function (c) {
      var v = c.i[courant], f = formes[c.nom];
      var ok = v !== undefined;
      f.forEach(function (poly) {
        poly.setStyle({
          fillColor: ok ? RAMPE[classe(v, br)] : SANS,
          fillOpacity: ok ? .82 : .45,
          color: "#ffffff", weight: 1
        });
        poly.unbindTooltip();
        poly.bindTooltip('<span class="ct-tip">' + esc(c.nom) + "<small>" +
          esc(ind.nom) + " : " + nf(v, ind.fmt) + "</small></span>", { sticky: true });
      });
    });
    if (selection) surligner(selection, true);
    ecrire(vals, br, ind);
  }

  function surligner(nom, on) {
    (formes[nom] || []).forEach(function (p) {
      p.setStyle({ color: on ? "#0b0f16" : "#ffffff", weight: on ? 2.5 : 1 });
      if (on) p.bringToFront();
    });
  }

  function choisir(nom) {
    if (selection && selection !== nom) surligner(selection, false);
    selection = nom;
    surligner(nom, true);
    var c = kb.communes.filter(function (x) { return x.nom === nom; })[0];
    if (c) map.panTo(c.c);
    fiche();
    var k = document.getElementById("ct-rangs");
    if (k) {
      k.querySelectorAll("tr").forEach(function (tr) {
        tr.classList.toggle("on", tr.dataset.nom === nom);
        if (tr.dataset.nom === nom && tr.scrollIntoView) {
          tr.scrollIntoView({ block: "nearest" });
        }
      });
    }
  }

  function rang(id, nom) {
    var l = kb.communes.filter(function (c) { return c.i[id] !== undefined; })
      .sort(function (a, b) { return b.i[id] - a.i[id]; });
    for (var i = 0; i < l.length; i++) if (l[i].nom === nom) return [i + 1, l.length];
    return null;
  }

  function fiche() {
    var k = document.getElementById("ct-fiche");
    if (!k) return;
    if (!selection) { k.innerHTML = ""; return; }
    var c = kb.communes.filter(function (x) { return x.nom === selection; })[0];
    var h = '<div class="card ct-fiche"><h3 style="margin:0">' + esc(c.nom) +
      ' <span class="muted" style="font-weight:400;font-size:14px">canton de ' + esc(c.canton) + "</span></h3><dl>";
    kb.indicateurs.forEach(function (i) {
      var v = c.i[i.id], r = v === undefined ? null : rang(i.id, c.nom);
      h += "<dt>" + esc(i.nom) + "</dt><dd>" + nf(v, i.fmt) +
        (r ? '<small>&middot; ' + r[0] + "e sur " + r[1] + "</small>" : "") + "</dd>";
    });
    h += "</dl></div>";
    k.innerHTML = h;
  }

  function ecrire(vals, br, ind) {
    var k = document.getElementById("ct-sortie");
    var mini = Math.min.apply(null, vals), maxi = Math.max.apply(null, vals);
    var manquantes = kb.communes.length - vals.length;

    var h = "<h2 style=\"margin-top:22px\">" + esc(ind.nom) +
      (ind.unite ? ' <span class="muted" style="font-weight:400;font-size:15px">en ' + esc(ind.unite) + "</span>" : "") +
      "</h2>";
    h += '<div class="ct-legende">';
    for (var i = 0; i < RAMPE.length; i++) {
      var bas = i === 0 ? mini : br[i - 1];
      var haut = i === RAMPE.length - 1 ? maxi : br[i];
      h += '<div class="lg"><b style="background:' + RAMPE[i] + '"></b><span>' +
        nf(bas, ind.fmt) + (i === RAMPE.length - 1 ? " et +" : "") + "</span></div>";
    }
    if (manquantes) h += '<div class="na"><i></i>' + manquantes + " commune" +
      (manquantes > 1 ? "s" : "") + " sans donnée</div>";
    h += "</div>";

    h += '<p class="hint" style="margin-top:12px">' + esc(ind.aide || "") +
      (ind.aide ? " " : "") + "<strong>Source :</strong> " + esc(ind.source) +
      ". Six classes de même effectif, environ dix-sept communes chacune, ce qui évite " +
      "que la capitale n'écrase l'échelle.</p>";

    k.innerHTML = h;

    var tri = kb.communes.slice().sort(function (a, b) {
      var x = a.i[courant], y = b.i[courant];
      if (x === undefined) return 1;
      if (y === undefined) return -1;
      return y - x;
    });
    var t = "<h3>Classement des cent communes</h3>" +
      '<div class="ct-scroll"><table class="ct-tbl"><tbody id="ct-rangs">';
    tri.forEach(function (c, idx) {
      var v = c.i[courant];
      var part = v === undefined ? 0 : Math.max(2, 100 * (v - mini) / (maxi - mini || 1));
      t += '<tr data-nom="' + esc(c.nom) + '"><td class="n muted" style="width:26px">' +
        (v === undefined ? "" : idx + 1) + "</td><td>" + esc(c.nom) +
        '</td><td class="n">' + nf(v, ind.fmt) + '</td><td style="width:64px"><div class="ct-jauge"><i style="width:' +
        part.toFixed(1) + "%;background:" + (v === undefined ? SANS : RAMPE[classe(v, br)]) +
        '"></i></div></td></tr>';
    });
    t += "</tbody></table></div>";
    var cote = document.getElementById("ct-cote");
    cote.innerHTML = t;
    cote.querySelectorAll("tr[data-nom]").forEach(function (tr) {
      tr.addEventListener("click", function () { choisir(tr.dataset.nom); });
      if (selection) tr.classList.toggle("on", tr.dataset.nom === selection);
    });
  }

  // ---------- démarrage ----------

  var GROUPES = [
    ["Logement", ["prix_appt_m2", "prix_maison_m2", "prix_appt", "prix_maison"]],
    ["Salaires", ["sal_med", "sal_p10", "sal_p90", "sal_ratio", "sal_moy"]],
    ["Population", ["pop", "pop_evol", "dens"]],
    ["Nationalités", ["pct_etr", "pct_lux", "pct_eu", "pct_noneu"]],
    ["Emploi", ["chomage", "emploi"]]
  ];

  function boutons() {
    var k = document.getElementById("ct-choix");
    var h = "";
    GROUPES.forEach(function (g) {
      h += '<div class="ct-groupe"><span>' + esc(g[0]) + '</span><div class="ct-choix">';
      g[1].forEach(function (id) {
        var ind = kb.indicateurs.filter(function (i) { return i.id === id; })[0];
        if (!ind) return;
        h += '<button class="chip' + (id === courant ? " actif" : "") + '" data-ind="' + id + '">' +
          esc(ind.nom) + "</button>";
      });
      h += "</div></div>";
    });
    k.innerHTML = h;
    k.querySelectorAll("button[data-ind]").forEach(function (b) {
      b.addEventListener("click", function () {
        courant = b.dataset.ind;
        k.querySelectorAll("button[data-ind]").forEach(function (x) {
          x.classList.toggle("actif", x.dataset.ind === courant);
        });
        dessiner();
        fiche();
      });
    });
  }

  function creerCarte() {
    map = L.map("cartes-map", {
      preferCanvas: true, scrollWheelZoom: false,
      zoomSnap: 0, zoomDelta: 1, zoomAnimation: true, markerZoomAnimation: false
    }).setView([49.78, 6.09], 9);
    var dernier = 0;
    map.getContainer().addEventListener("wheel", function (e) {
      e.preventDefault();
      var now = Date.now();
      if (now - dernier < 350) return;
      dernier = now;
      var z = Math.round(map.getZoom()) + (e.deltaY > 0 ? -1 : 1);
      z = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), z));
      map.setZoomAround(map.mouseEventToLatLng(e), z, { animate: true });
    }, { passive: false });

    L.tileLayer("https://wmts{s}.geoportail.lu/opendata/wmts/topomap_gray/GLOBAL_WEBMERCATOR/{z}/{x}/{y}.png", {
      subdomains: "1234", maxZoom: 19, opacity: .35,
      attribution: "Fond : geoportail.lu · Données : STATEC, ACT, Observatoire de l'Habitat"
    }).addTo(map);

    couche = L.layerGroup().addTo(map);
    var tous = [];
    cadreTotal = null;
    kb.communes.forEach(function (c) {
      formes[c.nom] = c.g.map(function (enc) {
        var pts = decoder(enc);
        tous = tous.concat(pts);
        var poly = L.polygon(pts, { color: "#fff", weight: 1, fillOpacity: .82 }).addTo(couche);
        poly.on("click", function () { choisir(c.nom); });
        return poly;
      });
    });
    cadreTotal = L.latLngBounds(tous);
    map.fitBounds(cadreTotal, { padding: [8, 8] });
  }

  function init() {
    if (demarre) return;
    demarre = true;
    injecterStyle();
    msg("Chargement des communes…");
    chargerTout(function () {
      if (!window.L || !window.COMMUNES) return;
      kb = window.COMMUNES;
      courant = "prix_appt_m2";
      var s = document.getElementById("ct-source");
      if (s) s.textContent = "Base construite le " + kb.meta.construit + " sur " + kb.meta.n +
        " communes. Sources : " + kb.meta.sources.join(" ; ") + ".";
      boutons();
      creerCarte();
      dessiner();
      setTimeout(function () {
        map.invalidateSize();
        if (cadreTotal) map.fitBounds(cadreTotal, { padding: [8, 8] });
      }, 120);
    });
  }

  function surveiller() {
    var p = document.getElementById(PANEL);
    if (!p) return;
    var obs = new MutationObserver(function () {
      if (p.hidden) return;
      init();
      if (map) setTimeout(function () {
        map.invalidateSize();
        if (!selection && cadreTotal) map.fitBounds(cadreTotal, { padding: [8, 8] });
      }, 60);
    });
    obs.observe(p, { attributes: true, attributeFilter: ["hidden"] });
    if (!p.hidden) init();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", surveiller);
  else surveiller();
})();
