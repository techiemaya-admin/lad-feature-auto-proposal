# 02: Compound Briefing Capsule and Quotation Ingestion Pipeline

**What to build:** A unified compound briefing capsule fusing the natural-language pricing prompt and quotation document ingestion into a single agentic component (`PromptDocCapsule.tsx`). The tenant writes pricing guidelines in a multiline textarea (where `Enter` creates newlines and realistic placeholders provide guidance) and attaches a Microsoft Word (`.docx`) quotation via a docked dropzone directly beneath the prompt (with drag-and-drop and file browser). The "Send" button activates only when both prompt and document are present. On submit, the backend saves the quotation under `storage/<company_id>/original_quotation.docx`, parses it to Markdown via `@firecrawl/anydoc`, saves document metadata and the updated pricing spec in SQLite, and transitions the frontend briefing capsule into a read-only locked state with an `[Edit / Reset ✎]` button. Clicking edit triggers an explicit warning modal, preserving user text while safely clearing downstream state.

**Blocked by:** 01: Foundation and Multi-Company Shell

**Status:** ready-for-agent

- [ ] Install `@firecrawl/anydoc` and `multer` in backend dependencies.
- [ ] Configure Multer storage to route uploaded `.docx` files to `storage/<company_id>/original_quotation.docx`.
- [ ] Implement backend route `POST /api/companies/:id/briefing/submit` (or paired upload & spec endpoints) accepting prompt text + `.docx` upload, executing AnyDoc Markdown conversion, and updating SQLite.
- [ ] Store document metadata (filename, size, extracted markdown, parse timestamp) in SQLite.
- [ ] Build Compound Briefing Capsule UI (`PromptDocCapsule.tsx`) with multiline prompt textarea, docked dropzone directly underneath, and smart `[Send ➔]` button validation.
- [ ] Apply recessed darker well styling for prompt textarea and dropzone (`zinc-900/90` with inset shadow in dark mode) to prevent box-in-box nesting.
- [ ] Implement dropzone micro-interactions: drag-over focus ring pulse (`ring-2 ring-primary/60 bg-primary/10 transition-all duration-150`) and attached file badge pop-in (`animate-in fade-in zoom-in-95`).
- [ ] Implement tactile button physics (`active:scale-[0.98]`) and electric indigo gradient glow on the `[Send ➔]` CTA.
- [ ] Implement Locked State presentation: smooth collapse transition (<200ms) into read-only briefing ribbon with document status chip and `[Edit / Reset ✎]` button.
- [ ] Implement Hard Reset confirmation modal: prompts user, preserves existing prompt text upon unlock, and safely resets downstream state.
- [ ] Hook AnyDoc Markdown output into the Bottom Dev Dock tab.
- [ ] Verify that submitting all three sample companies (`co1_seo`, `co2_msp`, `co3_dev`) produces clean AnyDoc Markdown and transitions smoothly into the locked state.
