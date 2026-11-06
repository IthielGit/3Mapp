import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isAuthRetryableFetchError, type AuthError, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabase-client";
import {
  fetchProfile,
  PROFILE_RETRIES,
  PROFILE_RETRY_MS,
  PROFILE_TIMEOUT_MS,
  readCachedStatus,
  resolveStatus,
  writeCachedStatus,
  type AccountProfile,
} from "./profile";
import { clearCachedUser, readCachedUser, writeCachedUser, type CachedUser } from "./offline-user";

/**
 * État du compte.
 * - unconfigured : service de comptes absent (app 100 % locale, cas par défaut).
 * - loading : session ou profil en cours de lecture.
 * - signedOut : aucune session.
 * - signedIn : connecté et actif. `profile` est absent si le serveur est injoignable.
 * - suspended : connecté mais suspendu par un administrateur ; l'app est bloquée (SPEC §5.14).
 * - offline : session non renouvelable faute de réseau, identité mémorisée sur l'appareil.
 *   L'app reste ouverte avec les données locales ; la synchro reprend au retour du réseau.
 *   `blocked` reprend le dernier statut connu (un compte suspendu reste bloqué).
 */
export type AccountState =
  | { status: "unconfigured" }
  | { status: "loading"; client: SupabaseClient }
  | { status: "signedOut"; client: SupabaseClient }
  | { status: "signedIn"; client: SupabaseClient; session: Session; profile?: AccountProfile }
  | { status: "suspended"; client: SupabaseClient; session: Session; profile?: AccountProfile }
  | { status: "offline"; client: SupabaseClient; user: CachedUser; blocked: boolean };

const AccountContext = createContext<AccountState>({ status: "unconfigured" });

/** Erreur de réseau (ou navigateur hors ligne) : la session n'est pas remise en cause. */
function isTransient(error: AuthError | null): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return error !== null && isAuthRetryableFetchError(error);
}

/**
 * Fournit la session et le profil. Le compte est optionnel : sans configuration, l'app reste locale.
 * Le profil est relu à la connexion, au retour du réseau, et à chaque changement de session.
 */
export function AccountProvider({
  children,
  client = getSupabase(),
}: {
  children: ReactNode;
  client?: SupabaseClient | null;
}) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  // Identité mémorisée, utilisée seulement quand la session n'a pas pu être relue faute de réseau.
  const [offlineUser, setOfflineUser] = useState<CachedUser | undefined>();
  // Profil lu pour un compte donné ; il ne vaut que pour ce compte.
  const [profileRead, setProfileRead] = useState<{ userId: string; profile?: AccountProfile } | undefined>();
  const [online, setOnline] = useState(0);
  const userId = session?.user.id;
  const profile = profileRead && profileRead.userId === userId ? profileRead.profile : undefined;
  const profileSettled = userId !== undefined && profileRead?.userId === userId;

  useEffect(() => {
    const bump = () => setOnline((n) => n + 1);
    window.addEventListener("online", bump);
    return () => window.removeEventListener("online", bump);
  }, []);

  useEffect(() => {
    if (!client) return;
    let active = true;
    const apply = (next: Session | null, transient: boolean) => {
      if (!active) return;
      if (next) {
        writeCachedUser(next.user);
        setOfflineUser(undefined);
        setSession(next);
        return;
      }
      // Pas de réseau : on garde l'identité mémorisée au lieu de considérer l'utilisateur comme déconnecté.
      const cached = transient ? readCachedUser() : undefined;
      if (cached) {
        setOfflineUser(cached);
        setSession(null);
        return;
      }
      clearCachedUser();
      setOfflineUser(undefined);
      setSession(null);
    };
    const restore = () => {
      client.auth
        .getSession()
        .then(({ data, error }) => apply(data.session, isTransient(error)))
        .catch(() => apply(null, true));
    };
    restore();
    const { data } = client.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (next) {
        writeCachedUser(next.user);
        setOfflineUser(undefined);
        setSession(next);
      } else if (event === "SIGNED_OUT") {
        clearCachedUser();
        setOfflineUser(undefined);
        setSession(null);
      }
      // Les autres événements sans session (ex. INITIAL_SESSION hors ligne) sont ignorés : getSession tranche.
    });
    // Au retour du réseau, on tente de renouveler la session tout de suite.
    window.addEventListener("online", restore);
    return () => {
      active = false;
      window.removeEventListener("online", restore);
      data.subscription.unsubscribe();
    };
  }, [client]);

  useEffect(() => {
    if (!client || !userId) return;
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    // Lecture du profil avec nouvelles tentatives : un échec transitoire ne doit pas être pris pour « pas de profil ».
    const load = (attempt: number) => {
      const timeout = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), PROFILE_TIMEOUT_MS));
      void Promise.race([fetchProfile(client, userId), timeout])
        .then((next) => {
          if (!active) return;
          if (next) {
            writeCachedStatus(userId, next.status);
            setProfileRead({ userId, profile: next });
            return;
          }
          if (attempt < PROFILE_RETRIES && navigator.onLine) {
            retry = setTimeout(() => load(attempt + 1), PROFILE_RETRY_MS);
            return;
          }
          setProfileRead({ userId });
        })
        .catch(() => {
          if (!active) return;
          if (attempt < PROFILE_RETRIES && navigator.onLine) {
            retry = setTimeout(() => load(attempt + 1), PROFILE_RETRY_MS);
            return;
          }
          setProfileRead({ userId });
        });
    };
    load(0);
    return () => {
      active = false;
      if (retry !== undefined) clearTimeout(retry);
    };
  }, [client, userId, online]);

  const value = useMemo<AccountState>(() => {
    if (!client) return { status: "unconfigured" };
    if (session === undefined) return { status: "loading", client };
    if (session === null) {
      if (offlineUser) {
        const blocked = readCachedStatus(offlineUser.id) === "suspended";
        return { status: "offline", client, user: offlineUser, blocked };
      }
      return { status: "signedOut", client };
    }
    if (!profileSettled) return { status: "loading", client };
    const cached = readCachedStatus(session.user.id);
    const status = resolveStatus(profile, cached);
    if (status === "suspended") return { status: "suspended", client, session, profile };
    return { status: "signedIn", client, session, profile };
  }, [client, session, offlineUser, profile, profileSettled]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountState {
  return useContext(AccountContext);
}
