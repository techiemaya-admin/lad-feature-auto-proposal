import React, { useState } from "react";
import { RotateCcw, Mail, MailCheck } from "lucide-react";
import { Button } from "./ui/button";

interface WorkspaceUtilityBarProps {
  isLoading: boolean;
  onOpenSettings: () => void;
  /** null while unknown — the CTA stays neutral until the status has loaded */
  emailConnected: boolean | null;
  onReset: () => Promise<void>;
  templateName?: string;
}

export const WorkspaceUtilityBar: React.FC<WorkspaceUtilityBarProps> = ({
  isLoading,
  onOpenSettings,
  emailConnected,
  onReset,
  templateName,
}) => {
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    if (
      window.confirm(
        `Reset pricing and progress for "${templateName || "this template"}"? Other templates are unaffected.`
      )
    ) {
      setIsResetting(true);
      try {
        await onReset();
      } finally {
        setIsResetting(false);
      }
    }
  };

  return (
    <div className="flex items-center gap-1 shrink-0">
      {/* The tenant's own control, so it sits with the workspace, not in the developer header.
          The row's one solid button until the inbox is linked (nothing can be sent before that),
          then a quiet outline pill. Reset is a mock-data chore and stays ghost. */}
      {emailConnected === false ? (
        <Button
          size="sm"
          onClick={onOpenSettings}
          disabled={isLoading}
          className="h-7 pl-2 pr-2.5 text-[11px] font-semibold shadow-sm shadow-primary/25 btn-tactile"
          title="Set how your proposals sound and link the inbox they go out from"
        >
          <span className="size-1.5 rounded-full bg-amber-300 mr-1.5" aria-hidden="true" />
          <Mail className="size-3 mr-1" />
          Set up voice &amp; inbox
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenSettings}
          disabled={isLoading || emailConnected === null}
          className="h-7 px-2.5 text-[11px] font-medium text-foreground/80 hover:text-primary hover:border-primary/40 hover:bg-primary/5 btn-tactile"
          title={emailConnected ? "Inbox linked · edit how your proposals sound" : "Loading…"}
        >
          <MailCheck className={`size-3 mr-1 ${emailConnected ? "text-emerald-500" : "text-muted-foreground/50"}`} />
          Voice &amp; inbox
          {emailConnected && <span className="ml-1.5 size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />}
        </Button>
      )}
      <span className="mx-1.5 h-4 w-px bg-border/70" aria-hidden="true" />

      <Button
        variant="ghost"
        size="sm"
        onClick={handleReset}
        disabled={isResetting || isLoading}
        className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 btn-tactile font-normal"
        title="Reset this template's pricing and progress to mock defaults"
      >
        <RotateCcw className={`size-3 mr-1 ${isResetting ? "animate-spin" : ""}`} />
        {isResetting ? "Resetting..." : "Reset"}
      </Button>
    </div>
  );
};
