# Audit du système de comptes (phase A du guide)

Date de l'audit : 6 novembre 2026. Source : code et migrations du dépôt, état de `main` après le commit `97ebf25`.
L'audit a été fait sur le code. Il n'a pas été vérifié directement sur la base de production, sauf pour les points signalés plus bas.

## 1. Table d'audit

| Élément | Emplacement | Comportement actuel | Décision |
|---|---|---|---|
| Fournisseur d'authentification | `src/features/account/supabase-client.ts`, `account-service.ts` | Supabase Auth : e-mail et mot de passe, connexion Google | Conserver |
| Rôles | `supabase/migrations/0001_profiles.sql` | `user` et `super_admin` (type `app_role`). Promotion manuelle en SQL | Conserver ; `user` joue le rôle « standard » du guide |
| États du compte | `0001_profiles.sql` | `active` et `suspended` (type `account_status`) | Conserver |
| Étape d'approbation | `0001_profiles.sql` (commentaire) | Aucune : l'inscription est libre, le compte est actif | Déjà conforme, rien à supprimer |
| Qui voit les données de qui | `0002_sync.sql` (RLS sur `sync_records`) | Chaque compte ne voit que ses lignes. Le super administrateur lit via `admin_list_records`, journalisé | Conserver l'accès par fonction |
| Écriture d'un super administrateur sur les données d'autrui | `0002`, `0003` | Aucun chemin d'écriture. Seules fonctions : `admin_set_status`, `admin_delete_account`, `admin_set_role` | Conforme |
| Stockage des données | `0002_sync.sql` | Une ligne par enregistrement, 16 tables, fusion « le plus récent gagne » | Conserver (le modèle « une ligne JSON par compte » du guide casserait la synchro) |
| Cache local et hors ligne | `account/profile.ts`, `AccountProvider.tsx` | Statut mémorisé dans `localStorage`, blocage hors ligne | Conserver |
| Écrans de connexion | `account/AuthForm.tsx` | Connexion, inscription, mot de passe oublié, Google | Conserver ; réponse neutre à l'inscription (A3) |
| Écrans d'administration | `admin/AdminPage.tsx`, `AccountDetailPage.tsx`, `AuditPage.tsx` | Liste, recherche, suspension, réactivation, rôle, consultation, suppression, journal | Conserver |
| Consultation en lecture seule | `admin/consult.ts`, `consult-guard.ts`, `ConsultBanner.tsx` | Ajoutée pendant ce chantier | Ajout conforme au guide |
| Politiques RLS existantes | `0001`, `0002`, `0003` | Listées ci-dessus | Conserver |
| Journal d'administration | `0003_admin.sql` | Table `admin_audit`, lisible uniquement par le super administrateur | Conserver ; suppression d'entrées ajoutée en `0005` |
| Suppression de son propre compte (RGPD) | `0004_delete_own_account.sql`, `account/delete-account.ts` | Fonction `delete_own_account` | Conserver (absente du guide) |
| Utilisateurs existants | Base de production | Non vérifié depuis le dépôt | À confirmer par le propriétaire |

## 2. Correspondance des rôles et des états

- `user` correspond à « standard » ; `super_admin` correspond à « super administrateur ».
- `active` et `suspended` correspondent aux états du guide. Aucun compte n'attend d'approbation.

## 3. Points vérifiés et corrigés pendant le chantier

- **Statut du super administrateur** : `is_super_admin()` vérifie désormais que le statut est `active` (migration `0005`).
- **Changement de rôle** : `admin_set_role` refuse son propre compte et la rétrogradation du dernier super administrateur actif (migration `0005`).
- **Réponse à l'inscription** : une adresse déjà utilisée reçoit la même réponse qu'une inscription réussie.
- **Lecture du profil** : un échec transitoire ne renvoie plus le super administrateur vers « Plus ».

## 4. Écarts volontaires avec le guide

- Le super administrateur ne lit pas `sync_records` directement : il passe par des fonctions journalisées. Le test S07 (lecture directe) renvoie donc 0 ligne, par conception.
- Le test S18 du guide (rétrogradation du dernier super administrateur) est couvert par la règle « pas de modification de son propre compte », car celui qui agit est lui-même un super administrateur actif.
- Le journal d'administration est conservé (le guide prévoit de ne pas en avoir).
