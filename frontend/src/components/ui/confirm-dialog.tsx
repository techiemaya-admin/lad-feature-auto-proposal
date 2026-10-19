import { useEffect } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "./button";
import { cn } from "cn";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string | null;
  variant?: "danger" | "default";
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  variant = "default",
  isBusy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onCancel]);

  if (!open) return null;

  const isDanger = variant === "danger";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        aria-describedby="confirm-dialog-description"
        className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-lg space-y-4 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl border",
              isDanger
                ? "border-destructive/20 bg-destructive/10 text-destructive"
                : "border-primary/15 bg-primary/5 text-primary"
            )}
          >
            {isDanger ? <Trash2 className="size-5" /> : <ArrowLeft className="size-5" />}
          </div>
          <div className="space-y-1">
            <h2 className="font-heading text-base font-bold tracking-tight text-foreground">
              {title}
            </h2>
            <p id="confirm-dialog-description" className="text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          {cancelLabel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isBusy}
              className="rounded-xl text-xs font-semibold"
            >
              {cancelLabel}
            </Button>
          )}
          <Button
            type="button"
            variant={isDanger ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={isBusy}
            className="rounded-xl text-xs font-semibold gap-1.5"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
