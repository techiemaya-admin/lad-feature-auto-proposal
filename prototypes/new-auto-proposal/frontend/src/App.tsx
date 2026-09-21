import { useState, useEffect } from "react";
import {
  fetchCompanies,
  fetchCompany,
  updateCompanyProfile,
  importCompanySettings,
  resetCompany,
  submitBriefing,
  unlockBriefing,
  generateTemplate,
  fetchTemplateStatus,
  compilePricingRules,
  proceedToLeadSimulation,
  fetchAISettings,
  updateAISettings,
  fetchConfiguration,
  type AISettings,
  type CompanyConfiguration,
} from "./services/api";
import type { Company, CompanySummary } from "./types/company";
import type { CompanyVariable, CompoundTable } from "./types/variable";
import type { TemplateStats } from "./types/template";
import type { PricingRulesState } from "./types/pricing";
import type { RulesStatus } from "./components/pricing/PricingEngineDeck";
import { CompanyProfileCard } from "./components/CompanyProfileCard";
import { DevDock } from "./components/DevDock";
import { ConfigurationSheet } from "./components/ConfigurationSheet";
import { Button } from "./components/ui/button";
import { CustomDropdown } from "./components/ui/custom-dropdown";
import { useTheme } from "./components/theme-provider";
import {
  Sun,
  Moon,
  Workflow,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

export function App() {
  const { theme, setTheme } = useTheme();
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string>("co1_seo");
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [activeVariables, setActiveVariables] = useState<CompanyVariable[]>([]);
  const [activeCompoundTables, setActiveCompoundTables] = useState<CompoundTable[]>([]);
  const [templateStats, setTemplateStats] = useState<TemplateStats | null>(null);
  const [templateFilesize, setTemplateFilesize] = useState<number | null>(null);
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState<boolean>(false);
  const [pricingRules, setPricingRules] = useState<PricingRulesState | null>(null);
  const [rulesStatus, setRulesStatus] = useState<RulesStatus>({ status: "idle" });
  const [isProceeding, setIsProceeding] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmittingBriefing, setIsSubmittingBriefing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [aiSettings, setAiSettings] = useState<AISettings | null>(null);
  const [aiModels, setAiModels] = useState<Record<string, string[]>>({});
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  // Only the inbox status is read here (drives the strip CTA); the sheet owns editing.
  const [configuration, setConfiguration] = useState<CompanyConfiguration | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    fetchAISettings()
      .then(({ settings, models }) => {
        setAiSettings(settings);
        setAiModels(models);
      })
      .catch((err) => console.error("Failed to load AI settings", err));
  }, []);

  // value is "<provider>::<model>" — one option per provider+model combo
  const handleAIOptionChange = async (value: string) => {
    const [provider, model] = value.split("::");
    try {
      const settings = await updateAISettings({ provider: provider as AISettings["provider"], model });
      setAiSettings(settings);
      setNotification({ type: "info", message: `AI switched to ${settings.provider} · ${settings.model}` });
    } catch (err) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to switch AI provider/model",
      });
    }
  };

  const loadCompanies = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const list = await fetchCompanies();
      setCompanies(list);
      if (list.length > 0 && !list.some((c) => c.company_id === activeCompanyId)) {
        setActiveCompanyId(list[0].company_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to backend server");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    fetchCompanies()
      .then((list) => {
        if (!ignore) {
          setCompanies(list);
          if (list.length > 0 && !list.some((c) => c.company_id === activeCompanyId)) {
            setActiveCompanyId(list[0].company_id);
          }
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to connect to backend server");
          setIsLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!activeCompanyId) return;
    let ignore = false;
    setActiveVariables([]);
    setActiveCompoundTables([]);
    setTemplateStats(null);
    setTemplateFilesize(null);
    setPricingRules(null);
    setRulesStatus({ status: "idle" });

    fetchCompany(activeCompanyId)
      .then((data) => {
        if (!ignore) {
          setCurrentCompany(data);
          setPricingRules(data.working_state?.pricing_rules ?? null);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : `Failed to load details for ${activeCompanyId}`);
          setIsLoading(false);
        }
      });

    setConfiguration(null);
    fetchConfiguration(activeCompanyId)
      .then((config) => { if (!ignore) setConfiguration(config); })
      .catch(() => { if (!ignore) setConfiguration(null); });

    // Check template status
    fetchTemplateStatus(activeCompanyId)
      .then((res) => {
        if (!ignore) {
          if (res.exists && res.stats) {
            setTemplateStats(res.stats);
            setTemplateFilesize(res.filesize);
          } else {
            setTemplateStats(null);
            setTemplateFilesize(null);
          }
        }
      })
      .catch(() => {
        if (!ignore) {
          setTemplateStats(null);
          setTemplateFilesize(null);
        }
      });

    return () => {
      ignore = true;
    };
  }, [activeCompanyId]);

  const handleSaveSpec = async (newSpec: string) => {
    if (!currentCompany) return;
    try {
      const updated = await updateCompanyProfile(currentCompany.company_id, {
        pricing_spec: newSpec,
      });
      setCurrentCompany(updated);
      setNotification({
        type: "success",
        message: `Pricing spec saved for ${updated.company_name}.`,
      });
    } catch (err) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save pricing spec",
      });
      throw err;
    }
  };

  const handleBriefingSubmit = async (prompt: string, file: File | null) => {
    if (!currentCompany) return;
    setIsSubmittingBriefing(true);
    try {
      const result = await submitBriefing(currentCompany.company_id, prompt, file);
      setCurrentCompany(result.company);
      setNotification({
        type: "success",
        message: `Quotation parsed via AnyDoc and briefing locked for ${result.company.company_name}.`,
      });
      setCompanies((prev: CompanySummary[]) =>
        prev.map((c: CompanySummary) =>
          c.company_id === result.company.company_id
            ? {
                ...c,
                pricing_spec: result.company.pricing_spec,
                briefing_locked: result.company.briefing_locked,
                quotation_filename: result.company.document_metadata?.filename,
              }
            : c
        )
      );
    } catch (err) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to submit briefing",
      });
      throw err;
    } finally {
      setIsSubmittingBriefing(false);
    }
  };

  const handleBriefingUnlock = async () => {
    if (!currentCompany) return;
    try {
      const updated = await unlockBriefing(currentCompany.company_id);
      setCurrentCompany(updated);
      setActiveVariables([]);
      setActiveCompoundTables([]);
      setTemplateStats(null);
      setTemplateFilesize(null);
      setPricingRules(null);
      setNotification({
        type: "info",
        message: `Briefing unlocked for ${updated.company_name}. Downstream state reset.`,
      });
      setCompanies((prev: CompanySummary[]) =>
        prev.map((c: CompanySummary) =>
          c.company_id === updated.company_id
            ? { ...c, briefing_locked: false }
            : c
        )
      );
    } catch (err) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to unlock briefing",
      });
    }
  };

  const handleVariablesChange = (vars: CompanyVariable[], tables: CompoundTable[]) => {
    setActiveVariables(vars);
    setActiveCompoundTables(tables);
  };

  // Any edit to a variable makes the generated template stale: drop it and stay on the deck
  const handleVariablesEdited = () => {
    if (!templateStats) return;
    setTemplateStats(null);
    setTemplateFilesize(null);
    setPricingRules(null);
    setNotification({ type: "info", message: "Variables changed. Generate the template again when you're done." });
  };

  const handleGenerateTemplate = async () => {
    if (!currentCompany) return;
    setIsGeneratingTemplate(true);
    try {
      const result = await generateTemplate(currentCompany.company_id);
      setTemplateStats(result);
      setPricingRules(null); // a new template resets Stage 4
      setRulesStatus({ status: "idle" });

      const status = await fetchTemplateStatus(currentCompany.company_id).catch(() => null);
      if (status) {
        setTemplateFilesize(status.filesize);
      }

      setNotification({
        type: "success",
        message: `Template ready for ${currentCompany.company_name}.`,
      });
    } catch (err) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to generate template",
      });
    } finally {
      setIsGeneratingTemplate(false);
    }
  };

  // Stage 3 → 4: compile the rules (the model writes the sheet, the calculator checks it)
  const handleProceedToPricing = async () => {
    if (!currentCompany) return;
    setRulesStatus({ status: "compiling" });
    try {
      const state = await compilePricingRules(currentCompany.company_id);
      setPricingRules(state);
      setRulesStatus({ status: "idle" });
      const toCheck = state.sample_check.filter((c) => !c.ok).length + state.validation_errors.length;
      setNotification({
        type: toCheck ? "info" : "success",
        message: toCheck
          ? `Pricing rules compiled — ${toCheck} ${toCheck === 1 ? "value" : "values"} to check.`
          : `Pricing rules match ${currentCompany.company_name}'s quotation.`,
      });
    } catch (err) {
      setRulesStatus({ status: "error", message: err instanceof Error ? err.message : "Failed to compile pricing rules" });
    }
  };

  const handleProceedToLeadSimulation = async () => {
    if (!currentCompany) return;
    setIsProceeding(true);
    try {
      const updated = await proceedToLeadSimulation(currentCompany.company_id);
      setCurrentCompany(updated);
      setNotification({ type: "success", message: `Rules confirmed for ${updated.company_name}. Ready for Stage 5: Check & Generate Proposal.` });
    } catch (err) {
      setNotification({ type: "error", message: err instanceof Error ? err.message : "Failed to proceed" });
    } finally {
      setIsProceeding(false);
    }
  };

  const handleImportSettings = async () => {
    if (!currentCompany) return;
    try {
      const reseeded = await importCompanySettings(currentCompany.company_id);
      setCurrentCompany(reseeded);
      setActiveVariables([]);
      setActiveCompoundTables([]);
      setTemplateStats(null);
      setTemplateFilesize(null);
      setPricingRules(null);
      setNotification({
        type: "success",
        message: `Settings & spec imported for ${reseeded.company_name}.`,
      });
      setCompanies((prev: CompanySummary[]) =>
        prev.map((c: CompanySummary) =>
          c.company_id === reseeded.company_id
            ? {
                ...c,
                pricing_spec: reseeded.pricing_spec,
                briefing_locked: false,
                quotation_filename: undefined,
              }
            : c
        )
      );
    } catch (err) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to import settings",
      });
    }
  };

  const handleResetDefault = async () => {
    if (!currentCompany) return;
    try {
      const reset = await resetCompany(currentCompany.company_id);
      setCurrentCompany(reset);
      setActiveVariables([]);
      setActiveCompoundTables([]);
      setTemplateStats(null);
      setTemplateFilesize(null);
      setPricingRules(null);
      setNotification({
        type: "info",
        message: `Reset ${reset.company_name} to default.`,
      });
      setCompanies((prev: CompanySummary[]) =>
        prev.map((c: CompanySummary) =>
          c.company_id === reset.company_id
            ? {
                ...c,
                pricing_spec: reset.pricing_spec,
                briefing_locked: false,
                quotation_filename: undefined,
              }
            : c
        )
      );
    } catch (err) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to reset company",
      });
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div className="min-h-screen bg-zinc-100/70 dark:bg-zinc-950 text-foreground antialiased selection:bg-primary/20">
      {/* Sleek Minimalist Header */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs">
                <Workflow className="size-4" />
              </div>
              <span className="font-semibold text-sm tracking-tight whitespace-nowrap">Auto-Proposal</span>
            </div>

            {/* Centered Segmented Tab Switcher */}
            <nav className="flex items-center rounded-lg bg-muted/60 p-0.5 border border-border/40 text-xs">
              {companies.map((c: CompanySummary) => {
                const isActive = c.company_id === activeCompanyId;
                return (
                  <button
                    key={c.company_id}
                    onClick={() => setActiveCompanyId(c.company_id)}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all select-none whitespace-nowrap ${
                      isActive
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c.company_name}
                  </button>
                );
              })}
            </nav>

            {/* Right Controls */}
            <div className="flex items-center gap-2">
              {aiSettings && (
                <CustomDropdown
                  size="xs"
                  menuAlign="right"
                  className="hidden md:inline-flex max-w-32"
                  value={`${aiSettings.provider}::${aiSettings.model}`}
                  onChange={handleAIOptionChange}
                  options={(["gemini", "deepseek"] as const).flatMap((provider) =>
                    (aiModels[provider] || []).map((model) => ({
                      value: `${provider}::${model}`,
                      label: `${provider === "gemini" ? "Gemini" : "DeepSeek"} · ${model}`,
                    }))
                  )}
                />
              )}

              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-2 py-0.5 rounded-full bg-secondary/50">
                <span className="size-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                <span className="hidden xl:inline whitespace-nowrap">SQLite Synced</span>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="size-7 rounded-md text-muted-foreground hover:text-foreground"
                title="Toggle Theme"
              >
                {theme === "dark" ? (
                  <Sun className="size-3.5 text-amber-400" />
                ) : (
                  <Moon className="size-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="mx-auto max-w-4xl px-4 pt-3 pb-8 sm:px-6 sm:pt-4 space-y-5">
        {/* Floating Notification */}
        {notification && (
          <div
            className={`px-4 py-2.5 rounded-lg border text-xs flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-1 ${
              notification.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                : notification.type === "error"
                ? "bg-destructive/10 border-destructive/20 text-destructive"
                : "bg-secondary border-border text-foreground"
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === "success" ? (
                <CheckCircle2 className="size-3.5 shrink-0" />
              ) : (
                <AlertCircle className="size-3.5 shrink-0" />
              )}
              <span>{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-muted-foreground hover:text-foreground ml-3 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Content Area */}
        {error ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button size="sm" variant="outline" onClick={loadCompanies}>
              <RefreshCw className="size-3.5 mr-1.5" />
              Retry
            </Button>
          </div>
        ) : isLoading && !currentCompany ? (
          <div className="py-20 text-center text-muted-foreground space-y-2">
            <RefreshCw className="size-5 animate-spin mx-auto text-primary" />
            <p className="text-xs">Loading profile...</p>
          </div>
        ) : currentCompany ? (
          <CompanyProfileCard
            company={currentCompany}
            isLoading={isLoading}
            isSubmittingBriefing={isSubmittingBriefing}
            onSaveSpec={handleSaveSpec}
            onImportSettings={handleImportSettings}
            onOpenSettings={() => setIsConfigOpen(true)}
            emailConnected={configuration?.email_connected ?? null}
            onResetDefault={handleResetDefault}
            onSubmitBriefing={handleBriefingSubmit}
            onUnlockBriefing={handleBriefingUnlock}
            onVariablesChange={handleVariablesChange}
            onVariablesEdited={handleVariablesEdited}
            onGenerateTemplate={handleGenerateTemplate}
            templateStats={templateStats}
            templateFilesize={templateFilesize}
            isGeneratingTemplate={isGeneratingTemplate}
            onProceedToPricing={handleProceedToPricing}
            pricingRules={pricingRules}
            rulesStatus={rulesStatus}
            onRulesChange={setPricingRules}
            onProceedToLeadSimulation={handleProceedToLeadSimulation}
            isProceeding={isProceeding}
            variables={activeVariables}
            compoundTables={activeCompoundTables}
          />
        ) : null}
      </main>

      {/* Ambient slide-over: per-company drafter preferences + mock inbox link */}
      {currentCompany && (
        <ConfigurationSheet
          open={isConfigOpen}
          onOpenChange={setIsConfigOpen}
          companyId={currentCompany.company_id}
          companyName={currentCompany.company_name}
          onNotify={setNotification}
          onConfigurationChange={setConfiguration}
        />
      )}

      {/* Bottom Developer Dock HUD */}
      <DevDock
        company={currentCompany}
        variables={activeVariables}
        compoundTables={activeCompoundTables}
        templateStats={templateStats}
        pricingRules={pricingRules}
        onRulesChange={setPricingRules}
      />
    </div>
  );
}

export default App;
