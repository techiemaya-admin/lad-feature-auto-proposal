# Auto-Proposal — UI/UX & Interaction Design Specification

Paths relative to repo root. Backend pipeline: [architecture.md](architecture.md). Sample generation: [features/sample-proposals.md](features/sample-proposals.md).

## 1. Design Vision & Philosophy

An **agentic configuration workspace**, not an enterprise setup wizard — a conversational briefing for agency owners:

1. **Minimal, fluid, fast:** elevate what the current decision needs; keep secondary metadata quiet.
2. **Elevated surface hierarchy:** light mode canvas is a soft cool tint (`--background: #F8F9FE`), cards are pure elevated white (`--card: #FFFFFF`) with 1px borders (`--border: #E2E8F0`) and micro-shadows. Dark mode canvas is deep navy (`--background: #000724`), cards elevated navy (`--card: #1A2A43`). Never render darker cards on a lighter canvas in light mode.
3. **Conversational, human language:** no developer jargon, library name-drops, or sci-fi terms in user-facing copy. Business-owner words: "Pricing Briefing", "Drop your sample quotation here (.docx)".
4. **Standardized primitives:** shadcn `Card`, `Button`, `Badge`, `Input`, `Textarea` (`frontend/src/components/ui/`), `CustomDropdown`, shared `ConfirmDialog` — never native `window.confirm`/`alert` in new code.
5. **Linear predictability:** moving forward locks previous stages. Editing an earlier stage rewinds downstream behind an explicit warning, keeping backend and AI state deterministic.
6. **Separation of concerns:** the canvas holds the pipeline alone; technical inspection lives in the bottom Dev Dock.

## 2. Shell & Navigation

```
LadSettingsHeader (always visible)
  ├── Company tabs · app identity · theme toggle · AI model picker · Voice/Inbox entry
  └── Tabs: Business Profile (`businessprofile`) | Voice & Inbox (`voiceinbox`) | Auto Proposal (`proposals`) | ICP Strategy (`icp`, renders the profile view)
        ├── BusinessProfileView: company profile editor (company_sessions; also serves the ICP tab)
        ├── VoiceInboxView + ConfigurationSheet: per-company voice notes, reference proposal,
        │   clarification-email notes (company_configurations); mock inbox flag
        └── Proposals: TemplateLibraryView ⇄ TemplateWorkspace (App.tsx)
              ├── TemplateLibraryView: ICP import, template cards, custom-template dialog,
              │   deletion, 7-template capacity, Check-a-lead-email routing panel,
              │   assigned-lead banner data
              └── TemplateWorkspace: HeroBanner + StageStepper + Stage 1–5 + DevDock
                    ├── HeroBanner: workspace identity, company pill, rescan shortcut
                    ├── StageStepper: Briefing → Variable Ledger → Draft Proposal
                    │                 → Pricing Engine → Lead & Proposal (completed/active/pending)
                    └── DevDock (bottom HUD): Profile JSON · AnyDoc MD · Variables JSON
                        · Pricing Rules JSON (editable + Apply) · Logs/artifacts
```

`TemplatesApp.tsx` is a thin re-export of `App`. Workspace state is keyed by company + template; switching unmounts and remounts (UI isolation, not server cancellation). "All templates" back-navigation and destructive deletes use `ConfirmDialog`.

## 3. Stage Specifications

### 3.1 Stage 1: Briefing (`stages/Stage1Briefing.tsx` + `SampleProposalBuilder.tsx`)
- Fluid auto-resizing prompt textarea (Enter = newline) with integrated Send; docked dropzone beneath for `.docx` (click or drag, 20 MB limit, extension filter). Human copy, no character counts.
- Alternative path: **Generate sample proposal** builds an AI-planned, code-priced Word sample from the current brief (see [features/sample-proposals.md](features/sample-proposals.md)); optional custom sections (`SampleSectionsEditor.tsx`). Generated file association is tracked: changing the brief requires regeneration before Send; manual upload clears the association.
- On Send: capsule locks into a read-only summary with Edit/Reset (reset warns; downstream variables/template/rules cleared, prompt + file preserved). Shimmer bar on the card edge while AI work runs; failures are explicit panels with retry — never a stuck shimmer.

### 3.2 Stage 2: Variable Ledger (`stages/Stage2VariableLedger.tsx`)
- Overview-first, detail-on-demand. Header: `Variables`, `N spots in <Company>'s quotation will change per client`, `Tap one to check it`, ghost Re-scan.
- Four rows: Customer inputs · Fixed & auto-filled · Pricing (loop tables as ⊞ chips) · Paragraphs (❝ fixed / ✦ drafted glyphs). Chips show state only: selected = inverted, left-out = dashed + strikethrough (stays in place), needs-attention = amber dot, settled = emerald tick, primary action = navy/blue.
- Detail tray docks under the ledger: inline rename, category switch, `In the quotation` verbatim hero, fact grid (One of / Shown only when / Template tag `{name}` / Source), paragraph mode segmented control, Leave out / Bring back, [+ Add one] custom chip (verified against quotation Markdown).
- Date variables: the detail tray edits `date_format` as a text field with a live today's-date preview and flags a format that fails verification — see [features/dates.md](features/dates.md).
- Every edit persists (`PUT /variables`) and invalidates Stage 3+ until regenerated.

### 3.3 Stage 3: Template Checkpoint (`stages/Stage3TemplateCheck.tsx` + `DocxDocumentPreview.tsx`)
- Answers: did it work, is anything wrong, what's next. Clipped scaled `docx-preview` thumbnail (click → full modal) of the real `template.docx`; one-line stats sentence (fields / tables / rows).
- Unplaced fields as chips; tapping one focuses the variable in Stage 2. Footer: `[Download .docx]` + size, primary `[Set up pricing ➔]`. No engine vocabulary in user copy.

### 3.4 Stage 4: Pricing Engine (`stages/Stage4PricingEngine.tsx` + `pricing/LedgerTray.tsx`)
- Sections top→bottom: assumptions strip (amber) → one editable card per rule table (typed cells, `tabular-nums`, commit on blur/Enter, add/remove rows) → "What we ask the lead" chips → calculation ledger in evaluation order (label, plain-language definition, sample value, quotation value, ✓/✗) → editable "Held for review when" rules → footer (`N of M match`, Regenerate, Proceed).
- Tapping a ledger row docks `LedgerTray` (kind / operator / operands / conditions editor). `CondRows` is shared inside `pricing/LedgerTray.tsx`.
- Live check: 300 ms debounced `PUT /rules`; rejected edits show inline errors and keep the edit on screen. Proceed blocked while structural errors exist.
- Review rules are editable: each rule has conditions and a reason, added/edited/deleted in place, and a half-finished rule (no conditions or an empty reason) blocks Proceed — see [features/review-rules.md](features/review-rules.md). The raw JSON remains editable in the Dev Dock.

### 3.5 Stage 5: Lead & Proposal (`stages/Stage5LeadSimulator.tsx` + `Stage5ReceiptSummary.tsx`)
- Lead textarea (same fluid pattern as Stage 1) prefilled with the assigned/routed email → template's email, else dev sample. `[Generate proposal]` runs extract → generate back to back.
- Facts panel (read-only; booleans Yes/No, `tabular-nums`): missing required fact highlights amber and stops the run; conversation card drafts the clarification ask (Copy) + reply box (`What the lead wrote back…`, model-as-lead filler, editable) → re-read loop until complete.
- Assumptions strip (amber, read-between-the-lines). Numbers ledger (in-document money/percent/integer in calculation order, last money value emphasized).
- Draft box when `needs_review` is non-empty (red, reasons listed; document still built, affected values print `[to confirm]`).
- Split view: facts/assumptions/ledger left; PDF `<iframe>` (or unavailable-with-reason) + `[Download .docx] [Download .pdf]` right. `docx-preview` is not used here. (`Stage5ReceiptSummary.tsx` exists but is not rendered anywhere — dead code, do not reference it in new work.)

## 4. Library, Routing & Settings UI

- **TemplateLibraryView:** company-scoped cards (name + clamped description with hover tooltip + open + delete), empty-state welcome + large **Import ICP data** (three skeleton cards while generating), custom-template dialog (name + description + brief, all required), `N of 7` capacity meter, collapsible **Check a lead email** panel (edit → save → Check → Goes-to/No-match + reason + Open template + manual override), assigned-template highlight ring.
- **Assigned-lead banner** in the workspace shows the routed email + match reason + copy button when the open template owns the assignment.
- **Voice/Inbox:** free-text voice notes (proposal style, reference proposal, clarification-email tone) with explicit Save/Cancel; mock Connect/Disconnect is one control in the library title area — a persisted flag, not mailbox access.
- **DevDock:** full-width tab bar, constrained readable content (`pre-wrap`, no horizontal scroll), up to 90vh; tabs for Profile JSON, AnyDoc Markdown, Variables JSON, Pricing Rules JSON (Apply → PUT, errors listed, nothing persisted on 400), Pipeline Logs + run artifacts.

## 5. Visual Tokens & Micro-interactions

- **Theme** (`frontend/src/index.css`): `--background #F8F9FE / #000724`, `--card #FFFFFF / #1A2A43`, `--primary #0B1957` (CTAs; dark CTA `#2B7CFF`), `--border #E2E8F0`, `--muted #F1F5F9`, `--accent #EEF2FF`, `--radius 0.75rem`; fonts Space Grotesk (headings) / Inter (body) / JetBrains Mono (numbers, tags, `tabular-nums`).
- **Color discipline:** category gets no hue; color is spent on state (selected / left-out / attention / settled / primary). Money/percent/integer always mono tabular.
- **Motion (<200 ms, GPU):** hover lift `-translate-y-0.5`, active press `scale-[0.98]`, chip deal-in stagger on scan landing only, tray connector slide, card-edge shimmer for AI work, skeleton pulses honoring reduced-motion. No heavy animation libraries.
