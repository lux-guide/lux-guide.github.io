# Onglet Communes : prix au m² par période de construction, le neuf à part

Ouvert le 2026-09-20.

## Demande

« Pour les prix au m², tu peux faire par période de construction, en
distinguant notamment les nouvelles constructions. »

## État

Les prix de l'onglet viennent des annonces de l'Observatoire de l'Habitat,
un seul chiffre par commune, tous biens confondus. Un appartement neuf et un
appartement de 1970 n'ont pas le même prix au m², et une commune où l'on
construit beaucoup paraît plus chère qu'elle ne l'est pour l'ancien.

## Ce que la source porte, vérifié le 2026-09-20

Jeu « Prix de vente des appartements, par commune », Observatoire de
l'Habitat et STATEC, data.public.lu, licence CC0, mis à jour le 25 juin 2026.
Il vient des actes notariés et non des annonces.

1. Deux marchés seulement, pas de période de construction : les
   appartements existants, et les appartements en construction vendus en
   état futur d'achèvement. C'est exactement « le neuf à part », et rien de
   plus fin n'est publié par commune.
2. Par commune et par marché : nombre de ventes, prix moyen au m²,
   fourchette après exclusion des 5 % les plus bas et des 5 % les plus hauts.
3. Un fichier par an de 2007 à 2025, plus les douze derniers mois, d'avril
   2025 à mars 2026. Donc une série annuelle de dix-neuf ans.
4. Le prix est masqué sous dix ventes. Couverture mesurée, en communes :

| Période | Existant | Neuf | Les deux |
|---|---|---|---|
| 2007 à 2017 | 43 à 55 | 24 à 34 | 23 à 30 |
| 2018 à 2020 | 47 à 54 | 41 à 44 | 34 à 35 |
| 2021 et 2022 | 50 à 57 | 28 et 29 | 25 et 26 |
| 2023 | 42 | 7 | 5 |
| 2024 | 56 | 13 | 12 |
| 2025 | 54 | 17 | 15 |
| Douze derniers mois | 57 | 16 | 13 |

Le neuf passe sous la règle des vingt communes de `cartes/build_cartes.py`
depuis 2023 : les ventes sur plan se sont effondrées, et ce creux est une
information en soi.

## Recommandation

1. Prix au m² des appartements existants, actes notariés : indicateur de
   carte à part entière dans la famille Acheter, avec sa série 2007 à 2025
   sous le curseur du temps. 57 communes, au-dessus de la règle.
2. Prix au m² du neuf et écart neuf sur existant : dans la fiche d'une
   commune et dans le comparateur, pas en carte coloriée tant que moins de
   vingt communes ont un chiffre. La série garde les années où il y en avait
   quarante.
3. Nombre de ventes des deux marchés, à côté : il dit si le prix repose sur
   douze ventes ou sur trois cents.
4. La page dit que ces prix sont des prix signés, et les prix d'annonces
   restent à côté : l'écart entre les deux est lui aussi une information.

## Pourquoi ce n'est pas fait dans la foulée

`cartes/build_cartes.py` et `cartes/communes_kb.js` étaient en cours de
modification par une autre session le 20 septembre, population et
nationalités par quartier. Régénérer la base au même moment aurait mêlé deux
travaux. À faire dès que ce travail est committé. Les fichiers sont
téléchargeables sans clé, la lecture demande `xlrd`, format `.xls`.
