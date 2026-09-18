// Simulateur de salaire net luxembourgeois.
// Bareme officiel ACD 2025 (voir bareme.js), toujours en vigueur en 2026 : l'ACD
// n'a pas publie de bareme 2026. Parametres sociaux 2026, credits d'impot 2026.
// Resultat indicatif : il ne remplace pas une fiche de paie ni un calcul de l'ACD.

window.SIM = (function () {
  // Parametres sociaux. Modifiables depuis l'onglet Administration.
  // Sources : parametres sociaux IGSS valables au 01.06.2026 (indice 992,24),
  // salaire social minimum non qualifie 2 771,33 EUR par mois, maximum cotisable
  // 13 856,63 EUR par mois, abattement dependance 692,83 EUR par mois.
  // Taux de cotisation : loi du 18.12.2025 portant reforme des pensions.
  var P = {
    ssmAnnuel: 33255.96,       // 2 771,33 x 12
    plafondFacteur: 5,         // plafond cotisable = 5 x SSM
    tauxPension: 0.085,        // 8,50 % depuis le 01.01.2026 (contre 8,00 % avant)
    tauxMaladieNature: 0.028,
    tauxMaladieEspeces: 0.0025,
    tauxDependance: 0.014,     // sans plafond, apres abattement d'un quart de SSM
    fondsEmploi: 0.07,         // 9 % au-dela des seuils ci-dessous
    fondsEmploiTaux2: 0.09,
    seuilFondsClasse1: 150000,
    seuilFondsClasse2: 300000,
    impatrieTaux: 0.50,        // 50 % du brut exonere
    impatriePlafond: 400000,   // remuneration eligible plafonnee
    fraisObtention: 540,       // forfait annuel
    depensesSpeciales: 480,    // forfait annuel

    // Credits d'impot portes sur la fiche de paie par l'employeur. Ils sont
    // restituables : ils s'ajoutent au net meme quand l'impot est nul. Sans
    // eux, le net affiche etait trop bas, jusqu'a 200 EUR par mois pour un
    // salaire modeste. Sources : ACD, CIS et CI-CO2 salarie a partir de
    // l'annee d'imposition 2026 ; CISSM, exemples de calcul du 11.02.2025 ;
    // CIM a partir de l'annee d'imposition 2025.
    cisMin: 936,               // en dessous, aucun credit
    cisBas: 300,               // de 936 a 11 265 : 300 + (brut - 936) x 0,029
    cisTauxBas: 0.029,
    cisSeuil1: 11265,
    cisPlein: 600,             // de 11 266 a 40 000 : 600 par an
    cisSeuil2: 40000,
    cisTauxHaut: 0.015,        // de 40 001 a 79 999 : 600 - (brut - 40 000) x 0,015
    cisFin: 80000,             // a partir de 80 000 : rien
    cico2Plein: 216,           // jusqu'a 40 000 : 216 par an
    cico2Taux: 0.0054,         // de 40 001 a 79 999 : 216 - (brut - 40 000) x 0,0054
    cissmMensuel: 81,          // brut mensuel de 1 800 a 3 000 : 81 par mois
    cissmBas: 1800,
    cissmPalier: 3000,
    cissmHaut: 3600,           // de 3 000 a 3 600 : 81/600 x (3 600 - brut mensuel)
    cimPlein: 3504,            // revenu imposable ajuste jusqu'a 60 000 : 3 504 par an
    cimSeuil1: 60000,
    cimSeuil2: 105000,         // au-dela : 750 par an
    cimTaux: 0.0612,           // entre les deux : 3 504 - (revenu - 60 000) x 0,0612
    cimMin: 750,

    // Achat d'un logement. Sources : pfi.public.lu (droits d'enregistrement
    // 6 % et de transcription 1 %, credit d'impot Bellegen Akt de 40 000 EUR
    // par acquereur, loi du 3 juillet 2025), bareme des honoraires des
    // notaires (tarif 7, vente de gre a gre), reglement CSSF 20-08 (quotites),
    // guichet.lu (subvention d'interet, TVA logement), communique du
    // gouvernement du 16 juillet 2026 (plafonds de la subvention d'interet).
    droitsEnregistrement: 0.06,
    droitsTranscription: 0.01,
    bellegenAkt: 40000,        // par acquereur ; 45 000 annonces pour les actes depuis le 16.07.2026, loi a voter
    droitsMinimum: 100,        // percu meme quand le credit couvre tout
    hypoObligation: 0.0024,    // droit d'obligation sur le capital emprunte
    hypoInscription: 0.0005,   // inscription hypothecaire
    tvaHonoraires: 0.17,
    quotitePrimo: 1.00,        // CSSF 20-08 : primo-accedant, residence principale
    quotiteAutre: 0.90,        // autre residence principale
    quotiteLocatif: 0.80,      // investissement locatif
    subvPlafondPret: 250000,   // subvention d'interet : pret pris en compte
    subvPlafondPretJeune: 300000, // acquereurs de 35 ans ou moins
    subvMajorationEnfant: 30000,
    tvaLogementPlafond: 50000  // faveur fiscale maximale par logement
  };

  // Honoraires du notaire, bareme par tranches, hors debours, TVA comprise.
  var BAREME_NOTAIRE = [
    [3718.40, 0.04], [7436.80, 0.02], [17352.54, 0.015], [24789.35, 0.008],
    [74368.05, 0.006], [148736.11, 0.005], [247893.52, 0.003],
    [1239467.62, 0.001], [Infinity, 0.0005]
  ];

  function params() { return P; }
  function setParams(patch) { Object.assign(P, patch); }

  // Impot brut selon le bareme officiel : taux x revenu - deduction.
  function impotBareme(revenuImposable, classe) {
    var table = window.BAREME_2025[classe];
    if (!table) throw new Error("Classe inconnue : " + classe);
    var R = Math.max(0, revenuImposable);
    for (var i = 0; i < table.length; i++) {
      var inf = table[i][0], sup = table[i][1], taux = table[i][2], ded = table[i][3];
      if (sup === null || R <= sup) return Math.max(0, taux * R - ded);
    }
    var last = table[table.length - 1];
    return Math.max(0, last[2] * R - last[3]);
  }

  // Contribution au fonds pour l'emploi : 7 % de l'impot, et 9 % pour la
  // seule tranche de revenu qui depasse 150 000 EUR (classes 1 et 1a) ou
  // 300 000 EUR (classe 2). Le 9 % ne s'applique donc pas a tout l'impot :
  // la contribution vaut 7 % de l'impot du au seuil, plus 9 % de l'impot
  // au-dela. C'est la formule du recueil officiel des baremes (0,09 x I
  // moins une constante egale a 2 % de l'impot au seuil). Elle etait
  // appliquee a tout l'impot, soit environ 80 EUR par mois de trop pour
  // un salaire au-dessus du seuil. Verifie contre le simulateur BDO.
  function fondsEmploi(impot, imposable, classe) {
    var seuil = (classe === "classe2") ? P.seuilFondsClasse2 : P.seuilFondsClasse1;
    if (imposable <= seuil) {
      return { montant: impot * P.fondsEmploi, taux: P.fondsEmploi, majore: false };
    }
    var impotSeuil = impotBareme(seuil, classe);
    var montant = impotSeuil * P.fondsEmploi + (impot - impotSeuil) * P.fondsEmploiTaux2;
    return { montant: montant, taux: impot > 0 ? montant / impot : P.fondsEmploi, majore: true };
  }

  // ---------- Credits d'impot ----------

  // Credit d'impot pour salaries, sur le salaire brut annuel.
  function creditSalarie(brut) {
    if (brut < P.cisMin) return 0;
    if (brut <= P.cisSeuil1) return P.cisBas + (brut - P.cisMin) * P.cisTauxBas;
    if (brut <= P.cisSeuil2) return P.cisPlein;
    if (brut < P.cisFin) return Math.max(0, P.cisPlein - (brut - P.cisSeuil2) * P.cisTauxHaut);
    return 0;
  }

  // Credit d'impot CO2 du salarie, memes bornes que le CIS.
  function creditCO2(brut) {
    if (brut < P.cisMin) return 0;
    if (brut <= P.cisSeuil2) return P.cico2Plein;
    if (brut < P.cisFin) return Math.max(0, P.cico2Plein - (brut - P.cisSeuil2) * P.cico2Taux);
    return 0;
  }

  // Credit d'impot salaire social minimum, calcule mois par mois sur le brut
  // mensuel d'un temps plein.
  function creditSSM(brutMensuel) {
    if (brutMensuel < P.cissmBas || brutMensuel >= P.cissmHaut) return 0;
    if (brutMensuel <= P.cissmPalier) return P.cissmMensuel;
    return P.cissmMensuel / (P.cissmHaut - P.cissmPalier) * (P.cissmHaut - brutMensuel);
  }

  // Credit d'impot monoparental, sur le revenu imposable ajuste. Il est reduit
  // de la moitie des allocations percues pour l'enfant au-dela de 2 712 EUR
  // par an ; cette reduction depend de la situation et n'est pas modelisee.
  function creditMonoparental(imposable) {
    if (imposable <= P.cimSeuil1) return P.cimPlein;
    if (imposable <= P.cimSeuil2) {
      return Math.max(P.cimMin, P.cimPlein - (imposable - P.cimSeuil1) * P.cimTaux);
    }
    return P.cimMin;
  }

  // opts : { brut, classe: 'classe1'|'classe1a'|'classe2', impatrie: bool,
  //          mois: 12|13, forfaits: bool, monoparental: bool }
  function calcul(opts) {
    var brut = Math.max(0, Number(opts.brut) || 0);
    var classe = opts.classe || "classe1";
    var mois = Number(opts.mois) || 12;
    var forfaits = opts.forfaits !== false;

    var plafond = P.ssmAnnuel * P.plafondFacteur;
    var assietteePlafonnee = Math.min(brut, plafond);

    var tauxCotis = P.tauxPension + P.tauxMaladieNature + P.tauxMaladieEspeces;
    var cotisations = tauxCotis * assietteePlafonnee;
    var abattementDep = P.ssmAnnuel / 4;
    var dependance = P.tauxDependance * Math.max(0, brut - abattementDep);

    // La contribution dependance n'est pas deductible : l'impot se calcule sur
    // le brut moins les seules cotisations maladie et pension (le semi-net),
    // et la dependance se retranche ensuite du net, comme sur une fiche de
    // paie. Elle etait deduite avant l'impot, ce qui gonflait le net de
    // 20 a 60 EUR par mois selon le salaire. Source : ACD, calcul d'une
    // remuneration mensuelle nette ; verifie contre le simulateur BDO.
    var semiNet = brut - cotisations;
    var netAvantImpot = semiNet - dependance;

    // Exoneration impatrie : 50 % du brut, dans la limite de la remuneration eligible.
    var exoneration = 0;
    if (opts.impatrie) {
      exoneration = P.impatrieTaux * Math.min(brut, P.impatriePlafond);
    }

    var imposable = semiNet - exoneration;
    if (forfaits) imposable -= (P.fraisObtention + P.depensesSpeciales);
    imposable = Math.max(0, imposable);

    var impot = impotBareme(imposable, classe);
    var fondsRes = fondsEmploi(impot, imposable, classe);
    var fonds = fondsRes.montant;
    var impotTotal = impot + fonds;

    // Les credits s'imputent sur l'impot, fonds pour l'emploi compris, et le
    // surplus est verse : ils s'ajoutent donc au net tels quels. Le CISSM
    // suit le salaire mensuel courant ; un treizieme mois est une remuneration
    // non periodique, il n'en porte pas.
    var cis = creditSalarie(brut);
    var cico2 = creditCO2(brut);
    var cissm = 12 * creditSSM(brut / mois);
    var cim = opts.monoparental ? creditMonoparental(imposable) : 0;
    var credits = cis + cico2 + cissm + cim;

    var netAnnuel = netAvantImpot - impotTotal + credits;

    return {
      brut: brut,
      cotisations: cotisations,
      tauxCotisations: tauxCotis,
      dependance: dependance,
      semiNet: semiNet,
      netAvantImpot: netAvantImpot,
      exoneration: exoneration,
      imposable: imposable,
      impot: impot,
      fondsEmploi: fonds,
      tauxFondsEmploi: fondsRes.taux,
      fondsMajore: fondsRes.majore,
      impotTotal: impotTotal,
      cis: cis,
      cico2: cico2,
      cissm: cissm,
      cim: cim,
      credits: credits,
      netAnnuel: netAnnuel,
      netMensuel: netAnnuel / mois,
      mois: mois,
      tauxPrelevementGlobal: brut > 0 ? (brut - netAnnuel) / brut : 0
    };
  }

  // Taux fixes portés sur une fiche de retenue additionnelle, c'est-à-dire
  // sur le second salaire d'un ménage imposé collectivement, ou sur un second
  // emploi. Ils ne dépendent que de la classe d'impôt, jamais du revenu réel.
  // Ce sont des maxima : un taux réduit peut être demandé à l'administration.
  // Source : ACD, taux de retenue fixe inscrit sur la fiche additionnelle.
  var TAUX_FICHE_ADDITIONNELLE = { classe1: 0.33, classe1a: 0.21, classe2: 0.15 };

  // Ménage à deux salaires imposé collectivement.
  // Deux vues, qui ne donnent pas le même chiffre, et c'est normal :
  //   1. retenue : ce qui est prélevé chaque mois, barème sur le salaire
  //      principal et taux fixe sur le second ;
  //   2. regularisation : ce que le ménage doit réellement, barème de classe 2
  //      applique au revenu imposable cumulé, comme à la déclaration annuelle.
  function menage(opts) {
    var b1 = Math.max(0, Number(opts.brut1) || 0);
    var b2 = Math.max(0, Number(opts.brut2) || 0);
    var mois = Number(opts.mois) || 12;
    var classe = opts.classe || "classe2";
    var forfaits = opts.forfaits !== false;

    // Le salaire le plus élevé porte la fiche principale, par usage.
    var principal = Math.max(b1, b2);
    var secondaire = Math.min(b1, b2);

    var rP = calcul({ brut: principal, classe: classe, mois: mois, impatrie: opts.impatrie1, forfaits: forfaits });
    // Le second salaire subit les cotisations, puis un taux fixe, sans barème.
    var rS = calcul({ brut: secondaire, classe: classe, mois: mois, forfaits: false });
    var tauxFixe = TAUX_FICHE_ADDITIONNELLE[classe] || 0.15;
    // Le taux fixe s'applique au semi-net, la dependance n'est pas deductible.
    var impotSecondaire = rS.semiNet * tauxFixe;

    var retenueTotale = rP.impotTotal + impotSecondaire;
    var netAvantImpotMenage = rP.netAvantImpot + rS.netAvantImpot;
    // Chaque conjoint touche ses propres credits, sur son propre salaire.
    var creditsMenage = rP.credits + rS.credits;
    var netRetenue = netAvantImpotMenage - retenueTotale + creditsMenage;
    var netPrincipal = rP.netAvantImpot - rP.impotTotal + rP.credits;
    var netSecondaire = rS.netAvantImpot - impotSecondaire + rS.credits;

    // Régularisation annuelle : barème appliqué au revenu imposable cumulé.
    var imposableCumule = Math.max(0, rP.imposable + rS.semiNet - (forfaits ? (P.fraisObtention + P.depensesSpeciales) : 0));
    var impotAssiette = impotBareme(imposableCumule, classe);
    var impotAssietteTotal = impotAssiette + fondsEmploi(impotAssiette, imposableCumule, classe).montant;
    var netReel = netAvantImpotMenage - impotAssietteTotal + creditsMenage;

    return {
      brutPrincipal: principal,
      brutSecondaire: secondaire,
      brutMenage: principal + secondaire,
      cotisations: rP.cotisations + rP.dependance + rS.cotisations + rS.dependance,
      netAvantImpot: netAvantImpotMenage,
      tauxFixeSecondaire: tauxFixe,
      impotPrincipal: rP.impotTotal,
      impotSecondaire: impotSecondaire,
      credits: creditsMenage,
      retenueTotale: retenueTotale,
      netRetenue: netRetenue,
      netMensuelRetenue: netRetenue / mois,
      netMensuelPrincipal: netPrincipal / mois,
      netMensuelSecondaire: netSecondaire / mois,
      imposableCumule: imposableCumule,
      impotAssiette: impotAssietteTotal,
      netReel: netReel,
      netMensuelReel: netReel / mois,
      // Positif : le ménage devra un solde. Négatif : il sera remboursé.
      solde: impotAssietteTotal - retenueTotale,
      mois: mois
    };
  }

  // Comparaison des trois situations les plus utiles.
  // Les trois classes, chacune avec et sans le regime des impatries. La version
  // precedente ne montrait le regime que sur la classe 2, alors que le profil
  // le plus frequent a l'arrivee est un celibataire en classe 1 : il ne voyait
  // pas ce que le regime lui apporterait.
  function comparatif(brut, mois) {
    var out = [];
    [["Classe 1", "classe1"], ["Classe 1a", "classe1a"], ["Classe 2", "classe2"]]
      .forEach(function (c) {
        out.push({
          label: c[0], classe: c[1],
          res: calcul({ brut: brut, classe: c[1], mois: mois }),
          resImpatrie: calcul({ brut: brut, classe: c[1], mois: mois, impatrie: true })
        });
      });
    return out;
  }

  function honorairesNotaire(montant) {
    var h = 0, bas = 0;
    for (var i = 0; i < BAREME_NOTAIRE.length && montant > bas; i++) {
      var haut = BAREME_NOTAIRE[i][0];
      h += (Math.min(montant, haut) - bas) * BAREME_NOTAIRE[i][1];
      bas = haut;
    }
    return Math.max(h, 99.16) * (1 + P.tvaHonoraires);
  }

  // Frais d'acquisition : droits, credit d'impot, notaire, acte de pret.
  // opts : { prix, emprunt, acquereurs, sansAkt }
  function fraisAcquisition(opts) {
    var prix = Math.max(0, Number(opts.prix) || 0);
    var emprunt = Math.max(0, Number(opts.emprunt) || 0);
    var n = Math.max(1, Number(opts.acquereurs) || 1);
    var droitsBruts = prix * (P.droitsEnregistrement + P.droitsTranscription);
    // Le credit d'impot ne vaut que pour l'habitation personnelle.
    var akt = opts.sansAkt ? 0 : Math.min(droitsBruts, P.bellegenAkt * n);
    var droits = prix > 0 ? Math.max(droitsBruts - akt, P.droitsMinimum) : 0;
    var notaireVente = prix > 0 ? honorairesNotaire(prix) : 0;
    var hypotheque = emprunt * (P.hypoObligation + P.hypoInscription);
    var notairePret = emprunt > 0 ? honorairesNotaire(emprunt) : 0;
    return {
      droitsBruts: droitsBruts, akt: akt, droits: droits,
      notaireVente: notaireVente, hypotheque: hypotheque, notairePret: notairePret,
      actePret: hypotheque + notairePret,
      total: droits + notaireVente + hypotheque + notairePret
    };
  }

  // Plan de financement : du net mensuel au prix d'achat maximal, frais
  // compris, sous la double contrainte de l'effort et de la quotite.
  // opts : { netMensuel, chargesMensuelles, tauxAnnuel, annees, effort,
  //          apport, quotite, acquereurs }
  function planFinancement(opts) {
    var net = Math.max(0, Number(opts.netMensuel) || 0);
    var charges = Math.max(0, Number(opts.chargesMensuelles) || 0);
    var taux = Number(opts.tauxAnnuel) || 0;
    var annees = Number(opts.annees) || 25;
    var effort = Number(opts.effort) || 0.40;
    var apport = Math.max(0, Number(opts.apport) || 0);
    var quotite = Number(opts.quotite) || 1;
    var n = Math.max(1, Number(opts.acquereurs) || 1);
    var sansAkt = !!opts.sansAkt;
    var revenusReels = Number(opts.revenusReels) || net;

    var cap = capaciteEmprunt({ netMensuel: net, chargesMensuelles: charges,
                                tauxAnnuel: taux, annees: annees, effort: effort });
    var capital = Math.max(0, cap.capital || 0);

    function possible(prix) {
      var e = Math.min(capital, quotite * prix);
      return e + apport >= prix + fraisAcquisition({ prix: prix, emprunt: e, acquereurs: n, sansAkt: sansAkt }).total;
    }
    var bas = 0, haut = capital + apport + 1;
    for (var i = 0; i < 60; i++) {
      var mid = (bas + haut) / 2;
      if (possible(mid)) bas = mid; else haut = mid;
    }
    var prix = bas < 1000 ? 0 : bas;
    var frais = fraisAcquisition({ prix: prix, emprunt: Math.min(capital, quotite * prix), acquereurs: n, sansAkt: sansAkt });
    var emprunt = Math.max(0, Math.min(capital, quotite * prix, prix + frais.total - apport));
    frais = fraisAcquisition({ prix: prix, emprunt: emprunt, acquereurs: n, sansAkt: sansAkt });

    var limite = "effort";
    if (prix > 0 && emprunt < capital - 1) limite = apport > 0 ? "quotite" : "apport";
    var mens = emprunt > 0 ? mensualite(emprunt, taux, annees) : 0;
    var mensStress = emprunt > 0 ? mensualite(emprunt, taux + 0.02, annees) : 0;
    var capitalStress = capaciteEmprunt({ netMensuel: net, chargesMensuelles: charges,
                                          tauxAnnuel: taux + 0.02, annees: annees, effort: effort }).capital || 0;
    return {
      mensualiteMax: Math.max(0, cap.mensualiteDisponible || 0),
      capital: capital, prix: prix, frais: frais, emprunt: emprunt, apport: apport,
      quotite: quotite, quotiteReelle: prix > 0 ? emprunt / prix : 0,
      mensualite: mens, resteAVivre: revenusReels - charges - mens,
      mensualiteStress: mensStress, capitalStress: capitalStress,
      interetsAn1: emprunt * taux, limite: limite,
      effort: effort, taux: taux, annees: annees, net: net, charges: charges
    };
  }

  // Capacite d'emprunt indicative.
  // opts : { netMensuel, chargesMensuelles, tauxAnnuel, annees, effort }
  function capaciteEmprunt(opts) {
    var net = Math.max(0, Number(opts.netMensuel) || 0);
    var charges = Math.max(0, Number(opts.chargesMensuelles) || 0);
    var taux = Number(opts.tauxAnnuel) || 0.04;
    var annees = Number(opts.annees) || 25;
    var effort = Number(opts.effort) || 0.33;

    var dispo = net * effort - charges;
    if (dispo <= 0) return { mensualiteDisponible: 0, capital: 0, dispo: dispo };

    var r = taux / 12, n = annees * 12;
    var capital = r === 0 ? dispo * n : dispo * (1 - Math.pow(1 + r, -n)) / r;
    return { mensualiteDisponible: dispo, capital: capital, taux: taux, annees: annees, effort: effort };
  }

  function mensualite(capital, tauxAnnuel, annees) {
    var r = tauxAnnuel / 12, n = annees * 12;
    if (r === 0) return capital / n;
    return capital * r / (1 - Math.pow(1 + r, -n));
  }

  return {
    calcul: calcul,
    menage: menage,
    tauxFicheAdditionnelle: TAUX_FICHE_ADDITIONNELLE,
    comparatif: comparatif,
    impotBareme: impotBareme,
    creditSalarie: creditSalarie,
    creditCO2: creditCO2,
    creditSSM: creditSSM,
    creditMonoparental: creditMonoparental,
    capaciteEmprunt: capaciteEmprunt,
    honorairesNotaire: honorairesNotaire,
    fraisAcquisition: fraisAcquisition,
    planFinancement: planFinancement,
    mensualite: mensualite,
    params: params,
    setParams: setParams
  };
})();
