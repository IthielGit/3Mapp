import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/database";

/**
 * Date de coupure des soldes : « maintenant » si l'option « Ignorer le solde futur » est activée,
 * sinon undefined (toutes les transactions comptent).
 */
/** Même règle que le hook, hors composant (exports, services) : coupure « maintenant » ou undefined. */
export async function balanceCutoffNow(database = db): Promise<Date | undefined> {
  const ignore = (await database.settings.toCollection().first())?.ignoreFutureBalance === true;
  return ignore ? new Date() : undefined;
}

export function useBalanceCutoff(): Date | undefined {
  const ignore = useLiveQuery(
    async () => (await db.settings.toCollection().first())?.ignoreFutureBalance === true,
    [],
  );
  return ignore ? new Date() : undefined;
}
