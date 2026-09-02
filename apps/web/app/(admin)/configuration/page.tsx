"use client";

import { useEffect, useRef, useState } from "react";
import {
  updateStoreSettings as saveStoreSettings,
  uploadStoreLogo,
  removeStoreLogo,
  setAllowPartialRefunds,
  setDefaultCarrier,
  setApiCredentials,
  setApiEnvironment,
  fetchCarrierRules,
  upsertCarrierRule,
  deleteCarrierRule,
  fetchPaymentMethodRules,
  setPaymentMethodRules,
  fetchTaxRules,
  upsertTaxRule,
  deleteTaxRule,
  clearAllData,
  resetSeedData,
  type CarrierRule,
  type PaymentMethodRule,
  type TaxRule,
  type PaymentMethod,
  type ApiEnvironment,
} from "@/lib/api";
import { useStoreSettings } from "@/lib/store-settings-context";
import { useAuth } from "@/lib/auth-context";
import { COUNTRIES } from "@/lib/countries";
import { CARRIER_OPTIONS } from "@/lib/constants";

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "CARD", label: "Card" },
  { value: "PAYPAL", label: "PayPal" },
  { value: "BANK", label: "Bank transfer" },
  { value: "PAY_WITH_CHECK", label: "Check" },
];

export default function ConfigurationPage() {
  const { user } = useAuth();
  const { settings, setSettings } = useStoreSettings();
  const [storeName, setStoreName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [refundsSaving, setRefundsSaving] = useState(false);
  const [refundsError, setRefundsError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [credentialTab, setCredentialTab] = useState<ApiEnvironment>("SANDBOX");
  const [stripeSecretKeyTestInput, setStripeSecretKeyTestInput] = useState("");
  const [stripeWebhookSecretTestInput, setStripeWebhookSecretTestInput] = useState("");
  const [easypostApiKeyTestInput, setEasypostApiKeyTestInput] = useState("");
  const [stripeSecretKeyLiveInput, setStripeSecretKeyLiveInput] = useState("");
  const [stripeWebhookSecretLiveInput, setStripeWebhookSecretLiveInput] = useState("");
  const [easypostApiKeyLiveInput, setEasypostApiKeyLiveInput] = useState("");
  const [credentialsSaving, setCredentialsSaving] = useState(false);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [credentialsSaved, setCredentialsSaved] = useState(false);
  const [environmentSwitching, setEnvironmentSwitching] = useState(false);
  const [environmentError, setEnvironmentError] = useState<string | null>(null);
  const [pendingProductionConfirm, setPendingProductionConfirm] = useState(false);

  const [carrierRules, setCarrierRules] = useState<CarrierRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [defaultCarrierSaving, setDefaultCarrierSaving] = useState(false);
  const [ruleCountry, setRuleCountry] = useState(COUNTRIES[0].code);
  const [ruleCarrier, setRuleCarrier] = useState<string>(CARRIER_OPTIONS[0]);
  const [ruleSaving, setRuleSaving] = useState(false);
  const [ruleError, setRuleError] = useState<string | null>(null);

  useEffect(() => {
    fetchCarrierRules()
      .then(setCarrierRules)
      .catch(() => {})
      .finally(() => setRulesLoading(false));
  }, []);

  const [paymentRules, setPaymentRules] = useState<PaymentMethodRule[]>([]);
  const [paymentRulesLoading, setPaymentRulesLoading] = useState(true);
  const [paymentRuleCountry, setPaymentRuleCountry] = useState(COUNTRIES[0].code);
  const [paymentRuleMethods, setPaymentRuleMethods] = useState<PaymentMethod[]>([]);
  const [paymentRuleSaving, setPaymentRuleSaving] = useState(false);
  const [paymentRuleError, setPaymentRuleError] = useState<string | null>(null);

  useEffect(() => {
    fetchPaymentMethodRules()
      .then(setPaymentRules)
      .catch(() => {})
      .finally(() => setPaymentRulesLoading(false));
  }, []);

  // Group the flat (country, method) rows into one entry per country for
  // display — the API stores/edits them flat (see
  // paymentMethodRule.service.ts), but staff think in terms of "this
  // country accepts these methods," not individual rows.
  const paymentRulesByCountry = paymentRules.reduce<Record<string, PaymentMethod[]>>((acc, rule) => {
    (acc[rule.country] ??= []).push(rule.paymentMethod);
    return acc;
  }, {});

  const [taxRules, setTaxRules] = useState<TaxRule[]>([]);
  const [taxRulesLoading, setTaxRulesLoading] = useState(true);
  const [taxRuleCountry, setTaxRuleCountry] = useState(COUNTRIES[0].code);
  const [taxRuleRate, setTaxRuleRate] = useState("");
  const [taxRuleSaving, setTaxRuleSaving] = useState(false);
  const [taxRuleError, setTaxRuleError] = useState<string | null>(null);

  useEffect(() => {
    fetchTaxRules()
      .then(setTaxRules)
      .catch(() => {})
      .finally(() => setTaxRulesLoading(false));
  }, []);

  const [pendingReset, setPendingReset] = useState<"clear" | "seed" | null>(null);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetRunning, setResetRunning] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<string | null>(null);

  useEffect(() => {
    if (settings) setStoreName(settings.storeName);
  }, [settings]);

  const canEdit = user?.role === "ADMIN";

  async function handleSave() {
    setError(null);
    setSaved(false);
    if (!storeName.trim()) {
      setError("Store name can't be empty.");
      return;
    }
    setSaving(true);
    try {
      const updated = await saveStoreSettings(storeName.trim());
      setSettings(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(file: File) {
    setLogoError(null);
    setLogoUploading(true);
    try {
      const updated = await uploadStoreLogo(file);
      setSettings(updated);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Failed to upload logo.");
    } finally {
      setLogoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleLogoRemove() {
    setLogoError(null);
    setLogoUploading(true);
    try {
      const updated = await removeStoreLogo();
      setSettings(updated);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Failed to remove logo.");
    } finally {
      setLogoUploading(false);
    }
  }

  async function handlePartialRefundsToggle(next: boolean) {
    setRefundsError(null);
    setRefundsSaving(true);
    try {
      const updated = await setAllowPartialRefunds(next);
      setSettings(updated);
    } catch (err) {
      setRefundsError(err instanceof Error ? err.message : "Failed to update refund setting.");
    } finally {
      setRefundsSaving(false);
    }
  }

  async function handleSaveCredentials() {
    setCredentialsError(null);
    setCredentialsSaved(false);
    const input: Parameters<typeof setApiCredentials>[0] = {};
    if (credentialTab === "SANDBOX") {
      if (stripeSecretKeyTestInput.trim()) input.stripeSecretKeyTest = stripeSecretKeyTestInput.trim();
      if (stripeWebhookSecretTestInput.trim()) input.stripeWebhookSecretTest = stripeWebhookSecretTestInput.trim();
      if (easypostApiKeyTestInput.trim()) input.easypostApiKeyTest = easypostApiKeyTestInput.trim();
    } else {
      if (stripeSecretKeyLiveInput.trim()) input.stripeSecretKeyLive = stripeSecretKeyLiveInput.trim();
      if (stripeWebhookSecretLiveInput.trim()) input.stripeWebhookSecretLive = stripeWebhookSecretLiveInput.trim();
      if (easypostApiKeyLiveInput.trim()) input.easypostApiKeyLive = easypostApiKeyLiveInput.trim();
    }
    if (Object.keys(input).length === 0) {
      setCredentialsError("Enter at least one key to save.");
      return;
    }
    setCredentialsSaving(true);
    try {
      const updated = await setApiCredentials(input);
      setSettings(updated);
      setStripeSecretKeyTestInput("");
      setStripeWebhookSecretTestInput("");
      setEasypostApiKeyTestInput("");
      setStripeSecretKeyLiveInput("");
      setStripeWebhookSecretLiveInput("");
      setEasypostApiKeyLiveInput("");
      setCredentialsSaved(true);
    } catch (err) {
      setCredentialsError(err instanceof Error ? err.message : "Failed to save credentials.");
    } finally {
      setCredentialsSaving(false);
    }
  }

  async function handleSwitchEnvironment(next: ApiEnvironment) {
    setEnvironmentError(null);
    setEnvironmentSwitching(true);
    try {
      const updated = await setApiEnvironment(next);
      setSettings(updated);
      setPendingProductionConfirm(false);
    } catch (err) {
      setEnvironmentError(err instanceof Error ? err.message : "Failed to switch environment.");
    } finally {
      setEnvironmentSwitching(false);
    }
  }

  async function handleDefaultCarrierChange(next: string) {
    setDefaultCarrierSaving(true);
    try {
      const updated = await setDefaultCarrier(next);
      setSettings(updated);
    } catch (err) {
      setRuleError(err instanceof Error ? err.message : "Failed to update default carrier.");
    } finally {
      setDefaultCarrierSaving(false);
    }
  }

  async function handleAddRule() {
    setRuleError(null);
    setRuleSaving(true);
    try {
      const rule = await upsertCarrierRule(ruleCountry, ruleCarrier);
      setCarrierRules((prev) => [...prev.filter((r) => r.country !== rule.country), rule].sort((a, b) => a.country.localeCompare(b.country)));
    } catch (err) {
      setRuleError(err instanceof Error ? err.message : "Failed to save rule.");
    } finally {
      setRuleSaving(false);
    }
  }

  async function handleDeleteRule(id: number) {
    setRuleError(null);
    try {
      await deleteCarrierRule(id);
      setCarrierRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setRuleError(err instanceof Error ? err.message : "Failed to delete rule.");
    }
  }

  function toggleRuleMethod(method: PaymentMethod) {
    setPaymentRuleMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  }

  async function handleAddPaymentRule() {
    setPaymentRuleError(null);
    if (paymentRuleMethods.length === 0) {
      setPaymentRuleError("Select at least one accepted payment method.");
      return;
    }
    setPaymentRuleSaving(true);
    try {
      const updated = await setPaymentMethodRules(paymentRuleCountry, paymentRuleMethods);
      setPaymentRules((prev) => [...prev.filter((r) => r.country !== paymentRuleCountry), ...updated]);
      setPaymentRuleMethods([]);
    } catch (err) {
      setPaymentRuleError(err instanceof Error ? err.message : "Failed to save rule.");
    } finally {
      setPaymentRuleSaving(false);
    }
  }

  async function handleRemovePaymentRule(country: string) {
    setPaymentRuleError(null);
    try {
      await setPaymentMethodRules(country, []);
      setPaymentRules((prev) => prev.filter((r) => r.country !== country));
    } catch (err) {
      setPaymentRuleError(err instanceof Error ? err.message : "Failed to remove rule.");
    }
  }

  async function handleAddTaxRule() {
    setTaxRuleError(null);
    const rate = Number(taxRuleRate);
    if (!taxRuleRate || Number.isNaN(rate) || rate < 0 || rate > 100) {
      setTaxRuleError("Enter a tax rate between 0 and 100.");
      return;
    }
    setTaxRuleSaving(true);
    try {
      const rule = await upsertTaxRule(taxRuleCountry, rate);
      setTaxRules((prev) => [...prev.filter((r) => r.country !== rule.country), rule].sort((a, b) => a.country.localeCompare(b.country)));
      setTaxRuleRate("");
    } catch (err) {
      setTaxRuleError(err instanceof Error ? err.message : "Failed to save tax rule.");
    } finally {
      setTaxRuleSaving(false);
    }
  }

  async function handleDeleteTaxRule(id: number) {
    setTaxRuleError(null);
    try {
      await deleteTaxRule(id);
      setTaxRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setTaxRuleError(err instanceof Error ? err.message : "Failed to delete tax rule.");
    }
  }

  function openResetConfirm(action: "clear" | "seed") {
    setPendingReset(action);
    setResetConfirmText("");
    setResetError(null);
    setResetResult(null);
  }

  function closeResetConfirm() {
    if (resetRunning) return;
    setPendingReset(null);
    setResetConfirmText("");
  }

  async function handleConfirmReset() {
    if (resetConfirmText !== "RESET" || !pendingReset) return;
    setResetRunning(true);
    setResetError(null);
    try {
      const { message } = pendingReset === "clear" ? await clearAllData() : await resetSeedData();
      setResetResult(message);
      setPendingReset(null);
      setResetConfirmText("");
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Failed to run reset.");
    } finally {
      setResetRunning(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink-900">Configuration</h1>
      <p className="mt-1 text-sm text-ink-500">Store-wide settings for this admin panel.</p>

      <div className="mt-6 max-w-xl rounded-xl border border-ink-100 bg-white p-6">
        <p className="text-sm font-medium text-ink-900">General</p>

        <div className="mt-4">
          <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
            Store logo
          </label>
          <p className="mt-1 text-xs text-ink-400">
            Shown in the sidebar. If no logo is uploaded, the store name&apos;s first letter is used instead.
          </p>
          <div className="mt-2 flex items-center gap-4">
            {settings?.logoUrl ? (
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-ink-100 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={settings.logoUrl} alt="Store logo" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-ink-900 text-lg font-bold text-white">
                {(storeName || "S").slice(0, 1).toUpperCase()}
              </div>
            )}
            {canEdit && (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={logoUploading}
                    className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {logoUploading ? "Working..." : settings?.logoUrl ? "Replace logo" : "Upload logo"}
                  </button>
                  {settings?.logoUrl && (
                    <button
                      onClick={handleLogoRemove}
                      disabled={logoUploading}
                      className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {logoError && <p className="text-xs text-brand-600">{logoError}</p>}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoUpload(file);
              }}
            />
          </div>
        </div>

        <div className="mt-6 border-t border-ink-100 pt-5">
          <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
            Store name
          </label>
          <p className="mt-1 text-xs text-ink-400">Shown in the sidebar and used across the admin panel.</p>
          <input
            value={storeName}
            onChange={(e) => setStoreName(e.target.value.slice(0, 60))}
            disabled={!canEdit}
            className="mt-2 w-full rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-ink-400"
          />
        </div>

        {error && <p className="mt-4 text-sm text-brand-600">{error}</p>}
        {saved && !error && <p className="mt-4 text-sm text-emerald-600">Saved.</p>}

        {canEdit ? (
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-5 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        ) : (
          <p className="mt-5 text-xs text-ink-400">Only Admin users can change store settings.</p>
        )}
      </div>

      <div className="mt-6 max-w-xl rounded-xl border border-ink-100 bg-white p-6">
        <p className="text-sm font-medium text-ink-900">Orders</p>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink-900">Allow partial refunds</p>
            <p className="mt-1 text-xs text-ink-400">
              When on, staff can refund an order for less than its full amount, restocking only the items/quantities
              actually being returned. The order stays open (Partially Refunded) until fully resolved. When off,
              refunds are always for the full order amount.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={settings?.allowPartialRefunds ?? false}
            onClick={() => canEdit && handlePartialRefundsToggle(!settings?.allowPartialRefunds)}
            disabled={!canEdit || refundsSaving}
            className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
              settings?.allowPartialRefunds ? "bg-brand-500" : "bg-gray-200"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                settings?.allowPartialRefunds ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </div>
        {refundsError && <p className="mt-3 text-sm text-brand-600">{refundsError}</p>}
        {!canEdit && <p className="mt-3 text-xs text-ink-400">Only Admin users can change this setting.</p>}
      </div>

      <div className="mt-6 max-w-xl rounded-xl border border-ink-100 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink-900">API credentials</p>
            <p className="mt-1 text-xs text-ink-400">
              Stripe and EasyPost keys for this store. Saved here they take priority over the server&apos;s .env file
              and apply immediately, no restart needed. Once set, a key is never shown again — only whether one is
              configured.
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
              settings?.apiEnvironment === "PRODUCTION"
                ? "bg-red-50 text-red-700"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {settings?.apiEnvironment === "PRODUCTION" ? "Live" : "Sandbox"}
          </span>
        </div>

        {canEdit && (
          <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-ink-100 bg-gray-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-ink-900">Environment</p>
              <p className="mt-0.5 text-xs text-ink-400">
                Which key pair below is actually used. Switching to Production makes Stripe charges and EasyPost
                trackers real.
              </p>
            </div>
            <div className="flex shrink-0 gap-1 rounded-md border border-ink-100 bg-white p-1">
              <button
                onClick={() => handleSwitchEnvironment("SANDBOX")}
                disabled={environmentSwitching}
                className={`rounded px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                  settings?.apiEnvironment !== "PRODUCTION" ? "bg-emerald-500 text-white" : "text-ink-500 hover:bg-gray-50"
                }`}
              >
                Sandbox
              </button>
              <button
                onClick={() => (settings?.apiEnvironment === "PRODUCTION" ? undefined : setPendingProductionConfirm(true))}
                disabled={environmentSwitching}
                className={`rounded px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                  settings?.apiEnvironment === "PRODUCTION" ? "bg-red-600 text-white" : "text-ink-500 hover:bg-gray-50"
                }`}
              >
                Production
              </button>
            </div>
          </div>
        )}
        {environmentError && <p className="mt-2 text-sm text-brand-600">{environmentError}</p>}

        {pendingProductionConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
              <p className="text-sm font-semibold text-ink-900">Switch to Production?</p>
              <p className="mt-2 text-sm text-ink-600">
                From this point on, Stripe payment intents and refunds will be real charges, and EasyPost trackers
                will be real shipments — using the Live keys below, not the Sandbox ones.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setPendingProductionConfirm(false)}
                  disabled={environmentSwitching}
                  className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSwitchEnvironment("PRODUCTION")}
                  disabled={environmentSwitching}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {environmentSwitching ? "Switching..." : "Switch to Production"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 flex gap-1 border-b border-ink-100">
          <button
            onClick={() => setCredentialTab("SANDBOX")}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              credentialTab === "SANDBOX" ? "border-brand-500 text-brand-600" : "border-transparent text-ink-500 hover:text-ink-700"
            }`}
          >
            Sandbox keys
          </button>
          <button
            onClick={() => setCredentialTab("PRODUCTION")}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              credentialTab === "PRODUCTION" ? "border-brand-500 text-brand-600" : "border-transparent text-ink-500 hover:text-ink-700"
            }`}
          >
            Live keys
          </button>
        </div>

        {canEdit ? (
          <div className="mt-4 space-y-4">
            {credentialTab === "SANDBOX" ? (
              <>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
                    Stripe secret key (test){" "}
                    {settings?.stripeSecretKeyTestSet && <span className="text-emerald-600">(configured)</span>}
                  </label>
                  <input
                    type="password"
                    value={stripeSecretKeyTestInput}
                    onChange={(e) => setStripeSecretKeyTestInput(e.target.value)}
                    placeholder={settings?.stripeSecretKeyTestSet ? "•••••••••••••••• (leave blank to keep)" : "sk_test_..."}
                    className="mt-1 w-full rounded-md border border-ink-100 px-3 py-2 text-sm font-mono outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
                    Stripe webhook secret (test){" "}
                    {settings?.stripeWebhookSecretTestSet && <span className="text-emerald-600">(configured)</span>}
                  </label>
                  <input
                    type="password"
                    value={stripeWebhookSecretTestInput}
                    onChange={(e) => setStripeWebhookSecretTestInput(e.target.value)}
                    placeholder={settings?.stripeWebhookSecretTestSet ? "•••••••••••••••• (leave blank to keep)" : "whsec_..."}
                    className="mt-1 w-full rounded-md border border-ink-100 px-3 py-2 text-sm font-mono outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
                    EasyPost API key (test){" "}
                    {settings?.easypostApiKeyTestSet && <span className="text-emerald-600">(configured)</span>}
                  </label>
                  <p className="mt-1 text-xs text-ink-400">
                    Powers live shipment tracking on Deliveries. Free test key from{" "}
                    <a href="https://www.easypost.com/" target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                      easypost.com
                    </a>{" "}
                    — dashboard → API Keys → Test API Key.
                  </p>
                  <input
                    type="password"
                    value={easypostApiKeyTestInput}
                    onChange={(e) => setEasypostApiKeyTestInput(e.target.value)}
                    placeholder={settings?.easypostApiKeyTestSet ? "•••••••••••••••• (leave blank to keep)" : "EZTK..."}
                    className="mt-1 w-full rounded-md border border-ink-100 px-3 py-2 text-sm font-mono outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
                    Stripe secret key (live){" "}
                    {settings?.stripeSecretKeyLiveSet && <span className="text-emerald-600">(configured)</span>}
                  </label>
                  <input
                    type="password"
                    value={stripeSecretKeyLiveInput}
                    onChange={(e) => setStripeSecretKeyLiveInput(e.target.value)}
                    placeholder={settings?.stripeSecretKeyLiveSet ? "•••••••••••••••• (leave blank to keep)" : "sk_live_..."}
                    className="mt-1 w-full rounded-md border border-ink-100 px-3 py-2 text-sm font-mono outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
                    Stripe webhook secret (live){" "}
                    {settings?.stripeWebhookSecretLiveSet && <span className="text-emerald-600">(configured)</span>}
                  </label>
                  <input
                    type="password"
                    value={stripeWebhookSecretLiveInput}
                    onChange={(e) => setStripeWebhookSecretLiveInput(e.target.value)}
                    placeholder={settings?.stripeWebhookSecretLiveSet ? "•••••••••••••••• (leave blank to keep)" : "whsec_..."}
                    className="mt-1 w-full rounded-md border border-ink-100 px-3 py-2 text-sm font-mono outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
                    EasyPost API key (live){" "}
                    {settings?.easypostApiKeyLiveSet && <span className="text-emerald-600">(configured)</span>}
                  </label>
                  <input
                    type="password"
                    value={easypostApiKeyLiveInput}
                    onChange={(e) => setEasypostApiKeyLiveInput(e.target.value)}
                    placeholder={settings?.easypostApiKeyLiveSet ? "•••••••••••••••• (leave blank to keep)" : "EZAK..."}
                    className="mt-1 w-full rounded-md border border-ink-100 px-3 py-2 text-sm font-mono outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </>
            )}

            {credentialsError && <p className="text-sm text-brand-600">{credentialsError}</p>}
            {credentialsSaved && !credentialsError && <p className="text-sm text-emerald-600">Saved.</p>}

            <button
              onClick={handleSaveCredentials}
              disabled={credentialsSaving}
              className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {credentialsSaving ? "Saving..." : `Save ${credentialTab === "SANDBOX" ? "sandbox" : "live"} keys`}
            </button>
          </div>
        ) : (
          <p className="mt-4 text-xs text-ink-400">Only Admin users can change API credentials.</p>
        )}
      </div>

      <div className="mt-6 max-w-xl rounded-xl border border-ink-100 bg-white p-6">
        <p className="text-sm font-medium text-ink-900">Shipping &amp; carriers</p>
        <p className="mt-1 text-xs text-ink-400">
          A carrier is auto-assigned to every order at checkout based on the shipping country, using the rules
          below. Staff can still override the carrier per-order from Deliveries before shipping.
        </p>

        <div className="mt-4">
          <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
            Default carrier
          </label>
          <p className="mt-1 text-xs text-ink-400">Used when a country has no matching rule below.</p>
          <select
            value={settings?.defaultCarrier ?? "USPS"}
            onChange={(e) => canEdit && handleDefaultCarrierChange(e.target.value)}
            disabled={!canEdit || defaultCarrierSaving}
            className="mt-2 w-40 rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50"
          >
            {CARRIER_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 border-t border-ink-100 pt-5">
          <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
            Country rules
          </label>

          {rulesLoading ? (
            <p className="mt-2 text-sm text-ink-500">Loading...</p>
          ) : carrierRules.length === 0 ? (
            <p className="mt-2 text-sm text-ink-400">No country-specific rules yet — every order uses the default carrier.</p>
          ) : (
            <table className="mt-3 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                  <th className="py-2 font-medium">Country</th>
                  <th className="py-2 font-medium">Carrier</th>
                  {canEdit && <th className="py-2 font-medium"></th>}
                </tr>
              </thead>
              <tbody>
                {carrierRules.map((rule) => (
                  <tr key={rule.id} className="border-b border-ink-100 last:border-0">
                    <td className="py-2 font-mono text-ink-900">{rule.country}</td>
                    <td className="py-2 text-ink-700">{rule.carrier}</td>
                    {canEdit && (
                      <td className="py-2 text-right">
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="text-xs font-medium text-brand-600 hover:underline"
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {canEdit && (
            <div className="mt-4 flex items-end gap-2">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">Country</label>
                <select
                  value={ruleCountry}
                  onChange={(e) => setRuleCountry(e.target.value)}
                  className="mt-1 w-44 rounded-md border border-ink-100 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">Carrier</label>
                <select
                  value={ruleCarrier}
                  onChange={(e) => setRuleCarrier(e.target.value)}
                  className="mt-1 rounded-md border border-ink-100 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                >
                  {CARRIER_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAddRule}
                disabled={ruleSaving}
                className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {ruleSaving ? "Saving..." : "Add rule"}
              </button>
            </div>
          )}
          {ruleError && <p className="mt-3 text-sm text-brand-600">{ruleError}</p>}
        </div>
      </div>

      <div className="mt-6 max-w-xl rounded-xl border border-ink-100 bg-white p-6">
        <p className="text-sm font-medium text-ink-900">Accepted payment methods by country</p>
        <p className="mt-1 text-xs text-ink-400">
          Restrict which payment methods checkout accepts for a given shipping country (e.g. only Bank/PayPal where
          card processing isn&apos;t set up). A country with no rule accepts every payment method.
        </p>

        {paymentRulesLoading ? (
          <p className="mt-4 text-sm text-ink-500">Loading...</p>
        ) : Object.keys(paymentRulesByCountry).length === 0 ? (
          <p className="mt-4 text-sm text-ink-400">No restrictions yet — every country accepts all payment methods.</p>
        ) : (
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                <th className="py-2 font-medium">Country</th>
                <th className="py-2 font-medium">Accepted methods</th>
                {canEdit && <th className="py-2 font-medium"></th>}
              </tr>
            </thead>
            <tbody>
              {Object.entries(paymentRulesByCountry).map(([country, methods]) => (
                <tr key={country} className="border-b border-ink-100 last:border-0">
                  <td className="py-2 font-mono text-ink-900">{country}</td>
                  <td className="py-2 text-ink-700">
                    {methods
                      .map((m) => PAYMENT_METHOD_OPTIONS.find((o) => o.value === m)?.label ?? m)
                      .join(", ")}
                  </td>
                  {canEdit && (
                    <td className="py-2 text-right">
                      <button
                        onClick={() => handleRemovePaymentRule(country)}
                        className="text-xs font-medium text-brand-600 hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {canEdit && (
          <div className="mt-4 border-t border-ink-100 pt-4">
            <div className="flex items-end gap-2">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">Country</label>
                <select
                  value={paymentRuleCountry}
                  onChange={(e) => setPaymentRuleCountry(e.target.value)}
                  className="mt-1 w-44 rounded-md border border-ink-100 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              {PAYMENT_METHOD_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-1.5 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    checked={paymentRuleMethods.includes(opt.value)}
                    onChange={() => toggleRuleMethod(opt.value)}
                    className="h-4 w-4"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <button
              onClick={handleAddPaymentRule}
              disabled={paymentRuleSaving}
              className="mt-3 rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {paymentRuleSaving ? "Saving..." : "Save rule"}
            </button>
          </div>
        )}
        {paymentRuleError && <p className="mt-3 text-sm text-brand-600">{paymentRuleError}</p>}
      </div>

      <div className="mt-6 max-w-xl rounded-xl border border-ink-100 bg-white p-6">
        <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">Tax rules</label>
        <p className="mt-1 text-xs text-ink-400">
          Flat sales-tax rate applied per shipping country at checkout. A country with no rule here has no tax.
        </p>

        {taxRulesLoading ? (
          <p className="mt-2 text-sm text-ink-500">Loading...</p>
        ) : taxRules.length === 0 ? (
          <p className="mt-2 text-sm text-ink-400">No tax rules yet — every order is untaxed.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                <th className="py-2 font-medium">Country</th>
                <th className="py-2 font-medium">Rate</th>
                {canEdit && <th className="py-2 font-medium"></th>}
              </tr>
            </thead>
            <tbody>
              {taxRules.map((rule) => (
                <tr key={rule.id} className="border-b border-ink-100 last:border-0">
                  <td className="py-2 font-mono text-ink-900">{rule.country}</td>
                  <td className="py-2 text-ink-700">{Number(rule.ratePercent)}%</td>
                  {canEdit && (
                    <td className="py-2 text-right">
                      <button
                        onClick={() => handleDeleteTaxRule(rule.id)}
                        className="text-xs font-medium text-brand-600 hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {canEdit && (
          <div className="mt-4 flex items-end gap-2 border-t border-ink-100 pt-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">Country</label>
              <select
                value={taxRuleCountry}
                onChange={(e) => setTaxRuleCountry(e.target.value)}
                className="mt-1 w-44 rounded-md border border-ink-100 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">Rate (%)</label>
              <input
                type="number"
                value={taxRuleRate}
                onChange={(e) => setTaxRuleRate(e.target.value)}
                min={0}
                max={100}
                step={0.01}
                placeholder="e.g. 8.5"
                className="mt-1 w-28 rounded-md border border-ink-100 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <button
              onClick={handleAddTaxRule}
              disabled={taxRuleSaving}
              className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {taxRuleSaving ? "Saving..." : "Save rule"}
            </button>
          </div>
        )}
        {taxRuleError && <p className="mt-3 text-sm text-brand-600">{taxRuleError}</p>}
      </div>

      {canEdit && (
        <div className="mt-6 max-w-xl rounded-xl border border-brand-200 bg-brand-50/40 p-6">
          <p className="text-sm font-medium text-brand-700">Danger Zone</p>
          <p className="mt-1 text-xs text-ink-500">
            These actions affect customers, orders, and the product catalog only — admin accounts, your login, and
            the settings on this page (store name, logo, partial refunds) are never touched.
          </p>

          <div className="mt-5 flex items-start justify-between gap-4 border-t border-brand-100 pt-5">
            <div>
              <p className="text-sm font-medium text-ink-900">Clear all data</p>
              <p className="mt-1 text-xs text-ink-400">
                Permanently deletes every customer, order, and catalog product/category, resetting their counts to
                zero. Tables and fields stay as they are — only the rows are removed.
              </p>
            </div>
            <button
              onClick={() => openResetConfirm("clear")}
              className="shrink-0 rounded-md border border-brand-200 px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50"
            >
              Clear data
            </button>
          </div>

          <div className="mt-5 flex items-start justify-between gap-4 border-t border-brand-100 pt-5">
            <div>
              <p className="text-sm font-medium text-ink-900">Reset seed data</p>
              <p className="mt-1 text-xs text-ink-400">
                Clears all data the same way, then reloads the full demo dataset — customers, catalog, and a year of
                sample orders — so the admin panel looks like an active store again.
              </p>
            </div>
            <button
              onClick={() => openResetConfirm("seed")}
              className="shrink-0 rounded-md border border-brand-200 px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50"
            >
              Reset seed data
            </button>
          </div>

          {resetResult && <p className="mt-5 text-xs text-emerald-600">{resetResult}</p>}
        </div>
      )}

      {pendingReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <p className="text-sm font-semibold text-ink-900">
              {pendingReset === "clear" ? "Clear all data?" : "Reset seed data?"}
            </p>
            <p className="mt-2 text-sm text-ink-600">
              {pendingReset === "clear"
                ? "This permanently deletes every customer, order, and catalog product. This can't be undone."
                : "This permanently deletes every customer, order, and catalog product, then reloads the full demo dataset. This can't be undone."}
            </p>
            <p className="mt-3 text-xs text-ink-500">
              Type <span className="font-mono font-semibold text-ink-900">RESET</span> to confirm.
            </p>
            <input
              autoFocus
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              disabled={resetRunning}
              placeholder="RESET"
              className="mt-2 w-full rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50"
            />
            {resetError && <p className="mt-3 text-sm text-brand-600">{resetError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={closeResetConfirm}
                disabled={resetRunning}
                className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReset}
                disabled={resetConfirmText !== "RESET" || resetRunning}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {resetRunning
                  ? "Working..."
                  : pendingReset === "clear"
                    ? "Clear all data"
                    : "Reset seed data"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
