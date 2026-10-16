import React from "react";
import {
  ArrowDown,
  ArrowUp,
  Plus,
  Sparkles,
  Trash2,
  Layers,
  FileText,
  Loader2,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import type { SampleSection } from "../types/sample-proposal";
import { newSampleSection } from "../types/sample-proposal";

export type { SampleSection };
export { newSampleSection };

interface SampleSectionsEditorProps {
  sections: SampleSection[];
  onChange: (sections: SampleSection[]) => void;
  onGenerate: (section: SampleSection) => Promise<void> | void;
  disabled: boolean;
  generatingSectionId?: string | null;
}

const POSITION_LABELS: Record<string, string> = {
  before_scope: "After Overview / Before Scope",
  before_pricing: "After Scope / Before Pricing",
  before_terms: "Before Terms & Conditions",
  after_terms: "After Terms & Sign-off",
};

export const SampleSectionsEditor: React.FC<SampleSectionsEditorProps> = ({
  sections,
  onChange,
  onGenerate,
  disabled,
  generatingSectionId,
}) => {
  const updateSection = (id: string, patch: Partial<SampleSection>) => {
    onChange(
      sections.map((section) =>
        section.id === id ? { ...section, ...patch } : section
      )
    );
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sections.length) return;
    const next = [...sections];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    onChange(next);
  };

  const handleAddSection = () => {
    if (sections.length >= 8) return;
    onChange([...sections, newSampleSection()]);
  };

  const handleRemoveSection = (id: string) => {
    onChange(sections.filter((s) => s.id !== id));
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-4 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
            <Layers className="size-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>Custom Proposal Sections</span>
              <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                {sections.length}/8
              </Badge>
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Add contextual sections (e.g. Room to grow, SLA guarantees, Scope exclusions). AI drafts or write manually.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || sections.length >= 8}
          onClick={handleAddSection}
          className="h-7 text-xs gap-1.5 self-start sm:self-auto border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/5 cursor-pointer"
        >
          <Plus className="size-3.5" />
          <span>Add Section</span>
        </Button>
      </div>

      {sections.length === 0 ? (
        <div className="text-center py-4 px-3 rounded-xl border border-dashed border-border/60 bg-background/50">
          <p className="text-xs text-muted-foreground">
            No custom sections added yet. Standard proposal sections (Overview, Scope, Investment, Terms) will be generated.
          </p>
          <p className="text-[11px] text-muted-foreground/80 mt-1">
            Click <strong>Add Section</strong> above to propose optional add-ons or custom policies.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map((section, index) => {
            const isGeneratingThis = generatingSectionId === section.id;
            return (
              <div
                key={section.id}
                className="group relative rounded-xl border border-border/80 bg-card p-3.5 space-y-3 shadow-2xs hover:border-indigo-500/40 transition-all"
              >
                {/* Header row: Index, Title quick badge, Order controls, Delete */}
                <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="text-xs font-semibold text-foreground truncate max-w-48 sm:max-w-xs">
                      {section.title || "Untitled Section"}
                    </span>
                    <Badge variant="secondary" className="text-[10px] font-normal px-2 py-0 hidden sm:inline-flex">
                      {POSITION_LABELS[section.position] || section.position}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Move section ${index + 1} up`}
                      disabled={disabled || index === 0}
                      onClick={() => moveSection(index, -1)}
                      className="size-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Move section ${index + 1} down`}
                      disabled={disabled || index === sections.length - 1}
                      onClick={() => moveSection(index, 1)}
                      className="size-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove section ${index + 1}`}
                      disabled={disabled}
                      onClick={() => handleRemoveSection(section.id)}
                      className="size-7 p-0 text-muted-foreground hover:text-destructive cursor-pointer ml-1"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Form fields: Title and Position */}
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <label className="text-[11px] font-medium text-foreground block space-y-1">
                    <span>Section Title</span>
                    <input
                      type="text"
                      className="w-full h-8 px-2.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none text-foreground placeholder:text-muted-foreground/60 transition-all"
                      maxLength={120}
                      placeholder="e.g. Room to grow, SLA Guarantees"
                      value={section.title}
                      disabled={disabled}
                      onChange={(e) => updateSection(section.id, { title: e.target.value })}
                    />
                  </label>

                  <label className="text-[11px] font-medium text-foreground block space-y-1">
                    <span>Document Placement</span>
                    <select
                      className="w-full h-8 px-2 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none text-foreground cursor-pointer transition-all"
                      value={section.position}
                      disabled={disabled}
                      onChange={(e) => updateSection(section.id, { position: e.target.value })}
                    >
                      <option value="before_scope">After Overview (Before Scope)</option>
                      <option value="before_pricing">After Scope (Before Pricing)</option>
                      <option value="before_terms">Before Terms &amp; Conditions</option>
                      <option value="after_terms">After Terms (Sign-off &amp; Addenda)</option>
                    </select>
                  </label>
                </div>

                {/* AI Prompting Guidance Box */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-foreground flex items-center gap-1">
                      <span>AI Instructions (optional)</span>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        — guides the AI copy generation
                      </span>
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={disabled || !section.title.trim() || isGeneratingThis}
                      onClick={() => onGenerate(section)}
                      className="h-6 px-2.5 text-[11px] font-medium gap-1 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10 cursor-pointer"
                    >
                      {isGeneratingThis ? (
                        <>
                          <Loader2 className="size-3 animate-spin" />
                          <span>Drafting...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="size-3" />
                          <span>{section.content ? "Regenerate with AI" : "AI Draft Section"}</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <input
                    type="text"
                    className="w-full h-8 px-2.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none text-foreground placeholder:text-muted-foreground/50 transition-all"
                    maxLength={2000}
                    placeholder="e.g. Suggest relevant optional upgrades outside quoted scope without altering the total"
                    value={section.instructions}
                    disabled={disabled}
                    onChange={(e) => updateSection(section.id, { instructions: e.target.value })}
                  />
                </div>

                {/* Section Content Textarea */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-foreground flex items-center gap-1">
                      <FileText className="size-3 text-muted-foreground" />
                      <span>Section Body</span>
                    </label>
                    <span className="text-[10px] text-muted-foreground">
                      {section.content.length}/4000
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    maxLength={4000}
                    className="w-full p-2.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none leading-relaxed text-foreground placeholder:text-muted-foreground/50 resize-y transition-all"
                    placeholder="Click 'AI Draft Section' above or type your custom section content directly..."
                    value={section.content}
                    disabled={disabled}
                    onChange={(e) => updateSection(section.id, { content: e.target.value })}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
        Custom sections integrate as native Word paragraphs with matching typography and colors, and are available for paragraph-level variable review.
      </p>
    </div>
  );
};

export default SampleSectionsEditor;
