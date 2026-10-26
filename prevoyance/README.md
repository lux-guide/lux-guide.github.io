# Épargne et retraite

Rubrique du site [Vivre au Luxembourg](../README.md), consacrée à la prévoyance-vieillesse luxembourgeoise, l'article 111bis, et aux autres postes déductibles. Elle chiffre ce qu'une situation rapporte, sans compte, sans nom et sans modèle de langue.

Servir le dossier du guide, et non ce seul dossier : la barre du site vit dans `../app/`. Aucune dépendance, aucun outil de construction.

```bash
python -m http.server 8932 --directory lux_guide
python lux_guide/prevoyance/test_prevoyance.py
```

---

## Une rubrique du site, dans sa propre page

Le sujet a d'abord été un onglet du guide, puis un site à part, puis une rubrique du site. Chaque étape a sa raison, et la dernière tient compte des deux premières.

1. **Sortie du guide, en septembre 2026.** Le guide s'appelait alors « S'installer au Luxembourg ». Or la déduction ne concerne pas que les arrivants : elle s'ouvre à toute personne imposée au Luxembourg, là depuis huit jours ou depuis vingt ans. Rangée sous « s'installer », elle devenait invisible pour la moitié des gens qu'elle concerne. D'où un second site, avec sa propre coquille et sa propre identité.
2. **Retour dans le site, le 12 octobre 2026.** Le guide a pris le nom « Vivre au Luxembourg » le 18 septembre, précisément pour ne plus désigner les seuls arrivants. La raison de la séparation est donc tombée, et deux identités pour un même site faisaient croire, au premier clic sur « Épargne et retraite », qu'on venait de le quitter.

Ce qui est commun avec le reste du site :

1. **La barre**, écrite par `../app/entete.js` et habillée par `../app/entete.css`, la même sur toutes les pages. Ici, la famille Budget et l'entrée Épargne et retraite y sont marquées, et l'entrée Assistant ouvre le volet de cette rubrique.
2. **Les jetons** : palette, rayons, largeur de page, typographie (Instrument Serif pour les titres et les chiffres, Inter pour le texte).
3. **Le thème** : clair, sombre ou celui du système, réglé dans les paramètres du site et suivi ici.

Ce qui reste propre à la rubrique :

1. **Sa page.** Son code (le moteur de calcul, les questions, l'interface, près de 140 Ko) ne se charge que si on l'ouvre, au lieu de peser sur chaque visite du guide.
2. **Ses trois vues**, en sous-onglets sous un fil « Budget › Épargne et retraite ».
3. **Son assistant**, qui ne répond que sur l'épargne et la retraite, à partir de réponses écrites et sourcées.

## Trois vues, et un assistant qui reste ouvert à côté

1. **Vue d'ensemble.** Le plafond montré comme un mouvement, un chiffre calculé dès l'arrivée et qui ne suppose rien du lecteur, les quatre moments du dispositif, les trois conditions, six questions fréquentes.
2. **Simulateur.** Quatre questions dont aucune n'est obligatoire, les plafonds ouverts, le mode d'obtention de chaque montant, l'économie par taux d'imposition en barres, et le cumul sur dix ans en courbes.
3. **Questions.** Les questions écrites et sourcées, filtrables, groupées par thème.

**L'assistant n'est pas une destination, c'est un compagnon.** Il était un quatrième onglet, ce qui obligeait à quitter le simulateur pour poser une question, puis à y revenir pour vérifier. Il s'ouvre maintenant en volet, du haut au bas de l'écran, et reste ouvert pendant qu'on lit.

**Au-delà de 1180 px, ce n'est pas un calque posé sur la page : c'est une seconde colonne.** La distinction n'est pas cosmétique, et elle a coûté un défaut avant d'être comprise. Un volet en `position: fixed` collé au bord droit recouvre la barre de défilement de la fenêtre, qui vit exactement là : on défilait à l'aveugle, derrière le panneau. En colonne, c'est la colonne de page qui défile, sa barre tombe à sa droite, donc juste à gauche du volet, et reste visible. C'est la disposition des volets de navigateur, et ce n'est pas un hasard. En dessous de 1180 px il recouvre, avec un voile, et **sous 760 px il prend tout l'écran** : un panneau de 257 px sur un écran de 390 laisse derrière lui une bande de page qu'on ne peut ni lire ni utiliser.

Chaque zone porte alors son propre défilement, et jamais l'une dans l'autre. Un cadre qui défile à l'intérieur d'une page qui défile oblige à viser pour choisir lequel bouge.

Sept choix de conception, chacun vérifié par un test :

1. **Tout ce qui n'est pas le volet vit dans une colonne de page**, en-tête et pied compris. Sans cela le volet monte par-dessus l'en-tête et recouvre le bouton qui l'a ouvert, qu'on ne retrouve plus pour le refermer.
2. **La largeur se règle en tirant le bord gauche**, et se retient. 420 px conviennent à une question courte, pas à une réponse qui porte quatre sources et trois suggestions. La zone sensible de la poignée fait 11 px pour un trait visible de 1 : viser un filet à la souris est un exercice, pas une interface. Les flèches du clavier la déplacent aussi, sans quoi la largeur ne serait réglable qu'à la souris.
3. **Le volet ne dépasse jamais les deux tiers de l'écran.** Au-delà, ce n'est plus un panneau à côté de la page, c'est la page qui devient une marge.
4. **Échap ferme, que le volet recouvre la page ou qu'il la pousse.** On ne se souvient pas d'un raccourci qui marche une fois sur deux. Quand il recouvre, le clavier reste dedans : la tabulation partirait sinon se promener dans une page qu'on ne voit plus.
5. **Le périmètre est replié au départ.** Neuf puces avant de pouvoir poser sa question, ce sont neuf puces qu'on ne lit pas. Il sert quand une question échoue, et la réponse « hors de ce que je sais » le rappelle déjà à ce moment-là.
6. **Le bouton d'envoi reste éteint tant qu'il n'y a rien à envoyer**, et celui qui efface la conversation reste gris tant qu'il n'y a rien à effacer. Un bouton actif qui ne fait rien apprend à ne plus lui faire confiance.
7. **Entrée envoie, Maj+Entrée passe à la ligne**, et la saisie grandit avec la question jusqu'à cinq lignes. Un champ d'une ligne pour une question de deux la fait défiler sous les yeux pendant qu'on l'écrit.

Un défaut que ce déplacement a créé, et qu'un test attrape désormais : la conversation ne descendait plus toute seule. Le code défilait `#as-log`, qui avait cessé de porter sa propre barre. C'est le corps du volet qu'il faut suivre, et à la frame suivante, sinon on défile vers une hauteur périmée. Quand on remonte, un bouton ramène au dernier message ; il n'apparaît que si l'on a vraiment remonté, affiché en permanence il masquerait la conversation pour ne rien dire.

Chaque onglet a son adresse (`#simulateur`, `#questions`), et `#assistant` ouvre le panneau sans changer la vue qu'on regardait.

---

## Les règles qui tiennent le site

Chacune est vérifiée par un test. Cent-quatre-vingt-un contrôles de fond, dans [test_prevoyance.py](test_prevoyance.py), et un audit de forme séparé, dans [audit_responsive.py](audit_responsive.py) :

```bash
python -m http.server 8932 --directory prevoyance
python prevoyance/test_prevoyance.py       # les règles de fond
python prevoyance/audit_responsive.py      # la forme, sur treize largeurs
```

L'audit mesure six familles de défauts sur treize largeurs, de 320 à 1680 px, et quatre états : ce qui déborde, ce qui descend sous le plancher de taille, ce qui fait une cible plus petite que le doigt, les lignes trop longues pour se relire, les blocs qui se chevauchent, les textes coupés par leur conteneur. Il tourne avec `pointer: coarse` en dessous de 820 px, ce qui change les seuils : 12 px de plancher au lieu de 11, et 44 px de cible.

Il a trouvé ce que l'œil laissait passer : le descripteur de la marque à 9,5 px, des liens de pied de page à 39 px de haut, la marque elle-même à 34 px, et une mention légale à 116 caractères par ligne sur grand écran. Il rend zéro aujourd'hui.

### 1. Une seule table de chiffres

Tous les montants de loi vivent dans `app/prevoyance.js`, datés et sourcés. Aucun n'est écrit dans un écran ni dans une réponse : les textes portent des marques, `{plafond}`, `{annee}`, `{sortieMin}`, remplies au rendu. Deux tests relisent `site.js` et `questions.js` et échouent si un plafond y apparaît en dur.

La raison est concrète : le plafond est passé de 3 200 à 4 500 euros au 1er janvier 2026. Un montant recopié à trois endroits, ce sont deux endroits qui mentent le jour du changement. Le guide voisin en a fait l'expérience, il publiait encore l'ancien montant.

### 2. Aucun modèle de langue

Les réponses sont écrites, relues et sourcées à l'avance. Un modèle qui rédigerait à partir des mêmes sources produirait des phrases justes la plupart du temps et un plafond inventé de temps en temps. Sur une déduction fiscale, « la plupart du temps » n'est pas un niveau de service, et l'erreur ne se voit pas : la phrase reste grammaticale.

L'appariement est lexical et pondéré, variante d'IDF au carré. Un test vérifie qu'aucun appel réseau ne figure dans le code.

### 3. Pas de source, pas de réponse

Le rendu refuse d'afficher un texte sans ses citations. Un test compte les blocs de sources et exige qu'il y en ait autant que de questions affichées.

### 4. Quatre statuts, quatre rendus visuellement distincts

`réponse`, `je peux comprendre deux choses`, `hors de ce que je sais`, `donnée personnelle`. Les aplatir en « du texte dans une bulle » annulerait tout ce que le moteur fait pour distinguer ce qu'il sait de ce qu'il suppose.

### 5. Aucune donnée personnelle n'est lue, ni affichée

IBAN, numéro long, téléphone, adresse électronique : la réponse est un refus, et **même le message de l'utilisateur n'est pas rendu tel quel**. Il resterait dans la page et dans une capture d'écran. Un écho est déjà une conservation.

### 6. Un chiffre avant de demander quoi que ce soit, et qui ne suppose rien

Un bouton « calculez votre avantage » réclame de la confiance avant d'en avoir donné. Un montant est donc affiché dès l'arrivée. **Il ne suppose rien du lecteur** : c'est ce que la loi ouvre à toute personne imposée au Luxembourg, quels que soient son âge, son foyer et ses contrats. Deux postes seulement, la prévoyance-vieillesse et les primes d'assurance, parce que ce sont les deux dont le plafond ne dépend de rien.

Cette page a d'abord fait le contraire, et c'était une faute. Trois cas préparés ouvraient le site : « 34 ans, deux enfants, un prêt en cours », « 52 ans, sans prêt », « 40 ans, imposé hors du Luxembourg ». **Ces chiffres ne venaient d'aucune source, je les avais inventés**, et rien sur la page ne disait d'où ils sortaient. Sur un site destiné à tout le monde, un exemple inventé se lit comme une hypothèse sur le lecteur, ou comme le cas de quelqu'un en particulier.

Les deux autres postes dépendent de l'âge et d'un éventuel prêt. Ils ne sont pas devinés : ils sont **annoncés comme à calculer**, avec ce qui manque pour le faire. Renseigner son âge les fait apparaître, l'effacer les remet en attente. Aucun des quatre champs n'est obligatoire, et le champ d'âge affiche « non renseigné » plutôt qu'une valeur.

**Le cas qui ne donne droit à rien reste montré**, en décochant « imposé au Luxembourg » : un outil qui ne sait dire que oui n'est pas cru quand il dit oui. Sur ce cas, la page ne dessine ni tableau ni indicateur, seulement le motif du refus. Un tableau vide laisse croire à un défaut d'affichage.

### 7. Les deux totaux ne s'additionnent jamais

Le déductible annuel et le déductible ponctuel sont deux champs séparés. Leur somme serait arithmétiquement exacte et fausse dans son sens : personne ne déduit cela dans une année.

### 8. On ne devine jamais le taux d'imposition

Une colonne par taux, de 20 à 42 %, et la personne se situe. Afficher le plus élevé donnerait le chiffre le plus flatteur, faux pour presque tout le monde.

### 9. Chaque montant explique d'où il vient

Une colonne du tableau porte le mode d'obtention, par exemple « 6 000 de base + 2 × 1 200 par enfant puis + 8 % par année au-delà de 30 ans ».

### 10. Les icônes sont tracées, jamais écrites

Un jeu de vingt-deux SVG, défini une fois dans `index.html` et appelé par `<use>` : un seul tracé en mémoire quelle que soit la fréquence d'affichage, et aucune requête. Trois règles de tracé pour que l'ensemble tienne comme un jeu et non comme une collection : grille de 24, trait de 1,7 uniquement, bouts et jointures ronds. `currentColor` partout, donc une icône prend la couleur du texte qui l'entoure.

Aucun caractère-image, aucun emoji, aucune police d'icônes. Un glyphe ne se colore pas, ne s'aligne pas et ne rend pas la même chose d'un système à l'autre. Un test relit le texte de la page et échoue s'il y trouve une flèche ou un pictogramme Unicode.

### 11. Les graphiques sont tracés à la main, et doublés d'un tableau

Deux graphiques en SVG, l'économie annuelle par taux en barres et le cumul sur dix ans en courbes, tracés depuis les mêmes données que les tableaux qui les suivent. Pas de librairie : elle pèserait cent fois ce code pour quatre séries, imposerait sa palette et ses polices contre celles du site, et rendrait du canvas, qu'on ne peut ni sélectionner ni relire.

Deux règles tenues par des tests. **L'axe monte au palier rond juste au-dessus de la plus haute valeur**, jamais très au-delà : une échelle à quatre paliers montait l'axe à 5 000 pour une valeur de 2 737, et la comparaison entre barres ne se voyait plus. Et **le SVG est marqué `aria-hidden`** : c'est le tableau qui suit qui porte l'information pour un lecteur d'écran, le décrire deux fois le ferait lire deux fois.

Une nuance de tracé qui compte : les étiquettes de fin de courbe sont dans la couleur du texte, pas dans celle de leur série. La teinte la plus claire de l'échelle rend 1,9 sur blanc, illisible dès qu'elle sert à écrire. C'est le point coloré au bout de la ligne qui la relie à son étiquette.

### 12. L'assistant s'ouvre depuis la barre du site

Depuis que la rubrique a rejoint le site, l'assistant s'ouvre par l'entrée « Assistant » de la barre, au même endroit et avec le même libellé que dans le guide, son point qui respire compris. Elle annonce par `aria-expanded` si le volet est ouvert, et le point cesse de respirer tant qu'il l'est : attirer vers un volet déjà devant soi n'attire vers rien.

Trois chemins mènent au volet : l'entrée de la barre, l'adresse `#assistant`, et un volet resté ouvert depuis la dernière visite. Un test parcourt les trois.

### 13. L'assistant renvoie à l'endroit exact de la page

Une réponse gagne à montrer d'où elle vient. Un bouton « Voir sur la page » ouvre la bonne vue, y défile et **surligne l'élément** : la carte « Imposé au Luxembourg » pour la question sur les frontaliers, le graphique par taux pour celle sur ce que la déduction rapporte, la condition de durée pour le mythe des dix ans.

Trois choix de conception derrière ce petit bouton :

1. **Les cibles portent un `data-ancre` posé au moment où l'élément est construit.** Un sélecteur CSS écrit à la main casserait au premier remaniement de la page, sans que rien ne le signale ; un `data-ancre` se voit dans le code qui construit l'élément.
2. **La table des ancres vit dans `site.js`, pas dans `questions.js`.** Le répertoire de questions ne connaît pas le DOM de ce site et doit rester lisible sans lui.
3. **Un seul endroit surligné à la fois**, et la marque s'efface après trois secondes. Deux marques en même temps, dont une qui répond à une question déjà oubliée, ne désignent plus rien ; une marque qui reste devient une décoration et on cesse de la voir.

### 14. Le pied de page porte les sources, et elles ne sont pas écrites à la main

Il portait quatre lignes de mentions répétées sur chaque vue, derrière un accordéon. Une mention lue partout n'est plus lue nulle part, et trois lignes de texte ne méritent pas un mécanisme à ouvrir.

Ce qu'un pied de page porte d'utile ici, ce sont les sources : le site s'interdit d'afficher une réponse sans elles, autant les rassembler. **Elles sont construites depuis les sources que le répertoire cite réellement**, sans doublon. Un test compare la liste rendue à celle des sources citées et échoue si elles divergent. C'est ce qui a révélé un doublon : l'accueil et le simulateur affichaient chacun un encadré de sources bâti sur la table des chiffres, qui en listait trois quand le répertoire en cite quatre. Deux listes de sources, c'est celle qu'on oublie de mettre à jour qui ment.

La mention légale tient en un paragraphe, en bas, sans repli.

### 15. Sur téléphone, une source dit ce qu'elle est avant qu'on la quitte

« Circulaire L.I.R. n° 111bis/1 – 111ter/1 du 27 avril 2022 » tient sur trois lignes dans une bulle de 300 px, et taper dessus fait quitter le site pour un document dont on ne sait rien. Un PDF de seize pages ouvert sur un téléphone, sans savoir où regarder, ne prouve rien à personne.

**Afficher la page officielle n'était pas une option** : aucune ne se laisse encadrer, et ce serait de toute façon illisible. En dessous de 760 px, un lien de source ouvre donc une fiche : l'organisme, la nature du document (page ou document de seize pages), ce que cette source établit ici, la date où le lien a été ouvert et a répondu, l'adresse en entier, puis deux actions. « Ouvrir le site officiel » dans un nouvel onglet, et « Copier le lien », qui vaut souvent mieux quand on lit dans les transports : on retrouve l'adresse plus tard sans perdre ce qu'on lisait.

Au-dessus de 760 px, la place ne manque pas et le lien reste un lien : une fiche serait une étape de plus pour rien. Le titre complet s'affiche alors, contre le nom court de l'organisme sur téléphone.

Les quatre liens ont été ouverts le 3 septembre 2026 et répondaient tous.

### 16. L'âge de sortie est calculé, jamais affiché par défaut

`ageSortieEffectif(age)` rend la plus tardive des deux dates : l'âge légal, ou l'année de souscription plus la durée minimale du contrat. Écrire « à partir de 60 ans » en dur serait faux pour toute personne qui souscrit après 50 ans, et faux dans le sens qui compte, puisque c'est précisément à cet âge qu'on regarde le dispositif de près.

---

## Ce qui vient d'entretiens, et ce qui en a été écarté

Cinq entretiens avec un praticien du dispositif ont été relus pour compléter le répertoire. Ils apportent surtout les idées fausses courantes, qu'aucun texte officiel ne prend la peine de démentir puisqu'il énonce la règle sans dire comment on la comprend de travers.

Ce qui a été repris, parce que c'est de la connaissance générale du dispositif : le mythe des dix ans et sa conséquence chiffrée (souscrire à 55 ans, c'est sortir à 65 et non à 60), l'intérêt de plusieurs contrats plus petits plutôt qu'un seul gros, l'intérêt d'étaler la sortie, l'asymétrie entre une déduction valorisée à la tranche haute et une sortie imposée à la moitié du taux moyen, le moment où l'avantage revient réellement, et le conjoint qui travaille à l'étranger et ouvre son propre contrat grâce à la déclaration commune.

Ce qui a été écarté sans exception : tout nom d'entreprise, de gestionnaire, de fonds ou d'outil interne, tout chiffre de performance, toute pratique commerciale, tout montant d'entrée et tout avantage réservé à une catégorie de clients. Ce site est une démonstration, il ne porte aucune donnée d'entreprise.

**Sur un point, le praticien avait raison contre la page de vulgarisation, et c'est la circulaire qui l'a montré.** Il décrivait une sortie possible à tout moment au prix des avantages fiscaux ; la page A à Z de l'administration dit que le remboursement anticipé « est exclu », ce qui se lit comme une interdiction. La [circulaire L.I.R. n° 111bis/1 – 111ter/1 du 27 avril 2022](https://impotsdirects.public.lu/dam-assets/fr/legislation/legi22/2022-04-27-lir-111bis-1-111ter-1-du-2742022.pdf), qui est le texte d'application, prévoit expressément un remboursement anticipé « intégral ou partiel », imposé au tarif normal comme revenu divers. Ce n'est donc pas interdit : c'est cher.

La leçon vaut au-delà de ce point : **une page de vulgarisation officielle n'est pas la source, c'est un résumé de la source.** Le site cite désormais la circulaire là où le résumé induit en erreur.

**Et sur un autre point, l'entretien m'avait induit en erreur, faute de l'avoir confronté au texte.** J'avais écrit que le contrat est une assurance vie, et j'en avais tiré la clause bénéficiaire. C'est faux en général : la prévoyance-vieillesse est un régime fiscal, pas un produit. Les entreprises d'assurances en proposent trois formes, mais les établissements de crédit peuvent aussi en offrir, investies en parts de capitalisation d'OPC. Les réflexes de l'assurance vie ne valent donc que chez un assureur.

---

## La palette

Celle du site Vivre au Luxembourg, recopiée dans `app/site.css` depuis `../app/styles.css` : changer une couleur du site veut dire la changer aux deux endroits.

Jusqu'au 12 octobre 2026, la rubrique portait sa propre charte, relevée sur un site institutionnel (bleu `#2957c8`, Barlow, rayons de 4 et 8 px). Elle a été abandonnée avec l'identité séparée. La règle qui l'accompagnait demeure : **aucun logo, aucun nom, aucune signature d'un organisme**, la rubrique traite un dispositif fiscal public et ne doit passer pour la page officielle de personne. Le test cherche les noms d'assureurs dans tous les fichiers et échoue s'il en trouve un.

**Le gris secondaire passe le contraste partout.** `#636d7b` rend au moins 4,61 sur tous les fonds clairs, le bleu clair compris, au-dessus du seuil de 4,5 exigé pour du petit texte. Le gris d'origine du guide, `#6a7583`, tombait à 4,12 : il a été corrigé pour tout le site. Un test mesure le contraste de chaque texte visible sur son fond réel, sur les trois vues.

**Les graphiques suivent le thème.** Leur échelle séquentielle vient des jetons `--serie-1` à `--serie-4`, ancrés sur l'accent : le taux le plus élevé porte la couleur la plus dense, ce qui se lit sans légende. En thème sombre, l'échelle s'inverse en luminosité, et la couleur la plus dense devient la plus claire.

---

## Ce que le site refuse de dire

1. **Le capital de sortie n'est pas chiffré.** Il faudrait un rendement, et aucun n'est validé.
2. **Aucune promesse de performance.** « C'est plus performant » demanderait un document daté indiquant le support, la période, les frais et l'indice de référence.
3. **Aucun contrat n'est comparé, aucun placement recommandé.** C'est écrit sur la page, pas seulement ici.

---

## Deux réglages du moteur, appris en mesurant

1. **Les mots vides sont écartés avant la pondération.** Un mot de question ne discrimine rien, mais s'il est rare dans le répertoire il récolte un poids élevé et emporte la décision : « quelle est la météo demain » se rattachait à « Quelle forme… ». La liste des mots vides règle le problème mieux qu'un seuil relevé, qui aurait fait perdre de vraies questions.
2. **La correspondance se fait en préfixe** du mot-clé vers le terme tapé. « Montrer » ne rattrapera donc jamais « montrez » : c'est la forme tapée qu'il faut écrire dans les variantes, pas l'infinitif.

---

## Structure

```
prevoyance/
  index.html          la coquille et les quatre vues
  app/
    prevoyance.js     la table fiscale et le calcul, sans dépendance au rendu
    questions.js      29 questions-réponses sourcées, 8 thèmes
    site.js           le rendu, la navigation, le panneau, les graphiques,
                      le moteur de reconnaissance
    site.css          feuille propre à ce site, aucune partagée avec le guide
```

`prevoyance.js` ne connaît ni le DOM ni le réseau : il s'appelle depuis Node comme depuis le navigateur, ce qui permet de tester le calcul sans lancer de page.

---

## Ce qu'une relecture d'un seul bloc a trouvé

Le site a été construit par ajouts successifs. Une relecture morceau par morceau ne voit pas ce qu'une relecture d'un seul bloc saute aux yeux. Sept défauts, dont trois de fond.

### Une erreur de calcul

La majoration de la prime unique d'assurance solde restant dû est de 8 % par année d'âge au-delà de 30 ans, **« sans que le montant de cette augmentation puisse dépasser 160 % »**. Le code ne plafonnait pas. À 65 ans il annonçait donc 280 %, près du double du maximum légal, et l'erreur grandissait avec l'âge. Le plafond est atteint à 50 ans, et cet âge est calculé depuis la table plutôt qu'écrit.

### Des plafonds sans source

Trois sources étaient citées, toutes sur la prévoyance-vieillesse, pour six plafonds affichés comme « plafond légal ». Un lecteur luxembourgeois connaît ces montants et les vérifie. Chacun est maintenant porté par sa propre source, et **uniquement par un site de l'État** : les résultats de recherche renvoyaient aussi vers des assureurs et des sites de frontaliers, écartés.

Ce que la vérification a donné, en plus des sources :

1. **Le plafond de l'article 111 et celui de l'épargne-logement sont majorés de leur propre montant par enfant.** Le site demandait le nombre d'enfants et n'en faisait rien pour ces deux postes. À 35 ans avec deux enfants, l'épargne-logement passe de 1 344 à 4 032 €. Ils sont aussi majorés pour un conjoint imposé collectivement, que ce site ne demande pas : la condition le dit, le calcul ne le suppose pas.
2. **Une fourchette a été retirée.** Les intérêts hypothécaires étaient annoncés « de 2 000 à 4 000 € » sans source vérifiée. La piste reste, le montant part.
3. **Un communiqué de janvier 2026 annonce le passage de l'épargne-logement à 900 et 1 500 €.** La page de l'Administration porte toujours 672 et 1 344, et la page « nouveautés 2026 » du gouvernement ne mentionne pas cette mesure. On publie ce que la source établit, pas ce qu'une annonce laisse prévoir.

### Une contradiction publiée

La page des questions affirmait « quelqu'un qui ignore que l'épargne est bloquée jusqu'à soixante ans ». C'est précisément ce que le site réfute depuis la lecture de la circulaire, et la phrase était restée. La condition d'un levier disait la même chose.

### Des affirmations sur les gens, que rien n'établit

« Ce qu'on nous demande le plus » : personne n'a rien demandé à ce site. « C'est le troisième qu'on oublie », « la confusion la plus fréquente », « l'idée fausse la plus répandue » : des superlatifs sans source, sur un site qui s'interdit d'écrire un montant sans source. Tous retirés, la règle est vérifiée par un test qui relit le texte des trois vues.

### Deux titres qui parlaient du site plutôt que du sujet

« Un chiffre avant de vous demander quoi que ce soit » et « Ce que ce calcul suppose » (suivi d'un texte qui disait autre chose). Le raisonnement de conception intéresse celui qui fabrique la page ; il n'a rien à faire dessus. Il est ici, dans ce fichier.

### Un renvoi devenu faux

« La source ci-dessous fait foi » pointait vers un encadré déplacé dans le pied de page.

### Un champ qui acceptait n'importe quoi

`type="number"` ne bloque ni les lettres collées, ni « e », ni « + », et ne fait respecter `min` et `max` qu'à la validation d'un formulaire, qu'il n'y a pas ici. Pire : sur une saisie invalide, sa propriété `value` rend une chaîne vide, si bien que le champ affichait des lettres pendant que le site se comportait comme s'il était vide, sans rien dire. Les chiffres sont maintenant filtrés à la frappe, la longueur limitée à deux, et la valeur bornée à la sortie du champ, en expliquant la correction. Borner à la frappe ferait bondir « 1 » à 18 sous les doigts.

### Un zéro qui se lisait comme un refus

Le déductible ponctuel affichait « 0 € » à l'arrivée. Il vaut zéro parce qu'aucun prêt n'est déclaré, ce qui n'est pas « vous n'y avez pas droit ». Il affiche un tiret et le motif.

---

## Sources

**Uniquement des sites de l'État**, une source par plafond, toutes ouvertes et vérifiées le 3 septembre 2026 :

| Ce qu'elle porte | Source |
|---|---|
| Le régime, les âges, l'imposition à la sortie | Administration des contributions directes, prévoyance-vieillesse |
| La démarche du contribuable | Guichet.lu, déduire les primes versées à un contrat de prévoyance-vieillesse |
| Le plafond porté à 4 500 € au 1er janvier 2026 | Gouvernement luxembourgeois, nouveautés 2026 |
| Le texte d'application, qui tranche quand un résumé paraît se contredire | Circulaire L.I.R. n° 111bis/1 – 111ter/1 du 27 avril 2022 |
| Les 672 € de l'article 111 et les 1 200 € du régime complémentaire | Administration des contributions directes, cotisations et primes d'assurance |
| Les 672 et 1 344 € de l'épargne-logement, et la majoration par enfant | Administration des contributions directes, cotisations d'épargne-logement |
| Les 6 000 € de la prime unique, la majoration par enfant, les 8 % par année et le plafond de 160 % | Administration des contributions directes, prime unique |

Un test vérifie qu'aucune source n'est hors d'un domaine de l'État, et que les trois dernières sont bien citées.

La réglementation évolue, en particulier les plafonds. La source fait foi, pas cette page.
