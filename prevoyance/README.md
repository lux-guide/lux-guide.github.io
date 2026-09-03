# Épargne-retraite au Luxembourg

Site de démonstration autonome, consacré à la prévoyance-vieillesse luxembourgeoise, l'article 111bis, et aux autres postes déductibles. Il chiffre ce qu'une situation rapporte, sans compte, sans nom et sans modèle de langue.

Ouvrir `index.html` dans un navigateur, ou servir le dossier. Aucune dépendance, aucun outil de construction.

---

## Pourquoi un site à part, et pas un onglet du guide

Le sujet a d'abord été ajouté comme onglet au [guide d'installation](../lux_guide/README.md). C'était une erreur, pour une raison simple : **la déduction ne concerne pas que les arrivants.** Elle s'ouvre à toute personne imposée au Luxembourg, qu'elle soit là depuis huit jours ou depuis vingt ans. Rangée sous « s'installer », elle devenait invisible pour la moitié des gens qu'elle concerne.

Ce qui trahit, quand on héberge un sujet dans un produit qui n'est pas le sien, n'est pas ce qu'on masque : c'est ce qu'on garde. L'ordre des sections, le vocabulaire, ce qui arrive en premier. D'où un second site, avec sa propre adresse, sa propre coquille et sa propre identité.

| | Guide d'installation | Ce site |
|---|---|---|
| Adresse | `/` | `/prevoyance/` |
| Public | les personnes qui arrivent | toute personne imposée au Luxembourg |
| Vu en premier | un parcours de démarches | un chiffre, avant toute question |
| Coquille | huit sections, un assistant global | trois onglets, un assistant en panneau |
| Typographie | Fraunces et Inter | Barlow et Inter |
| Thème | clair, sombre, système | un seul, clair |

Un lien discret dans le pied de page mène au guide, pour qui vient d'arriver. C'est le seul point de contact, et il est volontairement en bas.

---

## Trois onglets, et un assistant qui reste ouvert à côté

1. **Accueil.** Le plafond montré comme un mouvement, un chiffre calculé dès l'arrivée, les quatre moments du dispositif, les trois conditions, six questions fréquentes.
2. **Simulateur.** Quatre questions, les plafonds ouverts, le mode d'obtention de chaque montant, l'économie par taux d'imposition en barres, et le cumul sur dix ans en courbes.
3. **Questions.** Vingt-neuf questions écrites et sourcées, filtrables, groupées par thème.

**L'assistant n'est pas une destination, c'est un compagnon.** Il était un quatrième onglet, ce qui obligeait à quitter le simulateur pour poser une question, puis à y revenir pour vérifier. Il s'ouvre maintenant en panneau latéral, par un bouton de l'en-tête, et reste ouvert pendant qu'on lit. Au-delà de 1180 px il pousse le contenu au lieu de le recouvrir : on lit et on demande en même temps. En dessous, il recouvre, avec un voile, et se ferme par Échap.

Il est fixe et porte son propre défilement. Un cadre qui défile à l'intérieur d'une page qui défile oblige à viser pour choisir lequel bouge ; ici les deux zones sont séparées à l'écran et chacune porte le sien.

Chaque onglet a son adresse (`#simulateur`, `#questions`), et `#assistant` ouvre le panneau sans changer la vue qu'on regardait.

---

## Les règles qui tiennent le site

Chacune est vérifiée par un test. Cent-sept contrôles, dans [test_prevoyance.py](test_prevoyance.py) :

```bash
python -m http.server 8932 --directory prevoyance
python prevoyance/test_prevoyance.py
```

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

### 6. Un chiffre avant de demander quoi que ce soit

Un bouton « calculez votre avantage » réclame de la confiance avant d'en avoir donné. Trois situations sont donc déjà calculées à l'arrivée. **Le troisième cas ne donne droit à rien et il est montré exprès** : un outil qui ne sait dire que oui n'est pas cru quand il dit oui. Sur ce cas, la page ne dessine ni tableau ni indicateur, seulement le motif du refus. Un tableau vide laisse croire à un défaut d'affichage.

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

### 12. L'assistant renvoie à l'endroit exact de la page

Une réponse gagne à montrer d'où elle vient. Un bouton « Voir sur la page » ouvre la bonne vue, y défile et **surligne l'élément** : la carte « Imposé au Luxembourg » pour la question sur les frontaliers, le graphique par taux pour celle sur ce que la déduction rapporte, la condition de durée pour le mythe des dix ans.

Trois choix de conception derrière ce petit bouton :

1. **Les cibles portent un `data-ancre` posé au moment où l'élément est construit.** Un sélecteur CSS écrit à la main casserait au premier remaniement de la page, sans que rien ne le signale ; un `data-ancre` se voit dans le code qui construit l'élément.
2. **La table des ancres vit dans `site.js`, pas dans `questions.js`.** Le répertoire de questions ne connaît pas le DOM de ce site et doit rester lisible sans lui.
3. **Un seul endroit surligné à la fois**, et la marque s'efface après trois secondes. Deux marques en même temps, dont une qui répond à une question déjà oubliée, ne désignent plus rien ; une marque qui reste devient une décoration et on cesse de la voir.

### 13. Le pied de page porte les sources, et elles ne sont pas écrites à la main

Il portait quatre lignes de mentions répétées sur chaque vue, derrière un accordéon. Une mention lue partout n'est plus lue nulle part, et trois lignes de texte ne méritent pas un mécanisme à ouvrir.

Ce qu'un pied de page porte d'utile ici, ce sont les sources : le site s'interdit d'afficher une réponse sans elles, autant les rassembler. **Elles sont construites depuis les sources que le répertoire cite réellement**, sans doublon. Un test compare la liste rendue à celle des sources citées et échoue si elles divergent. C'est ce qui a révélé un doublon : l'accueil et le simulateur affichaient chacun un encadré de sources bâti sur la table des chiffres, qui en listait trois quand le répertoire en cite quatre. Deux listes de sources, c'est celle qu'on oublie de mettre à jour qui ment.

La mention légale tient en un paragraphe, en bas, sans repli.

### 14. L'âge de sortie est calculé, jamais affiché par défaut

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

Couleurs et typographie relevées sur le site institutionnel du groupe, en mesurant les styles calculés de la page plutôt qu'en les estimant à l'œil : bleu `#2957c8`, marine `#01213c`, gris `#1a1d23` et `#67768e`, fonds `#f8f9fc` et `#eaeefa`, Barlow pour les titres, Inter pour le texte, rayons courts de 4 et 8 px.

La reprise s'arrête là. **Aucun logo, aucun nom, aucune signature :** ce site traite un dispositif fiscal public, il ne doit passer pour la page officielle de personne. Le test cherche les noms d'assureurs dans tous les fichiers et échoue s'il en trouve un.

Un écart assumé par rapport à la charte relevée : **le gris a été assombri**, de `#67768e` à `#5f6d85`. Le gris d'origine rend 4,38 sur le fond de page et 3,97 sur le bleu clair, sous le seuil de 4,5 exigé pour du petit texte. Un test mesure le contraste de chaque texte visible sur son fond réel, sur les quatre vues.

Les graphiques utilisent une échelle séquentielle tirée de la même charte, `#a9bce9`, `#7c9ade`, `#2957c8`, `#041d58` : le taux le plus élevé porte la couleur la plus dense, ce qui se lit sans légende.

**Un seul thème.** Il n'y a pas de mode sombre, et donc pas de sélecteur : la palette est bâtie pour le blanc, et deux thèmes veulent dire deux fois les réglages de contraste à tenir pour un site de démonstration qui se lit de jour.

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

## Sources

Les chiffres viennent de quatre sources officielles, citées dans le pied de chaque réponse et vérifiées le 28 août 2026 :

1. Administration des contributions directes, prévoyance-vieillesse.
2. Guichet.lu, déduire les primes versées à un contrat de prévoyance-vieillesse.
3. Gouvernement luxembourgeois, nouveautés 2026, qui porte le relèvement du plafond au 1er janvier 2026.
4. Circulaire L.I.R. n° 111bis/1 – 111ter/1 du 27 avril 2022, le texte d'application, qui fait foi quand un résumé paraît se contredire.

La réglementation évolue, en particulier les plafonds. La source fait foi, pas cette page.
