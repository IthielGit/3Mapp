# Fundora

Gestionnaire de budget personnel en PWA, hors ligne d'abord. Les données restent sur l'appareil ; avec un compte, elles se synchronisent avec Supabase.

## Installation

```bash
npm install
cp .env.example .env.local   # renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm run dev
```

Sans ces deux variables, l'application reste entièrement locale (aucun compte).
Seule la clé publique « anon » est autorisée dans l'application. La clé « service_role » ne doit jamais apparaître dans le dépôt ni dans le navigateur.

Commandes utiles : `npm test` (tests unitaires), `npm run build`, `npm run lint`.

## Base de données (Supabase)

Appliquer les migrations dans l'ordre dans l'éditeur SQL :

1. `supabase/migrations/0001_profiles.sql` à `0004_delete_own_account.sql`
2. `supabase/migrations/0005_consult_and_roles.sql` (consultation, rôles, suppression d'entrées du journal)

Tests de sécurité de la base : `supabase/tests/rls-tests.sql`. Ce script crée ses propres comptes de test (`rls-test-*@test.local`), les supprime à la fin, et affiche un tableau de résultats. Ne l'exécutez pas sur une base contenant des données que vous ne voulez pas toucher sans l'avoir lu.

Le premier super administrateur se promeut en SQL, une seule fois :

```sql
update public.profiles set role = 'super_admin' where email = 'votre-email@exemple.be';
```

Ensuite, le super administrateur gère les rôles depuis la console.

## Comptes et rôles

| Rôle | Ce qu'il peut faire |
|---|---|
| Utilisateur (`user`) | Utiliser l'application avec ses propres données ; supprimer son propre compte |
| Super administrateur (`super_admin`) | Voir la liste des comptes ; suspendre et réactiver ; changer le rôle d'un autre compte ; consulter un compte en lecture seule ; supprimer un autre compte ; consulter et effacer des entrées du journal |

- L'inscription est libre : aucun compte n'attend d'approbation. La confirmation par e-mail reste active.
- Un super administrateur ne peut ni modifier ses propres droits, ni supprimer son propre compte, ni rétrograder le dernier super administrateur actif. Ces règles sont dans la base.
- Un super administrateur suspendu perd ses droits d'administration.
- Un changement de rôle prend effet à la prochaine connexion de l'utilisateur concerné.

## Consultation (« Voir comme cet utilisateur »)

Le super administrateur peut voir l'application telle que la voit un utilisateur, en lecture seule.

- Les données du compte sont chargées localement ; la synchronisation du super administrateur est suspendue.
- Une bannière indique le compte consulté et propose « Retour à mon compte ».
- Les contrôles qui modifient les données sont grisés et bloqués ; la base locale refuse aussi toute écriture. Les liens de navigation restent utilisables.
- Fermer la consultation, recharger la page, se déconnecter ou supprimer son compte mettent fin à la consultation.
- Chaque ouverture et fermeture est journalisée.

**Limite :** les réglages du compte consulté (devise, préférences) ne sont pas chargés. Le super administrateur voit ses propres réglages, pour ne jamais écraser son code PIN ni ses réglages d'appareil.

## Suppression d'un compte

- Par le super administrateur : depuis la fiche du compte, il faut saisir exactement l'adresse e-mail du compte avant que le bouton « Supprimer définitivement » s'active. La suppression efface le compte, le profil et toutes les données synchronisées.
- Par l'utilisateur : depuis la page Compte. Cette suppression est définitive.

Il n'y a pas de corbeille. Un autre appareil connecté au même compte perd l'accès à la synchronisation.

## Limites connues

- **Hors ligne :** un compte suspendu est bloqué hors ligne seulement si le statut « suspendu » a déjà été vu sur cet appareil. Sinon, l'accès hors ligne reste possible jusqu'à la prochaine connexion au réseau, où le blocage s'applique.
- **Consultation :** les réglages du compte consulté ne sont pas affichés (voir plus haut).
- **Journal :** la suppression d'une entrée n'est pas journalisée.
- **Première promotion :** le premier super administrateur se crée en SQL (voir ci-dessus).

## Déploiement

L'hébergement (Vercel) redirige toutes les routes vers `index.html` (`vercel.json`), ce qui permet le retour de connexion Google sur `/plus/account` et le rechargement de n'importe quelle adresse.

Dans Supabase (Authentication → URL Configuration), la « Site URL » doit être l'adresse de l'application, et les « Redirect URLs » doivent inclure `https://<votre-domaine>/**`.

## Documents

- `docs/AUDIT-ACCOUNTS.md` : audit du système de comptes et décisions.
- `docs/TEST-RESULTS.md` : résultats des tests (à compléter).
