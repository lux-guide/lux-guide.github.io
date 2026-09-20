# Comparer des logements : séparer la liste, la carte et la comparaison

Ouvert le 2026-09-20.

## Demandes

1. « Faire mieux, ne pas mélanger infos et la carte. »
2. « Laisser enregistrer des adresses qui correspondraient à des logements
   recherchés, pour avoir en tête, et avoir aussi les écoles, etc. »

## Ce qui n'allait pas

Un seul bloc portait le repère de trajet, l'ajout d'adresse, le rayon, cinq
cases à cocher, deux boutons et les adresses. Des boutons s'étiraient sur
toute la largeur. La carte mêlait cinq sortes de points sans légende. Et toute
la comparaison dépendait d'Overpass, service externe qui cale souvent : le
tableau restait sur « Calcul des environs ».

## Ce qui a été fait

1. Trois zones. À gauche, « Vos logements » : l'ajout, une fiche par logement,
   le repère de trajet. À droite, la carte et ses seules commandes : les
   catégories en puces colorées, qui servent de légende, et le rayon. Dessous,
   la comparaison sur toute la largeur.
2. Chaque logement garde un loyer ou prix, le lien de l'annonce et une note,
   enregistrés dans le navigateur avec les catégories choisies. Dix logements
   au plus, contre quatre. Les notes montent en tête du tableau. L'exemple et
   « tout effacer » demandent confirmation avant de remplacer ce qui est
   enregistré.
3. Écoles fondamentales, maisons relais et foyers, crèches et lycées viennent
   du fichier du ministère, `cartes/ecoles_kb.js`, le même que l'onglet
   Communes : noms officiels, calcul local et immédiat, et la mention
   « accueil sur le même site » quand l'école a sa maison relais. Le plus
   proche est toujours donné, même hors du rayon : un lycée est rarement à un
   kilomètre.
4. Overpass ne sert plus qu'aux arrêts, aux commerces et à la santé. Les trois
   sont demandés ensemble et gardés en mémoire, cocher une catégorie ne relance
   rien. Deux serveurs, l'un en secours. En cas d'échec, les cases disent
   « non chargé », un message l'explique, un bouton réessaie, et la moitié
   scolaire du tableau reste.
5. Les logements sont des pastilles noires numérotées, les mêmes dans la
   liste, sur la carte et en tête de colonne. Les couleurs sont réservées aux
   catégories.

## Limites

1. Le fichier du ministère date de 2021 et ne porte que les écoles publiques.
   L'école la plus proche n'est pas forcément celle du secteur, la page le dit.
2. Le 20 septembre, les deux serveurs Overpass n'ont pas répondu pendant les
   essais : les lignes transports, commerces et santé n'ont pas pu être
   vérifiées avec des données, seulement leur état d'échec.

## Fermé

Fait le 2026-09-20. Parcours vérifié par script : exemple, notes, catégories,
rechargement de la page, retrait, 390 pixels de large.
