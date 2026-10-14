import { useEffect, useRef, useState } from "react"
import { Loader2, Sparkles, Plus, Trash2 } from "lucide-react"
import { Button } from "./ui/button"
import type { Company } from "../types/company"
import {
  SampleSectionsEditor,
  newSampleSection,
  type SampleSection,
} from "./SampleSectionsEditor"

interface Draft {
  title: string
  overview: string
  scope: string
  terms: string
  items: string[]
}
interface Line {
  quantity: string
  rate: string
  discount: string
  tax: string
  period: string
}
const emptyLine = (): Line => ({
  quantity: "1",
  rate: "",
  discount: "",
  tax: "",
  period: "one-time",
})
const fieldClass =
  "w-full rounded-lg border border-border bg-background p-2 text-sm text-foreground"

export function SampleProposalBuilder({
  company,
  pricingBrief,
  disabled,
  onFile,
  onOpenChange,
}: {
  company: Company
  pricingBrief: string
  disabled: boolean
  onFile: (file: File, notes: string[]) => void
  onOpenChange: (open: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [customer, setCustomer] = useState("Example Customer")
  const [currency, setCurrency] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [sourceBrief, setSourceBrief] = useState("")
  const [ready, setReady] = useState(false)
  const [scenario, setScenario] = useState("")
  const [questions, setQuestions] = useState<string[]>([])
  const [totals, setTotals] = useState<{ period: string; amount: string }[]>([])
  const [sources, setSources] = useState<string[]>([])
  const [sections, setSections] = useState<SampleSection[]>([])
  const sectionsValid = sections.every(
    (section) => section.title.trim() && section.content.trim()
  )
  const briefRef = useRef(pricingBrief)
  briefRef.current = pricingBrief
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const base = `/api/companies/${encodeURIComponent(company.company_id)}/templates/${encodeURIComponent(company.template_id!)}/briefing`
  const changeOpen = (value: boolean) => {
    setOpen(value)
    onOpenChange(value)
  }
  async function post(action: string, body: unknown) {
    const response = await fetch(`${base}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(
        data.error || "Could not create the sample proposal. Try again."
      )
    }
    return response
  }
  async function generate(): Promise<boolean> {
    changeOpen(true)
    setBusy(true)
    setError("")
    setReady(false)
    setQuestions([])
    try {
      const result = await (
        await post("sample-draft", { pricing_spec: pricingBrief, sections })
      ).json()
      if (!mounted.current) return false
      if (briefRef.current !== pricingBrief)
        throw new Error(
          "The pricing brief changed during generation. Generate again to use the updated brief."
        )
      setDraft(result.draft)
      setLines(
        result.lines.map((line: Record<string, string | number | null>) => ({
          quantity: line.quantity === null ? "" : String(line.quantity),
          rate: line.rate === null ? "" : String(line.rate),
          discount: line.discount === null ? "" : String(line.discount),
          tax: line.tax === null ? "" : String(line.tax),
          period: String(line.period),
        }))
      )
      setCustomer(result.customer)
      setCurrency(result.currency)
      setScenario(result.scenario)
      setQuestions(result.questions)
      setTotals(result.totals)
      setSources(result.pricing_sources)
      setConfirmed(false)
      setSourceBrief(pricingBrief)
      if (result.document_base64) {
        const bytes = Uint8Array.from(atob(result.document_base64), (char) =>
          char.charCodeAt(0)
        )
        onFile(
          new File([bytes], "generated_sample_proposal.docx", {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          }),
          result.questions
        )
        setReady(true)
        changeOpen(false)
      }
      return true
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Generation failed.")
      return false
    } finally {
      if (mounted.current) setBusy(false)
    }
  }
  async function addSection() {
    if (!draft && !(await generate())) return
    if (!mounted.current) return
    setSections(current => [...current, newSampleSection()])
    changeOpen(true)
    setConfirmed(false)
  }
  async function attach() {
    if (!draft) return
    setBusy(true)
    setError("")
    try {
      const response = await post("sample-document", {
        draft,
        customer,
        currency,
        confirmed,
        scenario,
        sections,
        questions: questions.map((note) => note.trim()).filter(Boolean),
        lines: lines.map((line) => ({
          period: line.period,
          ...Object.fromEntries(
            ["quantity", "rate", "discount", "tax"].map((key) => [
              key,
              line[key as keyof Line].trim() === ""
                ? null
                : Number(line[key as keyof Line]),
            ])
          ),
        })),
      })
      const blob = await response.blob()
      if (!mounted.current) return
      if (briefRef.current !== sourceBrief)
        throw new Error(
          "The pricing brief changed. Regenerate the sample before attaching it."
        )
      onFile(
        new File([blob], "generated_sample_proposal.docx", { type: blob.type }),
        questions.map((note) => note.trim()).filter(Boolean)
      )
      setReady(true)
      setTotals([])
      changeOpen(false)
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Document creation failed.")
    } finally {
      if (mounted.current) setBusy(false)
    }
  }
  async function generateSection(section: SampleSection) {
    if (!draft) return
    setBusy(true)
    setError("")
    setConfirmed(false)
    try {
      const result = await (
        await post("sample-section", {
          pricing_spec: pricingBrief,
          scenario,
          scope: draft.scope,
          sections: sections.filter(
            (row) =>
              row.id !== section.id && row.title.trim() && row.content.trim()
          ),
          section,
        })
      ).json()
      if (!mounted.current) return
      if (briefRef.current !== pricingBrief)
        throw new Error(
          "The pricing brief changed. Generate the section again with the updated brief."
        )
      setSections((current) =>
        current.map((row) =>
          row.id === section.id ? { ...row, ...result.section } : row
        )
      )
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Section generation failed.")
    } finally {
      if (mounted.current) setBusy(false)
    }
  }
  return (
    <section className="mt-4 space-y-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">No previous proposal?</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Create a Word sample from your company profile and this template’s
            pricing brief.
          </p>
        </div>
        <div className="flex flex-wrap gap-2"><Button
          variant="outline"
          disabled={disabled || busy || !pricingBrief.trim() || !sectionsValid}
          onClick={generate}
          className="gap-2"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {draft ? "Regenerate sample" : "Generate sample proposal"}
        </Button>
        <Button variant="outline" disabled={disabled || busy || sections.length >= 8 || !pricingBrief.trim()} onClick={addSection}><Plus className="mr-2 size-4" />Add section</Button></div>
      </div>
      {!draft && <p className="text-xs text-muted-foreground">Add section generates the base sample first, then opens the section editor. After a refresh, regenerate the sample to edit its sections.</p>}
      {ready && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <p
            className="text-sm text-emerald-600 dark:text-emerald-400"
            role="status"
          >
            Sample generated and attached. Download it above to review, or click
            Send to continue.
          </p>
          <p className="text-sm font-medium">{customer}</p>
          <p className="text-xs whitespace-pre-wrap text-muted-foreground">
            {scenario}
          </p>
          {totals.map((total) => (
            <p key={total.period} className="font-mono text-sm tabular-nums">
              {total.amount}{" "}
              <span className="text-muted-foreground">({total.period})</span>
            </p>
          ))}
          <p className="text-xs text-muted-foreground">
            This is a fictional example using interpreted pricing rules. Review
            the document and verify the full rules in Pricing Engine.
          </p>
          {sources.length > 0 && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">
                Pricing used from your brief
              </summary>
              {[...new Set(sources)].map((source) => (
                <p key={source} className="mt-2 whitespace-pre-wrap">
                  {source}
                </p>
              ))}
            </details>
          )}
          <Button
            variant="outline"
            disabled={busy || disabled}
            onClick={() => {
              changeOpen(true)
              setConfirmed(false)
            }}
          >
            Edit sample (optional)
          </Button>
        </div>
      )}
      {ready && sourceBrief !== pricingBrief && (
        <p role="alert" className="text-sm text-amber-600">
          The pricing brief changed. Regenerate the sample before sending.
        </p>
      )}
      {questions.length > 0 && (
        <div
          className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"
          role="status"
        >
          <h4 className="text-sm font-semibold">
            Sample assumptions and accuracy notes
          </h4>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {questions.map((question, index) => (
              <li key={index}>{question}</li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            The sample is fully calculated. Where the brief was incomplete, illustrative assumptions were used; the amounts may differ from a final quote. These notes stay in the application, not the Word document. Update the brief and regenerate to replace assumptions.
          </p>
        </div>
      )}
      {open && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            The sample is tailored to this offer and priced from your brief. You
            can edit it if needed. It is saved only when you click Send.
          </p>
          {busy && (
            <div
              role="status"
              className="animate-pulse space-y-3 rounded-xl bg-card p-5"
            >
              <p className="text-sm">
                {draft
                  ? "Preparing your sample…"
                  : "Drafting your sample proposal…"}
              </p>
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-4 rounded bg-muted" />
              <div className="h-4 w-5/6 rounded bg-muted" />
            </div>
          )}
          {draft && (
            <fieldset
              disabled={busy || disabled}
              className="space-y-4"
              onChange={() => setConfirmed(false)}
            >
              {(["title", "overview", "scope", "terms"] as const).map((key) => (
                <label
                  key={key}
                  className="block text-xs font-medium capitalize"
                >
                  {key}
                  <textarea
                    className={`${fieldClass} mt-1`}
                    rows={key === "title" ? 1 : 3}
                    maxLength={key === "title" ? 200 : 6000}
                    value={draft[key]}
                    onChange={(e) =>
                      setDraft({ ...draft, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium">
                  Sample customer
                  <input
                    className={`${fieldClass} mt-1`}
                    maxLength={200}
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                  />
                </label>
                <label className="text-xs font-medium">
                  Currency code
                  <input
                    className={`${fieldClass} mt-1`}
                    placeholder="e.g. USD"
                    maxLength={3}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  />
                </label>
              </div>
              <label className="block text-xs font-medium">
                Sample customer requirements
                <textarea
                  className={`${fieldClass} mt-1`}
                  rows={3}
                  value={scenario}
                  maxLength={3000}
                  onChange={(e) => setScenario(e.target.value)}
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Every sample value must be filled. If you change an estimate, describe its basis in the review notes below. Regenerate to let AI fill gaps from the pricing brief.
                Discounts apply before tax. Monthly, annual and one-time amounts
                stay separate. For tiers, use the applicable unit rate; verify
                the full rules later in Pricing Engine.
              </p>
              {lines.map((line, index) => (
                <div
                  key={index}
                  className="space-y-3 rounded-xl border border-border bg-card p-3"
                >
                  <div className="flex items-end gap-2">
                    <label className="flex-1 text-xs font-medium">
                      Service
                      <input
                        className={`${fieldClass} mt-1`}
                        maxLength={200}
                        value={draft.items[index]}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            items: draft.items.map((item, i) =>
                              i === index ? e.target.value : item
                            ),
                          })
                        }
                      />
                    </label>
                    <Button
                      variant="ghost"
                      disabled={lines.length === 1}
                      aria-label={`Remove service ${index + 1}`}
                      onClick={() => {
                        setLines(lines.filter((_, i) => i !== index))
                        setDraft({
                          ...draft,
                          items: draft.items.filter((_, i) => i !== index),
                        })
                        setConfirmed(false)
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {(
                      [
                        ["quantity", "Quantity"],
                        ["rate", "Unit rate"],
                        ["discount", "Discount %"],
                        ["tax", "Tax %"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="text-xs">
                        {label}
                        <input
                          type="number"
                          min={key === "quantity" ? 1 : 0}
                          max={
                            key === "quantity"
                              ? 10000
                              : key === "rate"
                                ? 1000000
                                : 100
                          }
                          step={key === "quantity" ? 1 : 0.01}
                          className={`${fieldClass} mt-1`}
                          value={line[key]}
                          onChange={(e) =>
                            setLines(
                              lines.map((old, i) =>
                                i === index
                                  ? { ...old, [key]: e.target.value }
                                  : old
                              )
                            )
                          }
                        />
                      </label>
                    ))}
                    <label className="text-xs">
                      Billing
                      <select
                        className={`${fieldClass} mt-1`}
                        value={line.period}
                        onChange={(e) =>
                          setLines(
                            lines.map((old, i) =>
                              i === index
                                ? { ...old, period: e.target.value }
                                : old
                            )
                          )
                        }
                      >
                        <option value="one-time">One-time</option>
                        <option value="monthly">Monthly</option>
                        <option value="annual">Annual</option>
                      </select>
                    </label>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                disabled={lines.length >= 8}
                onClick={() => {
                  setLines([...lines, emptyLine()])
                  setDraft({ ...draft, items: [...draft.items, ""] })
                  setConfirmed(false)
                }}
              >
                <Plus className="mr-2 size-4" />
                Add service
              </Button>
              <SampleSectionsEditor
                sections={sections}
                onChange={(value) => {
                  setSections(value)
                  setConfirmed(false)
                }}
                onGenerate={generateSection}
                disabled={busy || disabled}
              />
              <label className="block text-xs font-medium">
                Review notes (one per line)
                <textarea
                  className={`${fieldClass} mt-1`}
                  rows={3}
                  value={questions.join("\n")}
                  onChange={(e) => setQuestions(e.target.value.split("\n"))}
                />
              </label>
            </fieldset>
          )}
          {draft && sourceBrief !== pricingBrief && (
            <p className="text-sm text-amber-600">
              The pricing brief changed. Regenerate the sample to use the
              updated brief.
            </p>
          )}
          {draft && (
            <label className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={confirmed}
                disabled={busy}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I reviewed the content, sample rates, billing periods, discounts
              and taxes against my pricing brief.
            </label>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => changeOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={
                busy ||
                disabled ||
                !draft ||
                !confirmed ||
                !sectionsValid ||
                lines.length === 0 ||
                lines.some(line => [line.quantity, line.rate, line.discount, line.tax].some(value => !value.trim())) ||
                !customer.trim() ||
                currency.length !== 3 ||
                sourceBrief !== pricingBrief
              }
              onClick={attach}
            >
              Create & attach Word sample
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
