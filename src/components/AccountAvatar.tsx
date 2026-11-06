import { useState } from "react";

/**
 * Photo du compte (Google) dans le rond de son parent. Si la photo ne charge pas, ou s'il n'y en a pas,
 * on affiche l'initiale. Le parent fixe la taille et la couleur du rond.
 */
export function AccountAvatar({ avatarUrl, initial }: { avatarUrl?: string; initial: string }) {
  const [failed, setFailed] = useState(false);
  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-full w-full rounded-full object-cover"
      />
    );
  }
  return <span aria-hidden="true">{initial}</span>;
}
