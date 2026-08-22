// Interface : navigation, fiches, parcours, simulateur, assistant, administration.
(function () {
  "use strict";

  var STORAGE_KB = "luxguide.kb.v1";
  var STORAGE_PARAMS = "luxguide.params.v1";
  var KB_ORIGINE = JSON.parse(JSON.stringify(window.KB));

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function eur(n, dec) {
    return Number(n).toLocaleString("fr-FR", {
      minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0
    }) + " EUR";
  }
  function pct(n) { return (n * 100).toFixed(1).replace(".", ",") + " %"; }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }

  // ---------- Persistance ----------

  function chargerKB() {
    try {
      var brut = localStorage.getItem(STORAGE_KB);
      if (brut) {
        var kb = JSON.parse(brut);
        if (kb && kb.fiches && kb.fiches.length) window.KB = kb;
      }
    } catch (e) { /* stockage indisponible : on garde la version d'origine */ }
    try {
      var p = localStorage.getItem(STORAGE_PARAMS);
      if (p) window.SIM.setParams(JSON.parse(p));
    } catch (e) { /* idem */ }
  }

  function sauverKB() {
    try { localStorage.setItem(STORAGE_KB, JSON.stringify(window.KB)); return true; }
    catch (e) { return false; }
  }

  // ---------- Theme ----------
  // Trois etats : systeme (defaut), clair, sombre. Le choix est conserve.

  var STORAGE_THEME = "luxguide.theme.v1";
  var THEMES = ["systeme", "clair", "sombre"];
  var LIBELLE_THEME = { systeme: "Thème du système", clair: "Thème clair", sombre: "Thème sombre" };
  var ICONE_THEME = { systeme: "◐", clair: "☀", sombre: "☾" };

  function appliquerTheme(t) {
    var r = document.documentElement;
    if (t === "clair") r.setAttribute("data-theme", "light");
    else if (t === "sombre") r.setAttribute("data-theme", "dark");
    else r.removeAttribute("data-theme");
    var b = $("#theme-btn");
    if (b) {
      b.textContent = ICONE_THEME[t];
      b.title = LIBELLE_THEME[t] + " (cliquer pour changer)";
      b.setAttribute("aria-label", LIBELLE_THEME[t]);
    }
  }

  function initTheme() {
    var t = "systeme";
    try {
      var v = localStorage.getItem(STORAGE_THEME);
      if (THEMES.indexOf(v) !== -1) t = v;
    } catch (e) { /* stockage indisponible */ }
    appliquerTheme(t);
    var b = $("#theme-btn");
    if (!b) return;
    b.addEventListener("click", function () {
      t = THEMES[(THEMES.indexOf(t) + 1) % THEMES.length];
      appliquerTheme(t);
      try { localStorage.setItem(STORAGE_THEME, t); } catch (e) {}
    });
  }

  // ---------- Navigation ----------

  function initOnglets() {
    $$("#tabs button").forEach(function (b) {
      b.addEventListener("click", function () { ouvrir(b.dataset.panel); });
    });
    // Boutons d'appel a l'action de la page d'accueil
    $$("[data-go]").forEach(function (b) {
      b.addEventListener("click", function () { ouvrir(b.dataset.go); });
    });
  }

  var PANNEAUX = ["accueil", "fiches", "parcours", "faq", "simulateur", "comparateur", "carte", "assistant", "admin"];

  function ouvrir(nom, sansHash) {
    if (PANNEAUX.indexOf(nom) === -1) nom = "accueil";
    if (nom === "carte") {
      initCarte();
      // La carte a pu etre creee dans un panneau cache : recaler sa taille
      if (carteObj) setTimeout(function () { carteObj.invalidateSize(); }, 60);
    }
    $$("#tabs button").forEach(function (b) {
      b.setAttribute("aria-selected", String(b.dataset.panel === nom));
    });
    $$(".panel").forEach(function (p) { p.hidden = p.id !== "panel-" + nom; });
    // L'onglet Fiches revient toujours a la liste (une fiche ouverte la masquait,
    // barre de recherche comprise). montrerFiche, appele ensuite le cas echeant,
    // rouvre le detail par-dessus.
    if (nom === "fiches") {
      var qf = $("#q-fiches") ? $("#q-fiches").value.trim() : "";
      if (qf) {
        rendreFiches(window.CHAT.rechercher(qf, 50).map(function (h) { return h.fiche; }));
      } else {
        rendreFiches();
      }
    }
    if (!sansHash && window.location.hash !== "#" + nom) {
      // pushState et non replaceState : chaque vue devient une entree
      // d'historique, le bouton retour du navigateur fonctionne.
      try { history.pushState(null, "", "#" + nom); } catch (e) { /* file:// */ }
    }
    window.scrollTo(0, 0);
  }

  // Ouverture directe par ancre.
  //   #simulateur        ouvre un onglet
  //   #fiche/bail        ouvre directement une fiche, lien partageable
  function ouvrirDepuisHash() {
    var h = (window.location.hash || "").replace("#", "");
    if (!h) { ouvrir("accueil", true); return; }
    if (h.indexOf("fiche/") === 0) {
      var id = h.slice(6);
      ouvrir("fiches", true);
      montrerFiche(id, true);
      return;
    }
    ouvrir(h, true);
  }

  // Revele les elements au defilement.
  function activerApparition(racine) {
    var cibles = $$(".reveal:not(.vu)", racine || document);
    if (!("IntersectionObserver" in window)) {
      cibles.forEach(function (e) { e.classList.add("vu"); });
      return;
    }
    var obs = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (e, i) {
        if (!e.isIntersecting) return;
        var d = Math.min(i * 55, 300);
        setTimeout(function () { e.target.classList.add("vu"); }, d);
        obs.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: .08 });
    cibles.forEach(function (e) { obs.observe(e); });
  }

  // ---------- Visuels ----------

  // Un visuel par categorie. Les photos sont dans assets/, sous licence libre.
  var VISUELS = {
    "Administratif": "assets/administratif.jpg",
    "Logement": "assets/logement.jpg",
    "Impots": "assets/finances.jpg",
    "Finances": "assets/travail.jpg",
    "Travail": "assets/travail.jpg",
    "Famille": "assets/famille.jpg",
    "Sante": "assets/nature.jpg",
    "Mobilite": "assets/mobilite.jpg",
    "Quotidien": "assets/quotidien.jpg"
  };
  function visuel(cat) { return VISUELS[cat] || "assets/hero.jpg"; }

  function tuile(cat, titre, texte, compte, onClick) {
    var t = el("div", "tuile reveal");
    var v = el("div", "visuel");
    var img = el("img");
    img.src = visuel(cat); img.alt = ""; img.loading = "lazy";
    v.appendChild(img);
    v.appendChild(el("span", "etiquette", cat));
    t.appendChild(v);
    var c = el("div", "corps");
    c.appendChild(el("h3", null, titre));
    c.appendChild(el("p", null, texte));
    if (compte) c.appendChild(el("div", "compte", compte));
    t.appendChild(c);
    t.addEventListener("click", onClick);
    return t;
  }

  // ---------- Accueil ----------

  function rendreAccueil() {
    var cats = {};
    window.KB.fiches.forEach(function (f) { (cats[f.cat] = cats[f.cat] || []).push(f); });

    var stat = $("#stat-fiches");
    if (stat) stat.textContent = window.KB.fiches.length;

    var g = $("#accueil-cats");
    g.innerHTML = "";
    Object.keys(cats).forEach(function (c) {
      var liste = cats[c];
      g.appendChild(tuile(
        c,
        liste[0].titre,
        liste.map(function (f) { return f.titre; }).slice(1).join(" · ") || liste[0].resume,
        liste.length + (liste.length > 1 ? " fiches" : " fiche"),
        function () { ouvrir("fiches"); $("#q-fiches").value = ""; rendreFiches(liste); }
      ));
    });

    var fq = $("#accueil-faq");
    fq.innerHTML = "";
    window.KB.faq.slice(0, 7).forEach(function (item) {
      var card = el("div", "qcard reveal");
      card.appendChild(el("h3", null, item.q));
      card.appendChild(el("p", null, item.a.slice(0, 125) + (item.a.length > 125 ? "..." : "")));
      card.addEventListener("click", function () { ouvrir("fiches"); montrerFiche(item.fiche); });
      fq.appendChild(card);
    });
    var toutes = el("div", "qcard reveal");
    toutes.appendChild(el("h3", null, "Toutes les questions →"));
    toutes.appendChild(el("p", null,
      "La FAQ complète : " + window.KB.faq.length + " questions vérifiées, filtrables, avec l'assistant en renfort."));
    toutes.addEventListener("click", function () { ouvrir("faq"); });
    fq.appendChild(toutes);

    rendreCredits();
    activerApparition();
  }

  function rendreCredits() {
    var c = $("#credits-photos");
    if (!c) return;
    c.innerHTML = "";
    c.appendChild(document.createTextNode(
      "Photographies : Luxembourg, sous licence Creative Commons via Wikimedia Commons. " +
      "Auteurs : Cayambe, GilPe, Krzysztof Golik, Dietmar Rabich. Détail des licences dans assets/CREDITS.json."
    ));
  }

  // ---------- Fiches ----------

  var voirToutesFiches = false;

  function rendreFiches(liste) {
    var g = $("#fiches-grid");
    g.innerHTML = "";
    var perso = $("#fiches-perso");
    if (perso) perso.innerHTML = "";

    var effective = liste;
    // Sans recherche en cours : si le profil est connu, ne montrer par defaut
    // que les fiches qui concernent ce profil, avec l'interrupteur pour tout voir.
    if (!liste && profilRenseigne() && perso) {
      var filtrer = !voirToutesFiches;
      if (filtrer) effective = window.CHAT.fichesPourProfil(profil);
      var bandeau = el("div", "notice small");
      bandeau.appendChild(document.createTextNode(
        (filtrer ? "Fiches adaptées à votre profil : " : "Toutes les fiches. Votre profil : ") +
        window.CHAT.decrireProfil(profil) + ". "));
      var b = el("button", "chip", filtrer ? "Voir toutes les fiches" : "Ne voir que mes fiches");
      b.addEventListener("click", function () { voirToutesFiches = !voirToutesFiches; rendreFiches(); });
      bandeau.appendChild(b);
      perso.appendChild(bandeau);
    }

    (effective || window.KB.fiches).forEach(function (f) {
      g.appendChild(tuile(f.cat, f.titre, f.resume, null, function () { montrerFiche(f.id); }));
    });
    if (!g.children.length) g.appendChild(el("p", "muted", "Aucune fiche ne correspond à cette recherche."));
    activerApparition(g);
    $("#fiches-liste").hidden = false;
    $("#fiche-detail").hidden = true;
  }

  function montrerFiche(id, sansHash) {
    var f = window.KB.fiches.filter(function (x) { return x.id === id; })[0];
    if (!f) { rendreFiches(); return; }
    if (!sansHash && window.location.hash !== "#fiche/" + id) {
      try { history.pushState(null, "", "#fiche/" + id); } catch (e) { /* file:// */ }
    }
    var d = $("#fiche-detail");
    d.innerHTML = "";

    // Bandeau illustre
    var hero = el("div", "detail-hero");
    var himg = el("img");
    himg.src = visuel(f.cat); himg.alt = "";
    hero.appendChild(himg);
    var ht = el("div", "titre");
    ht.appendChild(el("div", "cat", f.cat));
    ht.appendChild(el("h1", null, f.titre));
    hero.appendChild(ht);
    d.appendChild(hero);

    var back = el("button", "back", "← Toutes les fiches");
    back.addEventListener("click", function () {
      try { history.pushState(null, "", "#fiches"); } catch (e) {}
      rendreFiches();
    });
    d.appendChild(back);

    // Corps de l'article, sur deux colonnes
    var corps = el("div", "detail-corps");
    var texte = el("div", "detail-texte");
    corps.appendChild(texte);
    d.appendChild(corps);

    var chapo = el("p", "chapo", f.resume);
    texte.appendChild(chapo);

    // Un element de corps est soit un paragraphe, soit { h: "Sous-titre" }
    (f.corps || []).forEach(function (p) {
      if (p && typeof p === "object" && p.h) { texte.appendChild(el("h2", null, p.h)); return; }
      texte.appendChild(el("p", null, String(p)));
    });

    (f.tableaux || []).forEach(function (t) {
      texte.appendChild(el("h3", null, t.titre));
      var wrap = el("div", "table-wrap"), tab = el("table");
      var thead = el("thead"), trh = el("tr");
      t.colonnes.forEach(function (c, i) {
        var th = el("th", i > 0 ? "num" : null, c); trh.appendChild(th);
      });
      thead.appendChild(trh); tab.appendChild(thead);
      var tb = el("tbody");
      t.lignes.forEach(function (l) {
        var tr = el("tr");
        l.forEach(function (c, i) { tr.appendChild(el("td", i > 0 ? "num" : null, c)); });
        tb.appendChild(tr);
      });
      tab.appendChild(tb); wrap.appendChild(tab); texte.appendChild(wrap);
    });

    // Colonne laterale : points cles, sources, fiches voisines
    var cote = el("div", "detail-cote");

    if (f.aRetenir && f.aRetenir.length) {
      var bc = el("div", "bloc cle");
      bc.appendChild(el("h4", null, "A retenir"));
      var ulc = el("ul");
      f.aRetenir.forEach(function (x) { ulc.appendChild(el("li", null, x)); });
      bc.appendChild(ulc); cote.appendChild(bc);
    }

    if (f.sources && f.sources.length) {
      var bs = el("div", "bloc");
      bs.appendChild(el("h4", null, "Sources officielles"));
      f.sources.forEach(function (src) {
        var a = el("a", null, src.t);
        a.href = src.u; a.target = "_blank"; a.rel = "noopener";
        bs.appendChild(a);
      });
      cote.appendChild(bs);
    }

    var voisines = window.KB.fiches.filter(function (x) { return x.cat === f.cat && x.id !== f.id; }).slice(0, 4);
    if (voisines.length) {
      var bv = el("div", "bloc");
      bv.appendChild(el("h4", null, "Dans la meme rubrique"));
      voisines.forEach(function (v) {
        var b = el("button", "lien-fiche", v.titre);
        b.addEventListener("click", function () { montrerFiche(v.id); });
        bv.appendChild(b);
      });
      cote.appendChild(bv);
    }

    corps.appendChild(cote);

    $("#fiches-liste").hidden = true;
    d.hidden = false;
    window.scrollTo(0, 0);
  }

  // Une seule regle de recherche pour tout le site :
  //   1. la frappe donne des resultats instantanes, fiches et questions de la FAQ ;
  //   2. l'assistant est l'etage au-dessus, propose de la meme facon depuis
  //      chaque barre : un bouton, et la touche Entree.
  // Toute barre du site passe par ces deux fonctions.

  function boutonAssistant(q, libelle) {
    var c = el("div", "chips");
    var b = el("button", "chip", libelle || "Poser la question à l'assistant");
    b.addEventListener("click", function () { demanderAssistant(q); });
    c.appendChild(b);
    return c;
  }

  function demanderAssistant(q) {
    montrerWidget();
    if (q && q.trim().length >= 2) envoyer(q.trim());
  }

  // Questions de la FAQ correspondant a une saisie, les mieux notees d'abord.
  function chercherFaqListe(q, limite) {
    var termes = normaliserFaq(q).split(" ").filter(function (t) { return t.length > 2; });
    if (!termes.length) return [];
    return window.KB.faq.map(function (item) {
      var hayQ = normaliserFaq(item.q), hayA = normaliserFaq(item.a);
      var s = 0;
      termes.forEach(function (t) {
        if (hayQ.indexOf(t) !== -1) s += 3;
        else if (hayA.indexOf(t) !== -1) s += 1;
      });
      return { item: item, score: s };
    }).filter(function (x) { return x.score >= 3; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, limite || 3)
      .map(function (x) { return x.item; });
  }

  function chipsFaq(liste, classe) {
    var c = el("div", "chips " + (classe || ""));
    liste.forEach(function (item) {
      var lbl = item.q.length > 62 ? item.q.slice(0, 60).trim() + "…" : item.q;
      var b = el("button", "chip", "Question : " + lbl);
      b.title = item.q;
      b.addEventListener("click", function () { demanderAssistant(item.q); });
      c.appendChild(b);
    });
    return c;
  }

  function initRecherche() {
    // Barre des fiches : filtre la liste, et propose l'assistant quand la
    // recherche par mots ne rend rien.
    var qf = $("#q-fiches");
    qf.addEventListener("input", function (e) {
      var q = e.target.value.trim();
      if (!q) return rendreFiches();
      var hits = window.CHAT.rechercher(q, 50);
      rendreFiches(hits.map(function (h) { return h.fiche; }));
      if (!hits.length) {
        var g = $("#fiches-grid");
        g.appendChild(boutonAssistant(q, "Poser cette question à l'assistant"));
      }
    });
    qf.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && qf.value.trim().length >= 2 &&
          !window.CHAT.rechercher(qf.value.trim(), 1).length) {
        demanderAssistant(qf.value.trim());
      }
    });

    // Barre de l'accueil : fiches et questions de la FAQ, puis l'assistant.
    var qa = $("#q-accueil");
    if (qa) qa.addEventListener("input", function (e) {
      var q = e.target.value.trim();
      var g = $("#accueil-resultats");
      g.innerHTML = "";
      if (q.length < 2) return;

      var hits = window.CHAT.rechercher(q, 6);
      var qfaq = chercherFaqListe(q, 3);

      if (!hits.length && !qfaq.length) {
        g.appendChild(el("p", "muted",
          "Aucune fiche ni question enregistrée ne correspond à ces mots. " +
          "L'assistant peut chercher autrement, ou dire qu'il ne sait pas."));
        g.appendChild(boutonAssistant(q));
        return;
      }
      hits.forEach(function (h) {
        var f = h.fiche;
        g.appendChild(tuile(f.cat, f.titre, f.resume, null, function () {
          ouvrir("fiches");
          montrerFiche(f.id);
        }));
      });
      if (qfaq.length) g.appendChild(chipsFaq(qfaq, "ask-faq"));
      // Une vraie question (phrase, point d'interrogation) merite mieux qu'une
      // liste de fiches : proposer aussi l'assistant.
      if (/\?/.test(q) || q.split(/\s+/).length >= 4) {
        g.appendChild(boutonAssistant(q, "Poser cette question à l'assistant"));
      }
      activerApparition(g);
    });
    qa.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var q = qa.value.trim();
      if (q.length < 2) return;
      // Entree = je veux une reponse : l'assistant prend la main.
      demanderAssistant(q);
      qa.value = "";
      $("#accueil-resultats").innerHTML = "";
    });

    // Bouton Demander : meme comportement que la touche Entree.
    var qb = $("#q-accueil-btn");
    if (qb) qb.addEventListener("click", function () {
      var q = qa.value.trim();
      demanderAssistant(q);
      if (q.length >= 2) {
        qa.value = "";
        $("#accueil-resultats").innerHTML = "";
      }
    });

    // Questions rapides sous la barre, issues des questions frequentes du guide
    var ac = $("#ask-chips");
    if (ac) window.KB.faq.slice(0, 4).forEach(function (item) {
      var lbl = item.q.length > 46 ? item.q.slice(0, 44).trim() + "…" : item.q;
      var b = el("button", "chip", lbl);
      b.title = item.q;
      b.addEventListener("click", function () { demanderAssistant(item.q); });
      ac.appendChild(b);
    });
  }

  // ---------- FAQ ----------
  // Recense toutes les questions-reponses de la base, groupees par theme.
  // Tout est affiche ; le filtre reduit la liste, et l'assistant prend le
  // relais quand la question n'y figure pas.

  function normaliserFaq(s) {
    return String(s || "").toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  }

  function rendreFaq(filtre) {
    var liste = $("#faq-liste");
    if (!liste) return;
    liste.innerHTML = "";

    var termes = normaliserFaq(filtre || "").split(" ").filter(function (t) { return t.length > 1; });
    var visibles = window.KB.faq.filter(function (item) {
      if (!termes.length) return true;
      var hay = normaliserFaq(item.q + " " + item.a);
      return termes.every(function (t) { return hay.indexOf(t) !== -1; });
    });

    var compte = $("#faq-compte");
    if (compte) {
      compte.textContent = termes.length
        ? visibles.length + " / " + window.KB.faq.length + " questions"
        : window.KB.faq.length + " questions";
    }

    if (!visibles.length) {
      liste.appendChild(el("p", "muted",
        "Aucune question enregistrée ne correspond. L'assistant peut chercher dans le corps des fiches."));
      liste.appendChild(boutonAssistant(filtre, "Poser cette question à l'assistant"));
      // Fiches qui parlent quand meme du sujet : la recherche ne rend jamais rien de vide.
      var hits = window.CHAT.rechercher(filtre, 4);
      if (hits.length) {
        liste.appendChild(el("p", "muted", "Fiches qui traitent de ce sujet :"));
        var cf = el("div", "chips");
        hits.forEach(function (h) {
          var b2 = el("button", "chip", h.fiche.titre);
          b2.addEventListener("click", function () { ouvrir("fiches"); montrerFiche(h.fiche.id); });
          cf.appendChild(b2);
        });
        liste.appendChild(cf);
      }
      return;
    }

    // Groupement par theme, via la categorie de la fiche liee
    var groupes = {}, ordre = [];
    visibles.forEach(function (item) {
      var f = window.KB.fiches.filter(function (x) { return x.id === item.fiche; })[0];
      var cat = f ? f.cat : "Divers";
      if (!groupes[cat]) { groupes[cat] = []; ordre.push(cat); }
      groupes[cat].push({ item: item, fiche: f });
    });

    ordre.forEach(function (cat) {
      liste.appendChild(el("h2", "faq-groupe", cat));
      groupes[cat].forEach(function (x) {
        var d = el("details", "faq-item");
        d.appendChild(el("summary", null, x.item.q));
        var corps = el("div", "faq-corps");
        corps.appendChild(el("p", null, x.item.a));
        if (x.fiche) {
          var c = el("div", "chips");
          var b = el("button", "chip", "Voir la fiche : " + x.fiche.titre);
          b.addEventListener("click", function () { ouvrir("fiches"); montrerFiche(x.fiche.id); });
          c.appendChild(b);
          corps.appendChild(c);
          if (x.fiche.sources && x.fiche.sources.length) {
            var s = el("p", "faq-sources");
            s.appendChild(document.createTextNode("Sources : "));
            x.fiche.sources.forEach(function (src, i) {
              if (i) s.appendChild(document.createTextNode(" · "));
              var a = el("a", null, src.t);
              a.href = src.u; a.target = "_blank"; a.rel = "noopener";
              s.appendChild(a);
            });
            corps.appendChild(s);
          }
        }
        d.appendChild(corps);
        liste.appendChild(d);
      });
    });
  }

  function initFaq() {
    if (!$("#faq-liste")) return;
    rendreFaq();
    var qf = $("#q-faq");
    qf.addEventListener("input", function (e) {
      rendreFaq(e.target.value.trim());
    });
    // Meme regle que les autres barres : Entree passe la main a l'assistant.
    qf.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && qf.value.trim().length >= 2) demanderAssistant(qf.value.trim());
    });
    $("#faq-assistant").addEventListener("click", function () {
      demanderAssistant(qf.value.trim());
    });
  }

  // ---------- Parcours ----------

  var STORAGE_PARCOURS = "luxguide.parcours.v1";
  var voirToutParcours = false;

  function chargerCoches() {
    try { return JSON.parse(localStorage.getItem(STORAGE_PARCOURS) || "{}"); }
    catch (e) { return {}; }
  }
  function sauverCoches(c) {
    try { localStorage.setItem(STORAGE_PARCOURS, JSON.stringify(c)); } catch (e) {}
  }

  function profilRenseigne() {
    return profil && Object.keys(profil).length > 0;
  }

  // Une etape est gardee si le profil ne la contredit pas. Champ inconnu = on garde.
  function etapeConcerne(item, p) {
    if (!item || typeof item === "string" || !item.si) return true;
    var si = item.si;
    var ok = true;
    Object.keys(si).forEach(function (k) {
      var v = p[k];
      if (v === undefined) return;
      if (k === "enfants") { if (v === "Aucun") ok = false; }
      else if (k === "vehicule") { if (v !== "Oui") ok = false; }
      else if (k === "logement") {
        if (v !== si.logement && v !== "Pas encore decide") ok = false;
      }
      else if (k === "statut") {
        if (v !== si.statut && v !== "Les deux") ok = false;
      }
      else if (v !== si[k]) ok = false;
    });
    return ok;
  }

  function rendreTimeline() {
    var t = $("#timeline");
    t.innerHTML = "";
    var connu = profilRenseigne();
    var coches = chargerCoches();
    var filtrer = connu && !voirToutParcours;

    var bandeau = el("div", "notice small tl-bandeau");
    if (!connu) {
      bandeau.appendChild(document.createTextNode(
        "Parcours complet. Cochez les étapes faites : votre avancement est enregistré dans ce navigateur. " +
        "En vous enregistrant (six questions, une minute), le parcours ne montre plus que ce qui vous concerne."));
      var cta = el("div", "tl-cta");
      var b = el("button", "btn", "S'enregistrer et personnaliser mon parcours");
      b.addEventListener("click", function () { montrerWidget(); });
      cta.appendChild(b);
      bandeau.appendChild(cta);
    } else {
      bandeau.appendChild(document.createTextNode(
        (filtrer ? "Parcours adapté à votre profil : " : "Parcours complet. Votre profil : ") +
        window.CHAT.decrireProfil(profil) + ". Votre avancement est enregistré dans ce navigateur. "));
      var b2 = el("button", "chip", filtrer ? "Voir toutes les étapes" : "Ne voir que mes étapes");
      b2.addEventListener("click", function () { voirToutParcours = !voirToutParcours; rendreTimeline(); });
      bandeau.appendChild(b2);
    }
    t.appendChild(bandeau);

    window.KB.timeline.forEach(function (p, pi) {
      var visibles = [];
      p.items.forEach(function (item, ii) {
        if (!filtrer || etapeConcerne(item, profil)) visibles.push({ item: item, cle: pi + ":" + ii });
      });
      if (!visibles.length) return;

      var step = el("div", "step");
      var faits = visibles.filter(function (x) { return coches[x.cle]; }).length;
      var h = el("h3", null, p.phase + " ");
      h.appendChild(el("span", "tl-compte", faits + "/" + visibles.length));
      step.appendChild(h);

      var ul = el("ul", "tl-items");
      visibles.forEach(function (x) {
        var item = x.item;
        var texte = typeof item === "string" ? item : item.t;
        var li = el("li", "tl-item" + (coches[x.cle] ? " fait" : ""));
        var cb = el("input");
        cb.type = "checkbox";
        cb.checked = !!coches[x.cle];
        cb.setAttribute("aria-label", "Étape faite : " + texte);
        cb.addEventListener("change", function () {
          var c = chargerCoches();
          if (cb.checked) c[x.cle] = 1; else delete c[x.cle];
          sauverCoches(c);
          rendreTimeline();
        });
        li.appendChild(cb);
        if (item && item.fiche) {
          var lien = el("button", "tl-lien", texte);
          lien.addEventListener("click", function () { ouvrir("fiches"); montrerFiche(item.fiche); });
          li.appendChild(lien);
        } else {
          li.appendChild(el("span", null, texte));
        }
        ul.appendChild(li);
      });
      step.appendChild(ul);
      t.appendChild(step);
    });
  }

  // ---------- Simulateur ----------

  function majSimulateur() {
    var brut = Number($("#s-brut").value) || 0;
    var mois = Number($("#s-mois").value) || 12;
    var r = window.SIM.calcul({
      brut: brut,
      classe: $("#s-classe").value,
      mois: mois,
      impatrie: $("#s-impatrie").checked,
      forfaits: $("#s-forfaits").checked
    });

    var k = $("#s-kpis");
    k.innerHTML = "";
    [["Net mensuel estimé", eur(r.netMensuel), true],
     ["Net annuel", eur(r.netAnnuel), false],
     ["Impôt total", eur(r.impotTotal), false],
     ["Cotisations", eur(r.cotisations + r.dependance), false],
     ["Prélèvement global", pct(r.tauxPrelevementGlobal), false]
    ].forEach(function (x) {
      var d = el("div", "kpi" + (x[2] ? " hl" : ""));
      d.appendChild(el("div", "k", x[0]));
      d.appendChild(el("div", "v", x[1]));
      k.appendChild(d);
    });

    var det = $("#s-detail");
    det.innerHTML = "";
    var wrap = el("div", "table-wrap"), tab = el("table");
    var lignes = [
      ["Brut annuel", eur(r.brut)],
      ["Cotisations sociales (" + pct(r.tauxCotisations) + ", plafonnées)", "- " + eur(r.cotisations)],
      ["Contribution dépendance", "- " + eur(r.dependance)],
      ["Net avant impôt", eur(r.netAvantImpot)]
    ];
    if (r.exoneration > 0) lignes.push(["Exonération impatriés", "- " + eur(r.exoneration)]);
    lignes.push(["Revenu imposable retenu", eur(r.imposable)]);
    lignes.push(["Impôt sur le revenu", "- " + eur(r.impot)]);
    lignes.push(["Fonds pour l'emploi (" + pct(r.tauxFondsEmploi) + ")", "- " + eur(r.fondsEmploi)]);
    lignes.push(["Net annuel", eur(r.netAnnuel)]);
    lignes.push(["Net sur " + r.mois + " mois", eur(r.netMensuel)]);
    var tb = el("tbody");
    lignes.forEach(function (l) {
      var tr = el("tr");
      tr.appendChild(el("td", null, l[0]));
      tr.appendChild(el("td", "num", l[1]));
      tb.appendChild(tr);
    });
    tab.appendChild(tb); wrap.appendChild(tab); det.appendChild(wrap);

    // Repartition visuelle du brut
    if (r.brut > 0) {
      var rep = el("div", "repartition");
      var b = el("div", "barre");
      var pNet = r.netAnnuel / r.brut, pImp = r.impotTotal / r.brut;
      var pCot = Math.max(0, 1 - pNet - pImp);
      var sNet = el("span", "net"); sNet.style.width = (pNet * 100) + "%";
      var sImp = el("span", "impot"); sImp.style.width = (pImp * 100) + "%";
      var sCot = el("span", "cotis"); sCot.style.width = (pCot * 100) + "%";
      b.appendChild(sNet); b.appendChild(sImp); b.appendChild(sCot);
      rep.appendChild(b);
      var lg = el("div", "legende");
      [["net", "Net perçu", pNet], ["impot", "Impôts", pImp], ["cotis", "Cotisations", pCot]]
        .forEach(function (x) {
          var sp = el("span");
          var i = el("i"); i.className = "";
          i.style.background = x[0] === "net" ? "linear-gradient(90deg, var(--accent), var(--accent-2))"
            : (x[0] === "impot" ? "var(--accent-3)" : "var(--border-fort)");
          sp.appendChild(i);
          sp.appendChild(document.createTextNode(x[1] + " " + pct(x[2])));
          lg.appendChild(sp);
        });
      rep.appendChild(lg);
      det.appendChild(rep);
    }
    // Menage a deux salaires : retenue mensuelle contre regularisation annuelle
    var zoneM = $("#s-menage");
    if (zoneM) {
      zoneM.innerHTML = "";
      var brut2 = Number($("#s-brut2") ? $("#s-brut2").value : 0) || 0;
      if (brut2 > 0 && brut > 0) {
        var m = window.SIM.menage({
          brut1: brut, brut2: brut2,
          classe: $("#s-classe").value, mois: mois,
          impatrie1: $("#s-impatrie").checked,
          forfaits: $("#s-forfaits").checked
        });

        zoneM.appendChild(el("h2", null, "Le ménage, avec deux salaires"));

        var intro = el("p", "lead small");
        intro.textContent = "Aucun employeur ne connaît le salaire du conjoint. Le plus élevé des deux "
          + "porte la fiche principale et subit le barème ; le second est retenu à un taux fixe de "
          + pct(m.tauxFixeSecondaire) + ", qui ne dépend que de la classe d'impôt. La déclaration "
          + "annuelle commune régularise ensuite l'écart.";
        zoneM.appendChild(intro);

        var km = el("div", "kpis");
        [["Net mensuel retenu", eur(m.netMensuelRetenue), true],
         ["Net mensuel réel", eur(m.netMensuelReel), false],
         [m.solde >= 0 ? "Solde à payer" : "Remboursement attendu", eur(Math.abs(m.solde)), false],
         ["Brut du ménage", eur(m.brutMenage), false]
        ].forEach(function (x) {
          var d = el("div", "kpi" + (x[2] ? " hl" : ""));
          d.appendChild(el("div", "k", x[0]));
          d.appendChild(el("div", "v", x[1]));
          km.appendChild(d);
        });
        zoneM.appendChild(km);

        var wrapM = el("div", "table-wrap"), tabM = el("table");
        var thM = el("thead"), trM = el("tr");
        ["", "Ce qui est prélevé chaque mois", "Ce qui est réellement dû"].forEach(function (c, i) {
          trM.appendChild(el("th", i > 0 ? "num" : null, c));
        });
        thM.appendChild(trM); tabM.appendChild(thM);
        var tbM = el("tbody");
        [["Salaire principal (" + eur(m.brutPrincipal) + ")", eur(m.impotPrincipal), ""],
         ["Second salaire (" + eur(m.brutSecondaire) + ")", eur(m.impotSecondaire) + " au taux de " + pct(m.tauxFixeSecondaire), ""],
         ["Impôt du ménage", eur(m.retenueTotale), eur(m.impotAssiette)],
         ["Net annuel du ménage", eur(m.netRetenue), eur(m.netReel)]
        ].forEach(function (l) {
          var tr = el("tr");
          tr.appendChild(el("td", null, l[0]));
          tr.appendChild(el("td", "num", l[1]));
          tr.appendChild(el("td", "num", l[2]));
          tbM.appendChild(tr);
        });
        tabM.appendChild(tbM); wrapM.appendChild(tabM); zoneM.appendChild(wrapM);

        var avert = el("div", "notice small");
        var fort = el("strong", null, m.solde >= 0
          ? "Prévoyez ce solde : il tombe en une fois."
          : "Vous devriez être remboursé après la déclaration.");
        avert.appendChild(fort);
        avert.appendChild(document.createTextNode(" Le taux fixe appliqué au second salaire est un maximum "
          + "forfaitaire, calculé sans connaître le revenu du ménage. L'écart se régularise à la déclaration "
          + "commune, qui produit un solde à payer ou un remboursement. Un taux de retenue adapté peut être "
          + "demandé à l'administration pour lisser ce décalage. À l'inverse, un taux plus élevé ne peut pas "
          + "être inscrit sur une fiche additionnelle : le complément prend la forme d'avances trimestrielles, de sorte que seule la première année se solde en une fois."));
        zoneM.appendChild(avert);
      }
    }
    var comp = window.SIM.comparatif(brut, mois);
    var ct = $("#s-comp");
    ct.innerHTML = "";
    var th = el("thead"), tr0 = el("tr");
    ["Situation", "Net mensuel", "Net annuel", "Prélèvement"].forEach(function (c, i) {
      tr0.appendChild(el("th", i > 0 ? "num" : null, c));
    });
    th.appendChild(tr0); ct.appendChild(th);
    var cb = el("tbody");
    comp.forEach(function (c) {
      var tr = el("tr");
      tr.appendChild(el("td", null, c.label));
      tr.appendChild(el("td", "num", eur(c.res.netMensuel)));
      tr.appendChild(el("td", "num", eur(c.res.netAnnuel)));
      tr.appendChild(el("td", "num", pct(c.res.tauxPrelevementGlobal)));
      cb.appendChild(tr);
    });
    ct.appendChild(cb);
  }

  function majEmprunt() {
    var net = Number($("#e-net").value) || 0;
    var charges = Number($("#e-charges").value) || 0;
    var taux = (Number($("#e-taux").value) || 0) / 100;
    var annees = Number($("#e-duree").value) || 25;

    var k = $("#e-kpis");
    k.innerHTML = "";
    [0.33, 0.40].forEach(function (eff) {
      var c = window.SIM.capaciteEmprunt({
        netMensuel: net, chargesMensuelles: charges,
        tauxAnnuel: taux, annees: annees, effort: eff
      });
      var d = el("div", "kpi" + (eff === 0.33 ? " hl" : ""));
      d.appendChild(el("div", "k", "Effort " + Math.round(eff * 100) + " %"));
      d.appendChild(el("div", "v", eur(c.capital)));
      var m = el("div", "k");
      m.textContent = c.capital > 0
        ? "mensualité " + eur(c.mensualiteDisponible)
        : "charges supérieures à la capacité";
      d.appendChild(m);
      k.appendChild(d);
    });
  }

  function initSimulateur() {
    // Deux sous-onglets : salaire net, capacite d'emprunt
    $$("#sim-tabs button").forEach(function (b) {
      b.addEventListener("click", function () {
        $$("#sim-tabs button").forEach(function (x) { x.classList.toggle("actif", x === b); });
        $("#sim-salaire").hidden = b.dataset.sim !== "salaire";
        $("#sim-emprunt").hidden = b.dataset.sim !== "emprunt";
      });
    });
    ["#s-brut", "#s-brut2", "#s-classe", "#s-mois", "#s-impatrie", "#s-forfaits"].forEach(function (s) {
      $(s).addEventListener("input", majSimulateur);
      $(s).addEventListener("change", majSimulateur);
    });
    ["#e-net", "#e-charges", "#e-taux", "#e-duree"].forEach(function (s) {
      $(s).addEventListener("input", majEmprunt);
    });
    majSimulateur();
    majEmprunt();
  }

  // ---------- Assistant ----------

  var STORAGE_CHAT = "luxguide.chat.v1";
  var profil = window.CHAT.profilVide();
  var historique = [];

  // La conversation et le profil sont conserves d'une visite a l'autre.
  function sauverConversation() {
    try {
      localStorage.setItem(STORAGE_CHAT, JSON.stringify({
        profil: profil,
        historique: historique.slice(-40),
        maj: new Date().toISOString()
      }));
    } catch (e) { /* stockage indisponible */ }
  }

  function chargerConversation() {
    try {
      var d = JSON.parse(localStorage.getItem(STORAGE_CHAT) || "null");
      if (!d || !d.historique) return false;
      profil = d.profil || {};
      historique = d.historique;
      return historique.length > 0;
    } catch (e) { return false; }
  }

  function effacerConversation() {
    try { localStorage.removeItem(STORAGE_CHAT); } catch (e) {}
  }

  // Le meme fil de conversation s'affiche dans l'onglet Assistant et dans le
  // widget flottant : chaque bulle est construite dans chacun des journaux.
  var chipsGroupe = 0;

  function logsActifs() {
    return [$("#chat-log"), $("#widget-log")].filter(Boolean);
  }

  function bulleDans(log, texte, qui) {
    var m = el("div", "msg " + qui);
    m.appendChild(document.createTextNode(texte));
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
    return m;
  }

  // Sources et boutons de relance, ajoutes une fois le texte affiche.
  // Les chips d'un meme groupe disparaissent partout des qu'on clique sur l'une.
  function garnir(m, sources, chips, grp) {
    if (sources && sources.length) {
      var s = el("div", "srcs");
      s.appendChild(el("strong", null, "Sources"));
      sources.forEach(function (src) {
        var a = el("a", null, src.t);
        a.href = src.u; a.target = "_blank"; a.rel = "noopener";
        s.appendChild(a);
      });
      m.appendChild(s);
    }
    if (chips && chips.length) {
      var c = el("div", "chips");
      c.setAttribute("data-grp", String(grp));
      chips.forEach(function (ch) {
        var b = el("button", "chip", ch.label);
        b.addEventListener("click", function () {
          $$(".chips[data-grp='" + grp + "']").forEach(function (x) { x.remove(); });
          ch.action();
        });
        c.appendChild(b);
      });
      m.appendChild(c);
    }
    var log = m.parentElement;
    if (log) log.scrollTop = log.scrollHeight;
  }

  function bulle(texte, qui, sources, chips) {
    var grp = ++chipsGroupe;
    return logsActifs().map(function (log) {
      var m = bulleDans(log, texte, qui);
      garnir(m, sources, chips, grp);
      return m;
    });
  }

  // Affichage progressif, mot a mot, pour les reponses de l'assistant.
  function taper(texte, sources, chips, apres) {
    var grp = ++chipsGroupe;
    var ms = logsActifs().map(function (log) { return bulleDans(log, "", "bot"); });
    var mots = String(texte).split(" ");
    var i = 0;
    (function pas() {
      if (i < mots.length) {
        ms.forEach(function (m) {
          m.firstChild.nodeValue += (i ? " " : "") + mots[i];
          var log = m.parentElement;
          if (log) log.scrollTop = log.scrollHeight;
        });
        i++;
        setTimeout(pas, 22);
      } else {
        ms.forEach(function (m) { garnir(m, sources, chips, grp); });
        if (apres) apres();
      }
    })();
  }

  function poserProchaineQuestion() {
    var champ = window.CHAT.prochainChamp(profil);
    if (!champ) {
      bulle("Merci. Votre profil : " + window.CHAT.decrireProfil(profil) +
        ".\n\nLe parcours et les fiches sont maintenant filtrés pour vous. " +
        "Voici ce qui vous concerne en priorité, et vous pouvez poser vos questions librement.",
        "bot", [], window.CHAT.fichesPourProfil(profil).slice(0, 5).map(function (f) {
          return { label: f.titre, action: function () { ouvrir("fiches"); montrerFiche(f.id); } };
        }));
      // Le profil vient d'etre complete : le parcours et les fiches s'y adaptent.
      rendreTimeline();
      rendreFiches();
      return;
    }
    bulle(champ.question, "bot", [], champ.options.map(function (o) {
      return {
        label: window.CHAT.afficher(o),
        action: function () {
          profil[champ.cle] = o;
          bulle(window.CHAT.afficher(o), "me");
          sauverConversation();
          setTimeout(poserProchaineQuestion, 260);
        }
      };
    }));
  }

  function envoyer(texteForce) {
    var q = texteForce;
    if (!q) {
      var inputs = [$("#chat-input"), $("#widget-input")].filter(Boolean);
      for (var i = 0; i < inputs.length; i++) {
        if (inputs[i].value.trim()) { q = inputs[i].value.trim(); break; }
      }
      inputs.forEach(function (x) { x.value = ""; });
    }
    if (!q) return;
    bulle(q, "me");
    historique.push({ role: "user", content: q });
    sauverConversation();

    var attente = bulle("", "bot");
    attente.forEach(function (m) {
      var pts = el("span", "points");
      pts.innerHTML = "<span></span><span></span><span></span>";
      m.appendChild(pts);
    });

    // Petit temps de reflexion avant la reponse, pour garder un rythme de conversation.
    var delai = new Promise(function (res) { setTimeout(res, 500 + Math.random() * 600); });
    Promise.all([window.CHAT.repondre(q, profil, historique), delai]).then(function (rs) {
      var r = rs[0];
      attente.forEach(function (m) { m.remove(); });
      var chips = (r.fiches || []).slice(0, 3).map(function (id) {
        var f = window.KB.fiches.filter(function (x) { return x.id === id; })[0];
        return f ? {
          label: "Ouvrir : " + f.titre,
          action: function () { ouvrir("fiches"); montrerFiche(f.id); }
        } : null;
      }).filter(Boolean);
      // Relance : approfondir le sujet principal sans avoir a reformuler
      if (r.fiches && r.fiches.length) {
        var pf = window.KB.fiches.filter(function (x) { return x.id === r.fiches[0]; })[0];
        if (pf) chips.push({
          label: "En savoir plus",
          action: function () { envoyer("Peux-tu détailler : " + pf.titre + " ?"); }
        });
      }
      // Question d'assurance : renvoyer vers le comparateur de contrats
      if (r.comparateur) {
        chips.push({
          label: "Comparer 4 contrats habitation",
          action: function () { ouvrir("comparateur"); }
        });
      }
      taper(r.texte, r.sources, chips);
      historique.push({ role: "assistant", content: r.texte });
      sauverConversation();
      var b = $("#mode-badge");
      if (b) {
        b.textContent = "mode " + (r.via || "local");
        b.className = "badge" + (String(r.via).indexOf("api") === 0 ? " on" : "");
      }
    }).catch(function (e) {
      attente.forEach(function (m) { m.remove(); });
      bulle("Une erreur est survenue : " + e.message, "bot");
    });
  }

  function initChat() {
    $("#chat-send").addEventListener("click", function () { envoyer(); });
    $("#chat-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter") envoyer();
    });
    $("#chat-reset").addEventListener("click", function () {
      profil = window.CHAT.profilVide();
      historique = [];
      effacerConversation();
      logsActifs().forEach(function (log) { log.innerHTML = ""; });
      rendreTimeline();
      rendreFiches();
      demarrerChat();
    });

    // Widget flottant : meme conversation, disponible sur tous les onglets
    var wb = $("#widget-btn"), w = $("#widget");
    if (wb && w) {
      wb.addEventListener("click", montrerWidget);
      $("#widget-close").addEventListener("click", function () {
        w.hidden = true;
        wb.hidden = false;
      });
      $("#widget-send").addEventListener("click", function () { envoyer(); });
      $("#widget-input").addEventListener("keydown", function (e) {
        if (e.key === "Enter") envoyer();
      });
    }

    // Reprise de la conversation precedente si elle existe
    if (chargerConversation()) {
      historique.forEach(function (m) {
        bulle(m.content, m.role === "user" ? "me" : "bot");
      });
      bulle("Conversation reprise. Profil enregistré : " + window.CHAT.decrireProfil(profil) +
        ".\nVous pouvez continuer, ou tout réinitialiser.", "bot");
      // Le profil restaure personnalise le parcours et les fiches
      rendreTimeline();
      rendreFiches();
    } else {
      demarrerChat();
    }
    window.CHAT.testerApi().then(function (ok) {
      var b = $("#mode-badge");
      if (b) {
        b.textContent = ok ? "mode api" : "mode local";
        b.className = "badge" + (ok ? " on" : "");
      }
    });
  }

  function demarrerChat() {
    bulle("Bonjour. Quelques questions pour cibler ce qui vous concerne, puis vous pourrez demander ce que vous voulez.", "bot");
    setTimeout(poserProchaineQuestion, 250);
  }

  // Ouvre le widget flottant, depuis n'importe quel point de l'interface.
  function montrerWidget() {
    var w = $("#widget"), wb = $("#widget-btn");
    if (!w || !wb) return;
    w.hidden = false;
    wb.hidden = true;
    var log = $("#widget-log");
    if (log) log.scrollTop = log.scrollHeight;
    var inp = $("#widget-input");
    if (inp) inp.focus();
  }

  // ---------- Comparaisons standardisees ----------
  // Les cartes du haut de l'onglet Comparateur : la MRH sur donnees reelles,
  // et des verticales de demonstration (offres fictives, criteres reels)
  // definies dans comparateur/offres_kb.js, chacune avec son chat d'affinage.

  function rendreVerticales() {
    var g = $("#ctr-verticales");
    if (!g || !window.OFFRES_KB) return;
    g.innerHTML = "";

    var mrh = el("div", "qcard vert-carte");
    mrh.appendChild(el("span", "vert-badge reel", "Données réelles"));
    mrh.appendChild(el("h3", null, "Assurance habitation (MRH)"));
    mrh.appendChild(el("p", null,
      "Treize sinistres réels posés à quatre contrats du marché, clause citée à l'appui, " +
      "un classement selon votre situation et un chat pour vos propres cas."));
    mrh.addEventListener("click", function () {
      fermerVerticale();
      var c = $("#ctr-mrh");
      if (c) c.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    g.appendChild(mrh);

    window.OFFRES_KB.verticales.forEach(function (v) {
      var c = el("div", "qcard vert-carte");
      c.appendChild(el("span", "vert-badge demo", "Démo, données fictives"));
      c.appendChild(el("h3", null, v.titre));
      c.appendChild(el("p", null, v.sousTitre + ". Une grille standard, puis quelques questions pour affiner."));
      c.addEventListener("click", function () { ouvrirVerticale(v); });
      g.appendChild(c);
    });
  }

  function fermerVerticale() {
    var vue = $("#ctr-vue");
    if (vue) { vue.hidden = true; vue.innerHTML = ""; }
  }

  function ouvrirVerticale(v) {
    var vue = $("#ctr-vue");
    if (!vue) return;
    vue.innerHTML = "";
    vue.hidden = false;

    var head = el("div", "vert-head");
    head.appendChild(el("h2", null, v.titre));
    var retour = el("button", "chip", "← Toutes les comparaisons");
    retour.addEventListener("click", fermerVerticale);
    head.appendChild(retour);
    vue.appendChild(head);
    vue.appendChild(el("p", "lead small", v.sousTitre + "."));

    var avert = el("div", "notice small");
    avert.appendChild(el("strong", null, "Démonstration. "));
    avert.appendChild(document.createTextNode(window.OFFRES_KB.avertissement));
    vue.appendChild(avert);

    // La grille standardisee : une ligne par critere, une colonne par offre
    var wrap = el("div", "table-wrap"), tab = el("table");
    tab.id = "vert-table";
    var thead = el("thead"), tr0 = el("tr");
    tr0.appendChild(el("th", null, ""));
    v.offres.forEach(function (o, i) {
      var th = el("th", "num vert-col");
      th.appendChild(el("div", null, o));
      th.appendChild(el("div", "vert-pos", v.positionnement[i]));
      tr0.appendChild(th);
    });
    thead.appendChild(tr0); tab.appendChild(thead);
    var tb = el("tbody");
    v.criteres.forEach(function (c) {
      var tr = el("tr");
      tr.appendChild(el("td", null, c.nom));
      c.valeurs.forEach(function (x) { tr.appendChild(el("td", "num", x)); });
      tb.appendChild(tr);
    });
    tab.appendChild(tb); wrap.appendChild(tab);
    vue.appendChild(wrap);

    if (v.fiche) {
      var f = window.KB.fiches.filter(function (x) { return x.id === v.fiche; })[0];
      if (f) {
        var cf = el("div", "chips");
        var bf = el("button", "chip", "Ouvrir la fiche : " + f.titre);
        bf.addEventListener("click", function () { ouvrir("fiches"); montrerFiche(f.id); });
        cf.appendChild(bf);
        vue.appendChild(cf);
      }
    }

    var card = el("div", "card ctr-wrap");
    card.appendChild(el("h3", null, "Affiner selon votre situation"));
    var log = el("div", "chat-log");
    log.id = "vert-log";
    card.appendChild(log);
    vue.appendChild(card);
    demarrerAffinage(v, log);
    vue.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function bulleVert(log, texte, qui) {
    var m = el("div", "msg " + qui);
    if (texte) m.appendChild(document.createTextNode(texte));
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
    return m;
  }

  function demarrerAffinage(v, log) {
    var scores = v.offres.map(function () { return 0; });
    var raisons = [];
    var etape = 0;

    bulleVert(log,
      "Quelques questions, et je vous dis quelle colonne du tableau colle à votre situation, et pourquoi.",
      "bot");

    function poser() {
      if (etape >= v.questions.length) { conclure(); return; }
      var q = v.questions[etape];
      var m = bulleVert(log, q.question, "bot");
      var c = el("div", "chips");
      q.options.forEach(function (o) {
        var b = el("button", "chip", o.label);
        b.addEventListener("click", function () {
          c.remove();
          bulleVert(log, o.label, "me");
          o.points.forEach(function (p, i) { scores[i] += p; });
          raisons.push(o.raison);
          etape++;
          setTimeout(poser, 260);
        });
        c.appendChild(b);
      });
      m.appendChild(c);
      log.scrollTop = log.scrollHeight;
    }

    function conclure() {
      var max = Math.max.apply(null, scores);
      var classement = v.offres.map(function (o, i) { return { nom: o, score: scores[i], i: i }; })
        .sort(function (a, b) { return b.score - a.score; });
      var m = bulleVert(log, "Pour votre situation, voici le classement :", "bot");
      var cl = el("div", "classement");
      classement.forEach(function (x, rang) {
        var ligne = el("div", "cl-ligne" + (rang === 0 ? " gagnant" : ""));
        ligne.appendChild(el("span", "cl-rang", "#" + (rang + 1)));
        ligne.appendChild(el("span", "cl-nom", x.nom + " · " + v.positionnement[x.i]));
        var barre = el("span", "cl-barre");
        var rempli = el("i");
        rempli.style.width = Math.round(100 * x.score / Math.max(1, max)) + "%";
        barre.appendChild(rempli);
        ligne.appendChild(barre);
        cl.appendChild(ligne);
      });
      m.appendChild(cl);
      m.appendChild(el("p", "vsuite", "Pourquoi : " + raisons.join(" ; ") + "."));
      // La colonne gagnante se surligne dans la grille au-dessus
      var iGagnant = classement[0].i;
      $$("#vert-table tr").forEach(function (tr) {
        var cell = tr.children[iGagnant + 1];
        if (cell) cell.classList.add("col-gagnante");
      });
      m.appendChild(el("p", "vsuite",
        "Rappel : offres fictives de démonstration. La méthode, elle, est la bonne : posez ces " +
        "mêmes questions aux offres réelles, grilles datées en main."));
      var c = el("div", "chips");
      var r = el("button", "chip", "Recommencer");
      r.addEventListener("click", function () { ouvrirVerticale(v); });
      c.appendChild(r);
      var autres = el("button", "chip", "← Toutes les comparaisons");
      autres.addEventListener("click", fermerVerticale);
      c.appendChild(autres);
      m.appendChild(c);
      log.scrollTop = log.scrollHeight;
    }

    setTimeout(poser, 300);
  }

  // ---------- Comparateur de contrats ----------

  var STATUTS_CONTRAT = {
    covered: { t: "payé", c: "ok" },
    covered_with_conditions: { t: "payé (conditions)", c: "cond" },
    sub_limited: { t: "payé (plafond réduit)", c: "cond" },
    not_covered: { t: "non couvert", c: "ko" },
    excluded: { t: "exclu", c: "ko" },
    not_found: { t: "non trouvé", c: "nf" }
  };

  function normaliserCtr(s) {
    return String(s || "").toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  }

  function motsCtr(s) {
    var vides = ["le","la","les","un","une","des","de","du","au","aux","et","ou","a","en","pour",
      "dans","sur","par","avec","est","mon","ma","mes","je","suis","il","que","qui","quel","quelle",
      "couvert","couverte","assurance","contrat"];
    return normaliserCtr(s).split(" ").filter(function (m) {
      return m.length > 2 && vides.indexOf(m) === -1;
    });
  }

  function chercherScenario(q) {
    if (!window.CONTRATS_KB) return null;
    var termes = motsCtr(q);
    if (!termes.length) return null;
    var best = null, bestScore = 0;
    window.CONTRATS_KB.scenarios.forEach(function (sc) {
      var hay = normaliserCtr(sc.groupe + " " + sc.titre + " " + sc.question);
      var s = 0;
      termes.forEach(function (t) { if (hay.indexOf(t) !== -1) s += 1; });
      if (s > bestScore) { bestScore = s; best = sc; }
    });
    return bestScore >= 2 || (bestScore >= 1 && termes.length === 1) ? best : null;
  }

  function bulleCtr(texte, qui) {
    var log = $("#ctr-log");
    if (!log) return null;
    var m = el("div", "msg " + qui);
    if (texte) m.appendChild(document.createTextNode(texte));
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
    return m;
  }

  function carteVerdict(nom, v) {
    var st = STATUTS_CONTRAT[v.statut] || { t: v.statut || "?", c: "nf" };
    var d = el("div", "vcard " + st.c);
    var h = el("div", "vhead");
    h.appendChild(el("strong", null, nom));
    h.appendChild(el("span", "vstatut " + st.c, st.t));
    d.appendChild(h);
    if (v.cle) d.appendChild(el("p", "vcle", v.cle));
    if (v.plafond) d.appendChild(el("p", "vinfo", "Plafond : " + v.plafond));
    if (v.franchise) d.appendChild(el("p", "vinfo", "Franchise : " + v.franchise));
    if (v.citation) {
      var det = el("details");
      det.appendChild(el("summary", null,
        "Clause citée" + (v.page ? " (p. " + v.page + ")" : "") +
        (v.verifiee ? " · retrouvée dans le PDF" : " · à revérifier")));
      det.appendChild(el("blockquote", "vcitation", "« " + v.citation + " »"));
      d.appendChild(det);
    }
    return d;
  }

  function repondreContrat(q) {
    bulleCtr(q, "me");
    var attente = bulleCtr("", "bot");
    if (attente) {
      var pts = el("span", "points");
      pts.innerHTML = "<span></span><span></span><span></span>";
      attente.appendChild(pts);
    }
    setTimeout(function () {
      if (attente) attente.remove();
      var sc = chercherScenario(q);
      if (!sc) {
        var groupes = [];
        (window.CONTRATS_KB ? window.CONTRATS_KB.scenarios : []).forEach(function (s) {
          if (groupes.indexOf(s.groupe) === -1) groupes.push(s.groupe);
        });
        bulleCtr("Ce cas ne figure pas dans les sinistres analysés, je préfère le dire " +
          "plutôt que d'improviser une réponse. Les sujets couverts : " +
          groupes.join(", ") + ". Reformulez, ou cliquez sur une question suggérée.", "bot");
        return;
      }
      var m = bulleCtr("Cas analysé : " + sc.groupe + ", " + sc.titre.toLowerCase() +
        ". Voici comment les quatre contrats répondent, clause citée à l'appui.", "bot");
      if (!m) return;
      var grille = el("div", "vgrid");
      (window.CONTRATS_KB.assureurs || Object.keys(sc.verdicts)).forEach(function (nom) {
        if (sc.verdicts[nom]) grille.appendChild(carteVerdict(nom, sc.verdicts[nom]));
      });
      m.appendChild(grille);
      m.appendChild(el("p", "vsuite",
        "Là où les contrats divergent, tout se joue sur un mot, un seuil ou une exclusion. " +
        "Posez un autre cas, ou ouvrez l'analyse complète."));
      var voisins = window.CONTRATS_KB.scenarios.filter(function (s) {
        return s.groupe === sc.groupe && s.titre !== sc.titre;
      }).slice(0, 2);
      var c = el("div", "chips");
      voisins.forEach(function (s) {
        var b = el("button", "chip", s.groupe + " : " + s.titre.toLowerCase());
        b.addEventListener("click", function () { repondreContrat(s.question); });
        c.appendChild(b);
      });
      var ba = el("button", "chip", "Voir ce que ça donne pour ma situation");
      ba.addEventListener("click", function () {
        var onglet = $$("#mrh-tabs button").filter(function (x) { return x.dataset.mrh === "reco"; })[0];
        if (onglet) onglet.click();
        var z = $("#mrh-reco");
        if (z) z.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      c.appendChild(ba);
      m.appendChild(c);
      var log = $("#ctr-log");
      if (log) log.scrollTop = log.scrollHeight;
    }, 450 + Math.random() * 500);
  }

  // ---------- Comparateur habitation : les cinq volets ----------

  var STATUTS_FR = {
    covered: "payé", covered_with_conditions: "payé sous conditions",
    sub_limited: "payé, plafond réduit", excluded: "exclu",
    not_covered: "non couvert", not_found: "non déterminé"
  };

  // Un scenario de contrats_kb.js correspond-il a une cible [groupe, titre] ?
  function scenariosCibles(cibles) {
    var out = [];
    (cibles || []).forEach(function (c) {
      var groupe = c[0], titre = c[1];
      window.CONTRATS_KB.scenarios.forEach(function (sc) {
        if (sc.groupe === groupe && (titre === null || sc.titre === titre)) out.push(sc);
      });
    });
    return out;
  }

  // Classement selon les biens coches : meme calcul que la case study,
  // moyenne des scores de protection par bien, ponderee par le poids du bien.
  function calculerReco(idsCoches) {
    var K = window.MRH_KB, assureurs = K.assureurs;
    var res = {}, lignes = [];
    assureurs.forEach(function (a) { res[a] = { fit: 0, poids: 0, lacunes: [], parBien: {} }; });

    K.biens.filter(function (b) { return idsCoches.indexOf(b.id) !== -1; }).forEach(function (bien) {
      var scen = scenariosCibles(bien.cibles);
      var ligne = { bien: bien.nom, poids: bien.poids, scores: {} };
      assureurs.forEach(function (a) {
        var vals = [];
        scen.forEach(function (sc) {
          var v = sc.verdicts[a];
          if (!v) return;
          var s = K.scores[v.statut];
          if (s !== null && s !== undefined) vals.push(s);
          if (v.statut === "excluded" || v.statut === "not_covered" || v.statut === "sub_limited") {
            res[a].lacunes.push({
              bien: bien.nom,
              sinistre: sc.groupe + " : " + sc.titre.toLowerCase(),
              statut: STATUTS_FR[v.statut] || v.statut,
              clause: v.cle || "",
              page: v.page
            });
          }
        });
        var moy = vals.length ? vals.reduce(function (x, y) { return x + y; }, 0) / vals.length : null;
        ligne.scores[a] = moy;
        res[a].parBien[bien.nom] = moy;
        if (moy !== null) { res[a].fit += moy * bien.poids; res[a].poids += bien.poids; }
      });
      lignes.push(ligne);
    });

    assureurs.forEach(function (a) {
      res[a].pct = res[a].poids ? Math.round(100 * res[a].fit / res[a].poids) : null;
    });
    return { scores: res, lignes: lignes };
  }

  function couleurScore(s) {
    if (s === null || s === undefined) return "nf";
    if (s >= 0.95) return "ok";
    if (s >= 0.8) return "cond";
    if (s >= 0.4) return "part";
    return "ko";
  }

  function biensCoches() {
    return $$("#mrh-biens input:checked").map(function (i) { return i.value; });
  }

  function rendreReco() {
    var ids = biensCoches();
    var zone = $("#mrh-classement"), zone2 = $("#mrh-couverture-profil");
    zone.innerHTML = ""; zone2.innerHTML = "";

    if (!ids.length) {
      zone.appendChild(el("p", "muted",
        "Cochez au moins une situation pour obtenir un classement."));
      return;
    }

    var r = calculerReco(ids);
    var classement = window.MRH_KB.assureurs.slice().sort(function (a, b) {
      return (r.scores[b].pct || 0) - (r.scores[a].pct || 0);
    });

    zone.appendChild(el("h3", null, "Le classement pour cette situation"));
    classement.forEach(function (nom, i) {
      var s = r.scores[nom];
      var c = el("div", "reco-carte" + (i === 0 ? " premier" : ""));
      var h = el("div", "reco-head");
      h.appendChild(el("span", "reco-rang", "#" + (i + 1)));
      h.appendChild(el("span", "reco-nom", nom));
      h.appendChild(el("span", "reco-pct " + (s.pct >= 78 ? "ok" : s.pct >= 65 ? "part" : "ko"),
        (s.pct === null ? "?" : s.pct + " %")));
      c.appendChild(h);
      var barre = el("div", "reco-barre");
      var rempli = el("i");
      rempli.style.width = (s.pct || 0) + "%";
      rempli.className = s.pct >= 78 ? "ok" : s.pct >= 65 ? "part" : "ko";
      barre.appendChild(rempli);
      c.appendChild(barre);

      if (!s.lacunes.length) {
        c.appendChild(el("p", "reco-ok", "Aucune lacune sur ce que vous avez coché."));
      } else {
        var det = el("details", "reco-lacunes");
        det.appendChild(el("summary", null,
          s.lacunes.length + (s.lacunes.length > 1 ? " points à négocier" : " point à négocier")));
        s.lacunes.forEach(function (g) {
          var d = el("div", "lacune");
          var t = el("p", "lacune-t");
          t.appendChild(el("strong", null, g.bien));
          t.appendChild(document.createTextNode(" · " + g.sinistre + " : "));
          t.appendChild(el("span", "lacune-s", g.statut));
          d.appendChild(t);
          if (g.clause) {
            d.appendChild(el("p", "lacune-c",
              "« " + g.clause + " »" + (g.page ? " (p. " + g.page + ")" : "")));
          }
          det.appendChild(d);
        });
        c.appendChild(det);
      }
      zone.appendChild(c);
    });

    zone.appendChild(el("p", "hint",
      "Le pourcentage mesure la part de vos besoins réellement payée par le contrat : 100 % veut " +
      "dire payé plein sur tout ce que vous avez coché, un chiffre plus bas signale des conditions, " +
      "des plafonds réduits ou des exclusions. Cocher une situation différente change le classement."));

    // Détail : chaque situation cochée, notée contrat par contrat
    zone2.appendChild(el("h3", null, "Le détail derrière le classement"));
    var wrap = el("div", "table-wrap"), tab = el("table", "mrh-table");
    var thead = el("thead"), tr0 = el("tr");
    tr0.appendChild(el("th", null, "Ce que vous avez coché"));
    window.MRH_KB.assureurs.forEach(function (a) { tr0.appendChild(el("th", "num", a)); });
    thead.appendChild(tr0); tab.appendChild(thead);
    var tb = el("tbody");
    r.lignes.forEach(function (l) {
      var tr = el("tr");
      tr.appendChild(el("td", null, l.bien));
      window.MRH_KB.assureurs.forEach(function (a) {
        var s = l.scores[a];
        var td = el("td", "num cell-" + couleurScore(s), s === null ? "—" : Math.round(s * 100) + " %");
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    tab.appendChild(tb); wrap.appendChild(tab); zone2.appendChild(wrap);
    zone2.appendChild(el("p", "hint",
      "100 % : payé sans réserve. 85 % : payé sous conditions. 50 % : payé mais avec un plafond " +
      "réduit. 0 % : exclu ou non couvert. « — » : les extraits ne permettent pas de trancher, " +
      "et cela se demande par écrit à l'assureur."));
  }

  function rendreBiens() {
    var g = $("#mrh-biens");
    if (!g || g.children.length) return;
    window.MRH_KB.biens.forEach(function (b) {
      var d = el("label", "bien");
      var i = el("input");
      i.type = "checkbox"; i.value = b.id; i.checked = !!b.defaut;
      i.addEventListener("change", rendreReco);
      d.appendChild(i);
      var t = el("span");
      t.appendChild(el("span", "bien-nom", b.nom));
      t.appendChild(el("span", "bien-aide", b.aide));
      d.appendChild(t);
      g.appendChild(d);
    });
  }

  function rendreMatrice() {
    var z = $("#mrh-matrice-table");
    if (!z || z.children.length) return;
    var K = window.MRH_KB;
    var wrap = el("div", "table-wrap"), tab = el("table", "mrh-table");
    var thead = el("thead"), tr0 = el("tr");
    tr0.appendChild(el("th", null, "Garantie recherchée"));
    K.assureurs.forEach(function (a) { tr0.appendChild(el("th", "num", a)); });
    thead.appendChild(tr0); tab.appendChild(thead);
    var tb = el("tbody");
    K.criteres.forEach(function (c) {
      var tr = el("tr");
      tr.appendChild(el("td", null, c.label));
      K.assureurs.forEach(function (a) {
        var cell = (K.cellules[a] || {})[c.id] || { hits: 0 };
        var td = el("td", "num " + (cell.hits ? "cell-ok" : "cell-nf"));
        if (!cell.hits) td.textContent = "absent";
        else {
          td.appendChild(el("span", "mat-hits", cell.hits + " mentions"));
          if (cell.first_page) td.appendChild(el("span", "mat-page", "dès la p. " + cell.first_page));
        }
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    tab.appendChild(tb); wrap.appendChild(tab); z.appendChild(wrap);

    var s = $("#mrh-sources");
    s.innerHTML = "";
    s.appendChild(el("h3", null, "Les documents analysés"));
    var ul = el("ul", "mrh-sources-liste");
    K.sources.forEach(function (src) {
      ul.appendChild(el("li", null,
        src.nom + " : conditions générales de " + src.pages + " pages, lues intégralement."));
    });
    s.appendChild(ul);
    s.appendChild(el("p", "hint",
      "Les assureurs sont anonymisés : cette comparaison sert à montrer où les contrats divergent " +
      "et quelles questions poser, pas à recommander une marque."));
  }

  function rendreSinistresTable() {
    var z = $("#mrh-sinistres-table");
    if (!z || z.children.length) return;
    var K = window.MRH_KB;
    var groupes = {}, ordre = [];
    window.CONTRATS_KB.scenarios.forEach(function (sc) {
      if (!groupes[sc.groupe]) { groupes[sc.groupe] = []; ordre.push(sc.groupe); }
      groupes[sc.groupe].push(sc);
    });
    ordre.forEach(function (g) {
      z.appendChild(el("h3", "sin-groupe", g));
      groupes[g].forEach(function (sc) {
        var d = el("details", "sin-item");
        var sum = el("summary");
        sum.appendChild(el("span", "sin-titre", sc.titre));
        var pastilles = el("span", "sin-pastilles");
        K.assureurs.forEach(function (a) {
          var v = sc.verdicts[a];
          var st = STATUTS_CONTRAT[v ? v.statut : "not_found"] || { c: "nf" };
          var p = el("span", "pastille " + st.c);
          p.textContent = a.replace("Assureur ", "");
          p.title = a + " : " + (STATUTS_FR[v ? v.statut : "not_found"] || "?");
          pastilles.appendChild(p);
        });
        sum.appendChild(pastilles);
        d.appendChild(sum);
        var corps = el("div", "sin-corps");
        corps.appendChild(el("p", "sin-question", sc.question));
        var grille = el("div", "vgrid");
        K.assureurs.forEach(function (a) {
          if (sc.verdicts[a]) grille.appendChild(carteVerdict(a, sc.verdicts[a]));
        });
        corps.appendChild(grille);
        d.appendChild(corps);
        z.appendChild(d);
      });
    });
  }

  function rendreConstats() {
    var z = $("#mrh-constats-liste");
    if (!z || z.children.length) return;
    window.MRH_KB.constats.forEach(function (c, i) {
      var d = el("div", "constat");
      var h = el("div", "constat-head");
      h.appendChild(el("span", "constat-num", String(i + 1)));
      h.appendChild(el("h3", null, c.titre));
      d.appendChild(h);
      d.appendChild(el("p", null, c.texte));
      d.appendChild(el("span", "constat-portee", c.portee));
      z.appendChild(d);
    });
  }

  function initMrh() {
    if (!window.MRH_KB || !window.CONTRATS_KB || !$("#mrh-tabs")) return;
    var vues = ["reco", "sinistres", "matrice", "constats", "methode"];
    $$("#mrh-tabs button").forEach(function (b) {
      b.addEventListener("click", function () {
        $$("#mrh-tabs button").forEach(function (x) { x.classList.toggle("actif", x === b); });
        var v = b.dataset.mrh;
        vues.forEach(function (nom) { $("#mrh-" + nom).hidden = nom !== v; });
        if (v === "matrice") rendreMatrice();
        if (v === "sinistres") rendreSinistresTable();
        if (v === "constats") rendreConstats();
      });
    });
    rendreBiens();
    rendreReco();
  }

  function initComparateur() {
    rendreVerticales();
    initMrh();
    if (!window.CONTRATS_KB || !$("#ctr-log")) return;
    // Questions suggerees : le premier cas de chaque famille de sinistres
    var sug = $("#ctr-suggestions");
    var vus = {};
    window.CONTRATS_KB.scenarios.forEach(function (sc) {
      if (vus[sc.groupe]) return;
      vus[sc.groupe] = 1;
      var b = el("button", "chip", sc.groupe + " : " + sc.titre.toLowerCase());
      b.addEventListener("click", function () { repondreContrat(sc.question); });
      sug.appendChild(b);
    });
    bulleCtr("Bonjour. Décrivez un sinistre ou choisissez une question suggérée : je montre " +
      "la réponse des quatre contrats, avec la clause exacte et sa page. C'est en posant vos " +
      "propres cas qu'on comprend un contrat.", "bot");
    $("#ctr-send").addEventListener("click", function () {
      var i = $("#ctr-input");
      if (i.value.trim()) { repondreContrat(i.value.trim()); i.value = ""; }
    });
    $("#ctr-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.target.value.trim()) {
        repondreContrat(e.target.value.trim());
        e.target.value = "";
      }
    });
  }

  // ---------- Carte : ecoles et transports ----------

  var carteDemarree = false, carteObj = null, carteCouche = null;

  function chargerLeaflet(cb) {
    if (window.L) return cb();
    var css = el("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    var s = el("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = cb;
    s.onerror = function () {
      statsCarteMessage("La bibliothèque de carte n'a pas pu être chargée (accès réseau requis).");
    };
    document.head.appendChild(s);
  }

  function statsCarteMessage(txt) {
    var k = $("#c-stats");
    if (!k) return;
    k.innerHTML = "";
    k.appendChild(el("p", "muted", txt));
  }

  // Les adresses comparées et le repère de trajet vivent dans ce navigateur
  // uniquement : rien n'est envoyé à un serveur du guide, rien n'est versionné.
  var STORAGE_CARTE = "luxguide.carte.v1";
  var adresses = [], repere = null;
  var COULEURS = ["#0a4fa8", "#b45309", "#7c3aed", "#0c6b3e"];

  // Catégories cherchées autour de chaque adresse.
  var CATS = [
    { id: "ecoles", label: "Écoles", couleur: "#2563eb", case: "#c-ecoles",
      requete: 'nwr["amenity"="school"]',
      test: function (t) { return t.amenity === "school"; } },
    { id: "creches", label: "Crèches", couleur: "#7c3aed", case: "#c-creches",
      requete: 'nwr["amenity"~"^(kindergarten|childcare)$"]',
      test: function (t) { return t.amenity === "kindergarten" || t.amenity === "childcare"; } },
    { id: "arrets", label: "Bus, tram, train", couleur: "#059669", case: "#c-arrets",
      requete: 'node["highway"="bus_stop"]',
      requete2: 'node["railway"~"^(tram_stop|station|halt)$"]',
      test: function (t) {
        return t.highway === "bus_stop" || t.railway === "tram_stop" ||
               t.railway === "station" || t.railway === "halt";
      } },
    { id: "commerces", label: "Commerces", couleur: "#b45309", case: "#c-commerces",
      requete: 'nwr["shop"~"^(supermarket|convenience|bakery|butcher|greengrocer|general)$"]',
      test: function (t) {
        return ["supermarket", "convenience", "bakery", "butcher", "greengrocer", "general"]
          .indexOf(t.shop) !== -1;
      } },
    { id: "sante", label: "Santé", couleur: "#be123c", case: "#c-sante",
      requete: 'nwr["amenity"~"^(pharmacy|doctors|hospital|clinic)$"]',
      test: function (t) {
        return ["pharmacy", "doctors", "hospital", "clinic"].indexOf(t.amenity) !== -1;
      } }
  ];

  function catsActives() {
    return CATS.filter(function (c) {
      var e = $(c.case);
      return e && e.checked;
    });
  }

  function sauverCarte() {
    try {
      localStorage.setItem(STORAGE_CARTE, JSON.stringify({
        adresses: adresses.map(function (a) {
          return { nom: a.nom, lat: a.lat, lon: a.lon, commune: a.commune };
        }),
        repere: repere ? { nom: repere.nom, lat: repere.lat, lon: repere.lon } : null
      }));
    } catch (e) { /* stockage indisponible */ }
  }

  function chargerCarte() {
    try {
      var d = JSON.parse(localStorage.getItem(STORAGE_CARTE) || "null");
      if (!d) return;
      adresses = d.adresses || [];
      repere = d.repere || null;
      if (repere && $("#c-travail")) $("#c-travail").value = repere.nom;
    } catch (e) { adresses = []; repere = null; }
  }

  // Distance à vol d'oiseau, en mètres (formule de haversine).
  function distance(a, b) {
    var R = 6371000, r = Math.PI / 180;
    var dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
  }

  function formaterDistance(m) {
    if (m === null || m === undefined) return "—";
    if (m < 1000) return m + " m";
    return (m / 1000).toFixed(m < 10000 ? 1 : 0).replace(".", ",") + " km";
  }

  // Marche à pied, à 4,5 km/h, sur la distance à vol d'oiseau : un ordre de grandeur.
  function minutesAPied(m) {
    if (m === null || m === undefined) return null;
    return Math.max(1, Math.round(m / 75));
  }

  function statsCarteMessage(txt) {
    var k = $("#c-stats");
    if (!k) return;
    k.innerHTML = "";
    k.appendChild(el("p", "muted", txt));
  }

  // Géocodage d'un libellé : coordonnées + commune, via OpenStreetMap.
  function geocoder(q) {
    return fetch("https://nominatim.openstreetmap.org/search?format=json&addressdetails=1" +
      "&limit=1&countrycodes=lu&q=" + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.length) return null;
        var a = res[0].address || {};
        return {
          nom: q,
          lat: Number(res[0].lat),
          lon: Number(res[0].lon),
          commune: a.town || a.village || a.city || a.municipality || a.county || ""
        };
      });
  }

  // Les points d'intérêt autour d'une adresse, toutes catégories cochées.
  function alentours(adr) {
    var rayon = Number($("#c-rayon").value) || 1000;
    var cats = catsActives();
    if (!cats.length) return Promise.resolve([]);
    var blocs = [];
    cats.forEach(function (c) {
      blocs.push(c.requete + "(around:" + rayon + "," + adr.lat + "," + adr.lon + ");");
      if (c.requete2) blocs.push(c.requete2 + "(around:" + rayon + "," + adr.lat + "," + adr.lon + ");");
    });
    var q = "[out:json][timeout:25];(" + blocs.join("") + ");out center 400;";
    // Le service Overpass repond souvent 504 quand il est charge : on retente
    // une fois avant d'abandonner la colonne.
    function appel() {
      return fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(q)
      }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      });
    }
    return appel().catch(function () {
      return new Promise(function (res) { setTimeout(res, 2500); }).then(appel);
    }).then(function (j) {
      var pts = [];
      (j.elements || []).forEach(function (e) {
        var la = e.lat !== undefined ? e.lat : (e.center && e.center.lat);
        var lo = e.lon !== undefined ? e.lon : (e.center && e.center.lon);
        if (la === undefined || lo === undefined) return;
        var t = e.tags || {};
        var cat = cats.filter(function (c) { return c.test(t); })[0];
        if (!cat) return;
        pts.push({ lat: la, lon: lo, nom: t.name || "", cat: cat.id, couleur: cat.couleur,
                   d: distance(adr, { lat: la, lon: lo }) });
      });
      return pts;
    });
  }

  // Recalcule et redessine tout : appelée à chaque ajout et à chaque changement
  // de catégorie ou de rayon.
  function rafraichirCarte() {
    if (!window.L || !carteObj) return;
    if (!adresses.length) {
      carteCouche.clearLayers();
      if (repere) marquerRepere();
      statsCarteMessage(repere
        ? "Ajoutez un logement à comparer : ses distances au repère et à ce qui l'entoure s'afficheront ici."
        : "Ajoutez une ou plusieurs adresses pour les comparer.");
      rendreListeAdresses();
      return;
    }
    statsCarteMessage("Calcul des environs (OpenStreetMap)...");
    rendreListeAdresses();
    // Les requetes sont enchainees et non lancees en parallele : le service
    // Overpass refuse les rafales, ce qui laissait des colonnes vides.
    var echecs = [];
    adresses.reduce(function (p, a, i) {
      return p.then(function () {
        return (i ? new Promise(function (r) { setTimeout(r, 900); }) : Promise.resolve())
          .then(function () { return alentours(a); })
          .then(function (pts) { a.pts = pts; })
          .catch(function (e) { a.pts = null; echecs.push(a.nom + " (" + e.message + ")"); });
      });
    }, Promise.resolve()).then(function () {
      dessinerCarte();
      rendreComparaison();
      if (echecs.length) {
        var z = $("#c-stats");
        z.appendChild(el("p", "hint",
          "Les environs n'ont pas pu être chargés pour : " + echecs.join(", ") +
          ". Le service de cartographie limite le nombre d'appels ; réessayez dans un instant."));
      }
    });
  }

  function marquerRepere() {
    if (!repere) return;
    L.marker([repere.lat, repere.lon]).addTo(carteCouche)
      .bindPopup("<b>Repère : " + repere.nom + "</b>");
  }

  function dessinerCarte() {
    var rayon = Number($("#c-rayon").value) || 1000;
    carteCouche.clearLayers();
    marquerRepere();
    var bornes = [];
    adresses.forEach(function (a, i) {
      var col = COULEURS[i % COULEURS.length];
      bornes.push([a.lat, a.lon]);
      L.circle([a.lat, a.lon], { radius: rayon, color: col, weight: 1.5, fillOpacity: .05 })
        .addTo(carteCouche);
      L.circleMarker([a.lat, a.lon], {
        radius: 9, color: "#fff", fillColor: col, fillOpacity: 1, weight: 2
      }).addTo(carteCouche).bindPopup("<b>" + (i + 1) + ". " + a.nom + "</b>" +
        (a.commune ? "<br>" + a.commune : ""));
      (a.pts || []).forEach(function (p) {
        L.circleMarker([p.lat, p.lon], {
          radius: 5, color: p.couleur, fillColor: p.couleur, fillOpacity: .8, weight: 1
        }).addTo(carteCouche).bindPopup("<b>" + (p.nom || "Sans nom") + "</b><br>" +
          formaterDistance(p.d) + " de " + a.nom);
      });
    });
    if (repere) bornes.push([repere.lat, repere.lon]);
    if (bornes.length > 1) carteObj.fitBounds(bornes, { padding: [40, 40] });
    else if (bornes.length === 1) {
      carteObj.setView(bornes[0], rayon <= 500 ? 15 : (rayon <= 1000 ? 14 : 13));
    }
  }

  function rendreListeAdresses() {
    var l = $("#c-liste");
    if (!l) return;
    l.innerHTML = "";
    adresses.forEach(function (a, i) {
      var b = el("button", "chip adr-chip");
      var p = el("span", "adr-pastille");
      p.style.background = COULEURS[i % COULEURS.length];
      p.textContent = String(i + 1);
      b.appendChild(p);
      b.appendChild(document.createTextNode(a.nom + " ✕"));
      b.title = "Retirer cette adresse";
      b.addEventListener("click", function () {
        adresses.splice(i, 1);
        sauverCarte();
        rafraichirCarte();
      });
      l.appendChild(b);
    });
  }

  // Le tableau de comparaison : une colonne par adresse, une ligne par critère.
  function rendreComparaison() {
    var z = $("#c-stats");
    z.innerHTML = "";
    var cats = catsActives();
    if (!cats.length) {
      z.appendChild(el("p", "muted", "Cochez au moins une catégorie pour comparer."));
      return;
    }

    z.appendChild(el("h3", null, adresses.length > 1
      ? "Comparaison des " + adresses.length + " adresses"
      : "Autour de cette adresse"));

    var wrap = el("div", "table-wrap"), tab = el("table", "mrh-table carte-table");
    var thead = el("thead"), tr0 = el("tr");
    tr0.appendChild(el("th", null, ""));
    adresses.forEach(function (a, i) {
      var th = el("th", "num");
      var p = el("span", "adr-pastille");
      p.style.background = COULEURS[i % COULEURS.length];
      p.textContent = String(i + 1);
      th.appendChild(p);
      th.appendChild(el("div", null, a.nom));
      if (a.commune) th.appendChild(el("div", "carte-commune", a.commune));
      tr0.appendChild(th);
    });
    thead.appendChild(tr0); tab.appendChild(thead);
    var tb = el("tbody");

    // Distance au repère de trajet
    if (repere) {
      var trR = el("tr");
      trR.appendChild(el("td", null, "Distance à " + repere.nom));
      var dists = adresses.map(function (a) { return distance(a, repere); });
      var mini = Math.min.apply(null, dists);
      dists.forEach(function (d) {
        var td = el("td", "num" + (d === mini && adresses.length > 1 ? " cell-ok" : ""));
        td.appendChild(el("span", null, formaterDistance(d)));
        trR.appendChild(td);
      });
      tb.appendChild(trR);
    }

    // Une ligne de comptage et une ligne de proximité par catégorie
    cats.forEach(function (c) {
      var trN = el("tr");
      trN.appendChild(el("td", null, c.label + " dans le rayon"));
      var nb = adresses.map(function (a) {
        if (!a.pts) return null;
        return a.pts.filter(function (p) { return p.cat === c.id; }).length;
      });
      var max = Math.max.apply(null, nb.map(function (x) { return x === null ? -1 : x; }));
      nb.forEach(function (n) {
        var td = el("td", "num" + (n !== null && n === max && max > 0 && adresses.length > 1 ? " cell-ok" : ""),
          n === null ? "—" : String(n));
        trN.appendChild(td);
      });
      tb.appendChild(trN);

      var trD = el("tr");
      trD.appendChild(el("td", "sous-ligne", "Le plus proche"));
      var pp = adresses.map(function (a) {
        if (!a.pts) return null;
        var sel = a.pts.filter(function (p) { return p.cat === c.id; });
        if (!sel.length) return null;
        return sel.reduce(function (m, p) { return p.d < m.d ? p : m; });
      });
      var minD = Math.min.apply(null, pp.map(function (p) { return p ? p.d : Infinity; }));
      pp.forEach(function (p) {
        var td = el("td", "num sous-ligne" + (p && p.d === minD && adresses.length > 1 ? " cell-ok" : ""));
        if (!p) { td.textContent = "aucun"; }
        else {
          td.appendChild(el("span", null, formaterDistance(p.d) + ", " + minutesAPied(p.d) + " min à pied"));
          if (p.nom) td.appendChild(el("div", "carte-poi", p.nom));
        }
        trD.appendChild(td);
      });
      tb.appendChild(trD);
    });

    tab.appendChild(tb); wrap.appendChild(tab); z.appendChild(wrap);
    z.appendChild(el("p", "hint",
      "Les cases en vert signalent la meilleure valeur de la ligne. Les distances sont à vol " +
      "d'oiseau et les minutes une marche à 4,5 km/h : un ordre de grandeur pour départager, " +
      "pas un temps de trajet réel. Un arrêt proche ne dit rien de la fréquence des bus, " +
      "que mobiliteit.lu donne."));
  }

  function ajouterAdresse(q) {
    if (!q || !window.L || !carteObj) return;
    if (adresses.length >= 4) {
      statsCarteMessage("Quatre adresses au maximum : retirez-en une pour en ajouter une autre.");
      return;
    }
    statsCarteMessage("Recherche de l'adresse...");
    geocoder(q).then(function (a) {
      if (!a) {
        statsCarteMessage("Adresse introuvable au Luxembourg. Essayez avec la commune ou le quartier.");
        return;
      }
      adresses.push(a);
      sauverCarte();
      rafraichirCarte();
    }).catch(function (e) {
      statsCarteMessage("La recherche d'adresse a échoué (" + e.message + ").");
    });
  }

  function fixerRepere(q) {
    if (!q) { repere = null; sauverCarte(); rafraichirCarte(); return; }
    statsCarteMessage("Recherche du repère...");
    geocoder(q).then(function (a) {
      if (!a) { statsCarteMessage("Repère introuvable au Luxembourg."); return; }
      repere = a;
      sauverCarte();
      rafraichirCarte();
    }).catch(function (e) {
      statsCarteMessage("La recherche a échoué (" + e.message + ").");
    });
  }

  // Exemple : trois quartiers ou communes publics et un pôle d'emploi connu.
  // Aucune adresse personnelle, ici comme ailleurs dans ce guide.
  function exempleCarte() {
    statsCarteMessage("Chargement de l'exemple...");
    adresses = [];
    $("#c-travail").value = "Kirchberg, Luxembourg";
    var lieux = ["Belair, Luxembourg", "Esch-sur-Alzette", "Mersch"];
    geocoder("Kirchberg, Luxembourg").then(function (r) {
      repere = r;
      // Les requêtes sont enchaînées : le service de cartographie demande
      // de ne pas l'interroger en rafale.
      return lieux.reduce(function (p, lieu) {
        return p.then(function () {
          return new Promise(function (res) { setTimeout(res, 1100); })
            .then(function () { return geocoder(lieu); })
            .then(function (a) { if (a) adresses.push(a); });
        });
      }, Promise.resolve());
    }).then(function () {
      sauverCarte();
      rafraichirCarte();
    }).catch(function (e) {
      statsCarteMessage("L'exemple n'a pas pu être chargé (" + e.message + ").");
    });
  }

  // Les applications et sites officiels, que cette carte ne remplace pas.
  var OUTILS_CARTE = [
    { titre: "mobiliteit.lu", u: "https://www.mobiliteit.lu/",
      d: "Le planificateur officiel de tous les transports : horaires en temps réel, itinéraires porte à porte, bus, train, tram, transport scolaire, vélos en libre-service. Application mobile sur les deux magasins." },
    { titre: "CFL go", u: "https://www.cfl.lu/fr-fr/app/cflgo",
      d: "L'application des chemins de fer luxembourgeois : horaires en temps réel, alertes sur vos lignes favorites, information trafic, titres pour les trajets payants." },
    { titre: "Guichet.lu", u: "https://guichet.public.lu/fr/citoyens.html",
      d: "Le guide administratif officiel : chaque démarche, les pièces à fournir et les formulaires. C'est la source citée par les fiches de ce guide." },
    { titre: "Géoportail national", u: "https://map.geoportail.lu/",
      d: "La carte officielle du Luxembourg : cadastre, plans d'aménagement, zones inondables, photos aériennes. Utile avant d'acheter." },
    { titre: "Ministère de l'Éducation nationale", u: "https://men.public.lu/fr.html",
      d: "L'offre scolaire et le fonctionnement de l'enseignement. L'inscription elle-même passe par la commune de résidence." },
    { titre: "Observatoire de l'habitat", u: "https://logement.public.lu/fr/observatoire-habitat.html",
      d: "Les prix réels de vente et de location par commune, publiés par l'État. Le bon repère avant de juger une annonce." }
  ];

  function rendreOutilsCarte() {
    var g = $("#carte-outils");
    if (!g || g.children.length) return;
    OUTILS_CARTE.forEach(function (o) {
      var c = el("div", "qcard");
      c.appendChild(el("h3", null, o.titre));
      c.appendChild(el("p", null, o.d));
      var a = el("a", "outil-lien", "Ouvrir " + o.titre + " →");
      a.href = o.u; a.target = "_blank"; a.rel = "noopener";
      c.appendChild(a);
      c.addEventListener("click", function (e) {
        if (e.target.tagName !== "A") window.open(o.u, "_blank", "noopener");
      });
      g.appendChild(c);
    });
  }

  // Appelee a l'ouverture de l'onglet : la bibliotheque de carte n'est chargee qu'a ce moment.
  function initCarte() {
    rendreOutilsCarte();
    if (carteDemarree) return;
    carteDemarree = true;
    chargerCarte();
    chargerLeaflet(function () {
      carteObj = L.map("carte-map").setView([49.6116, 6.1319], 11);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© les contributeurs OpenStreetMap"
      }).addTo(carteObj);
      carteCouche = L.layerGroup().addTo(carteObj);
      rafraichirCarte();
    });

    $("#c-chercher").addEventListener("click", function () {
      var i = $("#c-adresse");
      if (i.value.trim()) { ajouterAdresse(i.value.trim()); i.value = ""; }
    });
    $("#c-adresse").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.target.value.trim()) {
        ajouterAdresse(e.target.value.trim());
        e.target.value = "";
      }
    });
    $("#c-fixer").addEventListener("click", function () {
      fixerRepere($("#c-travail").value.trim());
    });
    $("#c-travail").addEventListener("keydown", function (e) {
      if (e.key === "Enter") fixerRepere(e.target.value.trim());
    });
    $("#c-exemple").addEventListener("click", exempleCarte);
    $("#c-vider").addEventListener("click", function () {
      adresses = []; repere = null;
      $("#c-travail").value = "";
      $("#c-adresse").value = "";
      sauverCarte();
      rafraichirCarte();
    });

    // Changer une categorie ou le rayon recalcule tout, sans retaper les adresses.
    CATS.forEach(function (c) {
      var e = $(c.case);
      if (e) e.addEventListener("change", rafraichirCarte);
    });
    $("#c-rayon").addEventListener("change", rafraichirCarte);
  }

  // ---------- Administration ----------

  function remplirSelectFiches() {
    var s = $("#a-fiche");
    var courant = s.value;
    s.innerHTML = "";
    window.KB.fiches.forEach(function (f) {
      var o = el("option", null, f.titre + "  (" + f.cat + ")");
      o.value = f.id;
      s.appendChild(o);
    });
    if (courant && window.KB.fiches.some(function (f) { return f.id === courant; })) s.value = courant;
  }

  function chargerFicheDansFormulaire(id) {
    var f = window.KB.fiches.filter(function (x) { return x.id === id; })[0];
    if (!f) return;
    $("#a-titre").value = f.titre || "";
    $("#a-cat").value = f.cat || "";
    $("#a-resume").value = f.resume || "";
    $("#a-corps").value = (f.corps || []).join("\n");
    $("#a-retenir").value = (f.aRetenir || []).join("\n");
    $("#a-tags").value = (f.tags || []).join(", ");
    $("#a-sources").value = (f.sources || []).map(function (s) { return s.t + " | " + s.u; }).join("\n");
    $("#a-status").textContent = "";
  }

  function lignes(v) {
    return String(v || "").split("\n").map(function (x) { return x.trim(); })
      .filter(function (x) { return x.length; });
  }

  function initAdmin() {
    remplirSelectFiches();
    if (window.KB.fiches.length) chargerFicheDansFormulaire(window.KB.fiches[0].id);

    $("#a-fiche").addEventListener("change", function (e) {
      chargerFicheDansFormulaire(e.target.value);
    });

    $("#a-save").addEventListener("click", function () {
      var id = $("#a-fiche").value;
      var f = window.KB.fiches.filter(function (x) { return x.id === id; })[0];
      if (!f) return;
      var titre = $("#a-titre").value.trim();
      if (!titre) { $("#a-status").textContent = "Le titre est obligatoire."; return; }
      f.titre = titre;
      f.cat = $("#a-cat").value.trim() || "Divers";
      f.resume = $("#a-resume").value.trim();
      f.corps = lignes($("#a-corps").value);
      f.aRetenir = lignes($("#a-retenir").value);
      f.tags = $("#a-tags").value.split(",").map(function (x) { return x.trim(); })
        .filter(function (x) { return x.length; });
      f.sources = lignes($("#a-sources").value).map(function (l) {
        var p = l.split("|");
        return { t: (p[0] || "").trim(), u: (p[1] || "").trim() };
      }).filter(function (s) { return s.t; });
      var ok = sauverKB();
      $("#a-status").textContent = ok
        ? "Enregistré dans ce navigateur. Utilisez Exporter pour rendre la modification permanente."
        : "Stockage du navigateur indisponible : exportez le fichier pour ne rien perdre.";
      remplirSelectFiches();
      rendreAccueil(); rendreFiches(); rendreTimeline();
      $("#a-fiche").value = id;
    });

    $("#a-new").addEventListener("click", function () {
      var titre = prompt("Titre de la nouvelle fiche ?");
      if (!titre) return;
      var id = titre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || ("fiche_" + Date.now());
      if (window.KB.fiches.some(function (f) { return f.id === id; })) {
        alert("Une fiche porte déjà cet identifiant."); return;
      }
      window.KB.fiches.push({
        id: id, titre: titre, cat: "Divers", resume: "",
        tags: [], corps: [], aRetenir: [], sources: []
      });
      sauverKB(); remplirSelectFiches();
      $("#a-fiche").value = id; chargerFicheDansFormulaire(id);
      rendreAccueil(); rendreFiches();
      $("#a-status").textContent = "Fiche créée. Complétez-la puis enregistrez.";
    });

    $("#a-del").addEventListener("click", function () {
      var id = $("#a-fiche").value;
      var f = window.KB.fiches.filter(function (x) { return x.id === id; })[0];
      if (!f) return;
      if (!confirm("Supprimer définitivement la fiche \"" + f.titre + "\" ?")) return;
      window.KB.fiches = window.KB.fiches.filter(function (x) { return x.id !== id; });
      window.KB.faq = window.KB.faq.filter(function (q) { return q.fiche !== id; });
      sauverKB(); remplirSelectFiches();
      if (window.KB.fiches.length) chargerFicheDansFormulaire(window.KB.fiches[0].id);
      rendreAccueil(); rendreFiches();
      $("#a-status").textContent = "Fiche supprimée.";
    });

    // Parametres du simulateur
    var libelles = {
      ssmAnnuel: "Salaire social minimum annuel",
      plafondFacteur: "Plafond cotisable (x SSM)",
      tauxPension: "Taux pension",
      tauxMaladieNature: "Maladie en nature",
      tauxMaladieEspeces: "Maladie en espèces",
      tauxDependance: "Contribution dépendance",
      fondsEmploi: "Fonds pour l'emploi",
      fondsEmploiTaux2: "Fonds pour l'emploi, taux majoré",
      seuilFondsClasse1: "Seuil taux majoré, classe 1 et 1a",
      seuilFondsClasse2: "Seuil taux majoré, classe 2",
      impatrieTaux: "Exonération impatriés",
      impatriePlafond: "Plafond de rémunération éligible",
      fraisObtention: "Forfait frais d'obtention",
      depensesSpeciales: "Forfait dépenses spéciales"
    };
    var cont = $("#a-params");
    cont.innerHTML = "";
    var P = window.SIM.params();
    Object.keys(libelles).forEach(function (k) {
      var d = el("div");
      var l = el("label", null, libelles[k]);
      l.setAttribute("for", "p-" + k);
      var i = el("input");
      i.type = "number"; i.id = "p-" + k; i.step = "any"; i.value = P[k];
      d.appendChild(l); d.appendChild(i); cont.appendChild(d);
    });

    $("#p-save").addEventListener("click", function () {
      var patch = {};
      Object.keys(libelles).forEach(function (k) {
        var v = Number($("#p-" + k).value);
        if (!isNaN(v)) patch[k] = v;
      });
      window.SIM.setParams(patch);
      try { localStorage.setItem(STORAGE_PARAMS, JSON.stringify(window.SIM.params())); } catch (e) {}
      majSimulateur(); majEmprunt();
      $("#p-status").textContent = "Paramètres enregistrés.";
      setTimeout(function () { $("#p-status").textContent = ""; }, 2500);
    });

    // Export, import, reinitialisation
    $("#x-export").addEventListener("click", function () {
      var entete = "// Base de connaissances : s'installer au Luxembourg.\n" +
        "// Export du " + new Date().toISOString().slice(0, 10) + " depuis l'onglet Administration.\n" +
        "// Remplacer app/kb.js par ce fichier pour rendre les modifications permanentes.\n\n";
      var contenu = entete + "window.KB = " + JSON.stringify(window.KB, null, 2) + ";\n";
      var blob = new Blob([contenu], { type: "text/javascript" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "kb.js";
      document.body.appendChild(a); a.click(); a.remove();
    });

    $("#x-import").addEventListener("click", function () { $("#x-file").click(); });
    $("#x-file").addEventListener("change", function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var txt = String(fr.result);
          var i = txt.indexOf("{");
          var j = txt.lastIndexOf("}");
          var obj = JSON.parse(txt.slice(i, j + 1));
          if (!obj.fiches) throw new Error("fichier sans fiches");
          window.KB = obj;
          sauverKB();
          remplirSelectFiches();
          if (window.KB.fiches.length) chargerFicheDansFormulaire(window.KB.fiches[0].id);
          rendreAccueil(); rendreFiches(); rendreTimeline();
          $("#a-status").textContent = "Import réussi : " + window.KB.fiches.length + " fiches.";
        } catch (err) {
          $("#a-status").textContent = "Import impossible : " + err.message;
        }
      };
      fr.readAsText(file);
      e.target.value = "";
    });

    $("#x-reset").addEventListener("click", function () {
      if (!confirm("Revenir au contenu d'origine ? Les modifications locales seront perdues.")) return;
      window.KB = JSON.parse(JSON.stringify(KB_ORIGINE));
      try { localStorage.removeItem(STORAGE_KB); localStorage.removeItem(STORAGE_PARAMS); } catch (e) {}
      remplirSelectFiches();
      if (window.KB.fiches.length) chargerFicheDansFormulaire(window.KB.fiches[0].id);
      rendreAccueil(); rendreFiches(); rendreTimeline();
      $("#a-status").textContent = "Contenu d'origine restauré.";
    });
  }

  // ---------- Demarrage ----------

  chargerKB();
  initTheme();
  initOnglets();
  rendreAccueil();
  rendreFiches();
  initRecherche();
  rendreTimeline();
  initFaq();
  initSimulateur();
  initChat();
  initComparateur();
  initAdmin();
  ouvrirDepuisHash();
  window.addEventListener("hashchange", ouvrirDepuisHash);
})();
