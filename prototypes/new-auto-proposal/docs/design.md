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
│  STAGE 2: CATEGORIZED VARIABLE REVIEW CHIP-DECK                           │
│  - 3 Category Buckets:                                                    │
│    • Customer Inputs (client name, location count, seats, state)          │
│    • Pricing Placeholders (rate, tier, subtotal, tax, total)              │
│    • Narrative Paragraphs (scope of work, SLA, terms)                     │
│  - Category Filter Pills with counts + [+] Add Chip button                │
│  - Add Chip: User enters exact quote text snippet (Backend verifies AST)  │
│  - Move Bucket: Type dropdown moves chip (Moving to Paragraph = Fixed)    │
│  - Delete Chip: Keeps original text as static Word content                │
│  - Paragraph Mode Toggle: [Fixed Boilerplate] vs [AI-Generated + Tip]    │
│  - Pure placeholders (no math evaluation at this step)                    │
└───────────────────────────────────────────────────────────────────────────┘
                                      │
               User clicks [Confirm Variables & Generate Template ➔]
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  STAGE 3: MINIMAL TEMPLATE CHECKPOINT                                     │
│  - Compact inline card: "14 tags placed, 1 line-item loop configured"     │
│  - Optional "Quick Preview (.docx)" modal using docx-preview              │
│  - Fast confirmation checkpoint, not a heavy blocking step                │
└───────────────────────────────────────────────────────────────────────────┘
                                      │
               User clicks [Proceed to Pricing Engine ➔]
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  STAGE 4: PRICING ENGINE (Rule Cards + Deterministic Math)                │
│  - Gemini compiles rules using: Prompt + Sample Doc Values + Variables    │
│  - Visual interactive cards for packages, breakpoints, add-ons, taxes     │
│  - Pure JS deterministic calculation engine (100% precision)              │
└───────────────────────────────────────────────────────────────────────────┘
                                      │
               User clicks [Proceed to Lead Simulation ➔]
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  STAGE 5: LEAD SIMULATION & PROPOSAL VERIFICATION                         │
│  - Paste unstructured lead email or click "Load Sample Inquiry"           │
│  - Gemini extracts lead parameters; deterministic math runs               │
│  - Gemini drafts tailored narrative based on prompt tips                  │
│  - easy-template-x renders final .docx proposal                           │
│  - In-browser preview via docx-preview + one-click download               │
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
2. **Auto-Resizing with Scroll Ceiling:** The prompt textarea automatically expands to fit text content dynamically (`resize-none`), combined with `overflow-y-auto max-h-72` and comfortable padding (`p-1`) so text is never vertically cut off and scrolls gracefully if exceptionally long.
3. **Send Action:** Submission is triggered exclusively by clicking the compact blue **`[Send]`** button in the bottom-right of the prompt container.
4. **No Clutter:** Character counts and persistent nagging banners are excluded.
5. **Connected Slid-Down Dropzone:** The file attachment dropzone sits directly beneath the prompt with negative top margin (`-mt-3.5`), matching drop shadow (`shadow-xs`), rounded bottom corners (`rounded-b-2xl`), and a darker distinguishing shade (`zinc-200/50` / `zinc-900/70`). It features a simple `[+]` icon and `"Drop your sample quotation here (.docx)"` / `"or click to browse from your device"` text. Upon file attachment, it displays a concise file badge with a removal action.
6. **State & Height Synchronization on Reset:** Parent components pass composite keys (e.g. `key={`${company.company_id}_${company.updated_at || ""}`}`) and mirror prop updates, ensuring that resetting defaults or importing settings immediately re-initializes text state and recalculates auto-resize heights without layout freezing.

#### Locked State Presentation
Upon clicking **`[Send]`**, the briefing card transitions into an elevated read-only state:
- Clean card with subtle borders.
- Shows green check badge: `Pricing Briefing • Locked & Active`.
- Shows document status chip: `📄 quotation.docx (142 KB)`.
- Displays an **`[Edit / Reset ✎]`** button in the top right.

#### Hard Reset & Warning Modal
If the user clicks **`[Edit / Reset ✎]`**:
- A confirmation dialog appears:
  > **Reset Downstream Pipeline?**
  > Editing your pricing prompt or quotation will re-extract variables and regenerate downstream templates and pricing rules. Your current text will be preserved in the prompt box.
  > `[Cancel]`  `[Unlock & Reset Pipeline]`
- Upon confirmation:
  - The card returns to the editable state.
  - Text is preserved.
  - Downstream stages (Variables, Template, Rules) are cleared in UI and database.

---

### 3.2 Stage 2: Categorized Variable Review Chip-Deck (`VariableReviewDeck.tsx`)

Rather than an administrative data table, dynamic variables appear as modular, interactive cards grouped into 3 intuitive buckets.

#### The 3 Categories
1. **Customer Inputs (`customer_input`):** Variables that change with every new lead inquiry (e.g. `client_name`, `num_locations`, `seat_count`, `client_state`).
2. **Pricing Placeholders (`pricing`):** Computed monetary fields and rates generated by the pricing engine (e.g. `package_tier`, `monthly_rate`, `setup_fee`, `tax_amount`, `grand_total`).
3. **Narrative Paragraphs (`paragraph`):** Multi-sentence clauses that can be fixed boilerplate or drafted dynamically by AI (e.g. `scope_of_work`, `support_sla`, `payment_milestones`).

#### Header & Filter Bar
`[ All (18) ]  [ Customer Inputs (5) ]  [ Pricing (9) ]  [ Paragraphs (4) ]  [ + Add Chip ]`

#### Standard Chip Anatomy (Customer & Pricing)
```
┌───────────────────────────────────────────────────────────────────────────┐
│ 🏷️ Number of Locations         {{num_locations}}      [Customer Input ▾]  │
│ Sample in quote: "2 locations"                           [Edit ✎] [Delete ✕]│
└───────────────────────────────────────────────────────────────────────────┘
```
- **Inline Rename:** Clicking the natural name lets the user rename it.
- **Type Dropdown (Bucket Switcher):** Selecting a different category immediately moves the chip to that bucket.
- **Quotation Snippet:** Displays the verbatim sample text found in the original document.
- **Delete Action:** Clicking `[Delete ✕]` removes the chip. The underlying Word document will leave that text as static original text (no dynamic tag inserted).

#### Narrative Paragraph Card Anatomy
```
┌───────────────────────────────────────────────────────────────────────────┐
│ 📄 Scope of Work Clause         {{scope_of_work}}             [Paragraph ▾]│
│                                                                           │
│ Mode: (●) AI-Generated    ( ) Fixed Boilerplate                           │
│                                                                           │
│ ✦ Prompt Tip for AI:                                                     │
│ ┌───────────────────────────────────────────────────────────────────────┐ │
│ │ Emphasize local SEO audits, Google Business Profile, and 24/7 reports.│ │
│ └───────────────────────────────────────────────────────────────────────┘ │
│                                                          [Edit ✎] [Delete ✕]│
└───────────────────────────────────────────────────────────────────────────┘
```
- **Mode Toggle:**
  - **`AI-Generated`:** Shows an editable "Prompt Tip" textarea giving instructions to the LLM when drafting this section for future leads.
  - **`Fixed Boilerplate`:** Shows a textarea containing the verbatim text extracted from the quote, allowing manual editing of static boilerplate.
- **Default on Category Switch:** Moving any variable into the `paragraph` bucket automatically defaults to `[Fixed Boilerplate]` using the quotation snippet.

#### Adding Custom Chips (`[ + Add Chip ]`)
- Clicking `[+ Add Chip]` opens a focused inline popover or modal:
  - **Quotation Text Snippet (Required):** The user pastes or types the exact text from their quotation that they wish to parameterize.
  - **Natural Name:** e.g., "Industry Vertical".
  - **Category:** `Customer Input`, `Pricing`, or `Paragraph`.
- **Backend Validation:** The backend checks the document's AST for that exact text. If found, it anchors the text and generates the variable slug; if not found, it returns an alert: *"Text snippet not found in the uploaded quotation."*

#### Confirming Variables
At the bottom of the chip deck:
`[ Confirm 18 Variables & Generate Template ➔ ]`

---

### 3.3 Stage 3: Minimal Template Checkpoint (`TemplateCheckpointCard.tsx`)

Generating the template is an essential verification step, but it must not feel like an onerous barrier.

#### Visual Anatomy
```
┌───────────────────────────────────────────────────────────────────────────┐
│ 📄 Dynamic Template Generated Successfully                                │
│ 14 scalar tags placed • 1 repeating line-item loop configured             │
│                                                                           │
│ [ 👁️ Quick Preview (.docx) ]                 [ Proceed to Pricing Engine ➔ ]│
└───────────────────────────────────────────────────────────────────────────┘
```
- **Low Profile:** A concise banner acknowledging that `docxmlater` successfully parsed and mutated the OpenXML AST.
- **Quick Preview:** An optional modal running `docx-preview` allowing the tenant to visually verify that placeholders (e.g. `{client_name}`, `{#line_items}`) are properly embedded without styling artifacts.
- **Fast Path:** The tenant can immediately click `[Proceed to Pricing Engine ➔]` without waiting or performing mandatory clicks.

---

### 3.4 Stage 4: Pricing Engine & Visual Rule Cards (`PricingEngineDeck.tsx`)

1. **Compilation Input:** Gemini compiles rules using the **Natural Pricing Prompt + Confirmed Variables + Sample Quotation Values**.
2. **Visual Rule Cards:**
   - **Packages / Tiers Card:** Base fees, seat/location caps, SLA terms.
   - **Volume Breakpoints Card:** Step discounts, per-unit tiers.
   - **Add-ons & Modifiers Card:** Extra services, stackable discounts.
   - **Taxes & Milestones Card:** State tax conditions, 50/50 payment milestones.
3. **Deterministic Verification:** Inline edits on cards update the underlying `PricingRuleSchema`. Pure JavaScript math recalculates totals instantly with 100% precision.
4. **Advance Action:** `[ Confirm Rules & Test Simulator ➔ ]`.

---

### 3.5 Stage 5: Lead Simulator & Proposal Verification (`LeadSimulator.tsx`)

1. **Inbound Simulation:**
   - Textarea to paste unstructured client email inquiries.
   - "Load Sample Lead Message" button pre-configured for each company.
2. **Deterministic Computation:** Parameter extraction feeds the JavaScript math engine, displaying exact line-item breakdowns matching `verification_guide.md`.
3. **Final Proposal Generation:** `easy-template-x` hydrates the dynamic `.docx` template with the calculated numbers and Gemini-drafted narrative paragraphs.
4. **Deliverable Preview:** Full in-browser proposal rendering via `docx-preview` + `[ Download Proposal (.docx) ]`.

---

## 4. Ambient Shell Components

### 4.1 Slide-Over Configuration Drawer (`ConfigurationSheet.tsx`)
Accessible via a `[ Settings & Tone ⚙️ ]` button in the top navigation bar.
- **AI Tone & Style:** Formality slider (Formal / Consultative / Energetic), Brevity toggle (Concise / Detailed).
- **Customer Clarification Triggers:** Threshold for when AI should ask clarifying questions versus adopting reasonable defaults.
- **Email Integration Settings:** Inbound reply webhook triggers, test recipient email.
- **Persistence:** Saved in SQLite per company independently of prompt resets.

### 4.2 Bottom Dev Inspector (`DevDock.tsx`)
A minimal, docked tray at the bottom of the screen (collapsible down to a corner pill `[ <Code2 /> Dev Inspector ]` with a single clean icon):
- **Full-Width Header & Constrained Content:** The top controls and tabs bar spans full width (`w-full`), while content previews are centered within a comfortable scanning boundary (`max-w-6xl mx-auto w-full`) to prevent horizontal fatigue on ultrawide monitors.
- **Theme Adaptive:** Renders using active theme variables (`bg-card/95 text-foreground border-border`) in both light and dark mode.
- **Readable & Wrapped:** Enforces `text-xs` / `text-sm` typography with `whitespace-pre-wrap break-words break-all` (no horizontal scrollbars).
- **Expanded Coverage:** Expands up to 90% screen height (`h-[90vh]`) for clear inspection.
- **Tab 1: Profile JSON:** Raw company profile JSON relocated from the main workspace for cleaner presentation.
- **Tab 2: AnyDoc Markdown:** Semantic markdown output from the uploaded quotation.
- **Tab 3: Variables JSON:** Raw taxonomy payload with anchors and categories.
- **Tab 4: Pricing Schema JSON:** Formatted `PricingRuleSchema` with copy capabilities.
- **Tab 5: Pipeline Logs:** Timestamps, token usage, and AST replacement records.

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
| **Primary Actions / Glow** | Electric Indigo | `bg-gradient-to-r from-indigo-500 to-violet-600 shadow-indigo-500/20` | High-confidence advance buttons (`[Send ➔]`, `[Confirm Variables ➔]`). |

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
3. **Staggered Cascade for Extracted Variable Chips:**
   - Discovered chips cascade onto the deck sequentially via `style={{ animationDelay: \`${Math.min(idx * 25, 300)}ms\` }}` using `animate-in fade-in slide-in-from-bottom-2`.
4. **Tactile Physics for Interactive Elements:**
   - Hover lift: `hover:-translate-y-0.5 transition-transform duration-100`.
   - Active press: `active:scale-[0.98] active:translate-y-0 duration-75`.
5. **Ambient "Thinking" Shimmer for AI Tasks:**
   - During document AST parsing and rule compilation, display an ambient gradient shimmer line across the container top edge rather than blocking spinners.
6. **Tabular Numeric Alignment:**
   - All financial figures, rate multipliers, and JSON schema numbers enforce `font-mono` / `tabular-nums` to eliminate layout jitter during live calculations.

