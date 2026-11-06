import { describe, expect, it } from "vitest";
import { accountIdentity } from "../../src/features/account/account-identity";

describe("identité du compte", () => {
  it("prend le nom complet et la photo d'une connexion Google", () => {
    const user = {
      email: "ana@exemple.be",
      user_metadata: { full_name: "Ana Rakoto", avatar_url: "https://lh3.googleusercontent.com/a/x=s96-c" },
    };
    expect(accountIdentity(user)).toEqual({
      name: "Ana Rakoto",
      avatarUrl: "https://lh3.googleusercontent.com/a/x=s96-c",
    });
  });

  it("retombe sur le nom, puis sur la partie locale de l'e-mail", () => {
    expect(accountIdentity({ email: "ana@exemple.be", user_metadata: { name: "Ana" } }).name).toBe("Ana");
    expect(accountIdentity({ email: "ana@exemple.be", user_metadata: {} }).name).toBe("ana");
  });

  it("sans métadonnées ni photo, ne renvoie pas d'avatar", () => {
    expect(accountIdentity({ email: "ana@exemple.be", user_metadata: {} }).avatarUrl).toBeUndefined();
    expect(accountIdentity(undefined)).toEqual({ name: "" });
  });

  it("n'accepte que les adresses https pour la photo", () => {
    const user = { email: "a@b.be", user_metadata: { avatar_url: "http://exemple.be/a.png" } };
    expect(accountIdentity(user).avatarUrl).toBeUndefined();
  });

  it("utilise picture si avatar_url est absent", () => {
    const user = { email: "a@b.be", user_metadata: { picture: "https://exemple.be/p.png" } };
    expect(accountIdentity(user).avatarUrl).toBe("https://exemple.be/p.png");
  });
});
