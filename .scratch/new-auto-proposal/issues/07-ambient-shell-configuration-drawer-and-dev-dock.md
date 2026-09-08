# 07: Ambient Shell — Slide-Over Configuration Drawer and Bottom Dev Dock

**What to build:** The two persistent ambient shell components that decouple peripheral settings and developer diagnostics from the primary generative pipeline:
1. **Slide-Over Configuration Drawer (`ConfigurationSheet.tsx`):** A sleek slide-over drawer triggered by a `[ Settings & Tone ⚙️ ]` button in the top navigation bar. Houses controls for AI Formality & Brevity tone sliders, customer clarification thresholds, and email integration settings. These settings are persisted per-company in SQLite independently of prompt and pipeline resets.
2. **Bottom Developer Dock (`DevDock.tsx`):** A minimalist bottom tray collapsible to a floating corner pill (`[ </> Dev Inspector ]`). Houses 4 developer tabs:
   - Tab 1: **AnyDoc Markdown** (semantic markdown extracted from uploaded quotation).
   - Tab 2: **Variables JSON** (raw extracted dynamic taxonomy with AST context anchors).
   - Tab 3: **Pricing Schema JSON** (editable `PricingRuleSchema` with copy and syntax validation).
   - Tab 4: **Pipeline Logs** (execution timestamps, token counts, and docxmlater replacement records).

**Blocked by:** 01: Foundation and Multi-Company Shell

**Status:** ready-for-agent

- [ ] Install Lucide icons or Shadcn Sheet component if needed.
- [ ] Create SQLite schema / columns for company configurations (`tone`, `clarification_threshold`, `email_settings`) in backend database.
- [ ] Implement backend endpoints `GET /api/companies/:id/configurations` and `PUT /api/companies/:id/configurations`.
- [ ] Build `ConfigurationSheet.tsx` with tone slider, clarification threshold selector, and email integration toggles.
- [ ] Add header entrypoint button `[ Settings & Tone ⚙️ ]` in `App.tsx`.
- [ ] Build `DevDock.tsx` with collapsible floating pill and tabbed terminal-style viewer (AnyDoc Markdown, Variables JSON, Pricing Schema JSON, Pipeline Logs).
- [ ] Wire up live state from Briefing, Variables, Template, and Pricing modules into the DevDock tabs.
- [ ] Verify that changing configuration settings persists across company tab switches and remains unaffected by prompt/pipeline resets.
