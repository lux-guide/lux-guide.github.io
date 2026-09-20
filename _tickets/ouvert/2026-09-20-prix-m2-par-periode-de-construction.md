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

## À vérifier avant de construire

1. Ce que l'Observatoire de l'Habitat publie réellement par commune : les
   prix issus des actes notariés distinguent les appartements existants des
   ventes en état futur d'achèvement. C'est la piste la plus directe pour
   « le neuf à part ». À confirmer sur data.public.lu, fichier et millésime.
2. S'il existe une ventilation par période de construction, ou seulement
   existant contre neuf. Ne rien afficher que la source ne porte pas.
3. La couverture : un indicateur chiffré dans moins de vingt communes n'est
   pas publié, règle déjà en place dans `cartes/build_cartes.py`.

## Recommandation

Deux indicateurs de plus dans la famille Acheter si la source le permet :
prix au m² des appartements existants, prix au m² des appartements neufs, et
l'écart entre les deux. Actes notariés plutôt qu'annonces, et la page le dit.
