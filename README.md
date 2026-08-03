# Business Minded — Sprint 1

Mission: increase business value while reducing owner dependence.

Sprint 1 objective: ship the first customer-facing Business Health Check,
implementing the **locked Business Minded Framework v1**, hardened enough
for a public validation launch.

## Customer flow

Landing Page → Business Health Check (Assessment) → Results → Email Capture → Download Report

No account or login is required — the assessment is anonymous until the
respondent chooses to request a report.

## The Business Minded Framework v1 (locked)

The **Business Minded Score** is 0–100, built from five **equally weighted**
dimensions (20 points each):

| Dimension | Owner-facing framing |
|---|---|
| Money | Is your business creating the financial results you need? |
| Operations | Is your business executing consistently? |
| Growth | Is your business positioned to grow? |
| Freedom | Does your business give you the freedom you want? |
| Resilience | Will your business keep performing when life doesn't go according to plan? |

Freedom is part of the single Business Minded Score — there is no separate
Freedom or Owner Dependence score. This framework (the five category IDs and
their 20% weights) is enforced by `validateStartupConfig` — see
[Configuration safety](#configuration-safety-fail-loud-not-fallback) below.

## The assessment

10 questions total (2 per category), each written in plain, owner-facing
language and each material to the score and recommendations — no filler
questions. Every question has an "I'm not sure / skip this question" link,
so a respondent is never forced to guess; skipped questions simply reduce
that category's (and the overall assessment's) evidence, which is reflected
transparently in the Confidence badge rather than hidden.

## Confidence: evidence quality, not business quality

The Results page shows a **Confidence: High / Medium / Low** badge next to
the score. This reflects **how much of the assessment was answered**, not
how good or bad the business is, and not how similar the five category
scores happen to be.

Confidence = (number of unique questions answered) / (total questions in
the assessment), compared against the deterministic thresholds configured
in `scoring-rules.json`:

```json
"confidenceThresholds": [
  { "minCompleteness": 0.9, "level": "High" },
  { "minCompleteness": 0.6, "level": "Medium" },
  { "minCompleteness": 0,   "level": "Low" }
]
```

- **High** — 90%+ of questions answered (9–10 of 10).
- **Medium** — 60–89% answered (6–8 of 10) — enough for a useful directional
  result.
- **Low** — under 60% answered (0–5 of 10) — substantial missing evidence.

Both the Results page badge and the PDF report explicitly state that a lower
confidence level means less available evidence, not a worse business.

## Configuration safety (fail loud, not fallback)

No business logic — category weights, question copy, insight/recommendation
text, confidence thresholds — is hardcoded into UI components. It all lives
in two JSON files (`src/infrastructure/config/questions.json` and
`scoring-rules.json`), and both are validated **together** by
`validateStartupConfig` (`src/infrastructure/config/validateStartupConfig.ts`)
at two points:

1. **Build time** — `npm run validate:config`, wired as the `prebuild`
   script, so `npm run build` always validates first.
2. **Server startup** — an eager call in the composition root
   (`src/infrastructure/container.ts`), so a broken config can't silently
   serve wrong scores in any environment, including one where the build step
   was skipped.

The app fails with a single aggregated error (listing every problem, not
just the first) if:

- any of the five required categories (`money`/`operations`/`growth`/
  `freedom`/`resilience`) is missing, or an unexpected category is present;
- any category weight is missing, isn't exactly 0.2, or the weights don't
  sum to 1.0;
- a question references a category that doesn't exist;
- a required category has zero questions;
- any of a category's five required insight/recommendation fields is
  missing or empty;
- `confidenceThresholds` is missing a `minCompleteness: 0` catch-all, has an
  out-of-range `minCompleteness`, or has an invalid `level`.

There are no silent fallbacks (no substituting equal weights, zero weights,
or empty copy) anywhere in the scoring engine — a config that hasn't passed
validation is never trusted.

## Public-launch safeguards

The unauthenticated `assessment`, `leads`, `questions`, and `report`
endpoints (everything under `src/app/api/`) share the following protections:

- **Rate limiting** — in-memory, fixed-window, per-IP
  (`src/infrastructure/security/rateLimiter.ts`). Limits are per-route (e.g.
  10 lead submissions/minute, 20 assessment submissions/minute). Returns
  `429` with `Retry-After` when exceeded.
- **Payload size limits** — `src/infrastructure/security/requestGuards.ts`
  checks `Content-Length` and then the actual decoded byte length before
  parsing JSON, and rejects oversized bodies with `413`.
- **Honeypot bot defense on lead capture** — a hidden `website` field
  (invisible to real visitors, never `display: none` so basic bots can't
  detect and skip it). A filled value is treated as a bot: the request is
  quietly accepted (`201`) without saving anything, rather than returning an
  error that would invite retries.
- **Generic error responses** — API routes never return stack traces or
  internal error details to the client; messages are generic
  ("Unable to save your details. Please try again.").
- **Structured server-side logging** — `src/infrastructure/logging/logger.ts`
  logs structured JSON (`logError`/`logWarning`) for every failure and for
  honeypot triggers, so incidents are debuggable without exposing anything
  to the client.

**Known limitation**: the rate limiter is an in-memory `Map`, scoped to a
single server process. It resets on restart and does not coordinate across
multiple instances. This is an accepted tradeoff for a single-instance
public-validation launch — see "Remaining launch risks" below.

## Privacy and consent

- `/privacy` is a plain-language privacy notice, linked directly from the
  lead-capture form.
- The lead-capture form requires an explicit consent checkbox
  ("I agree to the privacy policy...") before it will submit; the API
  (`POST /api/leads`) re-validates this server-side.
- Every saved lead stores `consentTimestamp` (when consent was given) and
  `consentPolicyVersion` (which version of the `/privacy` copy was current
  at that time — see `src/domain/policies/PrivacyPolicy.ts`). Bump
  `CURRENT_PRIVACY_POLICY_VERSION` whenever the `/privacy` copy materially
  changes.

## Result exposure — no raw answers over the public API

`POST /api/assessments` and `GET /api/assessments/[id]` return only
presentation-safe result data (`src/application/dto/AssessmentResultView.ts`
— the saved result minus `rawAnswers`). Raw answers are still persisted in
Postgres for internal auditing/debugging, but are never sent to the browser.

## Tech stack

Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui-style
components, Prisma, PostgreSQL, Docker, Vitest, GitHub Actions.

## Architecture

Clean Architecture, with dependencies pointing inward. UI and Infrastructure
both depend on Application and Domain; Domain depends on nothing.

```
src/
  domain/            Entities, policies, and repository/port interfaces. No framework code, no I/O.
    entities/         Question, Answer, Score, Lead, AssessmentResult
    value-objects/    Insight
    policies/         RequiredCategories (the locked 5-category/20%-weight policy), PrivacyPolicy
    repositories/     Ports: QuestionRepository, ScoringConfigRepository, ScoringEngine,
                       AssessmentResultRepository, LeadRepository, ReportEngine

  application/        Use cases that orchestrate ports. No UI, no Prisma, no JSON parsing.
    use-cases/        GetQuestionSet, SubmitAssessment, CaptureLead, GenerateReport
    dto/              Zod schemas for API input validation, AssessmentResultView (public-safe result shape)

  infrastructure/      Adapters that implement the domain ports.
    config/           questions.json, scoring-rules.json (all business logic config lives here),
                       validateStartupConfig.ts (fails loud on invalid config)
    repositories/      JsonQuestionRepository, JsonScoringConfigRepository,
                       PrismaAssessmentResultRepository, PrismaLeadRepository
    scoring-engine/    ConfigurableScoringEngine (implements ScoringEngine)
    report-engine/     PdfReportEngine (implements ReportEngine, uses pdf-lib)
    security/          rateLimiter.ts, requestGuards.ts (public-launch abuse protection)
    logging/           logger.ts (structured server-side error/warning logs)
    db/                Prisma client singleton
    container.ts       Composition root — the only file that wires concrete adapters
                       into use cases, and eagerly validates config at startup.

  app/                 Next.js App Router — UI layer only. Talks to use cases via
                       the composition root inside API routes; never touches
                       Prisma, JSON files, or scoring logic directly.
    page.tsx                    Landing page
    assessment/page.tsx          One-question-at-a-time assessment, with skip support
    results/page.tsx             Results + lead capture + report download
    privacy/page.tsx             Privacy policy
    api/questions/route.ts       GET question set
    api/assessments/route.ts     POST submit + score an assessment (returns AssessmentResultView)
    api/assessments/[id]/route.ts GET a saved assessment result (returns AssessmentResultView)
    api/leads/route.ts           POST capture a lead (consent + honeypot enforced)
    api/report/route.ts          GET generate + stream the PDF report

  components/          Presentational React components, grouped by page/domain area.
  lib/                 Cross-cutting UI helpers (cn() utility, localStorage hook).

prisma/schema.prisma   AssessmentResult + Lead (incl. consent) tables.
docker-compose.yml     Postgres + the app, for one-command local spin-up.
.github/workflows/ci.yml   Lint, typecheck, tests, build on every PR/push to main.
```

Swapping an adapter — e.g. moving questions from JSON to a CMS, or scoring
from this engine to a different rules engine — means writing a new class
that implements the existing port and changing one line in `container.ts`.
Nothing in `app/` or `components/` needs to change.

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
- `npm run build` / `npm run start` — production build and run (build runs
  `validate:config` first, via `prebuild`)
- `npm run lint` — ESLint (`next/core-web-vitals`)
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — run the Vitest unit test suite once
- `npm run test:watch` — Vitest in watch mode
- `npm run validate:config` — validate `questions.json` + `scoring-rules.json`
  against the locked framework policy
- `npm run prisma:studio` — browse the database with Prisma Studio
- `npm run prisma:migrate` — create/apply a new migration in development
- `npm run prisma:deploy` — apply existing migrations (used in Docker/production)

## Testing and CI

Unit tests live alongside the code they test, in `__tests__` folders:

- `src/infrastructure/scoring-engine/__tests__/ConfigurableScoringEngine.test.ts`
  — the five equal category weights; deterministic overall-score
  normalization; category exclusion/weight re-normalization on
  incomplete/skipped answers; confidence derived from completeness (and
  unaffected by score spread); constraint/opportunity ranking; top
  priorities.
- `src/infrastructure/config/__tests__/validateStartupConfig.test.ts` —
  every invalid-configuration failure mode listed above, plus sanity checks
  that the real bundled `questions.json`/`scoring-rules.json` pass
  validation and match the locked framework (5 categories at 20% each,
  8–10 questions).

Run locally with `npm test`. `.github/workflows/ci.yml` runs
`validate:config`, `lint`, `typecheck`, `test`, and `build` on every pull
request and push to `main`.

## Editing questions and scoring rules

- `src/infrastructure/config/questions.json` — the 5 locked categories and
  10 questions (2 per category), owner-facing copy, single-select 1–5
  scale. The assessment UI, API, and scoring engine all read from this file
  via `QuestionRepository`. Category IDs are locked to `money`/`operations`/
  `growth`/`freedom`/`resilience` — see `validateStartupConfig`.
- `src/infrastructure/config/scoring-rules.json` — category weights
  (locked to 0.2 each), the narrative copy behind "Biggest
  Opportunity"/"Biggest Constraint"/Top Priorities recommendations, and the
  confidence-level completeness thresholds. Read via `ScoringConfigRepository`.

Changing question/insight copy requires no code changes elsewhere; changing
the category set or weights requires updating the locked policy in
`src/domain/policies/RequiredCategories.ts` first (a deliberate speed bump,
since the framework is meant to be locked).

## Assumptions made in this sprint

1. **Scoring model**: each category score is the mean of its answered
   questions, normalized to 0–100 from the configured 1–5 scale. The
   overall Business Minded Score is the weighted average of category
   scores (all five weights locked at exactly 20%). If a respondent skips
   an entire category, that category is excluded and the remaining
   categories' weights are re-normalized proportionally — this is normal
   handling of partial answers, not a configuration fallback.
2. **Biggest Constraint vs. Biggest Opportunity**: the lowest-scoring
   category is the "Biggest Constraint" (the weakest link); the
   next-lowest is the "Biggest Opportunity". Copy for both is configured
   per-category in `scoring-rules.json`.
3. **Top Three Priorities**: the configured recommendation text for the
   three lowest-scoring categories (`topPriorityCount` in config).
4. **Lead Capture placement**: shown as a step when either "Download
   Report" or "Email My Report" is clicked on the Results page, matching
   the flow diagram. Both buttons lead to the same First Name / Email /
   Company / consent form.
5. **"Email My Report" delivery**: no email/SMTP provider is in scope for
   this sprint. "Email My Report" captures the lead and consent (stored in
   Postgres, same as "Download Report") and provides the same instant
   in-browser PDF download. Actual email delivery remains a future-sprint
   candidate pending a decision on an email provider.
6. **Report generation**: a single-page PDF built with `pdf-lib` (no
   headless browser/HTML-to-PDF dependency), stating both the score and the
   evidence-completeness meaning of the confidence level.
7. **Retake Assessment**: clears local progress and returns to a fresh
   assessment; it does not delete previously saved results/leads.
8. **Auth/admin**: out of scope. There is no login and no internal
   dashboard for viewing captured leads (query via `npm run prisma:studio`
   for now). The public assessment flow remains fully anonymous until a
   report is requested.
9. **Privacy policy copy**: the `/privacy` page is Sprint-1 plain-language
   copy, not yet reviewed by counsel — flagged for review before a
   general-availability launch.

## Verification performed

- `npm run validate:config`, `npm run lint`, `npm run typecheck`, `npm test`
  (28 tests), and `npm run build` all pass.
- `npm run build` was verified to produce all expected routes, including
  the new `/privacy` page and all five API routes.
- Note: in the sandboxed environment used to build this project, `npx prisma
  generate` could not reach `binaries.prisma.sh` (network egress to that
  host is blocked in this environment). This is an environment restriction,
  not a code issue — the Prisma schema and repository code were reviewed by
  hand against `schema.prisma` for correctness, and the rest of the
  verification (lint/typecheck/test/build) ran against a locally stubbed
  Prisma client so the rest of the app's correctness could still be
  confirmed. `prisma generate` is expected to run normally on a developer
  machine, in CI, or inside the provided Docker build, all of which have
  standard internet access. Run `npx prisma generate` (or `npm install`,
  which triggers it automatically) as the first step in your own
  environment.

## Remaining launch risks

- **Rate limiting is process-local**, not shared across instances or
  processes, and resets on restart. Fine for a single-instance public
  validation launch; if traffic justifies horizontal scaling, swap
  `src/infrastructure/security/rateLimiter.ts`'s in-memory `Map` for a
  shared store (e.g. Redis/Upstash) — it's the only file that needs to
  change.
- **No CAPTCHA/managed bot-protection service** — the honeypot field is a
  basic, low-friction deterrent appropriate for a validation launch, but a
  sufficiently sophisticated bot can still fill every field. Consider a
  managed service (e.g. Turnstile/hCaptcha) if abuse is observed.
- **`/privacy` copy is not counsel-reviewed** — placeholder language
  appropriate for validation, not a compliance-ready policy.
- **Email delivery is not implemented** — "Email My Report" currently only
  downloads in-browser; it does not send an email.
- **No admin/lead-management UI** — leads and results are queried directly
  via Prisma Studio or SQL for now.

## Not in scope

Per the sprint objective, this stops at a working, validated, hardened
Sprint 1. Not started: analytics/tracking, an admin dashboard for leads,
authentication/accounts, third-party integrations, and any feature beyond
this hardening request.
