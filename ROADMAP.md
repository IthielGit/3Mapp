# ROADMAP.md — Construction par phases (vibe-coding avec Claude dans VS Code)

## Mode d'emploi

1. Créez le dossier du projet, copiez-y `CLAUDE.md`, `SPEC.md`, `ROADMAP.md`, ouvrez-le dans VS Code.
2. Lancez Claude Code (extension ou terminal `claude`) à la racine.
3. Pour chaque phase : collez le prompt, laissez Claude travailler, vérifiez les critères, faites `git commit`.
4. Si Claude s'égare : « Relis CLAUDE.md et SPEC.md §X, puis corrige. » Une phase = une conversation courte.
5. Avant chaque phase : « Fais d'abord un plan en 5 points, attends mon accord. » pour les phases 4 à 9.

Le plan couvre l'application **intégrale** (toute la SPEC). Les phases sont ordonnées pour avoir
une app utilisable dès la phase 4, puis enrichie.

---

## Phase 0 — Fondations

**Prompt :** « Lis CLAUDE.md et SPEC.md. Initialise le projet Vite + React + TypeScript strict, Tailwind, ESLint, Prettier, Vitest, Playwright, vite-plugin-pwa, i18next, React Router. Crée la structure de dossiers de CLAUDE.md, un layout mobile avec barre de navigation basse (Accueil, Transactions, Stats, Budgets, Plus), thème clair/sombre, et une page d'accueil vide. »
**Critères :** `npm run dev`, `build`, `test` fonctionnent ; l'app est installable en PWA ; navigation entre 5 pages vides.

## Phase 1 — Couche données et argent

**Prompt :** « Implémente `lib/money.ts` (entiers, formatage MGA/EUR/USD, parsing) et le schéma Dexie complet de SPEC §4 avec migrations versionnées et repositories typés (Zod). Ajoute des tests unitaires pour money. »
**Critères :** toutes les tables existent ; tests money verts (arrondis, 0 et 2 décimales, négatifs).

## Phase 2 — Portefeuilles et catégories

**Prompt :** « Implémente SPEC §5.1 (onboarding), §5.2 (portefeuilles) et §5.3 (catégories/sous-catégories) : écrans, formulaires, sélecteur d'icônes/couleurs, archivage, réordonnancement, jeu de catégories par défaut. »
**Critères :** onboarding crée un premier wallet ; archivage ; suppression bloquée si utilisé.

## Phase 3 — Transactions (cœur)

**Prompt :** « Implémente SPEC §5.4 : saisie en feuille modale avec AmountInput et calculatrice intégrée, types dépense/revenu/virement/ajustement, pièces jointes compressées, liste groupée par jour virtualisée, filtres, recherche, sélection multiple, annulation de suppression. Crée `domain/balance.ts` (règle SPEC §6.1) avec tests complets. »
**Critères :** solde wallet toujours cohérent ; virement ne fausse pas les totaux ; liste fluide avec 5 000 lignes de démo.

## Phase 4 — Import / Export CSV (récupérez vos vraies données)

**Prompt :** « Implémente SPEC §5.13 : import CSV avec détection séparateur, assistant de mapping, aperçu, détection des doublons, création automatique des wallets/catégories, et le format natif `Date, Type, Category, Amount, Currency, Memo, Wallet` (virement = une ligne, Wallet "A -> B", montant positif, date MM/DD/YYYY, HH:mm). Export CSV/XLSX/JSON. Teste avec le fichier d'exemple dans `tests/fixtures/`. »
**Critères :** l'import de votre CSV réel reproduit les variations de solde calculées (+2 854 100 MGA au total), zéro doublon à la 2ᵉ importation.

> Mettez votre CSV réel dans `tests/fixtures/` (données personnelles : ne le publiez pas, ajoutez-le au `.gitignore`).

## Phase 5 — Tableau de bord et statistiques

**Prompt :** « Implémente SPEC §5.5 et §5.11 : période avec jour de début de mois comptable, soldes, graphiques Recharts (secteurs avec drill-down, barres semaine/mois, évolution du solde, comparaison période précédente, top 10, taux d'épargne). Les virements et ajustements sont exclus par défaut (SPEC §6). Logique dans `domain/stats.ts` avec tests. »
**Critères :** chiffres identiques à un calcul indépendant sur le jeu de démo ; période « mois du 28 au 27 » fonctionne.

## Phase 6 — Budgets

**Prompt :** « Implémente SPEC §5.8 : budgets par catégories/période, report, seuils d'alerte, rythme journalier conseillé, vue détaillée et vue étendue. Logique dans `domain/budget.ts` avec tests. »
**Critères :** dépassement et seuil détectés ; report correct sur 3 périodes consécutives.

## Phase 7 — Modèles et récurrences

**Prompt :** « Implémente SPEC §5.6 et §5.7 : modèles, récurrences avec `generateDueOccurrences()` exécutée à l'ouverture, statut en attente, écran de validation, pause/reprise, règle dernier jour du mois. Tests sur cas limites (mois courts, années bissextiles, application fermée 3 mois). »
**Critères :** après 3 mois sans ouverture, toutes les occurrences manquantes sont créées une seule fois.

## Phase 8 — Objectifs et dettes

**Prompt :** « Implémente SPEC §5.9 et §5.10 : objectifs d'épargne (versements/retraits, date estimée) et dettes/prêts (paiements partiels, justificatifs, intérêts simples, statuts), avec liens optionnels vers de vraies transactions. Logique dans `domain/goals.ts` et `domain/debts.ts` avec tests. »
**Critères :** reste dû exact après plusieurs paiements ; suppression d'une transaction liée gérée proprement.

## Phase 9 — Multi-devises et réconciliation

**Prompt :** « Implémente la gestion des devises et taux (SPEC §3, §5.16) : devises supplémentaires, taux manuels datés, conversion dans les totaux, virements entre devises avec montant reçu. Puis SPEC §5.12 : réconciliation d'un wallet avec création de l'ajustement. »
**Critères :** totaux convertis corrects ; réconciliation ramène le solde calculé au solde réel saisi.

## Phase 10 — Sécurité

**Prompt :** « Implémente SPEC §5.15 : écran PIN (hash PBKDF2 + sel via Web Crypto), verrouillage à l'ouverture et après délai, temporisation croissante après échecs, option masquer les montants, biométrie WebAuthn optionnelle si supportée. »
**Critères :** impossible d'accéder aux données sans PIN ; le PIN n'est jamais stocké en clair.

## Phase 11 — Sauvegarde et restauration

**Prompt :** « Implémente SPEC §5.14 : sauvegarde JSON complète (avec pièces jointes), chiffrement AES-GCM optionnel, restauration avec aperçu (fusion ou remplacement), rappel de sauvegarde, `navigator.storage.persist()`. »
**Critères :** sauvegarde puis restauration sur un navigateur vierge donne exactement les mêmes soldes.

## Phase 12 — Partage de la sauvegarde vers le cloud (sans coût)

**Prompt :** « Ajoute le partage de la sauvegarde via la feuille de partage native (Web Share API) : l'utilisateur envoie le fichier vers Google Drive, OneDrive, Dropbox ou e-mail. Aucun compte, aucune clé ni identifiant dans l'application. Le bouton n'apparaît que si le navigateur sait partager un fichier. La restauration reprend le fichier depuis le même cloud via le sélecteur. »
**Critères :** partage d'une sauvegarde puis restauration du fichier reçu donne les mêmes soldes ; une feuille fermée sans envoi ne déclenche aucune erreur ; aucune dépendance ni clé d'API ajoutée.

> Remplace l'ancienne approche Google Drive (appDataFolder, Google Identity Services), abandonnée car elle nécessitait un projet Google Cloud et des identifiants.

## Phase 13 — Finitions

**Prompt :** « Termine SPEC §5.17 : traductions fr/en/mg complètes, états vides, squelettes de chargement, raccourcis d'app (manifest shortcuts), bandeau de mise à jour du service worker, installation PWA guidée, accessibilité AA. Corrige les points Lighthouse sous 90. »
**Critères :** Lighthouse PWA et accessibilité ≥ 90 ; app complète utilisable en mode avion.

## Phase 14 — Recette finale

**Prompt :** « Écris des tests Playwright (viewport 390×844) pour les parcours : onboarding, saisie d'une dépense, virement, import CSV, budget dépassé, récurrence en attente, sauvegarde/restauration. Lance toute la suite, liste ce qui échoue et corrige. »
**Critères :** suite e2e verte ; `build` de production sans warning.

---

## Déploiement

Hébergement statique gratuit (Cloudflare Pages, Netlify ou Vercel) : l'app n'a pas de serveur. Une fois en HTTPS,
ouvrez-la sur le téléphone puis « Ajouter à l'écran d'accueil ».

## Conseils vibe-coding

- Gardez `CLAUDE.md` à jour : ajoutez-y chaque décision importante.
- Demandez toujours « écris d'abord les tests » pour tout ce qui touche à l'argent.
- Commits fréquents ; en cas de dérive, revenez au dernier commit plutôt que de corriger en cascade.
- Une conversation par phase ; en début de phase : « Lis CLAUDE.md, SPEC.md et l'état du repo. »
