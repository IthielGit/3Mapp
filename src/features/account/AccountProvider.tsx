import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabase-client";

/** État du compte : « unconfigured » = app locale sans service de comptes (cas par défaut). */
export type AccountState =
  | { status: "unconfigured" }
  | { status: "loading"; client: SupabaseClient }
  | { status: "signedOut"; client: SupabaseClient }
  | { status: "signedIn"; client: SupabaseClient; session: Session };

const AccountContext = createContext<AccountState>({ status: "unconfigured" });

/**
 * Fournit la session. Le compte est optionnel : sans configuration, l'app reste entièrement locale.
 * L'état est écouté via onAuthStateChange, donc une connexion Google (retour de redirection) est prise en compte.
 */
export function AccountProvider({ children, client = getSupabase() }: { children: ReactNode; client?: SupabaseClient | null }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!client) return;
    let active = true;
    void client.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session);
      })
      .catch(() => {
        if (active) setSession(null);
      });
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      if (active) setSession(next);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  const value = useMemo<AccountState>(() => {
    if (!client) return { status: "unconfigured" };
    if (session === undefined) return { status: "loading", client };
    if (session === null) return { status: "signedOut", client };
    return { status: "signedIn", client, session };
  }, [client, session]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountState {
  return useContext(AccountContext);
}
