import { ArrowDown, ArrowUp, Plus, Sparkles, Trash2 } from "lucide-react"
import { Button } from "./ui/button"

export interface SampleSection {
  id: string
  title: string
  content: string
  position: string
  instructions: string
}
export const newSampleSection = (): SampleSection => ({
  id: crypto.randomUUID(),
  title: "Room to grow",
  content: "",
  position: "before_terms",
  instructions: "",
})
const field =
  "mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm"

export function SampleSectionsEditor({
  sections,
  onChange,
  onGenerate,
  disabled,
}: {
  sections: SampleSection[]
  onChange: (sections: SampleSection[]) => void
  onGenerate: (section: SampleSection) => void
  disabled: boolean
}) {
  const update = (id: string, patch: Partial<SampleSection>) =>
    onChange(
      sections.map((section) =>
        section.id === id ? { ...section, ...patch } : section
      )
    )
  const move = (index: number, direction: number) => {
    const result = [...sections]
    ;[result[index], result[index + direction]] = [
      result[index + direction],
      result[index],
    ]
    onChange(result)
  }
  return (
    <fieldset
      disabled={disabled}
      className="space-y-3 rounded-xl border border-border p-4"
    >
      <div>
        <h4 className="text-sm font-semibold">Custom sections</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose a title and let AI draft the content, or write it yourself.
          Sections are included in the Word document and available for paragraph
          review in the next step.
        </p>
      </div>
      {sections.map((section, index) => (
        <div key={section.id} className="space-y-3 rounded-lg bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Section {index + 1}</span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Move section ${index + 1} up`}
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Move section ${index + 1} down`}
                disabled={disabled || index === sections.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown className="size-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Remove section ${index + 1}`}
                onClick={() =>
                  onChange(sections.filter((row) => row.id !== section.id))
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium">
              Title
              <input
                className={field}
                maxLength={120}
                value={section.title}
                onChange={(e) => update(section.id, { title: e.target.value })}
              />
            </label>
            <label className="text-xs font-medium">
              Position
              <select
                className={field}
                value={section.position}
                onChange={(e) =>
                  update(section.id, { position: e.target.value })
                }
              >
                <option value="before_scope">After overview</option>
                <option value="before_pricing">After scope</option>
                <option value="before_terms">Before terms</option>
                <option value="after_terms">After terms</option>
              </select>
            </label>
          </div>
          <label className="block text-xs font-medium">
            Instructions for AI (optional)
            <input
              className={field}
              maxLength={2000}
              placeholder="e.g. Suggest relevant upgrades outside the quoted scope"
              value={section.instructions}
              onChange={(e) =>
                update(section.id, { instructions: e.target.value })
              }
            />
          </label>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={disabled || !section.title.trim()}
            onClick={() => onGenerate(section)}
          >
            <Sparkles className="size-4" />
            {section.content ? "Regenerate section" : "Generate section"}
          </Button>
          <label className="block text-xs font-medium">
            Content
            <textarea
              className={field}
              rows={5}
              maxLength={4000}
              value={section.content}
              placeholder="Generate a draft above or write your own section…"
              onChange={(e) => update(section.id, { content: e.target.value })}
            />
          </label>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || sections.length >= 8}
        onClick={() => onChange([...sections, newSampleSection()])}
      >
        <Plus className="mr-2 size-4" />
        Add section
      </Button>
      <p className="text-xs text-muted-foreground">
        Up to eight sections. Sections at the same position follow the order
        shown. Optional upgrades do not change the quoted total.
      </p>
    </fieldset>
  )
}
