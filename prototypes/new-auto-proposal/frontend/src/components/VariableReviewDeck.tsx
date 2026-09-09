import React, { useState, useEffect } from "react";
import {
  Sparkles,
  RefreshCw,
  Plus,
  Trash2,
  AlertCircle,
  Check,
  ChevronRight,
  Layers,
  FileText,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "./ui/button";
import { CustomDropdown } from "./ui/custom-dropdown";
import { AddCustomChipModal } from "./AddCustomChipModal";
import type {
  CompanyVariable,
  CompoundTable,
  VariableCategory,
  VariablesResponse,
} from "../types/variable";
import {
  fetchVariables,
  extractVariables,
  updateVariables,
  addCustomVariable,
} from "../services/api";

interface VariableReviewDeckProps {
  companyId: string;
  companyName: string;
  quotationMarkdown?: string | null;
  onGenerateTemplate?: () => void;
  onVariablesChange?: (variables: CompanyVariable[], tables: CompoundTable[]) => void;
}

type FilterTab = "all" | "customer_input" | "pricing" | "paragraph";

export const VariableReviewDeck: React.FC<VariableReviewDeckProps> = ({
  companyId,
  companyName,
  quotationMarkdown,
  onGenerateTemplate,
  onVariablesChange,
}) => {
  const [variables, setVariables] = useState<CompanyVariable[]>([]);
  const [compoundTables, setCompoundTables] = useState<CompoundTable[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [showDeleted, setShowDeleted] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Load variables on company change
  useEffect(() => {
    let ignore = false;
    setIsLoading(true);
    setError(null);

    fetchVariables(companyId)
      .then((data: VariablesResponse) => {
        if (!ignore) {
          if (data.variables.length === 0 && !isExtracting) {
            // Auto-trigger extraction if locked and no variables present
            runExtraction();
          } else {
            setVariables(data.variables);
            setCompoundTables(data.compound_tables);
            setIsLoading(false);
            if (onVariablesChange) {
              onVariablesChange(data.variables, data.compound_tables);
            }
          }
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load variables");
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [companyId]);

  const runExtraction = async () => {
    setIsExtracting(true);
    setError(null);
    try {
      const result = await extractVariables(companyId);
      setVariables(result.variables);
      setCompoundTables(result.compound_tables);
      if (onVariablesChange) {
        onVariablesChange(result.variables, result.compound_tables);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to extract variables. Please check your connection or retry."
      );
    } finally {
      setIsExtracting(false);
      setIsLoading(false);
    }
  };

  const handleUpdateNaturalName = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    const updated = variables.map((v) =>
      v.id === id ? { ...v, natural_name: newName.trim() } : v
    );
    setVariables(updated);
    if (onVariablesChange) onVariablesChange(updated, compoundTables);

    try {
      await updateVariables(companyId, {
        variables: [{ id, natural_name: newName.trim() }],
      });
      flashSaved("Name updated");
    } catch (err) {
      console.error("Failed to persist natural name", err);
    }
  };

  const handleUpdateCategory = async (id: string, newCategory: VariableCategory) => {
    const updated = variables.map((v) => {
      if (v.id !== id) return v;
      const updatedDescriptor = { ...v.descriptor };
      if (newCategory === "paragraph" && !updatedDescriptor.paragraph_config) {
        updatedDescriptor.paragraph_config = {
          mode: "fixed",
          purpose: "Original quotation paragraph",
        };
      }
      return {
        ...v,
        category: newCategory,
        data_type: (newCategory === "paragraph" ? "paragraph" : v.data_type) as any,
        descriptor: updatedDescriptor,
      };
    });

    setVariables(updated);
    if (onVariablesChange) onVariablesChange(updated, compoundTables);

    try {
      const target = updated.find((v) => v.id === id);
      await updateVariables(companyId, {
        variables: [
          {
            id,
            category: newCategory,
            data_type: newCategory === "paragraph" ? "paragraph" : undefined,
            descriptor: target?.descriptor,
          },
        ],
      });
      flashSaved(`Moved to ${formatCategoryLabel(newCategory)}`);
    } catch (err) {
      console.error("Failed to persist category update", err);
    }
  };

  const handleToggleParagraphMode = async (
    id: string,
    mode: "fixed" | "ai_generated"
  ) => {
    const updated = variables.map((v) => {
      if (v.id !== id) return v;
      return {
        ...v,
        descriptor: {
          ...v.descriptor,
          paragraph_config: {
            mode,
            purpose: v.descriptor.paragraph_config?.purpose || "Executive overview and scope",
            tone: v.descriptor.paragraph_config?.tone || "Professional and consultative",
            length_guideline: v.descriptor.paragraph_config?.length_guideline || "2-3 sentences",
            guidance: v.descriptor.paragraph_config?.guidance || "",
          },
        },
      };
    });

    setVariables(updated);
    if (onVariablesChange) onVariablesChange(updated, compoundTables);

    try {
      const target = updated.find((v) => v.id === id);
      await updateVariables(companyId, {
        variables: [{ id, descriptor: target?.descriptor }],
      });
      flashSaved(`Paragraph mode: ${mode === "fixed" ? "Fixed" : "AI Drafted"}`);
    } catch (err) {
      console.error("Failed to persist paragraph mode", err);
    }
  };

  const handleUpdateParagraphGuidance = async (id: string, guidance: string) => {
    const updated = variables.map((v) => {
      if (v.id !== id) return v;
      return {
        ...v,
        descriptor: {
          ...v.descriptor,
          paragraph_config: {
            mode: v.descriptor.paragraph_config?.mode || "ai_generated",
            purpose: v.descriptor.paragraph_config?.purpose || "",
            tone: v.descriptor.paragraph_config?.tone || "",
            length_guideline: v.descriptor.paragraph_config?.length_guideline || "",
            guidance,
          },
        },
      };
    });

    setVariables(updated);
    if (onVariablesChange) onVariablesChange(updated, compoundTables);

    try {
      const target = updated.find((v) => v.id === id);
      await updateVariables(companyId, {
        variables: [{ id, descriptor: target?.descriptor }],
      });
      flashSaved("Guidance saved");
    } catch (err) {
      console.error("Failed to persist paragraph guidance", err);
    }
  };

  const handleToggleDelete = async (id: string, currentDeleted: boolean) => {
    const updated = variables.map((v) =>
      v.id === id ? { ...v, is_deleted: !currentDeleted } : v
    );
    setVariables(updated);
    if (onVariablesChange) onVariablesChange(updated, compoundTables);

    try {
      await updateVariables(companyId, {
        variables: [{ id, is_deleted: !currentDeleted }],
      });
      flashSaved(currentDeleted ? "Variable restored" : "Excluded (kept as static Word text)");
    } catch (err) {
      console.error("Failed to toggle delete", err);
    }
  };

  const handleUpdateDefaultTier = async (tableId: string, defaultTier: string) => {
    const updated = compoundTables.map((t) =>
      t.table_id === tableId ? { ...t, default_value: defaultTier } : t
    );
    setCompoundTables(updated);
    if (onVariablesChange) onVariablesChange(variables, updated);

    try {
      await updateVariables(companyId, {
        compound_tables: [{ id: tableId, descriptor: { default_value: defaultTier } }],
      });
      flashSaved(`Default tier: ${defaultTier}`);
    } catch (err) {
      console.error("Failed to persist default tier", err);
    }
  };

  const handleAddCustom = async (payload: {
    natural_name: string;
    category: VariableCategory;
    exact_quotation_snippet: string;
    context_anchor?: string;
  }) => {
    const result = await addCustomVariable(companyId, payload);
    const updated = [result.variable, ...variables];
    setVariables(updated);
    if (onVariablesChange) onVariablesChange(updated, compoundTables);
    flashSaved(`Added "${payload.natural_name}"`);
  };

  const flashSaved = (msg: string) => {
    setSaveStatus(msg);
    setTimeout(() => setSaveStatus(null), 2500);
  };

  const formatCategoryLabel = (cat: VariableCategory): string => {
    switch (cat) {
      case "customer_input":
        return "Customer Input";
      case "pricing":
        return "Pricing";
      case "paragraph":
        return "Paragraph";
      case "comparison_matrix":
        return "Tier Matrix";
      case "table_loop":
      case "compound_table":
        return "Repeating Table";
      default:
        return cat;
    }
  };

  const activeVariables = variables.filter((v) => showDeleted || !v.is_deleted);
  const displayedVariables = activeVariables.filter((v) => {
    if (filterTab === "all") return true;
    return v.category === filterTab;
  });

  const deletedCount = variables.filter((v) => v.is_deleted).length;

  return (
    <div className="relative bg-card rounded-2xl border border-border/80 shadow-xs overflow-hidden transition-all duration-200">
      {/* Ambient Top Shimmer Bar during extraction */}
      {isExtracting && (
        <div className="h-0.5 w-full bg-gradient-to-r from-sky-500 via-emerald-500 to-violet-500 animate-pulse" />
      )}

      <div className="p-5 sm:p-6 space-y-5">
        {/* Header Bar: Minimal & Unbloated */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-2">
                <span>Variables</span>
                {saveStatus && (
                  <span className="text-[11px] font-normal text-emerald-500 flex items-center gap-1 animate-in fade-in">
                    <Check className="size-3" />
                    {saveStatus}
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Dynamic placeholders and structures scanned from {companyName}&apos;s quotation
              </p>
            </div>
          </div>

          {/* Right Toolbar Controls */}
          <div className="flex items-center gap-2">
            {deletedCount > 0 && (
              <button
                onClick={() => setShowDeleted(!showDeleted)}
                className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition-all ${
                  showDeleted
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Toggle visibility of excluded/static placeholders"
              >
                {showDeleted ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                <span>
                  {showDeleted ? "Hide Excluded" : `${deletedCount} Excluded`}
                </span>
              </button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={runExtraction}
              disabled={isExtracting}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              title="Re-scan quotation via Gemini"
            >
              <RefreshCw className={`size-3 mr-1 ${isExtracting ? "animate-spin" : ""}`} />
              <span>{isExtracting ? "Scanning..." : "Re-scan"}</span>
            </Button>
          </div>
        </div>

        {/* Error / Retry Banner */}
        {error && (
          <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={runExtraction}
              className="h-7 text-xs border-destructive/30 hover:bg-destructive/10 text-destructive"
            >
              <RefreshCw className="size-3 mr-1" />
              Retry Analysis
            </Button>
          </div>
        )}

        {/* Loading Skeletons */}
        {isExtracting || (isLoading && variables.length === 0) ? (
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
              <Sparkles className="size-3.5 text-primary" />
              <span>Scanning quotation structure, pricing tiers, and placeholders...</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="h-20 rounded-xl bg-muted/50 animate-pulse" />
              <div className="h-20 rounded-xl bg-muted/50 animate-pulse" />
              <div className="h-20 rounded-xl bg-muted/50 animate-pulse" />
            </div>
          </div>
        ) : (
          <>
            {/* Filter Pill Tray + [+ Add] ghost button */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
              <nav className="flex items-center rounded-lg bg-muted/60 p-0.5 border border-border/40 text-xs">
                {(
                  [
                    { id: "all", label: "All" },
                    { id: "customer_input", label: "Customer Inputs" },
                    { id: "pricing", label: "Pricing" },
                    { id: "paragraph", label: "Paragraphs" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilterTab(tab.id)}
                    className={`px-3 py-1 rounded-md font-medium transition-all select-none ${
                      filterTab === tab.id
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddModalOpen(true)}
                className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg border border-border/40 shrink-0"
              >
                <Plus className="size-3 mr-1 text-primary" />
                <span>Add</span>
              </Button>
            </div>

            {/* Compound Cards: Tier Matrix & Repeating Tables */}
            {(filterTab === "all" || filterTab === "pricing") && compoundTables.length > 0 && (
              <div className="space-y-3 pt-1">
                {compoundTables.map((table) => {
                  if (table.type === "comparison_matrix") {
                    const tiers =
                      table.enum_options && table.enum_options.length > 0
                        ? table.enum_options
                        : ["Essential", "Standard", "Premium"];
                    const currentDefault = table.default_value || tiers[1] || tiers[0];

                    return (
                      <div
                        key={table.table_id}
                        className="rounded-xl bg-muted/30 border border-border/50 p-3.5 space-y-2.5 transition-all hover:bg-muted/40"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-indigo-500 shrink-0" />
                            <span className="text-xs font-semibold text-foreground">
                              {table.natural_name || "Tier Comparison Matrix"}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                              3-Tier Matrix
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-muted-foreground">Default:</span>
                            <CustomDropdown
                              value={currentDefault}
                              onChange={(val) =>
                                handleUpdateDefaultTier(table.table_id, val)
                              }
                              options={tiers.map((t) => ({
                                value: t,
                                label: t,
                                dotColor: "bg-indigo-500",
                              }))}
                              size="xs"
                              menuAlign="right"
                              className="h-6 px-2 text-xs bg-background/90 font-medium"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-muted/40 p-2 rounded-lg border border-border/40">
                          <Layers className="size-3.5 text-indigo-500 shrink-0" />
                          <span className="truncate">
                            Detected Packages: {tiers.join(" • ")}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  if (table.type === "repeating_loop") {
                    return (
                      <div
                        key={table.table_id}
                        className="rounded-xl bg-muted/30 border border-border/50 p-3.5 space-y-2 transition-all hover:bg-muted/40"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-teal-500 shrink-0" />
                            <span className="text-xs font-semibold text-foreground">
                              {table.natural_name || "Repeating Line Items"}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                              Dynamic Loop
                            </span>
                          </div>

                          <div className="text-[11px] font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded border border-border/40">
                            {`{#${table.loop_tag || "items"}}...{/${table.loop_tag || "items"}}`}
                          </div>
                        </div>

                        {table.columns && table.columns.length > 0 && (
                          <p className="text-[11px] text-muted-foreground">
                            Columns: {table.columns.join(", ")}
                          </p>
                        )}
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            )}

            {/* Atomic Variable Cards */}
            {displayedVariables.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground space-y-2">
                <FileText className="size-6 mx-auto opacity-30 text-primary" />
                <p className="text-xs font-medium">No variables in this category</p>
                <p className="text-[11px]">
                  Click [+ Add] to define custom placeholders from the quotation.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {displayedVariables.map((v) => {
                  const isParagraph = v.category === "paragraph";
                  const paragraphMode =
                    v.descriptor.paragraph_config?.mode || "fixed";
                  const hasVisibility = Boolean(
                    v.descriptor.visibility_rule?.condition_flag
                  );

                  return (
                    <div
                      key={v.id}
                      className={`group rounded-xl p-3.5 border transition-all ${
                        v.is_deleted
                          ? "bg-muted/20 border-border/20 opacity-50"
                          : "bg-muted/40 hover:bg-muted/60 border-border/40 hover:-translate-y-0.5"
                      }`}
                    >
                      {/* Top Row */}
                      <div className="flex items-center justify-between gap-3">
                        {/* Dot + Category + Inline Editable Natural Name */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {/* Semantic Color Dot */}
                          <span
                            className={`size-2 rounded-full shrink-0 ${
                              v.category === "customer_input"
                                ? "bg-sky-500"
                                : v.category === "pricing"
                                ? "bg-emerald-500"
                                : "bg-violet-500"
                            }`}
                          />

                          {/* Borderless Inline Editable Name */}
                          <input
                            type="text"
                            defaultValue={v.natural_name}
                            onBlur={(e) =>
                              handleUpdateNaturalName(v.id, e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.currentTarget.blur();
                              }
                            }}
                            className="text-xs font-semibold text-foreground bg-transparent hover:bg-muted/50 focus:bg-background rounded px-1.5 py-0.5 border border-transparent focus:border-border/60 outline-hidden transition-all truncate"
                            title="Click to rename"
                          />

                          {/* Category Reclassifier Dropdown */}
                          <CustomDropdown
                            value={v.category}
                            onChange={(val) =>
                              handleUpdateCategory(
                                v.id,
                                val as VariableCategory
                              )
                            }
                            options={[
                              { value: "customer_input", label: "Customer Input", dotColor: "bg-sky-500" },
                              { value: "pricing", label: "Pricing", dotColor: "bg-emerald-500" },
                              { value: "paragraph", label: "Paragraph", dotColor: "bg-violet-500" },
                            ]}
                            size="xs"
                            className="h-5 px-1.5 text-[10px] bg-muted/50 hover:bg-muted border-border/30 rounded-md font-normal"
                          />

                          {/* Custom Variable Indicator */}
                          {v.is_custom && (
                            <span className="text-[10px] text-sky-600 dark:text-sky-400 bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/20 font-mono">
                              Custom
                            </span>
                          )}

                          {/* Conditional Row Indicator */}
                          {hasVisibility && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                              [Conditional: Hidden if $0]
                            </span>
                          )}
                        </div>

                        {/* Soft Remove Button */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleToggleDelete(v.id, v.is_deleted)}
                            className={`size-6 rounded flex items-center justify-center transition-all ${
                              v.is_deleted
                                ? "text-emerald-500 hover:bg-emerald-500/10"
                                : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            }`}
                            title={
                              v.is_deleted
                                ? "Restore placeholder"
                                : "Exclude placeholder (retains original text as static Word content)"
                            }
                          >
                            {v.is_deleted ? (
                              <Check className="size-3.5" />
                            ) : (
                              <Trash2 className="size-3" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Bottom Row: Tag + Verbatim Sample Snippet */}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono text-[11px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/40">
                          {`{${v.variable_name}}`}
                        </span>

                        {v.descriptor.sample_value && (
                          <span className="text-[11px] text-muted-foreground/80 truncate max-w-md">
                            &ldquo;{v.descriptor.sample_value}&rdquo;
                          </span>
                        )}
                      </div>

                      {/* Paragraph Well Pattern */}
                      {isParagraph && (
                        <div className="mt-3 rounded-xl bg-muted/30 border border-border/30 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-muted-foreground">
                              Paragraph Drafting Mode
                            </span>

                            {/* Mode Toggle: Fixed vs AI Drafted */}
                            <div className="flex items-center rounded-lg bg-muted p-0.5 border border-border/40 text-xs">
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleParagraphMode(v.id, "fixed")
                                }
                                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                                  paragraphMode === "fixed"
                                    ? "bg-card text-foreground shadow-xs"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                Fixed
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleParagraphMode(v.id, "ai_generated")
                                }
                                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                                  paragraphMode === "ai_generated"
                                    ? "bg-card text-foreground shadow-xs"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                AI Drafted
                              </button>
                            </div>
                          </div>

                          {paragraphMode === "fixed" ? (
                            <p className="text-xs text-muted-foreground italic bg-muted/40 p-2 rounded-lg border border-border/20">
                              {v.descriptor.sample_value ||
                                "Original text remains verbatim in generated proposals."}
                            </p>
                          ) : (
                            <div className="space-y-1">
                              <label className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                                Guidance for AI Lead Customization
                              </label>
                              <textarea
                                defaultValue={
                                  v.descriptor.paragraph_config?.guidance ||
                                  v.descriptor.paragraph_config?.purpose ||
                                  ""
                                }
                                onBlur={(e) =>
                                  handleUpdateParagraphGuidance(v.id, e.target.value)
                                }
                                rows={2}
                                placeholder="Explain client-tailored focus, tone, or specific talking points..."
                                className="w-full text-xs bg-transparent border border-border/40 rounded-lg p-2 focus:outline-hidden focus:border-border text-foreground resize-none"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom Primary CTA */}
            <div className="pt-2 flex items-center justify-between border-t border-border/40">
              <div className="text-[11px] text-muted-foreground">
                <span>{activeVariables.length} active variables</span>
                {deletedCount > 0 && <span> • {deletedCount} excluded</span>}
              </div>

              <Button
                onClick={onGenerateTemplate}
                size="sm"
                className="h-8 px-4 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs btn-tactile"
              >
                <span>Generate Template</span>
                <ChevronRight className="size-3.5 ml-1" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Add Custom Chip Modal */}
      <AddCustomChipModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        markdown={quotationMarkdown}
        onAdd={handleAddCustom}
      />
    </div>
  );
};

export default VariableReviewDeck;
