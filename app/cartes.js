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
  var KB = "cartes/communes_kb.js?v=5";
  var LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  var LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

  // Rampe séquentielle bleue, du clair au foncé. Six pas retenus sur les onze
  // de la rampe de référence, assez écartés pour rester distincts en impression
  // et pour les daltonismes courants, qui ne touchent pas la clarté.
  var RAMPE = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#104281"];
  var SANS = "#e8e8e6";

  var demarre = false, map = null, kb = null, courant = null, couche_nom = "communes";
  var couche = null, formes = {}, classes = null, selection = null, cadreTotal = null;
  var nation = null, natMode = "pct", indNation = null;

  // ---------- style ----------

  function injecterStyle() {
    if (document.getElementById("style-cartes")) return;
    var s = document.createElement("style");
    s.id = "style-cartes";
    s.textContent = [
      ".ct-vue{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px;margin-top:18px;align-items:start}",
      "#cartes-map{position:relative;height:min(74vh,620px);border-radius:var(--r-m,14px);overflow:hidden;",
      "  border:1px solid var(--border,#e6eaef);background:var(--surface,#fff)}",
      "#ct-cote{border:1px solid var(--border,#e6eaef);border-radius:var(--r-m,14px);overflow:hidden;",
      "  background:var(--surface,#fff)}",
      "#ct-cote h3{margin:0;padding:12px 14px 10px;font-size:13px;text-transform:uppercase;",
      "  letter-spacing:.05em;color:var(--muted,#6a7583);border-bottom:1px solid var(--border,#e6eaef)}",
      ".ct-choix{display:flex;flex-wrap:wrap;gap:7px;margin-top:6px}",
      ".ct-couches{display:flex;flex-wrap:wrap;gap:8px;padding-bottom:14px;",
      "  border-bottom:1px solid var(--border,#e6eaef)}",
      ".ct-couches .chip{font-weight:600}",
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
      // Plein écran : la carte sort du gabarit à deux colonnes et couvre la fenêtre.
      // Pas l'API Fullscreen du navigateur, qui est refusée dans une iframe et rend
      // la sortie imprévisible ; un simple position:fixed se comporte partout pareil.
      "#cartes-map.plein{position:fixed;inset:0;width:100vw;height:100vh;max-height:none;",
      "  z-index:4000;border-radius:0;border:0}",
      ".ct-btn{position:absolute;top:10px;right:10px;z-index:700;border:1px solid var(--border,#e6eaef);",
      "  background:var(--surface,#fff);color:var(--text,#0b0f16);border-radius:9px;padding:7px 11px;",
      "  font:600 13px/1 inherit;cursor:pointer;box-shadow:0 1px 4px rgba(11,15,22,.14)}",
      ".ct-btn:hover{background:var(--accent-soft,#eaf1fb)}",
      ".ct-mini{position:absolute;left:10px;bottom:22px;z-index:700;display:none;max-width:min(92vw,520px);",
      "  background:rgba(255,255,255,.94);border:1px solid var(--border,#e6eaef);border-radius:11px;",
      "  padding:11px 13px;box-shadow:0 2px 10px rgba(11,15,22,.16)}",
      "#cartes-map.plein .ct-mini{display:block}",
      ".ct-mini b.t{display:block;font-size:13px;margin-bottom:8px}",
      ".ct-mini .ct-legende{margin:0}",
      // Sélecteur de nationalité : 189 séries, une liste déroulante et non des puces.
      ".ct-nat{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
      ".ct-nat select{flex:1 1 190px;min-width:0;padding:7px 9px;border-radius:9px;font:inherit;font-size:13.5px;",
      "  border:1px solid var(--border,#e6eaef);background:var(--surface,#fff);color:var(--text,#0b0f16)}",
      ".ct-natlist{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:5px}",
      ".ct-natlist li{display:grid;grid-template-columns:1.5em 1fr auto auto;gap:9px;align-items:baseline;",
      "  font-size:13.5px;font-variant-numeric:tabular-nums}",
      ".ct-natlist li span.d{font-size:15px;text-align:center;color:var(--muted,#6a7583)}",
      ".ct-natlist li img.fl,#ct-sortie h2 img.fl,.ct-mini img.fl{display:inline-block;",
      "  border-radius:2px;box-shadow:0 0 0 1px rgba(11,15,22,.12);vertical-align:middle}",
      "#ct-sortie h2 img.fl{margin-right:9px;width:30px;height:22px}",
      ".ct-mini img.fl{margin-right:5px;width:18px;height:13px}",
      ".ct-natlist li b{font-weight:600;text-align:right}",
      ".ct-natlist li i{font-style:normal;color:var(--muted,#6a7583);text-align:right;min-width:3.4em}",
      ".ct-natlist li.on{background:var(--accent-soft,#eaf1fb);border-radius:7px}",
      ".ct-aide{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;",
      "  background:rgba(11,15,22,.42);color:#fff;font-size:15px;font-weight:600;z-index:600;",
      "  opacity:0;pointer-events:none;transition:opacity .18s;border-radius:var(--r-m,14px)}",
      ".ct-aide.on{opacity:1}",
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

  // Deux niveaux géographiques : les 100 communes, et les 24 quartiers de la
  // Ville de Luxembourg quand la source publie à ce grain. Tout le reste du
  // rendu passe par ces deux accesseurs et ne sait pas lequel est affiché.
  function zones() {
    return couche_nom === "quartiers" ? kb.quartiers.zones : kb.communes;
  }
  function listeIndic() {
    return couche_nom === "quartiers" ? kb.quartiers.indicateurs : kb.indicateurs;
  }
  function indic() {
    if (courant === "nation" && indNation) return indNation;
    return listeIndic().filter(function (i) { return i.id === courant; })[0];
  }

  // ---------- nationalités ----------
  //
  // 189 nationalités par commune : ce sont des séries, pas des indicateurs de la
  // liste. Les afficher toutes en boutons serait illisible et les ranger dans la
  // fiche de commune la rendrait interminable. La nationalité choisie est donc
  // recopiée dans i.nation, et tout le reste du rendu, classement et légende
  // compris, continue de lire un seul champ sans rien savoir de ce mécanisme.

  function nations() { return (kb && kb.nations) || []; }

  // Windows ne dessine pas les emoji de drapeau : il affiche les deux lettres du
  // pays dans un cadre. Là où le HTML le permet on met donc une image, et l'emoji
  // reste en texte de remplacement. Dans une liste déroulante, où seule du texte
  // est possible, on garde l'emoji.
  function drapeau(n) {
    if (!n || !n.a2) return '<span class="d">·</span>';
    return '<img class="fl" src="https://flagcdn.com/w20/' + n.a2 +
      '.png" width="20" height="15" loading="lazy" alt="' + (n.f || n.a2) + '">';
  }

  function infoNation(code) {
    var l = nations();
    for (var i = 0; i < l.length; i++) if (l[i].c === code) return l[i];
    return null;
  }

  function majNation() {
    var n = infoNation(nation);
    if (!n) { indNation = null; return; }
    kb.communes.forEach(function (c) {
      var t = c.i.nat_tot;
      delete c.i.nation;
      if (!t) return;
      // Le registre n'écrit pas les lignes à zéro : une commune où personne de
      // cette nationalité n'habite vaut zéro, pas « pas de donnée ». La peindre
      // en gris ferait croire à une absence de mesure.
      var v = (c.n || {})[nation] || 0;
      c.i.nation = natMode === "pct" ? Math.round(1000 * v / t) / 10 : v;
    });
    indNation = {
      id: "nation",
      nom: "Nationalité " + n.n.toLowerCase(),
      a2: n.a2,
      unite: natMode === "pct" ? "% des inscrits" : "personnes",
      fmt: natMode === "pct" ? "pct" : "ent",
      sens: 0,
      source: kb.nat_source,
      aide: kb.nat_aide + " Au total " + n.t.toLocaleString("fr-FR") +
        " personnes de cette nationalité dans le pays."
    };
  }

  function listeNations(c) {
    // Les nationalités d'une commune, la plus nombreuse d'abord.
    var t = c.i.nat_tot;
    if (!t || !c.n) return "";
    var l = Object.keys(c.n).map(function (k) {
      var n = infoNation(k) || { c: k, n: k, f: "", a2: "" };
      return { c: k, nom: n.n, f: n.f, a2: n.a2, v: c.n[k] };
    }).sort(function (a, b) { return b.v - a.v; });
    var h = '<h3 style="margin:20px 0 0">Nationalités, ' + l.length + " en tout</h3>" +
      '<ul class="ct-natlist">';
    l.slice(0, 15).forEach(function (x) {
      h += '<li data-nat="' + x.c + '"' + (x.c === nation ? ' class="on"' : "") + ">" +
        drapeau(x) + "<span>" + esc(x.nom) + "</span><b>" +
        x.v.toLocaleString("fr-FR") + "</b><i>" + (100 * x.v / t).toFixed(1).replace(".", ",") +
        " %</i></li>";
    });
    if (l.length > 15) {
      var reste = l.slice(15).reduce(function (a, x) { return a + x.v; }, 0);
      h += '<li><span class="d">·</span><span class="muted">' + (l.length - 15) +
        " autres nationalités</span><b>" + reste.toLocaleString("fr-FR") + "</b><i>" +
        (100 * reste / t).toFixed(1).replace(".", ",") + " %</i></li>";
    }
    return h + "</ul>";
  }
  function motZone(pluriel) {
    var q = couche_nom === "quartiers";
    return pluriel ? (q ? "quartiers" : "communes") : (q ? "quartier" : "commune");
  }

  function dessiner() {
    var ind = indic();
    var vals = zones().filter(function (c) { return c.i[courant] !== undefined; })
      .map(function (c) { return c.i[courant]; });
    var br = bornes(vals, RAMPE.length);
    classes = br;

    zones().forEach(function (c) {
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
    var c = zones().filter(function (x) { return x.nom === nom; })[0];
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
    var l = zones().filter(function (c) { return c.i[id] !== undefined; })
      .sort(function (a, b) { return b.i[id] - a.i[id]; });
    for (var i = 0; i < l.length; i++) if (l[i].nom === nom) return [i + 1, l.length];
    return null;
  }

  function fiche() {
    var k = document.getElementById("ct-fiche");
    if (!k) return;
    if (!selection) { k.innerHTML = ""; return; }
    var c = zones().filter(function (x) { return x.nom === selection; })[0];
    var h = '<div class="card ct-fiche"><h3 style="margin:0">' + esc(c.nom) +
      ' <span class="muted" style="font-weight:400;font-size:14px">canton de ' + esc(c.canton) + "</span></h3><dl>";
    var liste = listeIndic().slice();
    if (courant === "nation" && indNation) liste.unshift(indNation);
    liste.forEach(function (i) {
      var v = c.i[i.id], r = v === undefined ? null : rang(i.id, c.nom);
      h += "<dt>" + esc(i.nom) + "</dt><dd>" + nf(v, i.fmt) +
        (r ? '<small>&middot; ' + r[0] + "e sur " + r[1] + "</small>" : "") + "</dd>";
    });
    h += "</dl>";
    if (couche_nom === "communes") h += listeNations(c);
    h += "</div>";
    k.innerHTML = h;
    // Cliquer une nationalité de la fiche la porte sur la carte.
    k.querySelectorAll("li[data-nat]").forEach(function (li) {
      li.addEventListener("click", function () { choisirNation(li.dataset.nat); });
      li.style.cursor = "pointer";
    });
  }

  function choisirNation(code) {
    nation = code || null;
    majNation();
    if (nation) courant = "nation";
    else if (courant === "nation") courant = listeIndic()[0].id;
    boutons();
    dessiner();
    fiche();
  }

  function ecrire(vals, br, ind) {
    var k = document.getElementById("ct-sortie");
    var mini = Math.min.apply(null, vals), maxi = Math.max.apply(null, vals);
    var manquantes = zones().length - vals.length;

    var h = "<h2 style=\"margin-top:22px\">" + (ind.a2 ? drapeau(ind) + " " : "") + esc(ind.nom) +
      (ind.unite ? ' <span class="muted" style="font-weight:400;font-size:15px">en ' + esc(ind.unite) + "</span>" : "") +
      "</h2>";
    h += '<div class="ct-legende">';
    for (var i = 0; i < RAMPE.length; i++) {
      var bas = i === 0 ? mini : br[i - 1];
      var haut = i === RAMPE.length - 1 ? maxi : br[i];
      h += '<div class="lg"><b style="background:' + RAMPE[i] + '"></b><span>' +
        nf(bas, ind.fmt) + (i === RAMPE.length - 1 ? " et +" : "") + "</span></div>";
    }
    if (manquantes) h += '<div class="na"><i></i>' + manquantes + " " +
      motZone(manquantes > 1) + " sans donnée</div>";
    h += "</div>";

    h += '<p class="hint" style="margin-top:12px">' + esc(ind.aide || "") +
      (ind.aide ? " " : "") + "<strong>Source :</strong> " + esc(ind.source) +
      ". Six classes de même effectif, ce qui évite qu'une valeur extrême n'écrase " +
      "l'échelle : chaque couleur regroupe environ " + Math.round(vals.length / RAMPE.length) +
      " " + motZone(true) + ".</p>";

    k.innerHTML = h;

    // En plein écran, la légende de la colonne de droite n'est plus visible :
    // le même contenu est recopié dans un encart posé sur la carte.
    var encart = document.getElementById("ct-mini");
    if (encart) {
      encart.innerHTML = '<b class="t">' + (ind.a2 ? drapeau(ind) + " " : "") + esc(ind.nom) +
        (ind.unite ? ' <span class="muted" style="font-weight:400">en ' + esc(ind.unite) + "</span>" : "") +
        "</b>" + h.slice(h.indexOf('<div class="ct-legende">'), h.indexOf('<p class="hint"'));
    }

    var tri = zones().slice().sort(function (a, b) {
      var x = a.i[courant], y = b.i[courant];
      if (x === undefined) return 1;
      if (y === undefined) return -1;
      return y - x;
    });
    var t = "<h3>Classement des " + zones().length + " " + motZone(true) + "</h3>" +
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
    ["Louer", ["loyer_appt", "loyer_appt_m2"]],
    ["Acheter", ["prix_appt_m2", "prix_maison_m2", "prix_appt", "prix_maison"]],
    ["Salaires", ["sal_med", "sal_p10", "sal_p90", "sal_ratio", "sal_moy"]],
    ["Population", ["pop", "pop_evol", "dens"]],
    ["Nationalités", ["pct_etr", "pct_lux", "pct_eu", "pct_noneu"]],
    ["Emploi", ["chomage", "emploi"]]
  ];
  var GROUPES_QUARTIERS = [
    ["Louer", ["loyer_appt", "loyer_appt_m2"]],
    ["Acheter", ["prix_appt_m2", "prix_appt", "prix_maison_m2", "prix_maison"]]
  ];

  function boutons() {
    var k = document.getElementById("ct-choix");
    var quart = couche_nom === "quartiers";
    var dispo = listeIndic();
    var h = "";
    if (kb.quartiers) {
      h += '<div class="ct-couches">' +
        '<button class="chip' + (quart ? "" : " actif") + '" data-couche="communes">Les cent communes</button>' +
        '<button class="chip' + (quart ? " actif" : "") + '" data-couche="quartiers">' +
        esc(kb.quartiers.titre) + "</button></div>";
    }
    (quart ? GROUPES_QUARTIERS : GROUPES).forEach(function (g) {
      var dedans = g[1].filter(function (id) {
        return dispo.some(function (i) { return i.id === id; });
      });
      if (!dedans.length) return;
      h += '<div class="ct-groupe"><span>' + esc(g[0]) + '</span><div class="ct-choix">';
      dedans.forEach(function (id) {
        var ind = dispo.filter(function (i) { return i.id === id; })[0];
        h += '<button class="chip' + (id === courant ? " actif" : "") + '" data-ind="' + id + '">' +
          esc(ind.nom) + "</button>";
      });
      h += "</div></div>";
    });
    if (!quart && nations().length) {
      h += '<div class="ct-groupe"><span>Une nationalité en particulier</span><div class="ct-nat">' +
        '<select id="ct-nation"><option value="">Choisir parmi ' + nations().length + " nationalités…</option>";
      nations().forEach(function (n) {
        h += '<option value="' + n.c + '"' + (n.c === nation ? " selected" : "") + ">" +
          (n.f ? n.f + " " : "") + esc(n.n) + " (" + n.t.toLocaleString("fr-FR") + ")</option>";
      });
      h += "</select>" +
        '<button class="chip' + (natMode === "pct" ? " actif" : "") + '" data-mode="pct">en %</button>' +
        '<button class="chip' + (natMode === "nb" ? " actif" : "") + '" data-mode="nb">en nombre</button>' +
        "</div></div>";
    }
    if (quart) h += '<p class="hint" style="margin-top:14px">' + esc(kb.quartiers.note) + "</p>";
    k.innerHTML = h;
    var sel = document.getElementById("ct-nation");
    if (sel) sel.addEventListener("change", function () { choisirNation(sel.value); });
    k.querySelectorAll("button[data-mode]").forEach(function (b) {
      b.addEventListener("click", function () {
        natMode = b.dataset.mode;
        k.querySelectorAll("button[data-mode]").forEach(function (x) {
          x.classList.toggle("actif", x.dataset.mode === natMode);
        });
        if (!nation) return;
        majNation();
        courant = "nation";
        dessiner();
        fiche();
      });
    });
    k.querySelectorAll("button[data-ind]").forEach(function (b) {
      b.addEventListener("click", function () {
        courant = b.dataset.ind;
        nation = null;
        indNation = null;
        var s2 = document.getElementById("ct-nation");
        if (s2) s2.value = "";
        k.querySelectorAll("button[data-ind]").forEach(function (x) {
          x.classList.toggle("actif", x.dataset.ind === courant);
        });
        dessiner();
        fiche();
      });
    });
    k.querySelectorAll("button[data-couche]").forEach(function (b) {
      b.addEventListener("click", function () { changerCouche(b.dataset.couche); });
    });
  }

  function changerCouche(nom) {
    if (nom === couche_nom) return;
    couche_nom = nom;
    selection = null;
    // Garder l'indicateur courant s'il existe aussi dans l'autre niveau, sinon
    // prendre le premier proposé : passer de « salaire médian » aux quartiers,
    // qui n'ont pas de salaires, ne doit pas vider la carte.
    var dispo = listeIndic();
    // Les nationalités ne sont publiées qu'à la commune.
    if (nom === "quartiers") { nation = null; indNation = null; }
    if (!dispo.some(function (i) { return i.id === courant; })) courant = dispo[0].id;
    Object.keys(formes).forEach(function (n) {
      formes[n].forEach(function (p) { couche.removeLayer(p); });
    });
    formes = {};
    var tous = [];
    zones().forEach(function (c) {
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
    boutons();
    dessiner();
    fiche();
  }

  // Plein écran. L'API Fullscreen du navigateur est refusée dans une iframe et
  // sort de manière imprévisible ; une classe qui pose la carte en position fixe
  // se comporte de la même façon partout, et Échap la retire.
  function plein(m, idCarte, classeBouton, encart) {
    var boite = document.getElementById(idCarte);
    if (encart) boite.appendChild(encart());
    var b = document.createElement("button");
    b.className = classeBouton;
    b.type = "button";
    b.textContent = "Plein écran";
    function basculer(on) {
      boite.classList.toggle("plein", on);
      b.textContent = on ? "Quitter le plein écran" : "Plein écran";
      document.body.style.overflow = on ? "hidden" : "";
      setTimeout(function () { m.invalidateSize(); }, 60);
    }
    b.addEventListener("click", function () { basculer(!boite.classList.contains("plein")); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && boite.classList.contains("plein")) basculer(false);
    });
    boite.appendChild(b);
  }

  function creerCarte() {
    map = L.map("cartes-map", {
      preferCanvas: true, scrollWheelZoom: false,
      zoomSnap: 0, zoomDelta: 1, zoomAnimation: true, markerZoomAnimation: false
    }).setView([49.78, 6.09], 9);
    // Un geste de molette vaut exactement un niveau de zoom. Le gestionnaire de
    // Leaflet additionne les deltas de la souris puis en tire jusqu'à quatre
    // niveaux d'un coup, ce qui fait perdre la carte à chaque petit mouvement.
    // La cadence de 260 ms absorbe la rafale d'événements d'un seul cran.
    var dernier = 0;
    map.getContainer().addEventListener("wheel", function (e) {
      e.preventDefault();
      var now = Date.now();
      if (now - dernier < 260) return;
      dernier = now;
      var z = Math.round(map.getZoom()) + (e.deltaY > 0 ? -1 : 1);
      z = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), z));
      map.setZoomAround(map.mouseEventToLatLng(e), z, { animate: true });
    }, { passive: false });

    plein(map, "cartes-map", "ct-btn", function () {
      var d = document.createElement("div");
      d.className = "ct-mini";
      d.id = "ct-mini";
      return d;
    });

    L.tileLayer("https://wmts{s}.geoportail.lu/opendata/wmts/topomap_gray/GLOBAL_WEBMERCATOR/{z}/{x}/{y}.png", {
      subdomains: "1234", maxZoom: 19, opacity: .35,
      attribution: "Fond : geoportail.lu · Données : STATEC, ACT, Observatoire de l'Habitat"
    }).addTo(map);

    couche = L.layerGroup().addTo(map);
    var tous = [];
    cadreTotal = null;
    zones().forEach(function (c) {
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
