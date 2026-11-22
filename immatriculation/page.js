/* Les documents d'immatriculation : la feuille du dossier et l'acte de vente.

   Deux règles tiennent ce fichier court.
   1. Les pièces et les étapes ne sont pas recopiées ici. Elles viennent de
      app/fiches/vehicule.js, la source que lit déjà la fiche du guide : une
      pièce ajoutée à la fiche arrive sur la feuille sans rien toucher ici.
   2. Les saisies restent dans ce navigateur, clé luxguide.acte.v1, comme les
      cases de la fiche et les champs du simulateur. Rien n'est envoyé. */
(function () {
  "use strict";

  var CLE = "luxguide.acte.v1";
  var fiche = (window.FICHES || {}).vehicule;

  function el(t, c, txt) {
    var n = document.createElement(t);
    if (c) n.className = c;
    if (txt != null) n.textContent = txt;
    return n;
  }

  function onglet(id) {
    var o = ((fiche || {}).guide || {}).onglets || [];
    for (var i = 0; i < o.length; i++) if (o[i].id === id) return o[i];
    return null;
  }

  // Le premier bloc de l'onglet qui porte la clé demandée (cocher, etapes).
  function bloc(ong, cle) {
    var b = (ong || {}).blocs || [];
    for (var i = 0; i < b.length; i++) if (b[i] && b[i][cle]) return b[i];
    return null;
  }

  function pieces() {
    var zone = document.getElementById("pieces");
    var b = bloc(onglet("dossier"), "cocher");
    if (!zone || !b) return;
    b.items.forEach(function (it) {
      var li = el("li");
      li.appendChild(el("span", "case"));
      var quoi = el("span", "quoi");
      quoi.appendChild(el("b", null, it.t));
      if (it.d) quoi.appendChild(el("i", null, it.d));
      li.appendChild(quoi);
      zone.appendChild(li);
    });
  }

  function etapes() {
    var zone = document.getElementById("etapes");
    var b = bloc(onglet("etapes"), "etapes");
    if (!zone || !b) return;
    b.etapes.forEach(function (e) {
      var li = el("li");
      li.appendChild(el("b", null, e.t));
      if (e.obtenez) li.appendChild(el("i", null, "Vous obtenez : " + e.obtenez));
      zone.appendChild(li);
    });
  }

  // ---------- Les saisies ----------

  function lire() {
    try { return JSON.parse(localStorage.getItem(CLE) || "{}") || {}; } catch (e) { return {}; }
  }
  function ecrire(v) {
    try { localStorage.setItem(CLE, JSON.stringify(v)); } catch (e) { /* stockage bloqué */ }
  }

  function saisies() {
    var champs = Array.prototype.slice.call(document.querySelectorAll("[data-c]"));
    var etat = lire();

    champs.forEach(function (c) {
      var k = c.getAttribute("data-c");
      if (etat[k] != null) {
        if (c.type === "checkbox") c.checked = !!etat[k];
        else c.value = etat[k];
      }
      c.addEventListener(c.type === "checkbox" ? "change" : "input", function () {
        etat = lire();
        etat[k] = c.type === "checkbox" ? c.checked : c.value;
        if (!etat[k]) delete etat[k];
        ecrire(etat);
      });
    });

    var vider = document.getElementById("vider");
    if (vider) vider.addEventListener("click", function () {
      champs.forEach(function (c) {
        if (c.type === "checkbox") c.checked = false; else c.value = "";
      });
      ecrire({});
    });

    var imprimer = document.getElementById("imprimer");
    if (imprimer) imprimer.addEventListener("click", function () { window.print(); });
  }

  pieces();
  etapes();
  saisies();
})();
