# Onglet Communes : publier toutes les données, pas seulement les exemples cités

Ouvert le 2026-09-09.

## Demande

« Je t'ai donné des exemples de données à chaque fois, et j'ai l'impression que tu as
juste mis ce que j'ai demandé. Tu dois tout mettre si tu as d'autres données. »

## État

`cartes/build_cartes.py` télécharge cinq flux STATEC et quatre fichiers de
l'Observatoire de l'Habitat, puis n'en garde qu'une partie :

1. `DF_X021` population : seules deux années sont conservées, la dernière et
   celle d'il y a dix ans. Toute la série annuelle est dans le fichier.
2. `DF_X026` emploi : seules les variables C1 et C6 sont lues.
3. `DF_C1600` salaires : les cinq indicateurs M010 à M050 sont lus, complet.
4. Loyers de maison téléchargés (`loym_m2`, `loym_tot`) mais jamais posés dans
   les indicateurs : deux séries chargées pour rien.
5. Recensement 2021 : quatre parts seulement, luxembourgeois, UE, hors UE,
   étrangers, alors que le flux porte le détail par nationalité.

## À faire

Reprendre chaque flux, lister ce qu'il contient réellement, et publier tout ce
qui a un sens pour quelqu'un qui s'installe. Le contrôle de couverture en fin
de script doit rester la garantie qu'aucun indicateur vide n'est publié.

## Fermé

Fait le 2026-09-09. Le script publie maintenant tous les flux qu'il télécharge : 48 indicateurs contre 20, les loyers de maisons écartés faute de couverture (4 communes), et le niveau géographique lu sur le code et non sur le nom.
