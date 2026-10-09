import { useState } from "react";
import { ArrowUpRight, ChevronDown, FlaskConical, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Textarea } from "./ui/textarea";
import { CustomDropdown } from "./ui/custom-dropdown";
import type { EmailRoutingResult } from "../services/api";
import type { ProposalTemplateSummary } from "../services/api";

interface RoutingTestPanelProps {
  email: string;
  onEmailChange: (value: string) => void;
  routing: EmailRoutingResult | null;
  routingBusy: boolean;
  busy: boolean;
  emailDirty: boolean;
  templates: ProposalTemplateSummary[];
  onRoute: () => void;
  onReset: () => void;
  onReassign: (templateId: string) => void;
  onOpenTemplate: (templateId: string) => void;
  defaultOpen?: boolean;
}

const EMAIL_MAX = 12000;

export default function RoutingTestPanel({
  email,
  onEmailChange,
  routing,
  routingBusy,
  busy,
  emailDirty,
  templates,
  onRoute,
  onReset,
  onReassign,
  onOpenTemplate,
  defaultOpen = false,
}: RoutingTestPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const assignedName = routing?.template_id
    ? (templates.find((t) => t.template_id === routing.template_id)?.name ??
      "template")
    : null;

  const statusLabel = emailDirty
    ? "Edited"
    : routing?.template_id
      ? `Goes to ${assignedName}`
      : "No match";

  const showAnswer = routing && !emailDirty && !routingBusy;
  const quotedEmail =
    routing && routing.email.length > 140
      ? `${routing.email.slice(0, 140).trimEnd()}…`
      : (routing?.email ?? "");

  return (
    <section aria-label="Routing test" className="mt-10">
      <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="routing-test-body"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-3 p-5 text-left transition-colors hover:bg-muted/40 sm:px-6"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/60 text-muted-foreground">
            <FlaskConical className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold tracking-tight">
              Check a lead email
            </span>
          </span>
          {/* <span className="hidden max-w-44 shrink-0 truncate rounded-full border border-border/60 bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground sm:inline-block">
            {statusLabel}
          </span> */}
          <ChevronDown
            className={`size-4 shrink-0 text-muted-foreground transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div
            id="routing-test-body"
            className="space-y-5 border-t border-border/60 px-5 py-5 sm:px-6 sm:py-6"
          >
            <p className="text-[13px] leading-5 text-muted-foreground">
              Paste an email, see which template fits.
            </p>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <label
                  htmlFor="routing-test-message"
                  className="text-sm font-medium"
                >
                  Lead email
                </label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {email.length}/{EMAIL_MAX}
                </span>
              </div>
              <Textarea
                id="routing-test-message"
                aria-label="Lead email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                disabled={busy}
                maxLength={EMAIL_MAX}
                placeholder="Paste a lead email to see which template it matches…"
                className="min-h-28 text-sm leading-6"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={busy || !email.trim() || !routing}
                onClick={onRoute}
              >
                <Sparkles className="size-4" />
                {routingBusy ? "Checking…" : "Check"}
              </Button>
              {emailDirty && (
                <Button
                  variant="ghost"
                  disabled={busy || !routing}
                  onClick={onReset}
                >
                  <RotateCcw className="size-4" />
                  Reset
                </Button>
              )}
              {routingBusy && (
                <span className="text-sm text-muted-foreground motion-safe:animate-pulse">
                  Comparing…
                </span>
              )}
            </div>

            {showAnswer && (
              <div
                role="status"
                className="space-y-1.5 rounded-xl border border-border/60 bg-muted/40 p-4"
              >
                <p className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                  <span
                    aria-hidden="true"
                    className={`size-1.5 shrink-0 rounded-full ${routing.template_id ? "bg-emerald-500" : "bg-amber-500"}`}
                  />
                  {routing.template_id
                    ? `Goes to ${assignedName}`
                    : "No match"}
                </p>
                {quotedEmail && (
                  <p
                    title={routing.email || undefined}
                    className="line-clamp-2 text-[13px] leading-5 break-words text-muted-foreground"
                  >
                    “{quotedEmail}”
                  </p>
                )}
                {routing.reason && (
                  <p className="text-[13px] leading-5 text-muted-foreground">
                    {routing.reason}
                  </p>
                )}
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  {routing.source === "manual" ? (
                    <span>You chose this</span>
                  ) : routing.routed_at ? (
                    <span>
                      Checked {new Date(routing.routed_at).toLocaleString()}
                    </span>
                  ) : null}
                  {routing.template_id && (
                    <button
                      type="button"
                      onClick={() => onOpenTemplate(routing.template_id!)}
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      Open template
                      <ArrowUpRight className="size-3.5" />
                    </button>
                  )}
                </p>
              </div>
            )}

            {showAnswer && (
              <details className="group pt-1">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  Not right? Choose another…
                </summary>
                <div className="mt-2">
                  <CustomDropdown
                    size="md"
                    className="w-full"
                    value={routing.template_id ?? ""}
                    placeholder="Choose a template…"
                    disabled={busy}
                    options={templates.map((t) => ({
                      value: t.template_id,
                      label: t.name,
                    }))}
                    onChange={(v) => {
                      if (v) onReassign(v);
                    }}
                  />
                </div>
              </details>
            )}
          </div>
        )}
      </Card>
    </section>
  );
}
