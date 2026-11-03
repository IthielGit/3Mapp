# CLAUDE.md — Gestionnaire de budget (webapp mobile, PWA)

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
- i18next (fr par défaut, en, mg)
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
  i18n/          fr.json, en.json, mg.json
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
