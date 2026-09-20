// Onglet Cartes : les communes coloriées par indicateur, au Luxembourg et
// dans les trois pays voisins.
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
  // La base des communes frontalières est un second fichier, chargé seulement
  // si l'on passe de l'autre côté de la frontière : la plupart des visiteurs
  // ne l'ouvriront jamais, et elle pèse autant que le reste de la page.
  var KB_FRONT = "cartes/frontaliers_kb.js?v=1";
  // Les notes par commune : les noms des écoles, des campus et des lycées.
  // Ce ne sont pas des chiffres et ils ne viennent pas de la même source, d'où
  // un fichier à part, construit par cartes/build_ecoles.py.
  var KB_ECOLES = "cartes/ecoles_kb.js?v=2";
  var LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  // Fond de carte en sandwich. Une carte thématique pose des aplats de couleur
  // sur un territoire que le lecteur ne connaît pas : sans nom de ville, il ne
  // sait pas ce qu'il regarde. Le fond clair passe donc dessous, les communes
  // au milieu, et les noms de lieux repassent par-dessus dans une couche à
  // part. C'est ce qui manquait : les noms étaient recouverts par la couleur.
  // Fond gris clair d'Esri, fait pour porter des aplats de couleur, et sa
  // couche de noms séparée. Aucune clé n'est demandée, contrairement à la
  // plupart des fonds de ce genre.
  var FOND = "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}";
  var FOND_NOMS = "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}";
  var FOND_SECOURS = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  var FOND_CREDIT = "Fond : Esri, © OpenStreetMap · Données : STATEC, ACT, Eurostat, INSEE, Statbel, IGSS";
  var FOND_CREDIT_2 = "© OpenStreetMap · Données : STATEC, ACT, Eurostat, INSEE, Statbel, IGSS";

  // Les deux couches de tuiles et le panneau qui les sépare, posés sur une
  // carte Leaflet quelconque.
  //
  // Un fond de carte gratuit peut se fermer du jour au lendemain, ou répondre
  // une tuile « clé d'interface demandée » au lieu d'une image. On surveille
  // donc les erreurs de chargement : au-delà de quelques-unes, on bascule sur
  // les tuiles d'OpenStreetMap, moins sobres mais toujours là. Mieux vaut une
  // carte chargée qu'une carte élégante et vide.
  function poserFond(m, credit) {
    var base = L.tileLayer(FOND, {
      maxZoom: 19,
      attribution: credit === false ? "" : FOND_CREDIT
    }).addTo(m);
    if (!m.getPane("noms")) {
      var pane = m.createPane("noms");
      // Au-dessus des communes (400), en dessous des bulles de survol (650) :
      // un nom de ville ne doit jamais passer devant l'infobulle qu'on lit.
      pane.style.zIndex = 640;
      pane.style.pointerEvents = "none";
    }
    var noms = L.tileLayer(FOND_NOMS, { maxZoom: 19, pane: "noms" }).addTo(m);

    var ratees = 0, bascule = false;
    function surveiller() {
      if (bascule || ++ratees < 4) return;
      bascule = true;
      m.removeLayer(base);
      m.removeLayer(noms);
      L.tileLayer(FOND_SECOURS, {
        maxZoom: 19, opacity: .85,
        attribution: credit === false ? "" : FOND_CREDIT_2
      }).addTo(m);
      // Sans couche de noms séparée, les aplats doivent laisser lire la carte.
      Object.keys(formes).forEach(function (n) {
        formes[n].forEach(function (p) {
          if (p.options.fillOpacity > .5) p.setStyle({ fillOpacity: .5 });
        });
      });
    }
    base.on("tileerror", surveiller);
    noms.on("tileerror", surveiller);
  }
  var LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

  // Rampe séquentielle bleue, du clair au foncé. Six pas retenus sur les onze
  // de la rampe de référence, assez écartés pour rester distincts en impression
  // et pour les daltonismes courants, qui ne touchent pas la clarté.
  var RAMPE = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#104281"];
  var SANS = "#e8e8e6";

  var demarre = false, map = null, kb = null, courant = null, couche_nom = "communes";
  var front = null, regionSel = null;
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
  // pour la comparaison. Dix au plus : le tableau défile alors en largeur,
  // en-tête et première colonne figés. La limite a d'abord été de cinq, ce
  // qui tenait sans défiler mais ne suffisait pas à comparer tout un canton.
  var famille = null, panierCommunes = [];
  var CAT = ["#2563eb", "#d1620a", "#0f8b57", "#8b3fd1", "#c2185b", "#00757f",
    "#a07800", "#5b6472", "#7a3e1d", "#3aa0d8"];
  // Dix communes dans le panier, six nationalités sur une carte : sur une
  // carte les couleurs se touchent et l'oeil n'en sépare pas davantage, dans
  // un tableau chaque couleur a sa colonne.
  var MAX_PANIER = 10, MAX_NAT = 6;
  // Trois vues, trois registres. « carte » : un indicateur peint sur une
  // carte, et une commune cliquée montre sa valeur, son rang et sa courbe sur
  // cet indicateur. « deux » : deux cartes côte à côte, chacune son
  // indicateur. « communes » : la carte ne mesure plus rien, elle sert à
  // choisir jusqu'à dix communes dont toutes les données se lisent côte à
  // côte. Avant, le tableau complet s'ouvrait dès le premier clic alors que
  // l'on venait de choisir un seul indicateur : deux registres se mélangeaient.
  var mode = "carte";
  var comparer = false, cartesCmp = [null, null], formesCmp = [{}, {}];
  var indCmp = ["loyer_appt", "sal_med"], syncCmp = false;
  var filtreTxt = "";

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
      // L'en-tête du sélecteur : des rangées annoncées par un intitulé, le
      // territoire puis la vue. Sans intitulé, cinq noms de lieux posés à
      // côté de trois façons de regarder ne disent pas de quoi ils sont la liste.
      // Deux tailles de commande dans tout l'onglet, et deux seulement.
      // --ct-h1, la puce : choisir un territoire, une vue, une region, ce qui
      // change ce que montre la carte. --ct-h2, le controle secondaire :
      // choisir un indicateur, chercher, ajouter une commune au panier.
      // Avant, quatre hauteurs se croisaient sur le meme ecran.
      "#panel-cartes{--ct-h1:41px;--ct-h2:39px}",
      ".ct-tete{padding-bottom:14px;border-bottom:1px solid var(--border,#e6eaef)}",
      ".ct-couches{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
      ".ct-couches + .ct-couches{margin-top:10px}",
      ".ct-couches > span{font-size:11.5px;text-transform:uppercase;letter-spacing:.06em;",
      "  color:var(--muted,#6a7583);font-weight:600;margin-right:4px;min-width:5.5em}",
      ".ct-couches .chip{font-weight:600;height:var(--ct-h1);display:inline-flex;",
      "  align-items:center;padding:0 14px}",
      ".ct-couches .chip[disabled]{opacity:.45;cursor:not-allowed;transform:none}",
      ".ct-ajout,#ct-sel-0,#ct-sel-1,#ct-nation{",
      "  background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236a7583%22 stroke-width=%222.2%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22m6 9 6 6 6-6%22/></svg>');background-repeat:no-repeat;",
      "  background-position:right 11px center;background-size:12px}",
      // Le panier de communes, et la pastille de couleur qui suit chaque
      // commune de la carte au tableau.
      ".ct-panier{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:14px}",
      // Les notes : une carte par commune, en colonnes quand il y a la place.
      ".ct-ecoles{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));margin-top:18px}",
      ".ct-ecole{border:1px solid var(--border,#e6eaef);border-radius:14px;background:var(--surface,#fff);",
      "  padding:16px 18px;box-shadow:var(--ombre-s,0 1px 2px rgba(11,18,32,.05))}",
      ".ct-ecole h4{margin:0 0 4px;font-size:15.5px;display:flex;align-items:center;gap:8px}",
      ".ct-ecole .resume{margin:0 0 10px;font-size:13.5px;color:var(--muted,#6a7583)}",
      ".ct-ecole h5{margin:12px 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:.8px;",
      "  color:var(--muted,#6a7583);font-weight:600}",
      ".ct-ecole ul{margin:0;padding-left:17px;font-size:13.5px}",
      ".ct-ecole li{margin:3px 0}",
      ".ct-ecole li .off{display:block;color:var(--muted,#6a7583);font-size:12.5px}",
      ".ct-ecole li .off a{color:inherit}",
      ".ct-ecole .rien{font-size:13.5px;color:var(--muted,#6a7583);margin:6px 0 0}",
      ".ct-ecole .eti{font-size:11.5px;font-weight:600;border-radius:999px;padding:2px 8px;",
      "  background:var(--accent-soft,#eaf1fb);color:var(--accent,#0a4fa8);white-space:nowrap}",
      ".ct-ecoles-pays{margin-top:14px;font-size:13.5px}",
      ".ct-ecoles-pays summary{cursor:pointer;color:var(--accent,#0a4fa8);font-weight:600;padding:6px 0}",
      ".ct-ecoles-pays p{margin:6px 0}",
      // Les trois listes secondaires du module, a la meme enseigne : ajouter
      // une commune au panier, choisir l'indicateur d'une des deux cartes,
      // choisir une nationalite. Le chevron est le meme que sur la liste des
      // pays voisins, dessine plutot que laisse au navigateur : sinon deux
      // fleches de formes differentes cohabitent sur le meme ecran.
      ".ct-ajout,#ct-sel-0,#ct-sel-1,#ct-nation{appearance:none;-webkit-appearance:none;cursor:pointer;",
      "  height:var(--ct-h2);min-height:0;padding:0 32px 0 12px;line-height:normal;",
      "  border-radius:10px;font:inherit;font-size:13.5px;",
      "  border:1px solid var(--border-fort,#d4dae2);",
      "  background:var(--surface,#fff);color:var(--text,#0b0f16)}",
      ".ct-ajout{flex:1 1 220px;min-width:0}",
      ".ct-ajout:hover,#ct-sel-0:hover,#ct-sel-1:hover,#ct-nation:hover{border-color:var(--accent,#0a4fa8)}",
      ".pt{width:11px;height:11px;border-radius:3px;display:inline-block;margin-right:8px;",
      "  vertical-align:middle;flex:none}",
      ".ct-cherche{padding:8px 10px;border-bottom:1px solid var(--border,#e6eaef)}",
      ".ct-cherche input{width:100%;height:var(--ct-h2);min-height:0;padding:0 11px;",
      "  border-radius:10px;font:inherit;font-size:13.5px;",
      "  border:1px solid var(--border-fort,#d4dae2);background:var(--surface,#fff);color:var(--text,#0b0f16)}",
      "#ct-cote .ct-scroll-choix{max-height:calc(min(74vh,620px) - 96px)}",
      // La fiche d'une vue « une carte » : les communes retenues sur
      // l'indicateur affiché, valeur, rang, position, puis leur courbe.
      ".ct-fi .tete{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}",
      ".ct-fi h4{margin:18px 0 6px;font-size:14px}",
      ".ct-fitbl{width:100%;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums}",
      ".ct-fitbl td{padding:8px 10px;border-top:1px solid var(--border,#e6eaef);vertical-align:middle}",
      ".ct-fitbl td.n{text-align:right;white-space:nowrap}",
      ".ct-fitbl td small{display:block;color:var(--muted,#6a7583);font-size:12px;margin-left:19px}",
      ".ct-fitbl td.jg{width:120px}",
      // Sur un téléphone, la ligne valeur, rang, jauge ne tient pas en un
      // seul rang : le rang passe à la ligne et la jauge se raccourcit.
      "@media(max-width:600px){.ct-fitbl td.n{white-space:normal}.ct-fitbl td.jg{width:56px}",
      "  .ct-fitbl .ct-jauge{min-width:0}}",
      // Le survol d'un graphe : la bulle est un élément HTML posé sur le SVG,
      // plus simple à mettre en forme qu'un texte SVG.
      ".ct-gwrap{position:relative;max-width:720px}",
      ".ct-gwrap svg{display:block;width:100%;height:auto;touch-action:pan-y}",
      ".ct-gtip{position:absolute;top:6px;pointer-events:none;background:var(--surface,#fff);",
      "  border:1px solid var(--border,#e6eaef);border-radius:9px;padding:7px 10px;font-size:12.5px;",
      "  box-shadow:0 2px 10px rgba(11,15,22,.14);white-space:nowrap;z-index:3;display:grid;gap:3px;",
      "  font-variant-numeric:tabular-nums}",
      ".ct-gtip[hidden]{display:none}",
      ".ct-gtip b{font-size:13px}",
      ".ct-gtip span{display:flex;align-items:center;gap:6px}",
      ".ct-gtip i{width:9px;height:9px;border-radius:2px;display:inline-block;flex:none}",
      ".ct-tbl tbody tr.hov{background:var(--surface-2,#f4f6f9)}",
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
      "  font-size:13.5px;font-weight:500;padding:0 12px;border-radius:10px;cursor:pointer;",
      "  height:var(--ct-h2);display:inline-flex;align-items:center}",
      ".ct-familles button:hover{color:var(--text,#0b0f16);background:var(--surface-2,#f4f6f9)}",
      ".ct-familles button.actif{color:var(--accent,#2563eb);font-weight:600;",
      "  background:var(--accent-soft,#eaf1fb)}",
      ".ct-indics{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px;padding-top:12px;",
      "  border-top:1px solid var(--border,#e6eaef)}",
      // L'indicateur se choisit sous sa famille : meme hauteur que la rangee
      // des familles, juste au-dessus, et la forme de pastille qui dit qu'on
      // prend un element dans une longue liste.
      ".ct-indics .chip{height:var(--ct-h2);display:inline-flex;align-items:center;padding:0 13px}",
      // Comparateur de communes : un tableau, une colonne par commune, les
      // indicateurs en lignes par famille. Il sert pour une commune comme
      // pour cinq, avec la même forme.
      // La Grande Région : six régions comparables, et ce que coûte un même
      // panier de chaque côté de la frontière.
      ".ct-gr{margin-top:18px}",
      ".ct-gr h3{margin:0 0 3px;font-size:16px}",
      ".ct-gr .deux{display:grid;grid-template-columns:1fr 1fr;gap:26px;align-items:start;",
      "  margin-top:16px}",
      "@media(max-width:880px){.ct-gr .deux{grid-template-columns:1fr}}",
      ".ct-gr table{width:100%;border-collapse:collapse;font-size:13.5px;",
      "  font-variant-numeric:tabular-nums}",
      ".ct-gr th,.ct-gr td{padding:6px 8px;border-top:1px solid var(--border,#e6eaef);text-align:right}",
      ".ct-gr th:first-child,.ct-gr td:first-child{text-align:left}",
      ".ct-gr thead th{border-top:0;font-size:11.5px;text-transform:uppercase;",
      "  letter-spacing:.05em;color:var(--muted,#6a7583);font-weight:600}",
      ".ct-gr td.ici{font-weight:600}",
      ".ct-gr .bar{position:relative;height:7px;border-radius:4px;",
      "  background:var(--border,#e6eaef);min-width:90px}",
      ".ct-gr .bar i{position:absolute;left:0;top:0;bottom:0;border-radius:4px;display:block;",
      "  background:var(--accent,#2563eb)}",
      ".ct-gr .moins{color:#0f8b57;font-weight:600}",
      ".ct-gr .plus{color:#c2410c;font-weight:600}",
      ".ct-cmpc{margin-top:18px}",
      ".ct-cmpc .tete{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}",
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
      // L'en-tête reste collé sous la barre du site pendant qu'on descend :
      // à la trentième ligne on ne sait plus quelle colonne est quelle
      // commune. Le collage demande qu'aucun ancêtre ne soit un conteneur de
      // défilement, d'où le défilement horizontal réservé aux petits écrans,
      // où l'en-tête ne colle donc pas.
      ".ct-cmpc .defil{overflow-x:visible}",
      // Au-delà de cinq colonnes, ou sur un téléphone, le tableau ne tient plus
      // dans la page : il défile dans son propre cadre, dans les deux sens.
      // L'en-tête reste en haut du cadre et la première colonne à gauche,
      // sinon on perd soit le nom de la commune, soit celui de la ligne.
      ".ct-cmpc.large .defil{overflow:auto;max-height:calc(100vh - var(--h-top,68px) - 24px);",
      "  border:1px solid var(--border,#e6eaef);border-radius:10px}",
      ".ct-cmpc.large table{width:max-content;min-width:100%}",
      ".ct-cmpc.large th,.ct-cmpc.large td{min-width:150px}",
      ".ct-cmpc.large th:first-child,.ct-cmpc.large tr.ind td:first-child{position:sticky;left:0;z-index:1;",
      "  min-width:190px;max-width:230px;background:var(--surface,#fff);box-shadow:1px 0 0 var(--border,#e6eaef),6px 0 8px -6px rgba(11,15,22,.22)}",
      ".ct-cmpc.large tr.ind:hover td:first-child{background:var(--surface-2,#f4f6f9)}",
      ".ct-cmpc.large tr.fam td span{position:sticky;left:10px;display:inline-block}",
      "@media(max-width:760px){.ct-cmpc.large th,.ct-cmpc.large td{min-width:118px}",
      "  .ct-cmpc.large th:first-child,.ct-cmpc.large tr.ind td:first-child{min-width:128px;max-width:150px}}",
      ".ct-cmpc thead th{position:sticky;top:var(--h-top,68px);z-index:2;",
      "  background:var(--surface,#fff);box-shadow:0 1px 0 var(--border,#e6eaef)}",
      ".ct-cmpc.large thead th{top:0}",
      ".ct-cmpc.large thead th:first-child{z-index:3}",
      ".ct-cmpc thead th .col{display:flex;flex-direction:column;align-items:flex-end;gap:4px}",
      ".ct-cmpc thead th:first-child .col{align-items:flex-start}",
      ".ct-cmpc thead th .outils{display:flex;gap:2px}",
      ".ct-cmpc thead th .outils button{border:1px solid var(--border,#e6eaef);background:var(--surface,#fff);",
      "  color:var(--muted,#6a7583);border-radius:6px;width:24px;height:22px;font:600 13px/1 inherit;",
      "  cursor:pointer;padding:0;display:grid;place-items:center}",
      ".ct-cmpc thead th .outils button:hover{color:var(--text,#0b0f16);border-color:var(--border-fort,#d4dae2)}",
      ".ct-cmpc thead th .outils button[disabled]{opacity:.3;cursor:default}",
      ".ct-cmpc thead th .outils button[data-retirer]:hover{color:#c2410c;border-color:#c2410c}",
      ".ct-cmpc tr.ind:hover td{background:var(--surface-2,#f4f6f9)}",
      ".ct-cmpc thead th .pt{margin-right:7px}",
      ".ct-cmpc td .nb{display:inline-flex;align-items:center;gap:8px}",
      ".ct-cmpc td .nb b{min-width:3.6em;text-align:right}",
      ".ct-cmpc td .nb .ct-jauge{display:block;width:72px;min-width:72px}",
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
      // La puce d'une commune retenue se pose a cote de la liste « ajouter une
      // commune » : meme hauteur qu'elle, sinon la rangee du panier ondule.
      ".ct-natpuce{display:inline-flex;align-items:center;gap:7px;height:var(--ct-h2,39px);",
      "  padding:0 11px;border-radius:999px;",
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
    if (!window.ECOLES) { reste += 1; charger(KB_ECOLES, "js", fini); }
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
  // Trois couches, trois jeux de zones et d'indicateurs. Tout le rendu passe
  // par ces deux accesseurs et ne sait pas laquelle est affichée.
  // Les trois pays voisins forment trois couches et non une seule. Peu de gens
  // comparent une commune allemande à une commune française : les regarder
  // ensemble diluait l'échelle de couleurs sur neuf cents communes, alors que
  // la question posée est presque toujours « où, dans ce pays-là ».
  var PAYS_COUCHE = { fr: "FR", be: "BE", de: "DE" };

  function estFrontalier() { return !!PAYS_COUCHE[couche_nom]; }

  function zones() {
    if (couche_nom === "quartiers") return kb.quartiers.zones;
    if (estFrontalier()) {
      if (!front) return [];
      var p = PAYS_COUCHE[couche_nom];
      return front.zones.filter(function (z) {
        return z.pays === p && (!regionSel || z.nuts === regionSel);
      });
    }
    return kb.communes;
  }
  // Chaque pays a sa liste : le niveau de vie médian français et le revenu par
  // déclaration belge ne mesurent pas la même chose, et ne se rangent donc pas
  // dans la même colonne.
  function coucheVoisine() {
    if (!front || !estFrontalier()) return null;
    var p = PAYS_COUCHE[couche_nom];
    return (front.par_pays && front.par_pays[p]) ||
      { indicateurs: front.indicateurs, groupes: front.groupes };
  }

  function listeIndic() {
    if (couche_nom === "quartiers") return kb.quartiers.indicateurs;
    var v = coucheVoisine();
    if (v) return v.indicateurs || [];
    return kb.indicateurs;
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
    else if (natSel.length < MAX_NAT) natSel.push(code);
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
  // L'avertissement de bas de page ne dit pas la même chose selon la couche :
  // les prix annoncés et le salaire médian n'existent qu'au Luxembourg.
  function majAvertissement() {
    var k = document.getElementById("ct-avert");
    if (!k) return;
    k.textContent = estFrontalier()
      ? "Population, superficie et densité viennent du référentiel européen des communes, " +
        "donc mesurées de la même façon dans les quatre pays. Les distances sont à vol " +
        "d'oiseau depuis le centre de la commune, et non des temps de trajet : une commune " +
        "à trente kilomètres sur l'autoroute peut être plus loin, le matin, qu'une commune " +
        "à quarante sur une ligne directe. Cet onglet demande un accès réseau pour le fond " +
        "de carte."
      : "Une carte de ce genre montre où se situe une commune, pas pourquoi. Un salaire " +
        "médian élevé décrit les gens qui habitent là, pas le coût de la vie sur place. Un " +
        "taux de chômage bas peut tenir à la structure d'âge. Et les prix affichés sont ceux " +
        "des annonces, donc au dessus des prix signés. Cet onglet demande un accès réseau " +
        "pour le fond de carte.";
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
          fillOpacity: ok ? Math.max(.18, Math.min(.8, .18 + .62 * (v / maxi))) : .4,
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

  // ---------- vue « comparer des communes » ----------
  //
  // Ici la carte ne mesure rien : toutes les communes sont grises, celles du
  // panier prennent chacune une couleur, la même que dans le tableau. La
  // colonne de droite cesse d'être un classement, il n'y a rien à classer,
  // et devient une liste alphabétique avec un champ de recherche.

  function dessinerChoix() {
    var liste = communesComparees().map(function (c) { return c.nom; });
    classes = null;
    zones().forEach(function (c) {
      var j = liste.indexOf(c.nom);
      (formes[c.nom] || []).forEach(function (poly) {
        poly.setStyle({
          fillColor: j >= 0 ? CAT[j] : "#c9d2dd",
          fillOpacity: j >= 0 ? .78 : .28,
          color: j >= 0 ? "#0b0f16" : "#ffffff", weight: j >= 0 ? 2 : 1
        });
        if (j >= 0) poly.bringToFront();
        poly.unbindTooltip();
        poly.bindTooltip('<span class="ct-tip">' + esc(c.nom) +
          (estFrontalier() ? ' <span class="muted">' + esc(c.region || c.canton) + "</span>" : "") +
          "<small>" + (j >= 0 ? "dans la comparaison, cliquer pour la retirer" :
            (liste.length >= MAX_PANIER ? "la comparaison est pleine, retirez-en une" :
              "cliquer pour l'ajouter à la comparaison")) + "</small></span>", { sticky: true });
      });
    });
    var encart = document.getElementById("ct-mini");
    if (encart) {
      encart.innerHTML = '<b class="t">Comparer des ' + motZone(true) + "</b>" +
        (liste.length ? '<div class="ct-natpuces" style="margin-top:0">' + puces(communesComparees(), false) + "</div>"
          : '<span class="muted">Cliquez les ' + motZone(true) + " à comparer</span>");
    }
    var ineg = document.getElementById("ct-ineg");
    if (ineg) ineg.innerHTML = "";
    listeChoix();
    panneauGrandeRegion();
    majSource();
    majAvertissement();
  }

  function normaliser(s) {
    return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  function listeChoix() {
    var cote = document.getElementById("ct-cote");
    if (!cote) return;
    var liste = communesComparees().map(function (c) { return c.nom; });
    var tri = zones().slice().sort(function (a, b) { return a.nom.localeCompare(b.nom, "fr"); });
    var h = "<h3>Les " + zones().length + " " + motZone(true) + ", de A à Z</h3>" +
      '<div class="ct-cherche"><input type="search" id="ct-filtre" placeholder="Chercher une ' +
      motZone(false) + '…" aria-label="Chercher une ' + motZone(false) + '" value="' + esc(filtreTxt) + '"></div>' +
      '<div class="ct-scroll ct-scroll-choix"><table class="ct-tbl"><tbody id="ct-rangs">';
    tri.forEach(function (c) {
      var j = liste.indexOf(c.nom);
      h += '<tr data-nom="' + esc(c.nom) + '" data-cle="' + esc(normaliser(c.nom)) + '"' +
        (j >= 0 ? ' class="on"' : "") + '><td style="width:14px;padding-right:0"><i class="pt" style="margin:0;background:' +
        (j >= 0 ? CAT[j] : "transparent") + '"></i></td><td>' + esc(c.nom) +
        (estFrontalier() ? ' <span class="muted">' + esc(c.region || c.canton) + "</span>" : "") +
        "</td></tr>";
    });
    h += "</tbody></table></div>";
    cote.innerHTML = h;
    var lignes = cote.querySelectorAll("tr[data-nom]");
    lignes.forEach(function (tr) {
      tr.addEventListener("click", function () { choisir(tr.dataset.nom); });
    });
    brancherSurvol(cote);
    function filtrer() {
      var q = normaliser(filtreTxt.trim());
      lignes.forEach(function (tr) { tr.hidden = !!q && tr.dataset.cle.indexOf(q) === -1; });
    }
    var inp = document.getElementById("ct-filtre");
    inp.addEventListener("input", function () { filtreTxt = inp.value; filtrer(); });
    filtrer();
  }

  function dessiner() {
    if (mode === "communes") { dessinerChoix(); dessinerPoi(); return; }
    if (multiple()) { dessinerCat(); dessinerPoi(); return; }
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
          fillOpacity: ok ? .68 : .35,
          color: "#ffffff", weight: 1
        });
        poly.unbindTooltip();
        poly.bindTooltip('<span class="ct-tip">' + esc(c.nom) +
          (estFrontalier() ? ' <span class="muted">' + esc(c.region || c.canton) + "</span>" : "") +
          "<small>" + esc(ind.nom) + " : " + nf(v, ind.fmt) + "</small></span>", { sticky: true });
      });
    });
    if (selection) surligner(selection, true);
    ecrire(vals, br, ind);
    panneauInegalites();
    panneauGrandeRegion();
    majSource();
    majAvertissement();
    dessinerPoi();
  }

  // ---------- les établissements sur la carte ----------
  //
  // Écoles fondamentales, maisons relais et foyers, crèches, lycées : quatre
  // familles de points que l'on affiche à la demande, par-dessus la carte
  // coloriée. Rien n'est affiché au départ : neuf cents points d'un coup
  // cacheraient la carte qu'on est venu lire.
  //
  // Une école entourée d'un anneau vert a, sur le même site, une structure
  // qui accueille les enfants scolarisés avant et après la classe : c'est ce
  // qu'on appelle un campus, qu'il en porte le nom ou non. La règle est dans
  // cartes/build_ecoles.py : même adresse, ou deux bâtiments à 150 mètres.
  var POI = [
    ["ef", "Écoles fondamentales", "#d1620a"],
    ["mr", "Maisons relais et foyers de jour", "#0f8b57"],
    ["cr", "Crèches", "#8b3fd1"],
    ["ly", "Lycées", "#c2185b"]
  ];
  var poi = { ef: false, mr: false, cr: false, ly: false };
  var couchePoi = null, renduPoi = null, signaturePoi = "";

  // Un point dit où est une école, pas la place qu'elle prend : le campus
  // Geesseknäppchen couvre vingt-trois hectares, une école de village tient
  // dans une cour. Les emprises viennent d'OpenStreetMap, par
  // cartes/build_emprises.py, et ne se chargent qu'au premier point demandé.
  var KB_EMPRISES = "cartes/emprises_kb.js?v=1", empriseDemandee = false;

  // Trois fonds. La carte claire porte les aplats de couleur. La photo
  // aérienne et le plan cadastral montrent le terrain : les aplats deviennent
  // alors presque transparents, sinon ils cacheraient ce qu'on est venu voir.
  // Les deux couches sont celles du Géoportail, en données ouvertes, et ne
  // couvrent que le Luxembourg.
  var FONDS = {
    photo: { nom: "Photo aérienne", min: 0,
      url: "https://wmts{s}.geoportail.lu/opendata/wmts/ortho_latest/GLOBAL_WEBMERCATOR_4_V3/{z}/{x}/{y}.jpeg" },
    cadastre: { nom: "Plan cadastral", min: 14,
      url: "https://wmts{s}.geoportail.lu/opendata/wmts/cadastre/GLOBAL_WEBMERCATOR_4_V3/{z}/{x}/{y}.png" }
  };
  var fond = "clair", fondPose = "clair", coucheFond = null;

  // Appelée à chaque rendu : elle ne touche à la carte que si le fond voulu
  // a changé, par un clic ou parce qu'on a passé la frontière.
  function appliquerFond() {
    if (!map) return;
    var voulu = poiPossible() ? fond : "clair";
    if (voulu === fondPose) return;
    fondPose = voulu;
    if (coucheFond) { map.removeLayer(coucheFond); coucheFond = null; }
    if (voulu !== "clair") {
      if (!map.getPane("fondplus")) {
        // Au-dessus du fond clair (200), sous les communes (400).
        map.createPane("fondplus").style.zIndex = 250;
      }
      coucheFond = L.tileLayer(FONDS[voulu].url, {
        pane: "fondplus", subdomains: "1234", minZoom: FONDS[voulu].min, maxZoom: 20, maxNativeZoom: 19,
        attribution: "Photo aérienne et plan cadastral : Administration du cadastre et de la topographie"
      }).addTo(map);
    }
    map.getPane("overlayPane").style.opacity = voulu === "clair" ? "" : ".22";
    map.setMaxZoom(voulu === "clair" ? 19 : 20);
  }

  function poiPossible() { return !estFrontalier() && mode !== "deux"; }

  function categoriePoi(q) {
    if (q.t === "ef" || q.t === "ly") return q.t;
    // Une structure qui accueille les deux âges se montre avec les maisons
    // relais, et avec les crèches quand elles seules sont demandées.
    if (q.es && poi.mr) return "mr";
    if (q.je && poi.cr) return "cr";
    return q.es ? "mr" : "cr";
  }

  function bullePoi(q) {
    var genre = q.t === "ef" ? "École fondamentale publique" : q.t === "ly" ? "Lycée"
      : (q.es && q.je ? "Accueil des jeunes enfants et des enfants scolarisés"
        : q.es ? "Accueil des enfants scolarisés" : "Accueil des jeunes enfants") +
        (q.cv ? ", conventionné" : ", non conventionné");
    var h = '<span class="ct-tip">' + esc(q.n) + "<small>" + esc(genre) + "<br>" + esc(q.a);
    if (q.mr && q.mr.length) h += "<br>Sur le même site : " + esc(q.mr.join(", "));
    if (q.p === 1) h += "<br>Point estimé " + esc(q.v) + ", le numéro exact manque au registre des adresses";
    if (q.p === 2) h += "<br>Position approximative, au milieu de la rue";
    return h + "</small></span>";
  }

  function dessinerPoi() {
    if (!map) return;
    appliquerFond();
    var actifs = POI.filter(function (p) { return poi[p[0]]; }).map(function (p) { return p[0]; });
    var sig = poiPossible() ? actifs.join(",") : "";
    if (sig === signaturePoi) return;
    signaturePoi = sig;
    if (!couchePoi) {
      // Un calque à part, au-dessus des communes et sous les noms de lieux :
      // les communes repassent devant les unes les autres au survol, les
      // points ne doivent pas disparaître dessous.
      var pane = map.createPane("poi");
      pane.style.zIndex = 620;
      renduPoi = L.canvas({ pane: "poi" });
      couchePoi = L.layerGroup().addTo(map);
    }
    couchePoi.clearLayers();
    if (!sig) return;
    var couleurs = {};
    POI.forEach(function (p) { couleurs[p[0]] = p[2]; });
    // Les emprises d'abord, les points par-dessus. Le fichier se charge à la
    // première demande, puis la couche se redessine.
    if (!window.EMPRISES && !empriseDemandee) {
      empriseDemandee = true;
      charger(KB_EMPRISES, "js", function () { signaturePoi = "?"; dessinerPoi(); });
    }
    var ecoles = poi.ef || poi.ly, accueils = poi.mr || poi.cr;
    ((window.EMPRISES || {}).zones || []).forEach(function (z) {
      if (z.t === "ec" ? !ecoles : !accueils) return;
      var c = z.t === "ec" ? couleurs.ef : couleurs.mr;
      z.g.forEach(function (enc) {
        L.polygon(decoder(enc), { pane: "poi", renderer: renduPoi, color: c, weight: 2,
          fillColor: c, fillOpacity: .22 })
          .bindTooltip('<span class="ct-tip">' + esc(z.n || (z.t === "ec" ? "École" : "Structure d'accueil")) +
            "<small>Emprise d'environ " + (z.s >= 10000
              ? (z.s / 10000).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " hectares"
              : Math.round(z.s / 10) * 10 + " m²") +
            ", contour OpenStreetMap</small></span>", { sticky: true })
          .addTo(couchePoi);
      });
    });
    // Les écoles se dessinent en dernier : sur un même site, l'école et sa
    // maison relais ont le même point, et c'est l'école qu'on doit voir,
    // entourée de son anneau vert.
    var ordre = { cr: 0, mr: 1, ly: 2, ef: 3 };
    ((window.ECOLES || {}).points || []).slice().sort(function (a, b) {
      return ordre[categoriePoi(a)] - ordre[categoriePoi(b)];
    }).forEach(function (q) {
      var cat = categoriePoi(q);
      if (!poi[cat]) return;
      var gros = cat === "ef" || cat === "ly";
      if (cat === "ef" && q.mr && q.mr.length) {
        L.circleMarker(q.c, { pane: "poi", renderer: renduPoi, radius: 10, color: couleurs.mr,
          weight: 2.5, fill: false, interactive: false }).addTo(couchePoi);
      }
      L.circleMarker(q.c, { pane: "poi", renderer: renduPoi, radius: gros ? 6 : 4.5, color: "#ffffff",
        weight: 1.5, fillColor: couleurs[cat], fillOpacity: .95 })
        .bindTooltip(bullePoi(q), { direction: "top", offset: [0, -4] })
        // Cliquer un point mène au site : à l'échelle du pays on voit où
        // sont les écoles, à l'échelle de la rue on voit ce qu'elles occupent.
        .on("click", function (e) {
          L.DomEvent.stopPropagation(e);
          map.setView(q.c, Math.max(map.getZoom(), 17), { animate: true });
        })
        .addTo(couchePoi);
    });
  }

  function surligner(nom, on) {
    (formes[nom] || []).forEach(function (p) {
      p.setStyle({ color: on ? "#0b0f16" : "#ffffff", weight: on ? 2.5 : 1 });
      if (on) p.bringToFront();
    });
  }

  // Survol croisé : une ligne de la liste éclaire sa commune sur la carte, et
  // une commune sur la carte éclaire sa ligne. La question « où est
  // celle-là » se pose dans les deux sens.
  function estRetenue(nom) {
    return nom === selection || (mode === "communes" && panierCommunes.indexOf(nom) >= 0);
  }
  function survolDepuisListe(nom, on) {
    if (!estRetenue(nom)) surligner(nom, on);
  }
  function survolDepuisCarte(nom, on) {
    var k = document.getElementById("ct-rangs");
    if (!k) return;
    k.querySelectorAll("tr[data-nom]").forEach(function (tr) {
      tr.classList.toggle("hov", on && tr.dataset.nom === nom);
    });
  }
  function brancherSurvol(cote) {
    cote.querySelectorAll("tr[data-nom]").forEach(function (tr) {
      tr.addEventListener("mouseenter", function () { survolDepuisListe(tr.dataset.nom, true); });
      tr.addEventListener("mouseleave", function () { survolDepuisListe(tr.dataset.nom, false); });
    });
  }

  // Pose les polygones des zones affichées dans la couche et cadre la carte
  // dessus. Trois moments y passent : la création de la carte, le changement
  // de territoire, le filtrage par région.
  function poserFormes() {
    Object.keys(formes).forEach(function (n) {
      formes[n].forEach(function (p) { couche.removeLayer(p); });
    });
    formes = {};
    var tous = [];
    zones().forEach(function (c) {
      formes[c.nom] = c.g.map(function (enc) {
        var pts = decoder(enc);
        tous = tous.concat(pts);
        var poly = L.polygon(pts, { color: "#fff", weight: 1, fillOpacity: .68 }).addTo(couche);
        poly.on("click", function () { choisir(c.nom); });
        poly.on("mouseover", function () { survolDepuisCarte(c.nom, true); });
        poly.on("mouseout", function () { survolDepuisCarte(c.nom, false); });
        return poly;
      });
    });
    if (tous.length) {
      cadreTotal = L.latLngBounds(tous);
      map.fitBounds(cadreTotal, { padding: [8, 8] });
    }
  }

  function choisir(nom) {
    // En vue « comparer », cliquer une commune déjà retenue la retire : le
    // même geste ajoute et enlève, comme une case qu'on coche et décoche.
    if (mode === "communes" && panierCommunes.indexOf(nom) >= 0) { retirerCommune(nom); return; }
    if (selection && selection !== nom) surligner(selection, false);
    // Le panier n'existe qu'en vue « comparer » : en vue « une carte », le
    // clic remplace la commune regardée, il n'en accumule pas.
    if (mode === "communes") ajouterCommune(nom);
    selection = nom;
    surligner(nom, true);
    var c = zones().filter(function (x) { return x.nom === nom; })[0];
    if (c && mode !== "deux") map.panTo(c.c);
    if (mode === "communes") { boutons(); dessinerChoix(); }
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

  // Le premier du classement est le meilleur, pas le plus grand. Pour un loyer
  // ou une distance, « meilleur » veut dire plus petit : l'indicateur porte le
  // sens, et le classement le suit.
  function croissant(id) {
    var ind = listeIndic().filter(function (i) { return i.id === id; })[0];
    return !!(ind && ind.sens < 0);
  }

  function rang(id, nom) {
    var sgn = croissant(id) ? -1 : 1;
    var l = zones().filter(function (c) { return c.i[id] !== undefined; })
      .sort(function (a, b) { return sgn * (b.i[id] - a.i[id]); });
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
    // Une mini-courbe de 64 pixels ne se survole pas point par point : au
    // survol elle dit au moins ses deux bornes, la première et la dernière.
    var prem = 0, dern = v.length - 1;
    while (prem < dern && (v[prem] === null || v[prem] === undefined)) prem++;
    while (dern > prem && (v[dern] === null || v[dern] === undefined)) dern--;
    var fmt = (listeIndic().filter(function (x) { return x.id === id; })[0] || {}).fmt;
    var titre = "de " + nf(v[prem], fmt) + " en " + s.annees[prem] + " à " + nf(v[dern], fmt) + " en " + s.annees[dern];
    return '<svg width="' + L_ + '" height="' + H + '" viewBox="0 0 ' + L_ + " " + H +
      '" role="img" aria-label="' + esc(titre) + '"><title>' + esc(titre) + "</title>" +
      '<polyline fill="none" stroke="var(--accent,#2563eb)" ' +
      'stroke-width="1.4" stroke-linejoin="round" points="' + pts.join(" ") + '"></polyline>' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.1" fill="var(--accent,#2563eb)"></circle></svg>';
  }

  // Le second niveau d'une zone : le canton au Luxembourg, le pays quand on a
  // passé la frontière. Le champ est le même, la phrase ne peut pas l'être.
  function situation(c) {
    if (!c || !c.canton) return "";
    if (!estFrontalier()) return "canton de " + c.canton;
    return c.region ? c.region + ", " + c.canton : c.canton;
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
    if (panierCommunes.length >= MAX_PANIER) return;
    if (!panierCommunes.length && selection && selection !== nom) panierCommunes.push(selection);
    panierCommunes.push(nom);
  }

  function retirerCommune(nom) {
    var j = panierCommunes.indexOf(nom);
    if (j >= 0) panierCommunes.splice(j, 1);
    if (selection === nom) { surligner(nom, false); selection = panierCommunes[0] || null; }
    if (mode === "communes") { boutons(); dessinerChoix(); }
    else if (mode === "carte") {
      var k = document.getElementById("ct-rangs");
      if (k) k.querySelectorAll("tr").forEach(function (tr) {
        tr.classList.toggle("on", tr.dataset.nom === selection);
      });
    }
    fiche();
  }

  // Déplace une commune d'un cran dans le panier. La couleur suit la position,
  // donc la carte et les puces se redessinent avec le tableau.
  function deplacerCommune(nom, sens) {
    var j = panierCommunes.indexOf(nom), k = j + sens;
    if (j < 0 || k < 0 || k >= panierCommunes.length) return;
    panierCommunes[j] = panierCommunes[k];
    panierCommunes[k] = nom;
    if (mode === "communes") { boutons(); dessinerChoix(); }
    fiche();
  }

  // Les communes du panier en puces colorées, avec ou sans la croix qui
  // retire ; et la liste déroulante qui en ajoute une. Les deux servent dans
  // le sélecteur et dans la fiche, et se branchent par brancherPanier.
  function puces(liste, retirable) {
    var h = "";
    liste.forEach(function (c, j) {
      h += retirable
        ? '<button class="ct-natpuce" data-retirer="' + esc(c.nom) + '" title="Retirer de la comparaison">' +
          '<i style="background:' + CAT[j] + '"></i><b>' + esc(c.nom) + '</b><span class="x">✕</span></button>'
        : '<span class="ct-natpuce"><i style="background:' + CAT[j] + '"></i><b>' + esc(c.nom) + "</b></span>";
    });
    return h;
  }

  function selectAjout(liste) {
    if (liste.length >= MAX_PANIER) return "";
    var h = '<select class="ct-ajout" data-ajout aria-label="Ajouter une ' + motZone(false) + ' à la comparaison">' +
      '<option value="">+ ajouter ' + (liste.length ? "une autre " : "une ") + motZone(false) + "…</option>";
    zones().slice().sort(function (a, b) { return a.nom.localeCompare(b.nom, "fr"); })
      .forEach(function (c) {
        if (liste.indexOf(c) === -1) h += '<option value="' + esc(c.nom) + '">' + esc(c.nom) + "</option>";
      });
    return h + "</select>";
  }

  function brancherPanier(k) {
    k.querySelectorAll("button[data-retirer]").forEach(function (b) {
      b.addEventListener("click", function () { retirerCommune(b.dataset.retirer); });
    });
    k.querySelectorAll("select[data-ajout]").forEach(function (s) {
      s.addEventListener("change", function () { if (s.value) choisir(s.value); });
    });
  }

  function fiche() {
    var k = document.getElementById("ct-fiche");
    if (!k) return;
    if (mode === "deux") { k.innerHTML = ""; return; }
    if (mode === "carte") { ficheIndicateur(); return; }
    var liste = communesComparees();
    if (!liste.length) { k.innerHTML = ""; return; }
    var dispo = listeIndic();
    // Le tableau large : plus de cinq colonnes, ou un écran de téléphone.
    var large = liste.length > 5 || (window.matchMedia && window.matchMedia("(max-width:760px)").matches);
    var h = '<div class="card ct-cmpc' + (large ? " large" : "") + '"><div class="tete">' +
      '<h3 style="margin:0 8px 0 0">' + (liste.length > 1 ? liste.length + " " + motZone(true) +
      " côte à côte" : esc(liste[0].nom) + ", toutes ses données") + "</h3>";
    h += '</div><div class="defil"><table><thead><tr><th></th>';
    // Chaque colonne porte ses commandes : la déplacer d'un cran, la retirer.
    // La couleur suit la position, sur la carte comme ici.
    liste.forEach(function (c, j) {
      var outils = liste.length > 1
        ? '<span class="outils">' +
          '<button type="button" data-deplacer="' + esc(c.nom) + '" data-sens="-1" title="Déplacer à gauche"' +
          (j === 0 ? " disabled" : "") + ' aria-label="Déplacer ' + esc(c.nom) + ' à gauche">‹</button>' +
          '<button type="button" data-deplacer="' + esc(c.nom) + '" data-sens="1" title="Déplacer à droite"' +
          (j === liste.length - 1 ? " disabled" : "") + ' aria-label="Déplacer ' + esc(c.nom) + ' à droite">›</button>' +
          '<button type="button" data-retirer="' + esc(c.nom) + '" title="Retirer de la comparaison"' +
          ' aria-label="Retirer ' + esc(c.nom) + '">✕</button></span>'
        : "";
      h += '<th><div class="col"><span><i class="pt" style="background:' + CAT[j] + '"></i>' + esc(c.nom) +
        "<small>" + esc(situation(c)) + "</small></span>" + outils + "</div></th>";
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
      h += '<tr class="fam"><td colspan="' + (liste.length + 1) + '"><span>Nationalité affichée</span></td></tr>' +
        ligne(indNation);
    }
    (couche_nom === "quartiers" ? GROUPES_QUARTIERS : groupes()).forEach(function (g) {
      var lignes = "";
      g[1].forEach(function (id) {
        var ind = dispo.filter(function (x) { return x.id === id; })[0];
        if (ind) lignes += ligne(ind);
      });
      if (lignes) {
        h += '<tr class="fam"><td colspan="' + (liste.length + 1) + '"><span>' + esc(g[0]) + "</span></td></tr>" + lignes;
      }
    });

    // Nationalités : les dix plus nombreuses de la première commune, en part,
    // avec une barre. Dix lignes de pourcentages se comparent mal à l'oeil,
    // dix barres se comparent d'un coup. La plus longue vaut la part la plus
    // forte du bloc, les autres sont à proportion.
    if (couche_nom === "communes" && liste[0].n && liste[0].i.nat_tot) {
      var c0 = liste[0];
      var top = Object.keys(c0.n).sort(function (a, b) { return c0.n[b] - c0.n[a]; }).slice(0, 10);
      var parts = {}, maxPart = 0;
      top.forEach(function (code) {
        parts[code] = liste.map(function (c) {
          var t = c.i.nat_tot, v = t ? 100 * ((c.n || {})[code] || 0) / t : undefined;
          if (v !== undefined && v > maxPart) maxPart = v;
          return v;
        });
      });
      h += '<tr class="fam"><td colspan="' + (liste.length + 1) + '"><span>Nationalités, part des inscrits</span></td></tr>';
      top.forEach(function (code) {
        var n = infoNation(code) || { n: code };
        h += '<tr class="ind" data-nat="' + code + '"><td>' + drapeau(n) + " " + esc(n.n) + "</td>";
        parts[code].forEach(function (v, j) {
          h += '<td><span class="nb"><b>' + nf(v, "pct") + '</b><span class="ct-jauge"><i style="width:' +
            (v === undefined ? 0 : Math.max(1.5, 100 * v / (maxPart || 1))).toFixed(1) +
            "%;background:" + CAT[j] + '"></i></span></span></td>';
        });
        h += "</tr>";
      });
    }
    h += "</tbody></table></div></div>";
    h += notes(liste);
    k.innerHTML = h;
    brancherPanier(k);
    k.querySelectorAll("button[data-deplacer]").forEach(function (b) {
      b.addEventListener("click", function () { deplacerCommune(b.dataset.deplacer, +b.dataset.sens); });
    });
    // Le nom d'une ligne ne fait rien au clic. Il a un temps ramené en vue
    // « une carte » sur cet indicateur, et l'on se retrouvait sur une autre
    // vue sans l'avoir demandé : on change de vue par la rangée « Vue », pas
    // par un clic dans le tableau.
  }

  // ---------- les notes : ce qu'un chiffre ne dit pas ----------
  //
  // Le nombre d'élèves et le nombre de classes ne répondent pas à la question
  // « y a-t-il une école ici, un lycée, une école européenne ». Ces faits sont
  // des noms d'établissements : ils viennent de cartes/ecoles_kb.js, construit
  // depuis les adresses publiées par le ministère de l'Éducation nationale.

  function noteDe(c) {
    if (!window.ECOLES || !c) return null;
    // Les quartiers n'ont pas de code commune : la note est celle de la ville.
    var lau = c.lau || (couche_nom === "quartiers" ? "0304" : "");
    return lau ? (window.ECOLES.communes || {})[lau] || null : null;
  }

  function listeEtab(titre, items, rendu) {
    if (!items.length) return "";
    return "<h5>" + esc(titre) + "</h5><ul>" + items.map(rendu).join("") + "</ul>";
  }

  function noteEcoles(c, titreVille) {
    var n = noteDe(c);
    if (!n) return "";
    var ef = n.ef || [], ly = n.ly || [], sea = n.sea || { tot: 0 };
    var localites = {}, nloc = 0;
    ef.forEach(function (e) { if (!localites[e.l]) { localites[e.l] = 1; nloc++; } });

    var resume = [];
    resume.push(ef.length === 0 ? "aucune école fondamentale dans le fichier du ministère"
      : ef.length + (ef.length > 1 ? " écoles fondamentales" : " école fondamentale")
        + (nloc > 1 ? " dans " + nloc + " localités" : ""));
    if (ly.length) resume.push(ly.length + (ly.length > 1 ? " lycées" : " lycée"));
    if (sea.tot) resume.push(sea.tot + (sea.tot > 1 ? " structures d'accueil" : " structure d'accueil"));

    var h = '<div class="ct-ecole"><h4>' + esc(titreVille || c.nom);
    if ((n.campus || []).length) h += '<span class="eti">campus scolaire</span>';
    h += "</h4>";
    h += '<p class="resume">' + esc(resume.join(", ")) + ".</p>";

    h += listeEtab("Écoles fondamentales", ef, function (e) {
      return "<li>" + esc(e.n) + (e.l && e.l !== c.nom ? ' <span class="off">' + esc(e.l) + "</span>" : "") + "</li>";
    });
    h += listeEtab("Lycées et écoles internationales", ly, function (e) {
      var o = "";
      if (e.o) {
        o = '<span class="off">' + esc(e.o) + (e.g === false ? ", payant" : ", gratuit");
        if (e.u) o += ' · <a href="' + esc(e.u) + '" target="_blank" rel="noopener noreferrer">source</a>';
        o += "</span>";
      }
      return "<li>" + esc(e.n) + o + "</li>";
    });
    if (!ly.length) h += '<p class="rien">Pas de lycée sur le territoire : les élèves du secondaire en rejoignent un ailleurs, souvent par le bus scolaire ou le train.</p>';
    if (sea.tot) {
      h += "<h5>Crèches et maisons relais</h5><ul><li>" + sea.tot + " structures, dont " + sea.conv +
        " conventionnées avec l'État</li><li>" + sea.je + " accueillent les jeunes enfants, " + sea.es +
        " les enfants scolarisés</li></ul>";
    }
    h += "</div>";
    return h;
  }

  function notes(liste) {
    if (!window.ECOLES || !liste || !liste.length) return "";
    var quart = couche_nom === "quartiers";
    var cartes = quart
      ? noteEcoles(liste[0], "Luxembourg-Ville, toute la commune")
      : liste.map(function (c) { return noteEcoles(c); }).join("");
    if (!cartes) return "";
    var m = window.ECOLES.meta || {};
    var h = '<h3 style="margin:26px 0 0">Les écoles, sur le terrain</h3>' +
      '<p class="hint" style="margin-top:6px">Ce que les chiffres d\'élèves et de classes ne disent pas : ' +
      'où sont les écoles, comment elles s\'appellent, et quel lycée est sur place.' +
      (quart ? " Les écoles sont recensées par commune : cette note vaut pour toute la Ville de Luxembourg, pas pour le seul quartier." : "") +
      "</p>" + '<div class="ct-ecoles">' + cartes + "</div>";
    h += notePays();
    h += '<p class="hint" style="margin-top:10px">' + esc(m.vintage || "") + " Sources : " +
      esc((m.sources || []).join(" · ")) + "</p>";
    return h;
  }

  // La question qui vient juste après « et ailleurs ? » : les communes qui ont
  // un campus, celles qui ont une école européenne gratuite, celles qui ont un
  // lycée. La réponse tient dans la base, il suffit de la parcourir.
  function notePays() {
    var com = (window.ECOLES || {}).communes || {};
    var noms = {};
    (kb.communes || []).forEach(function (c) { if (c.lau) noms[c.lau] = c.nom; });
    var campus = [], avecLycee = [], europeennes = [];
    Object.keys(com).forEach(function (lau) {
      var d = com[lau], nom = noms[lau] || "";
      if (!nom) return;
      if ((d.campus || []).length) campus.push(nom);
      if ((d.ly || []).length) avecLycee.push(nom);
      (d.ly || []).forEach(function (e) {
        if (e.o && /européen/i.test(e.o) && e.g !== false) europeennes.push(nom + " (" + e.n + ")");
      });
    });
    var tri = function (a) { return a.sort(function (x, y) { return x.localeCompare(y, "fr"); }); };
    var h = '<details class="ct-ecoles-pays"><summary>Et dans les autres communes ?</summary>';
    h += "<p><b>Un lycée sur le territoire :</b> " + tri(avecLycee).join(", ") + ". Les " +
      ((kb.communes || []).length - avecLycee.length) + " autres communes n'en ont pas.</p>";
    h += "<p><b>Une école qui porte le nom de campus :</b> " + tri(campus).join(", ") +
      ". Ailleurs, les écoles gardent le nom de leur localité, ce qui ne dit rien de leur taille : " +
      "plusieurs communes ont regroupé leurs classes sur un seul site sans l'appeler campus.</p>";
    h += "<p><b>Une école européenne publique et gratuite :</b> " + tri(europeennes).join(" · ") +
      ". Elles accueillent les élèves de tout le pays, pas seulement ceux de la commune.</p>";
    h += "</details>";
    return h;
  }

  // La fiche de la vue « une carte » : l'indicateur affiché, et pour la
  // commune cliquée sa valeur, son rang, sa position dans l'étendue, puis sa
  // courbe quand la série existe. Rien d'autre : on a choisi un indicateur,
  // on lit cet indicateur. Comparer des communes est une autre vue.
  function ficheIndicateur() {
    var k = document.getElementById("ct-fiche");
    var c = selection ? communeDe(selection) : null;
    var ind = indic();
    if (!c || !ind) { k.innerHTML = ""; return; }
    var liste = [c];
    var champ = ind.id;
    var h = '<div class="card ct-fi"><div class="tete">' +
      '<h3 style="margin:0 8px 0 0">' + esc(c.nom) +
      ' <span class="muted" style="font-weight:400;font-size:14px">' + esc(situation(c)) + "</span></h3></div>";
    h += '<table class="ct-fitbl"><tbody>';
    liste.forEach(function (c, j) {
      var v = c.i[champ], rg = v === undefined ? null : rang(champ, c.nom), p = position(champ, v);
      h += '<tr><td><i class="pt" style="background:' + CAT[j] + '"></i>' + esc(ind.nom) +
        (ind.unite ? "<small>en " + esc(ind.unite) + "</small>" : "") +
        '</td><td class="n"><b>' + nf(v, ind.fmt) + "</b></td>" +
        '<td class="n muted">' + (rg ? rg[0] + "e sur " + rg[1] + " " + motZone(true) : "") + "</td>" +
        '<td class="jg" title="Position entre la plus basse et la plus haute valeur"><div class="ct-jauge"><i style="width:' +
        (p === null ? 0 : Math.max(2, 100 * p)).toFixed(1) + "%;background:" + CAT[j] + '"></i></div></td></tr>';
    });
    h += "</tbody></table>";

    var s = couche_nom === "communes" ? serieDe(champ) : null;
    if (s) {
      var lignes = [];
      liste.forEach(function (c, j) {
        var v = (c.s || {})[champ];
        if (v) lignes.push({ vals: v, couleur: CAT[j], nom: c.nom });
      });
      if (lignes.length) {
        var pilote = serieCourante() && serieCourante() === s;
        h += "<h4>De " + s.annees[0] + " à " + s.annees[s.annees.length - 1] +
          ' <span class="muted" style="font-weight:400">' +
          (annee !== null ? "· l'année affichée sur la carte est marquée · " : "· ") +
          "survolez pour lire une année" + (pilote ? ", cliquez pour la poser sur la carte" : "") +
          "</span></h4>" +
          graphe(s.annees, lignes, ind.fmt, annee, pilote ? function (a) { arreterLecture(); allerA(a); } : null);
      }
    } else if (couche_nom === "communes" && champ !== "nation" && champ !== "natcmp") {
      h += '<p class="hint" style="margin-top:12px">La base ne porte pas de série annuelle pour ' +
        "cet indicateur, seulement la dernière valeur publiée.</p>";
    }
    if (couche_nom === "communes" && (champ === "nation" || champ === "natcmp")) h += listeNations(c);
    h += "</div>";
    if (!estFrontalier()) h += notes(liste);
    k.innerHTML = h;
    brancherGraphes(k);
    k.querySelectorAll("li[data-nat]").forEach(function (li) {
      li.addEventListener("click", function () { choisirNation(li.dataset.nat); });
      li.style.cursor = "pointer";
    });
  }

  // ---------- les vues ----------

  function changerMode(m) {
    if (m === "deux" && couche_nom !== "communes") m = "carte";
    if (m === mode) return;
    mode = m;
    comparer = mode === "deux";
    // On entre dans la comparaison avec la commune qu'on regardait : elle
    // rejoint le panier s'il reste de la place, sinon on repart du panier.
    if (mode === "communes" && selection && panierCommunes.indexOf(selection) < 0) ajouterCommune(selection);
    if (mode !== "carte") {
      // Le tableau et les deux cartes lisent la dernière valeur : si le
      // curseur du temps avait posé une autre année, on la retire d'abord.
      arreterLecture();
      var s = serieCourante();
      if (s && annee !== null) { annee = s.annees[s.annees.length - 1]; appliquerAnnee(); }
      annee = null;
    }
    appliquerMode();
  }

  // Pose la vue courante : ce qui se cache, ce qui se montre, puis le rendu.
  function appliquerMode() {
    var deux = mode === "deux", choix = mode === "communes";
    var k = document.getElementById("ct-comparer");
    if (k) k.hidden = !deux;
    var vue = document.querySelector("#panel-cartes .ct-vue");
    if (vue) vue.hidden = deux;
    ["ct-temps", "ct-sortie", "ct-ineg"].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.hidden = deux || choix;
    });
    boutons();
    if (deux) {
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
      fiche();
      return;
    }
    // La carte unique a pu être cachée : Leaflet doit reprendre sa taille.
    setTimeout(function () {
      if (map) map.invalidateSize();
      if (map && cadreTotal) map.fitBounds(cadreTotal, { padding: [8, 8] });
    }, 60);
    if (choix) arreterLecture();
    else { calerEchelle(); barreTemps(); }
    dessiner();
    fiche();
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

    var sgn = croissant(courant) ? -1 : 1;
    var tri = zones().slice().sort(function (a, b) {
      var x = a.i[courant], y = b.i[courant];
      if (x === undefined) return 1;
      if (y === undefined) return -1;
      return sgn * (y - x);
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
    brancherSurvol(cote);
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

  // Une ou plusieurs courbes sur les mêmes années, chacune sa couleur, et
  // l'année marquée par un trait vertical quand la carte en affiche une.
  //
  // Le graphe se lit au survol : un trait suit l'année la plus proche du
  // pointeur, un point se pose sur chaque courbe et une bulle donne la valeur
  // de chacune. Une courbe sans ses chiffres oblige à estimer à l'oeil, et
  // c'est justement le chiffre qu'on est venu chercher. Un clic pose l'année
  // sur la carte quand elle en affiche une (surClic).
  //
  // Le SVG est une chaîne insérée par innerHTML : les données de chaque
  // graphe attendent dans un registre le temps que brancherGraphes les
  // accroche à l'élément, puis le registre les lâche.
  var graphes = {}, nGraphes = 0;

  function graphe(annees, lignes, fmt, marque, surClic) {
    var L_ = 460, H = 170, mg = 34, i;
    var vals = [];
    lignes.forEach(function (l) {
      l.vals.forEach(function (v) { if (v !== null && v !== undefined) vals.push(v); });
    });
    if (vals.length < 2) return "";
    var mini = Math.min.apply(null, vals), maxi = Math.max.apply(null, vals);
    var bas = mini - (maxi - mini) * .25, haut = maxi + (maxi - mini) * .2;
    var x = function (j) { return mg + j * (L_ - mg - 8) / (annees.length - 1); };
    var y = function (v) { return 12 + (haut - v) / (haut - bas || 1) * (H - 34); };
    var id = "g" + (++nGraphes);
    graphes[id] = { annees: annees, lignes: lignes, fmt: fmt, x: x, y: y, L: L_, mg: mg, clic: surClic };
    // Pas de hauteur fixée : elle suit la largeur, sinon le dessin se réduit
    // au centre et la souris ne tombe plus sur les bonnes années.
    var g = '<svg class="ct-graphe" data-g="' + id + '" viewBox="0 0 ' + L_ + " " + H +
      '" role="img" aria-label="Courbe de ' + annees[0] + " à " + annees[annees.length - 1] + '">';
    // Deux repères horizontaux seulement : une grille dense ferait un tableau.
    [maxi, mini].forEach(function (v) {
      g += '<line x1="' + mg + '" x2="' + (L_ - 8) + '" y1="' + y(v).toFixed(1) + '" y2="' +
        y(v).toFixed(1) + '" stroke="var(--border,#e6eaef)" stroke-width="1"></line>' +
        '<text x="0" y="' + (y(v) + 4).toFixed(1) + '" font-size="11" fill="var(--muted,#6a7583)">' +
        nf(v, fmt) + "</text>";
    });
    var jm = marque === null || marque === undefined ? -1 : annees.indexOf(marque);
    if (jm >= 0) {
      g += '<line x1="' + x(jm).toFixed(1) + '" x2="' + x(jm).toFixed(1) + '" y1="8" y2="' + (H - 20) +
        '" stroke="var(--muted,#6a7583)" stroke-width="1" stroke-dasharray="3 3"></line>';
    }
    lignes.forEach(function (l) {
      var valeurs = l.vals, pts = [];
      for (i = 0; i < valeurs.length; i++) {
        if (valeurs[i] === null || valeurs[i] === undefined) continue;
        pts.push(x(i).toFixed(1) + "," + y(valeurs[i]).toFixed(1));
      }
      if (!pts.length) return;
      var dern = valeurs.length - 1;
      while (dern > 0 && (valeurs[dern] === null || valeurs[dern] === undefined)) dern--;
      g += '<polyline fill="none" stroke="' + l.couleur + '" stroke-width="2" ' +
        'stroke-linejoin="round" points="' + pts.join(" ") + '"></polyline>';
      g += '<circle cx="' + x(dern).toFixed(1) + '" cy="' + y(valeurs[dern]).toFixed(1) +
        '" r="3.4" fill="' + l.couleur + '"></circle>';
    });
    g += '<text x="' + mg + '" y="' + (H - 4) + '" font-size="11" fill="var(--muted,#6a7583)">' +
      annees[0] + "</text>";
    g += '<text x="' + (L_ - 8) + '" y="' + (H - 4) + '" font-size="11" text-anchor="end" ' +
      'fill="var(--muted,#6a7583)">' + annees[annees.length - 1] + "</text>";
    // Le trait et les points du survol, cachés tant que rien n'est survolé.
    g += '<g class="hov" style="display:none"><line x1="0" x2="0" y1="8" y2="' + (H - 20) +
      '" stroke="var(--text,#0b0f16)" stroke-width="1" stroke-opacity=".55"></line>';
    lignes.forEach(function (l) {
      g += '<circle cx="0" cy="0" r="4" fill="' + l.couleur + '" stroke="#fff" stroke-width="1.5"></circle>';
    });
    g += "</g></svg>";
    return '<div class="ct-gwrap">' + g + '<div class="ct-gtip" hidden></div></div>';
  }

  function brancherGraphes(k) {
    k.querySelectorAll("svg.ct-graphe").forEach(function (svg) {
      var d = graphes[svg.dataset.g];
      if (!d) return;
      delete graphes[svg.dataset.g];
      var tip = svg.parentNode.querySelector(".ct-gtip");
      var hov = svg.querySelector("g.hov");
      var trait = hov.querySelector("line"), points = hov.querySelectorAll("circle");
      var pas = (d.L - d.mg - 8) / (d.annees.length - 1);

      function indexDe(e) {
        var r = svg.getBoundingClientRect();
        var xv = (e.clientX - r.left) * d.L / r.width;
        var j = Math.round((xv - d.mg) / pas);
        return Math.max(0, Math.min(d.annees.length - 1, j));
      }
      function montrer(j) {
        var xj = d.x(j).toFixed(1);
        trait.setAttribute("x1", xj);
        trait.setAttribute("x2", xj);
        var h = "<b>" + d.annees[j] + "</b>";
        d.lignes.forEach(function (l, i) {
          var v = l.vals[j], c = points[i];
          if (v === null || v === undefined) c.style.display = "none";
          else {
            c.style.display = "";
            c.setAttribute("cx", xj);
            c.setAttribute("cy", d.y(v).toFixed(1));
          }
          h += '<span><i style="background:' + l.couleur + '"></i>' + esc(l.nom || "") +
            (l.nom ? " " : "") + nf(v, d.fmt) + "</span>";
        });
        hov.style.display = "";
        tip.innerHTML = h;
        tip.hidden = false;
        // La bulle se pose à droite du trait, et passe à gauche sur le
        // dernier tiers pour ne pas sortir du cadre.
        var r = svg.getBoundingClientRect(), px = d.x(j) * r.width / d.L;
        if (px > r.width * .62) { tip.style.left = "auto"; tip.style.right = (r.width - px + 10) + "px"; }
        else { tip.style.right = "auto"; tip.style.left = (px + 10) + "px"; }
      }
      svg.addEventListener("pointermove", function (e) { montrer(indexDe(e)); });
      svg.addEventListener("pointerleave", function () { hov.style.display = "none"; tip.hidden = true; });
      if (d.clic) {
        svg.style.cursor = "pointer";
        svg.addEventListener("click", function (e) { d.clic(d.annees[indexDe(e)]); });
      }
    });
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
      "</p>" + graphe(n.annees, [{ vals: n.gini, couleur: "var(--accent,#2563eb)", nom: "Gini" }], "dec") +
      "</div><div>" +
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
    brancherGraphes(k);
  }

  // ---------- la Grande Région ----------
  //
  // Ce panneau ne peint rien sur la carte, et c'est voulu. Le revenu, le
  // produit intérieur brut et le chômage ne sont comparables d'un pays à
  // l'autre qu'à l'échelle de la région : les publier commune par commune
  // reviendrait à peindre un chiffre français et un chiffre allemand sur la
  // même échelle de couleurs, alors qu'ils ne mesurent pas la même chose.

  function barreLigne(v, maxi, txt) {
    var p = maxi ? Math.max(2, 100 * v / maxi) : 0;
    return '<td class="n">' + txt + '</td><td style="width:110px"><div class="bar">' +
      '<i style="width:' + p.toFixed(1) + '%"></i></div></td>';
  }

  // La ligne de sources sous la carte décrit la base réellement affichée : deux
  // bases cohabitent dans cet onglet, et se tromper de source est pire que ne
  // pas en donner.
  function majSource() {
    var k = document.getElementById("ct-source");
    if (!k) return;
    if (estFrontalier() && front) {
      k.textContent = "Base construite le " + front.meta.construit + " sur " +
        zones().length + " communes situées à moins de " + front.meta.rayon +
        " km de Luxembourg-Ville. Sources : " + front.meta.sources.join(" ; ") + ".";
    } else {
      k.textContent = "Base construite le " + kb.meta.construit + " sur " + kb.meta.n +
        " communes. Sources : " + kb.meta.sources.join(" ; ") + ".";
    }
  }

  function panneauGrandeRegion() {
    var k = document.getElementById("ct-gr");
    if (!k) return;
    if (!estFrontalier() || !front) { k.innerHTML = ""; return; }

    var regs = front.regions.filter(function (r) { return r.revenu; });
    var maxRev = Math.max.apply(null, regs.map(function (r) { return r.revenu; }));
    var h = '<div class="card ct-gr"><div class="deux"><div>' +
      "<h3>Ce qui reste à un ménage, région par région</h3>" +
      '<p class="hint" style="margin-top:2px">Revenu disponible par habitant, après impôts et ' +
      "transferts, en standards de pouvoir d'achat : la seule mesure du revenu qui se compare " +
      "vraiment entre les quatre pays, parce qu'elle corrige les écarts de prix." +
      "</p><table><thead><tr><th>Région</th><th>Par habitant</th><th></th></tr></thead><tbody>";
    regs.sort(function (a, b) { return b.revenu - a.revenu; }).forEach(function (r) {
      h += "<tr><td" + (r.pays === "LU" ? ' class="ici"' : "") + ">" + esc(r.nom) +
        ' <span class="muted">' + esc(front.pays[r.pays]) + "</span></td>" +
        barreLigne(r.revenu, maxRev, Math.round(r.revenu).toLocaleString("fr-FR")) + "</tr>";
    });
    h += "</tbody></table>";
    var ans = regs.map(function (r) { return r.an_revenu; }).filter(Boolean).sort();
    h += '<p class="hint">Eurostat, revenu des ménages par région (nama_10r_2hhinc), ' +
      (ans.length ? ans[0] + " à " + ans[ans.length - 1] : "") +
      ". Un salaire luxembourgeois dépensé en Lorraine ne figure dans aucune de ces lignes : " +
      "elles décrivent ce que gagnent les habitants d'une région, pas ce que gagne un " +
      "frontalier qui y habite.</p></div>";

    // Prix : le Luxembourg sert de repère, puisque c'est là qu'on travaille.
    h += "<div><h3>Ce qui coûte moins cher de l'autre côté</h3>" +
      '<p class="hint" style="margin-top:2px">Indices de niveau des prix ' + front.prix.annee +
      ", Luxembourg ramené à 100. Sous 100, c'est moins cher que chez le voisin " +
      "luxembourgeois ; au-dessus, plus cher." +
      "</p><table><thead><tr><th>Panier</th><th>France</th><th>Belgique</th><th>Allemagne</th>" +
      "</tr></thead><tbody>";
    front.prix.categories.forEach(function (c) {
      h += "<tr><td>" + esc(c.nom) + "</td>";
      ["FR", "BE", "DE"].forEach(function (p) {
        var r = c.LU ? Math.round(100 * c[p] / c.LU) : null;
        var cls = r === null ? "" : (r < 95 ? "moins" : (r > 105 ? "plus" : ""));
        h += '<td class="' + cls + '">' + (r === null ? "—" : r) + "</td>";
      });
      h += "</tr>";
    });
    h += "</tbody></table>";
    h += '<p class="hint">Eurostat, indices de niveau des prix (prc_ppp_ind), ' +
      front.prix.annee + ". Ce sont des moyennes de pays, pas des relevés de magasins à la " +
      "frontière : elles disent dans quel sens va l'écart et son ordre de grandeur, pas le " +
      "prix d'un article précis. Les carburants et le tabac font partie des postes où " +
      "l'écart est le plus net, dans l'autre sens.</p></div></div></div>";
    k.innerHTML = h;
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
  // inégalités se retirent (voir appliquerMode) ; les boutons d'indicateurs
  // restent et pilotent la carte de gauche.

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
      poserFond(m, false);
      var couche_i = L.layerGroup().addTo(m);
      formesCmp[i] = {};
      kb.communes.forEach(function (c) {
        formesCmp[i][c.nom] = c.g.map(function (enc) {
          var poly = L.polygon(decoder(enc), { color: "#fff", weight: .8, fillOpacity: .68 })
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
        poly.setStyle({ fillColor: ok ? RAMPE[classe(v, br)] : SANS, fillOpacity: ok ? .68 : .35 });
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
  function groupes() {
    var v = coucheVoisine();
    if (v) return v.groupes || [];
    return (kb && kb.groupes) || GROUPES;
  }
  var GROUPES_QUARTIERS = [
    ["Louer", ["loyer_appt", "loyer_appt_m2"]],
    ["Acheter", ["prix_appt_m2", "prix_appt", "prix_maison_m2", "prix_maison"]]
  ];

  function boutons() {
    var k = document.getElementById("ct-choix");
    var quart = couche_nom === "quartiers";
    var dispo = listeIndic();
    var h = "";
    var fronti = estFrontalier();
    // Première rangée, le territoire : les cent communes du pays, la capitale
    // par quartier, et la zone frontalière d'un voisin. Le voisin a été un
    // temps trois boutons de pays sur cette rangée, qui la faisaient lire
    // comme une liste de pays, puis une liste déroulante, qui détonnait au
    // milieu des puces. Il est maintenant une puce comme les autres, et le
    // pays se choisit sur une rangée à lui, qui n'apparaît qu'une fois la
    // frontière franchie : même geste et même forme que la région, en dessous.
    function terr(code, nom, actif) {
      return '<button class="chip' + (actif ? " actif" : "") +
        '" data-couche="' + code + '">' + esc(nom) + "</button>";
    }
    var paysActif = PAYS_COUCHE[couche_nom] ? couche_nom : "";
    h += '<div class="ct-tete"><div class="ct-couches"><span>Territoire</span>' +
      terr("communes", "Luxembourg, les cent communes", couche_nom === "communes") +
      (kb.quartiers ? terr("quartiers", kb.quartiers.titre, couche_nom === "quartiers") : "") +
      terr(paysActif || dernierPays, "Zone frontalière d'un voisin", !!paysActif) + "</div>";
    // Le pays voisin regardé. La rangée ne s'affiche que de l'autre côté de
    // la frontière : trois noms de pays posés là en permanence donneraient à
    // lire une liste de pays avant même qu'on ait demandé à en voir un.
    if (paysActif) {
      h += '<div class="ct-couches"><span>Pays</span>' +
        [["fr", "France"], ["be", "Belgique"], ["de", "Allemagne"]].map(function (x) {
          return '<button class="chip' + (paysActif === x[0] ? " actif" : "") +
            '" data-couche="' + x[0] + '">' + x[1] + "</button>";
        }).join("") + "</div>";
    }
    // Les régions du pays affiché. Une carte de cinq cents communes qu'on ne
    // connaît pas se lit mieux ramenée à un département.
    var v = coucheVoisine();
    if (v && v.regions && v.regions.length > 1) {
      h += '<div class="ct-couches"><span>Région</span>' +
        '<button class="chip' + (regionSel ? "" : " actif") + '" data-region="">Toutes</button>';
      v.regions.forEach(function (r) {
        h += '<button class="chip' + (regionSel === r.code ? " actif" : "") +
          '" data-region="' + r.code + '">' + esc(r.nom) +
          ' <span class="muted">' + r.n + "</span></button>";
      });
      h += "</div>";
    }
    // Seconde rangée, la vue : une carte, deux cartes, ou des communes côte à
    // côte. Trois registres, trois boutons, et un seul actif.
    function vueBtn(code, nom, off) {
      return '<button class="chip' + (mode === code ? " actif" : "") + '" data-vue="' + code + '"' +
        (off ? ' disabled title="' + esc(off) + '"' : "") + ">" + esc(nom) + "</button>";
    }
    h += '<div class="ct-couches"><span>Vue</span>' +
      vueBtn("carte", "Une carte") +
      vueBtn("deux", "Deux cartes côte à côte",
        couche_nom === "communes" ? "" : "Seulement sur les cent communes du Luxembourg") +
      vueBtn("communes", "Comparer des " + motZone(true)) + "</div>";
    // Troisième rangée, ce que l'on pose en plus sur la carte : les écoles et
    // les structures d'accueil. Des interrupteurs et non un choix : chacun
    // s'allume et s'éteint seul. Les fichiers du ministère ne couvrent que le
    // Luxembourg, la rangée disparaît donc de l'autre côté de la frontière.
    var nPoints = ((window.ECOLES || {}).points || []).length;
    if (poiPossible() && nPoints) {
      h += '<div class="ct-couches"><span>Afficher</span>';
      POI.forEach(function (p) {
        h += '<button class="chip' + (poi[p[0]] ? " actif" : "") + '" data-poi="' + p[0] +
          '" aria-pressed="' + (poi[p[0]] ? "true" : "false") + '"><i class="pt" style="border-radius:50%;background:' +
          p[2] + '"></i>' + esc(p[1]) + "</button>";
      });
      h += "</div>";
      // Le fond : la carte claire, la photo aérienne, le plan cadastral. Un
      // choix et non des interrupteurs, on ne regarde qu'un fond à la fois.
      h += '<div class="ct-couches"><span>Fond</span>' +
        '<button class="chip' + (fond === "clair" ? " actif" : "") + '" data-fond="clair">Carte claire</button>';
      Object.keys(FONDS).forEach(function (f) {
        h += '<button class="chip' + (fond === f ? " actif" : "") + '" data-fond="' + f + '">' +
          esc(FONDS[f].nom) + "</button>";
      });
      h += "</div>";
      var notes = [];
      if (poi.ef) notes.push("Une école entourée d'un anneau vert a, sur le même site, une structure qui " +
        "accueille les enfants avant et après la classe.");
      if (poi.ef || poi.mr || poi.cr || poi.ly) notes.push("Cliquer un point mène au site : la surface " +
        "colorée est son emprise, d'après OpenStreetMap. Adresses du ministère de l'Éducation nationale, " +
        "situation 2021, dernière version publiée.");
      if (fond === "cadastre") notes.push("Le plan cadastral apparaît en zoomant sur une commune, à partir " +
        "de l'échelle du quartier. Les bâtiments publics y sont en bleu.");
      if (fond !== "clair") notes.push("Sur ce fond, les couleurs de l'indicateur deviennent presque " +
        "transparentes pour laisser voir le terrain.");
      if (notes.length) h += '<p class="hint" style="margin:8px 0 0">' + notes.join(" ") + "</p>";
    }
    h += "</div>";

    if (mode === "communes") {
      // Pas d'indicateur à choisir ici : le tableau les montre tous. À la
      // place, le panier des communes retenues.
      var liste = communesComparees();
      h += '<div class="ct-panier">' +
        (liste.length ? "" : '<span class="muted">Jusqu\'à dix ' + motZone(true) +
          " : cliquez-les sur la carte, ou prenez-les dans la liste à droite.</span>") +
        puces(liste, true) + selectAjout(liste) + "</div>";
      // La capitale se compare aussi quartier par quartier, et personne ne
      // pense a changer de territoire pour cela : la rangee du dessus le dit.
      if (couche_nom === "communes" && kb.quartiers) {
        h += '<p class="hint" style="margin-top:10px">Luxembourg-Ville se compare aussi ' +
          "quartier par quartier, Cessange contre Merl ou Belair : prenez « " +
          esc(kb.quartiers.titre) + " » dans la rangée Territoire, ci-dessus.</p>";
      }
      k.innerHTML = h;
      brancherPanier(k);
      brancherCouches(k);
      return;
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
    var natFam = !quart && !fronti && nations().length;
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
      if (natSel.length < MAX_NAT) {
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
    brancherCouches(k);
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
  }

  // Les rangées de l'en-tête, territoire, région et vue, se branchent de la
  // même façon quelle que soit la vue affichée.
  // Le dernier voisin regardé, pour que la puce « Zone frontalière » y
  // revienne. La France par défaut : c'est de là que viennent la moitié des
  // frontaliers, et il faut bien ouvrir sur un pays.
  var dernierPays = "fr";

  function brancherCouches(k) {
    k.querySelectorAll("button[data-couche]").forEach(function (b) {
      b.addEventListener("click", function () { changerCouche(b.dataset.couche); });
    });

    k.querySelectorAll("button[data-region]").forEach(function (b) {
      b.addEventListener("click", function () {
        regionSel = b.dataset.region || null;
        // Les formes affichées changent : on redessine la couche entière.
        redessinerCouche();
      });
    });
    k.querySelectorAll("button[data-vue]").forEach(function (b) {
      b.addEventListener("click", function () { changerMode(b.dataset.vue); });
    });
    k.querySelectorAll("button[data-poi]").forEach(function (b) {
      b.addEventListener("click", function () {
        poi[b.dataset.poi] = !poi[b.dataset.poi];
        boutons();
        dessinerPoi();
      });
    });
    k.querySelectorAll("button[data-fond]").forEach(function (b) {
      b.addEventListener("click", function () {
        fond = b.dataset.fond;
        boutons();
        appliquerFond();
      });
    });
  }

  // Reconstruit les polygones de la couche courante. Sert au changement de
  // couche comme au filtrage par région : dans les deux cas, l'ensemble des
  // zones à dessiner change.
  function redessinerCouche() {
    selection = null;
    panierCommunes = [];
    poserFormes();
    boutons();
    dessiner();
    fiche();
  }

  function retenirPays(nom) {
    if (PAYS_COUCHE[nom]) dernierPays = nom;
  }

  function changerCouche(nom) {
    if (nom === couche_nom) return;
    // La base des voisins n'est chargée qu'à la première visite de l'autre côté.
    if (PAYS_COUCHE[nom] && !front) {
      msg("Chargement des communes frontalières…");
      charger(KB_FRONT, "js", function () {
        front = window.FRONTALIERS;
        if (front) changerCouche(nom);
      });
      return;
    }
    // Comparer deux cartes n'a de sens que sur les cent communes : la seconde
    // carte ne connaît que celles-là. Comparer des communes vaut partout.
    if (mode === "deux" && nom !== "communes") { mode = "carte"; comparer = false; }
    couche_nom = nom;
    retenirPays(nom);
    selection = null;
    panierCommunes = [];
    famille = null;
    regionSel = null;
    // Garder l'indicateur courant s'il existe aussi dans l'autre niveau, sinon
    // prendre le premier proposé : passer de « salaire médian » aux quartiers,
    // qui n'ont pas de salaires, ne doit pas vider la carte.
    var dispo = listeIndic();
    // Les nationalités ne sont publiées que pour les communes luxembourgeoises.
    if (nom !== "communes") { nation = null; indNation = null; natSel = []; }
    if (!dispo.some(function (i) { return i.id === courant; })) courant = dispo[0].id;
    poserFormes();
    // Les quartiers n'ont pas de séries : la barre du temps se retire d'elle-même.
    arreterLecture();
    annee = null;
    filtreTxt = "";
    appliquerMode();
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

    poserFond(map, true);

    couche = L.layerGroup().addTo(map);
    cadreTotal = null;
    poserFormes();
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
      majSource();
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
