import { afterEach, describe, expect, it, vi } from "vitest";
import { READ_ONLY_BLOCKED_EVENT } from "../../src/db/sync-tracking";
import { installConsultGuard } from "../../src/features/admin/consult-guard";

let uninstall: (() => void) | undefined;

afterEach(() => {
  uninstall?.();
  uninstall = undefined;
  document.body.innerHTML = "";
});

function setup(html: string) {
  document.body.innerHTML = html;
  uninstall = installConsultGuard();
}

function byId(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw new Error(`élément absent : ${id}`);
  return found;
}

function click(el: Element): { prevented: boolean } {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return { prevented: event.defaultPrevented };
}

describe("mode lecture seule à l'écran", () => {
  it("bloque les boutons et les contrôles de saisie, et le signale", () => {
    setup(`<button id="b">Ajouter</button><input id="i" /><select id="s"><option>a</option></select>`);
    const blocked = vi.fn();
    window.addEventListener(READ_ONLY_BLOCKED_EVENT, blocked);

    const button = byId("b");
    const onButton = vi.fn();
    button.addEventListener("click", onButton);
    expect(click(button).prevented).toBe(true);
    expect(onButton).not.toHaveBeenCalled();
    expect(blocked).toHaveBeenCalled();

    const input = byId("i");
    const beforeInput = new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText", data: "x" });
    input.dispatchEvent(beforeInput);
    expect(beforeInput.defaultPrevented).toBe(true);

    const select = byId("s");
    const mouseDown = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    select.dispatchEvent(mouseDown);
    expect(mouseDown.defaultPrevented).toBe(true);

    window.removeEventListener(READ_ONLY_BLOCKED_EVENT, blocked);
  });

  it("bloque l'envoi de formulaire", () => {
    setup(`<form id="f"><input name="x" /></form>`);
    const submit = new Event("submit", { bubbles: true, cancelable: true });
    byId("f").dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);
  });

  it("laisse la navigation par liens", () => {
    setup(`<a id="l" href="/transactions">Transactions</a>`);
    expect(click(byId("l")).prevented).toBe(false);
  });

  it("laisse la bannière de consultation (zone et bouton de retour)", () => {
    setup(`<div data-consult-allow=""><button id="back">Retour</button></div>`);
    expect(click(byId("back")).prevented).toBe(false);
  });

  it("marque les contrôles désactivés visuellement, et la page en mode consultation", () => {
    setup(`<button>x</button>`);
    expect(document.body.dataset.consult).toBe("true");
    expect(document.head.querySelector("#consult-guard-style")).not.toBeNull();
  });

  it("se désactive proprement", () => {
    setup(`<button id="b">x</button>`);
    uninstall?.();
    uninstall = undefined;
    expect(document.body.dataset.consult).toBeUndefined();
    expect(document.head.querySelector("#consult-guard-style")).toBeNull();
    expect(click(byId("b")).prevented).toBe(false);
  });
});
