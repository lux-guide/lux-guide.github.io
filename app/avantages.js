// Rubrique « Économies et avantages fiscaux » : ce que l'État rend, ou ne
// prélève pas, et à quel moment de la vie.
//
// Module autonome, même principe que app/lignes.js et app/cartes.js : style
// injecté, rendu dans son panneau, aucune dépendance vers ui.js. Il passe par
// les ancres de l'adresse (#fiche/interets, #simulateur) pour ouvrir le reste
// du site, parce que ui.js les écoute déjà.
//
// Pourquoi une rubrique à part alors que les fiches Impôts existent : les
// fiches expliquent un sujet, cette page répond à une autre question, « à quoi
// ai-je droit, et est-ce automatique ou faut-il le demander ». Quelqu'un qui
// arrive d'un autre pays ne demande pas ce qu'il ne sait pas exister.
//
// Règles de contenu :
//  1. Chaque avantage porte sa source, et seulement des sites de l'État
//     (guichet.lu, impotsdirects.lu, gouvernement.lu, cae.lu, mengstudien.lu).
//     Un chiffre qu'aucune de ces pages ne donne n'est pas écrit.
//  2. Aucun exemple chiffré sur une personne inventée : la carte donne le
//     mécanisme, les outils du site font le calcul sur la situation du lecteur.
//  3. « verifie » est la date à laquelle la page officielle a été lue. Elle
//     s'affiche, parce que les plafonds bougent, et que le lecteur doit savoir
//     de quand date ce qu'il lit.
//  4. Le mode dit qui déclenche l'avantage : automatique (rien à faire),
//     déclaration (à porter dans la déclaration annuelle), demande (un
//     formulaire, un guichet), employeur (c'est lui qui le met en place).
//     C'est l'information qui manque le plus souvent, et celle qui fait
//     perdre de l'argent.

(function () {
  "use strict";

  var PANEL = "panel-avantages";

  // Les moments de la vie, dans l'ordre où ils se présentent.
  var MOMENTS = [
    ["salaire", "Salaire et travail"],
    ["logement", "Logement"],
    ["famille", "Famille et études"],
    ["epargne", "Épargne et déclaration"],
    ["quotidien", "Quotidien et revenus modestes"]
  ];

  var MODES = {
    automatique: ["Automatique", "Rien à demander, il est déjà dans votre retenue ou votre versement."],
    declaration: ["À la déclaration", "À porter dans la déclaration d'impôt annuelle, sinon il est perdu."],
    demande: ["À demander", "Un formulaire ou un guichet, souvent avec un délai."],
    employeur: ["Par l'employeur", "C'est l'employeur qui le met en place, il se négocie à l'embauche."]
  };

  // chiffre : ce qui se retient, tel que la source l'écrit.
  // lien : { fiche: id } ouvre une fiche du guide, { panneau: nom } une section,
  //        { url: chemin } le site voisin.
  var AVANTAGES = [

    // ---------------- Salaire et travail ----------------

    {
      id: "cis", moment: "salaire", mode: "automatique",
      titre: "Crédit d'impôt pour salariés",
      chiffre: "600 €", sous: "par an, salaire brut de 11 266 à 40 000 €",
      texte: "Un crédit d'impôt vient en déduction de la retenue sur salaire, et l'employeur l'applique lui-même sur la base de la fiche de retenue. Il vaut 600 euros par an pour un salaire brut annuel de 11 266 à 40 000 euros, puis diminue jusqu'à 80 000 euros, à partir desquels il n'est plus accordé. Un crédit d'impôt CO2 de 216 euros par an suit la même logique jusqu'à 40 000 euros, dégressif ensuite.",
      savoir: "Il est imputable et restituable : si la retenue est inférieure au crédit, la différence est versée au salarié.",
      sources: [{ t: "Administration des contributions directes, CIS et CI-CO2 salarié à partir de 2026", u: "https://impotsdirects.public.lu/fr/az/c/credit-impot-salaries/cis2026.html" }],
      verifie: "18 septembre 2026",
      lien: { panneau: "simulateur", texte: "Voir le simulateur de salaire net" }
    },
    {
      id: "deplacement", moment: "salaire", mode: "automatique",
      titre: "Frais de déplacement forfaitaires",
      chiffre: "99 €", sous: "par unité d'éloignement, 2 574 € au plus",
      texte: "La distance entre le domicile et le lieu de travail se compte en unités d'éloignement, et chaque unité donne droit à une déduction forfaitaire de 99 euros par an, jusqu'à 26 unités, soit 2 574 euros. Les quatre premières unités ne sont pas prises en compte. Le forfait est inscrit sur la fiche de retenue d'impôt, sans justificatif.",
      savoir: "Chaque salarié bénéficie en plus, d'office, d'un minimum forfaitaire de 540 euros par an pour ses frais d'obtention. Des frais réels plus élevés se déclarent.",
      sources: [{ t: "Administration des contributions directes, frais d'obtention du salarié", u: "https://impotsdirects.public.lu/fr/az/f/frais_salar.html" }],
      verifie: "18 septembre 2026",
      lien: { fiche: "deductions", texte: "Fiche « Ce qui réduit votre impôt »" }
    },
    {
      id: "heures-sup", moment: "salaire", mode: "employeur",
      titre: "Heures supplémentaires exemptées",
      chiffre: "0 %", sous: "d'impôt sur la part de base et sur la majoration de 40 %",
      texte: "La rémunération des heures supplémentaires est exemptée d'impôt sur le revenu, et l'exemption vaut aussi bien pour la part non majorée, c'est-à-dire le salaire de base de l'heure, que pour la majoration de 40 %. Les deux parts sont également exemptées de cotisations sociales, côté salarié comme côté employeur.",
      savoir: "L'employeur doit déclarer les heures supplémentaires à part du salaire brut, avec leur nombre. Vérifiez qu'elles apparaissent sur une ligne distincte de la fiche de paie.",
      sources: [{ t: "Guichet.lu, demander le paiement des heures supplémentaires", u: "https://guichet.public.lu/fr/citoyens/travail/conditions-travail/duree-travail/paiement-heures-supplementaires.html" }],
      verifie: "18 septembre 2026",
      lien: { fiche: "cout_vie", texte: "Fiche « Salaire, coût de la vie et indexation »" }
    },
    {
      id: "cheques-repas", moment: "salaire", mode: "employeur",
      titre: "Chèques-repas",
      chiffre: "12,20 €", sous: "exemptés par chèque, sur une valeur de 15 €",
      texte: "Depuis le 1er janvier 2024, la valeur maximale exemptée d'un chèque-repas est de 12,20 euros. Avec la participation du salarié de 2,80 euros, la valeur d'un chèque atteint 15 euros. Jusqu'à cinq chèques peuvent être utilisés par jour, et ils servent aussi bien au restaurant que pour des achats alimentaires chez les commerçants affiliés.",
      savoir: "Ce n'est pas une obligation légale : l'avantage existe seulement si l'employeur le propose. C'est un point à regarder dans une offre, à côté du brut.",
      sources: [{ t: "Gouvernement luxembourgeois, le nouveau régime des chèques-repas", u: "https://gouvernement.lu/fr/actualites/toutes_actualites/communiques/2023/06-juin/09-backes-cheques-repas.html" }],
      verifie: "18 septembre 2026",
      lien: { fiche: "cout_vie", texte: "Fiche « Salaire, coût de la vie et indexation »" }
    },
    {
      id: "prime-participative", moment: "salaire", mode: "employeur",
      titre: "Prime participative",
      chiffre: "50 %", sous: "de la prime exemptés d'impôt",
      texte: "Une prime que l'employeur verse en fonction de son résultat positif est exemptée d'impôt à hauteur de 50 %, dans la limite de 25 % du montant brut de la rémunération annuelle du salarié. L'employeur doit réaliser un bénéfice, tenir une comptabilité régulière et déclarer nominativement les bénéficiaires.",
      savoir: "L'exemption dépend de conditions du côté de l'employeur, pas du salarié. Une prime ordinaire, hors de ce cadre, est imposée en entier.",
      sources: [{ t: "Administration des contributions directes, prime participative", u: "https://impotsdirects.public.lu/fr/az/p/prime-participative.html" }],
      verifie: "18 septembre 2026"
    },
    {
      id: "prime-jeune", moment: "salaire", mode: "employeur",
      titre: "Prime jeune salarié",
      chiffre: "75 %", sous: "exemptés, moins de 30 ans, premier CDI",
      texte: "Depuis l'année d'imposition 2025, un employeur peut verser une prime dont 75 % est exemptée d'impôt, à trois conditions cumulatives : avoir moins de 30 ans au début de l'année, être dans son premier contrat à durée indéterminée, et que la première prime remonte à moins de cinq ans. La prime est plafonnée à 5 000 euros par an jusqu'à 50 000 euros de rémunération brute, 3 750 euros jusqu'à 75 000, 2 500 euros jusqu'à 100 000, et rien au-delà.",
      savoir: "Seuls les contrats à durée indéterminée signés à partir de 2025 ouvrent droit à l'exemption.",
      sources: [{ t: "Administration des contributions directes, prime jeune salarié", u: "https://impotsdirects.public.lu/fr/az/p/prime-jeune-salarie.html" }],
      verifie: "18 septembre 2026",
      lien: { fiche: "emploi", texte: "Fiche « Chercher un emploi »" }
    },
    {
      id: "impatries", moment: "salaire", mode: "employeur",
      titre: "Régime des impatriés",
      chiffre: "50 %", sous: "de la rémunération brute exonérés, jusqu'à 400 000 €",
      texte: "Un salarié recruté à l'étranger pour un poste au Luxembourg peut voir la moitié de sa rémunération brute annuelle exonérée d'impôt, dans la limite de 400 000 euros de rémunération, à condition de gagner au moins 75 000 euros bruts fixes par an et de remplir des conditions d'éloignement les cinq années précédentes. Le régime court sur l'année d'arrivée et les huit suivantes.",
      savoir: "Il s'éteint. Un prêt sur vingt-cinq ans se calcule sur le revenu d'après, pas sur celui d'aujourd'hui.",
      sources: [{ t: "Guichet.lu, régime fiscal des salariés hautement qualifiés et spécialisés", u: "https://guichet.public.lu/fr/citoyens/immigration/plus-3-mois/ressortissant-tiers/hautement-qualifie/exoneration-hautement-qualifie.html" }],
      verifie: "18 septembre 2026",
      lien: { fiche: "impatries", texte: "Fiche « Régime des impatriés »" }
    },
    {
      id: "extra-pro", moment: "salaire", mode: "automatique",
      titre: "Abattement extra-professionnel",
      chiffre: "4 500 €", sous: "par an, couple imposé collectivement à deux revenus",
      texte: "Quand les deux conjoints ou partenaires imposés collectivement réalisent chacun un revenu d'une activité professionnelle et sont affiliés personnellement à la sécurité sociale, un abattement de 4 500 euros par an est retranché du revenu imposable du ménage, soit 375 euros par mois entier d'assujettissement.",
      savoir: "Il est accordé dans le cadre de l'imposition collective, qui elle-même suppose une déclaration commune : c'est là qu'il apparaît.",
      sources: [{ t: "Administration des contributions directes, abattement extra-professionnel", u: "https://impotsdirects.public.lu/fr/az/a/abat_extrapro.html" }],
      verifie: "18 septembre 2026",
      lien: { fiche: "impots_classes", texte: "Fiche « Classes d'impôt »" }
    },

    // ---------------- Logement ----------------

    {
      id: "bellegen-akt", moment: "logement", mode: "demande",
      titre: "Crédit d'impôt sur l'acte notarié, le Bëllegen Akt",
      chiffre: "40 000 €", sous: "par personne, sur les droits d'enregistrement",
      texte: "Qui achète une maison, un appartement ou un terrain à bâtir pour l'occuper personnellement bénéficie d'un crédit d'impôt sur les droits d'enregistrement et de transcription, limité à 40 000 euros par personne. Un couple qui achète à deux dispose donc de deux crédits. Le montant de 40 000 euros, introduit pour les actes signés depuis le 1er janvier 2024, est maintenu au-delà du 30 juin 2025.",
      savoir: "C'est le notaire qui fait la demande à la signature de l'acte. Le logement doit être occupé dans les deux ans, quatre pour un terrain ou un logement en construction, pendant au moins deux ans d'affilée.",
      sources: [
        { t: "Guichet.lu, crédit d'impôt sur les actes notariés", u: "https://guichet.public.lu/fr/citoyens/aides/logement-construction/aides-indirectes/credit-impot-actes-notaries.html" },
        { t: "Gouvernement luxembourgeois, nouvelles modalités des avantages fiscaux en matière de logement, 2 juin 2025", u: "https://gouvernement.lu/fr/actualites/toutes_actualites/communiques/2025/06-juin/02-roth-avantages-fiscaux.html" }
      ],
      verifie: "18 septembre 2026",
      lien: { fiche: "achat", texte: "Fiche « Acheter un logement »" }
    },
    {
      id: "tva-3", moment: "logement", mode: "demande",
      titre: "TVA à 3 % sur la construction et la rénovation",
      chiffre: "3 %", sous: "au lieu du taux normal, jusqu'à 50 000 € d'avantage par logement",
      texte: "Les travaux de création ou de rénovation d'un logement affecté à l'habitation principale relèvent du taux super-réduit de TVA de 3 %. Soit l'artisan facture directement à 3 % après agrément de l'Administration de l'enregistrement, soit le propriétaire demande le remboursement de la différence avec le taux normal. L'avantage total ne peut pas dépasser 50 000 euros par logement créé ou rénové.",
      savoir: "Le logement doit rester la résidence principale pendant deux ans à partir de l'achèvement. Le remboursement se demande au plus tard cinq ans après le 31 décembre de l'année concernée.",
      sources: [{ t: "Guichet.lu, remboursement de la TVA ou application directe du taux super-réduit", u: "https://guichet.public.lu/fr/citoyens/aides/logement-construction/aides-indirectes/remboursement-tva-taux-reduit.html" }],
      verifie: "18 septembre 2026",
      lien: { fiche: "achat", texte: "Fiche « Acheter un logement »" }
    },
    {
      id: "interets", moment: "logement", mode: "declaration",
      titre: "Intérêts du prêt de l'habitation principale",
      chiffre: "× ménage", sous: "le plafond se multiplie par le nombre de personnes du foyer",
      texte: "Les intérêts d'un prêt qui finance le logement occupé se déduisent : en entier les deux premières années, puis dans la limite de 4 000 euros par an pendant quatre ans, 3 000 euros pendant cinq ans, 2 000 euros ensuite. Chaque plafond est majoré de son propre montant pour le conjoint imposé collectivement et pour chaque enfant ouvrant droit à une modération d'impôt.",
      savoir: "Résidence principale uniquement, et les subventions d'intérêt reçues de l'État réduisent d'autant la dépense déductible.",
      sources: [{ t: "Administration des contributions directes, habitation personnelle du propriétaire", u: "https://impotsdirects.public.lu/fr/az/h/habit_pers.html" }],
      verifie: "18 septembre 2026",
      lien: { fiche: "interets", texte: "Fiche « Déduire les intérêts d'emprunt »" }
    },
    {
      id: "prime-accession", moment: "logement", mode: "demande",
      titre: "Prime d'accession à la propriété",
      chiffre: "500 à 10 000 €", sous: "selon le revenu et la composition du ménage",
      texte: "Qui contracte un prêt hypothécaire pour acheter ou construire son habitation principale peut recevoir une prime en capital, entre 500 et 10 000 euros selon le revenu et la composition de la communauté domestique. Le logement doit rester l'habitation principale et permanente pendant au moins deux ans, et aucun membre du ménage ne doit posséder plus d'un tiers d'un autre logement. L'ensemble des aides en capital est plafonné à 35 000 euros par bénéficiaire.",
      savoir: "La demande se fait dans l'année qui suit l'acte notarié ou le début des travaux, au Guichet unique des aides au logement. Passé ce délai, la prime est perdue.",
      sources: [{ t: "Guichet.lu, prime d'accession à la propriété", u: "https://guichet.public.lu/fr/citoyens/aides/logement-construction/aides-capital/prime-construction-acquisition.html" }],
      verifie: "18 septembre 2026",
      lien: { fiche: "achat", texte: "Fiche « Acheter un logement »" }
    },
    {
      id: "subvention-loyer", moment: "logement", mode: "demande",
      titre: "Subvention de loyer",
      chiffre: "10 à 520 €", sous: "par mois, si le loyer dépasse le quart du revenu",
      texte: "Un locataire dont le loyer mensuel hors charges dépasse 25 % du revenu net du ménage peut recevoir une subvention de loyer, entre 10 et 520 euros par mois selon la composition et le revenu du ménage. Aucun membre du ménage ne doit être propriétaire d'un logement, au Luxembourg ou à l'étranger, et le logement loué doit être la résidence principale.",
      savoir: "La demande se dépose à tout moment de l'année au Guichet unique des aides au logement, et un simulateur officiel donne une estimation avant de la remplir.",
      sources: [{ t: "Guichet.lu, subvention de loyer", u: "https://guichet.public.lu/fr/citoyens/aides/logement-construction/aides-logement/subvention-loyer.html" }],
      verifie: "18 septembre 2026",
      lien: { fiche: "bail", texte: "Fiche « Signer un bail »" }
    },
    {
      id: "garantie-locative", moment: "logement", mode: "demande",
      titre: "Garantie locative financée par l'État",
      chiffre: "2 mois", sous: "de loyer au plus, garantis par le ministère du Logement",
      texte: "Quand un propriétaire demande une garantie locative que le locataire ne peut pas avancer, le ministère du Logement et de l'Aménagement du territoire peut se porter garant à sa place, dans la limite de deux mois de loyer hors charges. En contrepartie, le locataire s'engage à épargner le montant de la garantie sur trois ans. Le revenu du ménage doit rester sous les limites fixées par la loi et le loyer ne peut pas dépasser la moitié du revenu.",
      savoir: "Il faut des revenus réguliers depuis au moins trois mois, un droit de séjour de plus de trois mois, et ne posséder aucun logement.",
      sources: [{ t: "Guichet.lu, aide étatique au financement d'une garantie locative", u: "https://guichet.public.lu/fr/citoyens/aides/logement-construction/aides-logement/garantie-locative.html" }],
      verifie: "18 septembre 2026",
      lien: { fiche: "bail", texte: "Fiche « Signer un bail »" }
    },
    {
      id: "klimabonus", moment: "logement", mode: "demande",
      titre: "Klimabonus, la rénovation énergétique",
      chiffre: "2026 à 2035", sous: "les factures de cette période ouvrent droit à l'aide",
      texte: "L'Administration de l'environnement subventionne la rénovation énergétique d'un logement, sur la base d'un conseil en énergie ou, pour un seul élément, sans conseil, ainsi que les installations techniques à énergie renouvelable. Le régime 2026 vaut pour des factures datées du 1er janvier 2026 au 31 décembre 2035. Les montants dépendent des travaux, la page officielle les détaille.",
      savoir: "L'accord de principe se demande avant de commencer les travaux, entre le 1er janvier 2026 et le 31 décembre 2030. Des travaux engagés sans cet accord ne sont pas aidés.",
      sources: [{ t: "Guichet.lu, aide financière pour la rénovation énergétique d'un logement, Klimabonus 2026", u: "https://guichet.public.lu/fr/citoyens/aides/logement-construction/klimabonus-2026/renovation-energetique-logement.html" }],
      verifie: "18 septembre 2026",
      lien: { fiche: "emmenagement", texte: "Fiche « Emménager et meubler »" }
    },

    // ---------------- Famille et études ----------------

    {
      id: "allocations", moment: "famille", mode: "demande",
      titre: "Allocations familiales",
      chiffre: "315,04 €", sous: "par mois et par enfant, majorées à 6 et 12 ans",
      texte: "Toute famille dont l'enfant réside au Luxembourg reçoit une allocation de 315,04 euros par mois et par enfant, majorée de 23,81 euros au-delà de six ans et de 59,44 euros au-delà de douze ans, valeurs au 1er juin 2026. Il n'y a aucune condition de nationalité. Une allocation de rentrée scolaire s'y ajoute chaque année en août, sans démarche.",
      savoir: "Seule la première demande est à faire, auprès de la Caisse pour l'avenir des enfants. Les montants suivent l'indexation, ils sont revalorisés à chaque tranche indiciaire.",
      sources: [{ t: "Caisse pour l'avenir des enfants, montants de l'allocation", u: "https://cae.public.lu/fr/allocations/allocation-pour-lavenir-des-enfants/montants.html" }],
      verifie: "18 septembre 2026",
      lien: { fiche: "allocations", texte: "Fiche « Allocations familiales »" }
    },
    {
      id: "cheque-service", moment: "famille", mode: "demande",
      titre: "Chèque-service accueil",
      chiffre: "20 h", sous: "de crèche gratuites par semaine, de 1 à 4 ans",
      texte: "L'État prend en charge une part du coût de la garde chez les prestataires conventionnés. Entre un et quatre ans, un enfant a droit à vingt heures d'encadrement gratuites par semaine en crèche, pendant quarante-six semaines par an. À partir de la scolarisation, l'accueil et les repas principaux sont gratuits pendant les périodes scolaires, en semaine de sept à dix-neuf heures. La participation de l'État va jusqu'à soixante heures par semaine.",
      savoir: "L'adhésion se fait à la commune de résidence, ce qui suppose d'avoir déjà déclaré son arrivée. Le tarif restant dépend du revenu du ménage et du rang de l'enfant.",
      sources: [{ t: "Guichet.lu, bénéficier du chèque-service pour l'accueil d'un enfant", u: "https://guichet.public.lu/fr/citoyens/famille-education/parents/garde-enfants/cheque-service.html" }],
      verifie: "18 septembre 2026",
      lien: { fiche: "garde", texte: "Fiche « Garde d'enfants et chèque-service »" }
    },
    {
      id: "conge-parental", moment: "famille", mode: "demande",
      titre: "Congé parental indemnisé",
      chiffre: "2 771 à 4 619 €", sous: "par mois à temps plein, pour chaque parent",
      texte: "Chaque parent peut prendre un congé parental indemnisé par la Caisse pour l'avenir des enfants, en remplacement du salaire. À temps plein, l'indemnité est calculée sur le revenu des douze mois précédents, avec une limite inférieure de 2 771,33 euros et une limite supérieure de 4 618,88 euros par mois, montants publiés par la caisse en mai 2026. Elle est soumise aux cotisations et à l'impôt, la caisse figurant comme employeur sur la fiche de retenue.",
      savoir: "Le congé se demande à l'employeur puis à la caisse, avec des délais qui dépendent du moment choisi. Le calculateur officiel donne le montant sur votre revenu.",
      sources: [{ t: "Caisse pour l'avenir des enfants, montants du congé parental", u: "https://cae.public.lu/fr/conge-parental/informations-generales/montants.html" }],
      verifie: "18 septembre 2026",
      lien: { fiche: "conges", texte: "Fiche « Congés et jours fériés »" }
    },
    {
      id: "cim", moment: "famille", mode: "demande",
      titre: "Crédit d'impôt monoparental",
      chiffre: "3 504 €", sous: "par an sous 60 000 € de revenu, 750 € au-delà de 105 000 €",
      texte: "Un parent en classe d'impôt 1a qui élève seul au moins un enfant ouvrant droit à la modération d'impôt reçoit, sur demande, un crédit d'impôt de 3 504 euros par an quand le revenu imposable ajusté est inférieur à 60 000 euros. Il décroît ensuite jusqu'à 750 euros au-delà de 105 000 euros. Il n'est pas accordé quand les deux parents partagent une habitation avec l'enfant.",
      savoir: "Le crédit est réduit de la moitié des allocations que reçoit l'enfant au-delà de 2 712 euros par an, les pensions alimentaires par exemple.",
      sources: [{ t: "Administration des contributions directes, crédit d'impôt monoparental à partir de 2025", u: "https://impotsdirects.public.lu/fr/az/c/cim/cim2025.html" }],
      verifie: "18 septembre 2026",
      lien: { fiche: "impots_classes", texte: "Fiche « Classes d'impôt »" }
    },
    {
      id: "aidefi", moment: "famille", mode: "demande",
      titre: "Aide financière pour études supérieures",
      chiffre: "1 289 €", sous: "de bourse de base par semestre, cumulable avec d'autres bourses",
      texte: "Un étudiant qui remplit les conditions reçoit d'office une bourse de base de 1 289 euros par semestre. S'y ajoutent, selon la situation, une bourse sur critères sociaux jusqu'à 2 500 euros par semestre, une bourse de mobilité de 1 686 euros pour des études à l'étranger, une bourse familiale de 307 euros quand plusieurs enfants du ménage étudient, et un prêt de base de 3 250 euros garanti par l'État à un taux maximal de 1,8 %.",
      savoir: "La demande se renouvelle chaque semestre, sur MyGuichet. La bourse est virée deux à quatre semaines après la lettre d'accord.",
      sources: [{ t: "MengStudien.lu, la composition de l'AideFi", u: "https://mengstudien.public.lu/fr/aides-financieres/aidefi/composition.html" }],
      verifie: "18 septembre 2026",
      lien: { fiche: "ecole", texte: "Fiche « Scolariser ses enfants »" }
    },

    // ---------------- Épargne et déclaration ----------------

    {
      id: "prevoyance", moment: "epargne", mode: "declaration",
      titre: "Prévoyance-vieillesse, le contrat 111bis",
      chiffre: "4 500 €", sous: "déductibles par an et par contribuable depuis 2026",
      texte: "Les primes versées à un contrat de prévoyance-vieillesse se déduisent du revenu imposable jusqu'à 4 500 euros par an et par contribuable depuis le 1er janvier 2026, quel que soit l'âge. Chaque conjoint qui souscrit son propre contrat a son plafond. En contrepartie, l'épargne est longue : dix ans au moins, remboursable entre 60 et 75 ans.",
      savoir: "Le site voisin chiffre l'économie d'impôt sur votre situation, et détaille les autres postes : primes d'assurance, épargne-logement, régime complémentaire.",
      sources: [
        { t: "Administration des contributions directes, prévoyance-vieillesse", u: "https://impotsdirects.public.lu/fr/az/p/prevoyance_vieillesse.html" },
        { t: "Gouvernement luxembourgeois, nouveautés 2026", u: "https://gouvernement.lu/fr/actualites/toutes_actualites/articles/2025/12-decembre/nouveautes-2026.html" }
      ],
      verifie: "18 septembre 2026",
      lien: { url: "prevoyance/", texte: "Ouvrir le site Épargne et retraite" }
    },
    {
      id: "epargne-logement", moment: "epargne", mode: "declaration",
      titre: "Épargne-logement",
      chiffre: "1 344 €", sous: "par personne du ménage de 18 à 40 ans, 672 € ensuite",
      texte: "Les cotisations à un contrat d'épargne-logement se déduisent jusqu'à 1 344 euros par an quand le souscripteur a entre 18 et 40 ans, 672 euros au-delà. Le plafond se majore pour le conjoint imposé collectivement et pour chaque enfant ouvrant droit à une modération d'impôt : pour une famille, il se multiplie. L'épargne doit financer l'habitation personnelle.",
      savoir: "Utilisée à autre chose avant dix ans, la déduction est reprise par une imposition rectificative.",
      sources: [{ t: "Administration des contributions directes, cotisations d'épargne-logement", u: "https://impotsdirects.public.lu/fr/az/c/cotis-epargne-logement.html" }],
      verifie: "18 septembre 2026",
      lien: { url: "prevoyance/", texte: "Ouvrir le site Épargne et retraite" }
    },
    {
      id: "primes-assurance", moment: "epargne", mode: "declaration",
      titre: "Primes d'assurance et intérêts débiteurs",
      chiffre: "672 €", sous: "par an, majorés pour le conjoint et chaque enfant",
      texte: "Les primes d'assurance vie, décès, accident, invalidité, maladie et responsabilité civile, ainsi que les intérêts débiteurs de prêts à la consommation, se déduisent ensemble jusqu'à 672 euros par an. Ce plafond est majoré de son montant pour le conjoint imposé collectivement et pour chaque enfant ouvrant droit à une modération d'impôt.",
      savoir: "Une prime unique d'assurance solde restant dû, souscrite avec un prêt immobilier, a un plafond à part, qui dépend de l'âge et du nombre d'enfants.",
      sources: [
        { t: "Administration des contributions directes, cotisations et primes d'assurance", u: "https://impotsdirects.public.lu/fr/az/c/cotis_prim.html" },
        { t: "Administration des contributions directes, prime unique", u: "https://impotsdirects.public.lu/fr/az/p/prime_uniq.html" }
      ],
      verifie: "18 septembre 2026",
      lien: { url: "prevoyance/", texte: "Ouvrir le site Épargne et retraite" }
    },
    {
      id: "capitaux", moment: "epargne", mode: "declaration",
      titre: "Intérêts et dividendes",
      chiffre: "1 500 €", sous: "exonérés par an, 3 000 € pour un couple imposé collectivement",
      texte: "La première tranche de 1 500 euros par an de revenus de capitaux mobiliers, intérêts et dividendes imposables confondus, est exempte d'impôt, et elle est doublée pour les époux ou partenaires imposés collectivement. Les dividendes versés par une société de capitaux pleinement imposable établie au Luxembourg, dans l'Union européenne ou dans un pays lié par une convention fiscale sont en outre exonérés à hauteur de 50 %.",
      savoir: "Un minimum forfaitaire de 25 euros de frais d'obtention est déduit en plus, doublé pour un couple.",
      sources: [
        { t: "Administration des contributions directes, revenu net provenant de capitaux mobiliers", u: "https://impotsdirects.public.lu/fr/az/d/deter_capit_mobil.html" },
        { t: "Guichet.lu, identifier et déclarer les dividendes perçus", u: "https://guichet.public.lu/fr/citoyens/fiscalite/declaration-impot-decompte/capitaux-mobiliers/banque-dividende-interets/identifier-declarer-dividendes.html" }
      ],
      verifie: "18 septembre 2026",
      lien: { fiche: "banque", texte: "Fiche « Banque et moyens de paiement »" }
    },
    {
      id: "dons", moment: "epargne", mode: "declaration",
      titre: "Dons déductibles",
      chiffre: "120 €", sous: "de dons par an au minimum, jusqu'à 20 % des revenus nets",
      texte: "Les dons en argent à des organismes reconnus d'utilité publique, au Fonds culturel national et à des organismes comparables de l'Union européenne se déduisent comme dépenses spéciales, dès que leur total annuel atteint 120 euros. La déduction ne peut pas dépasser 20 % du total des revenus nets ni 1 000 000 euros, et l'excédent se reporte sur les deux années suivantes.",
      savoir: "Les listes officielles des organismes admis sont publiées par l'administration. Un don à un organisme absent des listes n'est pas déductible.",
      sources: [{ t: "Administration des contributions directes, libéralités et dons", u: "https://impotsdirects.public.lu/fr/az/l/libera_dons.html" }],
      verifie: "18 septembre 2026",
      lien: { fiche: "deductions", texte: "Fiche « Ce qui réduit votre impôt »" }
    },

    // ---------------- Quotidien et revenus modestes ----------------

    {
      id: "transports", moment: "quotidien", mode: "automatique",
      titre: "Transports publics gratuits",
      chiffre: "0 €", sous: "bus, tram et train en seconde classe, pour tous",
      texte: "Depuis le 29 février 2020, les transports publics sont gratuits sur tout le territoire, bus, trams et trains en seconde classe, sans titre de transport. La gratuité vaut pour les résidents comme pour les frontaliers, sur la partie luxembourgeoise du trajet.",
      savoir: "L'économie dépend de la desserte réelle de la commune, à vérifier aux heures qui vous concernent avant de choisir où habiter.",
      sources: [{ t: "Communauté des transports, mobiliteit.lu", u: "https://www.mobiliteit.lu/" }],
      verifie: "18 septembre 2026",
      lien: { panneau: "lignes", texte: "Voir les arrêts d'où l'on rejoint le travail" }
    },
    {
      id: "indexation", moment: "quotidien", mode: "automatique",
      titre: "Salaires indexés automatiquement",
      chiffre: "2,5 %", sous: "de hausse des prix déclenchent une tranche indiciaire",
      texte: "Dès que l'indice des prix à la consommation progresse de 2,5 %, une tranche indiciaire est déclenchée et l'ensemble des salaires, pensions et minima sociaux est revalorisé d'autant. Le mécanisme s'applique à tous les salariés, sans négociation, et il explique pourquoi les montants publiés changent en cours d'année.",
      savoir: "Les allocations familiales et l'indemnité de congé parental suivent le même indice depuis 2021.",
      sources: [
        { t: "STATEC, statistiques officielles", u: "https://statistiques.public.lu/fr.html" },
        { t: "Caisse pour l'avenir des enfants, montants de l'allocation", u: "https://cae.public.lu/fr/allocations/allocation-pour-lavenir-des-enfants/montants.html" }
      ],
      verifie: "18 septembre 2026",
      lien: { fiche: "cout_vie", texte: "Fiche « Salaire, coût de la vie et indexation »" }
    },
    {
      id: "vie-chere", moment: "quotidien", mode: "demande",
      titre: "Allocation de vie chère et prime énergie",
      chiffre: "1 817 à 3 637 €", sous: "par an selon la taille du ménage, sous condition de revenu",
      texte: "Le Fonds national de solidarité verse, sur demande, une allocation de vie chère aux ménages à revenu modeste : 1 817 euros pour une personne seule, 2 272 euros pour deux, 2 727 pour trois, 3 182 pour quatre, 3 637 à partir de cinq. Une prime énergie s'y ajoute, de 600 euros pour une personne seule à 1 200 euros à partir de cinq. Le revenu brut mensuel ne doit pas dépasser 2 710,52 euros pour une personne seule, davantage selon la taille du ménage.",
      savoir: "Il faut avoir résidé au Luxembourg sans interruption pendant les trois mois précédant la demande, et la demande complète doit arriver au fonds au plus tard le 31 décembre de l'année.",
      sources: [{ t: "Guichet.lu, allocation de vie chère et prime énergie", u: "https://guichet.public.lu/fr/citoyens/aides/famille-education/revenus-modestes/allocation-vie-chere.html" }],
      verifie: "18 septembre 2026",
      lien: { fiche: "cout_vie", texte: "Fiche « Salaire, coût de la vie et indexation »" }
    }
  ];

  // ---------- Style, injecté comme dans lignes.js et cartes.js ----------

  var CSS = "\
#panel-avantages .av-modes { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin: 0 0 26px; }\
#panel-avantages .av-mode { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-s); padding: 13px 15px; box-shadow: var(--ombre-s); text-align: left; font: inherit; color: inherit; cursor: pointer; transition: border-color .16s, box-shadow .16s, transform .16s; }\
#panel-avantages .av-mode:hover { border-color: var(--mode-c); transform: translateY(-2px); box-shadow: var(--ombre-m); }\
#panel-avantages .av-mode[aria-pressed=true] { border-color: var(--mode-c); box-shadow: inset 0 0 0 1px var(--mode-c); background: color-mix(in srgb, var(--mode-c) 7%, var(--surface)); }\
#panel-avantages .av-mode b { display: block; font-size: 13px; text-transform: uppercase; letter-spacing: .8px; margin-bottom: 3px; color: var(--mode-c); }\
#panel-avantages .av-mode span { font-size: 13.5px; color: var(--muted); line-height: 1.5; }\
#panel-avantages .av-mode i { display: block; margin-top: 8px; font-style: normal; font-size: 12.5px; font-weight: 600; color: var(--mode-c); }\
#panel-avantages .av-mode[aria-pressed=true] i::after { content: ' · afficher tout'; font-weight: 500; color: var(--muted); }\
#panel-avantages .av-chips { margin: 0 0 8px; }\
#panel-avantages .av-grille { display: grid; gap: 20px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }\
#panel-avantages .av-tete { grid-column: 1 / -1; display: flex; align-items: baseline; gap: 12px; margin: 30px 0 2px; padding-bottom: 10px; border-bottom: 1px solid var(--border); }\
#panel-avantages .av-tete:first-child { margin-top: 6px; }\
#panel-avantages .av-tete h2 { margin: 0; font-size: 22px; }\
#panel-avantages .av-tete span { font-size: var(--micro); color: var(--muted); font-weight: 620; letter-spacing: .8px; text-transform: uppercase; }\
#panel-avantages .av-carte { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-m); padding: 22px 22px 20px; box-shadow: var(--ombre-s); display: flex; flex-direction: column; position: relative; border-top: 3px solid var(--mode-c, var(--accent)); }\
#panel-avantages .av-carte[data-mode=automatique] { --mode-c: #0c6b3e; }\
#panel-avantages .av-carte[data-mode=declaration] { --mode-c: #96570a; }\
#panel-avantages .av-carte[data-mode=demande] { --mode-c: #0a4fa8; }\
#panel-avantages .av-carte[data-mode=employeur] { --mode-c: #6b4df6; }\
#panel-avantages .av-badge { align-self: flex-start; font-size: var(--micro); font-weight: 650; letter-spacing: .9px; text-transform: uppercase; color: var(--mode-c); background: color-mix(in srgb, var(--mode-c) 10%, transparent); padding: 4px 10px; border-radius: 999px; margin-bottom: 12px; }\
#panel-avantages .av-carte h3 { margin: 0 0 8px; font-size: 17px; letter-spacing: -.3px; line-height: 1.3; }\
#panel-avantages .av-chiffre { font-family: var(--serif); font-size: 30px; line-height: 1.05; color: var(--mode-c); font-variant-numeric: tabular-nums; letter-spacing: -.5px; }\
#panel-avantages .av-sous { margin: 4px 0 12px; font-size: 13.5px; color: var(--muted); line-height: 1.5; }\
#panel-avantages .av-carte p.av-texte { margin: 0 0 12px; font-size: 14.4px; line-height: 1.62; color: var(--text-2); }\
#panel-avantages .av-savoir { margin: 0 0 14px; padding: 10px 12px; border-radius: var(--r-s); background: var(--surface-2); font-size: 13.6px; line-height: 1.55; color: var(--text-2); }\
#panel-avantages .av-savoir b { color: var(--text); }\
#panel-avantages .av-pied { margin-top: auto; padding-top: 12px; border-top: 1px solid var(--border); font-size: 13.4px; display: flex; flex-direction: column; gap: 6px; }\
#panel-avantages .av-pied a { color: var(--accent); text-decoration: none; }\
#panel-avantages .av-pied a:hover { text-decoration: underline; }\
#panel-avantages .av-pied .av-src { color: var(--muted); }\
#panel-avantages .av-pied .av-src a { color: var(--muted); text-decoration: underline; text-decoration-color: var(--border-fort); }\
#panel-avantages .av-pied .av-src a:hover { color: var(--accent); }\
#panel-avantages .av-vide { color: var(--muted); grid-column: 1 / -1; }\
@media (max-width: 720px) { #panel-avantages .av-grille { grid-template-columns: 1fr; } #panel-avantages .av-carte { padding: 18px 16px 16px; } }\
";

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }

  function injecterStyle() {
    if (document.getElementById("avantages-style")) return;
    var s = el("style"); s.id = "avantages-style"; s.textContent = CSS;
    document.head.appendChild(s);
  }

  // Ouvrir ailleurs dans le site : ui.js écoute les ancres, on les pose.
  function lienVers(l) {
    var a = el("a", null, l.texte);
    if (l.url) { a.href = l.url; return a; }
    var cible = l.fiche ? "#fiche/" + l.fiche : "#" + l.panneau;
    a.href = cible;
    a.addEventListener("click", function (ev) {
      ev.preventDefault();
      if (window.location.hash === cible) {
        // Même ancre : hashchange ne se déclenche pas, on force le passage.
        window.location.hash = "";
      }
      window.location.hash = cible;
    });
    return a;
  }

  function carte(a) {
    var c = el("article", "av-carte");
    c.dataset.mode = a.mode;
    c.dataset.moment = a.moment;
    c.id = "avantage-" + a.id;
    c.appendChild(el("span", "av-badge", MODES[a.mode][0]));
    c.appendChild(el("h3", null, a.titre));
    c.appendChild(el("div", "av-chiffre", a.chiffre));
    c.appendChild(el("div", "av-sous", a.sous));
    c.appendChild(el("p", "av-texte", a.texte));
    if (a.savoir) {
      var s = el("p", "av-savoir");
      s.appendChild(el("b", null, "À savoir. "));
      s.appendChild(document.createTextNode(a.savoir));
      c.appendChild(s);
    }
    var pied = el("div", "av-pied");
    if (a.lien) pied.appendChild(lienVers(a.lien));
    var src = el("div", "av-src");
    src.appendChild(document.createTextNode("Source : "));
    a.sources.forEach(function (x, i) {
      if (i) src.appendChild(document.createTextNode(" · "));
      var l = el("a", null, x.t);
      l.href = x.u; l.target = "_blank"; l.rel = "noopener";
      src.appendChild(l);
    });
    src.appendChild(document.createTextNode(". Lue le " + a.verifie + "."));
    pied.appendChild(src);
    c.appendChild(pied);
    return c;
  }

  // Deux filtres qui se combinent : le moment de la vie (les puces) et le
  // mode (les quatre blocs de la légende). « À demander » seul montre tout ce
  // qui se perd si l'on ne fait rien.
  var filtreMoment = "tous";
  var filtreMode = null;

  function pluriel(n) { return n + (n > 1 ? " avantages" : " avantage"); }

  function rendreGrille() {
    var g = document.getElementById("avantages-grille");
    if (!g) return;
    g.innerHTML = "";
    var n = 0;
    MOMENTS.forEach(function (m) {
      if (filtreMoment !== "tous" && filtreMoment !== m[0]) return;
      var lot = AVANTAGES.filter(function (a) {
        return a.moment === m[0] && (!filtreMode || a.mode === filtreMode);
      });
      if (!lot.length) return;
      var tete = el("div", "av-tete");
      tete.appendChild(el("h2", null, m[1]));
      tete.appendChild(el("span", null, pluriel(lot.length)));
      g.appendChild(tete);
      lot.forEach(function (a) { g.appendChild(carte(a)); n++; });
    });
    if (!n) g.appendChild(el("p", "av-vide", "Aucun avantage de ce mode dans ce moment de la vie."));
    var compte = document.getElementById("avantages-compte");
    if (compte) {
      compte.textContent = filtreMode
        ? pluriel(n) + " " + MODES[filtreMode][0].toLowerCase()
        : AVANTAGES.length + " avantages, " + MOMENTS.length + " moments de la vie";
    }
  }

  function rendreChips() {
    var z = document.getElementById("avantages-chips");
    if (!z) return;
    z.innerHTML = "";
    [["tous", "Tous"]].concat(MOMENTS).forEach(function (m) {
      var b = el("button", "chip" + (filtreMoment === m[0] ? " actif" : ""), m[1]);
      b.type = "button";
      b.setAttribute("aria-pressed", String(filtreMoment === m[0]));
      b.addEventListener("click", function () {
        filtreMoment = m[0];
        rendreChips();
        rendreGrille();
      });
      z.appendChild(b);
    });
  }

  function rendreModes() {
    var z = document.getElementById("avantages-modes");
    if (!z) return;
    z.innerHTML = "";
    Object.keys(MODES).forEach(function (k) {
      // Un bouton, pas une simple légende : cliquer un mode ne garde que ses
      // avantages, recliquer rend tout. aria-pressed porte l'état.
      var d = el("button", "av-mode");
      d.type = "button";
      d.style.setProperty("--mode-c", { automatique: "#0c6b3e", declaration: "#96570a", demande: "#0a4fa8", employeur: "#6b4df6" }[k]);
      d.setAttribute("aria-pressed", String(filtreMode === k));
      d.appendChild(el("b", null, MODES[k][0]));
      d.appendChild(el("span", null, MODES[k][1]));
      var total = AVANTAGES.filter(function (a) { return a.mode === k; }).length;
      d.appendChild(el("i", null, "Voir les " + total));
      d.addEventListener("click", function () {
        filtreMode = filtreMode === k ? null : k;
        rendreModes();
        rendreGrille();
      });
      z.appendChild(d);
    });
  }

  function init() {
    if (!document.getElementById(PANEL)) return;
    injecterStyle();
    rendreModes();
    rendreChips();
    rendreGrille();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  // Exposé pour les vérifications automatiques, rien d'autre ne l'utilise.
  window.AVANTAGES = { liste: AVANTAGES, moments: MOMENTS };
})();
