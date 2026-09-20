# Onglet Communes : les écoles et les campus sur la carte, et dix colonnes

Ouvert le 2026-09-20.

## Demandes

1. « À Mamer il y a un campus d'école, tu peux trouver d'autres
   infrastructures comme ça ? Avec les écoles, les maisons relais ensemble. »
2. « Tu peux faire ces points d'intérêt à afficher si on clique pour
   afficher ? »
3. « Tu dois afficher les plans cadastraux des écoles, campus si possible,
   parfois c'est toute une zone. Chercher bien pour bien illustrer, pour
   qu'on se rende mieux compte. »
4. « Permettre de comparer dix communes ou quartiers, et faire un scroll
   horizontal. »

## Ce qui a été trouvé

Le ministère de l'Éducation nationale publie en licence CC0 les adresses des
écoles fondamentales publiques, des lycées et des services d'éducation et
d'accueil, situation 2021, dernière version. Une autre session en tirait déjà
des notes par commune, sans coordonnées. `cartes/build_ecoles.py` situe
maintenant chaque adresse avec le registre des adresses du cadastre : 920
points, 843 au bâtiment, 35 estimés, 42 à la rue.

Le campus de Mamer, 42 route d'Arlon, n'est pas dans le registre. Le premier
essai prenait le numéro le plus proche, le 43, en face et 270 mètres trop à
l'ouest. Le point est maintenant estimé entre les deux numéros du même côté
qui l'encadrent, le 40 et le 46, et la photo aérienne montre qu'il tombe sur
le bâtiment.

Une école et une structure d'accueil d'enfants scolarisés sont dites sur le
même site quand elles ont la même adresse écrite, ou quand leurs deux
bâtiments sont à 150 mètres ou moins. 95 écoles fondamentales sur 168 sont
dans ce cas, dont 31 avec aussi un accueil de jeunes enfants. Huit écoles
seulement portent le mot campus dans leur nom : le regroupement est bien plus
répandu que le mot.

## Ce qui a été fait

1. Une rangée « Afficher » : écoles fondamentales, maisons relais et foyers
   de jour, crèches, lycées. Rien n'est affiché au départ. Une école entourée
   d'un anneau vert a un accueil sur le même site. La bulle donne le nom, le
   genre, l'adresse, les structures du même site et la précision du point.
2. Les emprises : 477 contours d'écoles et de structures d'accueil tirés
   d'OpenStreetMap par `cartes/build_emprises.py`, chargés au premier point
   demandé. Cliquer un point mène au site.
3. Une rangée « Fond » : carte claire, photo aérienne, plan cadastral. Les
   deux dernières sont les couches `ortho_latest` et `cadastre` du Géoportail,
   en données ouvertes, sans clé. Le plan cadastral montre les parcelles
   numérotées et les bâtiments, les bâtiments publics en bleu : c'est lui qui
   fait voir qu'un campus occupe tout un îlot. Sous ces fonds, les aplats de
   l'indicateur deviennent presque transparents.
4. Le comparateur accepte dix communes ou quartiers. Au-delà de cinq, ou sur
   un téléphone, le tableau défile dans son propre cadre, en-tête et première
   colonne figés. Les nationalités comparées sur une carte restent à six.

## Limites, dites sur la page ou ici

1. Les adresses datent de 2021 et ne listent qu'une adresse par école, pas
   une par bâtiment.
2. Les écoles privées et internationales du fondamental ne sont pas dans le
   fichier du ministère.
3. Les contours d'OpenStreetMap sont bons pour les écoles, inégaux pour les
   crèches, souvent saisies comme un point. Le campus Kinneksbond lui-même
   n'y a pas de contour : c'est le plan cadastral qui le montre.

## Fermé

Fait le 2026-09-20. Vérifié par capture sur le campus de Mamer, sur les trois
fonds, et par script sur les dix colonnes, à 1280 et à 390 pixels.
