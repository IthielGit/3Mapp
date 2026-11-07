---
target: écran d accueil (après refonte)
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\My PC\\Documents\\Money Manager App\\src\\features\\home\\HomePage.tsx"
target_fingerprint: "sha256:655aeba16835355380af68a883a26f0a332e545ecfc41ae1f56716f2f848a63c"
target_path: "C:\\Users\\My PC\\Documents\\Money Manager App\\src\\features\\home\\HomePage.tsx"
timestamp: 2026-11-07T12-28-53Z
slug: src-features-home-homepage-tsx
---
# Critique n°2 : écran d'accueil après refonte (branche refonte/accueil)
Method: dual-agent (A revue de design, B détecteur). Rendu impossible (connexion obligatoire) ; revue sur le code source.

## Score : 25/40 (Acceptable ; 22/40 avant)
| # | Heuristique | Score | Problème principal |
|---|---|---|---|
| 1 | État | 3 | Ligne de synchro excellente ; récentes sans jour (TransactionRow.tsx:40) |
| 2 | Monde réel | 2 | Trois « restes » ; « Réconcilier » jargon |
| 3 | Contrôle | 3 | Paie annulable ; alertes sauvegarde/récurrences non fermables |
| 4 | Cohérence | 2 | Virements à venir en rouge « − » (HomeSections.tsx:137) ; tuiles colorées vs « seule carte colorée » |
| 5 | Prévention | 3 | Pas de faux découvert ; squelette |
| 6 | Reconnaissance | 3 | Soldes par portefeuille sous la ligne de flottaison |
| 7 | Efficacité | 2 | « Ajouter ma paie » sans ?type=income |
| 8 | Minimalisme | 2 | En-tête collant ~95 px ; 3 bandeaux + 7 sections |
| 9 | Récupération | 3 | Erreurs de synchro claires ; échec IndexedDB = squelette sans fin |
| 10 | Aide | 2 | Disponible / Réconcilier non expliqués |

## Détecteur
0 constat sur l'accueil. 1 hors accueil : DetailHeader.tsx:15 text-[15px].

## Problèmes prioritaires
1. [P1] Portefeuilles hors écran ; récentes sans jour ; autres devises exclues sans le dire. → layout
2. [P1] Bandeau « sans mise à jour » au-dessus de la carte, non fermable, presque permanent (STALE_DAYS 30, compté depuis createdAt). Fix : pastille sur la tuile, compte sur « Réconcilier ». → layout
3. [P2] Trois « restes » dans la carte. Fix : nommer par ce qu'ils comptent, ou jauge de marque. → clarify / delight
4. [P2] En-tête lourd, point de synchro + ligne d'état en double. → distill
5. [P2] Virements à venir en rouge ; tuiles saturées (et 4 couleurs du sélecteur < AA) ; lien portefeuilles en double. → colorize

## Personas
- Casey : actions portefeuille hors pouce ; heure sans jour ; carte qui bouge selon les alertes.
- Sam : progressbar sans aria-valuetext, plafonnée à 100 ; emoji lu avant le nom ; « Détail du mois » muet.
- Jordan : jargon ; « Annuler » de la paie perdu en changeant d'écran.

## Mineurs
Squelette blanc vs carte cyan ; rappel de sauvegarde contradictoire avec « À jour » ; bg-red-600 dans SyncButton.tsx:36 ; noms longs tronqués sans title ; fin d'écran sur un dépassement de budget.

## Questions
1. Ouvrir sur les portefeuilles, cycle en second ?
2. Que protège le rappel de sauvegarde avec la synchro automatique ?
3. La jauge du logo pour « combien reste-t-il ? » ?
