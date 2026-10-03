// Fiche guidée « Immatriculer son véhicule ».
// Sortie de kb.js le 3 octobre 2026 : kb.js la reprend par window.FICHES.vehicule.
// Le rendu est dans app/guide.js, le format du guide y est décrit.
//
// Sources vérifiées le 3 octobre 2026 : Guichet.lu, page « déménagement
// transfrontalier » mise à jour le 16.04.2026 (ordre des étapes, plaques,
// montants, adresses SNCA et douanes) ; SNCT, prix au 02.05.2025.

window.FICHES = window.FICHES || {};

window.FICHES.vehicule = {
  id: "vehicule",
  titre: "Immatriculer son véhicule",
  cat: "Mobilite",
  resume: "Un ordre imposé, une pièce à obtenir à chaque étape, et six mois après la déclaration d'arrivée pour tout boucler.",
  tags: ["voiture", "véhicule", "immatriculation", "snca", "snct", "contrôle technique", "plaque", "import",
         "occasion", "vignette 705", "douanes", "carte grise", "acte de vente", "car-pass", "france", "belgique",
         "allemagne", "certificat de conformité", "cession", "droit de chancellerie", "timbre"],

  guide: {
    reperes: [
      { k: "Délai", v: "6 mois", d: "après la déclaration d'arrivée à la commune" },
      { k: "Coût", v: "50 €", d: "droit de chancellerie, hors plaques et contrôle" },
      { k: "Dépôt", v: "SNCA", d: "sur rendez-vous, plaques déjà faites" }
    ],

    cas: {
      titre: "Votre cas",
      items: [
        { t: "Mon véhicule vient d'un pays de l'Union", d: "La procédure complète, ci-dessous.", actif: true },
        { t: "J'achète une occasion déjà immatriculée au Luxembourg", d: "Le vendeur vous remet les deux parties du certificat et un document-facture. Vous assurez le véhicule." },
        { t: "J'achète neuf chez un concessionnaire", d: "Il immatricule pour vous. Il vous reste l'assurance." }
      ]
    },

    onglets: [
      {
        id: "etapes", titre: "Étapes",
        blocs: [
          { note: "Dans cet ordre : chaque étape donne une pièce que la suivante demande, et la SNCA refuse un dossier incomplet." },
          { etapes: [
            {
              t: "Réserver un numéro, puis faire les plaques",
              d: "Numéro de la série courante ou numéro personnalisé. Dès la confirmation, faites fabriquer les plaques chez un fabricant agréé au Luxembourg : elles sont demandées au rendez-vous.",
              ou: ["En ligne sur MyGuichet.lu", "Ou nplaques@snca.lu, (+352) 26 62 64 00"],
              cout: "Sans supplément en série courante, 200 € pour un numéro personnalisé",
              obtenez: "La réservation du numéro, puis les plaques"
            },
            {
              t: "Assurer le véhicule",
              d: "Responsabilité civile, auprès d'une compagnie agréée au Luxembourg. L'attestation fait partie du dossier : l'assurance vient avant le dépôt.",
              obtenez: "L'attestation d'assurance",
              lien: { t: "Avant de résilier l'ancien contrat, réclamez le relevé d'information", fiche: "assurance_auto" }
            },
            {
              t: "Payer le droit de chancellerie",
              d: "Au guichet de l'Administration de l'enregistrement, des domaines et de la TVA, ou par virement. Le timbre se vend aussi à la SNCA, avec 3 € de frais.",
              ou: ["Virement à AED-GUICHET UNIQUE-TIMBRES", "IBAN LU76 0019 5955 4404 7000, BIC BCEELULL"],
              cout: "50 €",
              obtenez: "Le timbre, ou la preuve de virement avec nom, prénom, motif, numéro d'immatriculation et numéro de châssis"
            },
            {
              t: "Obtenir la vignette 705 aux douanes",
              d: "Exigée pour tout véhicule venu d'un autre État membre, même quand aucune TVA n'est due. Le véhicule doit être présenté s'il a plus de six mois et plus de 6 000 km.",
              ou: ["Centre douanier Luxembourg-Howald, 1 rue in Bouler (Croix de Gasperich), L-1350 Luxembourg, (+352) 281 84 499",
                   "Centre douanier Nord, 2 rue Clairefontaine, L-9290 Diekirch, (+352) 81 70 45 1",
                   "Lundi à vendredi, 8 h à 17 h"],
              apportez: "Le véhicule, le certificat d'immatriculation étranger, la facture ou le contrat de vente, une pièce d'identité",
              obtenez: "La vignette 705"
            },
            {
              t: "Déposer le dossier à la SNCA",
              d: "Sur rendez-vous, dans le centre de votre choix. Vérifiez avant que le contrôle technique tient la durée luxembourgeoise.",
              ou: ["Sandweiler, 11 rue de Luxembourg, L-5230 Sandweiler",
                   "Esch-sur-Alzette, 22 rue Jos Kieffer, L-4149 Esch-sur-Alzette",
                   "Fridhaff, 8 rue Fridhaff, L-9379 Diekirch",
                   "(+352) 26 62 64 00, lundi à vendredi, 7 h 30 à 16 h 30"],
              apportez: "Le dossier complet et les plaques",
              onglet: { t: "Voir le dossier à cocher", id: "dossier" },
              obtenez: "Le certificat d'immatriculation à votre nom, et une vignette fiscale provisoire de 30 jours"
            }
          ] },
          { note: "Ensuite, les douanes vous facturent la taxe sur les véhicules. La vignette provisoire couvre l'attente." }
        ]
      },
      {
        id: "dossier", titre: "Dossier",
        blocs: [
          { cocher: "dossier", items: [
            { t: "Formulaire « Demande en obtention d'un certificat d'immatriculation », signé",
              lien: { t: "Sur Guichet.lu", u: "https://guichet.public.lu/fr/citoyens/transport/transports-individuels/vehicule-motorise/immatriculer-vehicule/vehicule-demenagement-transfrontalier.html" } },
            { t: "Droit de chancellerie", d: "Le timbre, ou la preuve de virement." },
            { t: "Attestation d'assurance en cours de validité" },
            { t: "Vignette 705" },
            { t: "Certificat d'immatriculation étranger, complet", d: "Dans l'Union, il a en général deux parties." },
            { t: "Certificat de conformité européen", d: "Si la première immatriculation date d'après le 1er février 2016." },
            { t: "Certificat de contrôle technique valable", d: "Si le véhicule y est soumis. Voir Cas particuliers." },
            { t: "Facture ou contrat de vente", d: "Sans lui, vous êtes inscrit titulaire, pas propriétaire." },
            { t: "Pièce d'identité", d: "Quelqu'un dépose pour vous : un mandat et une copie de votre pièce d'identité." },
            { t: "Plaques luxembourgeoises", d: "Fabriquées avant le rendez-vous." }
          ] }
        ]
      },
      {
        id: "vendeur", titre: "Vendeur",
        blocs: [
          "La procédure luxembourgeoise est la même partout. Ce qui change, ce sont les pièces que le vendeur vous remet et ce qu'il doit faire chez lui. S'il oublie, votre dossier est incomplet, ou il continue de recevoir les amendes.",
          { pays: [
            { t: "France", colonnes: [
              { h: "Il vous remet", l: [
                "La carte grise barrée : « vendu le », date, heure, signature",
                "Le certificat de cession, Cerfa 15776, en deux exemplaires",
                "Le code de cession",
                "Un certificat de situation administrative de moins de 15 jours",
                "Le contrôle technique de moins de 6 mois, si le véhicule a plus de 4 ans"] },
              { h: "Il fait chez lui", l: [
                "Déclarer la cession en ligne dans les 15 jours, ce qui produit le code de cession"] }
            ] },
            { t: "Belgique", colonnes: [
              { h: "Il vous remet", l: [
                "Les deux parties du certificat d'immatriculation",
                "Le certificat de conformité",
                "Le Car-Pass, obligatoire, qui retrace le kilométrage",
                "Le contrôle technique en vue de la vente"] },
              { h: "Il fait chez lui", l: [
                "Garder sa plaque, qui est personnelle, et la faire radier auprès de la DIV"] }
            ] },
            { t: "Allemagne", colonnes: [
              { h: "Il vous remet", l: [
                "Les deux parties du certificat : Zulassungsbescheinigung Teil I et Teil II",
                "Le procès-verbal du dernier contrôle technique"] },
              { h: "Il fait chez lui", l: [
                "Remettre les plaques allemandes",
                "Demander une plaque d'exportation pour rouler jusqu'ici, sans désimmatriculation préalable"] }
            ] }
          ] }
        ]
      },
      {
        id: "couts", titre: "Coûts",
        blocs: [
          { tableau: {
            colonnes: ["Poste", "Montant"],
            lignes: [
              ["Droit de chancellerie", "50 €"],
              ["Timbre acheté à la SNCA", "+ 3 €"],
              ["Numéro de la série courante", "sans supplément"],
              ["Numéro personnalisé", "+ 200 €"],
              ["Transfert d'un numéro personnalisé", "+ 24 €"],
              ["Plaques", "prix du fabricant"],
              ["Contrôle technique au Luxembourg, si nécessaire", "98,50 €"],
              ["TVA", "seulement si le véhicule est neuf au sens fiscal"],
              ["Taxe sur les véhicules", "selon le véhicule, facturée par les douanes"]
            ]
          } },
          { note: "Le contrôle technique au Luxembourg : 77 € pour une voiture, plus 21,50 € de frais administratifs pour un véhicule importé (SNCT, prix au 2 mai 2025)." }
        ]
      },
      {
        id: "cas", titre: "Cas particuliers",
        blocs: [
          { plis: [
            { t: "Le certificat n'est pas au nom du vendeur", p: [
              "Un acte de vente signé par les deux parties, daté, avec le numéro de châssis, établit la propriété. Une facture de professionnel aussi.",
              "Si le certificat porte un autre nom que celui du vendeur, demandez la chaîne complète : l'acte entre la personne inscrite et votre vendeur, puis le vôtre.",
              "Sans aucune de ces pièces, la SNCA vous inscrit comme titulaire, et le certificat dit que vous n'êtes pas identifié comme propriétaire. Vous roulez, assurez et payez la taxe, mais la revente et les litiges se compliquent."] },
            { t: "Le contrôle technique passé à l'étranger", p: [
              "Un certificat passé dans un autre État membre ou en Suisse reste valable, mais pour la durée prévue au Luxembourg : premier contrôle 4 ans après la première mise en circulation, le suivant 2 ans plus tard, puis chaque année.",
              "Exemple : une voiture de plus de six ans contrôlée en France il y a plus d'un an doit repasser le contrôle.",
              "Le plus simple est de le refaire dans le pays d'origine avant le dépôt. Un centre luxembourgeois peut refuser un véhicule encore en plaques étrangères : un refus a été constaté en septembre 2026."] },
            { t: "Rouler avant l'immatriculation", p: [
              "Avec les plaques qui portent votre futur numéro et une assurance responsabilité civile, vous pouvez conduire le véhicule jusqu'au lieu d'immatriculation, et jusqu'à un garage ou un contrôle technique."] }
          ] }
        ]
      }
    ]
  },

  aRetenir: [
    "Ordre : numéro et plaques, assurance, droit de chancellerie, vignette 705, SNCA.",
    "Les plaques se font avant le rendez-vous SNCA.",
    "La vignette 705 est exigée même sans TVA à payer.",
    "Sans acte de vente, vous êtes titulaire, pas propriétaire.",
    "Six mois après la déclaration d'arrivée."
  ],

  sources: [
    { t: "Guichet.lu, immatriculer un véhicule lors d'un déménagement", u: "https://guichet.public.lu/fr/citoyens/transport/transports-individuels/vehicule-motorise/immatriculer-vehicule/vehicule-demenagement-transfrontalier.html" },
    { t: "SNCA, véhicule d'occasion immatriculé dans l'Union", u: "https://snca.public.lu/fr/vehicules/immatriculation/immatriculer-vehicule-occasion/vehicule-immatricule-eu.html" },
    { t: "Douanes, émission de la vignette 705", u: "https://douanes.public.lu/fr/vehicules/Emission_vignette_705.html" },
    { t: "Douanes, questions sur les véhicules", u: "https://douanes.public.lu/fr/support/faq/faq-vehicules.html" },
    { t: "Guichet.lu, acheter un véhicule immatriculé au Luxembourg", u: "https://guichet.public.lu/fr/citoyens/transport/transports-individuels/vehicule-motorise/immatriculer-vehicule/acheter-vehicule-luxembourg.html" },
    { t: "Guichet.lu, conformité du véhicule", u: "https://guichet.public.lu/fr/citoyens/transport/transports-individuels/vehicule-motorise/immatriculer-vehicule/conformite-vehicule.html" },
    { t: "Guichet.lu, contrôle technique", u: "https://guichet.public.lu/fr/citoyens/transport/transports-individuels/vehicule-motorise/controle-technique-pneumatiques/controle-technique-obligatoire-vehicule.html" },
    { t: "SNCT, prix du contrôle technique", u: "https://snct.lu/prix/" },
    { t: "France, déclarer la cession d'un véhicule", u: "https://immatriculation.ants.gouv.fr/" },
    { t: "France, certificat de cession Cerfa 15776", u: "https://www.formulaires.service-public.gouv.fr/gf/cerfa_15776.do" },
    { t: "Belgique, exporter un véhicule", u: "https://mobilit.belgium.be/fr/route/immatriculer-et-radier/exporter-un-vehicule-plaque-x" },
    { t: "Belgique, Car-Pass", u: "https://www.car-pass.be/fr" },
    { t: "Allemagne, plaque d'exportation, service de Berlin", u: "https://service.berlin.de/dienstleistung/121476/" }
  ]
};
