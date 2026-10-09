import { Loader2 } from "lucide-react"
import { Button } from "./ui/button"
import type { CompanyConfiguration } from "../services/api"

interface CompanyInboxControlProps {
  /** null while unknown — renders a neutral loading line, never a false "not linked" */
  configuration: CompanyConfiguration | null
  disabled?: boolean
  inboxBusy: boolean
  onToggle: () => void
}

export default function CompanyInboxControl({
  configuration,
  disabled,
  inboxBusy,
  onToggle,
}: CompanyInboxControlProps) {
  const busy = inboxBusy || disabled

  if (!configuration) {
    return (
      <p
        aria-live="polite"
        className="mt-2 text-xs text-muted-foreground motion-safe:animate-pulse"
      >
        Checking inbox…
      </p>
    )
  }

  const connected = configuration.email_connected

  return (
    <div
      aria-live="polite"
      className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-400"}`}
      />
      {connected ? (
        <span>
          Sends from{" "}
          <span className="font-medium text-foreground">
            {configuration.email_address}
          </span>
        </span>
      ) : (
        <span>Inbox not linked — proposals can&apos;t go out yet</span>
      )}
      <Button
        type="button"
        variant="link"
        disabled={busy}
        onClick={onToggle}
        className="h-auto p-0 text-xs font-medium"
      >
        {inboxBusy ? (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="size-3 animate-spin" />
            {connected ? "Disconnecting…" : "Linking…"}
          </span>
        ) : connected ? (
          "Disconnect"
        ) : (
          "Connect inbox"
        )}
      </Button>
    </div>
  )
}
