import { ArrowUpRight, FileText, Trash2 } from "lucide-react"
import { Button } from "./ui/button"
import { Card } from "./ui/card"
import type { ProposalTemplateSummary } from "../services/api"

interface TemplateLibraryCardProps {
  template: ProposalTemplateSummary
  highlighted: boolean
  disabled: boolean
  onOpen: (templateId: string) => void
  onDelete: (template: ProposalTemplateSummary) => void
}

export default function TemplateLibraryCard({
  template,
  highlighted,
  disabled,
  onOpen,
  onDelete,
}: TemplateLibraryCardProps) {
  return (
    <Card
      className={`group relative overflow-hidden rounded-2xl py-0 shadow-sm transition-all hover:border-primary/30 hover:shadow-md ${highlighted ? "border-primary ring-2 ring-primary/20" : ""}`}
    >
      <button
        disabled={disabled}
        onClick={() => onOpen(template.template_id)}
        className="flex h-full min-h-64 w-full flex-col p-6 text-left focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary disabled:opacity-50"
      >
        <div className="mb-4 flex size-10 items-center justify-center rounded-lg border border-primary/10 bg-primary/5 text-primary">
          <FileText className="size-5" />
        </div>
        <h2 className="text-base leading-snug font-semibold tracking-tight break-words">
          {template.name}
        </h2>
        <p
          title={template.description || undefined}
          className="mt-2 line-clamp-4 text-[13px] leading-5 break-words text-muted-foreground"
        >
          {template.description ||
            "Continue setting up this saved proposal template."}
        </p>
        <span className="mt-auto flex items-center gap-2 pt-5 text-xs font-medium text-primary">
          Open template
          <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </button>
      <Button
        variant="ghost"
        size="icon"
        disabled={disabled}
        aria-label={`Delete ${template.name}`}
        title={`Delete ${template.name}`}
        className="absolute top-3 right-3 text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(template)}
      >
        <Trash2 className="size-4" />
      </Button>
    </Card>
  )
}
