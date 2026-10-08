import { useEffect, useState } from "react"
import TemplateWorkspace from "./App"
import {
  saveRoutingEmail,
  assignMockEmail,
  fetchMockEmail,
  routeMockEmail,
  type EmailRoutingResult,
  fetchCompanies,
  listTemplates,
  createProposalTemplate,
  deleteProposalTemplate,
  importIcpTemplates,
  type ProposalTemplateSummary,
} from "./services/api"
import { Button } from "./components/ui/button"
import { Input } from "./components/ui/input"
import { Textarea } from "./components/ui/textarea"
import { Card } from "./components/ui/card"
import { useTheme } from "./components/theme-provider"
import {
  ArrowLeft,
  ArrowUpRight,
  FileText,
  Plus,
  Sparkles,
  Trash2,
  Workflow,
  Sun,
  Moon,
} from "lucide-react"

export default function TemplatesApp() {
  const [companies, setCompanies] = useState<
    Array<{ company_id: string; company_name: string }>
  >([])
  const [email, setEmail] = useState("")
  const [routing, setRouting] = useState<EmailRoutingResult | null>(null)
  const [routingBusy, setRoutingBusy] = useState(false)
  const [companyId, setCompanyId] = useState("")
  const [templates, setTemplates] = useState<ProposalTemplateSummary[]>([])
  const [templateId, setTemplateId] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState("")
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [brief, setBrief] = useState("")
  const { theme, setTheme } = useTheme()
  useEffect(() => {
    let alive = true
    fetchCompanies()
      .then((rows) => {
        if (alive) {
          setCompanies(rows)
          setCompanyId(rows[0]?.company_id ?? "")
          if (!rows.length) setLoading(false)
        }
      })
      .catch((e) => {
        if (alive) {
          setError(e.message)
          setLoading(false)
        }
      })
    return () => {
      alive = false
    }
  }, [])
  useEffect(() => {
    if (!companyId) return
    let alive = true
    setLoading(true)
    setEmail("")
    setRouting(null)
    Promise.all([listTemplates(companyId), fetchMockEmail(companyId)])
      .then(([rows, emailText]) => {
        if (alive) {
          setTemplates(rows)
          setEmail(emailText.email)
          setRouting(emailText)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (alive) {
          setError(e.message)
          setLoading(false)
        }
      })
    return () => {
      alive = false
    }
  }, [companyId])
  function switchCompany(id: string) {
    if (busy || id === companyId) return
    if (
      templateId &&
      !window.confirm(
        "Switch company? Saved work is kept. Unsaved edits will be discarded."
      )
    )
      return
    setTemplateId("")
    setTemplates([])
    setLoading(true)
    setCreating(false)
    setError("")
    setCompanyId(id)
  }
  async function importData() {
    setBusy(true)
    setGenerating(true)
    setError("")
    try {
      setTemplates(await importIcpTemplates(companyId))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import ICP data")
      // A request may finish on the server even if its response is lost.
      try {
        setTemplates(await listTemplates(companyId))
      } catch {
        /* retain retry screen */
      }
    } finally {
      setBusy(false)
      setGenerating(false)
    }
  }
  const emailDirty = email.trim() !== (routing?.email ?? "");
  async function saveEmail() {
    setBusy(true); setError("");
    try { const saved = await saveRoutingEmail(companyId, email, routing!.version); setRouting(saved); setEmail(saved.email); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save email"); }
    finally { setBusy(false); }
  }
  async function routeEmail() {
    setBusy(true); setRoutingBusy(true); setError("")
    try {
      if (emailDirty) { const saved = await saveRoutingEmail(companyId, email, routing!.version); setRouting(saved); setEmail(saved.email); }
      setRouting(await routeMockEmail(companyId));
    }
    catch (e) { setError(e instanceof Error ? e.message : "Routing failed") }
    finally { setBusy(false); setRoutingBusy(false) }
  }
  async function reassign(id: string) {
    if (!id) return;
    setBusy(true); setError("");
    try { setRouting(await assignMockEmail(companyId, id)) }
    catch (e) { setError(e instanceof Error ? e.message : "Assignment failed") }
    finally { setBusy(false) }
  }
  async function create() {
    setBusy(true)
    setError("")
    try {
      const result = await createProposalTemplate(
        companyId,
        name.trim(),
        description.trim(),
        brief.trim()
      )
      setTemplates(await listTemplates(companyId))
      setCreating(false)
      setTemplateId(result.template_id!)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save template")
    } finally {
      setBusy(false)
    }
  }
  async function remove(row: ProposalTemplateSummary) {
    if (
      !window.confirm(
        `Delete "${row.name}" and its saved documents, variables and pricing rules? This cannot be undone.`
      )
    )
      return
    setBusy(true)
    setError("")
    try {
      await deleteProposalTemplate(companyId, row.template_id)
      setRouting(await fetchMockEmail(companyId))
      setTemplates(await listTemplates(companyId))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete template")
    } finally {
      setBusy(false)
    }
  }
  function back() {
    if (
      !window.confirm(
        "Return to templates? Saved work is kept. Unsaved edits will be discarded."
      )
    )
      return
    setTemplateId("")
    setLoading(true)
    Promise.all([listTemplates(companyId), fetchMockEmail(companyId)])
      .then(([rows, saved]) => { setTemplates(rows); setRouting(saved); setEmail(saved.email) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  if (templateId)
    return (
      <TemplateWorkspace
        key={`${companyId}:${templateId}`}
        activeCompanyId={companyId}
        templateId={templateId}
        onCompanyChange={switchCompany}
        templateControls={
          <div className="space-y-3"><div className="flex items-center gap-3 py-1">
            <Button variant="ghost" size="sm" onClick={back}>
              <ArrowLeft className="mr-2 size-4" />
              All templates
            </Button>
            <span className="truncate text-sm text-muted-foreground">
              {templates.find((t) => t.template_id === templateId)?.name}
            </span>
          </div>
          {routing?.template_id === templateId && <Card className="p-4 gap-2"><h2 className="text-sm font-semibold">Assigned lead email</h2><p className="text-sm leading-6 whitespace-pre-wrap text-muted-foreground">{routing.email}</p><p className="text-xs text-muted-foreground">{routing.reason}</p></Card>}
          </div>
        }
      />
    )
  return (
    <div className="min-h-screen bg-zinc-100/70 text-foreground antialiased selection:bg-primary/20 dark:bg-zinc-950">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex min-h-14 max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Workflow className="size-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">
              Auto-Proposal
            </span>
          </div>
          <nav
            aria-label="Companies"
            className="flex max-w-full items-center overflow-x-auto rounded-lg border border-border/40 bg-muted/60 p-0.5 text-xs"
          >
            {companies.map((c) => (
              <button
                key={c.company_id}
                disabled={busy}
                aria-current={companyId === c.company_id ? "page" : undefined}
                onClick={() => switchCompany(c.company_id)}
                className={`rounded-md px-3 py-1.5 font-medium whitespace-nowrap transition-all disabled:opacity-50 ${companyId === c.company_id ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
              >
                {c.company_name}
              </button>
            ))}
          </nav>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"
          >
            {error}
          </div>
        )}
        {loading ? (
          <p
            role="status"
            className="py-24 text-center text-sm text-muted-foreground"
          >
            Loading your templates?
          </p>
        ) : generating ? (
          <section aria-busy="true" aria-label="Generating templates">
            <div role="status" className="mb-8 text-center">
              <Sparkles className="mx-auto mb-3 size-5 text-primary motion-safe:animate-pulse" />
              <h1 className="text-2xl font-semibold tracking-tight">
                Finding the right proposals for your business
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Creating three starting points from your customers, offers and
                pricing.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Card
                  key={i}
                  aria-hidden="true"
                  className="min-h-80 rounded-2xl p-7 shadow-sm motion-safe:animate-pulse"
                  style={{ animationDelay: `${i * 180}ms` }}
                >
                  <div className="mb-10 h-10 w-9 rounded-md bg-muted" />
                  <div className="mb-5 h-5 w-3/4 rounded bg-muted" />
                  {[100, 90, 75, 85].map((width, j) => (
                    <div
                      key={j}
                      className="mb-3 h-3 rounded bg-muted"
                      style={{ width: `${width}%` }}
                    />
                  ))}
                  <div className="mt-10 h-3 w-1/3 rounded bg-muted" />
                </Card>
              ))}
            </div>
          </section>
        ) : !templates.length ? (
          <section className="flex min-h-[65vh] items-center justify-center" aria-labelledby="library-welcome">
            <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-border/60 bg-card px-6 py-12 text-center shadow-sm sm:px-12 sm:py-14">
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-primary/5 to-transparent" />
              <div aria-hidden="true" className="relative mx-auto mb-8 flex h-32 w-56 items-center justify-center">
                {[-1, 0, 1].map((position) => (
                  <div key={position} className={`absolute h-28 w-24 rounded-xl border border-border/70 bg-background p-4 shadow-sm ${position === 0 ? "z-10 -translate-y-2" : position < 0 ? "-translate-x-16 -rotate-12" : "translate-x-16 rotate-12"}`}>
                    <FileText className="mb-4 size-5 text-primary/70" />
                    <div className="mb-2 h-1.5 w-full rounded-full bg-muted" />
                    <div className="mb-2 h-1.5 w-4/5 rounded-full bg-muted" />
                    <div className="h-1.5 w-3/5 rounded-full bg-primary/15" />
                  </div>
                ))}
              </div>
              <p className="relative mb-3 text-xs font-medium tracking-wide text-muted-foreground">
                {companies.find((c) => c.company_id === companyId)?.company_name}
              </p>
              <h1 id="library-welcome" className="relative text-2xl font-semibold tracking-tight sm:text-3xl">Your next proposal starts here</h1>
              <p className="relative mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                Turn your ideal customer profile into three proposal starting points, tailored to your buyers, offers and pricing.
              </p>
              <Button
                disabled={busy || !companyId}
                onClick={importData}
                className="relative mt-7 h-14 w-full gap-3 rounded-xl px-9 text-base shadow-sm sm:w-auto"
              >
                <Sparkles className="size-5" />
                Import ICP data
                <ArrowUpRight className="size-4" />
              </Button>
              <p className="mt-4 text-xs text-muted-foreground">Three tailored briefs. Ready for you to make your own.</p>
            </div>
          </section>
        ) : (
          <section aria-label="Template library">
            <Card className="mb-8 gap-4 rounded-2xl p-6">
              <div><p className="text-xs font-medium text-muted-foreground mb-1">Lead email</p><h2 className="text-lg font-semibold">Route this lead to a template</h2></div>
              <Textarea aria-label="Lead email" value={email} onChange={e => setEmail(e.target.value)} disabled={busy} maxLength={12000} className="min-h-40 text-sm leading-6" placeholder="Paste the email you received..." />
              <p className="text-xs text-muted-foreground">Starts with a sample email. Replace it with your own; saving a changed message clears the previous assignment. {email.length}/12000 characters.</p>
              {emailDirty && <Button variant="outline" disabled={busy || !email.trim() || !routing} onClick={() => void saveEmail()}>Save email</Button>}
              <div><Button disabled={busy || !email.trim() || !routing} onClick={() => void routeEmail()}><Sparkles className="size-4" />{routingBusy ? "Matching email..." : routing?.template_id ? "Re-route email" : "Route email"}</Button></div>
              {routingBusy && <p role="status" className="text-sm text-muted-foreground motion-safe:animate-pulse">Comparing this email with your saved templates...</p>}
              <label className="text-sm space-y-2"><span className="block text-muted-foreground">Assign or move manually</span><select aria-label="Assign email to template" className="w-full rounded-md border bg-background p-2" disabled={busy || emailDirty} value={routing?.template_id ?? ""} onChange={e => void reassign(e.target.value)}><option value="" disabled>Select a template</option>{templates.map(t => <option key={t.template_id} value={t.template_id}>{t.name}</option>)}</select></label>
              {routing && !emailDirty && <div role="status" className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                <p className="font-medium text-sm">{routing.template_id ? `Assigned to ${templates.find(t => t.template_id === routing.template_id)?.name ?? "template"}` : routing.source === "unassigned" ? "Not assigned" : "Needs review ? no clear match"}</p>
                <p className="text-sm text-muted-foreground">{routing.reason || "Route this email automatically or select a template above."}</p>
                {routing.routed_at && <p className="text-xs text-muted-foreground">Saved {new Date(routing.routed_at).toLocaleString()} ? {routing.source === "manual" ? "Manual assignment" : "AI routing"}</p>}
                {routing.template_id && <Button variant="outline" onClick={() => setTemplateId(routing.template_id!)}>Open assigned template<ArrowUpRight className="size-4" /></Button>}
              </div>}
            </Card>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {
                    companies.find((c) => c.company_id === companyId)
                      ?.company_name
                  }
                </p>
                <h1 className="text-3xl font-semibold tracking-tight">
                  Your proposal templates
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Choose a starting point and make it yours.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {templates.length} / 7
                </span>
                <Button
                  variant="outline"
                  disabled={busy || templates.length >= 7}
                  onClick={() => {
                    setName("")
                    setDescription("")
                    setBrief("")
                    setCreating(true)
                  }}
                >
                  <Plus className="mr-2 size-4" />
                  Add custom template
                </Button>
              </div>
            </div>
            {creating && (
              <Card className="mb-8 rounded-2xl p-6">
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void create()
                  }}
                >
                  <h2 className="font-semibold">Create a custom template</h2>
                  <label className="block space-y-2 text-sm">
                    <span>Name</span>
                    <Input
                      autoFocus
                      required
                      maxLength={100}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={busy}
                      placeholder="e.g. Managed IT for growing teams"
                    />
                  </label>
                  <label className="block space-y-2 text-sm">
                    <span>Description</span>
                    <Textarea
                      required
                      maxLength={1000}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={busy}
                      placeholder="Who is this proposal for, and what does it offer?"
                    />
                  </label>
                  <label className="block space-y-2 text-sm">
                    <span>Pricing brief</span>
                    <Textarea
                      required
                      maxLength={20000}
                      className="min-h-36"
                      value={brief}
                      onChange={(e) => setBrief(e.target.value)}
                      disabled={busy}
                      placeholder="Describe your packages, rates, conditions and discounts?"
                    />
                  </label>
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={
                        busy ||
                        !name.trim() ||
                        !description.trim() ||
                        !brief.trim()
                      }
                    >
                      {busy ? "Saving..." : "Save and open template"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setCreating(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Card>
            )}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((row) => (
                <Card
                  key={row.template_id}
                  className={`group relative overflow-hidden rounded-2xl py-0 shadow-sm transition-all hover:border-primary/30 hover:shadow-md ${!emailDirty && routing?.template_id === row.template_id ? "border-primary ring-2 ring-primary/20" : ""}`}
                >
                  <button
                    disabled={busy}
                    onClick={() => setTemplateId(row.template_id)}
                    className="flex h-full min-h-64 w-full flex-col p-6 text-left focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary disabled:opacity-50"
                  >
                    <div className="mb-4 flex size-10 items-center justify-center rounded-lg border border-primary/10 bg-primary/5 text-primary">
                      <FileText className="size-5" />
                    </div>
                    <h2 className="text-base leading-snug font-semibold tracking-tight break-words">
                      {row.name}
                    </h2>
                    <p title={row.description || undefined} className="mt-2 line-clamp-4 text-[13px] leading-5 break-words text-muted-foreground">
                      {row.description ||
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
                    disabled={busy}
                    aria-label={`Delete ${row.name}`}
                    title={`Delete ${row.name}`}
                    className="absolute top-3 right-3 text-muted-foreground hover:text-destructive"
                    onClick={() => void remove(row)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </Card>
              ))}
            </div>
            {templates.length >= 7 && (
              <p className="mt-5 text-sm text-muted-foreground">
                You have reached the seven-template limit. Delete a template to
                add another.
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
