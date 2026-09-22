import { useEffect, useState } from "react";
import TemplateWorkspace from "./App";
import { fetchCompanies, listTemplates, createProposalTemplate, renameProposalTemplate, deleteProposalTemplate, type ProposalTemplateSummary } from "./services/api";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";

export default function TemplatesApp() {
  const [companies, setCompanies] = useState<Array<{ company_id: string; company_name: string }>>([]);
  const [companyId, setCompanyId] = useState("");
  const [templates, setTemplates] = useState<ProposalTemplateSummary[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"create" | "rename" | null>(null);
  const [name, setName] = useState("");
  useEffect(() => {
    let alive = true;
    fetchCompanies().then(companies => {
      if (alive) { setCompanies(companies); setCompanyId(companies[0]?.company_id ?? ""); if (!companies.length) setLoading(false); }
    }).catch(e => { if (alive) { setError(e.message); setLoading(false); } });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!companyId) return;
    let alive = true;
    setLoading(true);
    setError("");
    listTemplates(companyId).then(rows => {
      if (!alive) return;
      setTemplates(rows);
      const remembered = localStorage.getItem(`proposal-template:${companyId}`);
      setTemplateId(rows.find(t => t.template_id === remembered)?.template_id ?? rows[0]?.template_id ?? "");
      setLoading(false);
    }).catch(e => { if (alive) { setError(e.message); setLoading(false); } });
    return () => { alive = false; };
  }, [companyId]);

  function select(id: string) {
    setTemplateId(id);
    localStorage.setItem(`proposal-template:${companyId}`, id);
    setMode(null);
  }
  function confirmSwitch() {
    return !templateId || window.confirm("Switch workspace? Saved work is kept. Unsaved edits in the current form will be discarded.");
  }
  async function saveName() {
    if (!name.trim()) return;
    setBusy(true); setError("");
    try {
      const result = mode === "rename"
        ? await renameProposalTemplate(companyId, templateId, name.trim())
        : await createProposalTemplate(companyId, name.trim());
      setTemplates(await listTemplates(companyId));
      select(result.template_id!);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save template"); }
    finally { setBusy(false); }
  }
  async function remove() {
    const selected = templates.find(t => t.template_id === templateId);
    if (!window.confirm(`Delete "${selected?.name}" and its saved documents, variables, and pricing rules? Other templates are unaffected.`)) return;
    setBusy(true); setError("");
    try {
      await deleteProposalTemplate(companyId, templateId);
      const rows = await listTemplates(companyId);
      setTemplates(rows); select(rows[0]?.template_id ?? "");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not delete template"); }
    finally { setBusy(false); }
  }
  const controls = <section className="rounded-xl border bg-card p-4 space-y-3" aria-label="Proposal templates">
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="proposal-template" className="text-sm font-medium">Template</label>
      <select id="proposal-template" className="rounded-md border bg-background p-2 text-sm" value={templateId} disabled={busy || loading} onChange={e => { if (confirmSwitch()) select(e.target.value); }}>
        {!templates.length && <option value="">No templates yet</option>}
        {templates.map(t => <option key={t.template_id} value={t.template_id}>{t.name}</option>)}
      </select>
      <Button disabled={busy || !companyId} onClick={() => { if (confirmSwitch()) { setMode("create"); setName(""); } }}>New template</Button>
      <Button variant="outline" disabled={busy || !templateId} onClick={() => { setMode("rename"); setName(templates.find(t => t.template_id === templateId)?.name ?? ""); }}>Rename</Button>
      <Button variant="ghost" disabled={busy || !templateId} onClick={remove}>Delete</Button>
    </div>
    {mode && <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void saveName(); }}>
      <Input aria-label="Template name" autoFocus maxLength={100} placeholder="e.g. Managed IT support" value={name} onChange={e => setName(e.target.value)} disabled={busy} />
      <Button type="submit" disabled={busy || !name.trim()}>{busy ? "Saving…" : mode === "create" ? "Create" : "Save"}</Button>
      <Button type="button" variant="ghost" disabled={busy} onClick={() => setMode(null)}>Cancel</Button>
    </form>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
  if (loading) return <main className="p-8">Loading templates…</main>;
  if (!templateId) return <main className="mx-auto max-w-4xl p-8 space-y-4"><select aria-label="Company" value={companyId} onChange={e => setCompanyId(e.target.value)}>{companies.map(c => <option key={c.company_id} value={c.company_id}>{c.company_name}</option>)}</select>{controls}<p>Create a template to upload a quotation and set up pricing.</p></main>;
  return <TemplateWorkspace key={`${companyId}:${templateId}`} activeCompanyId={companyId} templateId={templateId} templateControls={controls} onCompanyChange={id => {
    if (busy || id === companyId || !confirmSwitch()) return;
    setLoading(true); setTemplateId(""); setTemplates([]); setMode(null); setCompanyId(id);
  }} />;
}
