import { useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { HeaderSlotsContext } from "./header-slots";

/** Titre d'écran : dans la ligne d'en-tête si elle existe, sinon en place. */
export function PageTitle({ className, children }: { className: string; children: ReactNode }) {
  const { titleSlot } = useContext(HeaderSlotsContext);
  const heading = <h1 className={className}>{children}</h1>;
  return titleSlot ? createPortal(heading, titleSlot) : heading;
}

/** Actions d'en-tête (menu « ⋯ ») : affichées à droite de la ligne d'en-tête. */
export function HeaderActions({ children }: { children: ReactNode }) {
  const { actionsSlot } = useContext(HeaderSlotsContext);
  if (!actionsSlot) return null;
  return createPortal(children, actionsSlot);
}
