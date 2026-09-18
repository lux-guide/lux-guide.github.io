# Onglet Communes : séparer la carte, les deux cartes et le comparateur

Ouvert le 2026-09-18.

## Demande

« Quand je choisis salaires et une commune, je dois voir l'évolution pour cette
commune. Actuellement, si je choisis une ou plusieurs communes, j'ai la
comparaison complète, et c'est perturbant : au dessus j'ai choisi juste
salaire médian, en dessous j'ai toutes les données. Le comparateur des
communes, pour toutes les données, doit avoir un bouton spécifique, même pas
besoin de choisir les indicateurs. Aussi, la ligne De l'autre côté, France,
Belgique, Allemagne peut être mieux gérée : Luxembourg toutes les communes,
Luxembourg-Ville par quartier, zone frontière FR, BE, DE, ce sont des choix
homogènes. Et comparer deux cartes, c'est un autre registre. »

## Ce qui a été fait

1. Une rangée « Territoire » avec cinq choix de même nature : Luxembourg, les
   cent communes ; Luxembourg-Ville, par quartier ; France, Belgique et
   Allemagne, zone frontalière. La rangée « Région » reste sous le pays choisi.
2. Une rangée « Vue » avec trois boutons, un seul actif : une carte, deux
   cartes côte à côte, comparer des communes. Deux cartes reste réservé aux
   cent communes du Luxembourg, le bouton est grisé ailleurs et dit pourquoi.
3. En vue « une carte », la fiche d'une commune cliquée ne montre plus que
   l'indicateur affiché : valeur, rang, position dans l'étendue, et la courbe
   annuelle quand la série existe, avec l'année du curseur marquée d'un trait.
   Jusqu'à cinq communes se lisent sur le même graphique, une couleur chacune.
   Un bouton mène à toutes leurs données.
4. En vue « comparer des communes », la rangée des familles et des indicateurs
   disparaît. La carte devient un sélecteur : communes grises, celles du
   panier colorées. La colonne de droite devient une liste alphabétique avec
   un champ de recherche. Le tableau complet se lit dessous, avec les mêmes
   couleurs en tête de colonne. Le nom d'une ligne ne fait rien au clic : il
   a un temps ramené en vue « une carte », et l'on changeait de vue sans
   l'avoir demandé. On change de vue par la rangée « Vue » seulement.
5. Le panier de communes est le même dans les deux vues : on choisit les
   communes une fois, et on change seulement la façon de les regarder.

## Suites, le même jour

1. L'en-tête du tableau reste collé sous la barre du site pendant qu'on
   descend : à la trentième ligne on ne savait plus quelle colonne était
   quelle commune. Le garde-fou `html, body { overflow-x: hidden }` faisait
   du corps de page un conteneur de défilement et annulait tout collage ; il
   ne porte plus que sur `html`, ce qui protège autant du débordement.
2. Chaque colonne porte deux flèches pour la déplacer et une croix pour la
   retirer. La couleur suit la position, sur la carte et dans les puces.
3. Sur la carte, cliquer une commune déjà retenue la retire.
4. Les parts de nationalités portent une barre, la plus longue pour la part
   la plus forte du bloc, les autres à proportion.
5. Le graphe d'évolution se lit au survol : un trait suit l'année la plus
   proche, un point se pose sur chaque courbe, une bulle donne la valeur de
   chaque commune. Un clic pose l'année sur la carte. La courbe du Gini du
   pays reçoit le même survol, et les mini-courbes du tableau disent leurs
   deux bornes au survol.
6. Survol croisé entre la liste et la carte : une ligne survolée éclaire sa
   commune, une commune survolée éclaire sa ligne.

## Fermé

Fait le 2026-09-18, dans ce dépôt directement. Parcours vérifié par capture
d'écran sur les trois vues, les trois territoires et une nationalité, sans
erreur console propre à l'onglet et sans débordement à 390 px.
