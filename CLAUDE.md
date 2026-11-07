# CLAUDE.md — Fundora (gestionnaire de budget, PWA)

## Mission

Construire une application de gestion de finances personnelles complète, utilisable sur mobile
comme une app installée (PWA), **offline-first**, sans serveur obligatoire. Tout est détaillé dans
`SPEC.md` (quoi) et `ROADMAP.md` (dans quel ordre). Lis les deux avant de coder.

## Règles absolues

- Original uniquement : ne copie aucun code, nom, logo, icône ou texte d'une app existante.
- Les montants sont des **entiers en unités mineures** (jamais de float). Voir SPEC §3.
- Le solde d'un portefeuille est **calculé** à partir des transactions, jamais stocké.
- Les données restent sur l'appareil (IndexedDB). Aucun envoi réseau sans action explicite de l'utilisateur.
- Chaque phase du ROADMAP se termine par : tests verts, `npm run build` OK, commit.
- Ne passe à la phase suivante que si les critères d'acceptation de la phase en cours sont remplis.

## Pile technique

- React 18 + TypeScript (strict) + Vite
- Tailwind CSS + composants maison (mobile-first, zones tactiles ≥ 44 px, thème clair/sombre)
- Dexie (IndexedDB) + dexie-react-hooks pour les requêtes live
- React Router, Zustand (état UI uniquement : filtres, thème, verrouillage)
- Recharts (graphiques), date-fns, Zod (validation), Papa Parse (CSV), ExcelJS (export XLSX)
- vite-plugin-pwa (service worker, manifest, raccourcis)
- i18next (fr par défaut, en)
- Vitest + Testing Library (unitaire), Playwright (e2e mobile viewport 390×844)

## Structure

```
src/
  db/            schéma Dexie, migrations, repositories
  domain/        logique métier pure et testée (soldes, budgets, récurrences, dettes, devises)
  features/      wallets, categories, transactions, budgets, goals, debts, recurring,
                 templates, stats, import-export, backup, security, settings
  components/    UI partagée (BottomSheet, AmountInput, Calculator, IconPicker, ...)
  lib/           money.ts, dates.ts, csv.ts, crypto.ts
  i18n/          fr.json, en.json
tests/           unit + e2e
```

## Conventions

- Toute logique de calcul vit dans `domain/` en fonctions pures, avec tests. Les composants n'ont pas de calcul métier.
- Format d'argent via `lib/money.ts` uniquement. Dates stockées en ISO UTC, affichées dans le fuseau local.
- Pas de `any`. Pas de dépendance ajoutée sans la justifier en une ligne dans le commit.
- Accessibilité : labels, contrastes AA, navigation clavier des feuilles modales.
- Textes UI toujours via i18n, jamais en dur.

## Contexte utilisateur (à respecter dans les valeurs par défaut)

- Devise principale : MGA (Ariary), sans décimales à l'affichage.
- Plusieurs portefeuilles (banque, mobile money, espèces) avec virements fréquents entre eux.
- Salaire reçu vers le 28 : prévoir un **jour de début de mois comptable** réglable (défaut : 1).
- Beaucoup de lignes « ajustement » dans l'historique : prévoir la fonction **Réconciliation** (SPEC §5.12).
- Interface en français.

## Identité visuelle (validée)

- **Nom** : Fundora (choisi par le propriétaire, conservé malgré le risque de marque signalé en France ; voir « Vérification du nom »).
- **Logo** : repère en jauge à 270° avec un point au bout (le budget restant), wordmark « Budget » en Outfit.
  Variante sombre (retenue) : fond marine dégradé `#1F2937 → #0B1220`, arc blanc `#F4F6F7`, point cyan `#10B0DC` avec contour `#0B1220`.
- **Icônes** : `public/icons/` (icon.svg, favicon.svg, icon-maskable.svg et PNG dérivés). `favicon.ico` = 16 et 32 px.
- **Couleur de thème** (manifeste et `<meta>`) : `#111827`.
- **Palette cyan** (échelle `brand`, tokens Tailwind) :
  50 `#EEFAFE`, 100 `#D9F5FC`, 200 `#B3EAF9`, 300 `#7ADBF5`, 400 `#2EC6F0`, 500 `#0FA7D1`,
  600 `#0B7E9D` (action : bouton avec texte blanc, liens sur blanc), 700 `#096780` (pressé), 800 `#075064`, 900 `#053947`.
  `brand-dark` = `#7ADBF5` (accent du mode sombre uniquement).
- **Rôles** : cyan 500 pour le décor, les graphiques et les icônes (texte charbon dessus) ; 600 pour l'action ; 700 pour le texte sur fond gris (600 descend à 4,3:1 sur fond gris).
- **Revenus et dépenses** : tokens `income` `#11745B` (vert harmonisé au cyan, teinte ~165°) et `expense` `#b91c1c` (texte) ; le vert et le rouge vifs restent pour les graphiques.
- **Rouge** : réservé aux dépenses et aux suppressions. Il ne sert plus d'accent (le bouton « + » est en cyan action).
- **Neutres (appliqués)** : échelle `neutral` froide, même teinte que le cyan (200°, saturation 8 %). `canvas` `#F2F4F5`, `ink` `#223135`. Les anciens gris chauds `stone` ne sont plus utilisés.
- **Contrastes** : chaque rôle est vérifié AA (4,5:1 pour le texte, 3:1 pour l'arc et le point).

## Vérification du nom (décision : conserver Fundora)

- **Fundora** : risque élevé. Une plateforme d'investissement française nommée Fundora est active dans les services financiers (classe 36), couverte par la presse depuis 2025. Les registres officiels (WIPO, USPTO, INPI, EUIPO) n'ont pas pu être interrogés : la vérification est partielle.
- **Ajouter « Budget tracker » ne réduit pas le risque** : le terme descriptif est écarté de l'analyse, et le nom distinctif reste identique. Il peut servir de sous-titre dans la fiche de l'app store.
- **Alternatives** (risque d'après la recherche web) : Coffra (faible, à confirmer), Vestora, Peculia, Tallora, Ardora (moyen).
- **Recommandation** : Coffra, sous réserve d'une recherche complète dans les registres et d'un avis de conseil en propriété intellectuelle avant tout lancement.
- Décision du propriétaire : conserver Fundora. Le risque de marque reste signalé ; une vérification juridique reste recommandée avant la publication sur les stores.
