import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { LadSettingsHeader } from "./components/layout/LadSettingsHeader";
import { HeroBanner } from "./components/layout/HeroBanner";
import { StageStepper } from "./components/layout/StageStepper";
import { Stage1Briefing } from "./components/stages/Stage1Briefing";
import { Stage2VariableLedger } from "./components/stages/Stage2VariableLedger";
import { Stage3TemplateCheck } from "./components/stages/Stage3TemplateCheck";
import { Stage4PricingEngine, type RulesStatus } from "./components/stages/Stage4PricingEngine";
import { Stage5LeadSimulator } from "./components/stages/Stage5LeadSimulator";
import { BusinessProfileView } from "./components/settings/BusinessProfileView";
import { VoiceInboxView } from "./components/VoiceInboxView";
import { ConfigurationSheet } from "./components/ConfigurationSheet";
import { DevDock } from "./components/DevDock";
import { TemplateLibraryView } from "./components/templates/TemplateLibraryView";
import { Card } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { CustomDropdown } from "./components/ui/custom-dropdown";
import * as api from "./services/api";
import type { Company, CompanySummary } from "./types/company";
import type { CompanyVariable, CompoundTable } from "./types/variable";
import type { TemplateStats } from "./types/template";
import type { PricingRulesState } from "./types/pricing";
import type { InboundLeadSimulation, ProposalStage } from "./types/proposal";
import type { ProposalTemplateSummary, EmailRoutingResult } from "./services/api";
import {
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  FileText,
  Mail,
  Copy,
  Check,
  Layers,
  ArrowRight,
} from "lucide-react";

const profileText = (value: unknown): string => {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  return typeof value === "string" ? value.trim() : "";
};

function buildBriefingPrompt(company: Company): string {
  const basics = company.data?.company_basics || {};
  const details = company.data?.company_details || {};
  const customer = company.data?.ideal_customer || {};
  const offer = company.data?.offer || {};
  const pricingContext =
    company.data?.pricing_engine_spec?.pricing_context || company.pricing_spec;

  const lines = [
    `Build a deterministic proposal and pricing brief for ${company.company_name}.`,
    "Use the saved business profile and uploaded quotation as the only sources of truth.",
    "Extract every client-controlled input, pricing tier, add-on, discount, tax, payment term, and assumption.",
    "Preserve exact amounts and formulas from the quotation; do not invent missing rates or rules.",
    "Return clear variables and calculation rules that can be evaluated consistently in every proposal stage.",
    "",
    "Business profile:",
    `- Company: ${profileText(basics.company_name) || company.company_name}`,
    `- Location: ${profileText(basics.location) || profileText(company.location)}`,
    `- Industry: ${profileText(details.industry) || profileText(company.industry)}`,
    `- Value proposition: ${profileText(details.value_proposition)}`,
    `- Products and services: ${profileText(details.products_and_services)}`,
    `- Target customers: ${profileText(details.target_customers)}`,
    `- Ideal customer: ${profileText(customer.description)}`,
    `- Customer pain points: ${profileText(customer.pain_points)}`,
    `- Buyer segments: ${profileText(offer.buyer_segments)}`,
    `- Why buyers choose us: ${profileText(offer.why_buyers_pick_you)}`,
    `- Evidenced results: ${profileText(offer.evidenced_results)}`,
    `- Cost of doing nothing: ${profileText(offer.cost_of_doing_nothing)}`,
    `- Offer and guarantee: ${profileText(offer.guarantee_risk_reversal)}`,
    `- What happens after signing: ${profileText(offer.what_happens_after_they_sign)}`,
    "",
    "Saved pricing context:",
    pricingContext?.trim() || "No additional pricing context is saved; use the quotation document and preserve its explicit rules.",
  ];

  return lines.filter((line) => !line.startsWith("- ") || line.split(": ")[1]?.trim()).join("\n");
}

export interface TemplateWorkspaceProps {
  /** Optional controlled props when embedded or testing */
  activeCompanyId?: string;
  templateId?: string;
  templateControls?: ReactNode;
  onCompanyChange?: (companyId: string) => void;
}

export function App({
  activeCompanyId: controlledCompanyId,
  templateId: controlledTemplateId,
  templateControls,
  onCompanyChange: controlledOnCompanyChange,
}: TemplateWorkspaceProps = {}) {
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [localCompanyId, setLocalCompanyId] = useState<string>("");
  const activeCompanyId = controlledCompanyId ?? localCompanyId;
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);

  // Template state
  const [internalTemplateId, setInternalTemplateId] = useState<string>("");
  const templateId = controlledTemplateId !== undefined ? controlledTemplateId : internalTemplateId;

  const [templates, setTemplates] = useState<ProposalTemplateSummary[]>([]);
  const [routingEmail, setRoutingEmail] = useState<string>("");
  const [routingResult, setRoutingResult] = useState<EmailRoutingResult | null>(null);
  const [isRoutingBusy, setIsRoutingBusy] = useState<boolean>(false);
  const [isTemplatesBusy, setIsTemplatesBusy] = useState<boolean>(false);
  const [isTemplatesGenerating, setIsTemplatesGenerating] = useState<boolean>(false);
  const [copiedLead, setCopiedLead] = useState<boolean>(false);

  // Navigation tabs & AI models
  const [activeTab, setActiveTab] = useState<string>("proposals");
  const [currentStage, setCurrentStage] = useState<ProposalStage>(1);
  const [completedStages, setCompletedStages] = useState<ProposalStage[]>([]);
  const [isBriefingLocked, setIsBriefingLocked] = useState<boolean>(false);
  const [activeAiModel, setActiveAiModel] = useState<string>("deepseek-flash");
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const [isVoiceSettingsOpen, setIsVoiceSettingsOpen] = useState(false);
  const [voiceConfiguration, setVoiceConfiguration] = useState<api.CompanyConfiguration | null>(null);

  // Dynamic Pipeline States
  const [variables, setVariables] = useState<CompanyVariable[]>([]);
  const [compoundTables, setCompoundTables] = useState<CompoundTable[]>([]);
  const [templateStats, setTemplateStats] = useState<TemplateStats | null>(null);
  const [templateFilesize, setTemplateFilesize] = useState<number | null>(null);
  const [pricingRulesState, setPricingRulesState] = useState<PricingRulesState | null>(null);
  const [rulesStatus, setRulesStatus] = useState<RulesStatus>({ status: "idle" });

  const attentionTargets = useMemo(() => {
    const details = templateStats?.details ?? [];
    const tierMatrixApplied = details.some(
      (detail) => detail.applied && detail.action === "tag_tier_matrix"
    );
    const knownTargets = new Set([
      ...variables.flatMap((variable) => [variable.variable_name, variable.natural_name]),
      ...compoundTables.map((table) => table.loop_tag),
    ]);
    return details
      .filter((detail) => !detail.applied)
      .map((detail) => detail.target.replace(/[{}]/g, "").trim())
      .filter((target) => !(tierMatrixApplied && /_tier_rate$/i.test(target)))
      .filter((target) => knownTargets.has(target));
  }, [templateStats, variables, compoundTables]);

  // Async In-Flight Flags
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmittingBriefing, setIsSubmittingBriefing] = useState<boolean>(false);
  const [isExtractingVariables, setIsExtractingVariables] = useState<boolean>(false);
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState<boolean>(false);
  const [isProceeding, setIsProceeding] = useState<boolean>(false);

  const [leadSimulation, setLeadSimulation] = useState<InboundLeadSimulation | null>(null);

  // Notification Toast
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const showNotification = (type: "success" | "error" | "info", message: string) => {
    setNotification({ type, message });
  };

  const handleConfigurationNotify = useCallback(
    (next: { type: "success" | "error" | "info"; message: string }) => {
      setNotification(next);
    },
    []
  );

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const markStageComplete = (stage: ProposalStage) => {
    setCompletedStages((prev) => (prev.includes(stage) ? prev : [...prev, stage]));
  };

  // 1. Initial Load: Fetch Company list & AI settings
  useEffect(() => {
    api
      .fetchCompanies()
      .then((list) => {
        if (list && list.length > 0) {
          setCompanies(list);
          if (!controlledCompanyId && !list.some((c) => c.company_id === activeCompanyId)) {
            setLocalCompanyId(list[0].company_id);
          }
        } else {
          setCompanies([]);
          showNotification("error", "The backend returned no companies.");
        }
      })
      .catch((err) => {
        setCompanies([]);
        showNotification("error", err instanceof Error ? err.message : "Failed to load companies from the backend.");
      });

    api
      .fetchAISettings()
      .then((res) => {
        if (res.settings?.model) {
          setActiveAiModel(res.settings.model);
        }
      })
      .catch((err) => {
        showNotification("error", err instanceof Error ? err.message : "Failed to load AI settings from the backend.");
      });
  }, [activeCompanyId, controlledCompanyId]);

  // 2. Load Company and Template Data
  const loadCompanyData = useCallback(async (companyId: string, targetTplId?: string) => {
    setIsLoading(true);
    try {
      // Always load template library and mock routing email for this company
      const [tpls, emailText] = await Promise.all([
        api.listTemplates(companyId).catch(() => [] as ProposalTemplateSummary[]),
        api.fetchMockEmail(companyId).catch(() => null),
      ]);
      setTemplates(tpls);
      if (emailText) {
        setRoutingEmail(emailText.email);
        setRoutingResult(emailText);
      }

      // Load company or isolated template entity
      const comp: Company = targetTplId
        ? await api.fetchProposalTemplate(companyId, targetTplId)
        : await api.fetchCompany(companyId);
      setCurrentCompany(comp);
      setIsBriefingLocked(Boolean(comp.briefing_locked));

      if (targetTplId) {
        let varsData = await api.fetchVariables(companyId, targetTplId);
        if (
          comp.briefing_locked &&
          varsData.variables.length === 0 &&
          comp.document_metadata?.extracted_markdown
        ) {
          try {
            varsData = await api.extractVariables(companyId, targetTplId);
          } catch {
            // Keep the company view available
          }
        }
        setVariables(varsData.variables || []);
        setCompoundTables(varsData.compound_tables || []);

        let loadedTemplateStats: TemplateStats | null = null;
        try {
          const tStatus = await api.fetchTemplateStatus(companyId, targetTplId);
          if (tStatus.exists && tStatus.stats) {
            loadedTemplateStats = tStatus.stats;
            setTemplateStats(loadedTemplateStats);
            setTemplateFilesize(tStatus.filesize || null);
          } else {
            setTemplateStats(null);
            setTemplateFilesize(null);
          }
        } catch {
          setTemplateStats(null);
          setTemplateFilesize(null);
        }

        const pRules = comp.working_state?.pricing_rules
          ? await api.fetchPricingRules(companyId, targetTplId)
          : null;
        setPricingRulesState(pRules);

        // Calculate completed stages and restore active stage
        const completed: ProposalStage[] = [];
        const backendStage = comp.working_state?.stage;
        if (comp.briefing_locked) {
          completed.push(1);
          if (varsData.variables && varsData.variables.length > 0) {
            completed.push(2);
          }
        }
        if (loadedTemplateStats) completed.push(3);
        if (backendStage === "lead_simulation") completed.push(4);
        setCompletedStages(completed);

        const restoredStage: ProposalStage =
          backendStage === "lead_simulation"
            ? 5
            : backendStage === "pricing_engine" || pRules
            ? 4
            : loadedTemplateStats
            ? 3
            : varsData.variables.length > 0
            ? 2
            : 1;
        setCurrentStage(restoredStage);
      } else {
        // Landing library view - reset stage-specific states
        setVariables([]);
        setCompoundTables([]);
        setTemplateStats(null);
        setTemplateFilesize(null);
        setPricingRulesState(null);
        setCompletedStages([]);
        setCurrentStage(1);
      }

      const configuration = await api.fetchConfiguration(companyId).catch(() => null);
      setVoiceConfiguration(configuration);
      setLeadSimulation(null);
    } catch (err) {
      setCurrentCompany(null);
      setVariables([]);
      setCompoundTables([]);
      setTemplateStats(null);
      setTemplateFilesize(null);
      setPricingRulesState(null);
      setLeadSimulation(null);
      showNotification("error", err instanceof Error ? err.message : "Failed to load company data from backend.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeCompanyId) {
      void loadCompanyData(activeCompanyId, templateId);
    }
  }, [activeCompanyId, templateId, loadCompanyData]);

  // AI Model Selection
  const handleSelectAiModel = async (modelId: string) => {
    try {
      const provider = modelId.startsWith("gemini")
        ? "gemini"
        : modelId.startsWith("deepseek")
        ? "deepseek"
        : "gemini";
      await api.updateAISettings({ model: modelId, provider });
      setActiveAiModel(modelId);
      showNotification("success", `AI switched to ${provider} · ${modelId}`);
    } catch (err) {
      showNotification("error", err instanceof Error ? err.message : "Failed to save the AI engine setting.");
    }
  };

  // Tenant switcher from LadSettingsHeader
  const handleSelectCompany = (id: string) => {
    if (isTemplatesBusy || id === activeCompanyId) return;
    if (
      templateId &&
      !window.confirm(
        "Switch company? Saved work is kept. Unsaved edits in the current form will be discarded."
      )
    ) {
      return;
    }
    setInternalTemplateId("");
    if (controlledOnCompanyChange) {
      controlledOnCompanyChange(id);
    } else {
      setLocalCompanyId(id);
    }
    showNotification(
      "info",
      `Switched tenant to ${companies.find((c) => c.company_id === id)?.company_name || id}`
    );
  };

  // Template Navigation & Actions
  const handleSelectTemplate = (id: string) => {
    setInternalTemplateId(id);
    void loadCompanyData(activeCompanyId, id);
  };

  const handleBackToLibrary = () => {
    if (
      !window.confirm(
        "Return to templates? Saved work is kept. Unsaved edits will be discarded."
      )
    ) {
      return;
    }
    setInternalTemplateId("");
    void loadCompanyData(activeCompanyId, "");
  };

  const handleImportIcp = async () => {
    if (!activeCompanyId) return;
    setIsTemplatesBusy(true);
    setIsTemplatesGenerating(true);
    try {
      const generated = await api.importIcpTemplates(activeCompanyId);
      setTemplates(generated);
      showNotification("success", "Imported 3 proposal starting points from ICP data.");
    } catch (e) {
      showNotification("error", e instanceof Error ? e.message : "Could not import ICP data");
      try {
        setTemplates(await api.listTemplates(activeCompanyId));
      } catch {
        // retain state
      }
    } finally {
      setIsTemplatesBusy(false);
      setIsTemplatesGenerating(false);
    }
  };

  const handleSaveRoutingEmail = async (emailText: string) => {
    if (!activeCompanyId || !routingResult) return;
    setIsTemplatesBusy(true);
    try {
      const saved = await api.saveRoutingEmail(activeCompanyId, emailText, routingResult.version);
      setRoutingResult(saved);
      setRoutingEmail(saved.email);
      showNotification("success", "Inbound lead email saved.");
    } catch (e) {
      showNotification("error", e instanceof Error ? e.message : "Could not save email");
    } finally {
      setIsTemplatesBusy(false);
    }
  };

  const handleRouteEmail = async () => {
    if (!activeCompanyId || !routingResult) return;
    setIsTemplatesBusy(true);
    setIsRoutingBusy(true);
    try {
      if (routingEmail.trim() !== (routingResult.email ?? "")) {
        const saved = await api.saveRoutingEmail(activeCompanyId, routingEmail, routingResult.version);
        setRoutingResult(saved);
        setRoutingEmail(saved.email);
      }
      const routed = await api.routeMockEmail(activeCompanyId);
      setRoutingResult(routed);
      const matched = templates.find((t) => t.template_id === routed.template_id);
      if (matched) {
        showNotification("success", `AI matched email to template "${matched.name}".`);
      } else {
        showNotification("info", "AI evaluated email; review routing result.");
      }
    } catch (e) {
      showNotification("error", e instanceof Error ? e.message : "Routing failed");
    } finally {
      setIsTemplatesBusy(false);
      setIsRoutingBusy(false);
    }
  };

  const handleReassignEmail = async (assignedTplId: string) => {
    if (!activeCompanyId || !assignedTplId) return;
    setIsTemplatesBusy(true);
    try {
      const updated = await api.assignMockEmail(activeCompanyId, assignedTplId);
      setRoutingResult(updated);
      const matched = templates.find((t) => t.template_id === assignedTplId);
      showNotification("success", `Lead manually assigned to "${matched?.name || "template"}".`);
    } catch (e) {
      showNotification("error", e instanceof Error ? e.message : "Assignment failed");
    } finally {
      setIsTemplatesBusy(false);
    }
  };

  const handleCreateTemplate = async (name: string, description: string, brief: string) => {
    if (!activeCompanyId) return;
    setIsTemplatesBusy(true);
    try {
      const result = await api.createProposalTemplate(
        activeCompanyId,
        name.trim(),
        description.trim(),
        brief.trim()
      );
      const newTplId =
        result.template_id ||
        (result as unknown as { company?: { template_id?: string } })?.company?.template_id ||
        (result as unknown as { id?: string })?.id;

      const updatedList = await api.listTemplates(activeCompanyId);
      setTemplates(updatedList);
      showNotification("success", `Created template "${name}". Opening workspace...`);

      if (newTplId) {
        setInternalTemplateId(newTplId);
        setCurrentStage(1);
        await loadCompanyData(activeCompanyId, newTplId);
      }
    } catch (e) {
      showNotification("error", e instanceof Error ? e.message : "Could not save template");
      throw e;
    } finally {
      setIsTemplatesBusy(false);
    }
  };

  const handleDeleteTemplate = async (template: ProposalTemplateSummary) => {
    if (!activeCompanyId) return;
    if (
      !window.confirm(
        `Delete "${template.name}" and its saved documents, variables and pricing rules? This cannot be undone.`
      )
    ) {
      return;
    }
    setIsTemplatesBusy(true);
    try {
      await api.deleteProposalTemplate(activeCompanyId, template.template_id);
      const [updatedList, updatedRouting] = await Promise.all([
        api.listTemplates(activeCompanyId),
        api.fetchMockEmail(activeCompanyId),
      ]);
      setTemplates(updatedList);
      setRoutingResult(updatedRouting);
      showNotification("success", `Deleted template "${template.name}".`);
    } catch (e) {
      showNotification("error", e instanceof Error ? e.message : "Could not delete template");
    } finally {
      setIsTemplatesBusy(false);
    }
  };

  // -------------------------------------------------------------
  // Stage 1: Briefing Submit & Real Document Upload via AnyDoc
  // -------------------------------------------------------------
  const handleBriefingSubmit = async (prompt: string, file: File | null) => {
    if (!activeCompanyId) return;
    setIsSubmittingBriefing(true);

    try {
      const result = await api.submitBriefing(activeCompanyId, prompt, file, templateId);
      setCurrentCompany(result.company);
      setIsBriefingLocked(true);
      markStageComplete(1);

      setCompanies((prev) =>
        prev.map((c) =>
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

      showNotification(
        "success",
        `Quotation parsed via AnyDoc and briefing locked for ${result.company.company_name}.`
      );

      setCurrentStage(2);
      handleExtractVariables(activeCompanyId);
    } catch (err) {
      showNotification("error", err instanceof Error ? err.message : "Failed to save the briefing in the backend.");
    } finally {
      setIsSubmittingBriefing(false);
    }
  };

  const handleGeneratePrompt = () => {
    if (!currentCompany) return "";
    const prompt = buildBriefingPrompt(currentCompany);
    showNotification("success", "Prompt generated from the saved Business Profile.");
    return prompt;
  };

  const handleBriefingUnlock = async () => {
    if (!activeCompanyId) return;
    try {
      const updated = await api.unlockBriefing(activeCompanyId, templateId);
      setCurrentCompany(updated);
      setIsBriefingLocked(false);
      setFocusTarget(null);
      setVariables([]);
      setCompoundTables([]);
      setTemplateStats(null);
      setTemplateFilesize(null);
      setPricingRulesState(null);
      setCompletedStages([]);
      setCurrentStage(1);

      setCompanies((prev) =>
        prev.map((c) =>
          c.company_id === updated.company_id ? { ...c, briefing_locked: false } : c
        )
      );

      showNotification(
        "info",
        `Briefing unlocked for ${updated.company_name}. Downstream variables and templates reset.`
      );
    } catch (err) {
      showNotification("error", err instanceof Error ? err.message : "Failed to unlock the briefing in the backend.");
    }
  };

  // -------------------------------------------------------------
  // Stage 2: Variable Discovery & Extraction
  // -------------------------------------------------------------
  const handleExtractVariables = async (companyId: string) => {
    setIsExtractingVariables(true);
    setTemplateStats(null);
    setTemplateFilesize(null);
    setPricingRulesState(null);
    setFocusTarget(null);
    try {
      const result = await api.extractVariables(companyId, templateId);
      setVariables(result.variables || []);
      setCompoundTables(result.compound_tables || []);
      showNotification(
        "success",
        `AI discovered ${result.variables.length} variables and ${result.compound_tables.length} tables from quotation.`
      );
    } catch (err) {
      setVariables([]);
      setCompoundTables([]);
      showNotification("error", err instanceof Error ? err.message : "Failed to extract variables in the backend.");
    } finally {
      setIsExtractingVariables(false);
    }
  };

  const handleVariablesChange = (
    updatedVars: CompanyVariable[],
    updatedTables?: CompoundTable[]
  ) => {
    setVariables(updatedVars);
    if (updatedTables) setCompoundTables(updatedTables);
    if (templateStats) {
      setTemplateStats(null);
      setTemplateFilesize(null);
      setPricingRulesState(null);
    }

    api
      .updateVariables(
        activeCompanyId,
        {
          variables: updatedVars,
          compound_tables: updatedTables || compoundTables,
        },
        templateId
      )
      .catch((err) => {
        showNotification("error", err instanceof Error ? err.message : "Failed to save variable changes.");
      });
  };

  const handleAddCustomVariable = async (payload: {
    natural_name: string;
    category: import("./types/variable").VariableCategory;
    exact_quotation_snippet: string;
    context_anchor?: string;
  }) => {
    try {
      const res = await api.addCustomVariable(activeCompanyId, payload, templateId);
      setVariables((prev) => [...prev, res.variable]);
      if (templateStats) {
        setTemplateStats(null);
        setTemplateFilesize(null);
        setPricingRulesState(null);
      }
      showNotification("success", `Custom variable "${payload.natural_name}" added to template AST.`);
    } catch (err) {
      showNotification(
        "error",
        err instanceof Error ? err.message : "Failed to add custom variable"
      );
      throw err;
    }
  };

  const handleProceedFromStage2 = async () => {
    setIsGeneratingTemplate(true);
    try {
      const result = await api.generateTemplate(activeCompanyId, templateId);
      setTemplateStats(result);
      setPricingRulesState(null);
      setRulesStatus({ status: "idle" });

      const status = await api.fetchTemplateStatus(activeCompanyId, templateId).catch(() => null);
      if (status) {
        setTemplateFilesize(status.filesize);
      }

      markStageComplete(2);
      showNotification(
        "success",
        `Template generated with ${result.tags_placed_count} tags and ${result.loops_collapsed_count} repeating loops.`
      );
      setCurrentStage(3);
    } catch (err) {
      showNotification("error", err instanceof Error ? err.message : "Failed to generate the template in the backend.");
    } finally {
      setIsGeneratingTemplate(false);
    }
  };

  // -------------------------------------------------------------
  // Stage 3: Template AST Checkpoint & Live Docx Preview
  // -------------------------------------------------------------
  const handleRegenerateTemplate = async () => {
    setIsGeneratingTemplate(true);
    try {
      const result = await api.generateTemplate(activeCompanyId, templateId);
      setTemplateStats(result);
      setPricingRulesState(null);

      const status = await api.fetchTemplateStatus(activeCompanyId, templateId).catch(() => null);
      if (status) {
        setTemplateFilesize(status.filesize);
      }
      showNotification("success", "Template AST regenerated from current variables.");
    } catch (err) {
      showNotification(
        "error",
        err instanceof Error ? err.message : "Failed to regenerate template."
      );
    } finally {
      setIsGeneratingTemplate(false);
    }
  };

  const handleProceedFromStage3 = async () => {
    markStageComplete(3);
    setCurrentStage(4);
    handleCompilePricingRules();
  };

  // -------------------------------------------------------------
  // Stage 4: Pricing Engine & Deterministic Calculations
  // -------------------------------------------------------------
  const handleCompilePricingRules = async () => {
    if (!activeCompanyId) return;
    setRulesStatus({ status: "compiling" });
    try {
      const state = await api.compilePricingRules(activeCompanyId, templateId);
      setPricingRulesState(state);
      setRulesStatus({ status: "idle" });
      const mismatches = (state.sample_check || []).filter((c) => !c.ok).length;
      showNotification(
        mismatches === 0 ? "success" : "info",
        mismatches === 0
          ? `Pricing rules compiled & 100% matched to quotation benchmark.`
          : `Pricing rules compiled — ${mismatches} checks to review.`
      );
    } catch (err) {
      setRulesStatus({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to compile pricing rules",
      });
      setPricingRulesState(null);
      showNotification("error", err instanceof Error ? err.message : "Failed to compile pricing rules.");
    }
  };

  const handleProceedFromStage4 = async () => {
    if (!activeCompanyId) return;
    setIsProceeding(true);
    try {
      const updatedCompany = await api.proceedToLeadSimulation(activeCompanyId, templateId);
      setCurrentCompany(updatedCompany);
      markStageComplete(4);
      showNotification(
        "success",
        "Pricing rules locked. Stage 5 is ready for a real lead simulation."
      );
      setCurrentStage(5);
    } catch (err) {
      showNotification("error", err instanceof Error ? err.message : "The backend could not open Stage 5.");
    } finally {
      setIsProceeding(false);
    }
  };

  const activeTemplate = templates.find((t) => t.template_id === templateId);

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-[#2B7CFF]/20 pb-20 transition-colors">
      {/* Top Header & Navigation Bar - ALWAYS VISIBLE */}
      <LadSettingsHeader
        companies={companies}
        activeCompanyId={activeCompanyId}
        onSelectCompany={handleSelectCompany}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        activeAiModel={activeAiModel}
        onSelectAiModel={handleSelectAiModel}
        onOpenVoiceInbox={() => setIsVoiceSettingsOpen(true)}
        voiceInboxConnected={voiceConfiguration?.email_connected ?? null}
      />

      <ConfigurationSheet
        open={isVoiceSettingsOpen}
        onOpenChange={setIsVoiceSettingsOpen}
        companyId={activeCompanyId}
        companyName={currentCompany?.company_name || "Company"}
        onNotify={handleConfigurationNotify}
        onConfigurationChange={setVoiceConfiguration}
      />

      {/* Main Workspace */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-5 space-y-6">
        {templateControls}

        {/* Floating Notification Toast */}
        {notification && (
          <div
            className={`px-4 py-3 rounded-2xl border text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2 duration-200 ${
              notification.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                : notification.type === "error"
                ? "bg-destructive/10 border-destructive/30 text-destructive"
                : "bg-blue-50 dark:bg-[#000724] border-blue-200/80 dark:border-[#2B7CFF]/40 text-[#0B1957] dark:text-[#2B7CFF]"
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
              className="text-muted-foreground hover:text-foreground ml-3 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tab 1: Business Profile / ICP View */}
        {(activeTab === "businessprofile" || activeTab === "icp") && currentCompany && (
          <BusinessProfileView
            company={currentCompany}
            onCompanyChange={(updated) => {
              setCurrentCompany(updated);
              setCompanies((prev) =>
                prev.map((item) =>
                  item.company_id === updated.company_id
                    ? {
                        ...item,
                        company_name: updated.company_name,
                        industry: updated.industry,
                        location: updated.location,
                        email: updated.email,
                        website: updated.website,
                        phone: updated.phone,
                        pricing_spec: updated.pricing_spec,
                        updated_at: updated.updated_at,
                      }
                    : item
                )
              );
            }}
            onSaveNotification={(msg) => showNotification("success", msg)}
            onErrorNotification={(msg) => showNotification("error", msg)}
          />
        )}

        {/* Tab 2: Voice & Inbox View */}
        {activeTab === "voiceinbox" && currentCompany && (
          <VoiceInboxView
            companyId={activeCompanyId}
            simulation={leadSimulation}
            configuration={voiceConfiguration}
            onNotify={showNotification}
            onOpenSettings={() => setIsVoiceSettingsOpen(true)}
            onCreateProposal={() => {
              setActiveTab("proposals");
              setInternalTemplateId("");
              showNotification("info", "Opening proposal template library.");
            }}
          />
        )}

        {/* Tab 3: Auto Proposal Hub (Library & 5-Stage Workspace) */}
        {activeTab === "proposals" && (
          <>
            {!templateId ? (
              /* Landing Section: Template Library & Inbound Lead Routing */
              currentCompany ? (
                <TemplateLibraryView
                  company={currentCompany}
                  templates={templates}
                  email={routingEmail}
                  routing={routingResult}
                  routingBusy={isRoutingBusy}
                  onSelectTemplate={handleSelectTemplate}
                  onImportIcp={handleImportIcp}
                  onSaveEmail={handleSaveRoutingEmail}
                  onRouteEmail={handleRouteEmail}
                  onReassign={handleReassignEmail}
                  onCreateTemplate={handleCreateTemplate}
                  onDeleteTemplate={handleDeleteTemplate}
                  isBusy={isTemplatesBusy}
                  isGenerating={isTemplatesGenerating}
                />
              ) : (
                <div className="py-24 text-center space-y-3">
                  <div className="inline-block size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Loading your proposal templates &amp; routing rules...
                  </p>
                </div>
              )
            ) : (
              /* Active Template Workspace (5-Stage Proposal Pipeline) */
              <div className="space-y-6">
                {/* Top Navigation Bar: Back & Template Switcher */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card p-3 shadow-xs">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBackToLibrary}
                      className="rounded-xl border-border/80 hover:bg-muted font-medium text-xs transition-colors"
                    >
                      <ArrowLeft className="mr-1.5 size-3.5" />
                      All templates
                    </Button>
                    <div className="h-4 w-px bg-border/60" />
                    <div className="flex items-center gap-2">
                      <div className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FileText className="size-3.5" />
                      </div>
                      <span className="font-heading text-sm font-bold tracking-tight text-foreground">
                        {activeTemplate?.name || "Active Template"}
                      </span>
                    </div>
                  </div>

                  {/* Fast Template Switcher Dropdown */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
                      Switch:
                    </span>
                    <CustomDropdown
                      size="sm"
                      value={templateId}
                      onChange={(nextId) => {
                        if (!nextId || nextId === templateId) return;
                        if (
                          window.confirm(
                            "Switch template workspace? Saved work is kept. Unsaved edits in the current form will be discarded."
                          )
                        ) {
                          setInternalTemplateId(nextId);
                        }
                      }}
                      options={templates.map((t) => ({
                        value: t.template_id,
                        label: t.name,
                        icon: <FileText className="size-3.5" />,
                        badge: routingResult?.template_id === t.template_id ? "Assigned Lead" : undefined,
                      }))}
                      aria-label="Switch active template"
                      className="h-8 rounded-xl font-semibold text-xs shadow-xs min-w-44"
                    />
                  </div>
                </div>

                {/* Assigned Inbound Lead Banner (when assigned to this template) */}
                {routingResult?.template_id === templateId && (
                  <Card className="overflow-hidden rounded-2xl border border-primary/30 bg-primary/[0.03] p-4.5 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/10 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Mail className="size-4" />
                        </div>
                        <div>
                          <h2 className="text-sm font-bold text-foreground font-heading">
                            Assigned Lead Email
                          </h2>
                          <p className="text-[11px] text-muted-foreground">
                            Matched via {routingResult.source === "manual" ? "manual assignment" : "AI routing"}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => {
                          void navigator.clipboard.writeText(routingResult.email);
                          setCopiedLead(true);
                          setTimeout(() => setCopiedLead(false), 2000);
                        }}
                        className="rounded-lg text-xs gap-1.5"
                      >
                        {copiedLead ? (
                          <>
                            <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="size-3" />
                            Copy text
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="mt-3 space-y-2">
                      <p className="whitespace-pre-wrap rounded-xl border border-border/60 bg-background/80 p-3 text-xs leading-relaxed text-foreground/90 font-mono">
                        {routingResult.email}
                      </p>
                      {routingResult.reason && (
                        <p className="text-xs text-muted-foreground italic">
                          <span className="font-semibold not-italic text-foreground/80">Match reason: </span>
                          {routingResult.reason}
                        </p>
                      )}
                    </div>
                  </Card>
                )}

                {/* Hero Banner */}
                <HeroBanner
                  companyName={currentCompany?.company_name || "Company"}
                  onCreateProposal={() => {
                    handleBriefingUnlock();
                  }}
                  onRescanPipeline={() => handleExtractVariables(activeCompanyId)}
                />

                {/* 5-Stage Stepper Navigation */}
                <StageStepper
                  currentStage={currentStage}
                  completedStages={completedStages}
                  onSelectStage={(stage) => setCurrentStage(stage)}
                />

                {/* Stage 1: Briefing & Document Upload */}
                {currentStage === 1 && currentCompany && (
                  <Stage1Briefing
                    company={currentCompany}
                    isLocked={isBriefingLocked}
                    isSubmitting={isSubmittingBriefing}
                    onSubmit={handleBriefingSubmit}
                    onGeneratePrompt={handleGeneratePrompt}
                    onUnlock={handleBriefingUnlock}
                    onProceed={() => setCurrentStage(2)}
                  />
                )}

                {/* Stage 2: Dynamic Variable Discovery & Review Deck */}
                {currentStage === 2 && currentCompany && (
                  <Stage2VariableLedger
                    companyId={currentCompany.company_id}
                    companyName={currentCompany.company_name}
                    variables={variables}
                    compoundTables={compoundTables}
                    quotationMarkdown={currentCompany.document_metadata?.extracted_markdown}
                    isLoading={isLoading}
                    isExtracting={isExtractingVariables}
                    isGeneratingTemplate={isGeneratingTemplate}
                    attentionTargets={attentionTargets}
                    focusTarget={focusTarget}
                    onVariablesChange={handleVariablesChange}
                    onRescan={() => handleExtractVariables(currentCompany.company_id)}
                    onAddCustomVariable={handleAddCustomVariable}
                    onProceed={handleProceedFromStage2}
                  />
                )}

                {/* Stage 3: Draft Proposal */}
                {currentStage === 3 && currentCompany && templateStats && (
                  <Stage3TemplateCheck
                    companyId={currentCompany.company_id}
                    templateId={templateId}
                    companyName={currentCompany.company_name}
                    stats={templateStats}
                    filesize={templateFilesize}
                    onProceed={handleProceedFromStage3}
                    onRegenerate={handleRegenerateTemplate}
                    isRegenerating={isGeneratingTemplate}
                  />
                )}

                {/* Stage 4: Pricing Engine & Deterministic Ledger */}
                {currentStage === 4 && currentCompany && (
                  <Stage4PricingEngine
                    companyId={currentCompany.company_id}
                    templateId={templateId}
                    companyName={currentCompany.company_name}
                    state={pricingRulesState}
                    status={rulesStatus}
                    variables={variables}
                    compoundTables={compoundTables}
                    onStateChange={setPricingRulesState}
                    onProceed={handleProceedFromStage4}
                    onRegenerate={handleCompilePricingRules}
                    isProceeding={isProceeding}
                  />
                )}

                {/* Stage 5: Lead facts, assumptions, deterministic pricing, and proposal output */}
                {currentStage === 5 && currentCompany && (
                  <Stage5LeadSimulator
                    company={currentCompany}
                    templateId={templateId}
                    rules={pricingRulesState}
                    onComplete={() => markStageComplete(5)}
                  />
                )}
              </div>
            )}
          </>
        )}

        {/* Other Tabs Placeholder */}
        {activeTab !== "proposals" &&
          activeTab !== "businessprofile" &&
          activeTab !== "icp" &&
          activeTab !== "voiceinbox" && (
            <div className="py-20 text-center space-y-4 rounded-3xl border border-border/80 bg-card p-8">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Layers className="size-7" />
              </div>
              <h2 className="font-heading text-xl font-bold capitalize">
                {activeTab} Management
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Configure your {activeTab} settings or return to Auto Proposal templates.
              </p>
              <Button
                onClick={() => setActiveTab("proposals")}
                className="rounded-xl gap-2 text-xs font-semibold"
              >
                Go to Auto Proposal
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          )}
      </main>

      <DevDock
        company={currentCompany}
        templateId={templateId}
        variables={variables}
        compoundTables={compoundTables}
        templateStats={templateStats}
        pricingRules={pricingRulesState}
        onRulesChange={setPricingRulesState}
      />
    </div>
  );
}

export default App;
