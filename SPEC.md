# SPEC.md — Spécification intégrale

## 1. Vision

Application de finances personnelles : suivre dépenses, revenus, virements, budgets, objectifs
d'épargne et dettes, avec statistiques, import/export et sauvegarde. Webapp installable (PWA),
fonctionne hors ligne, données locales.

## 2. Contraintes propres à une webapp (à connaître avant de coder)

| Sujet                        | Réalité web                                                                          | Décision                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Tâches de fond (récurrences) | Pas de WorkManager ; le service worker ne s'exécute pas de façon fiable à heure fixe | **Rattrapage à l'ouverture** : au lancement, générer toutes les occurrences échues (§5.7)                 |
| Notifications                | Web Push limité (iOS : seulement si installée sur l'écran d'accueil)                 | Notifications locales optionnelles + badge « en attente » dans l'app                                      |
| Biométrie                    | WebAuthn (passkey locale) possible mais variable                                     | PIN obligatoire, biométrie en option si supportée                                                         |
| Widget d'accueil             | Impossible en PWA                                                                    | Remplacé par **raccourcis d'app** (manifest `shortcuts`) : « Ajouter une dépense », « Ajouter un revenu » |
| Stockage                     | IndexedDB peut être purgé par le navigateur                                          | Demander `navigator.storage.persist()` + rappels de sauvegarde                                            |
| Sauvegarde carte SD          | Inexistante                                                                          | Export/Import de fichier JSON + Google Drive (appDataFolder)                                              |

## 3. Modèle d'argent

- `amount` = entier en unités mineures. `currencies.decimals` (MGA = 0 par défaut, EUR/USD = 2).
- Le signe est porté par `type` : `expense` (−), `income` (+), `transfer` (neutre), `adjustment` (± selon signe).
- Conversion multi-devises : taux manuels par paire, datables. Une transaction garde sa devise d'origine ;
  les totaux se convertissent vers la devise de référence au taux en vigueur à la date de la transaction.
- Arrondi : toujours `Math.round` sur la conversion, une seule fois, à la fin.

## 4. Modèle de données (Dexie / IndexedDB)

Toutes les tables ont `id` (UUID), `createdAt`, `updatedAt`, `archived?: boolean`.

- **settings** : devise de référence, `monthStartDay`, `weekStartDay`, langue, thème, format des nombres, wallet par défaut, PIN (hash + sel), verrouillage auto (délai)
- **currencies** : code, nom, symbole, decimals, position du symbole
- **exchangeRates** : from, to, rate, date
- **wallets** : nom, icône, couleur, currency, `initialBalance`, ordre, `includeInTotal`, archived, groupe (banque/espèces/mobile/épargne/carte de crédit)
- **categories** : nom, type (`expense`|`income`), icône, couleur, ordre, archived
- **subcategories** : categoryId, nom, icône
- **transactions** : `type`, `amount`, `currency`, `date`, `walletId`, `toWalletId?` (transfert), `toAmount?` (si devises différentes), `fee?`, `categoryId?`, `subcategoryId?`, `memo`, `attachmentIds[]`, `recurringId?`, `debtId?`, `goalId?`, `status` (`posted`|`pending`)
- **templates** : mêmes champs qu'une transaction sans date, plus `name`, `icon`
- **recurring** : modèle de transaction, `frequency` (day/week/month/year + intervalle), `startDate`, `endDate?`, `nextDate`, `autoPost` (booléen : créer directement ou mettre « en attente »), `dayOfMonthRule` (ex. dernier jour)
- **budgets** : nom, `amount`, `period` (week/month/year/custom), `startDate`, `categoryIds[]`, `walletIds[]`, `rollover` (report du reste), `alertThreshold` (ex. 80 %)
- **goals** : nom, icône, `targetAmount`, `targetDate?`, `currency`, `walletId?`, archived
- **goalTransactions** : goalId, `amount` (+ versement / − retrait), date, memo, `transactionId?`
- **debts** : `direction` (`lent`|`borrowed`), contrepartie, `principal`, `currency`, `startDate`, `dueDate?`, `interestRate?`, `notes`
- **debtPayments** : debtId, `amount`, date, memo, `transactionId?`
- **attachments** : `blob`, mime, nom, taille (images compressées côté client à ≤ 1280 px)

Index recommandés : `transactions[date]`, `[walletId+date]`, `[categoryId+date]`, `[status]`.

## 5. Fonctions (parcours complets)

### 5.1 Onboarding

Écrans d'accueil (3 étapes), choix langue/devise, création du premier portefeuille avec solde initial, import optionnel.

### 5.2 Portefeuilles

Création/édition, icône et couleur, solde initial, devise, groupes, réordonnancement, archivage/restauration, exclusion du total, écran de détail (solde, mouvements, mini-graphique d'évolution), suppression sécurisée (propose archivage si des transactions existent).

### 5.3 Catégories et sous-catégories

Listes revenu/dépense, création/édition/archivage, sélecteur d'icônes et de couleurs, réordonnancement, fusion de deux catégories, jeu par défaut (alimentation, logement, transport, santé, éducation, loisirs, vêtements, famille/entraide, remboursements, investissements, divers, etc.).

### 5.4 Transactions

- Saisie rapide en feuille modale : montant d'abord, **calculatrice intégrée** (+ − × ÷), catégorie, portefeuille, date/heure, mémo, pièces jointes.
- Types : dépense, revenu, **virement** (portefeuille → portefeuille, frais optionnels, devises différentes avec montant reçu), ajustement.
- Édition, duplication, suppression avec annulation (« Annuler » 5 s).
- Liste groupée par jour avec total journalier, défilement virtuel, filtres (période, type, wallet, catégorie, montant min/max, texte), recherche plein texte (mémo, catégorie), tri.
- Sélection multiple : supprimer, changer de catégorie, changer de portefeuille.

### 5.5 Accueil / tableau de bord

Solde total et par portefeuille, revenus/dépenses/solde net de la période, sélecteur de période (jour, semaine, mois comptable, année, personnalisé), dernières transactions, budgets proches du seuil, récurrentes en attente, accès rapide « + ».

### 5.6 Modèles

Création depuis zéro ou depuis une transaction existante ; sélecteur de modèle dans la saisie ; un clic pour pré-remplir.

### 5.7 Transactions récurrentes

Fréquences, date de fin, règle « dernier jour du mois ». Au lancement : `generateDueOccurrences()` crée les occurrences échues, en `pending` ou `posted` selon `autoPost`. Écran « En attente » : valider (avec modification possible), reporter, ignorer. Détail d'une récurrence : historique des occurrences générées, pause/reprise.

### 5.8 Budgets

Budget sur une ou plusieurs catégories, par période, avec report optionnel. Barre de progression, reste, rythme journalier conseillé (« il vous reste X par jour »), alerte au seuil et au dépassement, détail des transactions comptées, vue étendue de tous les budgets.

### 5.9 Objectifs d'épargne

Création (cible, échéance), versements et retraits, progression, date estimée d'atteinte selon le rythme, historique, archivage une fois atteint. Option : lier un versement à une vraie transaction.

### 5.10 Dettes et prêts

Deux onglets : « Je dois » / « On me doit ». Fiche : montant initial, reste dû, échéance, intérêts simples optionnels, paiements partiels, justificatifs (photos), statut (en cours/soldée/en retard). Option : générer la transaction correspondante dans un portefeuille.

### 5.11 Statistiques

Secteurs par catégorie (dépenses/revenus) avec drill-down vers les transactions, barres par semaine, barres par mois, courbe d'évolution du solde, comparaison période vs période précédente, top 10 dépenses, moyenne journalière, statistiques par portefeuille, taux d'épargne mensuel (revenus − dépenses hors transferts).

### 5.12 Réconciliation

Sur un portefeuille : l'utilisateur saisit le solde réel ; l'app calcule l'écart et propose de créer une transaction `adjustment` (avec mémo). Historique des réconciliations.

- La page affiche la dernière activité connue (création, dernier mouvement ou dernière réconciliation) : l'écart couvre cette période. Un lien permet d'ajouter un mouvement manquant avant de réconcilier.
- « Écart non détaillé » (case à cocher) : l'ajustement modifie le solde sans compter en revenu ni en dépense. À utiliser quand le détail d'une longue période sans saisie est inconnu.
- Accueil : si un portefeuille actif n'a ni mouvement ni réconciliation depuis plus de 30 jours, un bandeau propose de réconcilier.

### 5.13 Import / Export

- **Import CSV** : détection d'encodage et de séparateur, assistant de correspondance des colonnes, aperçu et rapport d'erreurs, détection des doublons (date+montant+wallet+mémo), création automatique des portefeuilles/catégories manquants. **Format natif prévu** : `Date, Type, Category, Amount, Currency, Memo, Wallet` où les virements sont une ligne unique avec `Wallet = "A -> B"` et montant positif ; dates `MM/DD/YYYY, HH:mm`.
- **Export** : CSV, XLSX (feuilles transactions + résumés), JSON complet (sauvegarde), par période/wallet/catégorie.

### 5.14 Sauvegarde et restauration

JSON complet (toutes tables + pièces jointes en base64 ou ZIP), chiffrement optionnel par mot de passe (AES-GCM, PBKDF2), restauration avec aperçu et mode « fusion » ou « remplacement ». Google Drive : connexion OAuth (Google Identity Services), dossier `appDataFolder`, sauvegarde manuelle et automatique, liste et restauration de versions. Rappel si dernière sauvegarde > 7 jours.

### 5.15 Sécurité

PIN 4–6 chiffres (hash PBKDF2 + sel), verrouillage à l'ouverture et après délai en arrière-plan, limitation d'essais avec temporisation croissante, biométrie WebAuthn optionnelle, option « masquer les montants » sur l'accueil.

### 5.16 Réglages

Devise de référence et devises supplémentaires + taux, **jour de début de mois**, premier jour de semaine, thème, langue, format des nombres, wallet et catégorie par défaut, gestion des catégories/modèles/récurrences, sauvegarde, sécurité, à propos, remise à zéro (double confirmation).

### 5.17 Transversal

Mode sombre, i18n fr/en, états vides illustrés, squelettes de chargement, retours haptiques (`navigator.vibrate`), raccourcis d'app, installation PWA guidée, mise à jour du service worker avec bandeau « Nouvelle version disponible ».

## 6. Règles métier clés

1. Solde wallet = `initialBalance` + Σ(revenus) − Σ(dépenses) ± Σ(ajustements) + Σ(virements entrants) − Σ(virements sortants) − Σ(frais), en ne comptant que `status = posted`.
2. Les virements n'entrent jamais dans les revenus/dépenses des statistiques ni du taux d'épargne.
3. Un ajustement (réconciliation) positif compte en revenu, un ajustement négatif en dépense, dans les totaux, le taux d'épargne et les statistiques. Il reste identifiable comme ajustement dans les mouvements.
4. Un budget ne compte que les dépenses `posted` des catégories choisies, dans sa période.
5. Supprimer un wallet/une catégorie utilisés est interdit : proposer l'archivage ou la réaffectation.
6. Toute opération destructrice est annulable ou précédée d'une confirmation.

## 7. Qualité

- Couverture de tests ≥ 80 % sur `domain/`.
- Jeu de données de démo (≈ 500 transactions générées) pour tester les performances.
- Liste de 5 000 transactions fluide (virtualisée), ouverture < 1 s.
- Lighthouse PWA ≥ 90, accessibilité ≥ 90.
