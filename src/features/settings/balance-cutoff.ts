import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/database";

/**
 * Date de coupure des soldes : « maintenant » si l'option « Ignorer le solde futur » est activée,
 * sinon undefined (toutes les transactions comptent).
 */
export function useBalanceCutoff(): Date | undefined {
  const ignore = useLiveQuery(
    async () => (await db.settings.toCollection().first())?.ignoreFutureBalance === true,
    [],
  );
  return ignore ? new Date() : undefined;
}
