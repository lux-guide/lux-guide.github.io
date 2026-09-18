# La copie du guide dans le dépôt de travail est en retard sur le site publié

Ouvert le 2026-09-18.

## Constat

Le README du dossier `lux_guide/` du dépôt de travail dit que ce dossier fait foi : on modifie là, puis on recopie ici. Ce n'est plus vrai. Depuis au moins le 13 septembre, des changements sont faits directement dans ce dépôt public et ne remontent pas :

1. la barre de navigation regroupée en trois menus (« Guide d'installation », « Budget », « Où habiter »), alors que la copie de travail garde dix onglets à plat ;
2. les quatre crédits d'impôt du simulateur et le salaire du conjoint, commits du 17 et du 18 septembre ;
3. les cartes lisibles et le fond de carte sans quota, commits du 13 septembre ;
4. l'onglet Communes réorganisé en trois vues (une carte, deux cartes, comparer des communes) et une rangée Territoire, le 18 septembre, voir `_tickets/ferme/2026-09-18-cartes-trois-vues.md`. La copie de travail n'a ni les pays voisins ni le comparateur : `app/cartes.js` y fait 674 lignes contre plus de 2 000 ici.

Mesuré le 18 septembre, fins de ligne ignorées : `index.html` diffère de 138 lignes, `app/styles.css` de 173, `app/ui.js` de 239, `app/simulateur.js` de 99.

## Pourquoi c'est un risque

La procédure écrite recopie la copie de travail vers le site public en miroir. Appliquée aujourd'hui, elle effacerait tout le travail listé plus haut, sans message d'erreur.

Le lien « Épargne et retraite » de l'en-tête a d'ailleurs d'abord été fait dans la copie de travail, sur la barre à dix onglets, avant de constater l'écart. Il a été refait ici, sur la barre réelle.

## Options

1. **Ce dépôt public devient la source.** On le dit dans les deux README, on retire la procédure de miroir, et la copie de travail est supprimée ou réduite à un renvoi. C'est ce qui se pratique déjà.
2. **La copie de travail redevient la source.** On y ramène d'abord tout ce qui a été fait ici, puis on reprend le miroir. Suppose que toutes les sessions s'y tiennent.
3. Garder deux copies et les synchroniser à la main dans les deux sens. Déconseillé : c'est l'état actuel, et il a déjà produit un écart de plusieurs centaines de lignes.

## Recommandation

L'option 1. Le travail se fait déjà ici, une seule copie supprime le risque au lieu de le surveiller.

## Décision

À prendre.
