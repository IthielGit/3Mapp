/**
 * Prochaine étape de l'accueil : une seule à la fois, pour qu'un premier lancement montre
 * une réponse et une action, pas un formulaire ni une pile de zéros.
 *
 * Ordre : soldes de départ → première saisie → paie → rien.
 */

export type HomeNextStep =
  /** Les comptes comptés sont tous à 0 et rien n'est saisi : demander le solde de départ. */
  | "startBalance"
  /** Aucune transaction : proposer la première saisie. */
  | "firstEntry"
  /** Paie sans réponse, et une entrée de revenu peut être proposée comme paie (« C'est votre paie ? »). */
  | "paySuggestion"
  /** Paie sans réponse : une ligne « Quand touchez-vous votre paie ? » qui ouvre le formulaire. */
  | "pay"
  | "none";

export interface HomeStepWallet {
  initialBalance: number;
  includeInTotal: boolean;
  group: string;
  archived?: boolean | undefined;
}

export interface HomeStepFacts {
  wallets: readonly HomeStepWallet[];
  transactionCount: number;
  /** Mode de paie enregistré (absent : jamais répondu). */
  payMode?: "fixed" | "irregular" | "none" | undefined;
  /** Revenu choisi comme paie (absent : aucun). */
  payIncomeCategoryId?: string | undefined;
  /** Date (ISO) de la dernière entrée de revenu proposée comme paie, si une suggestion existe. */
  suggestedPayDate?: string | undefined;
  /** Moment (ISO) où l'utilisateur a répondu « Non » à la suggestion. */
  paySuggestionDismissedAt?: string | undefined;
}

/** Comptes pris en compte dans « Disponible » : actifs, inclus dans le total, hors épargne. */
function counted(wallets: readonly HomeStepWallet[]): HomeStepWallet[] {
  return wallets.filter((w) => !w.archived && w.includeInTotal && w.group !== "savings");
}

/**
 * La suggestion est reposée seulement pour une entrée de revenu plus récente que le « Non » :
 * l'entrée refusée (et toutes les plus anciennes) ne revient jamais, mais un nouveau revenu
 * saisi après le refus peut, lui, être la paie. Une date invalide compte comme refus.
 */
export function suggestionStillAsked(suggestedPayDate: string, dismissedAt: string | undefined): boolean {
  if (dismissedAt === undefined) return true;
  const suggested = Date.parse(suggestedPayDate);
  const dismissed = Date.parse(dismissedAt);
  if (Number.isNaN(suggested) || Number.isNaN(dismissed)) return false;
  return suggested > dismissed;
}

/** Vrai quand la question de paie a déjà une réponse (revenu choisi, ou irrégulier / sans paie). */
export function payAnsweredFrom(facts: Pick<HomeStepFacts, "payMode" | "payIncomeCategoryId">): boolean {
  return (
    facts.payIncomeCategoryId !== undefined || facts.payMode === "irregular" || facts.payMode === "none"
  );
}

export function homeNextStep(facts: HomeStepFacts): HomeNextStep {
  if (facts.transactionCount === 0) {
    if (counted(facts.wallets).every((w) => w.initialBalance === 0)) return "startBalance";
    return "firstEntry";
  }
  if (payAnsweredFrom(facts)) return "none";
  if (
    facts.suggestedPayDate !== undefined &&
    suggestionStillAsked(facts.suggestedPayDate, facts.paySuggestionDismissedAt)
  ) {
    return "paySuggestion";
  }
  return "pay";
}
