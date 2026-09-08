import { useState, useEffect } from "react";
import {
  fetchCompanies,
  fetchCompany,
  updateCompanyProfile,
  importCompanySettings,
  resetCompany,
} from "./services/api";
import type { Company, CompanySummary } from "./types/company";
import { CompanyProfileCard } from "./components/CompanyProfileCard";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { useTheme } from "./components/theme-provider";
import {
  Sun,
  Moon,
  Database,
  Building2,
  FileText,
  Workflow,
  Sparkles,
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
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Auto-dismiss notification after 4 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Initial load of company tabs
  useEffect(() => {
    loadCompanies();
  }, []);

  // Fetch company details whenever active tab changes
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
        message: `Saved pricing spec for ${updated.company_name} to SQLite database.`,
      });
    } catch (err) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save pricing spec",
      });
      throw err;
    }
  };

  const handleImportSettings = async () => {
    if (!currentCompany) return;
    try {
      const reseeded = await importCompanySettings(currentCompany.company_id);
      setCurrentCompany(reseeded);
      setNotification({
        type: "success",
        message: `Imported preset settings & spec for ${reseeded.company_name}.`,
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
        message: `Reset ${reset.company_name} to pristine default from mock dataset.`,
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
    <div className="min-h-screen bg-background text-foreground transition-colors">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                <Workflow className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base tracking-tight">Auto-Proposal</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">
                    v0.1 Prototype
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Zero-Config Inbound Quotation & Proposal Engine
                </p>
              </div>
            </div>

            {/* Right Header Status & Controls */}
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/60 px-2.5 py-1 rounded-full border border-border/40">
                <Database className="size-3 text-emerald-500" />
                <span>SQLite Active</span>
                <span className="text-[10px] text-muted-foreground/60">(WAL Mode)</span>
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={toggleTheme}
                className="size-8 rounded-lg"
                title="Toggle Dark/Light Mode"
              >
                {theme === "dark" ? (
                  <Sun className="size-4 text-amber-400" />
                ) : (
                  <Moon className="size-4 text-zinc-600" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Prototype Macro Pipeline Stages */}
        <div className="rounded-xl border border-border/60 bg-card/40 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary" />
              Prototype Pipeline Progress
            </span>
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              Phase 1 Active
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/30 text-primary font-medium flex items-center gap-2">
              <Building2 className="size-3.5 shrink-0" />
              <span>1. Multi-Company Shell</span>
            </div>
            <div className="p-2.5 rounded-lg bg-secondary/30 border border-border/40 text-muted-foreground flex items-center gap-2">
              <FileText className="size-3.5 shrink-0" />
              <span>2. Word Doc Ingestion</span>
            </div>
            <div className="p-2.5 rounded-lg bg-secondary/30 border border-border/40 text-muted-foreground flex items-center gap-2">
              <Workflow className="size-3.5 shrink-0" />
              <span>3. Template Mutation</span>
            </div>
            <div className="p-2.5 rounded-lg bg-secondary/30 border border-border/40 text-muted-foreground flex items-center gap-2">
              <Database className="size-3.5 shrink-0" />
              <span>4. Pricing Compiler</span>
            </div>
            <div className="p-2.5 rounded-lg bg-secondary/30 border border-border/40 text-muted-foreground flex items-center gap-2">
              <Sparkles className="size-3.5 shrink-0" />
              <span>5. Lead Simulator</span>
            </div>
          </div>
        </div>

        {/* Global Notification Toast */}
        {notification && (
          <div
            className={`p-3.5 rounded-xl border text-sm flex items-center justify-between transition-all animate-in fade-in slide-in-from-top-2 ${
              notification.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                : notification.type === "error"
                ? "bg-destructive/10 border-destructive/20 text-destructive"
                : "bg-primary/10 border-primary/20 text-primary"
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === "success" ? (
                <CheckCircle2 className="size-4 shrink-0" />
              ) : (
                <AlertCircle className="size-4 shrink-0" />
              )}
              <span>{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-xs opacity-70 hover:opacity-100 ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Company Switcher Tabs */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Company Testing Harness</h1>
              <p className="text-xs text-muted-foreground">
                Switch between mock business profiles to test different service and pricing models.
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-2 p-1.5 rounded-xl bg-secondary/50 border border-border/60">
            {companies.map((c) => {
              const isActive = c.company_id === activeCompanyId;
              return (
                <button
                  key={c.company_id}
                  onClick={() => setActiveCompanyId(c.company_id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all select-none ${
                    isActive
                      ? "bg-card text-foreground shadow-xs border border-border/80 ring-1 ring-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <Building2 className={`size-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  <span>{c.company_name}</span>
                  <Badge
                    variant={isActive ? "default" : "secondary"}
                    className="text-[10px] px-1 py-0"
                  >
                    {c.company_id.split("_")[1]?.toUpperCase() || c.company_id}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>

        {/* Loading / Error States */}
        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
            <AlertCircle className="size-8 text-destructive mx-auto" />
            <div className="text-sm font-medium text-destructive">{error}</div>
            <p className="text-xs text-muted-foreground">
              Make sure the backend server is running at http://localhost:3001
            </p>
            <Button size="sm" variant="outline" onClick={loadCompanies}>
              <RefreshCw className="size-3.5 mr-1.5" />
              Retry Connection
            </Button>
          </div>
        ) : isLoading && !currentCompany ? (
          <div className="rounded-xl border border-border/50 bg-card/40 p-12 text-center text-muted-foreground space-y-2">
            <RefreshCw className="size-6 animate-spin mx-auto text-primary" />
            <p className="text-sm">Loading company profile...</p>
          </div>
        ) : currentCompany ? (
          <CompanyProfileCard
            company={currentCompany}
            isLoading={isLoading}
            onSaveSpec={handleSaveSpec}
            onImportSettings={handleImportSettings}
            onResetDefault={handleResetDefault}
          />
        ) : null}
      </main>
    </div>
  );
}

export default App;
