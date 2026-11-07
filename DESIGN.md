---
name: Fundora
description: Gestionnaire de budget personnel, PWA mobile hors ligne d'abord
colors:
  lagoon-cyan: "#0B7E9D"
  lagoon-pressed: "#096780"
  lagoon-deep: "#075064"
  shallow-cyan: "#0FA7D1"
  spray-cyan: "#7ADBF5"
  mist-cyan: "#EEFAFE"
  income-green: "#11745B"
  income-green-dark: "#67E9C9"
  expense-red: "#b91c1c"
  expense-red-dark: "#f87171"
  ink: "#223135"
  canvas: "#F2F4F5"
  surface: "#FFFFFF"
  stone-border: "#E3E6E8"
  field-border: "#6C787F"
  muted-text: "#4D565B"
  night-page: "#1c1c22"
  night-card: "#26262d"
  night-raised: "#32323a"
  night-fg: "#f5f5f7"
  night-muted: "#b8b8c0"
  brand-navy: "#111827"
typography:
  amount-hero:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    fontFeature: "tnum"
  amount:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    fontFeature: "tnum"
  headline:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
  body:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
  body-sm:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
  label:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
rounded:
  lg: "8px"
  xl: "12px"
  sheet: "16px"
  card: "20px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  touch: "44px"
components:
  button-primary:
    backgroundColor: "{colors.lagoon-cyan}"
    textColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "44px"
  button-primary-active:
    backgroundColor: "{colors.lagoon-pressed}"
  button-primary-dark:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
  button-secondary:
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "44px"
  button-danger:
    textColor: "{colors.expense-red}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "44px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "0 12px"
    height: "44px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "16px"
  fab-add:
    backgroundColor: "{colors.lagoon-cyan}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
    size: "56px"
  transaction-row:
    rounded: "{rounded.lg}"
    padding: "8px 4px"
    height: "64px"
---

# Design System: Fundora

## Overview

**Creative North Star: "L'Eau Claire"**

Fundora se lit comme une eau limpide : on voit le fond. Chaque solde, chaque mouvement est visible sans effort, sans effet qui le trouble. Le cyan lagon porte l'action et la marque. Les neutres froids, de la même teinte (200°, très peu saturés), forment le fond sur lequel les montants se posent. La couleur vive est réservée à ce qui a un sens : vert pour l'argent qui entre, rouge pour celui qui sort ou ce qu'on supprime.

La densité est celle d'un outil de téléphone tenu d'une main : une colonne de 512 px au plus, des zones tactiles d'au moins 44 px, des lignes de transaction de 64 px. Les composants sont précis et doux : coins arrondis, bords fins de 1 px, ombres à peine perceptibles, et une réponse immédiate à l'appui (légère compression, sortie rapide, sans rebond).

Le mode sombre est un monde à part entière, pas une inversion : fond nuit, cartes légèrement relevées, et un accent cyan clair (`spray-cyan`) qui n'existe que là.

**Key Characteristics:**
- Une seule police, Outfit, hébergée dans l'app pour fonctionner hors ligne.
- Chiffres tabulaires sur chaque montant ; un montant ne se coupe jamais.
- Profondeur par bordures fines et tons, presque pas par les ombres.
- Mouvements courts (150 à 320 ms), courbe à sortie forte, toujours une version « mouvement réduit ».
- Contrastes AA vérifiés pour chaque rôle de couleur.

## Colors

Un cyan d'eau claire pour l'action, des neutres froids pour le calme, et deux couleurs de sens (entrée et sortie d'argent) qui ne servent à rien d'autre.

### Primary
- **Cyan Lagon** (lagoon-cyan) : la couleur d'action. Bouton principal avec texte blanc, bouton « + », liens sur fond blanc, anneau de focus, curseur de saisie, cases à cocher. C'est la seule couleur qui dit « touchez ici ».
- **Lagon Pressé** (lagoon-pressed) : l'état pressé du bouton principal, et le texte cyan sur fond gris (le Cyan Lagon y descend à 4,3:1). Onglet actif de la barre basse.
- **Lagon Profond** (lagoon-deep) : texte cyan sur fond cyan pâle.
- **Cyan Peu Profond** (shallow-cyan) : décor, graphiques et icônes, avec du texte charbon par-dessus, jamais du blanc.
- **Cyan Embrun** (spray-cyan) : accent du mode sombre uniquement (onglets actifs, liens, focus).
- **Brume Cyan** (mist-cyan) : fonds teintés très légers (sélection, états actifs discrets).

### Secondary
- **Vert Entrée** (income-green) : montants de revenus en texte. Vert harmonisé au cyan (teinte ~165°). En sombre : income-green-dark.
- **Rouge Sortie** (expense-red) : montants de dépenses, erreurs, actions de suppression. En sombre : expense-red-dark.

### Neutral
- **Encre Charbon** (ink) : texte principal en mode clair.
- **Toile** (canvas) : fond de page en mode clair ; l'en-tête collant reprend ce fond.
- **Surface** (surface) : cartes, feuilles modales, barre basse en mode clair.
- **Bord Pierre** (stone-border) : bordures de cartes et séparateurs.
- **Bord de Champ** (field-border) : contour des champs et des boutons secondaires (assez contrasté pour être vu à 3:1).
- **Texte Discret** (muted-text) : sous-titres, heures, libellés inactifs.
- **Nuit** (night-page, night-card, night-raised) : les trois niveaux du mode sombre, du fond au plus relevé ; texte night-fg, secondaire night-muted.
- **Marine de Marque** (brand-navy) : couleur de thème du manifeste et de la balise `<meta>`, fond de l'icône.

### Named Rules
**La Règle du Rouge Réservé.** Le rouge sert aux dépenses, aux erreurs et aux suppressions, et à rien d'autre. Jamais comme accent, jamais pour attirer l'œil.

**La Règle des Trois Cyans.** Cyan Peu Profond pour décorer (texte charbon dessus), Cyan Lagon pour agir (texte blanc dessus), Lagon Pressé pour le texte cyan sur fond gris. Ne pas les échanger.

**La Règle du Fond Froid.** Les neutres restent à la teinte du cyan. Pas de gris chauds (`stone`), pas de crème.

## Typography

**Police unique :** Outfit (400, 500, 600, 700), repli `system-ui, -apple-system, Segoe UI, Roboto, sans-serif`.

**Character :** une géométrique ronde et lisible, assez neutre pour les chiffres, assez douce pour ne pas sembler bancaire. La hiérarchie vient de la taille et du poids, jamais d'une seconde famille.

### Hierarchy
- **Amount Hero** (600, 2.25rem, chiffres tabulaires) : le total d'un écran de statistiques.
- **Amount** (600, 1.875rem, chiffres tabulaires) : le montant en cours de saisie, le montant d'une transaction ouverte, le solde du mois.
- **Headline** (600, 1.5rem, interlettrage -0.025em) : titres de page et salutation de l'accueil.
- **Title** (600, 1.125rem) : titres de feuilles modales et d'en-têtes de détail.
- **Body** (400, 1rem) : texte courant et champs (16 px minimum dans les champs pour éviter le zoom iOS).
- **Body Small** (500, 0.875rem) : le corps le plus fréquent de l'interface : libellés de champs, lignes de listes, messages.
- **Label** (500, 0.75rem) : sous-titres de lignes, heures, libellés de la barre basse.

### Named Rules
**La Règle du Chiffre Droit.** Tout montant porte `data-amount` : chiffres tabulaires, jamais de retour à la ligne au milieu de « Ar », flou quand l'utilisateur masque les montants.

**La Règle du Semi-Gras.** Le poids d'emphase est 600. Le gras 700 est chargé mais n'est pas utilisé dans l'interface.

## Layout

Mobile d'abord, colonne unique de 512 px au plus, marges latérales de 16 px. L'en-tête est collant, sur le fond de la page, et tient compte de la zone sûre en haut. La barre basse fixe (60 px par onglet, plus la zone sûre en bas) laisse 96 px de marge en bas du contenu.

Au-delà de 768 px, la barre basse disparaît au profit d'une colonne latérale de 240 px avec libellés complets, et le contenu s'élargit jusqu'à 1024 px avec des marges de 40 px.

Rythme : 12 px entre éléments d'une même carte (le pas le plus fréquent), 16 px de marge intérieure de carte et entre sections, 8 px pour les petits groupes. Toute cible tactile mesure au moins 44 × 44 px.

**La Règle du Pouce.** L'ajout (« + ») est au centre de la barre basse, en relief au-dessus d'elle. Les actions principales d'une feuille modale sont dans son pied, collées en bas.

## Elevation & Depth

Le système est plat avec des bordures : la profondeur vient d'une bordure fine (Bord Pierre, ou blanc à 15 % en sombre) et du contraste entre la Toile et la Surface. Les ombres sont rares et faibles. En mode sombre, on monte d'un niveau de ton (night-page, night-card, night-raised) au lieu d'ajouter de l'ombre.

### Shadow Vocabulary
- **Effleurement** (`shadow-sm`) : cartes posées sur la Toile, menus.
- **Bouton flottant** (`shadow-lg` avec un anneau de 4 px à la couleur de la surface) : uniquement le « + » de la barre basse.
- **Feuille** (`shadow-xl`) : la feuille modale montée du bas, sur un voile marine à 50 %.

**La Règle Plat au Repos.** Une surface au repos n'a pas d'ombre ou une ombre d'effleurement. Seuls le « + » et la feuille modale flottent vraiment.

## Shapes

Des coins doux et cohérents qui grandissent avec la taille de l'objet : 8 px pour les lignes et petits éléments, 12 px pour les boutons et les champs, 16 px pour le haut des feuilles modales, 20 px pour les cartes. Les avatars de catégorie, le bouton « + » et les pastilles sont des cercles parfaits. Le logo, une jauge à 270° avec un point au bout, est la seule forme signature ; les icônes de navigation sont en trait arrondi (1,8 px, 2,4 px quand l'onglet est actif).

## Components

### Buttons
Précis et doux : ils répondent à l'appui par une compression de 3 % (160 ms, sortie forte), retirée si le mouvement réduit est demandé.
- **Shape :** coins doux (12 px), hauteur minimale 44 px, marges intérieures de 16 px.
- **Primary :** Cyan Lagon, texte blanc semi-gras. En mode sombre, il s'inverse : fond blanc, texte Encre Charbon.
- **Secondary :** fond transparent, contour Bord de Champ, texte moyen (500).
- **Danger :** contour rouge clair, texte Rouge Sortie. Réservé aux suppressions.
- **Focus :** anneau de 2 px Cyan Lagon, décalé de 2 px (Cyan Embrun en sombre).
- **Disabled :** opacité 50 %.

### Cards / Containers
- **Corner Style :** 20 px.
- **Background :** Surface sur Toile ; night-card en sombre.
- **Shadow Strategy :** bordure Bord Pierre, parfois un effleurement (voir Elevation).
- **Internal Padding :** 16 px (12 px pour les cartes compactes).
- **Variantes :** carte d'alerte ambre (avertissement), carte bordée de rouge (zone de suppression), carte de portefeuille pleine à la couleur du portefeuille avec texte blanc.

### Inputs / Fields
- **Style :** fond Surface, contour 1 px Bord de Champ, coins 12 px, 44 px de haut, texte 16 px.
- **Focus :** anneau Cyan Lagon de 2 px ; les champs date et heure gardent l'anneau autour de tout le champ pendant le passage d'un segment à l'autre.
- **Label :** au-dessus, Body Small. **Erreur :** message en Rouge Sortie sous le champ, annoncé (`role="alert"`).
- **Curseur :** Cyan Lagon ; texte indicatif gris lisible (#667085).

### Navigation
- **Barre basse (téléphone) :** fond Surface, bordure haute fine, cinq colonnes : Accueil, Transactions, « + », Budgets, Visualisation. Onglet actif : Lagon Pressé, semi-gras, trait d'icône épaissi. Inactif : Texte Discret.
- **Colonne latérale (grand écran) :** 240 px, bouton d'ajout plein en tête, entrées de 44 px ; l'entrée active a un fond Cyan Lagon à 10 %.

### Bottom Sheet
La feuille modale est le lieu de la saisie. Elle monte du bas en 320 ms sur la courbe « tiroir » (`cubic-bezier(0.32, 0.72, 0, 1)`), haut arrondi à 16 px, 92 % de la hauteur au plus. En-tête avec titre et fermeture de 44 px, contenu défilant, pied collant pour les actions, zone sûre respectée.

### Amount Input
Le montant d'abord : grand chiffre (Amount, 1.875rem), curseur maison clignotant, calculatrice intégrée. C'est le premier élément vu dans toute saisie.

### Transaction Row
Ligne de 64 px : pastille ronde de 44 px à la couleur de la catégorie, titre et sous-titre tronqués, montant à droite coloré par son sens (Vert Entrée ou Rouge Sortie) au-dessus de l'heure. À l'appui, fond neutre léger.

### Brand Gauge
Sur l'écran de connexion, l'arc de la jauge se dessine (1100 ms), puis le point apparaît au bout. C'est le seul mouvement long de l'application.

## Do's and Don'ts

### Do:
- **Do** utiliser Cyan Lagon pour toute action principale, avec du texte blanc.
- **Do** marquer chaque montant avec `data-amount` (chiffres tabulaires, pas de coupure).
- **Do** garder chaque cible tactile à 44 px minimum.
- **Do** donner une version « mouvement réduit » à chaque animation (fondu seul, sans déplacement).
- **Do** utiliser les courbes à sortie forte (`cubic-bezier(0.23, 1, 0.32, 1)`) et des durées de 150 à 320 ms.
- **Do** vérifier le contraste AA de toute nouvelle paire de couleurs (4,5:1 pour le texte, 3:1 pour les éléments graphiques).

### Don't:
- **Don't** utiliser le rouge comme accent ou pour attirer l'attention : il est réservé aux dépenses, erreurs et suppressions.
- **Don't** mettre du texte blanc sur Cyan Peu Profond, ni du texte Cyan Lagon sur fond gris (utiliser Lagon Pressé).
- **Don't** réintroduire des gris chauds ou un fond crème.
- **Don't** ajouter une seconde famille de caractères.
- **Don't** utiliser Cyan Embrun en mode clair.
- **Don't** animer avec des courbes molles par défaut (`ease`) ni des rebonds.
