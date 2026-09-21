# Auto-Proposal Prototype — UI/UX & Interaction Design Specification (`DESIGN.md`)

## 1. Design Vision & Philosophy

The Rush Away Auto-Proposal onboarding workflow is an **agentic configuration workspace**. Rather than forcing the agency owner to endure a multi-step enterprise setup wizard with heavy forms, dense tables, and disconnected tabs, this experience is designed as an **intuitive, conversational briefing**:

1. **Minimal, Fluid, and Fast:** Elevate what is critical for the current decision, keeping secondary metadata low-profile.
2. **Elevated Surface Hierarchy (Light Cards on Neutral Canvas):** In light mode, the canvas is a soft neutral light gray (`zinc-100/80` / `#f4f4f5`), while cards are crisp, elevated white surfaces (`#ffffff` / `bg-card`) with delicate borders and subtle micro-shadows. Never invert this by applying darker cards on a white canvas. In dark mode, an obsidian canvas (`zinc-950`) holds elevated dark cards (`zinc-900/80`).
3. **Conversational, Human Language (Anti-AI-Slop):** Strip away developer-centric implementation details, library name drops (e.g. `@firecrawl/anydoc`), and sci-fi jargon (e.g. "Compound Briefing Capsule"). Use clear, natural words that business owners understand: e.g. **"Pricing Briefing"**, "Drop your sample quotation here (.docx)".
4. **Standardized Component Primitives:** Build with consistent UI components (`Card`, `CardHeader`, `CardTitle`, `CardContent`, `Button`, `Badge`, `Textarea`) from `@/components/ui`, avoiding ad-hoc div soup.
5. **Linear Predictability (Unidirectional State Discipline):** Prevent the chaos of bidirectional synchronization. Moving forward locks previous stages. Editing an earlier stage safely rewinds downstream progress with explicit warning, ensuring backend and AI states remain 100% deterministic.
6. **Separation of Concerns:** Keep technical inspection tools in the theme-matching bottom Dev Inspector, leaving the primary viewport dedicated exclusively to the business proposal workflow.

---

## 2. End-to-End Pipeline Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│  STAGE 1: PRICING BRIEFING (Prompt + Docked Dropzone)                     │
│  - Multiline prompt box (Enter = newline, realistic company placeholder)  │
│  - Compact [Send] button integrated in prompt box bottom-right            │
│  - Docked dropzone directly beneath ([+] Drop .docx or click to browse)   │
│  - On Send: Locks into elevated read-only summary card with [Edit / Reset]│
│  - Reset Dialog: Warns that modifying prompt re-runs extraction           │
└───────────────────────────────────────────────────────────────────────────┘
                                      │
                         [Send] triggers Stage 1 Backend
                         (AnyDoc Markdown + Gemini Variable Extraction)
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  STAGE 2: VARIABLE LEDGER (grouped chips + docked detail tray)            │
│  - 3 rows, one per category, chips fill the width:                        │
│    • Customer inputs (client name, dates, contract length)                │
│    • Pricing (tier, rate, subtotal, tax, total; loop tables as ⊞ chips)   │
│    • Paragraphs (chip glyph: ❝ fixed text / ✦ drafted per client)         │
│  - Tap a chip → detail tray docks under the ledger, connector points at it│
│  - Tray: name (rename inline), "In the quotation" hero, fact grid,        │
│    category dropdown, [Leave out] / [Bring back] (chip stays, dashed)     │
│  - [+ Add one] dashed chip at the end of the ledger                       │
│  - Any edit or re-scan invalidates the Stage 3 template (card removed)    │
│  - Pure placeholders (no math evaluation at this step)                    │
└───────────────────────────────────────────────────────────────────────────┘
                                      │
                     User clicks [Generate template ➔]
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  STAGE 3: TEMPLATE CHECKPOINT (preview-first)                             │
│  - Header "Template ready" + one-line summary of fields / tables / rows   │
│  - Body: clipped, scaled render of the real .docx (click → full preview)  │
│  - Fields the engine could not place appear as chips; tapping one opens   │
│    that variable's tray in Stage 2                                        │
│  - [Download .docx] + size, primary [Set up pricing ➔]                    │
└───────────────────────────────────────────────────────────────────────────┘
                                      │
               User clicks [Set up pricing ➔]
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  STAGE 4: PRICING ENGINE (Rule Cards + Deterministic Math)                │
│  - Model compiles notes + sample quotation + Stage 2 variables → tables + │
│    one definition per document value; one auto-repair on errors/mismatch  │
│  - Assumptions strip → one editable card per table → "What we ask the     │
│    lead" → calculation ledger (readable rule · sample · quotation · ✓/✗)  │
│  - Tap a ledger row → tray edits kind / operator / operands / conditions  │
│  - Footer "N of M match" · [Regenerate] · [Proceed to Check & Generate    │
│    Proposal ➔]                                                            │
└───────────────────────────────────────────────────────────────────────────┘
                                      │
          User clicks [Proceed to Check & Generate Proposal ➔]
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  STAGE 5: CHECK & GENERATE PROPOSAL                                       │
│  - Lead textarea prefilled with the sample message → [Generate proposal]  │
│  - Facts read from the message (read-only; missing → ask / reply loop)    │
│  - Deterministic numbers ledger; review rule → "Declined to auto-quote"   │
│  - Placeholder narrative → easy-template-x .docx → LibreOffice PDF        │
│  - PDF preview in an iframe + .docx / .pdf downloads                       │
└───────────────────────────────────────────────────────────────────────────┘

AMBIENT SHELL COMPONENTS:
├── Slide-Over Configuration Drawer (Sheet): Tone slider, clarification triggers, email switches
└── Bottom Dev Inspector (HUD): Theme-adaptive tray with Profile JSON, AnyDoc MD, Variables JSON, Rule Schema, Logs
```

---

## 3. Detailed Component Specifications

### 3.1 Stage 1: Pricing Briefing (`PromptDocCapsule.tsx`)

#### Wireframe & Visual Anatomy (Wireframe 2)
A top prompt container with all rounded edges and an integrated blue Send button (with zero divider lines), accompanied by a slightly narrower, darker-shaded docked dropzone with rounded corners:

```
┌────────────────────────────────────────────────────────────┐
│ Describe your pricing model, tiers, volume rules, taxes... │
│ (Auto-resizing, no manual resize handle, no dividers)      │
│                                                            │
│                                                   [ Send ] │
└────────────────────────────────────────────────────────────┘
        ┌────────────────────────────────────────────┐
        │                    [+]                     │
        │   Drop your sample quotation here (DOCX)   │
        └────────────────────────────────────────────┘
```

#### Interaction Rules
1. **Seamless Container:** The prompt container has rounded edges all around (`rounded-2xl`). There is NO divider line between the prompt text and the Send button.
2. **Auto-Resizing with Scroll Ceiling:** The prompt textarea automatically expands to fit text as typed (`resize-none overflow-y-auto max-h-72 p-1`), eliminating manual resize handles and clipped text while providing an effortless vertical scroll once the height threshold is exceeded.
3. **Connected Docked Dropzone:** The file dropzone sits tucked underneath the prompt box (`-mt-3.5`), matching its drop shadow (`shadow-xs`), using rounded bottom corners (`rounded-b-2xl`), and a subtly darker tint (`zinc-200/50` in light, `zinc-900/70` in dark) to feel like an attached slide-down shelf.
4. **Primary Theme Action:** The Send button is styled in solid theme blue (`bg-blue-600 hover:bg-blue-500 text-white shadow-xs rounded-xl px-4 py-2 text-sm font-medium`) positioned in the bottom-right corner.
5. **Human-First Copywriting:** No artificial character counts or divider rules. Clean copy ("Drop your sample quotation here (.docx)", "or click to browse from your device").

---

### 3.2 Stage 2: Variable Ledger (`VariableReviewDeck.tsx`)

The purpose of this step is an **overview first, detail on demand**: the user should be able to read every variable in one glance and open one only when they want to check it. Editing is possible but never promoted.

#### Layout
- **Header:** icon (indigo sparkle while the step is open, emerald tick once a template exists — same "settled" signal as Stages 1 and 3), title `Variables`, subtitle `N spots in <Company>'s quotation will change for each client.` followed by the one instruction in foreground weight: `Tap one to check it.` Right: ghost `Re-scan`.
- **Ledger:** three rows, one per category, label column left (`w-28`, muted) and chips wrapping to fill the rest of the width. No filter tabs, no "All" view.
  - `Customer inputs` · `Pricing` (loop tables appear here as chips with a table glyph) · `Paragraphs` (chips carry a glyph: quote mark = fixed text, wand = drafted per client, so the mode decision is visible from the overview).
  - `+ Add one` is a dashed chip at the end of the last row.
- **Chip anatomy:** `h-7 px-2.5 rounded-md text-xs font-medium`, `bg-card border-border shadow-xs`, hover lifts 1px. States: selected = inverted (`bg-foreground text-background`); left out = dashed border + strikethrough, stays in place; needs attention (template missed it) = 6px amber dot.
- **Detail tray:** docks under the ledger with a connector that slides to the selected chip. Opaque `bg-muted` surface, `rounded-xl`, hairline below the header row.
  - Header row: name (inline rename) left; `Category ▾`, `Leave out` / `Bring back`, `×` grouped right.
  - Hero: `In the quotation` → the verbatim sample text at 13px medium.
  - Fact grid (`grid-cols-2 sm:grid-cols-3`, label 11px muted over value 12px foreground): `One of`, `Shown only when`, `Template tag` (`{variable_name}` in mono, so the generated template is readable), `Source` (Added by you).
  - Paragraphs: `How it's filled` segmented control (`Fixed text | Drafted per client`) spans two columns; fixed mode shows `Text used in every proposal`, drafted mode shows the quotation excerpt and `What should the draft focus on?`.
- **Footer:** `N in use, M left out` left; primary `[ Generate template ➔ ]` right (`bg-blue-600 hover:bg-blue-500 text-white`).

#### Colour rule
Category no longer gets a hue. Colour is spent on **state only**: inverted = selected, dashed = left out, amber dot = needs attention, emerald = step settled, blue = the one primary action.

#### State discipline
Every user edit in the tray (rename, category, mode, text, leave out / bring back, add, re-scan) calls `onVariablesEdited`; `App` drops `templateStats`, the Stage 3 card disappears and the header icon reverts to the sparkle until the user generates again.

#### Scanning state
While extraction runs the card shows an agent trace (`Reading the quotation → Finding what changes per client → Sorting into customer inputs, pricing and paragraphs → Checking for repeating tables`, ticking on a timer) above a ghost ledger of pulsing chip placeholders, with the shimmer bar on the card's top edge. The trace is timer-driven because the backend is one opaque call (`ponytail:` comment in code names the upgrade path: stream progress from `/variables/extract`).

---

### 3.3 Stage 3: Template Checkpoint (`TemplateCheckpointCard.tsx`)

The user needs three things here: did it work, is anything wrong, what's next. The memorable element is the document itself.

- **Header:** emerald tick, `Template ready`, one plain sentence built from the stats (`15 fields fill in per client, 1 repeating table, 4 rows hide when empty.`). Right: ghost `Regenerate`.
- **Body:** a clipped, scaled (`scale-[0.62] sm:scale-[0.72]`) `docx-preview` render of the real template with a bottom fade; the whole thumbnail is a button that opens the full preview modal. One blob fetch feeds both. Loading copy: `Drawing your template`.
- **Warnings:** if `details[]` contains misses or context-skips, an amber panel lists them as chips using the variable's natural name; `onFixVariable(target)` opens that chip's tray in Stage 2 and marks the chip with the amber dot.
- **Footer:** ghost `[Download .docx]` with the file size beside it in muted 11px; primary `[ Set up pricing ➔ ]`.
- **Copy rule:** no engine vocabulary (`AST`, `OpenXML`, `docx-preview`, `Pricing Engine`) anywhere the user reads.

---

### 3.4 Stage 4: Pricing Engine & Visual Rule Cards (`PricingEngineDeck.tsx`)

1. **Compilation Input:** the model compiles the pricing notes + the sample quotation markdown + the confirmed Stage 2 variables (names, samples, flags, loop columns, covered values) into `PricingRules`; the deck shows the result after one automatic repair pass. Shimmer bar while compiling; an explicit error panel with "Try again" — never a stuck shimmer.
2. **Sections, top to bottom:**
   - **Assumptions strip** (amber): what the notes left open and how it was resolved.
   - **One `RuleTableCard` per compiled table** (icon by `kind`: packages, bands, add-ons, taxes, splits). Cells are editable and typed by column unit (`font-mono tabular-nums` on money / percent / integer, empty integer = ∞), rows can be added or removed.
   - **What we ask the lead:** chips for the input variables (label, answer type, required dot).
   - **Calculation ledger:** one row per non-input variable in evaluation order — label, plain-language definition ("Packages · first row where Location cap ≥ Number of locations → Monthly rate"), computed sample value, the quotation's value, ✓/✗. Helpers carry a dashed "not in document" chip. Tapping a row docks a tray (`LedgerTray`) that edits kind, unit, guard, operator, operands and conditions; `[+ Add variable]` adds a helper.
   - **Held for review when:** the review rules in words.
3. **Live check:** every edit is saved after 300 ms (`PUT /rules`); the response refreshes the ledger's sample check. A rejected edit shows its errors inline on the offending rows and keeps the edit on screen.
4. **Applied Design System Rules for Stage 4:**
   - **Elevation & Layout:** Cards are pure elevated white (`bg-card`) with crisp 1px borders and `hover:-translate-y-0.5 transition-transform duration-100`.
   - **Input Editing:** Numeric cells enforce `tabular-nums`, commit on blur / Enter, and use clean focus rings (`focus-visible:ring-2 focus-visible:ring-blue-500/20`), avoiding layout jitter.
   - **No Technical Jargon:** the deck never shows JSON; the raw `PricingRules` live in the Dev Dock.
   - **Primary Action:** footer "N of M match the quotation", ghost `[Regenerate]`, theme-blue `[ Proceed to Check & Generate Proposal ➔ ]` (`bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs btn-tactile`), disabled while validation errors exist.

---

### 3.5 Stage 5: Check & Generate Proposal (`LeadSimulator.tsx`)

Rendered under the pricing deck once `working_state.stage === "lead_simulation"`. Header: inbox icon (emerald tick once a proposal exists), `Check & Generate Proposal`, subtitle `Paste what a lead sent you. The numbers come from the rules above, the words from the drafter.`

1. **Lead message:** the Stage 1 fluid textarea (auto-resize, `p-1`, `overflow-y-auto max-h-72 resize-none`, no dividers), prefilled with the company's dev-only `sample_lead_text` and re-synced on company switch; one primary `[ Generate proposal ➔ ]` (`bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs btn-tactile`) that runs extract → generate back to back. The `.shimmer-bar` runs on the card edge while any call is in flight; every failure is an explicit panel with `Try again`, never a stuck shimmer.
2. **Facts panel (`What the lead told us`):** one read-only value row per fact (booleans as `Yes / No`, lists comma-joined, integers `tabular-nums`). A required fact the thread did not answer reads `not in the message` in an amber ring; the run stops here and a **conversation card** drafts the ask (`We asked`: subject, body, `Copy` on the latest one) and opens a reply box (`What the lead wrote back…`) with `[ Let the model answer as the lead ]` — which fills the box, still editable — and `[ Send reply & re-read ]`. The reply joins the thread as `The lead replied`; the whole thread is re-read, facts are replaced outright (the lead's latest word wins, there are no hand edits), and the loop either drafts the next ask or generates on its own once nothing is missing.
3. **Assumptions strip:** amber `Read between the lines:` list of the extractor's judgement calls (range picked, inferred tier, counted devices).
4. **Numbers ledger (`The numbers`):** the in-document money / percent / integer values in calculation order, `font-mono tabular-nums`, the last money value emphasised. No benchmark banner on Stage 5.
5. **Declined panel:** `Declined to auto-quote` (destructive tint, shield icon) listing the review-rule reasons; no document is written.
6. **Split view** (`lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]`): facts, assumptions and ledger left; right a PDF `<iframe>` (or `PDF preview unavailable — download the .docx` with the reason) and `[ Download .docx ]` `[ Download .pdf ]` in the primary style. `docx-preview` is not used here.

---

## 4. Ambient Shell Components

### 4.1 Slide-Over Configuration Drawer (`ConfigurationSheet.tsx`, "Voice & inbox")
Opened from the company context strip, not the header — the header holds developer controls (AI model picker, theme) only. The strip button is the tenant's one solid CTA (`Set up voice & inbox`, amber dot) until the inbox is linked, then a quiet outline pill (`Voice & inbox`, green dot).
- **Proposal voice (free text, not sliders):** *How your proposals should sound* (style notes), *A proposal you're proud of* (optional reference proposal the drafter learns voice and structure from — few-shot beats a formality enum), *When a lead's request is missing details* (how the clarification email should sound). Each has a real example as placeholder; empty means the Stage 5 drafter uses its built-in default.
- **Send from your inbox:** mock link against the company profile address — `Connect inbox` / `Disconnect` act immediately and show `Connected` / `Not connected`. No SMTP or webhooks.
- **Save / Cancel:** explicit; Save is disabled until a field changes, and Cancel, Esc and the backdrop discard the draft.
- **Design Consistency:** shadcn Sheet on base-ui Dialog (focus trap, Esc, scroll-lock), `bg-card`, `z-50` above the Dev Dock, zero jargon.
- **Persistence:** `company_configurations` table (typed columns, one row per company), capped at 6,000 chars per field; untouched by pipeline resets and by "Import Settings".

### 4.2 Bottom Dev Inspector (`DevDock.tsx`)
A minimal, docked tray at the bottom of the screen (collapsible down to a corner pill `[ <Code2 /> Dev Inspector ]` with a single clean icon):
- **Full-Width Header & Constrained Content:** The top controls and tabs bar spans full width (`w-full`), while content previews are centered within a comfortable scanning boundary (`max-w-6xl mx-auto w-full`) to prevent horizontal fatigue on ultrawide monitors.
- **Theme Adaptive:** Renders using active theme variables (`bg-card/95 text-foreground border-border`) in both light and dark mode.
- **Readable & Wrapped:** Enforces `text-xs` / `text-sm` typography with `whitespace-pre-wrap break-words break-all` (no horizontal scrollbars).
- **Expanded Coverage:** Expands up to 90% screen height (`h-[90vh]`) for clear inspection.
- **Tab 1: Profile JSON:** Raw company profile JSON relocated from the main workspace for cleaner presentation.
- **Tab 2: AnyDoc Markdown:** Semantic markdown output from the uploaded quotation.
- **Tab 3: Variables JSON:** Raw taxonomy payload with anchors and categories.
- **Tab 4: Pricing Rules JSON:** the raw `PricingRules`, editable in place; `Apply` PUTs it and lists validation errors (nothing is persisted on a 400).
- **Tab 5: Pipeline Logs:** compact pipeline-state snapshot, the docxmlater mutation table (`template_stats.details[]`, ✓/✗ per tag), and the on-disk run artifacts (`logs/<company>/`, last 20, expandable inline). No token usage is captured.

---

## 5. Visual Aesthetics, Color Tokens & Micro-Interactions

### 5.1 Tonal Elevation & Surface Hierarchy (Cards Elevated on Canvas)
- **Canvas Base:**
  - Light Mode: Neutral Soft Gray (`#f4f4f5` / `zinc-100/80` or `oklch(0.97 0.003 286)`).
  - Dark Mode: Deep Obsidian (`#09090b` / `zinc-950`).
- **Cards & Stage Containers (`PromptDocCapsule`, `CompanyProfileCard`, etc.):**
  - Light Mode: Pure elevated white (`#ffffff` / `bg-card`), crisp border (`border-border` / `border-zinc-200/80`), subtle micro-shadow (`shadow-xs` or `shadow-sm`).
  - Dark Mode: Elevated obsidian (`#18181b` / `zinc-900/80`), subtle border (`border-zinc-800/80`).
- **Inner Recessed Wells (Prompt Box & Docked Dropzone):**
  - Light Mode: Clean bordered container with soft tint (`bg-zinc-50/70` or `bg-white` with `border-zinc-200`). Never render dirty darker cards on lighter canvas.
  - Dark Mode: `#121215` / `zinc-950/70` with clean border (`border-zinc-800/80`).

### 5.2 Deterministic Semantic Color Palette
Dynamic variables and UI states follow strict semantic color mappings for instant human scannability:

| Category / State | Palette Token | Tailwind Classes (Dark / Light) | Purpose & Semantics |
| :--- | :--- | :--- | :--- |
| **Customer Inputs** | Electric Sky | `bg-sky-500/10 text-sky-400 border-sky-500/25` / `bg-sky-50 text-sky-700 border-sky-200` | Variables that vary per lead inquiry (e.g., client name, location count). |
| **Pricing Placeholders** | Mint / Emerald | `bg-emerald-500/10 text-emerald-400 border-emerald-500/25` / `bg-emerald-50 text-emerald-700 border-emerald-200` | Computed monetary fields, unit rates, discounts, totals. Conveys financial precision. |
| **Narrative Paragraphs** | Amethyst / Violet | `bg-violet-500/10 text-violet-400 border-violet-500/25` / `bg-violet-50 text-violet-700 border-violet-200` | Generative clauses, SOW, SLA, terms. Conveys AI language synthesis. |
| **Static Original** | Muted Slate | `bg-zinc-800/50 text-zinc-400 border-zinc-700/50` / `bg-slate-100 text-slate-500 border-slate-200` | Unmodified Word content retained verbatim without dynamic tags. |
| **Primary Actions / Glow** | Electric Indigo | `bg-gradient-to-r from-indigo-500 to-violet-600 shadow-indigo-500/20` | High-confidence advance buttons (`[Send ➔]`, `[Generate template ➔]`, `[Set up pricing ➔]`). |

### 5.3 Motion Choreography & Micro-Animations (<200ms GPU Accelerated)
Zero heavy animation libraries; leverage native CSS transitions and `tw-animate-css`:

1. **Docked Dropzone Hover & Drop:**
   - **Idle:** Dashed border (`border-dashed border-border/60 hover:border-primary/50`).
   - **Drag-Over:** Transitions to a smooth pulsing focus ring (`ring-2 ring-primary/60 bg-primary/10 transition-all duration-150`).
   - **File Attached:** Instant badge pop-in with animated file icon bounce (`animate-in fade-in zoom-in-95 duration-150`).
2. **Compound Capsule Morph (Stage 1 Lock):**
   - On submission, textarea smoothly collapses into a locked status ribbon (`transition-all duration-200 ease-out`).
   - `[Send ➔]` transitions into `[Edit / Reset ✎]` with opacity fade.
   - Downstream stages reveal via `animate-in fade-in slide-in-from-bottom-3 duration-300`.
3. **One orchestrated moment for the Variable Ledger:**
   - When a scan lands, chips deal in once with a 20 ms stagger (`animate-in fade-in slide-in-from-bottom-1 duration-300`, `animationFillMode: backwards`). Nothing else on the ledger moves unprompted.
   - Tapping a chip inverts it (120 ms) and the tray's connector slides on the x-axis to it (`transition-[left] duration-200`); tray content crossfades. `motion-reduce` disables the stagger and slides.
4. **Tactile Physics for Interactive Elements:**
   - Hover lift: `hover:-translate-y-0.5 transition-transform duration-100`.
   - Active press: `active:scale-[0.98] active:translate-y-0 duration-75`.
5. **Ambient "Thinking" Shimmer for AI Tasks:**
   - During document AST parsing and rule compilation, display an ambient gradient shimmer line across the container top edge rather than blocking spinners.
6. **Tabular Numeric Alignment:**
   - All financial figures, rate multipliers, and JSON schema numbers enforce `font-mono` / `tabular-nums` to eliminate layout jitter during live calculations.

