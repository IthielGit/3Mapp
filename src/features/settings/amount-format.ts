import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/database";
import { setAmountFormat, type AmountFormat } from "../../lib/money";

/**
 * Lit le format des montants dans les réglages et l'applique au formatage (formatMoney, saisie).
 * À appeler une fois, dans App : quand le réglage change, App se redessine et tout l'arbre (écrans, feuilles)
 * se met à jour sans être remonté, donc sans fermer les feuilles ni perdre la saisie en cours.
 */
export function useAmountFormatSetting(): AmountFormat {
  const format = useLiveQuery(
    async (): Promise<AmountFormat> => (await db.settings.toCollection().first())?.amountFormat ?? "dot",
    [],
    "dot" as AmountFormat,
  );
  setAmountFormat(format);
  return format;
}
