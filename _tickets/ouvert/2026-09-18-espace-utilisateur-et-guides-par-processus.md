# Un espace utilisateur, et des guides par processus

Ouvert le 2026-09-18.

## Demande

« Créer un espace utilisateur, une sorte de tableau de bord, avec un bouton "se connecter". Avec ça, on aura des guides pour plein de processus : installation, crédit immobilier, inscription à l'école, déclaration de revenus. Pour vraiment guider. »

## Ce que la demande contient, en deux morceaux séparés

1. **Des guides par processus.** Aujourd'hui le site n'a qu'un seul parcours, celui de l'arrivée, avec ses 37 étapes qui se cochent. La demande est d'en avoir plusieurs, un par démarche de la vie ici : un crédit immobilier, une inscription à l'école, une déclaration de revenus. C'est le fond du sujet.
2. **Un espace connecté.** Un bouton « se connecter » et un tableau de bord qui montre où l'on en est dans chacun de ses parcours.

Le premier morceau ne dépend pas du second. Le site sait déjà retenir la progression d'un parcours sans compte : elle vit dans le navigateur (`localStorage`), et c'est ce qui permet d'écrire dans le pied de page que rien ne quitte le navigateur.

## Ce qui est déjà là pour le premier morceau

1. Le mécanisme de parcours à étapes cochables existe, il est écrit pour un seul parcours (`etapesVisibles()`, la progression retenue sous `luxguide.parcours.v1`).
2. Le menu du haut a déjà une famille « Guide d'installation ». Une famille « Guides » qui liste plusieurs parcours suit le même modèle.
3. Le site épargne et retraite couvre déjà une bonne partie de la déclaration de revenus côté déductions.

Ce qui manque : rendre le mécanisme de parcours générique (plusieurs parcours, chacun avec ses étapes et sa progression), puis écrire les parcours eux-mêmes, avec leurs sources officielles. L'écriture est la partie longue, et elle ne s'invente pas : chaque étape doit venir d'une source d'État, comme les fiches.

## Ce que le second morceau coûte, et ce qu'il change

Un bouton « se connecter » suppose un serveur qui tient des comptes. Le site est aujourd'hui une page statique publiée sur GitHub Pages, sans serveur, et le pied de page promet que rien de ce que l'on saisit ne quitte le navigateur. Un compte change cette promesse : il faut un hébergement, une politique de données, et un texte qui dit ce qui est conservé.

Trois options :

1. **Sans compte.** Un tableau de bord qui lit la progression retenue dans le navigateur, pour tous les parcours. Il donne l'essentiel de ce que la demande décrit (voir où l'on en est, reprendre là où l'on s'est arrêté) sans serveur ni compte. Limite : la progression ne suit pas d'un appareil à l'autre.
2. **Compte sans serveur applicatif.** Une authentification déléguée (un fournisseur d'identité tiers) et une base hébergée, pour retrouver sa progression d'un appareil à l'autre. C'est le premier moment où une donnée quitte le navigateur, et donc le premier moment où il faut un texte sur les données.
3. **Serveur complet.** Un vrai espace client. Hors de proportion pour une démonstration.

## Recommandation

Faire le premier morceau d'abord, en option 1 : plusieurs parcours et un tableau de bord sans compte. C'est ce qui « guide vraiment », et cela ne touche pas à la promesse du pied de page. Le bouton « se connecter » se décide ensuite, quand on sait si la progression d'un appareil à l'autre est vraiment demandée.

Par quel parcours commencer : à décider. Les quatre cités (installation, crédit immobilier, école, déclaration de revenus) n'ont pas le même volume de sources à réunir.

## Décision

À prendre : l'ordre des parcours, et si le compte est voulu dès maintenant.
