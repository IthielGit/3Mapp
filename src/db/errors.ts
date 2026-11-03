export type InUseKind = "wallet" | "category" | "subcategory";

/** Levée quand on tente de supprimer un élément déjà utilisé (SPEC §6, règle 5). */
export class InUseError extends Error {
  readonly kind: InUseKind;

  constructor(kind: InUseKind) {
    super(`Élément utilisé : ${kind}`);
    this.name = "InUseError";
    this.kind = kind;
  }
}

export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleError";
  }
}
