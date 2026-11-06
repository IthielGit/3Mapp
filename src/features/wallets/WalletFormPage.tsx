import { PageTitle } from "../../components/PageHeader";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../db/database";
import type { Wallet } from "../../db/entities";
import { ColorPicker, IconPicker } from "../../components/Pickers";
import { Field, buttonPrimary, buttonSecondary, inputClass } from "../../components/FormControls";
import { CURRENCIES, formatMoney, type CurrencyCode } from "../../lib/money";
import { parseAmountText } from "../../lib/amount-entry";
import { AmountTextInput } from "../../components/AmountTextInput";
import { createWallet, updateWallet } from "./wallet-service";

const GROUPS: Wallet["group"][] = ["bank", "cash", "mobile", "savings", "credit_card"];

export function WalletFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [loaded, setLoaded] = useState(!id);
  const [existing, setExisting] = useState<Wallet | undefined>();

  const [name, setName] = useState("");
  const [group, setGroup] = useState<Wallet["group"]>("bank");
  const [currency, setCurrency] = useState<CurrencyCode>("MGA");
  const [balanceText, setBalanceText] = useState("0");
  const [icon, setIcon] = useState("🏦");
  const [color, setColor] = useState("#0B7E9D");
  const [includeInTotal, setIncludeInTotal] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [nameError, setNameError] = useState<string | undefined>();

  useEffect(() => {
    if (!id) return;
    void db.wallets.get(id).then((wallet) => {
      if (!wallet) return;
      setExisting(wallet);
      setName(wallet.name);
      setGroup(wallet.group);
      setCurrency(wallet.currency);
      setBalanceText(formatMoney(wallet.initialBalance, wallet.currency, { withSymbol: false }));
      setIcon(wallet.icon);
      setColor(wallet.color);
      setIncludeInTotal(wallet.includeInTotal);
      setLoaded(true);
    });
  }, [id]);

  if (!loaded) return null;

  function missingField(): string | null {
    if (name.trim() === "") return t("forms.missingName");
    if (parseAmountText(balanceText || "0", currency) === null) return t("errors.invalidAmount");
    return null;
  }

  async function save() {
    setError(undefined);
    if (name.trim() === "") return setNameError(t("errors.required"));
    const initialBalance = parseAmountText(balanceText || "0", currency);
    if (initialBalance === null) return setError(t("errors.invalidAmount"));

    const input = {
      name: name.trim(),
      group,
      currency,
      initialBalance,
      icon,
      color,
      includeInTotal,
    };
    if (existing) {
      await updateWallet(existing.id, input);
    } else {
      await createWallet({ ...input, archived: false });
    }
    // Succès : retour à l'accueil. En cas d'erreur, on reste sur le formulaire.
    navigate("/", { replace: true });
  }

  return (
    <section className="flex flex-col gap-3">
      <PageTitle className="text-2xl font-semibold">
        {existing ? t("wallets.editTitle") : t("wallets.newTitle")}
      </PageTitle>

      <Field label={t("common.name")} error={nameError}>
        <input
          className={inputClass}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameError(undefined);
          }}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("wallets.group")}>
          <select
            className={inputClass}
            value={group}
            onChange={(e) => setGroup(e.target.value as Wallet["group"])}
          >
            {GROUPS.map((g) => (
              <option key={g} value={g}>
                {t(`groups.${g}`)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("common.currency")}>
          <select
            className={inputClass}
            value={currency}
            disabled={existing !== undefined}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
          >
            {Object.values(CURRENCIES).map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.symbol}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {existing ? (
        <span className="-mt-2 text-sm text-neutral-600 dark:text-muted">{t("wallets.currencyLocked")}</span>
      ) : null}

      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <Field label={t("wallets.initialBalance")}>
          <AmountTextInput
            className={inputClass}
            value={balanceText}
            onValueChange={setBalanceText}
          />
        </Field>
        <label className="flex min-h-[44px] items-center gap-2 whitespace-nowrap">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={includeInTotal}
            onChange={(e) => setIncludeInTotal(e.target.checked)}
          />
          {t("wallets.includeInTotal")}
        </label>
      </div>

      <IconPicker value={icon} onChange={setIcon} label={t("common.icon")} />
      <ColorPicker value={color} onChange={setColor} label={t("common.color")} />

      {error ? (
        <p role="alert" className="text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {missingField() ? <p className="text-sm text-neutral-600 dark:text-muted">{missingField()}</p> : null}
      <div className="flex justify-end gap-3">
        <button type="button" className={buttonSecondary} onClick={() => navigate(-1)}>
          {t("common.cancel")}
        </button>
        <button type="button" className={buttonPrimary} onClick={save} disabled={missingField() !== null}>
          {t("common.save")}
        </button>
      </div>
    </section>
  );
}
