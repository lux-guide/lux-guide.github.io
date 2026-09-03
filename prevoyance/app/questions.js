// Repertoire de questions-reponses, ecrites et relues a l'avance.
//
// REGLE 1 : aucun montant n'est ecrit dans une reponse. Les textes portent des
// marques, {plafond}, {plafondPrecedent}, {annee}, {sortieMin}, {sortieMax},
// {duree}, {ageMax}, remplies depuis window.PREVOYANCE.table. Un test verifie
// qu'aucune reponse ne contient de chiffre de loi en dur.
//
// REGLE 2 : pas de source, pas de reponse. Une entree sans `sources` ne sort
// jamais, ni dans la foire aux questions ni dans l'assistant.
//
// REGLE 3 : les `variantes` servent a la fois la reconnaissance de l'assistant
// et le filtre de la foire aux questions. Les deux repondent donc la meme chose
// aux memes mots, ce qui ne serait pas le cas avec deux mecanismes separes.

window.QUESTIONS = (function () {
  "use strict";

  var ACD = { t: "Administration des contributions directes, prévoyance-vieillesse",
              u: "https://impotsdirects.public.lu/fr/az/p/prevoyance_vieillesse.html", officielle: true };
  var GUI = { t: "Guichet.lu, déduire les primes d'un contrat de prévoyance-vieillesse",
              u: "https://guichet.public.lu/fr/citoyens/fiscalite/declaration-impot-decompte/depenses-deductibles/contrat-prevoyance-resident.html", officielle: true };
  var GOU = { t: "Gouvernement luxembourgeois, nouveautés 2026",
              u: "https://gouvernement.lu/fr/actualites/toutes_actualites/articles/2025/12-decembre/nouveautes-2026.html", officielle: true };

  var THEMES = [
    { id: "principe", nom: "Le principe" },
    { id: "plafond", nom: "Combien déduire" },
    { id: "eligibilite", nom: "Qui y a droit" },
    { id: "versement", nom: "Verser" },
    { id: "sortie", nom: "Récupérer l'épargne" },
    { id: "impot", nom: "La déclaration" },
    { id: "placement", nom: "Le placement" },
    { id: "vie", nom: "Quand la vie change" }
  ];

  var ENTREES = [
    {
      id: "cest-quoi",
      theme: "principe",
      question: "Qu'est-ce que la prévoyance-vieillesse, ou 111bis ?",
      variantes: ["111bis", "111 bis", "prevoyance vieillesse", "c'est quoi", "definition",
                  "troisieme pilier", "epargne retraite", "en quoi ca consiste"],
      reponse: "C'est une épargne retraite individuelle que l'État encourage par une déduction " +
        "fiscale. Ce que vous versez sur un contrat de prévoyance-vieillesse sort de votre revenu " +
        "imposable, dans la limite de {plafond} par personne et par an. En contrepartie, c'est une " +
        "épargne de long terme : le contrat doit durer au moins {duree} ans, et l'argent n'est " +
        "récupérable qu'entre {sortieMin} et {sortieMax} ans.",
      reserve: "L'avantage dépend de votre taux d'imposition : le même versement ne rend pas la " +
        "même chose à tout le monde.",
      sources: [ACD, GUI],
      voisines: ["plafond-montant", "qui-a-droit", "mythe-10-ans"],
      ouvreSimulateur: true
    },
    {
      id: "plafond-montant",
      theme: "plafond",
      question: "Combien puis-je déduire par an ?",
      variantes: ["plafond", "combien", "maximum", "montant deductible", "limite", "combien deduire",
                  "jusqu'a combien"],
      reponse: "Jusqu'à {plafond} par personne et par an depuis le 1er janvier {annee}. Le plafond " +
        "était de {plafondPrecedent} auparavant. Il ne dépend pas de votre âge.",
      reserve: null,
      sources: [GOU, ACD],
      voisines: ["plafond-couple", "report"],
      ouvreSimulateur: true
    },
    {
      id: "plafond-couple",
      theme: "plafond",
      question: "Le plafond est-il doublé pour un couple ?",
      variantes: ["couple", "conjoint", "marie", "partenaire", "deux", "ensemble", "menage",
                  "declaration commune", "epoux"],
      reponse: "Le plafond s'apprécie par personne. Un couple imposé collectivement où chacun a " +
        "son propre contrat compte donc {plafond} chacun. Un seul contrat ouvert au nom d'une " +
        "seule personne ne donne droit qu'à un seul plafond : ce n'est jamais un contrat joint, " +
        "chacun souscrit le sien, à son nom.",
      reserve: null,
      sources: [ACD],
      voisines: ["plafond-montant"],
      ouvreSimulateur: true
    },
    {
      id: "report",
      theme: "plafond",
      question: "Puis-je reporter ce que je n'ai pas versé sur l'année suivante ?",
      variantes: ["report", "reporter", "annee suivante", "pas verse", "rattraper", "perdu",
                  "cumuler", "reliquat"],
      reponse: "Non. Le plafond ne se reporte pas : ce que vous ne versez pas dans l'année est " +
        "définitivement perdu pour cette année-là. C'est ce qui rend le versement de fin d'année " +
        "utile quand le plafond n'est pas atteint.",
      reserve: null,
      sources: [ACD],
      voisines: ["plafond-montant", "quand-verser"]
    },
    {
      id: "qui-a-droit",
      theme: "eligibilite",
      question: "Qui peut en bénéficier ?",
      variantes: ["qui", "droit", "eligible", "beneficier", "conditions", "peut on", "acces"],
      reponse: "Toute personne imposée au Luxembourg, et la souscription doit intervenir avant " +
        "{ageMax} ans. Ce n'est pas réservé aux nouveaux arrivants : le dispositif s'ouvre à tout " +
        "contribuable luxembourgeois, quelle que soit la durée de sa présence dans le pays.",
      reserve: null,
      sources: [ACD, GUI],
      voisines: ["frontalier", "age-limite"]
    },
    {
      id: "frontalier",
      theme: "eligibilite",
      question: "Un frontalier y a-t-il droit ?",
      variantes: ["frontalier", "frontaliere", "france", "belgique", "allemagne", "j'habite",
                  "je vis a l'etranger", "resident", "residence", "non resident", "j'habite pas au luxembourg"],
      reponse: "Oui, si vous êtes imposé au Luxembourg. C'est le lieu d'imposition qui décide, pas " +
        "le lieu d'habitation. Un frontalier imposé au Luxembourg y a droit ; un résident imposé " +
        "ailleurs n'y a pas droit. C'est la confusion la plus fréquente sur ce dispositif.",
      reserve: "Un frontalier non résident doit remplir les conditions d'assimilation au résident " +
        "pour faire valoir cette dépense spéciale. Le point se vérifie auprès de l'administration.",
      sources: [ACD, GUI],
      voisines: ["qui-a-droit", "declarer"]
    },
    {
      id: "age-limite",
      theme: "eligibilite",
      question: "Y a-t-il un âge limite pour souscrire ?",
      variantes: ["age", "limite", "trop tard", "trop vieux", "65", "souscrire", "ouvrir un contrat",
                  "a quel age"],
      reponse: "La souscription doit intervenir avant {ageMax} ans. Le contrat doit ensuite durer " +
        "au moins {duree} ans, ce qui suppose de le tenir jusqu'à {sortieMin} ans au minimum.",
      reserve: null,
      sources: [ACD],
      voisines: ["qui-a-droit", "quand-recuperer"]
    },
    {
      id: "quand-verser",
      theme: "versement",
      question: "Quand faut-il verser ?",
      variantes: ["quand verser", "date", "avant quelle date", "fin d'annee", "decembre", "moment",
                  "delai de versement", "mensuel"],
      reponse: "Les versements comptent pour l'année civile au cours de laquelle ils sont faits. " +
        "Ils peuvent être mensuels, ponctuels, ou concentrés en fin d'année. Le plafond de " +
        "{plafond} s'apprécie sur l'ensemble des versements de l'année.",
      reserve: "Vérifiez auprès de votre organisme le dernier jour utile de l'année : un virement " +
        "passé le 31 décembre au soir n'est pas toujours encaissé sur l'exercice.",
      sources: [ACD],
      voisines: ["report", "declarer"]
    },
    {
      id: "arreter",
      theme: "versement",
      question: "Puis-je arrêter ou réduire mes versements ?",
      variantes: ["arreter", "suspendre", "reduire", "stopper", "pause", "diminuer", "changer le montant"],
      reponse: "Les modalités de versement relèvent de votre contrat et non de la loi fiscale. " +
        "La loi fixe le plafond déductible, pas l'obligation de verser : une année sans versement " +
        "ne remet pas en cause les déductions passées, elle fait seulement perdre le plafond de " +
        "l'année.",
      reserve: "Les conditions de suspension varient d'un contrat à l'autre : c'est votre contrat " +
        "qui fait foi, pas cette page.",
      sources: [ACD],
      voisines: ["report"]
    },
    {
      id: "quand-recuperer",
      theme: "sortie",
      question: "Quand puis-je récupérer mon épargne ?",
      variantes: ["recuperer", "sortie", "quand", "disponible", "recuperation", "toucher",
                  "60 ans", "retrait", "debloquer"],
      reponse: "Entre {sortieMin} et {sortieMax} ans, et à condition que le contrat ait duré au " +
        "moins {duree} ans. Avant {sortieMin} ans, l'épargne n'est pas disponible.",
      reserve: null,
      sources: [ACD, GUI],
      voisines: ["forme-sortie", "avant-60"]
    },
    {
      id: "forme-sortie",
      theme: "sortie",
      question: "Sous quelle forme l'épargne est-elle versée ?",
      variantes: ["forme", "capital", "rente", "viagere", "comment je recupere", "mensualite",
                  "en une fois"],
      reponse: "En capital, en rente viagère, ou en combinant les deux. Le capital est imposé à la " +
        "moitié du taux global, la rente viagère sur la moitié de son montant.",
      reserve: "L'imposition dépend de votre situation à la sortie, pas de celle d'aujourd'hui.",
      sources: [ACD],
      voisines: ["quand-recuperer", "impot-sortie"]
    },
    {
      id: "avant-60",
      theme: "sortie",
      question: "Puis-je sortir avant soixante ans ?",
      variantes: ["avant", "anticipe", "rachat", "urgence", "besoin d'argent", "sortir plus tot",
                  "recuperer avant", "casser le contrat", "maladie", "invalidite"],
      reponse: "Le texte officiel dit deux choses qu'il faut lire ensemble. D'une part, un " +
        "remboursement anticipé pour un motif autre que la maladie grave ou l'invalidité est " +
        "intégralement imposé au taux normal, ce qui annule l'avantage obtenu jusque-là. D'autre " +
        "part, ce même texte qualifie d'exclu le remboursement anticipé avant que les conditions " +
        "minimales soient remplies.",
      reserve: "Les deux formulations coexistent dans la source officielle et ce site ne tranche " +
        "pas à sa place. Ce qui est certain : il ne faut pas compter sur cette épargne comme sur " +
        "une réserve disponible. Si la question compte pour vous, faites-vous répondre par écrit " +
        "par l'assureur et par l'administration avant de signer.",
      sources: [ACD, GUI],
      voisines: ["quand-recuperer", "mythe-10-ans"]
    },
    {
      id: "impot-sortie",
      theme: "sortie",
      question: "Comment la sortie est-elle imposée ?",
      variantes: ["imposition", "impot a la sortie", "taxe", "fiscalite sortie", "combien d'impot",
                  "taux global"],
      reponse: "Le capital est imposé à la moitié du taux global. La rente viagère est imposée sur " +
        "la moitié de son montant. Un remboursement anticipé, lui, est imposé au taux plein.",
      reserve: null,
      sources: [ACD],
      voisines: ["forme-sortie", "avant-60"]
    },
    {
      id: "declarer",
      theme: "impot",
      question: "Comment déclarer les versements ?",
      variantes: ["declarer", "declaration", "case", "formulaire", "impots", "comment faire",
                  "ou mettre", "certificat"],
      reponse: "Les versements se portent en dépenses spéciales dans la déclaration d'impôt, sur " +
        "justificatif de l'organisme. Rien n'est automatique : sans la ligne dans la déclaration, " +
        "le versement ne produit aucun effet fiscal. C'est l'étape la plus souvent oubliée.",
      reserve: null,
      sources: [GUI],
      voisines: ["frontalier", "quand-verser"]
    },
    {
      id: "combien-ca-rend",
      theme: "impot",
      question: "Combien cela me rapporte-t-il vraiment ?",
      variantes: ["rapporte", "gain", "economie", "ca rend quoi", "interet", "avantage",
                  "combien je gagne", "rentable"],
      reponse: "L'économie est votre versement multiplié par votre taux d'imposition. Un même " +
        "versement ne rend donc pas la même chose selon le revenu. Le simulateur de ce site rend " +
        "une colonne par taux plutôt que d'en supposer un.",
      reserve: "Ce site ne devine pas votre taux d'imposition, et ne calcule pas le capital que " +
        "vous récupérerez à la sortie.",
      sources: [ACD],
      voisines: ["plafond-montant"],
      ouvreSimulateur: true
    },
    {
      id: "supports",
      theme: "placement",
      question: "Sur quoi l'argent est-il placé ?",
      variantes: ["placement", "support", "fonds", "investissement", "actions", "risque",
                  "ou est place", "rendement", "performance"],
      reponse: "Le placement dépend du contrat choisi et non de la loi. La loi fixe la déduction " +
        "fiscale, elle ne garantit aucun rendement. Les supports, leur composition et leurs frais " +
        "figurent dans la documentation du contrat.",
      reserve: "Ce site ne compare aucun contrat et n'avance aucun chiffre de performance : il " +
        "faudrait un document daté indiquant le support, la période, les frais et l'indice de " +
        "référence.",
      sources: [ACD],
      voisines: ["combien-ca-rend"]
    },
    {
      id: "vs-epargne-logement",
      theme: "placement",
      question: "Vaut-il mieux que l'épargne-logement ?",
      variantes: ["epargne logement", "comparer", "mieux", "plutot que", "difference", "choisir entre",
                  "lequel"],
      reponse: "Ce sont deux plafonds distincts qui s'ajoutent, pas deux options entre lesquelles " +
        "choisir. Ils ne servent pas au même projet : l'épargne-logement prépare un achat, la " +
        "prévoyance-vieillesse prépare la retraite et se bloque jusqu'à {sortieMin} ans.",
      reserve: null,
      sources: [GUI],
      voisines: ["plafond-montant"],
      ouvreSimulateur: true
    },
    {
      id: "demenagement",
      theme: "vie",
      question: "Que se passe-t-il si je quitte le Luxembourg ?",
      variantes: ["demenagement", "partir", "quitter", "expatriation", "je pars", "changement de pays",
                  "je demenage"],
      reponse: "La déduction suppose d'être imposé au Luxembourg : elle cesse pour les années où " +
        "vous ne l'êtes plus. Le contrat, lui, suit ses propres règles et l'épargne déjà constituée " +
        "reste soumise aux conditions de sortie, entre {sortieMin} et {sortieMax} ans.",
      reserve: "Le traitement fiscal dans le nouveau pays de résidence n'est pas traité ici : il " +
        "dépend de la convention applicable.",
      sources: [ACD],
      voisines: ["frontalier", "quand-recuperer"]
    },
    {
      id: "deces",
      theme: "vie",
      question: "Que devient l'épargne en cas de décès ?",
      variantes: ["deces", "mort", "beneficiaire", "heritier", "succession", "si je meurs",
                  "transmission"],
      reponse: "Le sort de l'épargne au décès est fixé par le contrat, notamment par la clause " +
        "bénéficiaire. Ce n'est pas la loi fiscale qui le règle, et cela ne se déduit pas des " +
        "règles de déduction.",
      reserve: "Point à faire préciser par écrit avant de signer : la clause bénéficiaire et son " +
        "traitement successoral varient d'un contrat à l'autre.",
      sources: [ACD],
      voisines: ["forme-sortie"]
    },
    {
      id: "mythe-10-ans",
      theme: "principe",
      question: "L'argent est-il bloqué pendant dix ans ?",
      variantes: ["bloque", "blocage", "dix ans", "10 ans", "immobilise", "fige", "mythe",
                  "combien de temps bloque", "duree du blocage"],
      reponse: "Non, et c'est l'idée fausse la plus répandue sur ce dispositif. Ce n'est pas " +
        "l'argent qui est immobilisé {duree} ans, c'est le contrat qui doit durer au moins " +
        "{duree} ans. La différence est concrète : quelqu'un qui souscrit à 55 ans ne pourra pas " +
        "récupérer son épargne à {sortieMin} ans, mais à 65, parce que le contrat n'aura pas " +
        "atteint sa durée minimale.",
      reserve: "L'échéance réelle est donc la plus tardive des deux dates : {sortieMin} ans, ou " +
        "l'année de souscription plus {duree} ans.",
      sources: [ACD, GUI],
      voisines: ["quand-recuperer", "avant-60"],
      ouvreSimulateur: true
    },
    {
      id: "un-seul-contrat",
      theme: "sortie",
      question: "Puis-je récupérer seulement une partie de mon épargne ?",
      variantes: ["partiel", "une partie", "rachat partiel", "tout ou rien", "plusieurs contrats",
                  "diviser", "fractionner", "un peu", "la moitie"],
      reponse: "Un contrat se dénoue en une fois : il n'y a pas de retrait partiel. Si vous avez " +
        "besoin d'une somme et que vous ne disposez que d'un contrat, c'est l'ensemble qui se " +
        "dénoue. C'est la raison pour laquelle plusieurs contrats de montants plus petits valent " +
        "souvent mieux qu'un seul gros : on n'en dénoue qu'un, les autres continuent.",
      reserve: "Ce point relève des conditions du contrat et non du texte fiscal, qui ne le règle " +
        "pas. À faire confirmer par écrit avant de signer.",
      sources: [ACD],
      voisines: ["avant-60", "echelonner"]
    },
    {
      id: "echelonner",
      theme: "sortie",
      question: "Y a-t-il un intérêt à étaler la sortie sur plusieurs années ?",
      variantes: ["etaler", "echelonner", "plusieurs annees", "repartir", "sortir en plusieurs fois",
                  "optimiser la sortie", "moins d'impot a la sortie"],
      reponse: "Oui, mécaniquement. La sortie est imposée à la moitié de votre taux moyen, et ce " +
        "taux moyen dépend de l'ensemble de vos revenus de l'année. Récupérer une grosse somme " +
        "d'un coup fait monter ce taux ; la récupérer par morceaux, sur des années où les autres " +
        "revenus sont plus faibles, le fait moins monter.",
      reserve: "Cela suppose d'avoir plusieurs contrats, puisqu'un contrat se dénoue en une fois. " +
        "Le calcul exact dépend de vos revenus de chaque année.",
      sources: [ACD],
      voisines: ["un-seul-contrat", "impot-sortie"]
    },
    {
      id: "marginal-vs-moyen",
      theme: "impot",
      question: "À quel taux la déduction est-elle valorisée ?",
      variantes: ["quel taux", "taux marginal", "tranche", "taux moyen", "comment c'est calcule",
                  "sur quel taux", "derniere tranche"],
      reponse: "À l'entrée, le versement sort du haut de vos revenus : il est donc valorisé à " +
        "votre tranche la plus élevée, celle où se situe votre dernier euro imposé. À la sortie, " +
        "l'épargne est imposée à la moitié de votre taux moyen, qui est plus bas qu'une tranche " +
        "haute puisqu'il mélange toutes vos tranches, y compris celles à zéro. C'est cette " +
        "asymétrie entre l'entrée et la sortie qui fait l'intérêt du dispositif.",
      reserve: "Les deux taux dépendent de votre situation, à l'entrée comme à la sortie. Ce site " +
        "ne les calcule pas : il rend une colonne par taux et vous vous situez.",
      sources: [ACD],
      voisines: ["combien-ca-rend", "impot-sortie"],
      ouvreSimulateur: true
    },
    {
      id: "quand-largent-revient",
      theme: "impot",
      question: "Quand l'argent de la déduction revient-il ?",
      variantes: ["quand je recupere l'avantage", "remboursement", "quand rembourse",
                  "l'annee suivante", "delai", "quand je touche"],
      reponse: "L'année suivante, au moment du décompte de votre déclaration. Vous versez au " +
        "cours de l'année, vous portez ces versements dans la déclaration, et l'administration " +
        "régularise ensuite. L'avantage n'est donc pas immédiat au moment du versement.",
      reserve: null,
      sources: [GUI],
      voisines: ["declarer", "combien-ca-rend"]
    },
    {
      id: "conjoint-etranger",
      theme: "plafond",
      question: "Mon conjoint qui travaille à l'étranger peut-il en ouvrir un ?",
      variantes: ["conjoint travaille en france", "conjoint etranger", "femme travaille",
                  "mari travaille", "declaration commune", "conjoint sans lien"],
      reponse: "Oui, dès lors que vous faites une déclaration commune au Luxembourg. Ce qui ouvre " +
        "le droit, c'est la qualité de contribuable luxembourgeois, que la déclaration commune " +
        "confère aux deux conjoints. Un conjoint qui travaille à l'étranger et n'a par ailleurs " +
        "aucun lien avec le Luxembourg peut donc avoir son propre contrat, et le foyer compte " +
        "alors deux fois {plafond}.",
      reserve: "Ce n'est jamais un contrat joint : chacun souscrit le sien, à son nom. Le point " +
        "mérite d'être confirmé auprès de l'administration au vu de votre situation exacte.",
      sources: [ACD, GUI],
      voisines: ["plafond-couple", "frontalier"],
      ouvreSimulateur: true
    },
    {
      id: "assurance-vie",
      theme: "principe",
      question: "Quelle est la nature juridique du contrat ?",
      variantes: ["assurance vie", "nature", "type de contrat", "juridique", "c'est quoi comme contrat",
                  "beneficiaire", "clause beneficiaire"],
      reponse: "Le contrat prend la forme d'une assurance vie. C'est ce qui explique deux choses " +
        "qui surprennent : vous désignez des bénéficiaires, et le sort de l'épargne au décès " +
        "relève du droit successoral et non du droit fiscal de la déduction.",
      reserve: "Le droit applicable à la succession est en principe celui de votre pays de " +
        "résidence fiscale au moment du décès, ce qui peut changer si vous déménagez. Point à " +
        "faire préciser, il dépasse le cadre de ce site.",
      sources: [ACD],
      voisines: ["deces", "forme-sortie"]
    },
    {
      id: "divorce",
      theme: "vie",
      question: "Et en cas de divorce ou de séparation ?",
      variantes: ["divorce", "separation", "rupture", "partage", "si on se separe"],
      reponse: "La déduction est individuelle : chacun garde son contrat et son plafond. Le sort " +
        "du contrat lui-même relève du régime matrimonial et du contrat, pas de la règle fiscale.",
      reserve: "Un couple imposé collectivement change de mode d'imposition après la séparation, " +
        "ce qui modifie le taux et donc l'économie réalisée.",
      sources: [ACD],
      voisines: ["plafond-couple"]
    }
  ];

  // Ce que le site sait, et ce qu'il ne sait pas. Annonce avant qu'on lui parle :
  // un assistant qui laisse croire qu'il peut tout est juge sur ce qu'il ne fait
  // pas, celui qui annonce son perimetre est juge sur ce qu'il fait.
  var PERIMETRE = {
    sait: [
      "la déduction fiscale de la prévoyance-vieillesse, dite 111bis",
      "les plafonds, les conditions d'âge et de durée",
      "qui y a droit, y compris le cas des frontaliers",
      "quand et comment l'épargne se récupère, et comment elle est imposée",
      "comment déclarer les versements"
    ],
    neSaitPas: [
      "quel contrat choisir, et ce que vaut celui qu'on vous propose",
      "le rendement d'un placement, passé ou futur",
      "le capital que vous récupérerez à la sortie",
      "votre taux d'imposition réel, qui dépend de votre revenu et de votre classe",
      "tout ce qui touche à un dossier personnel : contrat, contact, versement"
    ]
  };

  return { themes: THEMES, entrees: ENTREES, perimetre: PERIMETRE };
})();
