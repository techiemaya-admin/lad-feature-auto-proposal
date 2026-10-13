import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Inbox,
  Mail,
  MailCheck,
  MessageSquare,
  PenLine,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { sendInboxReply, type CompanyConfiguration } from "../services/api";
import type { InboundLeadSimulation } from "../types/proposal";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

interface VoiceInboxViewProps {
  companyId: string;
  simulation: InboundLeadSimulation | null;
  configuration: CompanyConfiguration | null;
  onNotify: (type: "success" | "error" | "info", message: string) => void;
  onOpenSettings: () => void;
  onCreateProposal: () => void;
}

interface InboxMessage {
  id: string;
  name: string;
  company: string;
  role: string;
  source: string;
  time: string;
  subject: string;
  preview: string;
  unread: boolean;
  status: "Needs review" | "Ready to reply" | "In progress";
  initials: string;
}

const sourceLabel: Record<InboundLeadSimulation["source"], string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  web_form: "Web form",
};

function initialsFor(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export const VoiceInboxView: React.FC<VoiceInboxViewProps> = ({
  companyId,
  simulation,
  configuration,
  onNotify,
  onOpenSettings,
  onCreateProposal,
}) => {
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(simulation?.lead_id ?? null);
  const [search, setSearch] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);

  useEffect(() => {
    setSelectedMessageId(simulation?.lead_id ?? null);
  }, [simulation?.lead_id]);

  const messages = useMemo<InboxMessage[]>(
    () => simulation ? [{
        id: simulation.lead_id,
        name: simulation.sender_name,
        company: simulation.sender_company,
        role: simulation.sender_title,
        source: sourceLabel[simulation.source],
        time: simulation.received_at,
        subject: simulation.tailored_sales_copy.executive_overview,
        preview: simulation.raw_message,
        unread: true,
        status: "Needs review",
        initials: initialsFor(simulation.sender_name),
      }] : [],
    [simulation]
  );

  const visibleMessages = messages.filter((message) => {
    const searchable = `${message.name} ${message.company} ${message.subject}`.toLowerCase();
    return searchable.includes(search.toLowerCase());
  });
  const selectedMessage = messages.find((message) => message.id === selectedMessageId) || messages[0] || null;
  const connected = configuration?.email_connected ?? false;
  const stats = [
    [String(messages.length), "Conversations"],
    [String(messages.filter((message) => message.status === "Needs review").length), "Needs attention"],
    [configuration ? "Ready" : "Not set", "Voice profile"],
    [simulation?.received_at || "—", "Last received"],
  ];
  const handleSendReply = async () => {
    const body = simulation?.tailored_sales_copy.executive_overview;
    if (!simulation || !body || !connected) return;

    setIsSendingReply(true);
    try {
      const result = await sendInboxReply(companyId, { lead_id: simulation.lead_id, body });
      onNotify("success", result.message || "Reply sent from the connected inbox.");
    } catch (err) {
      onNotify("error", err instanceof Error ? err.message : "Failed to send the inbox reply.");
    } finally {
      setIsSendingReply(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-[#16358f]/20 bg-[#0B1957] p-6 text-white shadow-[0_18px_45px_-24px_rgba(11,25,87,0.7)] sm:p-8">
        <div className="pointer-events-none absolute -right-14 -top-20 size-64 rounded-full bg-[#2B7CFF]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 size-56 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-blue-100">
              <Sparkles className="size-3.5 text-cyan-200" />
              Sales workspace
            </div>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
              Voice &amp; inbox
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100/75">
              Keep every reply on-brand, turn conversations into qualified briefs, and move the right leads into proposal generation without leaving the workspace.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              onClick={onOpenSettings}
              className="h-10 rounded-xl border-white/20 bg-white/10 px-4 text-xs font-semibold text-white hover:border-white/30 hover:bg-white/15 hover:text-white"
            >
              <PenLine className="size-3.5" />
              Edit voice &amp; inbox
            </Button>
            <Button
              onClick={onCreateProposal}
              disabled={!simulation}
              className="h-10 rounded-xl bg-white px-4 text-xs font-bold text-[#0B1957] shadow-lg shadow-black/10 hover:bg-blue-50"
            >
              <FileText className="size-3.5" />
              Open proposals
              <ArrowUpRight className="size-3.5" />
            </Button>
          </div>
        </div>
        <div className="relative mt-7 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 sm:grid-cols-4">
          {stats.map(([value, label]) => (
            <div key={label}>
              <div className="text-lg font-semibold tracking-tight text-white">{value}</div>
              <div className="mt-0.5 text-[11px] font-medium text-blue-100/60">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
        <section className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
          <div className="flex flex-col gap-4 border-b border-border/70 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Inbox className="size-4 text-primary" />
                <h3 className="text-sm font-semibold tracking-tight">Inbox</h3>
                <Badge variant="success" className="text-[10px]">{stats[1][0]} needs attention</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Your connected channels, one focused queue.</p>
            </div>
            <label className="flex h-9 w-full items-center gap-2 rounded-xl border border-border bg-background px-3 text-xs text-muted-foreground transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 sm:w-52">
              <Search className="size-3.5 shrink-0" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search inbox"
                aria-label="Search inbox"
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground/60"
              />
            </label>
          </div>

          <div className="grid min-h-[520px] md:grid-cols-[minmax(220px,0.82fr)_minmax(0,1.18fr)]">
            <div className="border-b border-border/70 md:border-b-0 md:border-r">
              <div className="flex items-center justify-between px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                <span>Recent</span>
                <span>{visibleMessages.length}</span>
              </div>
              <div className="space-y-1 px-2 pb-3">
                {visibleMessages.map((message) => {
                  const isSelected = message.id === selectedMessage?.id;
                  return (
                    <button
                      key={message.id}
                      type="button"
                      onClick={() => setSelectedMessageId(message.id)}
                      className={`group flex w-full gap-3 rounded-xl p-3 text-left transition-all duration-200 ${
                        isSelected
                          ? "bg-primary/[0.07] shadow-[inset_3px_0_0_var(--primary)]"
                          : "hover:bg-muted/70"
                      }`}
                    >
                      <div className="relative grid size-9 shrink-0 place-items-center rounded-full bg-blue-100 text-[11px] font-bold text-primary dark:bg-primary/15 dark:text-primary">
                        {message.initials}
                        {message.unread && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border-2 border-card bg-amber-500" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`truncate text-xs ${message.unread ? "font-bold text-foreground" : "font-semibold text-foreground/80"}`}>
                            {message.name}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">{message.time}</span>
                        </div>
                        <div className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">{message.subject}</div>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground">{message.source}</span>
                          <span className="size-1 rounded-full bg-border" />
                          <span className={`truncate text-[10px] font-semibold ${message.status === "Needs review" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                            {message.status}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {visibleMessages.length === 0 && (
                  <div className="px-3 py-10 text-center text-xs text-muted-foreground">No conversations found.</div>
                )}
              </div>
            </div>

            <div className="flex min-w-0 flex-col">
              <div className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {selectedMessage?.initials}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="truncate text-sm font-semibold">{selectedMessage?.name || "No conversation selected"}</h4>
                      {selectedMessage && <Badge variant="outline" className="text-[10px]">{selectedMessage.status}</Badge>}
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">{selectedMessage ? `${selectedMessage.role} · ${selectedMessage.company}` : "Backend inbox data will appear here."}</p>
                  </div>
                </div>
                <button type="button" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Open conversation">
                  <ArrowUpRight className="size-4" />
                </button>
              </div>

              <div className="flex-1 space-y-5 bg-muted/20 p-5">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
                  <Clock3 className="size-3.5" />
                  {selectedMessage ? `${selectedMessage.time} · ${selectedMessage.source}` : "Waiting for backend inbox data"}
                </div>
                <div className="max-w-xl rounded-2xl rounded-tl-md border border-border/70 bg-card p-4 shadow-sm">
                  <p className="text-sm leading-6 text-foreground/85">{selectedMessage?.preview || "No conversation is available for this company yet."}</p>
                </div>

                {selectedMessage?.id === simulation?.lead_id && simulation && (
                  <div className="rounded-2xl border border-primary/15 bg-primary/[0.045] p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                      <Sparkles className="size-3.5" />
                      AI extracted context
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {[
                        simulation.extracted_params.locations && `${simulation.extracted_params.locations} locations`,
                        simulation.extracted_params.tier_requested && `${simulation.extracted_params.tier_requested} tier`,
                        simulation.extracted_params.is_annual_prepay && "Annual prepay",
                        simulation.extracted_params.client_state && simulation.extracted_params.client_state,
                      ]
                        .filter((tag): tag is string => Boolean(tag))
                        .map((tag) => (
                          <span key={tag} className="rounded-full border border-primary/15 bg-card px-2.5 py-1 text-[10px] font-semibold text-foreground/70">
                            {tag}
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.045] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      <MessageSquare className="size-3.5" />
                      Suggested reply
                    </div>
                    <span className="text-[10px] font-medium text-emerald-700/60 dark:text-emerald-400/60">Matches your voice</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-foreground/75">
                    {simulation?.tailored_sales_copy.executive_overview || "No reply draft was returned by the backend."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => void handleSendReply()}
                      disabled={!simulation || !connected || isSendingReply}
                      className="h-8 rounded-lg px-3 text-[11px] font-semibold"
                    >
                      <Send className="size-3.5" />
                      {isSendingReply ? "Sending…" : "Send reply"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={onCreateProposal} disabled={!simulation} className="h-8 rounded-lg px-3 text-[11px] font-semibold">
                      <FileText className="size-3.5" />
                      Build proposal
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <PenLine className="size-4 text-primary" />
                  <h3 className="text-sm font-semibold tracking-tight">Your voice</h3>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">The guardrails every AI-written reply follows.</p>
              </div>
              <button type="button" onClick={onOpenSettings} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Edit voice settings">
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="mt-5 space-y-2.5">
              {[
                ["Tone", configuration?.style_notes || "Not configured"],
                ["Clarification", configuration?.clarification_notes || "Not configured"],
                ["Reference", configuration?.reference_proposal_text ? "Reference added" : "No reference added"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 rounded-xl bg-muted/45 px-3 py-2.5">
                  <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
                  <span className="text-right text-[11px] font-semibold text-foreground/80">{value}</span>
                </div>
              ))}
            </div>
            <button type="button" onClick={onOpenSettings} className="mt-4 flex w-full items-center justify-between rounded-xl border border-border px-3 py-2.5 text-xs font-semibold text-foreground/75 transition-all hover:border-primary/30 hover:bg-primary/[0.04] hover:text-primary">
              <span>Refine your voice</span>
              <ArrowUpRight className="size-3.5" />
            </button>
          </section>

          <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  {connected ? <MailCheck className="size-4 text-emerald-500" /> : <Mail className="size-4 text-primary" />}
                  <h3 className="text-sm font-semibold tracking-tight">Connected inbox</h3>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {connected ? "Replies and proposals can send from your team inbox." : "Link an inbox to send replies your leads recognise."}
                </p>
              </div>
              <span className={`mt-0.5 size-2 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-500"}`} />
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-muted/25 p-3">
              <div className="grid size-9 place-items-center rounded-lg bg-card shadow-sm">
                <Mail className="size-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold">{configuration?.email_address || "No inbox connected"}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{connected ? "Ready to send" : "Setup required"}</div>
              </div>
              {connected && <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />}
            </div>
            <Button size="sm" variant={connected ? "outline" : "default"} onClick={onOpenSettings} className="mt-4 h-9 w-full rounded-xl text-xs font-semibold">
              {connected ? "Manage connection" : "Connect inbox"}
              <ArrowUpRight className="size-3.5" />
            </Button>
          </section>

          <section className="rounded-2xl border border-primary/15 bg-primary/[0.045] p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Zap className="size-3.5" />
              Smart handoff
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">When a conversation has enough context, move it straight into the proposal pipeline.</p>
            <div className="mt-4 flex items-center gap-2 text-[10px] font-semibold text-foreground/70">
              <ShieldCheck className="size-3.5 text-emerald-500" />
              Pricing rules stay deterministic
            </div>
          </section>
        </aside>
      </div>

    </div>
  );
};

export default VoiceInboxView;
