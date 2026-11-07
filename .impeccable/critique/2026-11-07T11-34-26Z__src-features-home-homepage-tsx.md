---
target: écran d accueil
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\My PC\\Documents\\Money Manager App\\src\\features\\home\\HomePage.tsx"
target_fingerprint: "sha256:36065ea4809c6258400b0cd1b51282e52aa20c99040675655d9633ca30599916"
target_path: "C:\\Users\\My PC\\Documents\\Money Manager App\\src\\features\\home\\HomePage.tsx"
timestamp: 2026-11-07T11-34-26Z
slug: src-features-home-homepage-tsx
---
# Critique : écran d'accueil (src/features/home/HomePage.tsx)
Method: dual-agent (A revue de design, B détecteur). Rendu navigateur impossible (connexion obligatoire, aucune route démo) ; revue sur le code source.

## Score : 22/40 (Acceptable)
| # | Heuristique | Score | Problème principal |
|---|---|---|---|
| 1 | Visibilité de l'état | 2 | Synchro = point de 2,5 px, pas d'indicateur hors ligne, « 0 Ar » affiché avant chargement |
| 2 | Monde réel | 3 | « Disponible » et « Reste du mois » proches ; mois en anglais (:502) |
| 3 | Contrôle et liberté | 2 | « Non » à la paie oublié (:50), « Oui » sans annulation, bandeaux non fermables |
| 4 | Cohérence | 2 | teal-50, #4a9d91, emerald-200, rose-200 hors palette ; reflet et ombre sur cartes portefeuille ; « Gérer »/« Tout voir » |
| 5 | Prévention des erreurs | 2 | « Oui » fixe la catégorie ; autres devises exclues des récentes sans le dire |
| 6 | Reconnaissance | 3 | Graphique 7 jours sans jours ni repère |
| 7 | Efficacité | 2 | Ni virement ni réconciliation ; 2 transactions récentes |
| 8 | Minimalisme | 2 | Jusqu'à 9 blocs ; ~8 sous-blocs dans la carte principale |
| 9 | Récupération d'erreurs | 2 | Erreurs de synchro absentes de l'accueil |
| 10 | Aide | 2 | « Disponible » non expliqué |

## Détecteur (4 constats réels)
- HomePage.tsx:329 text-[40px] hors échelle ; HomePage.tsx:502 text-[10px] sous 12 px ; TransactionRow.tsx:44 #64748b ; DetailHeader.tsx:15 text-[15px] (hors accueil).

## Problèmes prioritaires
1. [P1] Carte principale = formulaire pour un nouvel utilisateur (:356-367, PaySetupForm). Fix : une ligne qui ouvre une feuille ; mémoriser « Non » ; une étape à la fois. → onboard
2. [P1] État invisible : chargement (:51-62), synchro, hors ligne, erreurs. Fix : squelettes, étiquette d'état texte, région annoncée. → harden
3. [P1] Pas de virement ni de réconciliation sur l'accueil ; récentes en dernier, limitées à 2. Fix : récentes sous la carte principale, bande portefeuilles avec actions, grille limitée à 4. → layout
4. [P2] Couleurs et contrastes hors DESIGN.md (:393, :399, :451, cartes portefeuille). Fix : blanc/85 sur la carte, tokens pour le graphique, texte de carte par contraste, sans reflet. → colorize
5. [P2] Grands montants MGA qui débordent (:329, TransactionRow.tsx:97). Fix : taille adaptative, format compact avec aria-label. → typeset

## Personas
- Casey : synchro et compte en haut à droite ; lien paie < 44 px ; liens « Gérer »/« Tout voir » ambigus.
- Sam : graphique sans alternative texte (:448) ; synchro non annoncée ; type de portefeuille non lu.
- Jordan : empilement de zéros ; termes non définis ; questionnaire avant toute donnée.

## Mineurs
- Une seule alerte de portefeuille sans compte ; redondance cycle.empty + 0 Ar ; bande latérale décorative sur bandeaux ; bordure pointillée lourde ; cycle non recalculé après minuit ; reste des budgets sains absent.

## Questions
1. « C'est juste ? / Corriger » sur chaque portefeuille ?
2. « Combien ai-je ? » ou « combien puis-je dépenser jusqu'à la paie ? » ?
3. L'accueil a-t-il besoin de 9 sections ?
