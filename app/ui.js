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

  var PANNEAUX = ["accueil", "fiches", "parcours", "simulateur", "assistant", "admin"];

  function ouvrir(nom, sansHash) {
    if (PANNEAUX.indexOf(nom) === -1) nom = "accueil";
    $$("#tabs button").forEach(function (b) {
      b.setAttribute("aria-selected", String(b.dataset.panel === nom));
    });
    $$(".panel").forEach(function (p) { p.hidden = p.id !== "panel-" + nom; });
    if (!sansHash && window.location.hash !== "#" + nom) {
      try { history.replaceState(null, "", "#" + nom); } catch (e) { /* file:// */ }
    }
    window.scrollTo(0, 0);
  }

  // Ouverture directe par ancre.
  //   #simulateur        ouvre un onglet
  //   #fiche/bail        ouvre directement une fiche, lien partageable
  function ouvrirDepuisHash() {
    var h = (window.location.hash || "").replace("#", "");
    if (!h) return;
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
    window.KB.faq.slice(0, 8).forEach(function (item) {
      var card = el("div", "qcard reveal");
      card.appendChild(el("h3", null, item.q));
      card.appendChild(el("p", null, item.a.slice(0, 125) + (item.a.length > 125 ? "..." : "")));
      card.addEventListener("click", function () { ouvrir("fiches"); montrerFiche(item.fiche); });
      fq.appendChild(card);
    });

    rendreCredits();
    activerApparition();
  }

  function rendreCredits() {
    var c = $("#credits-photos");
    if (!c) return;
    c.innerHTML = "";
    c.appendChild(document.createTextNode(
      "Photographies : Luxembourg, sous licence Creative Commons via Wikimedia Commons. " +
      "Auteurs : Cayambe, GilPe, Krzysztof Golik, Dietmar Rabich. Detail des licences dans assets/CREDITS.json."
    ));
  }

  // ---------- Fiches ----------

  function rendreFiches(liste) {
    var g = $("#fiches-grid");
    g.innerHTML = "";
    (liste || window.KB.fiches).forEach(function (f) {
      g.appendChild(tuile(f.cat, f.titre, f.resume, null, function () { montrerFiche(f.id); }));
    });
    if (!g.children.length) g.appendChild(el("p", "muted", "Aucune fiche ne correspond a cette recherche."));
    activerApparition(g);
    $("#fiches-liste").hidden = false;
    $("#fiche-detail").hidden = true;
  }

  function montrerFiche(id, sansHash) {
    var f = window.KB.fiches.filter(function (x) { return x.id === id; })[0];
    if (!f) { rendreFiches(); return; }
    if (!sansHash) {
      try { history.replaceState(null, "", "#fiche/" + id); } catch (e) { /* file:// */ }
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
      try { history.replaceState(null, "", "#fiches"); } catch (e) {}
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

  function initRecherche() {
    $("#q-fiches").addEventListener("input", function (e) {
      var q = e.target.value.trim();
      if (!q) return rendreFiches();
      var hits = window.CHAT.rechercher(q, 50);
      rendreFiches(hits.map(function (h) { return h.fiche; }));
    });
  }

  // ---------- Parcours ----------

  function rendreTimeline() {
    var t = $("#timeline");
    t.innerHTML = "";
    window.KB.timeline.forEach(function (p) {
      var step = el("div", "step");
      step.appendChild(el("h3", null, p.phase));
      var ul = el("ul");
      p.items.forEach(function (i) { ul.appendChild(el("li", null, i)); });
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
    [["Net mensuel", eur(r.netMensuel), true],
     ["Net annuel", eur(r.netAnnuel), false],
     ["Impot total", eur(r.impotTotal), false],
     ["Cotisations", eur(r.cotisations + r.dependance), false],
     ["Prelevement global", pct(r.tauxPrelevementGlobal), false]
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
      ["Cotisations sociales (" + pct(r.tauxCotisations) + ", plafonnees)", "- " + eur(r.cotisations)],
      ["Contribution dependance", "- " + eur(r.dependance)],
      ["Net avant impot", eur(r.netAvantImpot)]
    ];
    if (r.exoneration > 0) lignes.push(["Exoneration impatries", "- " + eur(r.exoneration)]);
    lignes.push(["Revenu imposable retenu", eur(r.imposable)]);
    lignes.push(["Impot sur le revenu", "- " + eur(r.impot)]);
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
      [["net", "Net percu", pNet], ["impot", "Impots", pImp], ["cotis", "Cotisations", pCot]]
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
    var comp = window.SIM.comparatif(brut, mois);
    var ct = $("#s-comp");
    ct.innerHTML = "";
    var th = el("thead"), tr0 = el("tr");
    ["Situation", "Net mensuel", "Net annuel", "Prelevement"].forEach(function (c, i) {
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
        ? "mensualite " + eur(c.mensualiteDisponible)
        : "charges superieures a la capacite";
      d.appendChild(m);
      k.appendChild(d);
    });
  }

  function initSimulateur() {
    ["#s-brut", "#s-classe", "#s-mois", "#s-impatrie", "#s-forfaits"].forEach(function (s) {
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

  function bulle(texte, qui, sources, chips) {
    var log = $("#chat-log");
    var m = el("div", "msg " + qui);
    m.appendChild(document.createTextNode(texte));
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
      chips.forEach(function (ch) {
        var b = el("button", "chip", ch.label);
        b.addEventListener("click", function () { c.remove(); ch.action(); });
        c.appendChild(b);
      });
      m.appendChild(c);
    }
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
    return m;
  }

  function poserProchaineQuestion() {
    var champ = window.CHAT.prochainChamp(profil);
    if (!champ) {
      bulle("Merci. Votre profil : " + window.CHAT.decrireProfil(profil) +
        ".\n\nVoici ce qui vous concerne en priorite. Posez maintenant vos questions librement.",
        "bot", [], window.CHAT.fichesPourProfil(profil).slice(0, 5).map(function (f) {
          return { label: f.titre, action: function () { ouvrir("fiches"); montrerFiche(f.id); } };
        }));
      return;
    }
    bulle(champ.question, "bot", [], champ.options.map(function (o) {
      return {
        label: o,
        action: function () {
          profil[champ.cle] = o;
          bulle(o, "me");
          sauverConversation();
          setTimeout(poserProchaineQuestion, 120);
        }
      };
    }));
  }

  function envoyer() {
    var input = $("#chat-input");
    var q = input.value.trim();
    if (!q) return;
    input.value = "";
    bulle(q, "me");
    historique.push({ role: "user", content: q });
    sauverConversation();

    var attente = bulle("", "bot");
    var pts = el("span", "points");
    pts.innerHTML = "<span></span><span></span><span></span>";
    attente.appendChild(pts);

    window.CHAT.repondre(q, profil, historique).then(function (r) {
      attente.remove();
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
          action: function () {
            $("#chat-input").value = "Peux-tu detailler : " + pf.titre + " ?";
            envoyer();
          }
        });
      }
      bulle(r.texte, "bot", r.sources, chips);
      historique.push({ role: "assistant", content: r.texte });
      sauverConversation();
      var b = $("#mode-badge");
      b.textContent = "mode " + (r.via || "local");
      b.className = "badge" + (String(r.via).indexOf("api") === 0 ? " on" : "");
    }).catch(function (e) {
      attente.remove();
      bulle("Une erreur est survenue : " + e.message, "bot");
    });
  }

  function initChat() {
    $("#chat-send").addEventListener("click", envoyer);
    $("#chat-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter") envoyer();
    });
    $("#chat-reset").addEventListener("click", function () {
      profil = window.CHAT.profilVide();
      historique = [];
      effacerConversation();
      $("#chat-log").innerHTML = "";
      demarrerChat();
    });

    // Reprise de la conversation precedente si elle existe
    if (chargerConversation()) {
      historique.forEach(function (m) {
        bulle(m.content, m.role === "user" ? "me" : "bot");
      });
      bulle("Conversation reprise. Profil enregistre : " + window.CHAT.decrireProfil(profil) +
        ".\nVous pouvez continuer, ou tout reinitialiser.", "bot");
    } else {
      demarrerChat();
    }
    window.CHAT.testerApi().then(function (ok) {
      var b = $("#mode-badge");
      b.textContent = ok ? "mode api" : "mode local";
      b.className = "badge" + (ok ? " on" : "");
    });
  }

  function demarrerChat() {
    bulle("Bonjour. Quelques questions pour cibler ce qui vous concerne, puis vous pourrez demander ce que vous voulez.", "bot");
    setTimeout(poserProchaineQuestion, 250);
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
        ? "Enregistre dans ce navigateur. Utilisez Exporter pour rendre la modification permanente."
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
        alert("Une fiche porte deja cet identifiant."); return;
      }
      window.KB.fiches.push({
        id: id, titre: titre, cat: "Divers", resume: "",
        tags: [], corps: [], aRetenir: [], sources: []
      });
      sauverKB(); remplirSelectFiches();
      $("#a-fiche").value = id; chargerFicheDansFormulaire(id);
      rendreAccueil(); rendreFiches();
      $("#a-status").textContent = "Fiche creee. Completez-la puis enregistrez.";
    });

    $("#a-del").addEventListener("click", function () {
      var id = $("#a-fiche").value;
      var f = window.KB.fiches.filter(function (x) { return x.id === id; })[0];
      if (!f) return;
      if (!confirm("Supprimer definitivement la fiche \"" + f.titre + "\" ?")) return;
      window.KB.fiches = window.KB.fiches.filter(function (x) { return x.id !== id; });
      window.KB.faq = window.KB.faq.filter(function (q) { return q.fiche !== id; });
      sauverKB(); remplirSelectFiches();
      if (window.KB.fiches.length) chargerFicheDansFormulaire(window.KB.fiches[0].id);
      rendreAccueil(); rendreFiches();
      $("#a-status").textContent = "Fiche supprimee.";
    });

    // Parametres du simulateur
    var libelles = {
      ssmAnnuel: "Salaire social minimum annuel",
      plafondFacteur: "Plafond cotisable (x SSM)",
      tauxPension: "Taux pension",
      tauxMaladieNature: "Maladie en nature",
      tauxMaladieEspeces: "Maladie en especes",
      tauxDependance: "Contribution dependance",
      fondsEmploi: "Fonds pour l'emploi",
      fondsEmploiTaux2: "Fonds pour l'emploi, taux majore",
      seuilFondsClasse1: "Seuil taux majore, classe 1 et 1a",
      seuilFondsClasse2: "Seuil taux majore, classe 2",
      impatrieTaux: "Exoneration impatries",
      impatriePlafond: "Plafond de remuneration eligible",
      fraisObtention: "Forfait frais d'obtention",
      depensesSpeciales: "Forfait depenses speciales"
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
      $("#p-status").textContent = "Parametres enregistres.";
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
          $("#a-status").textContent = "Import reussi : " + window.KB.fiches.length + " fiches.";
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
      $("#a-status").textContent = "Contenu d'origine restaure.";
    });
  }

  // ---------- Demarrage ----------

  chargerKB();
  initOnglets();
  rendreAccueil();
  rendreFiches();
  initRecherche();
  rendreTimeline();
  initSimulateur();
  initChat();
  initAdmin();
  ouvrirDepuisHash();
  window.addEventListener("hashchange", ouvrirDepuisHash);
})();
