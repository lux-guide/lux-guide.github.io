# Fiche « Immatriculer son véhicule » : un parcours guidé au lieu d'un long texte

Ouvert le 3 octobre 2026.

Pris par lux doc [920117] le 2026-10-03.

## Contexte

L'auteur, 03-10 : « tu peux modifier la page https://lux-guide.github.io/#fiche/vehicule,
faire un design très clair ». Juste avant, sur la réponse qui renvoyait à cette fiche :
« c'est trop de texte, c'est pas suffisamment synthétique, et guidé !!! faire mieux ».

La fiche est aujourd'hui une suite de paragraphes longs, puis deux tableaux. L'ordre des
étapes, qui est le cœur du sujet, est noyé dans une phrase de cinq propositions.

## Ce qu'il faut faire

1. Un tri en tête : votre cas (véhicule venu de l'Union, occasion déjà luxembourgeoise,
   neuf chez un concessionnaire). Les deux cas simples se règlent dans leur carte.
2. Pour le véhicule importé, des onglets courts : Étapes, Dossier, Vendeur, Coûts, Cas
   particuliers.
3. Étapes numérotées, chacune avec où aller et la pièce obtenue. Dossier en liste à cocher.
   Vendeur par pays.
4. Le rendu dans un module à part (`app/guide.js`, `app/guide.css`) : `ui.js` et
   `styles.css` sont déjà trop gros pour grossir encore.
5. Le texte que lit l'assistant reste dérivé du même contenu, pour qu'il n'y ait qu'une
   source.
