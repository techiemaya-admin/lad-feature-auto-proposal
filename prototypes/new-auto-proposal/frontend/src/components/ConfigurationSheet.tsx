import { useEffect, useState } from "react";
import { PenLine, MessageCircleQuestion, FileText } from "lucide-react";
import {
  fetchConfiguration,
  updateConfiguration,
  type CompanyConfiguration,
  type ConfigurationPatch,
} from "../services/api";
import { Button } from "./ui/button";
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
  onNotify: (n: { type: "success" | "error" | "info"; message: string }) => void;
}

type Draft = Required<ConfigurationPatch>;

const EMPTY_DRAFT: Draft = {
  style_notes: "",
  reference_proposal_text: "",
  clarification_notes: "",
};

const MAX_CHARS = 6000; // mirrors MAX_NOTE_CHARS on the backend

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
      "e.g. Warm but direct. Lead with the outcome, then the price. Short paragraphs, no buzzwords. Always mention our 24-hour response guarantee and sign off as the account manager, never “the team”.",
    rows: 5,
  },
  {
    key: "reference_proposal_text",
    icon: FileText,
    label: "A proposal you’re proud of (optional)",
    hint: "Paste a real proposal email you’ve sent. The drafter studies its voice and structure — never its numbers.",
    placeholder:
      "Hi Sarah,\n\nThanks for the call yesterday — here’s what we discussed for the Chicago rollout…\n\n(Paste the whole email. Client names are fine; they’re never reused.)",
    rows: 8,
  },
  {
    key: "clarification_notes",
    icon: MessageCircleQuestion,
    label: "When a lead’s request is missing details",
    hint: "Guides the clarification email the drafter sends before it can price the work.",
    placeholder:
      "e.g. Ask at most two questions, in a friendly, low-pressure tone. Say we can send a proposal within the hour once we hear back. Never guess at seat counts or locations.",
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

export function ConfigurationSheet({ open, onOpenChange, companyId, companyName, onNotify }: ConfigurationSheetProps) {
  const [saved, setSaved] = useState<CompanyConfiguration | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [isSaving, setIsSaving] = useState(false);

  // Switching company drops everything loaded for the previous one before the effect below refetches.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (loadedFor !== companyId) {
    setLoadedFor(companyId);
    setSaved(null);
    setDraft(EMPTY_DRAFT);
  }

  // Refetch every time the sheet opens so it always shows what is actually saved.
  useEffect(() => {
    if (!open) return;
    let ignore = false;
    fetchConfiguration(companyId)
      .then((config) => {
        if (ignore) return;
        setSaved(config);
        setDraft(pickDraft(config));
      })
      .catch((err) => onNotify({ type: "error", message: err instanceof Error ? err.message : "Couldn’t load settings" }));
    return () => {
      ignore = true;
    };
  }, [open, companyId, onNotify]);

  const isDirty = saved !== null && FIELDS.some(({ key }) => draft[key] !== saved[key]);

  // Cancel, Esc and the backdrop all discard the unsaved draft.
  const close = () => {
    if (saved) setDraft(pickDraft(saved));
    onOpenChange(false);
  };

  const handleSave = async () => {
    if (!saved || !isDirty) return;
    const patch: ConfigurationPatch = {};
    for (const { key } of FIELDS) if (draft[key] !== saved[key]) patch[key] = draft[key];
    setIsSaving(true);
    try {
      const next = await updateConfiguration(companyId, patch);
      setSaved(next);
      setDraft(pickDraft(next));
      onNotify({ type: "success", message: `Voice saved for ${companyName}.` });
      onOpenChange(false);
    } catch (err) {
      onNotify({ type: "error", message: err instanceof Error ? err.message : "Couldn’t save settings" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-card text-card-foreground gap-0 p-0">
        <SheetHeader className="border-b border-border/60 px-5 py-4 pr-12">
          <SheetTitle className="text-sm font-semibold tracking-tight">Voice</SheetTitle>
          <SheetDescription className="text-xs">
            How <span className="font-medium text-foreground">{companyName}</span>’s proposals sound. The inbox lives in the template library.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {FIELDS.map(({ key, icon: Icon, label, hint, placeholder, rows }) => (
            <section key={key} className="space-y-1.5">
              <label htmlFor={`config-${key}`} className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Icon className="size-3.5 text-primary" />
                {label}
              </label>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{hint}</p>
              <Textarea
                id={`config-${key}`}
                value={draft[key]}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                placeholder={placeholder}
                rows={rows}
                maxLength={MAX_CHARS}
                disabled={saved === null}
                className="text-xs leading-relaxed resize-y bg-background"
              />
            </section>
          ))}

        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t border-border/60 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={close} disabled={isSaving} className="h-8 text-xs">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!isDirty || isSaving} className="h-8 text-xs">
            {isSaving ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default ConfigurationSheet;
