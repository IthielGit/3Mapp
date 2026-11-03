import { sumMinor, type Minor } from "../lib/money";

export type DebtStatus = "ongoing" | "settled" | "late";

export interface DebtInput {
  principal: Minor;
  /** Taux annuel simple, en pourcentage (ex. 12 = 12 %). */
  interestRate?: number | undefined;
  startDate: string;
  dueDate?: string | undefined;
}

export interface DebtPaymentLike {
  amount: Minor;
}

/**
 * Intérêts simples courus du début jusqu'à `asOf` : principal × taux × jours / 365, arrondis une seule fois.
 * Les paiements ne réduisent pas la base d'intérêts (intérêts simples).
 */
export function accruedInterest(
  principal: Minor,
  rate: number | undefined,
  startDate: string,
  asOf: Date,
): Minor {
  if (!rate || rate <= 0) return 0;
  const days = Math.max(
    0,
    (asOf.getTime() - new Date(startDate).getTime()) / (24 * 60 * 60 * 1000),
  );
  return Math.round((principal * rate * days) / (100 * 365));
}

export interface DebtState {
  /** Principal + intérêts courus à la date `asOf`. */
  totalDue: Minor;
  paid: Minor;
  /** Reste dû ; 0 si soldée. */
  remaining: Minor;
  status: DebtStatus;
}

export function debtState(
  debt: DebtInput,
  payments: readonly DebtPaymentLike[],
  asOf: Date,
): DebtState {
  const interest = accruedInterest(debt.principal, debt.interestRate, debt.startDate, asOf);
  const totalDue = debt.principal + interest;
  const paid = sumMinor(payments.map((p) => p.amount));
  const remaining = Math.max(0, totalDue - paid);

  let status: DebtStatus = "ongoing";
  if (remaining === 0) status = "settled";
  else if (debt.dueDate && asOf.getTime() > new Date(debt.dueDate).getTime()) status = "late";

  return { totalDue, paid, remaining, status };
}
