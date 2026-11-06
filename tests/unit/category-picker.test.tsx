import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Category } from "../../src/db/entities";
import { BottomSheet } from "../../src/components/BottomSheet";
import { CategoryPicker } from "../../src/features/transactions/CategoryPicker";

const cats = [
  { id: "c1", name: "Alimentation", icon: "🍚", kind: "expense", archived: false },
  { id: "c2", name: "Loisirs", icon: "🎮", kind: "expense", archived: false },
  { id: "c3", name: "Logement", icon: "🏠", kind: "expense", archived: false },
] as unknown as Category[];

function setup(value = "", onChange = vi.fn(), onCreateNew = vi.fn()) {
  render(
    <CategoryPicker
      label="Catégorie"
      placeholder="Choisir une catégorie"
      value={value}
      options={cats}
      onChange={onChange}
      onCreateNew={onCreateNew}
    />,
  );
  return { onChange, onCreateNew };
}

describe("Choix de catégorie", () => {
  it("affiche la catégorie choisie, ou le texte d'attente", () => {
    setup("c2");
    expect(screen.getByRole("button", { name: /Loisirs/ })).toBeTruthy();
  });

  it("« Nouvelle catégorie » est en tête de la feuille et ouvre la création", async () => {
    const { onCreateNew } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Choisir une catégorie/ }));
    const create = await screen.findByRole("button", { name: /Nouvelle catégorie/ });
    // En tête : avant la première catégorie de la liste.
    const radios = await screen.findAllByRole("radio");
    expect(create.compareDocumentPosition(radios[0] as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(create);
    expect(onCreateNew).toHaveBeenCalledTimes(1);
  });

  it("la recherche filtre la liste", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /Choisir une catégorie/ }));
    fireEvent.change(await screen.findByRole("searchbox"), { target: { value: "lo" } });
    const names = (await screen.findAllByRole("radio")).map((r) => r.textContent);
    expect(names).toHaveLength(2);
    expect(names.join(" ")).toContain("Loisirs");
    expect(names.join(" ")).toContain("Logement");
  });

  it("choisir une catégorie la renvoie et ferme la feuille", async () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Choisir une catégorie/ }));
    fireEvent.click(await screen.findByRole("radio", { name: /Loisirs/ }));
    expect(onChange).toHaveBeenCalledWith("c2");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 1000 });
  });
});

describe("Feuilles imbriquées : Échap", () => {
  it("ne ferme que la feuille du dessus", async () => {
    const parentClose = vi.fn();
    function Parent() {
      return (
        <BottomSheet open title="Transaction" onClose={parentClose}>
          <CategoryPicker
            label="Catégorie"
            placeholder="Choisir une catégorie"
            value=""
            options={cats}
            onChange={vi.fn()}
            onCreateNew={vi.fn()}
          />
        </BottomSheet>
      );
    }
    render(<Parent />);
    fireEvent.click(screen.getByRole("button", { name: /Choisir une catégorie/ }));
    await waitFor(() => expect(screen.getAllByRole("dialog")).toHaveLength(2));

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.getAllByRole("dialog")).toHaveLength(1), { timeout: 1000 });
    expect(parentClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(parentClose).toHaveBeenCalledTimes(1);
  });
});
