# Business Minded — Sprint 1

Mission: increase business value while reducing owner dependence.

Sprint 1 objective: ship the first customer-facing Business Health Check. This sprint is for validation, not scale or perfection.

## Customer flow

Landing Page → Business Health Check (Assessment) → Results → Email Capture → Download Report

## Tech stack

Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui-style components, Prisma, PostgreSQL, Docker.

## Architecture

Clean Architecture, with dependencies pointing inward. UI and Infrastructure both depend on Application and Domain; Domain depends on nothing.

```
src/
  domain/            Entities and repository/port interfaces. No framework code, no I/O.
    entities/         Question, Answer, Score, Lead, AssessmentResult
    value-objects/    Insight
    repositories/     Ports: QuestionRepository, ScoringConfigRepository, ScoringEngine,
                       AssessmentResultRepository, LeadRepository, ReportEngine

  application/        Use cases that orchestrate ports. No UI, no Prisma, no JSON parsing.
    use-cases/        GetQuestionSet, SubmitAssessment, CaptureLead, GenerateReport
    dto/              Zod schemas for API input validation

  infrastructure/      Adapters that implement the domain ports.
    config/           questions.json, scoring-rules.json  (all business logic config lives here)
    repositories/      JsonQuestionRepository, JsonScoringConfigRepository,
                       PrismaAssessmentResultRepository, PrismaLeadRepository
    scoring-engine/    ConfigurableScoringEngine (implements ScoringEngine)
    report-engine/     PdfReportEngine (implements ReportEngine, uses pdf-lib)
    db/                Prisma client singleton
    container.ts       Composition root — the only file that wires concrete adapters
                       into use cases. Everything else depends on interfaces.

  app/                 Next.js App Router — UI layer only. Talks to use cases via
                       the composition root inside API routes; never touches
                       Prisma, JSON files, or scoring logic directly.
    page.tsx                    Landing page
    assessment/page.tsx          One-question-at-a-time assessment
    results/page.tsx             Results + lead capture + report download
    api/questions/route.ts       GET question set
    api/assessments/route.ts     POST submit + score an assessment
    api/assessments/[id]/route.ts GET a saved assessment result
    api/leads/route.ts           POST capture a lead
    api/report/route.ts          GET generate + stream the PDF report

  components/          Presentational React components, grouped by page/domain area.
  lib/                 Cross-cutting UI helpers (cn() utility, localStorage hook).

prisma/schema.prisma   AssessmentResult + Lead tables.
docker-compose.yml     Postgres + the app, for one-command local spin-up.
```

Swapping an adapter — e.g. moving questions from JSON to a CMS, or scoring from
this engine to a different rules engine — means writing a new class that
implements the existing port and changing one line in `container.ts`. Nothing
in `app/` or `components/` needs to change.

## Getting started

### Prerequisites

- Node.js 20+
- Docker and Docker Compose (for Postgres, or the whole stack)

### Option A — run everything in Docker

```bash
docker compose up --build
```

This starts Postgres and the app together, and runs `prisma migrate deploy`
automatically before the app boots. Visit http://localhost:3000.

### Option B — local dev with Docker only for Postgres

```bash
cp .env.example .env
docker compose up -d db
npm install
npx prisma migrate dev --name init
npm run dev
```

Visit http://localhost:3000.

### Useful scripts

- `npm run dev` — start the Next.js dev server
- `npm run build` / `npm run start` — production build and run
- `npm run prisma:studio` — browse the database with Prisma Studio
- `npm run prisma:migrate` — create/apply a new migration in development
- `npm run prisma:deploy` — apply existing migrations (used in Docker/production)

## Editing questions and scoring rules

Per the Sprint 1 requirement, no business logic is hardcoded into UI
components. Both the question set and the scoring rules are configuration:

- `src/infrastructure/config/questions.json` — categories and questions
  (currently 5 categories × 3 questions, placeholder copy, single-select
  1–5 scale). Add, remove, or reorder questions here; the assessment UI,
  API, and scoring engine all read from this file via `QuestionRepository`.
- `src/infrastructure/config/scoring-rules.json` — category weights, the
  narrative copy behind "Biggest Opportunity"/"Biggest Constraint"/Top
  Priorities recommendations, and confidence-level thresholds. Read via
  `ScoringConfigRepository`.

Changing either file requires no code changes elsewhere.

## Assumptions made in Sprint 1

Since this sprint is explicitly for placeholder content and validation, the
following judgment calls were made where the spec was silent or ambiguous.
They're implemented so they're easy to revisit:

1. **Questions**: 5 categories × 3 placeholder questions each (15 total),
   single-select on a 1–5 agreement scale. Easy to expand via `questions.json`.
2. **Scoring model**: each category score is the mean of its answered
   questions, normalized to 0–100. The overall Business Minded Score is a
   weighted average of category scores (weights in `scoring-rules.json`,
   currently equal at 20% each).
3. **Biggest Constraint vs. Biggest Opportunity**: the lowest-scoring
   category is presented as the "Biggest Constraint" (the weakest link);
   the next-lowest is the "Biggest Opportunity" (the category with the most
   upside once the constraint is addressed). Copy for both is configured
   per-category in `scoring-rules.json`.
4. **Top Three Priorities**: the configured recommendation text for the
   three lowest-scoring categories (`topPriorityCount` in config).
5. **Confidence Level**: derived from how tightly clustered the five
   category scores are (standard deviation vs. configured thresholds), as
   a proxy for how clear a signal the assessment produced. This is a
   placeholder heuristic — worth revisiting with real user data.
6. **Lead Capture placement**: implemented as a step shown when either
   "Download Report" or "Email My Report" is clicked on the Results page,
   matching the flow diagram (Results → Email Capture → Download Report).
   Both buttons lead to the same First Name / Email / Company form.
7. **"Email My Report" delivery**: no email/SMTP provider is listed in the
   Sprint 1 tech stack. "Email My Report" captures the lead (stored in
   Postgres, same as "Download Report") and provides the same instant
   in-browser PDF download. Actual email delivery is flagged as a Sprint 2
   candidate pending a decision on an email provider.
8. **Report generation**: a single-page PDF built with `pdf-lib` (no
   headless browser/HTML-to-PDF dependency), matching the "professional
   layout" requirement with the required sections and footer.
9. **Retake Assessment**: clears local progress and returns to a fresh
   assessment; it does not delete previously saved results/leads.
10. **Auth/admin**: out of scope for Sprint 1. There is no login and no
    internal dashboard for viewing captured leads (query via
    `npm run prisma:studio` for now).

## Verification performed

- `npx tsc --noEmit` passes with zero errors.
- `npm run build` (Next.js production build) completes successfully —
  all pages and API routes compile and prerender correctly.
- Note: in the sandboxed environment used to build this project, `npx prisma
  generate` could not reach `binaries.prisma.sh` (network egress to that
  host is blocked in this environment). This is an environment restriction,
  not a code issue — the Prisma schema and repository code were reviewed
  by hand against `schema.prisma` for correctness, and `prisma generate`
  is expected to run normally on a developer machine, in CI, or inside the
  provided Docker build, all of which have standard internet access. Run
  `npx prisma generate` (or `npm install`, which triggers it automatically)
  as the first step in your own environment.

## Not in scope for Sprint 1 (do not build yet)

Per the sprint objective, this stops at a working, validated Sprint 1. Not
started: analytics/tracking, an admin dashboard for leads, real questions
and finalized scoring rubric, email delivery, authentication, and any
Sprint 2 feature.
