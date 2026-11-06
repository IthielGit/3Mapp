import { useEffect, useState } from "react";
import { ANNOUNCE_EVENT, type AnnounceTone } from "./announce";

/**
 * Zones live invisibles, montées une fois pour toute l'app : « polite » pour les confirmations,
 * « assertive » pour les erreurs. Le message est vidé puis réécrit, pour être relu même s'il est identique.
 */
export function Announcer() {
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");

  useEffect(() => {
    const onAnnounce = (event: Event) => {
      const { message, tone } = (event as CustomEvent<{ message: string; tone: AnnounceTone }>).detail;
      const set = tone === "assertive" ? setAssertive : setPolite;
      set("");
      window.setTimeout(() => set(message), 30);
    };
    window.addEventListener(ANNOUNCE_EVENT, onAnnounce);
    return () => window.removeEventListener(ANNOUNCE_EVENT, onAnnounce);
  }, []);

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {polite}
      </div>
      <div role="alert" aria-live="assertive" className="sr-only">
        {assertive}
      </div>
    </>
  );
}
