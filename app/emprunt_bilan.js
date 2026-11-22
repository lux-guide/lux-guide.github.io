/* Capacité d'emprunt : le panneau de résultat.

   ui.js calcule le plan à chaque saisie et l'envoie par l'événement
   « emprunt:plan ». Ce module le dessine, et ne calcule rien.

   Le panneau montre ce qu'est un achat, pas seulement ce qu'il vaut. Deux
   barres à la même échelle, l'une sous l'autre : ce que l'achat coûte, le prix
   et les frais d'acte ; qui le paie, les fonds propres et le prêt. Elles ont
   la même longueur parce que les deux sommes sont égales, et c'est ce qu'on
   comprend le moins vite dans un tableau : les frais se paient en plus du
   prix, et jamais avec le prêt.

   Dessous, la mensualité sur une jauge des revenus que la banque retient :
   les charges déjà en cours, la nouvelle mensualité, et le trait où la banque
   s'arrête. */
(function () {
  "use strict";

  var zone = document.getElementById("e-bilan");
  if (!zone) return;

  function el(t, c, txt) {
    var n = document.createElement(t);
    if (c) n.className = c;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function eur(n) { return Math.round(n).toLocaleString("fr-FR") + " €"; }
  function pct(x) { return Math.round(x * 100) + " %"; }

  // Une barre faite de segments proportionnels. Un segment trop mince pour
  // se voir garde une largeur minimale : il existe, il doit se lire.
  function barre(segments) {
    var b = el("div", "bil-barre");
    var total = segments.reduce(function (a, s) { return a + Math.max(0, s.v); }, 0);
    segments.forEach(function (s) {
      if (s.v <= 0 || total <= 0) return;
      var d = el("span", "bil-seg " + s.c);
      d.style.flexGrow = String(s.v / total);
      b.appendChild(d);
    });
    return b;
  }

  function legende(segments) {
    var dl = el("dl", "bil-legende");
    segments.forEach(function (s) {
      var dt = el("dt");
      dt.appendChild(el("span", "bil-pastille " + s.c));
      dt.appendChild(document.createTextNode(s.l));
      dl.appendChild(dt);
      dl.appendChild(el("dd", null, eur(s.v)));
    });
    return dl;
  }

  function bloc(titre, segments) {
    var d = el("div", "bil-bloc");
    d.appendChild(el("p", "bil-titre", titre));
    d.appendChild(barre(segments));
    d.appendChild(legende(segments));
    return d;
  }

  var LIMITE = {
    effort: "C'est le revenu qui fixe ce prix : la mensualité est au plus haut que la banque accepte.",
    quotite: "C'est l'apport qui fixe ce prix : le prêt ne peut pas couvrir une plus grande part du logement.",
    apport: "Sans fonds propres, les frais d'acte ne peuvent pas être payés : aucun achat n'est possible."
  };

  function dessiner(o, plan) {
    zone.innerHTML = "";

    if (!(plan.prix > 0)) {
      zone.appendChild(el("p", "bil-nom", "Prix d'achat possible"));
      zone.appendChild(el("p", "bil-vide", o.netMensuel > 0
        ? (plan.mensualiteMax > 0 ? LIMITE.apport
           : "Les charges en cours prennent déjà toute la part des revenus qu'une banque accepte.")
        : "Saisissez un salaire net pour voir un prix."));
      return;
    }

    zone.appendChild(el("p", "bil-nom", "Prix d'achat possible"));
    zone.appendChild(el("p", "bil-prix", eur(plan.prix)));
    zone.appendChild(el("p", "bil-pourquoi", LIMITE[plan.limite] || ""));

    var frais = plan.frais ? plan.frais.total : 0;
    zone.appendChild(bloc("Ce que l'achat coûte", [
      { l: "Prix du logement", v: plan.prix, c: "prix" },
      { l: "Frais d'acte", v: frais, c: "frais" }
    ]));
    zone.appendChild(bloc("Qui le paie", [
      { l: "Fonds propres", v: plan.apport, c: "apport" },
      { l: "Prêt, " + String(Math.round(plan.taux * 1000) / 10).replace(".", ",") + " % sur " + plan.annees + " ans", v: plan.emprunt, c: "pret" }
    ]));

    // La mensualité, sur l'échelle des revenus que la banque retient. Sa ligne
    // sert de titre au bloc : « Chaque mois » au-dessus disait deux fois la
    // même chose, et le panneau doit tenir dans un écran de 637 px.
    var m = el("div", "bil-bloc bil-mois");
    var ligne = el("p", "bil-mensualite");
    ligne.appendChild(el("strong", null, eur(plan.mensualite)));
    ligne.appendChild(document.createTextNode(" de mensualité par mois"));
    m.appendChild(ligne);

    var net = plan.net || o.netMensuel || 0;
    var segments = [
      { l: "Charges déjà en cours", v: plan.charges, c: "charges" },
      { l: "Nouvelle mensualité", v: plan.mensualite, c: "pret" },
      { l: "Reste à vivre", v: Math.max(0, plan.resteAVivre), c: "reste" }
    ];
    // L'échelle est celle des revenus retenus : le reste de la barre est ce
    // que la banque laisse, pas le reste à vivre réel, qui compte tout le revenu.
    var jauge = barre([
      segments[0], segments[1],
      { v: Math.max(0, net - plan.charges - plan.mensualite), c: "reste" }
    ]);
    jauge.className += " bil-jauge";
    if (net > 0) {
      var trait = el("span", "bil-trait");
      trait.style.left = Math.min(100, plan.effort * 100) + "%";
      trait.title = "La banque s'arrête à " + pct(plan.effort) + " des revenus retenus";
      jauge.appendChild(trait);
    }
    m.appendChild(jauge);
    m.appendChild(legende(segments.filter(function (s, i) { return i !== 1 && (i === 2 || s.v > 0); })));
    var part = net > 0 ? (plan.charges + plan.mensualite) / net : 0;
    var note = pct(part) + " des " + eur(net) + " que la banque retient. Sa limite, le trait : " + pct(plan.effort) + ".";
    if (plan.capital - plan.emprunt > 1) note += " Le revenu permettrait d'emprunter " + eur(plan.capital) + ".";
    m.appendChild(el("p", "bil-note", note));
    zone.appendChild(m);
  }

  document.addEventListener("emprunt:plan", function (e) { dessiner(e.detail.o, e.detail.plan); });
})();
