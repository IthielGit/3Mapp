# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

PWA installable, pensée d'abord pour le téléphone (viewport de référence 390×844). Raccourcis d'app à la place des widgets.

## Users

Grand public, sans restriction de pays. Les valeurs par défaut (devise MGA, jour de début de mois comptable réglable pour un salaire reçu vers le 28) viennent du premier utilisateur à Madagascar, mais ne limitent pas le public.

Profil type : une personne qui gère plusieurs portefeuilles à la fois (compte bancaire, mobile money, espèces, épargne), fait souvent des virements entre eux et saisit ses dépenses depuis son téléphone, parfois sans réseau.

Audience secondaire : le super administrateur, qui gère les comptes depuis une console (SPEC §5.18).

## Product Purpose

Suivre dépenses, revenus, virements, budgets, objectifs d'épargne et dettes, avec statistiques, import et export, et sauvegarde. Le succès : l'utilisateur sait combien il a réellement dans chaque portefeuille et où passe son argent, sans effort de saisie disproportionné.

## Positioning

- **Mobile money et MGA d'abord** : l'Ariary sans décimales, plusieurs portefeuilles et des virements fréquents entre eux sont le cas normal, pas une option.
- **Réconciliation** : remettre un solde d'accord avec la réalité sans tout ressaisir, y compris un « écart non détaillé » pour les longues périodes sans saisie (SPEC §5.12).
- **Hors ligne d'abord** : l'application fonctionne sans réseau une fois connecté, la synchronisation suit.
- **Gratuit et sans publicité.**

## Operating Context

- Saisie rapide en feuille modale : le montant d'abord, avec une calculatrice intégrée.
- Usage sur téléphone, souvent d'une main, avec une connexion intermittente.
- Récurrences rattrapées à l'ouverture (pas de tâche de fond fiable en PWA).
- Import CSV pour reprendre un historique existant, avec beaucoup de lignes « ajustement ».

## Capabilities and Constraints

- **Compte obligatoire** (SPEC §5.18, fait foi) : sans compte connecté, seul l'écran de connexion est accessible. Connexion par e-mail et mot de passe ou Google ; inscription libre.
- Synchronisation automatique avec Supabase, en clair (pas de chiffrement de bout en bout) ; la version la plus récente l'emporte. Aucune fusion entre comptes.
- Données locales dans IndexedDB ; le solde d'un portefeuille est calculé, jamais stocké ; les montants sont des entiers en unités mineures.
- Multi-devises avec taux manuels datés.
- Sécurité : PIN, biométrie en option, verrouillage automatique.
- Droits RGPD : export complet, suppression définitive du compte.
- Langues : français (par défaut), anglais, malgache. Tous les textes passent par i18n.
- Incohérence connue : CLAUDE.md dit encore « aucun serveur obligatoire » ; SPEC §5.18 fait foi.

## Brand Commitments

- Nom : **Fundora**, conservé par le propriétaire malgré un risque de marque signalé (vérification juridique recommandée avant les stores).
- Logo existant : jauge à 270° avec un point au bout, le budget restant (`public/icons/`).
- Identité visuelle validée et décrite dans CLAUDE.md (« Identité visuelle »). Elle fait autorité tant que DESIGN.md n'existe pas.
- Rouge réservé aux dépenses et aux suppressions.
- Original uniquement : aucun code, nom, icône ni texte repris d'une autre app.

## Evidence on Hand

- Spécification complète : `SPEC.md` ; ordre de construction : `ROADMAP.md`.
- Rapports internes : `docs/AUDIT-ACCOUNTS.md`, `docs/TEST-RESULTS.md`.
- Un mode démo existe (`src/features/demo`).
- Aucun témoignage, chiffre d'usage, presse ni fiche store. Ne rien inventer de tel.

## Product Principles

1. **Le solde vrai avant tout** : chaque écran aide à savoir ce qu'il y a réellement dans chaque portefeuille.
2. **Saisir vite, corriger facilement** : la saisie rapide et la réconciliation passent avant l'analyse fine.
3. **Plusieurs portefeuilles, c'est le cas normal** : les virements sont aussi simples qu'une dépense.
4. **Fiable sans réseau** : rien d'essentiel ne dépend de la connexion.
5. **Honnête sur les données** : l'utilisateur sait ce qui part au serveur et peut tout exporter ou supprimer.

## Accessibility & Inclusion

- Contrastes AA vérifiés pour chaque rôle de couleur (4,5:1 pour le texte, 3:1 pour les éléments graphiques).
- Zones tactiles d'au moins 44 px ; labels sur tous les contrôles ; navigation clavier dans les feuilles modales.
- Thème clair et sombre.
- Trois langues, dont le malgache.
