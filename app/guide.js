// Fiches guidées : un parcours en étapes plutôt qu'un long texte.
//
// Une fiche qui porte `guide` est affichée par ce module ; les autres gardent
// le rendu en paragraphes de ui.js. Format :
//
//   guide.reperes : [{ k: libellé, v: valeur, d: précision }]   bande de chiffres clés
//   guide.cas     : { titre, items: [{ t, d, actif }] }          tri en tête de fiche
//   guide.onglets : [{ id, titre, blocs: [...] }]
//
// Un bloc est l'un de :
//   "texte"                                    un paragraphe
//   { note: "..." }                            un encadré
//   { etapes: [{ t, d, ou, apportez, cout, obtenez, lien, onglet }] }
//   { cocher: clé, items: [{ t, d, lien }] }   liste à cocher, gardée dans ce navigateur
//   { pays: [{ t, colonnes: [{ h, l: [...] }] }] }
//   { tableau: { colonnes, lignes } }
//   { plis: [{ t, p: [...] }] }                 questions dépliables
//
// lien = { t, fiche } vers une autre fiche, ou { t, u } vers un site.
//
// La recherche et l'assistant lisent f.corps. Pour une fiche guidée, ce corps
// est dérivé du guide au chargement : il n'y a qu'une source.

(function () {
  "use strict";

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }

  // ---------- Texte dérivé, pour la recherche et l'assistant ----------

  function texte(g) {
    var out = [];
    (g.reperes || []).forEach(function (r) { out.push(r.k + " : " + r.v + ", " + r.d + "."); });
    if (g.cas) {
      out.push({ h: g.cas.titre });
      g.cas.items.forEach(function (c) { out.push(c.t + ". " + (c.d || "")); });
    }
    (g.onglets || []).forEach(function (o) {
      out.push({ h: o.titre });
      o.blocs.forEach(function (b) { texteBloc(b, out); });
    });
    return out;
  }

  function texteBloc(b, out) {
    if (typeof b === "string") { out.push(b); return; }
    if (b.note) out.push(b.note);
    (b.etapes || []).forEach(function (e, i) {
      var morceaux = [e.d];
      if (e.ou) morceaux.push("Où : " + e.ou.join(" ; ") + ".");
      if (e.apportez) morceaux.push("Apportez : " + e.apportez + ".");
      if (e.cout) morceaux.push("Coût : " + e.cout + ".");
      if (e.obtenez) morceaux.push("Vous obtenez : " + e.obtenez + ".");
      out.push((i + 1) + ". " + e.t + ". " + morceaux.join(" "));
    });
    if (b.cocher) b.items.forEach(function (it) { out.push(it.t + (it.d ? " : " + it.d : ".")); });
    (b.pays || []).forEach(function (p) {
      out.push(p.t + ". " + p.colonnes.map(function (c) { return c.h + " : " + c.l.join(" ; "); }).join(". ") + ".");
    });
    if (b.tableau) b.tableau.lignes.forEach(function (l) { out.push(l.join(" : ") + "."); });
    (b.plis || []).forEach(function (p) { out.push(p.t + ". " + p.p.join(" ")); });
  }

  // ---------- Rendu ----------

  function lien(l) {
    var a = el("a", "g-lien", l.t);
    if (l.fiche) a.href = "#fiche/" + l.fiche;
    else { a.href = l.u; a.target = "_blank"; a.rel = "noopener"; }
    return a;
  }

  function reperes(liste) {
    var z = el("div", "g-reperes");
    liste.forEach(function (r) {
      var c = el("div", "g-repere");
      c.appendChild(el("span", "g-k", r.k));
      c.appendChild(el("strong", "g-v", r.v));
      c.appendChild(el("span", "g-d", r.d));
      z.appendChild(c);
    });
    return z;
  }

  function cas(c) {
    var s = el("section", "g-cas");
    s.appendChild(el("h2", null, c.titre));
    var grille = el("div", "g-cas-grille");
    c.items.forEach(function (it) {
      var carte = el("div", "g-cas-item" + (it.actif ? " actif" : ""));
      if (it.actif) carte.appendChild(el("span", "g-badge", "Cette fiche"));
      carte.appendChild(el("strong", null, it.t));
      carte.appendChild(el("p", null, it.d));
      grille.appendChild(carte);
    });
    s.appendChild(grille);
    return s;
  }

  function champ(dl, k, v) {
    if (!v) return;
    dl.appendChild(el("dt", null, k));
    var dd = el("dd");
    if (Array.isArray(v)) v.forEach(function (x) { dd.appendChild(el("span", "g-ligne", x)); });
    else dd.textContent = v;
    dl.appendChild(dd);
  }

  function etapes(liste, aller) {
    var ol = el("ol", "g-etapes");
    liste.forEach(function (e, i) {
      var li = el("li", "g-etape");
      li.appendChild(el("span", "g-num", String(i + 1)));
      var carte = el("div", "g-etape-carte");
      carte.appendChild(el("h3", null, e.t));
      if (e.d) carte.appendChild(el("p", null, e.d));
      var dl = el("dl", "g-champs");
      champ(dl, "Où", e.ou);
      champ(dl, "Apportez", e.apportez);
      champ(dl, "Coût", e.cout);
      champ(dl, "Vous obtenez", e.obtenez);
      carte.appendChild(dl);
      if (e.lien || e.onglet) {
        var pied = el("div", "g-pied");
        if (e.onglet) {
          var b = el("button", "g-lien g-bouton", e.onglet.t + " →");
          b.type = "button";
          b.addEventListener("click", function () { aller(e.onglet.id); });
          pied.appendChild(b);
        }
        if (e.lien) pied.appendChild(lien(e.lien));
        carte.appendChild(pied);
      }
      li.appendChild(carte);
      ol.appendChild(li);
    });
    return ol;
  }

  // Les cases cochées restent dans ce navigateur, rien n'est envoyé.
  function lire(cle) {
    try { return JSON.parse(localStorage.getItem(cle) || "{}") || {}; } catch (e) { return {}; }
  }
  function ecrire(cle, v) {
    try { localStorage.setItem(cle, JSON.stringify(v)); } catch (e) { /* stockage bloqué */ }
  }

  function cocher(b, ficheId) {
    var cle = "guide:" + ficheId + ":" + b.cocher;
    var etat = lire(cle);
    var z = el("div", "g-cocher");
    var tete = el("div", "g-cocher-tete");
    var compte = el("strong", "g-compte");
    var barre = el("div", "g-barre"), plein = el("span");
    barre.appendChild(plein);
    var raz = el("button", "g-lien g-bouton", "Tout décocher");
    raz.type = "button";
    tete.appendChild(compte); tete.appendChild(raz);
    z.appendChild(tete); z.appendChild(barre);

    var ul = el("ul");
    var cases = [];
    function maj() {
      var n = cases.filter(function (c) { return c.checked; }).length;
      compte.textContent = n + " sur " + cases.length + " prêts";
      plein.style.width = (cases.length ? 100 * n / cases.length : 0) + "%";
      z.classList.toggle("complet", n === cases.length);
    }
    b.items.forEach(function (it, i) {
      var li = el("li");
      var lab = el("label");
      var c = el("input");
      c.type = "checkbox";
      c.checked = !!etat[i];
      c.addEventListener("change", function () {
        etat[i] = c.checked; ecrire(cle, etat);
        li.classList.toggle("fait", c.checked); maj();
      });
      li.classList.toggle("fait", c.checked);
      cases.push(c);
      lab.appendChild(c);
      var txt = el("span", "g-item");
      txt.appendChild(el("span", "g-t", it.t));
      if (it.d) txt.appendChild(el("span", "g-d", it.d));
      lab.appendChild(txt);
      li.appendChild(lab);
      if (it.lien) li.appendChild(lien(it.lien));
      ul.appendChild(li);
    });
    raz.addEventListener("click", function () {
      cases.forEach(function (c) { c.checked = false; });
      etat = {}; ecrire(cle, etat);
      Array.prototype.forEach.call(ul.children, function (li) { li.classList.remove("fait"); });
      maj();
    });
    z.appendChild(ul);
    z.appendChild(el("p", "g-discret", "Les cases restent dans ce navigateur, rien n'est envoyé."));
    maj();
    return z;
  }

  function pays(liste) {
    var z = el("div", "g-pays");
    var chips = el("div", "chips");
    var vue = el("div", "g-pays-vue");
    var boutons = [];
    function montrer(i) {
      boutons.forEach(function (b, j) {
        b.classList.toggle("actif", j === i);
        b.setAttribute("aria-pressed", String(j === i));
      });
      vue.innerHTML = "";
      liste[i].colonnes.forEach(function (c) {
        var col = el("div", "g-pays-col");
        col.appendChild(el("h4", null, c.h));
        var ul = el("ul");
        c.l.forEach(function (x) { ul.appendChild(el("li", null, x)); });
        col.appendChild(ul);
        vue.appendChild(col);
      });
    }
    liste.forEach(function (p, i) {
      var b = el("button", "chip", p.t);
      b.type = "button";
      b.addEventListener("click", function () { montrer(i); });
      boutons.push(b);
      chips.appendChild(b);
    });
    z.appendChild(chips);
    z.appendChild(vue);
    montrer(0);
    return z;
  }

  function tableau(t) {
    var wrap = el("div", "table-wrap"), tab = el("table", "g-table");
    var trh = el("tr");
    t.colonnes.forEach(function (c, i) { trh.appendChild(el("th", i > 0 ? "num" : null, c)); });
    var thead = el("thead"); thead.appendChild(trh); tab.appendChild(thead);
    var tb = el("tbody");
    t.lignes.forEach(function (l) {
      var tr = el("tr");
      l.forEach(function (c, i) { tr.appendChild(el("td", i > 0 ? "num" : null, c)); });
      tb.appendChild(tr);
    });
    tab.appendChild(tb); wrap.appendChild(tab);
    return wrap;
  }

  function plis(liste) {
    var z = el("div", "g-plis");
    liste.forEach(function (p, i) {
      var d = el("details", "g-pli");
      if (i === 0) d.open = true;
      d.appendChild(el("summary", null, p.t));
      p.p.forEach(function (x) { d.appendChild(el("p", null, x)); });
      z.appendChild(d);
    });
    return z;
  }

  function bloc(b, ficheId, aller) {
    if (typeof b === "string") return el("p", "g-p", b);
    if (b.note) return el("p", "g-note", b.note);
    if (b.etapes) return etapes(b.etapes, aller);
    if (b.cocher) return cocher(b, ficheId);
    if (b.pays) return pays(b.pays);
    if (b.tableau) return tableau(b.tableau);
    if (b.plis) return plis(b.plis);
    return el("div");
  }

  function onglets(ficheId, liste) {
    var z = el("div", "g-onglets");
    var barre = el("div", "g-tabs");
    barre.setAttribute("role", "tablist");
    var tabs = [], panneaux = [];

    function aller(id, defiler) {
      liste.forEach(function (o, i) {
        var actif = o.id === id;
        tabs[i].classList.toggle("actif", actif);
        tabs[i].setAttribute("aria-selected", String(actif));
        tabs[i].tabIndex = actif ? 0 : -1;
        panneaux[i].hidden = !actif;
      });
      if (defiler !== false) {
        var haut = z.getBoundingClientRect().top + window.pageYOffset - 90;
        if (window.pageYOffset > haut) window.scrollTo(0, haut);
      }
    }

    liste.forEach(function (o, i) {
      var t = el("button", "g-tab", o.titre);
      t.type = "button";
      t.id = "g-tab-" + o.id;
      t.setAttribute("role", "tab");
      t.setAttribute("aria-controls", "g-pan-" + o.id);
      t.addEventListener("click", function () { aller(o.id); });
      t.addEventListener("keydown", function (ev) {
        var d = ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : 0;
        if (!d) return;
        ev.preventDefault();
        var j = (i + d + liste.length) % liste.length;
        aller(liste[j].id, false); tabs[j].focus();
      });
      tabs.push(t);
      barre.appendChild(t);

      var p = el("div", "g-panneau");
      p.id = "g-pan-" + o.id;
      p.setAttribute("role", "tabpanel");
      p.setAttribute("aria-labelledby", t.id);
      o.blocs.forEach(function (b) { p.appendChild(bloc(b, ficheId, aller)); });
      panneaux.push(p);
    });

    z.appendChild(barre);
    panneaux.forEach(function (p) { z.appendChild(p); });
    aller(liste[0].id, false);
    return z;
  }

  function rendre(f, zone) {
    var g = f.guide;
    if (g.reperes) zone.appendChild(reperes(g.reperes));
    if (g.cas) zone.appendChild(cas(g.cas));
    if (g.onglets) zone.appendChild(onglets(f.id, g.onglets));
  }

  // Corps dérivé, une fois la base chargée. Toujours recalculé : un kb.js
  // exporté depuis l'Administration porte une copie du corps qui vieillirait.
  if (window.KB && window.KB.fiches) {
    window.KB.fiches.forEach(function (f) {
      if (f && f.guide) f.corps = texte(f.guide);
    });
  }

  window.FicheGuide = { rendre: rendre, texte: texte };
})();
