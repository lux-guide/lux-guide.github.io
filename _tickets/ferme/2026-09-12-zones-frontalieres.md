# Habiter de l'autre côté de la frontière

Ouvert le 2026-09-12.

## Demande

« Donner des infos des zones frontalières, France, Belgique et Allemagne : niveau
de revenu et autres. Certains peuvent vouloir habiter dans les pays voisins.
Des infos comme : moins cher pour certains produits en Allemagne, des activités
à Thionville. »

## Pourquoi ça manque

Le guide est écrit comme si l'on s'installait forcément au Luxembourg. Or un
arrivant sur deux qui travaille au Luxembourg habite de l'autre côté : environ
200 000 frontaliers, de France surtout, puis de Belgique et d'Allemagne. Le
guide ne dit rien de ce choix, qui est pourtant le premier à faire.

## Sources repérées, toutes ouvertes et sans clé

1. **Eurostat GISCO, LAU 2021** : géométrie et population des communes des
   quatre pays, dans un seul fichier harmonisé (126 Mo, filtré à la
   construction). C'est ce qui rend les trois pays comparables sur une carte.
2. **Eurostat `prc_ppp_ind`** : indices de niveau des prix par pays et par
   catégorie de produit, 61 catégories. C'est la réponse sourcée à « qu'est-ce
   qui coûte moins cher en Allemagne ».
3. **Eurostat `nama_10r_2hhinc`** : revenu disponible des ménages par habitant,
   en standards de pouvoir d'achat, au niveau NUTS 2. Les six régions de la
   Grande Région y sont, et les valeurs sont comparables entre pays, ce que les
   statistiques nationales ne permettent pas.
4. **Eurostat `nama_10r_3gdp`** et chômage régional : niveau NUTS 3, soit le
   département en France, l'arrondissement en Belgique, le Kreis en Allemagne.

## Ce qui n'est pas faisable tel quel

Un revenu médian par commune existe en France (Filosofi) et en Belgique
(statistique fiscale), mais pas en Allemagne, où le revenu n'est publié qu'au
Kreis. Et les trois définitions diffèrent : niveau de vie par unité de
consommation en France, revenu imposable par déclaration en Belgique, revenu
disponible par habitant en Allemagne. Les mettre sur la même échelle de couleurs
serait une comparaison fausse. La carte reste donc sur ce qui est harmonisé, et
le revenu comparable est donné à l'échelle régionale.

## Reste à faire après cette première version

1. Revenu médian communal France et Belgique, sur une échelle par pays et jamais
   entre pays, si une forme honnête se trouve.
2. Prix de l'immobilier de l'autre côté : DVF en France, statistique des ventes
   en Belgique, Gutachterausschüsse en Allemagne. Trois méthodes différentes.
3. Temps de trajet réels vers Luxembourg-Ville, et pas seulement la distance à
   vol d'oiseau.

## Fermé

Fait le 2026-09-12. Troisième couche de la carte, 906 communes frontalières (515 FR,
366 DE, 25 BE) avec géométrie, population, densité, distance à Luxembourg-Ville et à la
frontière, toutes issues du référentiel européen LAU 2021 donc mesurées de la même façon.
Sous la carte, les six régions de la Grande Région comparées sur le revenu disponible par
habitant en standards de pouvoir d'achat, et les seize catégories de prix d'Eurostat avec
le Luxembourg ramené à 100. Une fiche et trois questions fréquentes pour les conséquences
administratives, plus quatre retours d'expérience dans le registre communauté.

Le revenu médian communal de France et de Belgique n'a pas été publié, faute d'équivalent
allemand et de définition commune : le point 1 du « reste à faire » demeure ouvert, mais
il n'a plus d'urgence, le revenu comparable étant donné à l'échelle régionale.
