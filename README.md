# S'installer au Luxembourg

Le nom dit exactement ce qu'est le site et n'a donc rien à expliquer. Deux tentatives de renommage
l'ont confirmé par l'absurde. « Moien », le bonjour luxembourgeois, obligeait le hero à consacrer
une phrase à traduire le mot, et s'adressait dans une langue locale à un public qui par définition
ne la parle pas encore. « Guide d'installation », censé rattraper le premier, désigne d'abord en
français le manuel de montage d'un appareil.

Le seul argument solide contre le nom d'origine était sa longueur, 223 px qui disparaissaient dès
qu'une fenêtre se resserrait. C'était un problème d'en-tête, résolu depuis autrement. Le nom tient
maintenant sur **deux lignes dans un cartouche**, comme un titre de collection : « S'installer »
en romain, « AU LUXEMBOURG » en petites capitales espacées en dessous. 149 px au lieu de 223, et
il ne disparaît à aucune largeur, jusqu'à 320 px.

Application autonome : un site d'information structuré, un simulateur de salaire net et un assistant conversationnel.

Le contenu est **entièrement générique et anonyme**. Aucune donnée personnelle n'y figure, ni dans le code, ni dans la base de connaissances.

---

## Démarrer

### Sans rien installer

Ouvrir `index.html` dans un navigateur. Tout fonctionne : fiches, recherche, parcours, simulateur, et l'assistant en mode local.

### Avec le serveur (assistant connecté à un modèle)

```
node server/server.js
```

Puis ouvrir http://localhost:8787. Node 18 ou supérieur suffit, il n'y a aucune dépendance npm.

Le serveur lit `API_KEY`, `BASE_URL` et `MODEL_CHAT` dans le `.env` à la racine du dépôt. La clé reste côté serveur et n'est jamais transmise au navigateur. Si la configuration est absente ou invalide, l'application bascule automatiquement en mode local, sans erreur visible pour l'utilisateur.

---

## Ce que contient l'application

| Onglet | Contenu |
|---|---|
| Accueil | Entrée par catégorie et questions les plus posées |
| Fiches | Fiches thématiques illustrées, recherche plein texte, filtrage selon le profil |
| Parcours | Frise chronologique personnalisée, étapes cochables (avancement conservé dans le navigateur) |
| Simulateur | Quatre sous-onglets : salaire net par classe d'impôt, capacité d'emprunt, arbre de décision de la classe, et onze simulateurs officiels |
| Comparateur | Quatre contrats habitation du marché luxembourgeois, sinistre par sinistre, clause citée |
| Carte | Comparaison de plusieurs logements : distances au lieu de travail, écoles, crèches, transports, commerces, santé (OpenStreetMap) |
| Assistant | Le seul chatbot de l'application : il construit un profil puis cible ses réponses, en pleine page, en panneau latéral ou en bulle. Son onglet porte un point qui respire : ce n'est pas une page de plus, c'est quelqu'un qui attend |
| Paramètres | Cinq onglets : apparence, profil, mes données, contenu, calcul |

Chaque fiche distingue deux registres : le corps, strictement officiel et sourcé, et un bloc « Astuces de la communauté » (retours d'expérience présentés comme tels, sans valeur officielle), porté par `app/communaute.js` qui est autonome et se modifie directement.

### La liste des fiches

Neuf photos pour trente-six fiches, une par catégorie : sur la grille, la même façade revenait cinq fois de suite et le même sapin illuminé quatre fois. Le lecteur ne distinguait plus les cartes, et la répétition ressemblait à un défaut de chargement plutôt qu'à un choix. La photo a quitté la grille. Elle reste là où elle a du sens, dans le bandeau de la fiche ouverte, et la page cesse de charger trente-six images.

À sa place, une identité de thème sobre : un filet de couleur sur le bord haut de chaque carte, une couleur par thème. Le thème se lit en balayant la colonne, sans lire l'étiquette.

Les fiches sont aussi **groupées par thème**, avec un intitulé et un compte. Trente-six cartes d'un bloc, toutes du même poids, ne disaient pas par où commencer. Dans un groupe, l'étiquette de chaque carte disparaît : elle répéterait le titre juste au-dessus. Elle revient dès que les cartes sont mêlées, après une recherche ou un filtrage par profil.

### Les catégories portent leurs accents

« Sante », « Impots », « Mobilite » s'affichaient tels quels dans les filtres. Ce sont des identifiants, clés des visuels et valeur de comparaison du filtre : ils gardent leur forme, et une table d'affichage les accentue, comme celle qui existe déjà pour les valeurs de profil.

### L'accueil ne recopie plus les sections

L'audit était net : sur les huit questions mises en avant sur l'accueil, sept étaient reprises telles quelles de la FAQ. En revanche les tuiles par thème n'étaient pas une redondance, parce que l'onglet Fiches n'avait aucun filtre par catégorie. L'accueil faisait le travail que Fiches aurait dû faire, puis renvoyait vers une liste que rien n'indiquait comme filtrée.

Deux conséquences. Le **filtre par thème est passé dans Fiches**, avec le compte par thème, là où sont les fiches. Et l'**accueil est devenu un tableau de bord** : la recherche, le hero, l'avancement du parcours s'il a commencé, puis une carte par section décrivant ce qu'elle contient, compte à l'appui. Il ne recopie plus aucun contenu.

### Paramètres

« Administration » ne disait rien au visiteur, alors que la moitié de ce panneau le concerne directement. C'est devenu **Paramètres**, en cinq onglets :

1. **Apparence** : le thème, en trois choix nommés. C'était un bouton qui tournait dans l'en-tête, où l'on ne savait jamais sur quel état on allait tomber.
2. **Profil** : ce que le guide sait de vous, modifiable champ par champ, avec un interrupteur « tout afficher, sans filtrage de profil » qui montre l'intégralité du contenu. Le profil porte aussi le pays d'origine, parce que ce qui surprend en arrivant n'est pas le même selon d'où l'on vient.
3. **Mes données** : ce qui est enregistré, où, et combien. Un bouton efface tout, avec confirmation.
4. **Contenu** : l'éditeur de fiches et l'export de `kb.js`.
5. **Calcul** : les paramètres du simulateur.

L'ancre `#admin` continue de fonctionner.

### Protection des données

Le guide n'a ni compte, ni serveur, ni mesure d'audience. Tout reste dans la mémoire locale du navigateur, et l'onglet **Mes données** liste les dix clés utilisées, leur contenu et leur taille.

Une exception est écrite noir sur blanc plutôt que passée sous silence : l'onglet Carte interroge Nominatim et Overpass, deux services publics basés sur OpenStreetMap. Les adresses saisies leur sont donc bien transmises, avec l'adresse IP, comme pour n'importe quelle recherche cartographique. Les autres onglets ne font aucun appel réseau.

Navigation directe possible par ancre : `index.html#simulateur`, `#assistant`, `#fiche/banque`, etc.

## Responsive

Vérifié par un audit automatique sur onze appareils réels, portrait et paysage (iPhone SE, iPhone 14 et Pro Max, Android courant, iPad Mini, iPad, iPad Air, iPad Pro, portable 13 pouces), qui contrôle deux choses sur chacun des huit onglets : le débordement horizontal de la page, et la taille des cibles tactiles.

Résultat tenu : zéro débordement partout, et plus aucune cible sous 32 px, hors le lien d'attribution OpenStreetMap dans la carte, qui est une mention légale standard et non une cible d'interaction. Sur pointeur grossier (`pointer: coarse`), les cases à cocher passent à 22 px avec une zone touchable de 44 px, les liens de sources et les puces gagnent une hauteur minimale, les boutons de zoom de la carte passent à 42 px, et les champs de saisie sont à 16 px pour éviter le zoom automatique d'iOS.

### L'en-tête

Il passait sur deux, parfois trois lignes entre 700 et 1200 px, avec le sélecteur de thème rejeté seul sur sa ligne : le contenu de la page sautait à chaque redimensionnement. La règle est maintenant qu'il ne se replie jamais (`flex-wrap: nowrap` sur `.top-in`). Quand la place manque, les éléments cèdent dans un ordre décidé :

1. Sous **1100 px**, les sections se resserrent : moins de rembourrage, police à 13,5 px.
2. Sous **1040 px**, la marque et le nom se réduisent légèrement.
3. Sous **840 px**, l'en-tête se resserre une dernière fois, ce qui garde les huit sections entièrement visibles jusque vers 765 px.
4. Sous **765 px**, la bande de sections défile, avec un fondu du côté où il reste des entrées (`data-defile`, posé par `majDefilementOnglets`, préfixé pour Safari). L'onglet sélectionné est ramené dans le champ de vision à chaque changement de page, et la molette verticale fait défiler la bande à la souris, où le geste horizontal n'existe pas.

Trois décisions de fond derrière ce classement. D'abord, **l'administration n'est plus un onglet** : ce n'est pas une section du guide mais un outil, elle est devenue le bouton Paramètres à droite. Ensuite, **la marque est dessinée pour tenir seule** : une maison avec sa porte, en SVG, lisible à 30 px, là où un carré dégradé vide n'était qu'un remplissage. Enfin, **le nom tient sur deux lignes** au lieu d'une : 149 px au lieu de 223, et il ne disparaît à aucune largeur. Le logo ne se réduit donc jamais à la seule marque.

La hauteur de l'en-tête ne varie qu'entre paliers (68, 62, 60 px), jamais à l'intérieur : un en-tête collé qui change de hauteur fait sauter le contenu au redimensionnement. Les marges suivent l'encoche des iPhone en paysage (`env(safe-area-inset-*)`). Le logo ramène à l'accueil.

Mesuré à une trentaine de largeurs de 320 à 2560 px : une seule ligne partout, les huit sections entièrement visibles jusqu'à 820 px, nom jamais tronqué, marque jamais sous 30 px, aucun débordement.

### Sobriété

Trois objets portaient le même dégradé bleu vers cyan vers violet avec une ombre colorée : la pastille du logo, la bulle de l'assistant et la barre de titre de son panneau. Trois couleurs et un halo pour un objet de 32 px, c'est le style des applications de 2019, et cela faisait crier l'assistant plus fort que le contenu. Les trois passent en aplat de la couleur d'accent, sans ombre portée, et la typographie porte le nom. La barre de titre de l'assistant reçoit le même traitement neutre qu'il soit en bulle ou en panneau : c'est le même objet, il n'y avait pas de raison de le traiter deux fois différemment.

### Accessibilité de la navigation

`role="tablist"` était déclaré sans qu'aucune des promesses de ce rôle ne soit tenue, ce qui est pire que pas d'ARIA du tout : le lecteur d'écran annonce un comportement qui n'existe pas. Ce qui a été mis en place :

1. Chaque onglet porte un `id` et un `aria-controls`, chaque panneau porte `role="tabpanel"` et renvoie à son onglet par `aria-labelledby`.
2. **Tabulation itinérante** : la bande entière est un seul arrêt de tabulation, on y circule ensuite aux flèches gauche et droite, avec Début et Fin, et un bouclage aux extrémités.
3. Un **anneau de focus** visible (`:focus-visible`), qui n'existait nulle part dans la feuille de style.
4. Les animations de défilement respectent `prefers-reduced-motion`.

### Ce que l'audit a trouvé et qui est corrigé

Un audit automatique passe neuf appareils, sept onglets chacun, et mesure quatre choses : débordement horizontal, tableaux qui débordent sans cadre défilant, taille du texte, taille des cibles interactives (zone réellement prenable, étiquette liée comprise) et nombre de caractères par ligne (compté exactement, un rectangle par ligne rendue). Il trouvait neuf appareils sur neuf en défaut, il n'en trouve plus aucun. Les défauts réels corrigés :

1. **Le champ de l'assistant tombait à 30 px de large** sur un iPhone SE : deux boutons et le champ sur une même rangée sans repli. La barre se replie maintenant d'elle-même (`flex: 1 1 12rem`), sans seuil de fenêtre, ce qui vaut aussi dans le panneau latéral de 320 px, qu'un seuil de fenêtre ne saurait pas voir.
2. **L'étiquette « Régime des impatriés » s'écrasait à zéro de large** et 126 px de haut : trois éléments dans une rangée flex, dont un lien long. Le lien prend sa propre ligne.
3. **Les cases à cocher se laissaient comprimer** par une étiquette longue (22 px devenaient 13) : il manquait `flex: none`.
4. **La zone prenable des cases du parcours** faisait 24 px : la case garde sa taille, son entourage passe à 44 px.
5. **Treize micro-étiquettes** étaient réparties entre 10 et 11 px. Elles partagent un jeton unique, `--micro`, à 11 px, relevé à 12 px sur écran tactile.
6. **Les notes en petit s'étiraient sur 177 caractères par ligne.** Justification plafonnée.
7. Tout résumé repliable (`summary`) fait au moins 44 px au doigt.
8. **`hidden` avait une spécificité nulle** : la moindre règle `display` le neutralisait sans bruit et l'élément restait à l'écran. Il est devenu inviolable une fois pour toutes.
9. **Un contenu invisible tant qu'un observateur n'a pas réagi est un contenu perdu.** L'apparition au défilement garde un filet : passé deux secondes et demie, tout s'affiche, animation ou pas.

Trois autres paliers de mise en page :

1. Sous **760 px** : les rangées de champs passent en colonne, les grilles de cartes et de cases à cocher passent sur une colonne, la carte se raccourcit. Les tableaux larges défilent dans leur cadre (`.table-wrap`), jamais la page.
2. Sous **460 px** : les indicateurs passent sur une colonne, les titres se réduisent.
3. Au-dessus de **1100 px** : l'assistant peut s'ancrer en panneau latéral (voir plus bas).

Règle tenue partout : aucun élément ne pousse la page horizontalement. Ce qui est plus large que l'écran défile à l'intérieur de son conteneur.

Une copie statique de démonstration est publiée sur https://lux-guide.github.io (dépôt `lux-guide/lux-guide.github.io`). Ce dossier fait foi : on modifie ici, puis on recopie `index.html`, `app/`, `assets/` et `comparateur/` dans le dépôt de démo.

Trois choses ne se recopient jamais, et la raison n'est pas la même :

1. `server/`, qui est un serveur de développement et n'a rien à faire sur un site statique.
2. `comparateur/gen_contrats_kb.py` et `comparateur/gen_mrh_kb.py`, qui portent en clair la table de correspondance entre les assureurs anonymisés et leurs vrais noms. Les publier annulerait l'anonymisation que le reste du travail respecte. C'est le point à vérifier après chaque synchronisation en miroir, qui les emporterait sinon avec le reste du dossier.
3. Le second site, `prevoyance/`, qui vit à côté du guide dans le dépôt et se recopie séparément dans `prevoyance/` du dépôt de démo. Une synchronisation en miroir de la racine l'effacerait s'il n'était pas exclu.

---

## Le simulateur

Il applique le **barème officiel de l'Administration des contributions directes** (fichier `bareme-2025-format-excel.xlsx` publié sur [impotsdirects.public.lu](https://impotsdirects.public.lu/fr/baremes.html)), pour les classes 1, 1a et 2.

Chaîne de calcul :

1. Cotisations sociales sur le brut plafonné à cinq fois le salaire social minimum.
2. Contribution dépendance, sans plafond, après abattement d'un quart de salaire social minimum.
3. Exonération de 50 % au titre du régime des impatriés, si l'option est cochée.
4. Forfaits de frais d'obtention et de dépenses spéciales, optionnels.
5. Impôt selon le barème, puis contribution au fonds pour l'emploi.

**Limite à connaître.** Le résultat correspond à la retenue sur un seul salaire. En classe 2, la déclaration retient un taux moyen mondial qui intègre les revenus étrangers exonérés : le net réel peut être inférieur. Le simulateur donne donc un plafond, pas un net définitif, et l'interface le dit (encadré « un ordre de grandeur, pas un chiffre à l'euro près »). Aucune marge chiffrée n'est affichée : aucune source n'en donne, et l'écart dépend de la situation.

---

## Ce qui n'a pas sa place dans le guide

Règle appliquée à toute la base : **une fiche, une question ou une astuce n'a sa place ici que si sa réponse change parce qu'on est au Luxembourg.** Ce qui serait aussi vrai à Lille ou à Leipzig relève du bon sens général, pas d'un guide sourcé, et le fait qu'un conseil soit utile ne suffit pas.

Un passage au crible a retiré 6,5 Ko de la base et 1,9 Ko des astuces :

1. La fiche **Réussir un rendez-vous technique** en entier, et ses deux questions. Adresse exacte à transmettre, appel masqué qui ne se rappelle pas, confirmation écrite du créneau, contestation des frais d'absence : chaque phrase en était vraie partout, et la source ILR était plaquée à la fin sans rien soutenir de ce qui précédait.
2. La question **« Mes meubles vont-ils passer dans l'ascenseur ? »**, qui dépend de l'immeuble et non du pays, et les deux sections de la fiche Emménager dont elle venait. Ce qui reste de cette fiche est luxembourgeois : le logement se remet souvent sans luminaires montés, et les magasins de quatre pays sont à portée de voiture.
3. La question **« L'administration est-elle compliquée ? »**, qui appelle une opinion et non un fait.
4. Les deux tiers génériques de la fiche **Contester une facture**. Ce qui reste est la procédure luxembourgeoise : la médiation de l'ILR pour les communications électroniques, le Médiateur de la consommation pour le reste, et la réclamation écrite préalable comme condition de recevabilité.
5. Onze **astuces universelles** : filmer l'état des lieux, relever les compteurs, garder les cartons, envoyer un courriel récapitulatif après un appel. Deux rubriques se sont vidées et ont disparu avec elles.

La base est passée de 36 à 35 fiches et de 41 à 37 questions. Les renvois du parcours et des astuces vers la fiche supprimée ont été retirés au même moment, et une vérification automatique confirme qu'aucune question ni aucune étape ne pointe plus dans le vide.

## Les questions se formulent comme on les tape

Deuxième dérive, distincte de la précédente : des questions correctes sur le fond mais formulées depuis un cas particulier, parce qu'elles étaient nées d'une conversation. « Ma classe d'impôt est fausse, que faire ? », « Je veux exercer une activité indépendante en plus de mon emploi », « Mon employeur connaît-il le salaire de mon conjoint ? ». Le lecteur ne se reconnaît pas dans le cas d'un autre, et la recherche ne les trouve pas.

Vingt-huit questions ont été reformulées à la troisième personne, comme un arrivant les taperait : « Comment faire corriger une classe d'impôt inexacte ? », « Peut-on exercer une activité indépendante en plus d'un emploi salarié ? », « Comment l'impôt est-il prélevé quand on est deux à travailler ? ». Une vérification automatique confirme qu'aucune question ni aucune réponse ne parle plus d'un cas personnel, et qu'il n'existe aucun doublon.

Deux entrées sont sorties de la FAQ. Le litige avec un opérateur télécom était un cas particulier du litige avec un professionnel, désormais couvert par une seule question. Et la remise du logement sans luminaires est un retour d'expérience, pas un fait sourcé : elle a rejoint le bloc discret des astuces, à sa place.

### Deux lacunes factuelles comblées

Le guide affichait « 8 jours » partout, y compris en chiffre d'accroche. Vérification faite sur Guichet.lu, ce chiffre est juste pour la déclaration d'arrivée au bureau de la population, mais il masquait deux autres délais que le guide ne donnait nulle part :

1. Un **ressortissant de pays tiers dispose de trois jours**, pas de huit, et le délai court dès l'entrée sur le territoire.
2. La déclaration d'arrivée ne suffit pas. Un citoyen de l'Union restant plus de trois mois doit remplir une **déclaration d'enregistrement dans les quatre-vingt-dix jours**, et un ressortissant de pays tiers demander son **titre de séjour dans les trois mois**.

Les définitions des classes d'impôt ont également été reprises sur la source : la classe 1a ne vise pas « les parents isolés » mais toute personne bénéficiant d'une modération d'impôt pour enfants, et la classe 2 couvre un régime transitoire de trois ans après un décès, un divorce ou une séparation. Il n'existe pas de classe 1b, et c'est dit, parce que la question se pose.

Huit questions ont enfin été ajoutées sur des sujets que le guide traitait dans ses fiches sans jamais les poser : le compte bancaire étranger, l'affiliation à la sécurité sociale, la langue au travail, le coût de la vie rapporté au salaire.

## Le simulateur, et ce qu'il ne calcule pas

Le guide ne calcule que le salaire net et la capacité d'emprunt, parce que ce sont les deux chiffres dont on a besoin avant même d'arriver. Deux volets ont été ajoutés à côté.

**Ma classe d'impôt** est un arbre de décision, pas un calcul : la classe se déduit d'une règle, il n'y a donc rien à estimer ni de marge d'erreur à annoncer. Deux ou trois questions, les réponses rappelées au-dessus et modifiables, et un résultat qui pointe le cas coûteux plutôt que la seule classe. Le conjoint resté à l'étranger fait basculer en classe 1 par défaut, et la seconde fiche de retenue d'un ménage à deux revenus porte un taux fixe qui sous-prélève. Chaque résultat renvoie à la fiche Classes d'impôt, qui porte la source officielle.

**Ma classe d'impôt** couvre les trois classes et leurs cas limites : la modération pour enfants, les plus de soixante-quatre ans, et le régime transitoire de trois ans après un décès ou un divorce. Le résultat rappelle que le régime des impatriés ne dépend pas de la classe.

Le **tableau de comparaison** du simulateur affichait le régime des impatriés pour la seule classe 2. Or le profil le plus fréquent à l'arrivée est un célibataire en classe 1, qui ne voyait donc pas ce que le régime lui apporterait : c'est pourtant là qu'il change le plus le net, plus de mille euros par mois sur un brut de 80 000 euros, contre moins de cinq cents en classe 2. Les trois classes sont maintenant affichées avec et sans le régime, et le gain mensuel en regard.

**Simulateurs officiels** rassemble onze calculateurs publics plutôt que d'en produire ici des copies qui vieillissent : la calculatrice fiscale du ministère des Finances, les barèmes et la simulation d'imposition collective de l'Administration des contributions directes, les simulateurs de garantie locative et de subvention de loyer de Guichet.lu, le simulateur des loyers de l'Observatoire de l'habitat, le calculateur de revenu de congé parental de la Caisse pour l'avenir des enfants, celui de l'allocation de vie chère du Fonds national de solidarité, le calendrier scolaire et les paramètres sociaux. Les onze liens ont été testés le 23 août 2026 et répondaient tous.

## Le comparateur de contrats

L'onglet Comparateur s'ouvre sur le **choix**, et rien d'autre. Il dépliait auparavant l'assurance habitation d'emblée : le choix était affiché mais déjà fait. Quatre postes sont maintenant présentés seuls (assurance habitation, assurance auto, forfait mobile et internet, électricité), chacun avec ce que contient sa comparaison, compte à l'appui, et le registre auquel il appartient. Une comparaison ouverte masque les autres, et un retour ramène au choix.

Deux registres, expliqués au-dessus des cartes et rappelés par un badge sur chacune : la MRH repose sur des **documents réels**, quatre contrats du marché luxembourgeois lus intégralement, assureurs anonymisés. Les trois autres sont des **démonstrations** : les critères sont réels, les offres et les chiffres sont inventés et affichés comme tels (`comparateur/offres_kb.js`). Rien n'y est un conseil d'achat.

La comparaison habitation se déploie en six volets :

1. **Ma situation** : le visiteur coche ce qui le concerne (dix situations : dégât des eaux, vélo selon son lieu de rangement, bijoux, nomade, bris de glace...) et le classement se recalcule dans le navigateur. Chaque contrat est noté sur la part de ces besoins réellement payée, et les lacunes s'affichent avec la clause qui les cause et sa page. Elles ne sont pas présentées comme des points « à négocier » : des conditions générales sont un texte type, identique pour tous les assurés du contrat. Les deux vrais leviers, écrits sur la page, sont le choix d'un autre contrat et ce qui figure aux conditions particulières. Le calcul est un portage fidèle de `reco_personnalisee.py` de la case study : moyenne des scores de protection par situation, pondérée par le poids de la situation.
2. **Tableau sur mesure** : la commande du comparateur, décrite plus bas. Elle ne répond pas à côté du tableau, elle le construit.
3. **Sinistres** : les treize sinistres, chacun avec une pastille de verdict par contrat et le détail au clic.
4. **Couverture** : la matrice des dix-sept garanties recherchées dans les quatre documents, avec le nombre de mentions et la première page. La page dit explicitement que c'est un signal de présence, pas une promesse de couverture.
5. **Ce qui ressort** : les six constats de la comparaison, réécrits pour un habitant, avec la question à poser avant de signer.
6. **Méthode** : la démarche, pourquoi partir de sinistres et non de garanties, et ce que la comparaison ne dit pas (aucun prix, éditions 2017 à 2023, ne remplace pas un devis).

### Une seule fenêtre de conversation dans toute l'application

L'application comptait quatre surfaces qui se ressemblaient : l'assistant en pleine page, l'assistant en panneau ou en bulle (même conversation), le chat du comparateur, et le questionnaire des verticales déguisé en chat. Trois d'entre elles pouvaient être à l'écran en même temps, avec les mêmes bulles et le même style. C'était lu comme plusieurs chatbots.

Il n'en reste qu'un, l'assistant. Les deux autres ont été rendues à ce qu'elles sont :

1. Le comparateur a une **commande** et un **journal**. On écrit une demande en français courant, la ligne s'applique aussitôt, et le journal note ce qu'elle a changé. Pas de bulles, pas de tour de parole, pas de temps de réflexion simulé : le calcul est instantané, le mimer serait faux.
2. Les verticales de démonstration ont un **questionnaire numéroté** : une question à l'écran, « Question 2 sur 3 » avec sa jauge, les réponses déjà données rappelées au-dessus et modifiables d'un clic (les points sont alors rejoués depuis le début, jamais défaits à la main).

Un test automatique compte les fenêtres de conversation visibles et échoue s'il y en a plus d'une à l'écran.

### Le tableau sur mesure

La commande du comparateur a un rôle que l'assistant n'a pas, piloter l'affichage. Une demande devient une opération sur le tableau, et la comparaison se redessine :

1. Ajouter des lignes. « Compare le vol et le dégât des eaux » ajoute deux lignes en une phrase. La demande est découpée sur les `et`, les virgules et les `puis`, puis chaque morceau est rapproché du catalogue des dix-sept garanties et des treize sinistres.
2. Restreindre les colonnes. « Montre seulement l'assureur A et l'assureur C » n'affiche plus que ces deux contrats. « Affiche tous les contrats » revient aux quatre.
3. Retirer une ligne, trier, vider. Le tri classe par divergence : les lignes où les contrats répondent le plus différemment remontent, puisque c'est là que le choix se joue.
4. Ajouter un critère personnalisé, absent de la grille. Le mot est cherché dans les clauses citées des treize sinistres, contrat par contrat, et la ligne rapporte le nombre d'occurrences et la première page. **Rien n'est déduit d'une absence** : quand le mot ne figure nulle part, le chat dit que le sujet n'est pas traité dans les extraits lus, pas qu'il n'est pas couvert, et propose d'en faire une question à poser par écrit.
5. Pondérer. Chaque ligne de sinistre porte une importance (normale, important, décisif) qui entre dans la ligne de score en bas du tableau. Le score ne se calcule que sur les cas réels : une matrice de présence ne dit pas si un sinistre est payé, elle ne peut pas entrer dans une note.

Deux réserves sont calculées et affichées sous le tableau, sur les lignes réellement présentes plutôt qu'en avertissement général. D'abord l'écart d'éditions : les quatre documents vont de 2017 à 2023, l'un n'est pas daté, et l'édition figure sous chaque nom de colonne, parce qu'un écart de six ans peut venir d'une évolution du produit autant que d'une différence entre assureurs. Ensuite la vérification des citations : sur les 52 verdicts de la case study, 18 seulement ont été retrouvés tels quels dans le PDF. Chaque cellule le marque (`✓` ou `·`), et la réserve annonce la proportion sur les lignes affichées.

Le tableau se conserve d'une visite à l'autre (`luxguide.surmesure.v1`), se choisit aussi à la main sous le tableau pour qui préfère cliquer, et se copie en markdown. Quand une question posée à l'assistant général touche à l'assurance, celui-ci ne répond plus une seconde fois : il propose de construire le tableau et lui passe la question telle quelle.

La partie MRH réutilise la case study marché luxembourgeois du dépôt voisin `rag` (`case_studies/fr/vol2_compar/comparatif_contrats_MRH_lu/`) : 13 sinistres concrets posés à quatre conditions générales publiques du marché (éditions 2017 à 2023), verdict typé par contrat avec la clause citée et sa page.

1. Les verdicts viennent de `comparateur/contrats_kb.js`, généré depuis `sinistres_comparaison.json` du dépôt rag, à ne pas éditer à la main. Hors des 13 cas, l'application le dit et ne comble pas.
2. Les assureurs sont anonymisés (A à D), règle du dépôt rag : jamais un nom d'assureur en clair dans un contenu publié. Un test automatique cherche les vrais noms dans le panneau rendu et échoue s'il en trouve un.

---

## La carte

L'onglet Carte compare jusqu'à quatre logements candidats. On fixe d'abord un repère (le lieu de travail, ou tout autre point), puis on ajoute les adresses : chacune reçoit une couleur, un marqueur et un cercle de rayon. Le tableau les compare ligne par ligne : distance au repère, puis pour chaque catégorie (écoles, crèches, bus tram train, commerces, santé) le nombre de points dans le rayon et le plus proche, avec sa distance, son temps de marche et son nom. La meilleure valeur de chaque ligne est surlignée. Cocher ou décocher une catégorie, ou changer le rayon, recalcule tout sans retaper les adresses.

Les adresses et le repère sont conservés dans le `localStorage` du visiteur (`luxguide.carte.v1`) et **ne quittent jamais son navigateur** : aucun serveur du guide ne les reçoit, rien n'est versionné. La page le dit explicitement. L'exemple de démonstration n'utilise que des communes et quartiers publics (Kirchberg comme repère, Belair, Esch-sur-Alzette, Mersch), jamais une adresse personnelle.

Côté technique : géocodage par Nominatim (limité au Luxembourg, avec récupération de la commune), points d'intérêt par Overpass, Leaflet chargé à la demande depuis unpkg. Les appels sont **enchaînés et non parallèles**, les deux services refusant les rafales, et une requête Overpass en échec est retentée une fois (le 504 y est fréquent). Distances à vol d'oiseau par la formule de haversine, temps de marche à 4,5 km/h : la page dit que ce sont des ordres de grandeur et renvoie à mobiliteit.lu pour les temps de trajet réels.

C'est le seul onglet qui exige le réseau, et il faut le servir en HTTP : ouvert par double-clic en `file://`, le navigateur bloque les appels aux deux services (origine nulle) et les colonnes restent vides. La page le signale.

---

## L'assistant

Deux modes, avec bascule automatique.

**Mode local**, sans réseau. Il pose six questions pour construire un profil (situation familiale, enfants, statut, logement, véhicule, avancement), puis recherche dans la base de connaissances. Un seuil de pertinence l'empêche de répondre à côté : sous ce seuil, il dit qu'il ne sait pas plutôt que de produire une réponse plausible mais fausse. Le profil personnalise aussi le parcours et la liste des fiches.

L'assistant existe sous trois formes qui partagent la même conversation : l'onglet Assistant en pleine page, un **panneau ancré à droite** au-dessus de 1100 px de large, et une bulle flottante en dessous de cette largeur. Les deux premières s'excluent : ouvrir l'onglet Assistant referme le panneau, sinon la conversation s'afficherait deux fois. Le panneau ancré ne recouvre pas le texte, il décale la page (marge sur `body`, `main` se recentre dans la place restante) ; l'état ouvert ou fermé est conservé d'une visite à l'autre, et redescendre sous 1100 px rebascule automatiquement en bulle. On passe du panneau à la pleine page par le bouton `⤢`, et l'inverse depuis l'onglet Assistant, sans rien perdre de l'échange.

Sa **largeur est réglable** : la poignée sur son bord gauche se glisse à la souris ou au doigt, entre 320 px et le plus petit de 680 px ou 55 % de la fenêtre, avec les flèches gauche et droite au clavier quand elle a le focus, et un double-clic pour revenir à 400 px. La largeur choisie est conservée d'une visite à l'autre, et le contenu suit (la marge du corps de page est liée à la même variable CSS).

C'est ce panneau qui rend possible le **guidage** : quand la réponse s'appuie sur une fiche, celle-ci s'ouvre dans la page pendant que la conversation reste visible, et les mots de la question y sont surlignés, la page défilant jusqu'au premier passage trouvé. Le surlignage compare sur une version sans accents mais découpe le texte d'origine, les accents sont donc préservés à l'écran.

Les réponses s'affichent progressivement avec un court temps de réflexion simulé : c'est un habillage, le fond reste la recherche locale. Quand la question touche aux contrats d'assurance, l'assistant ne répond pas une seconde fois à la place du comparateur : il propose de construire le tableau et lui transmet la question.

**Mode connecté**, si le serveur tourne et qu'un modèle est configuré. La question part avec le profil et les extraits pertinents du guide. La consigne système impose de ne répondre qu'à partir de ce contexte et de ne jamais inventer un chiffre, un délai ou un plafond.

Le point d'extension est unique : `repondre()` dans `app/chat.js`. Changer de fournisseur ne touche à rien d'autre.

---

## Modifier le contenu

Onglet **Administration**. On peut y éditer le titre, la catégorie, le résumé, le corps, les points à retenir, les mots-clés et les sources de chaque fiche, en créer, en supprimer, et ajuster les paramètres du simulateur (taux de cotisation, plafonds, seuils).

Les modifications sont d'abord enregistrées dans le navigateur. Pour les rendre permanentes pour tout le monde :

1. Cliquer sur **Exporter kb.js**.
2. Remplacer `app/kb.js` par le fichier téléchargé.
3. Recharger la page.

Le bouton **Revenir au contenu d'origine** annule les modifications locales.

---

## Structure

```
lux_guide/
  index.html            page unique
  assets/               photographies sous licence libre, et CREDITS.json
  app/
    bareme.js           barème officiel ACD, extrait de la source
    kb.js               base de connaissances, fiches et questions
    communaute.js       astuces de la communauté, autonome, une entrée par fiche
    simulateur.js       calcul du net et de la capacité d'emprunt
    chat.js             profil, recherche, appel au modèle
    ui.js               rendu, comparateur, carte, widget, administration
    styles.css          thème clair et sombre
  comparateur/
    contrats_kb.js      verdicts par sinistre, généré depuis le dépôt rag
    mrh_kb.js           matrice de couverture, constats, situations, généré aussi
    offres_kb.js        comparaisons de démonstration (auto, télécom, électricité)
  server/
    server.js           serveur statique et relais vers le modèle
```

---

## Fiabilité du contenu

Chaque fiche porte ses sources officielles, consultables en un clic. Les 30 liens sources ont été testés un par un et répondent tous. Les informations ont été vérifiées en août 2026 auprès des administrations luxembourgeoises : Guichet.lu, ACD, CCSS, CNS, IGSS, ministère du Logement, Caisse pour l'avenir des enfants, ITM, ADEM, ILR, SNCA.

La réglementation évolue, en particulier les barèmes, les plafonds et les taux de cotisation. Avant toute démarche engageante, la source citée fait foi, pas cette application.

---

## Paramètres de calcul

Les valeurs du simulateur suivent les paramètres sociaux publiés par l'IGSS, applicables au 1er juin 2026 (indice 992,24) :

1. Salaire social minimum non qualifié : 2 771,33 € par mois, soit 33 255,96 € par an.
2. Maximum cotisable : 13 856,63 € par mois, soit cinq fois le salaire social minimum.
3. Abattement pour la contribution dépendance : 692,83 € par mois.
4. Cotisations salariales : pension 8,50 % depuis le 1er janvier 2026 (loi du 18 décembre 2025 portant réforme des pensions), maladie 3,05 %, soit 11,55 %, plus 1,40 % de dépendance.

Ces paramètres sont modifiables dans l'onglet Administration, sans toucher au code.

## Photographies

Les visuels proviennent de Wikimedia Commons, sous licence Creative Commons. Les auteurs, titres et licences exacts sont listés dans `assets/CREDITS.json`, et rappelés en bas de la page d'accueil. Toute réutilisation doit conserver ces attributions.
