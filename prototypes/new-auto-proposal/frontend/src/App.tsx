import { useState, useEffect } from "react";
import {
  fetchCompanies,
  fetchCompany,
  updateCompanyProfile,
  importCompanySettings,
  resetCompany,
  submitBriefing,
  unlockBriefing,
} from "./services/api";
import type { Company, CompanySummary } from "./types/company";
import { CompanyProfileCard } from "./components/CompanyProfileCard";
import { DevDock } from "./components/DevDock";
import { Button } from "./components/ui/button";
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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmittingBriefing, setIsSubmittingBriefing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (activeCompanyId) {
      loadCompanyDetails(activeCompanyId);
    }
  }, [activeCompanyId]);

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

  const loadCompanyDetails = async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchCompany(id);
      setCurrentCompany(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to load details for ${id}`);
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleImportSettings = async () => {
    if (!currentCompany) return;
    try {
      const reseeded = await importCompanySettings(currentCompany.company_id);
      setCurrentCompany(reseeded);
      setNotification({
        type: "success",
        message: `Settings & spec imported for ${reseeded.company_name}.`,
      });
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
      setNotification({
        type: "info",
        message: `Reset ${reset.company_name} to default.`,
      });
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
    <div className="min-h-screen bg-zinc-50/70 dark:bg-zinc-950 text-foreground antialiased selection:bg-primary/20">
      {/* Sleek Minimalist Header */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs">
                <Workflow className="size-4" />
              </div>
              <span className="font-semibold text-sm tracking-tight">Auto-Proposal</span>
            </div>

            {/* Centered Segmented Tab Switcher */}
            <nav className="flex items-center rounded-lg bg-muted/60 p-0.5 border border-border/40 text-xs">
              {companies.map((c: CompanySummary) => {
                const isActive = c.company_id === activeCompanyId;
                return (
                  <button
                    key={c.company_id}
                    onClick={() => setActiveCompanyId(c.company_id)}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all select-none ${
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
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-2 py-0.5 rounded-full bg-secondary/50">
                <span className="size-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                <span className="hidden sm:inline">SQLite Synced</span>
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
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
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
            onResetDefault={handleResetDefault}
            onSubmitBriefing={handleBriefingSubmit}
            onUnlockBriefing={handleBriefingUnlock}
          />
        ) : null}
      </main>

      {/* Bottom Developer Dock HUD */}
      <DevDock company={currentCompany} />
    </div>
  );
}

export default App;
