import { useEffect, useState } from "react";
import { Loader2, Mail, MailCheck, MessageCircleQuestion, PenLine, Sparkles } from "lucide-react";
import {
  connectEmail,
  disconnectEmail,
  fetchConfiguration,
  updateConfiguration,
  type CompanyConfiguration,
  type ConfigurationPatch,
} from "../services/api";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";

interface ConfigurationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
  onNotify: (notification: { type: "success" | "error" | "info"; message: string }) => void;
  onConfigurationChange?: (config: CompanyConfiguration) => void;
}

type Draft = Required<ConfigurationPatch>;

const EMPTY_DRAFT: Draft = {
  style_notes: "",
  reference_proposal_text: "",
  clarification_notes: "",
};

const MAX_CHARS = 6000;

const FIELDS: Array<{
  key: keyof Draft;
  icon: typeof PenLine;
  label: string;
  hint: string;
  placeholder: string;
  rows: number;
}> = [
  {
    key: "style_notes",
    icon: PenLine,
    label: "How your proposals should sound",
    hint: "The drafter follows these notes for every proposal it writes.",
    placeholder:
      "e.g. Warm but direct. Lead with the outcome, then the price. Short paragraphs, no buzzwords. Always mention our response guarantee and sign off as the account manager.",
    rows: 5,
  },
  {
    key: "reference_proposal_text",
    icon: Mail,
    label: "A proposal you are proud of (optional)",
    hint: "Paste a real proposal email. The drafter studies its voice and structure, never its numbers.",
    placeholder:
      "Hi Sarah,\n\nThanks for the call yesterday — here is what we discussed for the Chicago rollout…\n\nPaste the whole email here.",
    rows: 8,
  },
  {
    key: "clarification_notes",
    icon: MessageCircleQuestion,
    label: "When a lead is missing details",
    hint: "Guide the clarification email the drafter sends before it can price the work.",
    placeholder:
      "e.g. Ask at most two questions in a friendly, low-pressure tone. Never guess at seat counts or locations.",
    rows: 4,
  },
];

function pickDraft(config: CompanyConfiguration): Draft {
  return {
    style_notes: config.style_notes,
    reference_proposal_text: config.reference_proposal_text,
    clarification_notes: config.clarification_notes,
  };
}

export function ConfigurationSheet({
  open,
  onOpenChange,
  companyId,
  companyName,
  onNotify,
  onConfigurationChange,
}: ConfigurationSheetProps) {
  const [saved, setSaved] = useState<CompanyConfiguration | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [isSaving, setIsSaving] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);

  useEffect(() => {
    setSaved(null);
    setDraft(EMPTY_DRAFT);
  }, [companyId]);

  useEffect(() => {
    if (!open) return;
    let ignore = false;

    fetchConfiguration(companyId)
      .then((config) => {
        if (ignore) return;
        setSaved(config);
        setDraft(pickDraft(config));
        onConfigurationChange?.(config);
      })
      .catch((err) => {
        if (ignore) return;
        onNotify({ type: "error", message: err instanceof Error ? err.message : "Could not load voice and inbox settings." });
      });

    return () => {
      ignore = true;
    };
  }, [open, companyId, onNotify, onConfigurationChange]);

  const isDirty = saved !== null && FIELDS.some(({ key }) => draft[key] !== saved[key]);
  const connected = saved?.email_connected ?? false;

  const close = () => {
    if (saved) setDraft(pickDraft(saved));
    onOpenChange(false);
  };

  const handleSave = async () => {
    if (!saved || !isDirty) return;
    const patch: ConfigurationPatch = {};
    for (const { key } of FIELDS) {
      if (draft[key] !== saved[key]) patch[key] = draft[key];
    }

    setIsSaving(true);
    try {
      const next = await updateConfiguration(companyId, patch);
      setSaved(next);
      setDraft(pickDraft(next));
      onConfigurationChange?.(next);
      onNotify({ type: "success", message: `Voice saved for ${companyName}.` });
      onOpenChange(false);
    } catch (err) {
      onNotify({ type: "error", message: err instanceof Error ? err.message : "Could not save voice settings." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEmailToggle = async () => {
    if (!saved) return;
    setEmailBusy(true);

    try {
      const next = saved.email_connected
        ? await disconnectEmail(companyId)
        : await connectEmail(companyId);
      setSaved(next);
      onConfigurationChange?.(next);
      onNotify({
        type: "info",
        message: next.email_connected ? `Inbox linked: ${next.email_address}` : "Inbox disconnected.",
      });
    } catch (err) {
      onNotify({ type: "error", message: err instanceof Error ? err.message : "Could not update the inbox connection." });
    } finally {
      setEmailBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <SheetContent side="right" className="w-full gap-0 border-l border-border/80 bg-card p-0 text-card-foreground shadow-2xl sm:max-w-lg">
        <SheetHeader className="border-b border-border/70 bg-muted/20 px-6 py-5 pr-14">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="text-base font-semibold tracking-tight">Voice &amp; inbox</SheetTitle>
                <Badge variant="outline" className="text-[10px]">Workspace settings</Badge>
              </div>
              <SheetDescription className="mt-1 text-xs leading-5">
                Shape how <span className="font-semibold text-foreground">{companyName}</span> sounds, then choose where replies are sent from.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {FIELDS.map(({ key, icon: Icon, label, hint, placeholder, rows }) => (
            <section key={key} className="space-y-2 rounded-2xl border border-border/70 bg-muted/20 p-4">
              <label htmlFor={`config-${key}`} className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Icon className="size-3.5 text-primary" />
                {label}
              </label>
              <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
              <Textarea
                id={`config-${key}`}
                value={draft[key]}
                onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                placeholder={placeholder}
                rows={rows}
                maxLength={MAX_CHARS}
                disabled={saved === null}
                className="min-h-24 resize-y rounded-xl border-border/80 bg-card text-xs leading-relaxed shadow-sm focus-visible:ring-primary/20"
              />
            </section>
          ))}

          <section className="space-y-3 rounded-2xl border border-primary/15 bg-primary/[0.045] p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                {connected ? <MailCheck className="size-3.5 text-emerald-500" /> : <Mail className="size-3.5 text-primary" />}
                Send from your inbox
              </div>
              {connected ? (
                <Badge variant="success" className="text-[10px]">Connected</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">Not connected</Badge>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {connected ? (
                <>Proposals and clarification emails go out from <span className="font-semibold text-foreground">{saved?.email_address}</span>.</>
              ) : (
                "Link the inbox on your company profile so proposals reach leads from an address they already recognise."
              )}
            </p>
            <Button
              size="sm"
              variant={connected ? "outline" : "default"}
              onClick={handleEmailToggle}
              disabled={emailBusy || saved === null}
              className="h-9 rounded-xl px-3 text-xs font-semibold"
            >
              {emailBusy ? (
                <><Loader2 className="size-3.5 animate-spin" /> {connected ? "Disconnecting…" : "Linking inbox…"}</>
              ) : connected ? (
                "Disconnect"
              ) : (
                "Connect inbox"
              )}
            </Button>
          </section>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t border-border/70 bg-muted/20 px-6 py-4">
          <Button variant="ghost" size="sm" onClick={close} disabled={isSaving} className="h-9 rounded-xl px-3 text-xs">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!isDirty || isSaving} className="h-9 rounded-xl px-4 text-xs font-semibold">
            {isSaving ? <><Loader2 className="size-3.5 animate-spin" /> Saving…</> : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default ConfigurationSheet;
