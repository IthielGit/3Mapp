export interface ConfirmOptions {
  message: string;
  /** Libellé du bouton de validation. Par défaut : « Supprimer » si `danger`, sinon « Valider ». */
  confirmLabel?: string;
  /** Action destructive : bouton rouge. Défaut : oui. */
  danger?: boolean;
}

type Handler = (options: ConfirmOptions) => Promise<boolean>;

/** Relié par ConfirmHost au montage de l'application ; avant cela, la boîte native reste le recours. */
let handler: Handler | null = null;

/** Demande une confirmation dans l'application, dans une feuille (et non dans la boîte du navigateur). */
export function askConfirm(options: ConfirmOptions): Promise<boolean> {
  if (handler) return handler(options);
  return Promise.resolve(window.confirm(options.message));
}

/** Appelé par ConfirmHost ; renvoie la fonction de nettoyage. */
export function registerConfirmHandler(next: Handler): () => void {
  handler = next;
  return () => {
    handler = null;
  };
}
