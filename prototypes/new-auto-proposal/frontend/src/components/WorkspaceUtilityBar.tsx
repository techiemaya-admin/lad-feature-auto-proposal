import React, { useState } from "react";
import { RotateCcw, PenLine } from "lucide-react";
import { Button } from "./ui/button";
import ConfirmDialog from "./ConfirmDialog";

interface WorkspaceUtilityBarProps {
  isLoading: boolean;
  onOpenSettings: () => void;
  onReset: () => Promise<void>;
  templateName?: string;
}

export const WorkspaceUtilityBar: React.FC<WorkspaceUtilityBarProps> = ({
  isLoading,
  onOpenSettings,
  onReset,
  templateName,
}) => {
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleReset = async () => {
    setShowResetConfirm(false);
    setIsResetting(true);
    try {
      await onReset();
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
    <div className="flex items-center gap-1 shrink-0">
      {/* Voice-only: the inbox moved to the template library. Reset is a mock-data chore and stays ghost. */}
      <Button
        variant="outline"
        size="sm"
        onClick={onOpenSettings}
        disabled={isLoading}
        className="h-7 px-2.5 text-[11px] font-medium text-foreground border-border bg-background transition-colors hover:bg-muted hover:text-foreground hover:border-border"
        title="Edit how your proposals sound"
      >
        <PenLine className="size-3 mr-1 text-primary" />
        Voice
      </Button>
      <span className="mx-1.5 h-4 w-px bg-border/70" aria-hidden="true" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowResetConfirm(true)}
        disabled={isResetting || isLoading}
        className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors font-normal"
        title="Reset this template's pricing and progress to mock defaults"
      >
        <RotateCcw className={`size-3 mr-1 ${isResetting ? "animate-spin" : ""}`} />
        {isResetting ? "Resetting..." : "Reset"}
      </Button>
    </div>
    <ConfirmDialog
      open={showResetConfirm}
      title={`Reset "${templateName || "this template"}"?`}
      description="This resets pricing and progress to mock defaults. Other templates are unaffected."
      confirmLabel="Reset template"
      variant="destructive"
      isBusy={isResetting}
      onConfirm={() => void handleReset()}
      onCancel={() => setShowResetConfirm(false)}
    />
    </>
  );
};
