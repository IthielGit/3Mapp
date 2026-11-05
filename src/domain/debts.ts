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
  /** Date du paiement (ISO). Sans date, le paiement est pris à la date de calcul. */
  date?: string | undefined;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Intérêts simples courus du début jusqu'à `asOf`, sur le capital initial : principal × taux × jours / 365.
 * Sans paiement, c'est le total exact. Avec des paiements, utiliser `debtState`.
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
    (asOf.getTime() - new Date(startDate).getTime()) / DAY_MS,
  );
  return Math.round((principal * rate * days) / (100 * 365));
}

export interface DebtState {
  /** Capital + intérêts courus au total, à la date `asOf`. */
  totalDue: Minor;
  paid: Minor;
  /** Reste dû (capital restant + intérêts courus non payés) ; 0 si soldée. */
  remaining: Minor;
  status: DebtStatus;
}

/**
 * État d'une dette à la date `asOf`. Les intérêts courent par jours entiers sur le capital restant :
 * un paiement règle d'abord les intérêts en attente, puis le capital.
 * Les paiements sans date sont pris à `asOf`.
 */
export function debtState(
  debt: DebtInput,
  payments: readonly DebtPaymentLike[],
  asOf: Date,
): DebtState {
  const rate = debt.interestRate && debt.interestRate > 0 ? debt.interestRate : 0;
  const asOfTime = asOf.getTime();
  let capital = debt.principal;
  let owedInterest = 0;
  let interestPaid = 0;
  let cursor = new Date(debt.startDate).getTime();

  const accrueUntil = (time: number) => {
    const days = Math.floor((time - cursor) / DAY_MS);
    if (days > 0 && rate > 0 && capital > 0) {
      owedInterest += Math.round((capital * rate * days) / 36500);
    }
    if (time > cursor) cursor = time;
  };
  const apply = (amount: Minor) => {
    const toInterest = Math.min(amount, owedInterest);
    owedInterest -= toInterest;
    interestPaid += toInterest;
    capital = Math.max(0, capital - (amount - toInterest));
  };

  const dated = payments
    .filter((p) => p.date !== undefined && new Date(p.date).getTime() <= asOfTime)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const undated = payments.filter((p) => p.date === undefined);

  for (const p of dated) {
    accrueUntil(new Date(p.date ?? 0).getTime());
    apply(p.amount);
  }
  accrueUntil(asOfTime);
  for (const p of undated) apply(p.amount);

  const paid = sumMinor(payments.map((p) => p.amount));
  const totalDue = debt.principal + interestPaid + owedInterest;
  const remaining = Math.max(0, capital + owedInterest);

  let status: DebtStatus = "ongoing";
  if (remaining === 0) status = "settled";
  else if (debt.dueDate && asOfTime > new Date(debt.dueDate).getTime()) status = "late";

  return { totalDue, paid, remaining, status };
}
