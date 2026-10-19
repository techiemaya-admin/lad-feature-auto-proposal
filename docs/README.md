# Auto-Proposal — Documentation

Zero-configuration proposal generation: an uploaded or AI-generated sample Word quotation plus natural-language pricing notes in, client-ready `.docx` and PDF proposals out. Five stages, all described here.

## Quick setup

Requires Node.js; LibreOffice is needed for PDF export (set `SOFFICE_PATH` if `soffice` is not on `PATH`).

```bash
cd backend
cp .env.example .env        # Windows: copy .env.example .env — add your API key(s)
npm install
npm run dev                 # http://localhost:3001

cd ../frontend
npm install
npm run dev                 # http://localhost:5173
```

The SQLite database and mock companies are created on first start. Engineering rules for agents live in [AGENTS.md](../AGENTS.md).

## Reading order

1. [architecture.md](architecture.md) — how the five stages fit together: parsing, variable taxonomy, Word mutation, pricing, generation.
2. [ui.md](ui.md) — screens, navigation and interaction rules for each stage.

Then read only the feature you are working on:

- [features/template-library.md](features/template-library.md) — company-scoped templates, ICP import, capacity, saved-email routing.
- [features/sample-proposals.md](features/sample-proposals.md) — AI-generated sample quotations, custom sections, Word styling.
- [features/pricing-engine.md](features/pricing-engine.md) — rule schema, compiler, calculator and the payload contract.
- [features/lead-simulator.md](features/lead-simulator.md) — lead extraction, clarification loop, narrative and document generation.
- [features/dates.md](features/dates.md) — dates as sheet values (`today`, `add_days`, `add_months`).
- [features/review-rules.md](features/review-rules.md) — the Stage 4 "Held for review when" editor.

## Related material in Mock Data

These stay with the fixtures they describe:

- [Mock Data/Verification Guide.md](../Mock%20Data/Verification%20Guide.md) — pricing arithmetic and the three benchmark totals.
- [Mock Data/Demo Inputs.md](../Mock%20Data/Demo%20Inputs.md) — paste-ready pricing prompt, `.docx` and lead email per company.
- [Mock Data/Other/DocXMLater Research.md](../Mock%20Data/Other/DocXMLater%20Research.md) — background on the Word mutation library.
- [Mock Data/Other/Problem Discovery.md](../Mock%20Data/Other/Problem%20Discovery.md) — the original problem notes.

## Document ownership

One topic, one file. [AGENTS.md](../AGENTS.md) owns the engineering rules; `architecture.md` owns how the system fits together; `ui.md` owns screen behaviour; each file under `features/` owns one feature contract; the guides in `Mock Data/` own the numbers and demo inputs.
