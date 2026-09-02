import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from "lucide-react"
import { cn } from "@/lib/utils"

export type NotificationType = "success" | "error" | "info" | "warning"

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  message?: string
  timestamp?: number
}

interface NotificationBannerProps {
  notifications: NotificationItem[]
  onDismiss: (id: string) => void
}

export function NotificationBanner({
  notifications,
  onDismiss,
}: NotificationBannerProps) {
  if (notifications.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm sm:max-w-md w-full px-2 pointer-events-none">
      {notifications.map((notif) => {
        const icons = {
          success: <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />,
          error: <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />,
          warning: <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />,
          info: <Info className="size-4 text-primary shrink-0 mt-0.5" />,
        }

        const borderColors = {
          success: "border-emerald-500/30 bg-emerald-500/10 text-foreground",
          error: "border-destructive/30 bg-destructive/10 text-foreground",
          warning: "border-amber-500/30 bg-amber-500/10 text-foreground",
          info: "border-primary/30 bg-primary/10 text-foreground",
        }

        return (
          <div
            key={notif.id}
            className={cn(
              "pointer-events-auto flex items-start justify-between gap-3 p-3 rounded-lg border shadow-lg backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2 duration-200",
              borderColors[notif.type]
            )}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              {icons[notif.type]}
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-xs font-semibold leading-tight break-words">
                  {notif.title}
                </span>
                {notif.message && (
                  <span className="text-xs text-muted-foreground leading-normal break-words">
                    {notif.message}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => onDismiss(notif.id)}
              className="text-muted-foreground hover:text-foreground rounded p-0.5 transition-colors shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
