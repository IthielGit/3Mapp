import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuickCategorySheet } from "../../src/features/categories/QuickCategorySheet";

const createCategory = vi.fn(async (input: { name: string; icon: string }) => ({ id: "new-1", ...input }));

vi.mock("../../src/features/categories/category-service", () => ({
  createCategory: (input: { name: string; icon: string }) => createCategory(input),
}));

describe("Création rapide de catégorie : icône", () => {
  it("crée la catégorie avec l'icône choisie", async () => {
    const onCreated = vi.fn();
    render(<QuickCategorySheet open kind="expense" onClose={vi.fn()} onCreated={onCreated} />);
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "Sport" } });
    fireEvent.click(await screen.findByRole("radio", { name: "🏦" }));
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("new-1"));
    expect(createCategory).toHaveBeenCalledWith(expect.objectContaining({ name: "Sport", icon: "🏦" }));
  });
});
