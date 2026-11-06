# Résultats des tests du système de comptes

Dernière mise à jour : 6 novembre 2026. Application : https://3-mapp-gamma.vercel.app/ (commit `0ea7301` sur `main`).

Légende :
- **PASS** : test exécuté et constaté.
- **FAIL** : test exécuté, résultat différent de l'attendu.
- **NON VÉRIFIÉ (accepté)** : test non exécuté ; accepté par le propriétaire sans vérification. Ce statut n'est pas un succès.

## 1. Base de données (section 8.1 du guide, `supabase/tests/rls-tests.sql`)

Exécuté sur le projet de production, par la fonction SQL de l'éditeur Supabase. Deux exécutions : la première a révélé un défaut de test (S17, S19, J01), corrigé ; la dernière exécution est la référence.

**Résultat : 25 / 25 PASS** (dernière exécution).

Écarts volontaires avec le guide :
- **S07** : la lecture directe de `sync_records` par le super administrateur renvoie 0 ligne. La lecture passe par une fonction journalisée.
- **S18** : le cas « dernier super administrateur » est couvert par la règle « pas de modification de son propre compte ».

## 2. Tests d'interface (section 8.2 du guide)

| Test | Résultat | Détail |
|---|---|---|
| C1 Consultation ouverte | PASS | Bannière « Consultation de … (lecture seule) » et bouton « Retour à mon compte », sur deux comptes. |
| C2 Lecture seule | PASS | Modification refusée avec « Lecture seule : un administrateur ne peut pas modifier ce compte. » Journal API : aucun `sync_push`, aucun `PATCH`/`POST` sur `sync_records` pendant la consultation. |
| C3 Rechargement | PASS | Bannière disparue, données propres à l'administrateur rétablies. |
| C4 Hors ligne en consultation | NON VÉRIFIÉ (accepté) | Non exécuté. |
| D1 Suppression | PASS (partiel) | Bouton inactif tant que l'e-mail n'est pas exact ; suppression effectuée. Le refus de connexion du compte supprimé : NON VÉRIFIÉ (accepté). |
| A1 Inscription | NON VÉRIFIÉ (accepté) | Non exécuté. |
| A2 Compte suspendu | PASS | Écran « Compte suspendu » avec bouton « Se déconnecter » (constaté par le propriétaire). |
| A3 Adresse existante | NON VÉRIFIÉ (accepté) | Non exécuté. Correctif appliqué : même réponse qu'une inscription réussie. |
| A4 Mot de passe oublié | NON VÉRIFIÉ (accepté) | Non exécuté. |
| O1 Modification hors ligne | NON VÉRIFIÉ (accepté) | Non exécuté. |
| O2 Deux appareils | NON VÉRIFIÉ (accepté) | Non exécuté. |
| R1 Changement de rôle | PASS (liste) ; NON VÉRIFIÉ (connexion) | Le rôle change dans la liste et revient. Le bouton admin à la connexion : non vérifié. |
| R2 Son propre rôle | PASS | « Action impossible sur votre propre compte. » ; rôle inchangé. |
| Connexion Google | NON VÉRIFIÉ (accepté) | Correctif de route appliqué (`vercel.json`). |

## 3. Défauts trouvés et corrigés pendant les tests

| Défaut | Correctif | Commit |
|---|---|---|
| Page 404 après connexion Google (routes non servies) | `vercel.json` : redirection vers `index.html` | `e1b29df` |
| Super administrateur renvoyé vers « Plus » après un échec de lecture du profil | Nouvelles tentatives ; message au lieu de la redirection | `97ebf25` |
| D1 : suppression sans saisie de l'e-mail | Saisie exacte obligatoire | `2f33b12` |
| R2 : aucun message pour son propre rôle | Message « Action impossible… » | `2f33b12` |
| A3 : message révélant qu'une adresse existe | Réponse identique à une inscription | `2f33b12` |
| Formulaires modifiables en consultation | Contrôles grisés et bloqués | `2f33b12` |
| Tests SQL S17, S19, J01 passaient pour la mauvaise raison | Identité réétablie avant chaque tentative | (`supabase/tests`) |

## 4. État à la date de ce document

- Compte `harinosy.dev@gmail.com` : **suspendu**. Réactivation à faire (console admin, « Réactiver le compte »).
- Tests marqués « NON VÉRIFIÉ (accepté) » : à refaire si le propriétaire veut une preuve.
