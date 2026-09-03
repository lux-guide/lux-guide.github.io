// Conseil financier : la prevoyance-vieillesse (art. 111bis LIR) et les autres
// leviers deductibles.
//
// REGLE CENTRALE : aucun montant de loi n'est ecrit ailleurs que dans ce
// fichier. Ni dans un ecran, ni dans un gabarit de reponse. Les textes portent
// des marques, {plafond}, {annee}, remplies depuis cette table.
//
// Raison : la reforme du 1er janvier 2026 a fait passer le plafond de 3 200 a
// 4 500 euros. Un montant recopie a trois endroits, ce sont deux endroits qui
// mentent le jour du changement. Un test verifie qu'aucun gabarit ne contient
// le caractere euro.
//
// REGLE DE PORTEE : ce module calcule des plafonds de deduction et l'economie
// d'impot qui en decoule. Il ne chiffre ni le capital de sortie, ni le
// rendement d'un placement, ni le taux d'imposition reel du visiteur.

window.PREVOYANCE = (function () {
  "use strict";

  // ---------- La table fiscale, datee et sourcee ----------

  var TABLE = {
    annee: 2026,
    anneePrecedente: 2025,

    // Prevoyance-vieillesse, article 111bis LIR
    prevoyance: {
      plafond: 4500,
      plafondPrecedent: 3200,
      ageMaxSouscription: 65,      // la veille des 65 ans
      dureeMinimaleAns: 10,
      sortieMin: 60,
      sortieMax: 75,
      source: "https://impotsdirects.public.lu/fr/az/p/prevoyance_vieillesse.html"
    },

    // Les autres leviers. `annuel: false` veut dire ponctuel, et un montant
    // ponctuel ne s'additionne jamais a un montant annuel.
    leviers: [
      { id: "prevoyance", nom: "Prévoyance-vieillesse (111bis)", plafond: 4500, annuel: true,
        condition: "Souscrire avant 65 ans, contrat d'au moins 10 ans, épargne bloquée jusqu'à 60 ans." },
      { id: "primes", nom: "Primes d'assurance (art. 111)", plafond: 672, annuel: true,
        condition: "Primes de responsabilité civile, décès, accident, maladie." },
      { id: "logement", nom: "Épargne-logement", plafond: 672, annuel: true,
        condition: "Contrat d'épargne-logement en cours." },
      { id: "logement_jeune", nom: "Épargne-logement, 18 à 40 ans", plafond: 1344, annuel: true,
        condition: "Le plafond est doublé entre 18 et 40 ans." },
      { id: "pension", nom: "Régime complémentaire de pension", plafond: 1200, annuel: true,
        condition: "Cotisations personnelles à un régime complémentaire d'entreprise." },
      { id: "srd", nom: "Solde restant dû, prime unique", plafond: 6000, annuel: false,
        parEnfant: 1200, majorationParAnAu_dela30: 0.08,
        condition: "Prime unique d'une assurance solde restant dû, à la souscription d'un prêt." }
    ],

    // Interets hypothecaires : le plafond depend de l'anciennete du logement.
    interets: [
      { jusquAn: 5, plafond: 4000 },
      { jusquAn: 10, plafond: 3000 },
      { jusquAn: null, plafond: 2000 }
    ],

    // REGLE : on ne devine jamais le taux du visiteur. On rend une colonne par
    // taux et la personne se situe. Afficher le taux le plus eleve donnerait le
    // chiffre le plus flatteur, et il serait faux pour presque tout le monde.
    taux: [0.20, 0.30, 0.35, 0.42],

    horizonAns: 10,

    bornes: { ageMin: 18, ageMax: 70, enfantsMax: 4 },

    sources: [
      { t: "Administration des contributions directes, prévoyance-vieillesse",
        u: "https://impotsdirects.public.lu/fr/az/p/prevoyance_vieillesse.html" },
      { t: "Guichet.lu, déduire les primes d'un contrat de prévoyance-vieillesse",
        u: "https://guichet.public.lu/fr/citoyens/fiscalite/declaration-impot-decompte/depenses-deductibles/contrat-prevoyance-resident.html" },
      { t: "Gouvernement luxembourgeois, nouveautés 2026",
        u: "https://gouvernement.lu/fr/actualites/toutes_actualites/articles/2025/12-decembre/nouveautes-2026.html" }
    ]
  };

  // ---------- Le calcul ----------

  // Le plafond du solde restant du depend du foyer et de l'age. C'est le seul
  // levier dont le plafond se calcule, les autres sont fixes.
  function plafondSrd(age, enfants) {
    var l = TABLE.leviers.filter(function (x) { return x.id === "srd"; })[0];
    var base = l.plafond + (enfants || 0) * l.parEnfant;
    var sup = Math.max(0, (age || 0) - 30);
    return Math.round(base * (1 + sup * l.majorationParAnAu_dela30));
  }

  function plafondEpargneLogement(age) {
    return (age >= 18 && age <= 40) ? 1344 : 672;
  }

  // L'age auquel on peut reellement recuperer l'epargne. Ce n'est pas toujours
  // l'age legal : le contrat doit aussi avoir dure la duree minimale. Souscrire
  // a 55 ans ne permet donc pas de sortir a 60, mais a 65. C'est la consequence
  // la plus mal comprise du dispositif, et elle se calcule.
  function ageSortieEffectif(age) {
    return Math.max(TABLE.prevoyance.sortieMin, (Number(age) || 0) + TABLE.prevoyance.dureeMinimaleAns);
  }

  // Entree : quatre faits, et pas un de plus.
  //   { age, enfants, pret, imposeLuxembourg }
  // L'age peut ne pas etre connu, et ce n'est pas un cas degrade : c'est
  // l'etat de depart. Un site pour tout le monde ne commence pas par supposer
  // un age, il commence par ce qui vaut pour tout le monde.
  function simuler(e) {
    var age = null;
    if (e.age !== null && e.age !== undefined && e.age !== "") {
      age = Math.max(TABLE.bornes.ageMin, Math.min(TABLE.bornes.ageMax, Number(e.age) || 0));
    }
    var enfants = Math.max(0, Math.min(TABLE.bornes.enfantsMax, Number(e.enfants) || 0));
    var pret = !!e.pret;
    var impose = !!e.imposeLuxembourg;

    var out = {
      entree: { age: age, enfants: enfants, pret: pret, imposeLuxembourg: impose },
      lignes: [], pistes: [], refus: [],
      totalAnnuel: 0, totalPonctuel: 0,
      hypotheses: [], sources: TABLE.sources
    };

    // Le cas qui rend zero est aussi important que les autres. Il rend un refus
    // motive, et l'ecran ne dessine alors aucun graphique.
    if (!impose) {
      out.refus.push("La déduction suppose d'être imposé au Luxembourg. C'est le lieu " +
        "d'imposition qui décide, pas le lieu d'habitation : un frontalier imposé au " +
        "Luxembourg y a droit, un résident imposé ailleurs n'y a pas droit.");
      return out;
    }

    // Prevoyance-vieillesse. Elle ne depend ni de l'age ni du foyer : c'est le
    // seul plafond qui vaut a l'identique pour tout le monde, et c'est donc
    // par lui que la page commence.
    if (age === null || age < TABLE.prevoyance.ageMaxSouscription) {
      out.lignes.push({
        nom: "Prévoyance-vieillesse (111bis)",
        plafond: TABLE.prevoyance.plafond,
        annuel: true,
        calcul: "Plafond légal depuis le 1er janvier " + TABLE.annee + ", par personne et par an.",
        condition: age === null
          ? "Souscription avant " + TABLE.prevoyance.ageMaxSouscription + " ans, contrat d'au " +
            "moins " + TABLE.prevoyance.dureeMinimaleAns + " ans, épargne récupérable entre " +
            TABLE.prevoyance.sortieMin + " et " + TABLE.prevoyance.sortieMax + " ans."
          : "Contrat d'au moins " + TABLE.prevoyance.dureeMinimaleAns + " ans. En " +
            "souscrivant à " + age + " ans, l'épargne ne sera récupérable qu'à partir de " +
            ageSortieEffectif(age) + " ans" +
            (ageSortieEffectif(age) > TABLE.prevoyance.sortieMin
              ? ", et non à " + TABLE.prevoyance.sortieMin + " ans : la durée minimale du contrat repousse l'échéance."
              : "."),
        reserve: "Le montant non versé une année est perdu : il ne se reporte pas sur la suivante."
      });
    } else {
      out.refus.push("La souscription d'un contrat de prévoyance-vieillesse n'est plus " +
        "possible à partir de " + TABLE.prevoyance.ageMaxSouscription + " ans.");
    }

    // Epargne-logement. Son plafond double avant 41 ans : sans age, il n'y a
    // pas de montant a afficher, seulement un montant a calculer. Choisir
    // l'une des deux valeurs reviendrait a supposer un age.
    if (age === null) {
      out.pistes.push({
        nom: "Épargne-logement",
        ordre: "de 672 à 1 344 € par an selon l'âge",
        manque: "votre âge, le plafond doublant avant 41 ans"
      });
    } else {
      var pel = plafondEpargneLogement(age);
      out.lignes.push({
        nom: "Épargne-logement",
        plafond: pel, annuel: true,
        calcul: pel === 1344
          ? "Plafond doublé entre 18 et 40 ans : 672 × 2."
          : "Plafond de base, au-delà de 40 ans.",
        condition: "Contrat d'épargne-logement en cours.",
        reserve: null
      });
    }

    // Primes d'assurance
    out.lignes.push({
      nom: "Primes d'assurance (art. 111)",
      plafond: 672, annuel: true,
      calcul: "Plafond légal par personne et par an.",
      condition: "Primes de responsabilité civile, décès, accident, maladie.",
      reserve: null
    });

    // Solde restant du : ponctuel, et seulement avec un pret. Son plafond
    // depend de l'age et du nombre d'enfants : sans age, rien a calculer.
    if (pret && age === null) {
      out.pistes.push({
        nom: "Solde restant dû, prime unique",
        ordre: "6 000 € de base, majorés par enfant et par année au-delà de 30 ans",
        manque: "votre âge"
      });
    }
    if (pret && age !== null) {
      var srd = plafondSrd(age, enfants);
      var maj = Math.max(0, age - 30);
      out.lignes.push({
        nom: "Solde restant dû, prime unique",
        plafond: srd, annuel: false,
        calcul: "6 000 de base" + (enfants ? " + " + enfants + " × 1 200 par enfant" : "") +
          (maj ? " puis + 8 % par année au-delà de 30 ans, soit " + maj + " années" : ""),
        condition: "Prime unique versée à la souscription du prêt.",
        reserve: "Ce montant est ponctuel : il ne se déduit pas chaque année."
      });
      out.pistes.push({
        nom: "Intérêts hypothécaires",
        ordre: "de 2 000 à 4 000 € par an selon l'ancienneté du logement",
        manque: "l'année d'occupation du logement, qui décide du plafond applicable"
      });
    }

    out.pistes.push({
      nom: "Régime complémentaire de pension",
      ordre: "jusqu'à 1 200 € par an",
      manque: "savoir si l'employeur propose un régime et si vous y cotisez à titre personnel"
    });

    out.lignes.forEach(function (l) {
      if (l.annuel) out.totalAnnuel += l.plafond;
      else out.totalPonctuel += l.plafond;
    });

    // DEUX TOTAUX SEPARES, JAMAIS ADDITIONNES. Un premier jet additionnait
    // l'annuel et le ponctuel : le nombre etait exact et aucune phrase juste ne
    // l'accompagnait, personne ne deduit cela dans une annee.
    out.economieAnnuelleParTaux = {};
    out.economiePonctuelleParTaux = {};
    out.effortAnnuelParTaux = {};
    out.serieCumulParTaux = {};
    TABLE.taux.forEach(function (t) {
      var k = String(Math.round(t * 100));
      out.economieAnnuelleParTaux[k] = Math.round(out.totalAnnuel * t);
      out.economiePonctuelleParTaux[k] = Math.round(out.totalPonctuel * t);
      out.effortAnnuelParTaux[k] = out.totalAnnuel - Math.round(out.totalAnnuel * t);
      var serie = [], cumul = 0;
      for (var a = 1; a <= TABLE.horizonAns; a++) {
        cumul += Math.round(out.totalAnnuel * t);
        serie.push(cumul);
      }
      out.serieCumulParTaux[k] = serie;
    });

    out.hypotheses.push("Les plafonds sont supposés utilisés en totalité.");
    out.hypotheses.push("Le calcul suppose une déclaration individuelle. Un couple " +
      "déclarant ensemble compte le plafond de prévoyance-vieillesse deux fois.");
    out.hypotheses.push("Aucun rendement n'est supposé : le capital que vous " +
      "récupérerez n'est pas chiffré ici.");

    return out;
  }


  return {
    table: TABLE,
    simuler: simuler,
    plafondSrd: plafondSrd,
    plafondEpargneLogement: plafondEpargneLogement,
    ageSortieEffectif: ageSortieEffectif
  };
})();
