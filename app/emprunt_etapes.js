/* Capacité d'emprunt : le parcours en étapes.

   Le calcul et le rendu du résultat restent dans ui.js (majEmprunt), qui lit
   les champs par leur id. Ce module ne fait que ranger : il montre une étape à
   la fois, écrit la frise et les boutons, et résume sous chaque étape ce qui y
   est saisi, pour qu'on sache où l'on en est sans rouvrir l'étape.

   Les étapes ne sont pas déclarées ici. Ce sont les sections .emp-etape de
   index.html, dans l'ordre, avec data-etape (leur clé) et data-titre (leur
   nom dans la frise). Seuls les résumés ci-dessous connaissent les champs.

   L'étape ouverte se garde dans le navigateur, clé luxguide.emprunt.etape.v1,
   comme les montants : qui revient retrouve son résultat, pas la première
   question. */
(function () {
  "use strict";

  var racine = document.getElementById("sim-emprunt");
  var frise = document.getElementById("emp-frise");
  var nav = document.getElementById("emp-nav");
  if (!racine || !frise || !nav) return;

  var CLE = "luxguide.emprunt.etape.v1";
  var etapes = Array.prototype.slice.call(racine.querySelectorAll(".emp-etape"));
  var courant = 0;
  var dernierPrix = 0;

  function el(t, c, txt) {
    var n = document.createElement(t);
    if (c) n.className = c;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function val(id) {
    var c = document.getElementById(id);
    return c ? Math.max(0, Number(c.value) || 0) : 0;
  }
  function eur(n) { return Math.round(n).toLocaleString("fr-FR") + " €"; }

  // ---------- Ce que chaque étape résume ----------

  var RESUMES = {
    emprunteurs: function () {
      var deux = document.getElementById("e-acquereurs").value === "2";
      var net = val("e-net1") + (deux ? val("e-net2") : 0);
      return (deux ? "À deux" : "Seul") + ", " + eur(net) + " net";
    },
    revenus: function () {
      var plus = val("e-loyers") + val("e-variables") + val("e-autres");
      var moins = val("e-charges") + val("e-charges2");
      if (plus > 0 && moins > 0) return "+ " + eur(plus) + ", " + eur(moins) + " de charges";
      if (plus > 0) return "+ " + eur(plus) + " de revenus";
      if (moins > 0) return eur(moins) + " de charges";
      return "Ni autre revenu, ni charge";
    },
    projet: function () {
      var quoi = { primo: "Premier logement", autre: "Déjà propriétaire", locatif: "Locatif" };
      var s = document.getElementById("e-situation").value;
      // L'apport se lit dans l'étape : ici, ce qui tient sur une ligne.
      return (quoi[s] || "") + ", " + String(val("e-taux")).replace(".", ",") + " % sur " + val("e-duree") + " ans";
    },
    resultat: function () {
      return dernierPrix > 0 ? "Prix possible : " + eur(dernierPrix) : "";
    }
  };

  // ---------- L'unité dans le champ ----------
  // « 5000 » ne dit pas si c'est par mois ou par an. L'unité s'écrit dans le
  // champ, à droite, et l'intitulé n'a plus à la porter entre parenthèses.
  var UNITES = {
    "e-net1": "€ par mois", "e-net2": "€ par mois", "e-age1": "ans", "e-age2": "ans",
    "e-loyers": "€ par mois", "e-variables": "€ par mois", "e-autres": "€ par mois",
    "e-charges": "€ par mois", "e-reste": "mois", "e-charges2": "€ par mois",
    "e-apport": "€", "e-taux": "%", "e-duree": "ans"
  };
  Object.keys(UNITES).forEach(function (id) {
    var c = document.getElementById(id);
    if (!c || c.parentNode.classList.contains("champ-unite")) return;
    var cadre = el("span", "champ-unite");
    c.parentNode.insertBefore(cadre, c);
    cadre.appendChild(c);
    cadre.appendChild(el("span", "unite", UNITES[id]));
    cadre.style.setProperty("--n", String(UNITES[id].length));
  });

  // ---------- La frise et les boutons ----------

  var puces = etapes.map(function (s, i) {
    var li = el("li");
    var b = el("button", "emp-pas");
    b.type = "button";
    b.appendChild(el("span", "emp-num", String(i + 1)));
    var txt = el("span", "emp-txt");
    txt.appendChild(el("b", null, s.getAttribute("data-titre")));
    txt.appendChild(el("i"));
    b.appendChild(txt);
    b.addEventListener("click", function () { aller(i, true); });
    li.appendChild(b);
    frise.appendChild(li);
    return b;
  });

  var avant = el("button", "btn ghost");
  avant.type = "button";
  var apres = el("button", "btn");
  apres.type = "button";
  avant.addEventListener("click", function () { aller(courant - 1, true); });
  apres.addEventListener("click", function () { aller(courant + 1, true); });
  nav.appendChild(avant);
  nav.appendChild(apres);

  function resumer() {
    etapes.forEach(function (s, i) {
      var f = RESUMES[s.getAttribute("data-etape")];
      puces[i].querySelector("i").textContent = f ? f() : "";
    });
  }

  function aller(i, parGeste) {
    courant = Math.max(0, Math.min(etapes.length - 1, i));
    etapes.forEach(function (s, k) { s.hidden = k !== courant; });
    puces.forEach(function (b, k) {
      b.classList.toggle("actif", k === courant);
      b.classList.toggle("fait", k < courant);
      if (k === courant) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
    avant.hidden = courant === 0;
    apres.hidden = courant === etapes.length - 1;
    if (courant > 0) avant.textContent = "Revenir à : " + etapes[courant - 1].getAttribute("data-titre");
    if (courant < etapes.length - 1) {
      var suivante = etapes[courant + 1];
      apres.textContent = suivante.getAttribute("data-etape") === "resultat"
        ? "Voir le détail du résultat" : "Continuer : " + suivante.getAttribute("data-titre");
    }
    try { localStorage.setItem(CLE, etapes[courant].getAttribute("data-etape")); } catch (e) { /* stockage bloqué */ }
    // Un geste ramène la frise en haut de l'écran : l'étape suivante se lit
    // depuis son début, pas depuis l'endroit où était le bouton.
    if (parGeste && frise.getBoundingClientRect().top < 0) frise.scrollIntoView({ block: "start" });
  }

  // ui.js envoie le plan à chaque calcul : c'est le moment de relire les
  // résumés, le prix compris.
  document.addEventListener("emprunt:plan", function (e) {
    dernierPrix = e.detail.plan.prix || 0;
    resumer();
  });
  racine.addEventListener("input", resumer);
  racine.addEventListener("change", resumer);

  var garde = null;
  try { garde = localStorage.getItem(CLE); } catch (e) { /* stockage bloqué */ }
  var depart = 0;
  etapes.forEach(function (s, i) { if (s.getAttribute("data-etape") === garde) depart = i; });
  aller(depart, false);
  resumer();
})();
