import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import "../../src/i18n";
import { SyncButton } from "../../src/features/sync/SyncButton";

describe("bouton de synchro (accueil)", () => {
  it("n'est pas affiché hors connexion", () => {
    const { container } = render(<SyncButton />);
    expect(container.querySelector("button")).toBeNull();
  });
});
