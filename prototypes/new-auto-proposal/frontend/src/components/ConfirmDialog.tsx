import { useEffect } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "./ui/button"

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  /** "destructive" for irreversible actions (delete), "default" otherwise. */
  variant?: "destructive" | "default"
  isBusy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Shared confirmation dialog. Replaces `window.confirm` with the same
 * modal styling used across the workspace (PromptDocCapsule hard-reset,
 * template/preview dialogs) so confirmations feel native to the app.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  isBusy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex animate-in items-center justify-center bg-black/50 p-4 backdrop-blur-xs duration-150 fade-in">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md animate-in space-y-4 rounded-2xl border border-border bg-card p-6 shadow-2xl duration-150 zoom-in-95"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-foreground">{title}</h4>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isBusy}
            className="h-8 text-xs"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            size="sm"
            onClick={onConfirm}
            disabled={isBusy}
            className="btn-tactile h-8 text-xs"
          >
            {isBusy ? (
              <>
                <Loader2 className="mr-1.5 size-3 animate-spin" />
                Working...
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
