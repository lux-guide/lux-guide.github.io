# Onglet Communes : tableaux de bord et mesure des inégalités

Ouvert le 2026-09-09.

## Demande

« Proposer aussi des dashboards classiques, à toi de jouer. »
« Coefficient de Gini, inégalités. »

## Pistes

1. Fiche de commune en tableau de bord : rang sur chaque indicateur,
   distribution du pays avec la commune située dessus, comparaison à la
   moyenne nationale et aux communes voisines.
2. Inégalités : le rapport interdécile D9/D1 est déjà calculé (`sal_ratio`).
   Un Gini demande la distribution complète des salaires, que `DF_C1600` ne
   donne pas (moyenne, D1, médiane, D9 seulement). Deux options, à trancher :
   chercher un flux STATEC qui porte la distribution, ou publier une mesure
   approchée en disant explicitement laquelle et sur quoi elle est calculée.
   Ne pas présenter un Gini estimé comme un Gini mesuré.
