import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { UpdateBanner } from "./PwaComponents";
import { generateDueOccurrences } from "../features/recurring/recurring-service";

export function AppLayout() {
  // Rattrapage des récurrences à l'ouverture (SPEC §2, §5.7) : une passe par ouverture de l'app.
  useEffect(() => {
    void generateDueOccurrences().catch(() => undefined);
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <main className="flex-1 px-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))]">
        <Outlet />
      </main>
      <BottomNav />
      <UpdateBanner />
    </div>
  );
}
