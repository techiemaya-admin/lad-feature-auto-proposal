import React, { useState } from "react";
import type { Company } from "../../types/company";
import type { ProposalTemplateSummary, EmailRoutingResult } from "../../services/api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Card } from "../ui/card";
import { CustomDropdown } from "../ui/custom-dropdown";
import {
  Sparkles,
  ArrowUpRight,
  FileText,
  Plus,
  Trash2,
  Mail,
  CheckCircle2,
  AlertCircle,
  Wand2,
  Check,
  Loader2,
} from "lucide-react";

interface TemplateLibraryViewProps {
  company: Company;
  templates: ProposalTemplateSummary[];
  email: string;
  routing: EmailRoutingResult | null;
  routingBusy: boolean;
  onSelectTemplate: (templateId: string) => void;
  onImportIcp: () => Promise<void>;
  onSaveEmail: (email: string) => Promise<void>;
  onRouteEmail: () => Promise<void>;
  onReassign: (templateId: string) => Promise<void>;
  onCreateTemplate: (
    name: string,
    description: string,
    brief: string
  ) => Promise<void>;
  onDeleteTemplate: (template: ProposalTemplateSummary) => Promise<void>;
  isBusy: boolean;
  isGenerating: boolean;
}

export const TemplateLibraryView: React.FC<TemplateLibraryViewProps> = ({
  company,
  templates,
  email,
  routing,
  routingBusy,
  onSelectTemplate,
  onImportIcp,
  onSaveEmail,
  onRouteEmail,
  onReassign,
  onCreateTemplate,
  onDeleteTemplate,
  isBusy,
  isGenerating,
}) => {
  const [localEmail, setLocalEmail] = useState(email);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [brief, setBrief] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [descGeneratedSuccess, setDescGeneratedSuccess] = useState(false);
  const [briefGeneratedSuccess, setBriefGeneratedSuccess] = useState(false);

  // Sync external email if it changes
  React.useEffect(() => {
    setLocalEmail(email);
  }, [email]);

  const emailDirty = localEmail.trim() !== (routing?.email ?? "");

  // AI Generation from Business Profile / ICP
  const handleGenerateDescriptionFromIcp = () => {
    setIsGeneratingDesc(true);
    setFormError("");
    setTimeout(() => {
      const details = company.data?.company_details || {};
      const customer = company.data?.ideal_customer || {};
      const offer = company.data?.offer || {};

      const target =
        customer.description ||
        details.target_customers ||
        "regional business clients";
      const valueProp =
        details.value_proposition || "full-service growth and execution";
      const painPoint = customer.pain_points || "";
      const differentiator = offer.why_buyers_pick_you || "";

      let generated = "";
      if (name.trim()) {
        generated = `Tailored proposal for ${target} seeking ${name.trim()}. Resolves core friction (${
          painPoint ? painPoint.toLowerCase().replace(/\.$/, "") : "operational bottlenecks"
        }) by delivering ${valueProp.toLowerCase().replace(/\.$/, "")}. Structured with deterministic pricing, verified milestones, and evidenced commercial outcomes.`;
      } else {
        generated = `Tailored proposal for ${target}. Delivers ${valueProp.toLowerCase().replace(/\.$/, "")}${
          painPoint ? `, directly addressing ${painPoint.toLowerCase().replace(/\.$/, "")}` : ""
        }. Built with verified deliverables, ${
          differentiator ? differentiator.toLowerCase().replace(/\.$/, "") : "transparent pricing"
        }, and evidenced results.`;
      }

      setDescription(generated);
      setIsGeneratingDesc(false);
      setDescGeneratedSuccess(true);
      setTimeout(() => setDescGeneratedSuccess(false), 2200);
    }, 250);
  };

  const handleGeneratePricingBriefFromIcp = () => {
    setIsGeneratingBrief(true);
    setFormError("");
    setTimeout(() => {
      const basics = company.data?.company_basics || {};
      const details = company.data?.company_details || {};
      const offer = company.data?.offer || {};
      const customer = company.data?.ideal_customer || {};
      const rawPricing =
        company.pricing_spec ||
        company.data?.pricing_engine_spec?.pricing_context ||
        "";

      const lines: string[] = [];
      lines.push(
        `# Proposal & Pricing Specification: ${name.trim() || company.company_name}`
      );
      lines.push(
        `Company: ${company.company_name} | Location: ${basics.location || company.location || "US"} | Industry: ${
          details.industry || company.industry || "Professional Services"
        }`
      );
      lines.push(
        `Target Client (ICP): ${customer.description || details.target_customers || "Business clients"}`
      );
      lines.push("");

      if (rawPricing.trim()) {
        lines.push("## Approved Packages & Pricing Model (from Business Profile):");
        lines.push(rawPricing.trim());
        lines.push("");
      } else {
        lines.push("## Approved Service Packages:");
        lines.push("- Core Package: Fixed monthly retainer or structured milestone schedule.");
        lines.push("- Setup & Onboarding: One-time setup and diagnostic kickoff fee.");
        lines.push("");
      }

      if (
        details.products_and_services &&
        Array.isArray(details.products_and_services) &&
        details.products_and_services.length > 0
      ) {
        lines.push("## Core Deliverables & Scope:");
        details.products_and_services.forEach((s: string) => lines.push(`- ${s}`));
        lines.push("");
      }

      lines.push("## Commercial Terms & Guarantee (from ICP Strategy):");
      if (offer.guarantee_risk_reversal) {
        lines.push(`- Risk Reversal & Guarantee: ${offer.guarantee_risk_reversal}`);
      } else {
        lines.push(
          "- Contract Terms: Month-to-month after 3-month onboarding minimum; 10% discount for annual upfront prepayment."
        );
      }

      if (offer.what_happens_after_they_sign) {
        lines.push(`- Post-Signing Delivery: ${offer.what_happens_after_they_sign}`);
      }

      if (offer.why_buyers_pick_you) {
        lines.push(`- Key Differentiators: ${offer.why_buyers_pick_you}`);
      }

      if (offer.evidenced_results) {
        lines.push(`- Benchmark Proof: ${offer.evidenced_results}`);
      }

      lines.push(
        "- Taxes & Fees: Applicable regional sales tax added based on client jurisdiction."
      );

      setBrief(lines.join("\n"));
      setIsGeneratingBrief(false);
      setBriefGeneratedSuccess(true);
      setTimeout(() => setBriefGeneratedSuccess(false), 2200);
    }, 300);
  };

  const handleAutoFillBothFromIcp = () => {
    handleGenerateDescriptionFromIcp();
    handleGeneratePricingBriefFromIcp();
  };

  const handleCreateSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError("");

    if (!name.trim()) {
      setFormError("Please enter a template name.");
      document.getElementById("custom-tpl-name")?.focus();
      return;
    }
    if (!description.trim()) {
      setFormError("Please enter a description or click '✨ AI Generate from ICP'.");
      document.getElementById("custom-tpl-desc")?.focus();
      return;
    }
    if (!brief.trim()) {
      setFormError("Please enter a pricing brief or click '✨ AI Generate from ICP'.");
      document.getElementById("custom-tpl-brief")?.focus();
      return;
    }

    setIsSubmittingForm(true);
    try {
      await onCreateTemplate(name.trim(), description.trim(), brief.trim());
      setCreating(false);
      setName("");
      setDescription("");
      setBrief("");
      setFormError("");
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to create template. Please try again."
      );
    } finally {
      setIsSubmittingForm(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Generating State (when importing ICP data) */}
      {isGenerating ? (
        <section
          aria-busy="true"
          aria-label="Generating templates"
          className="py-12 text-center space-y-4"
        >
          <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary animate-pulse">
            <Sparkles className="size-7" />
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Finding the right proposals for your business
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Creating three tailored starting points from your customer profiles,
            buyer segments, and pricing rules.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 pt-6 text-left">
            {[0, 1, 2].map((i) => (
              <Card
                key={i}
                aria-hidden="true"
                className="rounded-2xl border border-border/80 p-6 shadow-sm motion-safe:animate-pulse space-y-4"
                style={{ animationDelay: `${i * 180}ms` }}
              >
                <div className="size-10 rounded-xl bg-muted" />
                <div className="h-5 w-3/4 rounded-lg bg-muted" />
                <div className="space-y-2">
                  <div className="h-3 w-full rounded bg-muted" />
                  <div className="h-3 w-5/6 rounded bg-muted" />
                  <div className="h-3 w-4/6 rounded bg-muted" />
                </div>
                <div className="pt-4 h-4 w-1/3 rounded bg-muted" />
              </Card>
            ))}
          </div>
        </section>
      ) : !templates.length ? (
        /* Empty State */
        <section
          className="flex min-h-[50vh] items-center justify-center"
          aria-labelledby="library-welcome"
        >
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-b from-card via-card to-card/70 px-6 py-12 text-center shadow-sm sm:px-12 sm:py-16">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-primary/5 to-transparent"
            />

            {/* Decorative Card Stack */}
            <div
              aria-hidden="true"
              className="relative mx-auto mb-8 flex h-32 w-56 items-center justify-center"
            >
              {[-1, 0, 1].map((pos) => (
                <div
                  key={pos}
                  className={`absolute h-28 w-24 rounded-2xl border border-border/80 bg-background p-4 shadow-sm transition-transform ${
                    pos === 0
                      ? "z-10 -translate-y-2 scale-105 border-primary/40 ring-2 ring-primary/10"
                      : pos < 0
                      ? "-translate-x-16 -rotate-12 opacity-70"
                      : "translate-x-16 rotate-12 opacity-70"
                  }`}
                >
                  <FileText className="mb-3 size-5 text-primary/80" />
                  <div className="mb-2 h-1.5 w-full rounded-full bg-muted" />
                  <div className="mb-2 h-1.5 w-4/5 rounded-full bg-muted" />
                  <div className="h-1.5 w-3/5 rounded-full bg-primary/20" />
                </div>
              ))}
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary mb-3">
              {company.company_name}
            </span>

            <h2
              id="library-welcome"
              className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground"
            >
              Your next proposal starts here
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              Turn your ideal customer profile into three proposal starting
              points, tailored to your buyers, services, and pricing
              specifications.
            </p>

            <Button
              disabled={isBusy}
              onClick={() => void onImportIcp()}
              size="lg"
              className="relative mt-8 h-12 w-full gap-2.5 rounded-xl px-8 text-sm font-semibold shadow-sm sm:w-auto"
            >
              <Sparkles className="size-4" />
              Import ICP data
              <ArrowUpRight className="size-4" />
            </Button>
            <p className="mt-3.5 text-xs text-muted-foreground">
              Three tailored briefs. Ready for you to evaluate and make your own.
            </p>
          </div>
        </section>
      ) : (
        /* Active Template Library & Inbound Lead Routing */
        <section aria-label="Template library" className="space-y-8">
          {/* Inbound Lead Routing Card */}
          <Card className="rounded-2xl border border-border/80 bg-card p-6 shadow-xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Inbound Lead Routing
                </span>
                <h2 className="font-heading text-lg font-bold text-foreground">
                  Route this lead to a template
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">
                  {localEmail.length} / 12,000 chars
                </span>
              </div>
            </div>

            {/* Lead Inquiry Email Textarea */}
            <div className="space-y-2">
              <Textarea
                aria-label="Lead inquiry email"
                value={localEmail}
                onChange={(e) => setLocalEmail(e.target.value)}
                disabled={isBusy}
                maxLength={12000}
                className="min-h-36 rounded-xl border-border/80 bg-background text-sm leading-relaxed p-3.5 focus:border-primary/50"
                placeholder="Paste the inbound inquiry email you received..."
              />
              <p className="text-xs text-muted-foreground">
                Starts with a sample email. Replace it with your own; saving an
                edited email clears the previous routing assignment.
              </p>
            </div>

            {/* Actions: Save & AI Route */}
            <div className="flex flex-wrap items-center gap-3">
              {emailDirty && (
                <Button
                  variant="outline"
                  disabled={isBusy || !localEmail.trim() || !routing}
                  onClick={() => void onSaveEmail(localEmail)}
                  className="rounded-xl border-border/80"
                >
                  Save email
                </Button>
              )}
              <Button
                disabled={isBusy || !localEmail.trim() || !routing}
                onClick={() => void onRouteEmail()}
                className="rounded-xl gap-2 shadow-xs font-semibold"
              >
                <Sparkles className="size-4" />
                {routingBusy
                  ? "Matching email..."
                  : routing?.template_id
                  ? "Re-route email"
                  : "Route email with AI"}
              </Button>

              {routingBusy && (
                <span
                  role="status"
                  className="text-xs text-muted-foreground font-medium motion-safe:animate-pulse"
                >
                  Comparing this email with your saved templates...
                </span>
              )}
            </div>

            {/* Manual Assignment Option */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-semibold text-muted-foreground">
                Assign or move manually
              </label>
              <CustomDropdown
                size="md"
                value={routing?.template_id ?? ""}
                onChange={(id) => void onReassign(id)}
                options={templates.map((t) => ({
                  value: t.template_id,
                  label: t.name,
                  description: t.description || undefined,
                  icon: <FileText className="size-3.5" />,
                }))}
                placeholder="Select a template..."
                disabled={isBusy || emailDirty}
                aria-label="Assign email to template"
                className="w-full max-w-md h-9.5 rounded-xl font-medium text-xs shadow-xs"
              />
            </div>

            {/* Routing Result Banner */}
            {routing && !emailDirty && (
              <div
                role="status"
                className="rounded-xl border border-primary/25 bg-primary/5 p-4.5 space-y-2.5 animate-in fade-in"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-primary shrink-0" />
                    <p className="font-heading font-bold text-sm text-foreground">
                      {routing.template_id
                        ? `Assigned to ${
                            templates.find(
                              (t) => t.template_id === routing.template_id
                            )?.name ?? "template"
                          }`
                        : routing.source === "unassigned"
                        ? "Not assigned"
                        : "Needs review – no clear match"}
                    </p>
                  </div>
                  {routing.routed_at && (
                    <span className="rounded-full bg-background/80 border border-border/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {routing.source === "manual"
                        ? "Manual assignment"
                        : "AI routing"}{" "}
                      •{" "}
                      {new Date(routing.routed_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>

                <p className="text-xs leading-relaxed text-muted-foreground">
                  {routing.reason ||
                    "Route this email automatically or select a template above."}
                </p>

                {routing.template_id && (
                  <div className="pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectTemplate(routing.template_id!)}
                      className="rounded-xl border-primary/30 text-xs font-semibold gap-1.5 hover:bg-primary/10"
                    >
                      Open assigned template
                      <ArrowUpRight className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Template Library Header */}
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {company.company_name}
              </p>
              <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                Your proposal templates
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Choose a starting point or create custom templates for different
                buyer segments.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-full border border-border/80 bg-muted/60 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                {templates.length} templates
              </span>
              <Button
                disabled={isBusy}
                onClick={() => {
                  setName("");
                  setDescription("");
                  setBrief("");
                  setFormError("");
                  setCreating(true);
                }}
                className="rounded-xl gap-1.5 font-semibold text-xs shadow-xs cursor-pointer"
              >
                <Plus className="size-4" />
                Add custom template
              </Button>
            </div>
          </div>

          {/* Custom Template Creation Card with AI Generate from ICP */}
          {creating && (
            <Card className="rounded-2xl border border-primary/30 bg-card p-6 shadow-md space-y-5 animate-in fade-in slide-in-from-top-2">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div>
                  <h3 className="font-heading text-base font-bold text-foreground">
                    Create a custom template
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Define a dedicated brief and pricing spec for a specific
                    client profile or service package.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoFillBothFromIcp}
                  disabled={isBusy || isSubmittingForm || isGeneratingDesc || isGeneratingBrief}
                  className="rounded-xl text-xs gap-1.5 font-semibold border-primary/30 text-primary hover:bg-primary/10 shadow-2xs cursor-pointer"
                >
                  <Sparkles className="size-3.5" />
                  Auto-fill Both from Business Profile &amp; ICP
                </Button>
              </div>

              {formError && (
                <div
                  role="alert"
                  className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs font-semibold text-destructive flex items-center gap-2 animate-in fade-in"
                >
                  <AlertCircle className="size-4 shrink-0" />
                  <span className="flex-1">{formError}</span>
                  <button
                    type="button"
                    onClick={() => setFormError("")}
                    className="text-destructive/80 hover:text-destructive text-xs ml-2 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              <form className="space-y-4" onSubmit={handleCreateSubmit}>
                {/* Name Field */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="custom-tpl-name"
                    className="block text-xs font-semibold text-foreground"
                  >
                    Template Name
                  </label>
                  <Input
                    id="custom-tpl-name"
                    autoFocus
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (formError) setFormError("");
                    }}
                    disabled={isBusy || isSubmittingForm}
                    className="rounded-xl border-border/80 text-sm"
                    placeholder="e.g. Managed IT for growing teams or Multi-Location SEO"
                  />
                </div>

                {/* Description Field with AI Generate Button */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="custom-tpl-desc"
                      className="block text-xs font-semibold text-foreground"
                    >
                      Description
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateDescriptionFromIcp}
                      disabled={isBusy || isSubmittingForm || isGeneratingDesc}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-all hover:bg-primary/20 hover:border-primary/50 shadow-2xs cursor-pointer disabled:opacity-50"
                    >
                      <Wand2 className="size-3" />
                      {isGeneratingDesc ? (
                        "Synthesizing from ICP..."
                      ) : descGeneratedSuccess ? (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <Check className="size-3" /> Generated from ICP!
                        </span>
                      ) : (
                        "✨ AI Generate from ICP"
                      )}
                    </button>
                  </div>
                  <Textarea
                    id="custom-tpl-desc"
                    required
                    maxLength={1000}
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      if (formError) setFormError("");
                    }}
                    disabled={isBusy || isSubmittingForm}
                    className="rounded-xl border-border/80 text-sm min-h-24 leading-relaxed"
                    placeholder="Who is this proposal for, and what does it offer? (Or click 'AI Generate from ICP' above)"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Captures your target customer, value proposition, and buyer segment from the business profile / ICP page.
                  </p>
                </div>

                {/* Pricing Brief Field with AI Generate Button */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="custom-tpl-brief"
                      className="block text-xs font-semibold text-foreground"
                    >
                      Pricing Brief
                    </label>
                    <button
                      type="button"
                      onClick={handleGeneratePricingBriefFromIcp}
                      disabled={isBusy || isSubmittingForm || isGeneratingBrief}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-all hover:bg-primary/20 hover:border-primary/50 shadow-2xs cursor-pointer disabled:opacity-50"
                    >
                      <Wand2 className="size-3" />
                      {isGeneratingBrief ? (
                        "Structuring from ICP..."
                      ) : briefGeneratedSuccess ? (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <Check className="size-3" /> Structured from ICP!
                        </span>
                      ) : (
                        "✨ AI Generate from ICP"
                      )}
                    </button>
                  </div>
                  <Textarea
                    id="custom-tpl-brief"
                    required
                    maxLength={20000}
                    className="min-h-40 rounded-xl border-border/80 text-xs font-mono leading-relaxed"
                    value={brief}
                    onChange={(e) => {
                      setBrief(e.target.value);
                      if (formError) setFormError("");
                    }}
                    disabled={isBusy || isSubmittingForm}
                    placeholder="Describe your packages, rates, conditions, add-ons, and discounts... (Or click 'AI Generate from ICP' above)"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Populates approved retainers, setup fees, payment terms, and guarantees from your Business Profile / ICP pricing specification.
                  </p>
                </div>

                {/* Footer Submit Buttons */}
                <div className="flex gap-2.5 pt-2">
                  <Button
                    type="button"
                    disabled={isBusy || isSubmittingForm}
                    onClick={() => void handleCreateSubmit()}
                    className="rounded-xl font-semibold text-xs shadow-xs gap-1.5 cursor-pointer"
                  >
                    {isSubmittingForm ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Saving &amp; opening template...
                      </>
                    ) : (
                      "Save and open template"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={isBusy || isSubmittingForm}
                    onClick={() => setCreating(false)}
                    className="rounded-xl text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Template Cards Grid */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((row) => {
              const isAssigned =
                !emailDirty && routing?.template_id === row.template_id;
              return (
                <Card
                  key={row.template_id}
                  className={`group relative overflow-hidden rounded-2xl border transition-all hover:border-primary/40 hover:shadow-md ${
                    isAssigned
                      ? "border-primary ring-2 ring-primary/20 bg-primary/[0.02]"
                      : "border-border/80 bg-card"
                  }`}
                >
                  {isAssigned && (
                    <div className="absolute top-3 left-4 flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                      <Mail className="size-3" />
                      Assigned Lead
                    </div>
                  )}

                  <button
                    disabled={isBusy}
                    onClick={() => onSelectTemplate(row.template_id)}
                    className="flex h-full min-h-60 w-full flex-col p-6 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 cursor-pointer"
                  >
                    <div
                      className={`flex size-10 items-center justify-center rounded-xl border border-primary/15 bg-primary/5 text-primary ${
                        isAssigned ? "mt-6 mb-3" : "mb-4"
                      }`}
                    >
                      <FileText className="size-5" />
                    </div>

                    <h3 className="font-heading text-base font-bold tracking-tight text-foreground break-words leading-snug">
                      {row.name}
                    </h3>

                    <p
                      title={row.description || undefined}
                      className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground break-words"
                    >
                      {row.description ||
                        "Continue setting up this proposal template with isolated briefing, variables, and pricing engine."}
                    </p>

                    <div className="mt-auto flex items-center gap-1.5 pt-5 text-xs font-semibold text-primary">
                      Open template
                      <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                  </button>

                  {/* Delete Template Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isBusy}
                    aria-label={`Delete ${row.name}`}
                    title={`Delete ${row.name}`}
                    className="absolute top-3 right-3 size-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                    onClick={() => void onDeleteTemplate(row)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
