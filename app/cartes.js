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
  // Déroulé du temps : année affichée, échelle de couleurs calculée une fois
  // sur toute la période, et minuteur de la lecture automatique.
  var annee = null, echelleFixe = null, minuteur = null;
  // Comparaison : deux cartes autonomes, leurs indicateurs, leurs formes.
  // Plusieurs nationalités comparées sur une carte : une couleur par
  // nationalité choisie, six au plus, au-delà l'oeil ne les distingue plus.
  var natSel = [];
  // Famille d'indicateurs ouverte dans le sélecteur, et communes retenues
  // pour la comparaison (cinq au plus : au-delà le tableau ne se lit plus).
  var famille = null, panierCommunes = [];
  var CAT = ["#2563eb", "#d1620a", "#0f8b57", "#8b3fd1", "#c2185b", "#00757f"];
  var comparer = false, cartesCmp = [null, null], formesCmp = [{}, {}];
  var indCmp = ["loyer_appt", "sal_med"], syncCmp = false;

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
      // Sélecteur en deux rangées : les familles, puis les indicateurs de la
      // famille ouverte. Quarante-huit boutons d'un bloc ne se lisaient plus.
      ".ct-familles{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}",
      ".ct-familles button{border:0;background:none;color:var(--muted,#6a7583);font:inherit;",
      "  font-size:13.5px;font-weight:500;padding:7px 11px;border-radius:9px;cursor:pointer}",
      ".ct-familles button:hover{color:var(--text,#0b0f16);background:var(--surface-2,#f4f6f9)}",
      ".ct-familles button.actif{color:var(--accent,#2563eb);font-weight:600;",
      "  background:var(--accent-soft,#eaf1fb)}",
      ".ct-indics{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px;padding-top:12px;",
      "  border-top:1px solid var(--border,#e6eaef)}",
      // Comparateur de communes : un tableau, une colonne par commune, les
      // indicateurs en lignes par famille. Il sert pour une commune comme
      // pour cinq, avec la même forme.
      ".ct-cmpc{margin-top:18px}",
      ".ct-cmpc .tete{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}",
      ".ct-cmpc .tete select{flex:1 1 220px;min-width:0;padding:8px 10px;border-radius:10px;",
      "  font:inherit;font-size:13.5px;border:1px solid var(--border-fort,#d4dae2);",
      "  background:var(--surface,#fff);color:var(--text,#0b0f16)}",
      ".ct-cmpc table{width:100%;border-collapse:collapse;font-size:13.5px;",
      "  font-variant-numeric:tabular-nums}",
      ".ct-cmpc th,.ct-cmpc td{padding:7px 10px;border-top:1px solid var(--border,#e6eaef);",
      "  text-align:right;vertical-align:middle}",
      ".ct-cmpc th:first-child,.ct-cmpc td:first-child{text-align:left}",
      ".ct-cmpc thead th{border-top:0;font-weight:600;font-size:14px;vertical-align:bottom}",
      ".ct-cmpc thead th small{display:block;font-weight:400;color:var(--muted,#6a7583);",
      "  font-size:12px}",
      ".ct-cmpc tr.fam td{padding-top:16px;padding-bottom:4px;border-top:0;font-size:11.5px;",
      "  text-transform:uppercase;letter-spacing:.06em;color:var(--muted,#6a7583);font-weight:600}",
      ".ct-cmpc td b{font-weight:600}",
      ".ct-cmpc td small{color:var(--muted,#6a7583);font-size:11.5px;margin-left:5px;white-space:nowrap}",
      ".ct-cmpc td svg{vertical-align:middle;margin-left:8px}",
      ".ct-cmpc td.meilleur b{color:var(--accent,#2563eb)}",
      ".ct-cmpc .defil{overflow-x:auto}",
      ".ct-cmpc tr.ind:hover td{background:var(--surface-2,#f4f6f9)}",
      ".ct-cmpc tr.ind td:first-child{cursor:pointer}",
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
      ".ct-natpuces{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}",
      ".ct-natpuce{display:inline-flex;align-items:center;gap:7px;padding:5px 9px;border-radius:999px;",
      "  border:1px solid var(--border-fort,#d4dae2);background:var(--surface,#fff);font-size:13px;",
      "  cursor:pointer}",
      ".ct-natpuce i{width:11px;height:11px;border-radius:3px;display:inline-block;flex:none}",
      ".ct-natpuce b{font-weight:600}",
      ".ct-natpuce span.x{color:var(--muted,#6a7583);font-weight:600}",
      ".ct-legende .cat{display:flex;align-items:center;gap:7px;margin-right:16px;font-size:12.5px}",
      ".ct-legende .cat i{width:14px;height:14px;border-radius:3px;display:inline-block}",
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
      // Le temps : un curseur, une année lisible, un bouton de lecture. La barre
      // se pose sous la carte, à la largeur de la carte, parce que c'est la
      // carte qu'elle commande.
      // Deux cartes côte à côte. Elles partagent le cadrage et le survol : sans
      // cela l'oeil doit refaire à chaque fois le trajet entre deux dessins qui
      // ne se superposent pas, et la comparaison ne se fait plus.
      ".ct-cmp{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px}",
      "@media(max-width:900px){.ct-cmp{grid-template-columns:1fr}}",
      ".ct-cmp .vue{border:1px solid var(--border,#e6eaef);border-radius:var(--r-m,14px);",
      "  overflow:hidden;background:var(--surface,#fff)}",
      ".ct-cmp .vue > .carte{height:min(52vh,420px)}",
      ".ct-cmp .vue > .bas{padding:11px 13px 13px;border-top:1px solid var(--border,#e6eaef)}",
      ".ct-cmp select{width:100%;padding:8px 10px;border-radius:10px;font:inherit;font-size:13.5px;",
      "  border:1px solid var(--border-fort,#d4dae2);background:var(--surface,#fff);",
      "  color:var(--text,#0b0f16)}",
      ".ct-cmp .ct-legende{margin:12px 0 0}",
      ".ct-cmp .val{font-variant-numeric:tabular-nums;font-weight:600;margin-top:9px;font-size:14px}",
      ".ct-cmp .val span{color:var(--muted,#6a7583);font-weight:400}",
      // Inégalités : une courbe du pays sous la carte des communes, pour dire
      // ce que la carte ne mesure pas.
      ".ct-ineg{margin-top:18px}",
      ".ct-ineg .deux{display:grid;grid-template-columns:1.3fr 1fr;gap:22px;align-items:start}",
      "@media(max-width:820px){.ct-ineg .deux{grid-template-columns:1fr}}",
      ".ct-ineg h4{margin:0 0 4px;font-size:14.5px}",
      ".ct-ineg .chiffres{display:grid;gap:10px;margin-top:4px}",
      ".ct-ineg .c{display:flex;justify-content:space-between;align-items:baseline;gap:14px;",
      "  border-bottom:1px solid var(--border,#e6eaef);padding-bottom:7px}",
      ".ct-ineg .c b{font-size:19px;font-variant-numeric:tabular-nums}",
      ".ct-ineg .c span{font-size:12.5px;color:var(--muted,#6a7583);text-align:right}",
      ".ct-temps{display:flex;align-items:center;gap:14px;margin-top:14px;padding:12px 16px;",
      "  border:1px solid var(--border,#e6eaef);border-radius:var(--r-m,14px);background:var(--surface,#fff)}",
      ".ct-temps input[type=range]{flex:1;min-width:0;margin:0}",
      ".ct-temps .an{font-variant-numeric:tabular-nums;font-weight:600;font-size:17px;min-width:4.2em}",
      ".ct-temps .lire{border:1px solid var(--border-fort,#d4dae2);background:var(--surface,#fff);",
      "  color:var(--text,#0b0f16);border-radius:10px;width:38px;height:38px;flex:none;cursor:pointer;",
      "  font:600 15px/1 inherit;display:grid;place-items:center}",
      ".ct-temps .lire:hover{border-color:var(--accent,#2563eb);color:var(--accent,#2563eb)}",
      ".ct-temps .bornes{font-size:12px;color:var(--muted,#6a7583);white-space:nowrap}",
      "@media(max-width:700px){.ct-temps{flex-wrap:wrap}.ct-temps .bornes{display:none}}",
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
    if ((courant === "nation" || courant === "natcmp") && indNation) return indNation;
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

  // Le mode comparaison écrit deux champs : la part cumulée des nationalités
  // choisies, qui sert le classement et la fiche comme n'importe quel
  // indicateur, et le rang de la plus présente, qui ne sert qu'à la couleur.
  function multiple() { return natSel.length >= 2 && courant === "natcmp"; }

  function majNatCmp() {
    if (natSel.length < 2) { indNation = null; return; }
    kb.communes.forEach(function (c) {
      var t = c.i.nat_tot;
      delete c.i.natcmp;
      delete c.i.natcmp_dom;
      if (!t) return;
      var somme = 0, meilleur = -1, max = -1;
      natSel.forEach(function (code, j) {
        var v = (c.n || {})[code] || 0;
        somme += v;
        if (v > max) { max = v; meilleur = j; }
      });
      c.i.natcmp = Math.round(1000 * somme / t) / 10;
      c.i.natcmp_dom = max > 0 ? meilleur : -1;
    });
    var noms = natSel.map(function (code) {
      var n = infoNation(code);
      return n ? n.n : code;
    });
    indNation = {
      id: "natcmp",
      nom: "Nationalités comparées : " + noms.join(", ").toLowerCase(),
      unite: "% des inscrits, cumulé",
      fmt: "pct",
      sens: 0,
      source: kb.nat_source,
      aide: kb.nat_aide + " La couleur dit laquelle des nationalités choisies est la plus " +
        "nombreuse dans la commune, et la densité de la couleur dit ce qu'elles pèsent " +
        "ensemble. Une commune pâle peut donc être dominée par une nationalité qui n'y " +
        "compte que quelques dizaines de personnes."
    };
  }

  // Le panier de comparaison. Ajouter une nationalité ne change pas la carte :
  // tant qu'il n'y en a qu'une, il n'y a rien à comparer. C'est le bouton qui
  // bascule, et l'utilisateur sait donc toujours ce qu'il regarde.
  function panier(code) {
    if (!code) return;
    var j = natSel.indexOf(code);
    if (j >= 0) natSel.splice(j, 1);
    else if (natSel.length < CAT.length) natSel.push(code);
    if (natSel.length < 2 && courant === "natcmp") {
      if (natSel.length === 1) { choisirNation(natSel[0]); return; }
      indNation = null;
      nation = null;
      courant = listeIndic()[0].id;
      boutons();
      calerEchelle();
      barreTemps();
      dessiner();
      fiche();
      return;
    }
    if (courant === "natcmp") majNatCmp();
    boutons();
    if (courant === "natcmp") { dessiner(); fiche(); }
  }

  function lancerComparaison() {
    if (natSel.length < 2) return;
    nation = null;
    arreterLecture();
    annee = null;
    courant = "natcmp";
    majNatCmp();
    boutons();
    calerEchelle();
    barreTemps();
    dessiner();
    fiche();
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

  // ---------- le temps ----------
  //
  // Douze indicateurs portent leur série annuelle complète, jusqu'à 1821 pour
  // la population. L'année choisie est recopiée dans i[id], comme pour les
  // nationalités : tout le reste du rendu continue de lire un seul champ.
  //
  // L'échelle de couleurs, elle, est calculée une fois sur toutes les années.
  // Une échelle recalculée à chaque pas ferait changer les couleurs de sens
  // pendant la lecture : une commune deviendrait foncée en perdant des
  // habitants, simplement parce que les autres en perdent davantage.

  function serieDe(id) { return (kb && kb.series && kb.series[id]) || null; }

  function serieCourante() {
    return couche_nom === "quartiers" ? null : serieDe(courant);
  }

  function calerEchelle() {
    var s = serieCourante();
    if (!s) { echelleFixe = null; return; }
    var toutes = [];
    zones().forEach(function (c) {
      var v = (c.s || {})[courant];
      if (!v) return;
      for (var i = 0; i < v.length; i++) if (v[i] !== null && v[i] !== undefined) toutes.push(v[i]);
    });
    echelleFixe = toutes.length ? bornes(toutes, RAMPE.length) : null;
  }

  function appliquerAnnee() {
    var s = serieCourante();
    if (!s || annee === null) return;
    var j = s.annees.indexOf(annee);
    zones().forEach(function (c) {
      var v = (c.s || {})[courant];
      var x = (v && j >= 0) ? v[j] : null;
      if (x === null || x === undefined) delete c.i[courant];
      else c.i[courant] = x;
    });
  }

  function arreterLecture() {
    if (minuteur) { clearInterval(minuteur); minuteur = null; }
    var b = document.getElementById("ct-lire");
    if (b) { b.textContent = "▶"; b.setAttribute("aria-label", "Dérouler les années"); }
  }

  function lecture() {
    var s = serieCourante();
    if (!s) return;
    if (minuteur) { arreterLecture(); return; }
    if (annee === s.annees[s.annees.length - 1]) annee = s.annees[0];
    var b = document.getElementById("ct-lire");
    if (b) { b.textContent = "❚❚"; b.setAttribute("aria-label", "Arrêter"); }
    minuteur = setInterval(function () {
      var j = s.annees.indexOf(annee);
      if (j >= s.annees.length - 1) { arreterLecture(); return; }
      allerA(s.annees[j + 1]);
    }, 420);
  }

  function allerA(a) {
    annee = a;
    appliquerAnnee();
    var r = document.getElementById("ct-annee");
    var t = document.getElementById("ct-an-txt");
    var s = serieCourante();
    if (r && s) r.value = String(s.annees.indexOf(a));
    if (t) t.textContent = a;
    dessiner();
    fiche();
  }

  function barreTemps() {
    var k = document.getElementById("ct-temps");
    if (!k) return;
    var s = serieCourante();
    if (!s) { k.innerHTML = ""; arreterLecture(); return; }
    var A = s.annees;
    if (annee === null || A.indexOf(annee) === -1) annee = A[A.length - 1];
    k.innerHTML = '<div class="ct-temps">' +
      '<button class="lire" id="ct-lire" aria-label="Dérouler les années">▶</button>' +
      '<span class="an" id="ct-an-txt">' + annee + "</span>" +
      '<span class="bornes">' + A[0] + "</span>" +
      '<input type="range" id="ct-annee" min="0" max="' + (A.length - 1) +
      '" step="1" value="' + A.indexOf(annee) + '" aria-label="Année affichée">' +
      '<span class="bornes">' + A[A.length - 1] + "</span></div>";
    var r = document.getElementById("ct-annee");
    r.addEventListener("input", function () { arreterLecture(); allerA(A[+r.value]); });
    document.getElementById("ct-lire").addEventListener("click", lecture);
  }

  // Carte par catégories : la couleur ne mesure plus, elle nomme. L'échelle de
  // classes n'a donc pas de sens ici, c'est la densité qui porte la quantité.
  function dessinerCat() {
    panneauInegalites();
    var ind = indic();
    var vals = zones().filter(function (c) { return c.i.natcmp !== undefined; })
      .map(function (c) { return c.i.natcmp; });
    var maxi = vals.length ? Math.max.apply(null, vals) : 1;
    classes = null;
    zones().forEach(function (c) {
      var d = c.i.natcmp_dom, v = c.i.natcmp, f = formes[c.nom] || [];
      var ok = d !== undefined && d >= 0;
      f.forEach(function (poly) {
        poly.setStyle({
          fillColor: ok ? CAT[d] : SANS,
          fillOpacity: ok ? Math.max(.22, Math.min(.9, .22 + .68 * (v / maxi))) : .4,
          color: "#ffffff", weight: 1
        });
        poly.unbindTooltip();
        var det = natSel.map(function (code) {
          var n = infoNation(code);
          return (n ? n.n : code) + " " + ((c.n || {})[code] || 0);
        }).join(" · ");
        poly.bindTooltip('<span class="ct-tip">' + esc(c.nom) + "<small>" +
          det + "<br>ensemble " + nf(v, "pct") + " des inscrits</small></span>", { sticky: true });
      });
    });
    if (selection) surligner(selection, true);
    ecrireCat(vals, ind);
  }

  function ecrireCat(vals, ind) {
    var k = document.getElementById("ct-sortie");
    var compte = {};
    zones().forEach(function (c) {
      if (c.i.natcmp_dom >= 0) compte[c.i.natcmp_dom] = (compte[c.i.natcmp_dom] || 0) + 1;
    });
    var h = '<h2 style="margin-top:22px">Nationalités comparées' +
      ' <span class="muted" style="font-weight:400;font-size:15px">' +
      natSel.length + " nationalités, " + motZone(true) + " colorées par la plus présente</span></h2>";
    h += '<div class="ct-legende">';
    natSel.forEach(function (code, j) {
      var n = infoNation(code);
      h += '<div class="cat"><i style="background:' + CAT[j] + '"></i>' +
        drapeau(n) + " " + esc(n ? n.n : code) +
        ' <span class="muted">' + (compte[j] || 0) + " " + motZone((compte[j] || 0) > 1) + "</span></div>";
    });
    h += "</div>";
    h += '<p class="hint ct-note">' + esc(ind.aide) + " <strong>Source :</strong> " +
      esc(ind.source) + ".</p>";
    k.innerHTML = h;

    var tri = zones().slice().sort(function (a, b) {
      var x = a.i.natcmp, y = b.i.natcmp;
      if (x === undefined) return 1;
      if (y === undefined) return -1;
      return y - x;
    });
    tableauRangs(tri, ind, "natcmp", function (v, c) {
      return c.i.natcmp_dom >= 0 ? CAT[c.i.natcmp_dom] : SANS;
    });
  }

  function dessiner() {
    if (multiple()) { dessinerCat(); return; }
    var ind = indic();
    var vals = zones().filter(function (c) { return c.i[courant] !== undefined; })
      .map(function (c) { return c.i[courant]; });
    var br = (serieCourante() && echelleFixe) ? echelleFixe : bornes(vals, RAMPE.length);
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
    panneauInegalites();
  }

  function surligner(nom, on) {
    (formes[nom] || []).forEach(function (p) {
      p.setStyle({ color: on ? "#0b0f16" : "#ffffff", weight: on ? 2.5 : 1 });
      if (on) p.bringToFront();
    });
  }

  function choisir(nom) {
    if (selection && selection !== nom) surligner(selection, false);
    ajouterCommune(nom);
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

  // Où se place une valeur dans le pays, de 0 à 1. Sert la barre de position :
  // un rang sur cent ne dit pas si la commune est au milieu du peloton ou
  // seule en tête, la position sur l'étendue le dit.
  function position(id, v) {
    var l = zones().map(function (c) { return c.i[id]; })
      .filter(function (x) { return x !== undefined && x !== null; });
    if (l.length < 3 || v === undefined || v === null) return null;
    var mini = Math.min.apply(null, l), maxi = Math.max.apply(null, l);
    return maxi === mini ? .5 : (v - mini) / (maxi - mini);
  }

  // Courbe d'une série, dessinée à la main en SVG : une bibliothèque de
  // graphiques pèserait cent fois cette fonction, pour une ligne de 116 pixels.
  function courbe(c, id) {
    var s = serieDe(id), v = (c.s || {})[id];
    if (!s || !v) return "";
    var pts = [], mini = Infinity, maxi = -Infinity, i;
    for (i = 0; i < v.length; i++) {
      if (v[i] === null || v[i] === undefined) continue;
      if (v[i] < mini) mini = v[i];
      if (v[i] > maxi) maxi = v[i];
    }
    if (mini === Infinity) return "";
    var L_ = 64, H = 18, ec = maxi - mini || 1;
    for (i = 0; i < v.length; i++) {
      if (v[i] === null || v[i] === undefined) continue;
      pts.push((i * L_ / (v.length - 1)).toFixed(1) + "," +
               (H - 2 - (v[i] - mini) / ec * (H - 4)).toFixed(1));
    }
    var last = pts[pts.length - 1].split(",");
    return '<svg width="' + L_ + '" height="' + H + '" viewBox="0 0 ' + L_ + " " + H +
      '" aria-hidden="true"><polyline fill="none" stroke="var(--accent,#2563eb)" ' +
      'stroke-width="1.4" stroke-linejoin="round" points="' + pts.join(" ") + '"></polyline>' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.1" fill="var(--accent,#2563eb)"></circle></svg>';
  }

  function communeDe(nom) {
    return zones().filter(function (x) { return x.nom === nom; })[0];
  }

  // Les communes affichées dans le comparateur : celles du panier, sinon la
  // commune cliquée. Cliquer une commune l'ajoute au panier tant qu'il reste
  // de la place, c'est le geste le plus court pour comparer.
  function communesComparees() {
    var l = panierCommunes.slice();
    if (!l.length && selection) l.push(selection);
    return l.map(communeDe).filter(Boolean);
  }

  function ajouterCommune(nom) {
    if (!nom || panierCommunes.indexOf(nom) >= 0) return;
    if (panierCommunes.length >= 5) return;
    if (!panierCommunes.length && selection && selection !== nom) panierCommunes.push(selection);
    panierCommunes.push(nom);
  }

  function fiche() {
    var k = document.getElementById("ct-fiche");
    if (!k) return;
    var liste = communesComparees();
    if (!liste.length) { k.innerHTML = ""; return; }
    var dispo = listeIndic();
    var h = '<div class="card ct-cmpc"><div class="tete">' +
      '<h3 style="margin:0 8px 0 0">' + (liste.length > 1 ? "Comparer " + liste.length + " " +
      motZone(true) : esc(liste[0].nom)) + "</h3>";
    liste.forEach(function (c) {
      h += '<button class="ct-natpuce" data-retirer="' + esc(c.nom) + '" title="Retirer">' +
        "<b>" + esc(c.nom) + '</b><span class="x">✕</span></button>';
    });
    if (liste.length < 5) {
      h += '<select id="ct-ajout" aria-label="Ajouter une commune à la comparaison">' +
        '<option value="">+ ajouter ' + (liste.length > 1 ? "une autre " : "une ") + motZone(false) +
        " à comparer…</option>";
      zones().slice().sort(function (a, b) { return a.nom.localeCompare(b.nom, "fr"); })
        .forEach(function (c) {
          if (liste.indexOf(c) === -1) h += '<option value="' + esc(c.nom) + '">' + esc(c.nom) + "</option>";
        });
      h += "</select>";
    }
    h += '</div><div class="defil"><table><thead><tr><th></th>';
    liste.forEach(function (c) {
      h += "<th>" + esc(c.nom) + "<small>canton de " + esc(c.canton) + "</small></th>";
    });
    h += "</tr></thead><tbody>";

    function ligne(ind) {
      var vals = liste.map(function (c) { return c.i[ind.id]; });
      if (vals.every(function (v) { return v === undefined; })) return "";
      // La meilleure valeur se marque, quand l'indicateur a un sens.
      var best = null;
      if (liste.length > 1 && ind.sens) {
        vals.forEach(function (v, i) {
          if (v === undefined) return;
          if (best === null || (ind.sens > 0 ? v > vals[best] : v < vals[best])) best = i;
        });
      }
      var r = '<tr class="ind" data-ind="' + ind.id + '"><td>' + esc(ind.nom) + "</td>";
      liste.forEach(function (c, i) {
        var v = vals[i], rg = v === undefined ? null : rang(ind.id, c.nom);
        r += '<td class="' + (i === best ? "meilleur" : "") + '"><b>' + nf(v, ind.fmt) + "</b>" +
          (rg ? "<small>" + rg[0] + "e/" + rg[1] + "</small>" : "") +
          (serieDe(ind.id) ? courbe(c, ind.id) : "") + "</td>";
      });
      return r + "</tr>";
    }

    if ((courant === "nation" || courant === "natcmp") && indNation) {
      h += '<tr class="fam"><td colspan="' + (liste.length + 1) + '">Nationalité affichée</td></tr>' +
        ligne(indNation);
    }
    (couche_nom === "quartiers" ? GROUPES_QUARTIERS : groupes()).forEach(function (g) {
      var lignes = "";
      g[1].forEach(function (id) {
        var ind = dispo.filter(function (x) { return x.id === id; })[0];
        if (ind) lignes += ligne(ind);
      });
      if (lignes) {
        h += '<tr class="fam"><td colspan="' + (liste.length + 1) + '">' + esc(g[0]) + "</td></tr>" + lignes;
      }
    });

    // Nationalités : les dix plus nombreuses de la première commune, en part.
    if (couche_nom === "communes" && liste[0].n && liste[0].i.nat_tot) {
      var c0 = liste[0];
      var top = Object.keys(c0.n).sort(function (a, b) { return c0.n[b] - c0.n[a]; }).slice(0, 10);
      h += '<tr class="fam"><td colspan="' + (liste.length + 1) + '">Nationalités, part des inscrits</td></tr>';
      top.forEach(function (code) {
        var n = infoNation(code) || { n: code };
        h += '<tr class="ind" data-nat="' + code + '"><td>' + drapeau(n) + " " + esc(n.n) + "</td>";
        liste.forEach(function (c) {
          var t = c.i.nat_tot, v = t ? 100 * ((c.n || {})[code] || 0) / t : undefined;
          h += "<td><b>" + nf(v, "pct") + "</b></td>";
        });
        h += "</tr>";
      });
    }
    h += "</tbody></table></div></div>";
    k.innerHTML = h;

    k.querySelectorAll("button[data-retirer]").forEach(function (b) {
      b.addEventListener("click", function () {
        var nom = b.dataset.retirer;
        var j = panierCommunes.indexOf(nom);
        if (j >= 0) panierCommunes.splice(j, 1);
        if (selection === nom) { surligner(nom, false); selection = panierCommunes[0] || null; }
        fiche();
      });
    });
    var aj = document.getElementById("ct-ajout");
    if (aj) aj.addEventListener("change", function () { if (aj.value) choisir(aj.value); });
    // Cliquer le nom d'un indicateur le porte sur la carte, une nationalité aussi.
    k.querySelectorAll("tr.ind[data-ind] td:first-child").forEach(function (td) {
      td.addEventListener("click", function () {
        var id = td.parentNode.dataset.ind;
        if (id === "nation" || id === "natcmp") return;
        courant = id;
        nation = null;
        indNation = null;
        annee = null;
        arreterLecture();
        famille = null;
        boutons();
        calerEchelle();
        barreTemps();
        dessiner();
        fiche();
      });
    });
    k.querySelectorAll("tr.ind[data-nat] td:first-child").forEach(function (td) {
      td.style.cursor = "pointer";
      td.addEventListener("click", function () { choisirNation(td.parentNode.dataset.nat); });
    });
  }

  function choisirNation(code) {
    nation = code || null;
    arreterLecture();
    annee = null;
    if (courant === "natcmp") courant = "nation";
    majNation();
    if (nation) courant = "nation";
    else if (courant === "nation") courant = listeIndic()[0].id;
    boutons();
    calerEchelle();
    barreTemps();
    dessiner();
    fiche();
  }

  function ecrire(vals, br, ind) {
    var k = document.getElementById("ct-sortie");
    var mini = Math.min.apply(null, vals), maxi = Math.max.apply(null, vals);
    var manquantes = zones().length - vals.length;

    var quand = (serieCourante() && annee !== null)
      ? ' <span class="muted" style="font-weight:400;font-size:15px">&middot; ' + annee + "</span>" : "";
    var h = "<h2 style=\"margin-top:22px\">" + (ind.a2 ? drapeau(ind) + " " : "") + esc(ind.nom) +
      (ind.unite ? ' <span class="muted" style="font-weight:400;font-size:15px">en ' + esc(ind.unite) + "</span>" : "") +
      quand + "</h2>";
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

    var s = serieCourante();
    h += '<p class="hint ct-note">' + esc(ind.aide || "") +
      (ind.aide ? " " : "") + "<strong>Source :</strong> " + esc(ind.source) +
      (s ? ". Série de " + s.annees[0] + " à " + s.annees[s.annees.length - 1] +
           " : l'échelle de couleurs est calculée une fois sur toute la période, " +
           "sinon les couleurs changeraient de sens d'une année à l'autre." +
           " Six classes de même effectif."
         : ". Six classes de même effectif, ce qui évite qu'une valeur extrême n'écrase " +
           "l'échelle : chaque couleur regroupe environ " + Math.round(vals.length / RAMPE.length) +
           " " + motZone(true) + ".") + "</p>";

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
    tableauRangs(tri, ind, courant, function (v) { return RAMPE[classe(v, br)]; });
  }

  // Le classement de la colonne de droite. Il sert les deux rendus, celui qui
  // mesure et celui qui nomme : seule la couleur de la jauge les distingue.
  function tableauRangs(tri, ind, champ, couleurDe) {
    var vals = tri.map(function (c) { return c.i[champ]; })
      .filter(function (v) { return v !== undefined; });
    var mini = vals.length ? Math.min.apply(null, vals) : 0;
    var maxi = vals.length ? Math.max.apply(null, vals) : 1;
    var t = "<h3>Classement des " + zones().length + " " + motZone(true) + "</h3>" +
      '<div class="ct-scroll"><table class="ct-tbl"><tbody id="ct-rangs">';
    tri.forEach(function (c, idx) {
      var v = c.i[champ];
      var part = v === undefined ? 0 : Math.max(2, 100 * (v - mini) / (maxi - mini || 1));
      t += '<tr data-nom="' + esc(c.nom) + '"><td class="n muted" style="width:26px">' +
        (v === undefined ? "" : idx + 1) + "</td><td>" + esc(c.nom) +
        '</td><td class="n">' + nf(v, ind.fmt) + '</td><td style="width:64px"><div class="ct-jauge"><i style="width:' +
        part.toFixed(1) + "%;background:" + (v === undefined ? SANS : couleurDe(v, c)) +
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

  // ---------- inégalités ----------
  //
  // Le STATEC ne publie pas de coefficient de Gini par commune, et il ne se
  // déduit pas de quatre points de la distribution des salaires : un Gini
  // demande la distribution entière, l'enquête SILC la donne pour le pays et
  // pas en dessous. La carte garde donc le rapport interdécile des salaires,
  // qui existe vraiment à la commune, et la courbe du pays est posée à côté
  // avec ce qui les sépare, plutôt qu'un chiffre inventé par commune.

  var INEGALITES = ["sal_ratio", "sal_p50_p10", "sal_p90_p50"];

  function graphe(annees, valeurs, fmt) {
    var L_ = 460, H = 170, mg = 34, i;
    var vals = valeurs.filter(function (v) { return v !== null && v !== undefined; });
    if (vals.length < 2) return "";
    var mini = Math.min.apply(null, vals), maxi = Math.max.apply(null, vals);
    var bas = mini - (maxi - mini) * .25, haut = maxi + (maxi - mini) * .2;
    var x = function (j) { return mg + j * (L_ - mg - 8) / (annees.length - 1); };
    var y = function (v) { return 12 + (haut - v) / (haut - bas || 1) * (H - 34); };
    var pts = [];
    for (i = 0; i < valeurs.length; i++) {
      if (valeurs[i] === null || valeurs[i] === undefined) continue;
      pts.push(x(i).toFixed(1) + "," + y(valeurs[i]).toFixed(1));
    }
    var dern = valeurs.length - 1;
    while (dern > 0 && (valeurs[dern] === null || valeurs[dern] === undefined)) dern--;
    var g = '<svg viewBox="0 0 ' + L_ + " " + H + '" width="100%" height="' + H +
      '" role="img" aria-label="Courbe de ' + annees[0] + " à " + annees[annees.length - 1] + '">';
    // Deux repères horizontaux seulement : une grille dense ferait un tableau.
    [maxi, mini].forEach(function (v) {
      g += '<line x1="' + mg + '" x2="' + (L_ - 8) + '" y1="' + y(v).toFixed(1) + '" y2="' +
        y(v).toFixed(1) + '" stroke="var(--border,#e6eaef)" stroke-width="1"></line>' +
        '<text x="0" y="' + (y(v) + 4).toFixed(1) + '" font-size="11" fill="var(--muted,#6a7583)">' +
        nf(v, fmt) + "</text>";
    });
    g += '<polyline fill="none" stroke="var(--accent,#2563eb)" stroke-width="2" ' +
      'stroke-linejoin="round" points="' + pts.join(" ") + '"></polyline>';
    g += '<circle cx="' + x(dern).toFixed(1) + '" cy="' + y(valeurs[dern]).toFixed(1) +
      '" r="3.4" fill="var(--accent,#2563eb)"></circle>';
    g += '<text x="' + mg + '" y="' + (H - 4) + '" font-size="11" fill="var(--muted,#6a7583)">' +
      annees[0] + "</text>";
    g += '<text x="' + (L_ - 8) + '" y="' + (H - 4) + '" font-size="11" text-anchor="end" ' +
      'fill="var(--muted,#6a7583)">' + annees[annees.length - 1] + "</text>";
    return g + "</svg>";
  }

  function panneauInegalites() {
    var k = document.getElementById("ct-ineg");
    if (!k) return;
    var n = kb && kb.national;
    if (!n || INEGALITES.indexOf(courant) === -1) { k.innerHTML = ""; return; }
    var d = n.annees.length - 1;
    var vals = zones().map(function (c) { return c.i[courant]; })
      .filter(function (v) { return v !== undefined; });
    var moy = vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : null;
    k.innerHTML = '<div class="card ct-ineg"><div class="deux"><div>' +
      "<h4>Les inégalités de revenu du pays, 2003 à " + n.annees[d] + "</h4>" +
      '<p class="hint" style="margin-top:2px">' +
      "Coefficient de Gini des revenus disponibles, enquête SILC. Zéro voudrait dire que " +
      "tout le monde a le même revenu, un que tout revient à une seule personne." +
      "</p>" + graphe(n.annees, n.gini, "dec") + "</div><div>" +
      '<div class="chiffres">' +
      '<div class="c"><b>' + nf(n.gini[d], "dec") + "</b><span>Gini du pays en " +
      n.annees[d] + "</span></div>" +
      '<div class="c"><b>' + nf(n.s80_s20[d], "dec") + "</b><span>Les 20 % les plus aisés " +
      "touchent ce multiple des 20 % les plus modestes</span></div>" +
      (moy === null ? "" : '<div class="c"><b>' + nf(moy, "dec") + "</b><span>Écart de salaire " +
        "moyen des communes, sur l'indicateur affiché</span></div>") +
      "</div></div></div>" +
      '<p class="hint ct-note">Ces deux mesures ne disent pas la même chose et ne se ' +
      "remplacent pas. Le Gini porte sur le revenu disponible des ménages, après impôts et " +
      "transferts, et il n'existe que pour le pays entier : l'enquête qui le produit " +
      "n'interroge pas assez de monde pour descendre à la commune. La carte, elle, porte sur " +
      "les salaires des résidents, avant impôt, et par commune. Un écart de salaire élevé " +
      "dans une commune peut donc coexister avec un revenu après redistribution beaucoup " +
      "plus resserré. Il n'y a pas de Gini par commune au Luxembourg, et ce guide n'en " +
      "fabrique pas.</p></div>";
  }

  // ---------- comparer deux cartes ----------
  //
  // Deux cartes autonomes, chacune son indicateur, mais un seul cadrage et un
  // seul survol : c'est ce partage qui rend la comparaison possible. Elles ne
  // passent pas par le rendu principal, qui ne connaît qu'une carte, et elles
  // ne se construisent qu'à la première ouverture.

  // La comparaison remplace la carte unique, elle ne s'ajoute pas dessous :
  // c'est une autre façon de regarder les mêmes communes, pas un bloc de plus.
  // La carte unique, sa barre du temps, sa légende et le panneau des
  // inégalités se retirent ; les boutons d'indicateurs restent et pilotent la
  // carte de gauche.
  function basculerComparaison() {
    comparer = !comparer;
    var k = document.getElementById("ct-comparer");
    k.hidden = !comparer;
    ["ct-temps", "ct-sortie", "ct-ineg"].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.hidden = comparer;
    });
    var vue = document.querySelector("#panel-cartes .ct-vue");
    if (vue) vue.hidden = comparer;
    var b = document.getElementById("ct-cmp-btn");
    if (b) b.classList.toggle("actif", comparer);
    if (!comparer) {
      // La carte unique a été cachée : Leaflet doit reprendre sa taille.
      setTimeout(function () {
        if (map) map.invalidateSize();
        if (map && cadreTotal) map.fitBounds(cadreTotal, { padding: [8, 8] });
      }, 60);
      return;
    }
    if (!cartesCmp[0]) construireComparaison();
    if (courant !== "nation" && courant !== "natcmp") {
      indCmp[0] = courant;
      var sel0 = document.getElementById("ct-sel-0");
      if (sel0) sel0.value = courant;
    }
    [0, 1].forEach(function (i) {
      setTimeout(function () {
        cartesCmp[i].invalidateSize();
        if (cadreTotal) cartesCmp[i].fitBounds(cadreTotal, { padding: [6, 6] });
      }, 60);
      dessinerCmp(i);
    });
  }

  function optionsIndic(choisi) {
    var h = "";
    groupes().forEach(function (g) {
      var dedans = g[1].filter(function (id) {
        return listeIndic().some(function (i) { return i.id === id; });
      });
      if (!dedans.length) return;
      h += '<optgroup label="' + esc(g[0]) + '">';
      dedans.forEach(function (id) {
        var ind = listeIndic().filter(function (i) { return i.id === id; })[0];
        h += '<option value="' + id + '"' + (id === choisi ? " selected" : "") + ">" +
          esc(ind.nom) + "</option>";
      });
      h += "</optgroup>";
    });
    return h;
  }

  function construireComparaison() {
    var k = document.getElementById("ct-comparer");
    k.innerHTML = '<div class="ct-cmp">' + [0, 1].map(function (i) {
      return '<div class="vue"><div class="carte" id="ct-carte-' + i + '"></div>' +
        '<div class="bas"><select id="ct-sel-' + i + '" aria-label="Indicateur de la carte ' +
        (i + 1) + '">' + optionsIndic(indCmp[i]) + "</select>" +
        '<div class="ct-legende" id="ct-lg-' + i + '"></div>' +
        '<div class="val" id="ct-val-' + i + '"></div></div></div>';
    }).join("") + "</div>" +
      '<p class="hint ct-note">Les deux cartes montrent les mêmes communes, au même ' +
      'cadrage : ce qui change d\'une carte à l\'autre vient de l\'indicateur, pas du ' +
      'dessin. Survolez une commune, elle s\'éclaire des deux côtés. Deux cartes qui se ' +
      'ressemblent disent que les deux mesures vont ensemble dans le pays, pas que l\'une ' +
      'cause l\'autre.</p>';

    [0, 1].forEach(function (i) {
      var m = L.map("ct-carte-" + i, {
        preferCanvas: true, scrollWheelZoom: false, zoomControl: i === 0,
        zoomSnap: 0, attributionControl: false
      }).setView([49.78, 6.09], 8);
      L.tileLayer("https://wmts{s}.geoportail.lu/opendata/wmts/topomap_gray/GLOBAL_WEBMERCATOR/{z}/{x}/{y}.png",
        { subdomains: "1234", maxZoom: 19, opacity: .28 }).addTo(m);
      var couche_i = L.layerGroup().addTo(m);
      formesCmp[i] = {};
      kb.communes.forEach(function (c) {
        formesCmp[i][c.nom] = c.g.map(function (enc) {
          var poly = L.polygon(decoder(enc), { color: "#fff", weight: .8, fillOpacity: .82 })
            .addTo(couche_i);
          poly.on("mouseover", function () { survolCmp(c.nom, true); });
          poly.on("mouseout", function () { survolCmp(c.nom, false); });
          poly.on("click", function () { choisir(c.nom); montrerValeurs(c.nom); });
          return poly;
        });
      });
      cartesCmp[i] = m;
      // Synchronisation des vues, avec un verrou : sans lui les deux cartes se
      // renvoient l'événement et le déplacement ne s'arrête plus.
      m.on("move zoom", function () {
        if (syncCmp) return;
        syncCmp = true;
        var autre = cartesCmp[1 - i];
        if (autre) autre.setView(m.getCenter(), m.getZoom(), { animate: false });
        syncCmp = false;
      });
      document.getElementById("ct-sel-" + i).addEventListener("change", function () {
        indCmp[i] = this.value;
        dessinerCmp(i);
        if (selection) montrerValeurs(selection);
      });
    });
  }

  function survolCmp(nom, on) {
    [0, 1].forEach(function (i) {
      (formesCmp[i][nom] || []).forEach(function (p) {
        p.setStyle({ color: on ? "#0b0f16" : "#ffffff", weight: on ? 2.2 : .8 });
        if (on) p.bringToFront();
      });
    });
    if (on) montrerValeurs(nom);
  }

  function montrerValeurs(nom) {
    var c = kb.communes.filter(function (x) { return x.nom === nom; })[0];
    if (!c) return;
    [0, 1].forEach(function (i) {
      var k = document.getElementById("ct-val-" + i);
      if (!k) return;
      var ind = kb.indicateurs.filter(function (x) { return x.id === indCmp[i]; })[0];
      if (!ind) return;
      k.innerHTML = esc(nom) + " : " + nf(c.i[ind.id], ind.fmt) +
        ' <span>' + esc(ind.unite || "") + "</span>";
    });
  }

  function dessinerCmp(i) {
    var id = indCmp[i];
    var ind = kb.indicateurs.filter(function (x) { return x.id === id; })[0];
    if (!ind) return;
    var vals = kb.communes.filter(function (c) { return c.i[id] !== undefined; })
      .map(function (c) { return c.i[id]; });
    var br = bornes(vals, RAMPE.length);
    kb.communes.forEach(function (c) {
      var v = c.i[id], ok = v !== undefined;
      (formesCmp[i][c.nom] || []).forEach(function (poly) {
        poly.setStyle({ fillColor: ok ? RAMPE[classe(v, br)] : SANS, fillOpacity: ok ? .82 : .45 });
        poly.unbindTooltip();
        poly.bindTooltip('<span class="ct-tip">' + esc(c.nom) + "<small>" +
          esc(ind.nom) + " : " + nf(v, ind.fmt) + "</small></span>", { sticky: true });
      });
    });
    var lg = document.getElementById("ct-lg-" + i);
    if (lg) {
      var h = "", j;
      for (j = 0; j < RAMPE.length; j++) {
        var bas = j === 0 ? Math.min.apply(null, vals) : br[j - 1];
        h += '<div class="lg"><b style="background:' + RAMPE[j] + '"></b><span>' +
          nf(bas, ind.fmt) + (j === RAMPE.length - 1 ? " et +" : "") + "</span></div>";
      }
      lg.innerHTML = h;
    }
  }

  // ---------- démarrage ----------

  // Les groupes de boutons sont décrits par la base, pas ici : un indicateur
  // ajouté au script de construction apparaît sans toucher à l'interface.
  // Cette liste ne sert que si une base ancienne ne les porte pas.
  var GROUPES = [
    ["Louer", ["loyer_appt", "loyer_appt_m2"]],
    ["Acheter", ["prix_appt_m2", "prix_maison_m2", "prix_appt", "prix_maison"]],
    ["Salaires", ["sal_med", "sal_p10", "sal_p90", "sal_ratio", "sal_moy"]],
    ["Population", ["pop", "pop_evol", "dens"]],
    ["Nationalités", ["pct_etr", "pct_lux", "pct_eu", "pct_noneu"]],
    ["Emploi", ["chomage", "emploi"]]
  ];
  function groupes() { return (kb && kb.groupes) || GROUPES; }
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
        esc(kb.quartiers.titre) + "</button>" +
        (quart ? "" : '<button class="chip' + (comparer ? " actif" : "") +
          '" id="ct-cmp-btn">Comparer deux cartes</button>') + "</div>";
    }
    // Les familles d'abord, sur une rangée ; puis les indicateurs de la
    // famille ouverte. La famille de l'indicateur affiché s'ouvre d'elle-même.
    var fams = (quart ? GROUPES_QUARTIERS : groupes()).map(function (g) {
      return [g[0], g[1].filter(function (id) {
        return dispo.some(function (i) { return i.id === id; });
      })];
    }).filter(function (g) { return g[1].length; });
    // Les nationalités du recensement et celles du registre forment une seule
    // famille : deux entrées « Nationalités » côte à côte n'auraient pas de sens.
    var natFam = !quart && nations().length;
    var iNat = -1;
    if (natFam) {
      fams.forEach(function (g, j) { if (g[0] === "Nationalités") iNat = j; });
      if (iNat < 0) { fams.push(["Nationalités", []]); iNat = fams.length - 1; }
    }
    var ouverte = -1;
    fams.forEach(function (g, j) { if (g[1].indexOf(courant) >= 0) ouverte = j; });
    if (courant === "nation" || courant === "natcmp") ouverte = iNat;
    if (famille !== null && famille < fams.length) ouverte = famille;
    if (ouverte < 0) ouverte = 0;
    famille = ouverte;

    h += '<div class="ct-familles">';
    fams.forEach(function (g, j) {
      h += '<button data-fam="' + j + '"' + (j === ouverte ? ' class="actif"' : "") + ">" +
        esc(g[0]) + "</button>";
    });
    h += "</div>";

    var fam = fams[ouverte];
    if (fam[1].length) {
      h += '<div class="ct-indics">';
      fam[1].forEach(function (id) {
        var ind = dispo.filter(function (i) { return i.id === id; })[0];
        h += '<button class="chip' + (id === courant ? " actif" : "") + '" data-ind="' + id + '">' +
          esc(ind.nom) + "</button>";
      });
      h += "</div>";
    }
    if (natFam && ouverte === iNat) {
      h += '<div class="ct-indics"><div class="ct-nat" style="flex:1 1 100%">' +
        '<select id="ct-nation"><option value="">Choisir parmi ' + nations().length + " nationalités…</option>";
      nations().forEach(function (n) {
        h += '<option value="' + n.c + '"' + (n.c === nation ? " selected" : "") + ">" +
          (n.f ? n.f + " " : "") + esc(n.n) + " (" + n.t.toLocaleString("fr-FR") + ")</option>";
      });
      h += "</select>" +
        '<button class="chip' + (natMode === "pct" ? " actif" : "") + '" data-mode="pct">en %</button>' +
        '<button class="chip' + (natMode === "nb" ? " actif" : "") + '" data-mode="nb">en nombre</button>' +
        "</div>";
      // Comparer plusieurs nationalités sur la même carte : les choisies
      // s'affichent en puces, un clic sur une puce la retire.
      h += '<div class="ct-natpuces" style="flex:1 1 100%;margin-top:0">';
      natSel.forEach(function (code, j) {
        var n = infoNation(code);
        h += '<button class="ct-natpuce" data-natoff="' + code + '" title="Retirer de la comparaison">' +
          '<i style="background:' + CAT[j] + '"></i><b>' + esc(n ? n.n : code) +
          '</b><span class="x">✕</span></button>';
      });
      if (natSel.length < CAT.length) {
        h += '<button class="ct-natpuce" data-nataddsel="1"><b>+ ajouter celle-ci à la comparaison</b></button>';
      }
      if (natSel.length >= 2) {
        h += '<button class="chip' + (courant === "natcmp" ? " actif" : "") +
          '" data-natcmp="1">Comparer ces ' + natSel.length + " nationalités</button>";
      }
      h += "</div></div>";
    }
    if (quart) h += '<p class="hint" style="margin-top:14px">' + esc(kb.quartiers.note) + "</p>";
    k.innerHTML = h;
    k.querySelectorAll("button[data-fam]").forEach(function (b) {
      b.addEventListener("click", function () {
        famille = +b.dataset.fam;
        var fam = fams[famille];
        // Ouvrir une famille montre tout de suite son premier indicateur :
        // un clic pour voir quelque chose, pas deux.
        if (fam[1].length && fam[1].indexOf(courant) === -1) {
          courant = fam[1][0];
          nation = null;
          indNation = null;
          arreterLecture();
          annee = null;
          if (comparer) {
            indCmp[0] = courant;
            var sel0 = document.getElementById("ct-sel-0");
            if (sel0) sel0.value = courant;
            boutons();
            dessinerCmp(0);
            return;
          }
          boutons();
          calerEchelle();
          barreTemps();
          dessiner();
          fiche();
          return;
        }
        boutons();
      });
    });
    var sel = document.getElementById("ct-nation");
    if (sel) sel.addEventListener("change", function () { choisirNation(sel.value); });
    k.querySelectorAll("button[data-natoff]").forEach(function (b) {
      b.addEventListener("click", function () { panier(b.dataset.natoff); });
    });
    var add = k.querySelector("button[data-nataddsel]");
    if (add) {
      add.addEventListener("click", function () {
        var s2 = document.getElementById("ct-nation");
        var code = (s2 && s2.value) || nation;
        if (!code) { if (s2) s2.focus(); return; }
        panier(code);
      });
    }
    var cmp = k.querySelector("button[data-natcmp]");
    if (cmp) cmp.addEventListener("click", lancerComparaison);
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
        arreterLecture();
        annee = null;
        famille = null;
        if (comparer) {
          indCmp[0] = courant;
          var sel0 = document.getElementById("ct-sel-0");
          if (sel0) sel0.value = courant;
          k.querySelectorAll("button[data-ind]").forEach(function (x) {
            x.classList.toggle("actif", x.dataset.ind === courant);
          });
          dessinerCmp(0);
          if (selection) montrerValeurs(selection);
          return;
        }
        var s2 = document.getElementById("ct-nation");
        if (s2) s2.value = "";
        k.querySelectorAll("button[data-ind]").forEach(function (x) {
          x.classList.toggle("actif", x.dataset.ind === courant);
        });
        calerEchelle();
        barreTemps();
        appliquerAnnee();
        dessiner();
        fiche();
      });
    });
    k.querySelectorAll("button[data-couche]").forEach(function (b) {
      b.addEventListener("click", function () { changerCouche(b.dataset.couche); });
    });
    var bc = document.getElementById("ct-cmp-btn");
    if (bc) bc.addEventListener("click", basculerComparaison);
  }

  function changerCouche(nom) {
    if (nom === couche_nom) return;
    couche_nom = nom;
    selection = null;
    panierCommunes = [];
    famille = null;
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
    // Les quartiers n'ont pas de séries : la barre du temps se retire d'elle-même.
    arreterLecture();
    annee = null;
    calerEchelle();
    barreTemps();
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
      calerEchelle();
      barreTemps();
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
