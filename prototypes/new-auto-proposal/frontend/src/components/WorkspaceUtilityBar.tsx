import React, { useState } from "react";
import { RotateCcw, PenLine } from "lucide-react";
import { Button } from "./ui/button";

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
      {/* Voice-only: the inbox moved to the template library. Reset is a mock-data chore and stays ghost. */}
      <Button
        variant="outline"
        size="sm"
        onClick={onOpenSettings}
        disabled={isLoading}
        className="h-7 px-2.5 text-[11px] font-medium text-foreground/80 hover:text-primary hover:border-primary/40 hover:bg-primary/5 btn-tactile"
        title="Edit how your proposals sound"
      >
        <PenLine className="size-3 mr-1 text-muted-foreground/70" />
        Voice
      </Button>
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
