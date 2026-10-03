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

## Fait le 3 octobre 2026

La fiche s'ouvre sur trois repères (délai, coût, dépôt), un tri « Votre cas », puis des
onglets : Étapes, Dossier, Vendeur, Coûts, Cas particuliers. Les étapes sont numérotées,
avec pour chacune où aller, quoi apporter, ce que ça coûte et ce qu'on obtient. Le dossier
est une liste à cocher gardée dans le navigateur.

Le contenu a été revérifié sur Guichet.lu (page mise à jour le 16.04.2026) : l'ordre
officiel place le droit de chancellerie avant la vignette 705, et les plaques se font dès
la réservation du numéro, avant le rendez-vous. Le contrôle technique n'est plus présenté
comme une étape mais comme une pièce du dossier. Adresses et téléphones des douanes et de
la SNCA ajoutés depuis la même page. Prix du contrôle technique pris sur snct.lu.

Fichiers : `app/fiches/vehicule.js` (contenu), `app/guide.js` et `app/guide.css` (rendu,
réutilisable par d'autres fiches). Contrôlé en clair, en sombre et à 390 px : aucun
débordement horizontal. Au passage, le bandeau photo de toutes les fiches débordait de
8 px sur mobile, corrigé dans `styles.css`.
