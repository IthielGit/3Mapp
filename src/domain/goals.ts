import { sumMinor, type Minor } from "../lib/money";

export interface GoalDeposit {
  /** Positif = versement, négatif = retrait. */
  amount: Minor;
  date: string;
}

/** Montant épargné = somme des versements et retraits (SPEC §5.9). */
export function goalBalance(deposits: readonly GoalDeposit[]): Minor {
  return sumMinor(deposits.map((d) => d.amount));
}

export interface GoalProgress {
  saved: Minor;
  remaining: Minor;
  percent: number;
  reached: boolean;
  /** Date estimée d'atteinte au rythme moyen observé ; null si le rythme est nul ou négatif. */
  estimatedDate: Date | null;
}

/**
 * Progression d'un objectif. Le rythme est le total épargné divisé par le nombre de jours écoulés
 * depuis le premier versement : c'est une estimation simple, pas une prévision.
 */
export function goalProgress(
  target: Minor,
  deposits: readonly GoalDeposit[],
  now: Date,
): GoalProgress {
  const saved = goalBalance(deposits);
  const remaining = target - saved;
  const reached = remaining <= 0;
  const percent = target > 0 ? Math.min(100, Math.max(0, Math.round((saved * 100) / target))) : 0;

  let estimatedDate: Date | null = null;
  if (!reached && saved > 0 && deposits.length > 0) {
    const first = Math.min(...deposits.map((d) => new Date(d.date).getTime()));
    const dayMs = 24 * 60 * 60 * 1000;
    const days = Math.max(1, (now.getTime() - first) / dayMs);
    const perDay = saved / days;
    if (perDay > 0) {
      estimatedDate = new Date(now.getTime() + (remaining / perDay) * dayMs);
    }
  }
  return { saved, remaining: Math.max(0, remaining), percent, reached, estimatedDate };
}
