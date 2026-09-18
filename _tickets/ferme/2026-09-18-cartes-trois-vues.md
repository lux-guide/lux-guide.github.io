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
   couleurs en tête de colonne. Cliquer le nom d'une ligne repasse en vue
   « une carte » sur cet indicateur.
5. Le panier de communes est le même dans les deux vues : on choisit les
   communes une fois, et on change seulement la façon de les regarder.

## Fermé

Fait le 2026-09-18, dans ce dépôt directement. Parcours vérifié par capture
d'écran sur les trois vues, les trois territoires et une nationalité, sans
erreur console propre à l'onglet et sans débordement à 390 px.
