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
2. **Auto-Resizing with Scroll Ceiling:** The prompt textarea automatically expands to fit text as typed (`resize-none overflow-y-auto max-h-72 p-1`), eliminating manual resize handles and clipped text while providing an effortless vertical scroll once the height threshold is exceeded.
3. **Connected Docked Dropzone:** The file dropzone sits tucked underneath the prompt box (`-mt-3.5`), matching its drop shadow (`shadow-xs`), using rounded bottom corners (`rounded-b-2xl`), and a subtly darker tint (`zinc-200/50` in light, `zinc-900/70` in dark) to feel like an attached slide-down shelf.
4. **Primary Theme Action:** The Send button is styled in solid theme blue (`bg-blue-600 hover:bg-blue-500 text-white shadow-xs rounded-xl px-4 py-2 text-sm font-medium`) positioned in the bottom-right corner.
5. **Human-First Copywriting:** No artificial character counts or divider rules. Clean copy ("Drop your sample quotation here (.docx)", "or click to browse from your device").

---

### 3.2 Stage 2: Categorized Variable Review Chip-Deck (`VariableReviewDeck.tsx`)

Rather than an administrative data table, dynamic variables appear as modular, interactive cards grouped into 3 intuitive buckets, adhering to the elevated card design system:

#### Applied Design System Rules for Stage 2
- **Surface Elevation:** The deck container and individual variable cards are elevated pure white surfaces (`bg-card` / `#ffffff`) with crisp borders (`border-border/80`) and `shadow-xs`.
- **Slid-Down Filter Shelf:** The category filter pill tray sits connected under the header with a darker subtle tint (`zinc-200/50` / `zinc-900/70`), matching the connected shelf pattern established in Stage 1.
- **Component Primitives:** Built strictly using `@/components/ui` (`Card`, `Badge`, `Button`, `Input`, `Textarea`).
- **Human Copywriting:** Replace backend engine terms with clear terms: "Snippet found in quotation" (instead of "AST anchor verified"), "Category" (instead of "Taxonomy Bucket").

#### The 3 Categories
1. **Customer Inputs (`customer_input`):** Variables that change with every new lead inquiry (e.g. `client_name`, `num_locations`, `seat_count`, `client_state`). Styled with Sky badge token.
2. **Pricing Placeholders (`pricing`):** Computed monetary fields and rates generated by the pricing engine (e.g. `package_tier`, `monthly_rate`, `setup_fee`, `tax_amount`, `grand_total`). Styled with Emerald badge token.
3. **Narrative Paragraphs (`paragraph`):** Multi-sentence clauses that can be fixed boilerplate or drafted dynamically by AI (e.g. `scope_of_work`, `support_sla`, `payment_milestones`). Styled with Violet badge token.

#### Standard Chip Anatomy (Customer & Pricing)
```
┌───────────────────────────────────────────────────────────────────────────┐
│ Number of Locations           {{num_locations}}       [Customer Input ▾]  │
│ Sample in quotation: "2 locations"                     [Edit]    [Remove] │
└───────────────────────────────────────────────────────────────────────────┘
```
- **Inline Rename:** Clean inline text input without intrusive borders.
- **Category Switcher:** Native select or dropdown that re-categorizes the chip instantly.
- **Quotation Snippet:** Displays the verbatim sample text found in the original quotation.

#### Narrative Paragraph Card Anatomy
```
┌───────────────────────────────────────────────────────────────────────────┐
│ Scope of Work Clause          {{scope_of_work}}             [Paragraph ▾] │
│                                                                           │
│ Mode: (●) AI-Generated    ( ) Fixed Boilerplate                           │
│                                                                           │
│ Prompt tip for AI:                                                        │
│ Emphasize local SEO audits, Google Business Profile, and weekly reports.  │
│ (Auto-resizing, p-1, max-h-48 overflow-y-auto, no dividers)               │
│                                                        [Edit]    [Remove] │
└───────────────────────────────────────────────────────────────────────────┘
```
- **Fluid Prompt Tip Textarea:** Follows the Stage 1 rule—auto-resizes with content, comfortable padding (`p-1`), `max-h-48 overflow-y-auto` (no cut-off text or box-in-box borders), no dividers.
- **Primary Advance Action:** Consistent theme-blue CTA: `[ Confirm Variables & Generate Template ➔ ]` (`bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-xs`).

---

### 3.3 Stage 3: Minimal Template Checkpoint (`TemplateCheckpointCard.tsx`)

Generating the template is an essential verification checkpoint, but must remain low-profile and avoid developer-centric bragging.

#### Applied Design System Rules for Stage 3
- **Surface:** Clean, elevated white card (`bg-card`) with `border-border/80` and `shadow-xs`.
- **Anti-AI-Slop Copywriting:** Strip away internal engine mentions like "mutated the OpenXML AST" or "docxtemplater pipeline". Use human terms:
  - Header: `Dynamic Template Generated Successfully`
  - Subtitle: `14 dynamic fields and 1 repeating table configured`
- **Actions:** Secondary button `[ Quick Preview (.docx) ]` (`variant="outline"`) paired with primary theme-blue advance button `[ Proceed to Pricing Engine ➔ ]` (`bg-blue-600 hover:bg-blue-500 text-white`).

---

### 3.4 Stage 4: Pricing Engine & Visual Rule Cards (`PricingEngineDeck.tsx`)

1. **Compilation Input:** Gemini compiles rules using the Natural Pricing Prompt + Confirmed Variables + Sample Quotation Values.
2. **Visual Rule Cards:**
   - Packages & Tiers Card: Base rates, location/seat limits, SLA tiers.
   - Volume Breakpoints Card: Per-unit step discounts, location tiers.
   - Add-ons & Modifiers Card: Extra services, stackable discounts.
   - Taxes & Milestones Card: State tax rules, payment deposit milestones.
3. **Applied Design System Rules for Stage 4:**
   - **Elevation & Layout:** Cards are pure elevated white (`bg-card`) with crisp 1px borders.
   - **Input Editing:** Numeric fields enforce `tabular-nums` using shadcn `Input` primitives with clean focus rings (`focus-visible:ring-2 focus-visible:ring-blue-500/20`), avoiding layout jitter.
   - **No Technical Jargon:** Replace references to "PricingRuleSchema AST JSON" with "Pricing Rules".
   - **Primary Action:** Theme-blue advance button `[ Confirm Rules & Test Simulator ➔ ]` (`bg-blue-600 hover:bg-blue-500 text-white`).

---

### 3.5 Stage 5: Lead Simulator & Proposal Verification (`LeadSimulator.tsx`)

1. **Inbound Simulation:**
   - Multi-line inquiry textarea using the Stage 1 fluid input pattern: auto-resizes to fit email text, padded with `p-1`, equipped with `overflow-y-auto max-h-72 resize-none` to prevent clipped lines, and no internal divider lines.
   - Clean quick-action button: `Load Sample Inquiry` pre-configured per company.
2. **Deterministic Calculation Display:** Formatted line-item breakdown using `tabular-nums` on an elevated surface.
3. **Proposal Preview:** Embedded in-browser preview via `docx-preview` housed in a clean container with `[ Download Proposal (.docx) ]` (`bg-blue-600 hover:bg-blue-500 text-white`).

---

## 4. Ambient Shell Components

### 4.1 Slide-Over Configuration Drawer (`ConfigurationSheet.tsx`)
Accessible via a `[ Settings ⚙️ ]` button in the top navigation bar.
- **AI Tone & Style:** Formality slider (Formal / Consultative / Energetic), Brevity toggle (Concise / Detailed).
- **Customer Clarification Triggers:** Threshold for when AI should ask clarifying questions versus adopting reasonable defaults.
- **Email Integration Settings:** Inbound reply webhook triggers, test recipient email.
- **Design Consistency:** Uses shadcn Sheet primitive with theme-adaptive background (`bg-card`), clean typography, and zero jargon.
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

