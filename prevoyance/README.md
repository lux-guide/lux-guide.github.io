# Épargne-retraite au Luxembourg

Site de démonstration autonome, consacré à la prévoyance-vieillesse luxembourgeoise, l'article 111bis, et aux autres postes déductibles. Il chiffre ce qu'une situation rapporte, sans compte, sans nom et sans modèle de langue.

Ouvrir `index.html` dans un navigateur, ou servir le dossier. Aucune dépendance, aucun outil de construction.

---

## Pourquoi un site à part, et pas un onglet du guide

Le sujet a d'abord été ajouté comme onglet au [guide d'installation](../lux_guide/README.md). C'était une erreur, pour une raison simple : **la déduction ne concerne pas que les arrivants.** Elle s'ouvre à toute personne imposée au Luxembourg, qu'elle soit là depuis huit jours ou depuis vingt ans. Rangée sous « s'installer », elle devenait invisible pour la moitié des gens qu'elle concerne.

Ce qui trahit, quand on héberge un sujet dans un produit qui n'est pas le sien, n'est pas ce qu'on masque : c'est ce qu'on garde. L'ordre des sections, le vocabulaire, ce qui arrive en premier. D'où un second site, avec sa propre adresse, sa propre coquille et sa propre identité.

| | Guide d'installation | Ce site |
|---|---|---|
| Adresse | `/` | `/prevoyance/` |
| Public | les personnes qui arrivent | toute personne imposée au Luxembourg |
| Vu en premier | un parcours de démarches | un chiffre, avant toute question |
| Coquille | huit sections, un assistant global | quatre onglets, un assistant dédié |
| Palette | bleu marine | vert profond |

Un lien discret dans le pied de page mène au guide, pour qui vient d'arriver. C'est le seul point de contact, et il est volontairement en bas.

---

## Les quatre onglets

1. **Accueil.** Le plafond montré comme un mouvement, un chiffre calculé dès l'arrivée, les quatre moments du dispositif, les trois conditions, six questions fréquentes.
2. **Ce que cela rapporte.** Quatre questions, les plafonds ouverts, le mode d'obtention de chaque montant, et l'économie par taux d'imposition.
3. **Questions fréquentes.** Vingt-sept questions écrites et sourcées, filtrables, groupées par thème.
4. **Poser une question.** L'assistant, qui annonce son périmètre avant qu'on lui parle.

Chaque onglet a son adresse (`#simulateur`, `#questions`, `#assistant`) : elle se partage, se met en favori, et le bouton Précédent fonctionne.

---

## Les règles qui tiennent le site

Chacune est vérifiée par un test. Cinquante-neuf contrôles, dans [test_prevoyance.py](test_prevoyance.py) :

```bash
python -m http.server 8932 --directory prevoyance
python prevoyance/test_prevoyance.py
```

### 1. Une seule table de chiffres

Tous les montants de loi vivent dans `app/prevoyance.js`, datés et sourcés. Aucun n'est écrit dans un écran ni dans une réponse : les textes portent des marques, `{plafond}`, `{annee}`, `{sortieMin}`, remplies au rendu. Deux tests relisent `site.js` et `questions.js` et échouent si un plafond y apparaît en dur.

La raison est concrète : le plafond est passé de 3 200 à 4 500 euros au 1er janvier 2026. Un montant recopié à trois endroits, ce sont deux endroits qui mentent le jour du changement. Le guide voisin en a fait l'expérience, il publiait encore l'ancien montant.

### 2. Aucun modèle de langue

Les réponses sont écrites, relues et sourcées à l'avance. Un modèle qui rédigerait à partir des mêmes sources produirait des phrases justes la plupart du temps et un plafond inventé de temps en temps. Sur une déduction fiscale, « la plupart du temps » n'est pas un niveau de service, et l'erreur ne se voit pas : la phrase reste grammaticale.

L'appariement est lexical et pondéré, variante d'IDF au carré. Un test vérifie qu'aucun appel réseau ne figure dans le code.

### 3. Pas de source, pas de réponse

Le rendu refuse d'afficher un texte sans ses citations. Un test compte les blocs de sources et exige qu'il y en ait autant que de questions affichées.

### 4. Quatre statuts, quatre rendus visuellement distincts

`réponse`, `je peux comprendre deux choses`, `hors de ce que je sais`, `donnée personnelle`. Les aplatir en « du texte dans une bulle » annulerait tout ce que le moteur fait pour distinguer ce qu'il sait de ce qu'il suppose.

### 5. Aucune donnée personnelle n'est lue, ni affichée

IBAN, numéro long, téléphone, adresse électronique : la réponse est un refus, et **même le message de l'utilisateur n'est pas rendu tel quel**. Il resterait dans la page et dans une capture d'écran. Un écho est déjà une conservation.

### 6. Un chiffre avant de demander quoi que ce soit

Un bouton « calculez votre avantage » réclame de la confiance avant d'en avoir donné. Trois situations sont donc déjà calculées à l'arrivée. **Le troisième cas ne donne droit à rien et il est montré exprès** : un outil qui ne sait dire que oui n'est pas cru quand il dit oui. Sur ce cas, la page ne dessine ni tableau ni indicateur, seulement le motif du refus. Un tableau vide laisse croire à un défaut d'affichage.

### 7. Les deux totaux ne s'additionnent jamais

Le déductible annuel et le déductible ponctuel sont deux champs séparés. Leur somme serait arithmétiquement exacte et fausse dans son sens : personne ne déduit cela dans une année.

### 8. On ne devine jamais le taux d'imposition

Une colonne par taux, de 20 à 42 %, et la personne se situe. Afficher le plus élevé donnerait le chiffre le plus flatteur, faux pour presque tout le monde.

### 9. Chaque montant explique d'où il vient

Une colonne du tableau porte le mode d'obtention, par exemple « 6 000 de base + 2 × 1 200 par enfant puis + 8 % par année au-delà de 30 ans ».

### 10. L'âge de sortie est calculé, jamais affiché par défaut

`ageSortieEffectif(age)` rend la plus tardive des deux dates : l'âge légal, ou l'année de souscription plus la durée minimale du contrat. Écrire « à partir de 60 ans » en dur serait faux pour toute personne qui souscrit après 50 ans, et faux dans le sens qui compte, puisque c'est précisément à cet âge qu'on regarde le dispositif de près.

---

## Ce qui vient d'entretiens, et ce qui en a été écarté

Cinq entretiens avec un praticien du dispositif ont été relus pour compléter le répertoire. Ils apportent surtout les idées fausses courantes, qu'aucun texte officiel ne prend la peine de démentir puisqu'il énonce la règle sans dire comment on la comprend de travers.

Ce qui a été repris, parce que c'est de la connaissance générale du dispositif : le mythe des dix ans et sa conséquence chiffrée (souscrire à 55 ans, c'est sortir à 65 et non à 60), l'absence de rachat partiel et l'intérêt de plusieurs contrats plus petits, l'intérêt d'étaler la sortie, l'asymétrie entre une déduction valorisée à la tranche haute et une sortie imposée à la moitié du taux moyen, le moment où l'avantage revient réellement, le conjoint qui travaille à l'étranger et ouvre son propre contrat grâce à la déclaration commune, et la nature d'assurance vie du contrat.

Ce qui a été écarté sans exception : tout nom d'entreprise, de gestionnaire, de fonds ou d'outil interne, tout chiffre de performance, toute pratique commerciale, tout montant d'entrée et tout avantage réservé à une catégorie de clients. Ce site est une démonstration, il ne porte aucune donnée d'entreprise.

**Un point reste ouvert et le site le dit au lieu de trancher.** Sur le remboursement avant l'âge légal, le praticien décrit une sortie possible à tout moment au prix des avantages fiscaux, et le texte officiel emploie, dans le même paragraphe, « intégralement imposé au taux normal » et « est exclu ». Une source qui se contredit ne se résume pas : la réponse expose les deux lectures et renvoie à un écrit de l'assureur et de l'administration.

---

## Ce que le site refuse de dire

1. **Le capital de sortie n'est pas chiffré.** Il faudrait un rendement, et aucun n'est validé.
2. **Aucune promesse de performance.** « C'est plus performant » demanderait un document daté indiquant le support, la période, les frais et l'indice de référence.
3. **Aucun contrat n'est comparé, aucun placement recommandé.** C'est écrit sur la page, pas seulement ici.

---

## Deux réglages du moteur, appris en mesurant

1. **Les mots vides sont écartés avant la pondération.** Un mot de question ne discrimine rien, mais s'il est rare dans le répertoire il récolte un poids élevé et emporte la décision : « quelle est la météo demain » se rattachait à « Quelle forme… ». La liste des mots vides règle le problème mieux qu'un seuil relevé, qui aurait fait perdre de vraies questions.
2. **La correspondance se fait en préfixe** du mot-clé vers le terme tapé. « Montrer » ne rattrapera donc jamais « montrez » : c'est la forme tapée qu'il faut écrire dans les variantes, pas l'infinitif.

---

## Structure

```
prevoyance/
  index.html          la coquille et les quatre vues
  app/
    prevoyance.js     la table fiscale et le calcul, sans dépendance au rendu
    questions.js      27 questions-réponses sourcées, 8 thèmes
    site.js           le rendu, la navigation, le moteur de reconnaissance
    site.css          feuille propre à ce site, aucune partagée avec le guide
```

`prevoyance.js` ne connaît ni le DOM ni le réseau : il s'appelle depuis Node comme depuis le navigateur, ce qui permet de tester le calcul sans lancer de page.

---

## Sources

Les chiffres viennent de trois sources officielles, citées dans le pied de chaque réponse et vérifiées le 28 août 2026 :

1. Administration des contributions directes, prévoyance-vieillesse.
2. Guichet.lu, déduire les primes versées à un contrat de prévoyance-vieillesse.
3. Gouvernement luxembourgeois, nouveautés 2026, qui porte le relèvement du plafond au 1er janvier 2026.

La réglementation évolue, en particulier les plafonds. La source fait foi, pas cette page.
