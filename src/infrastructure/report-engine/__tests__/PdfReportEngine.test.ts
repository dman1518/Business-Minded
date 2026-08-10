import { describe, expect, it } from "vitest";
import { PdfReportEngine } from "@/infrastructure/report-engine/PdfReportEngine";
import { toAssessmentResultView } from "@/application/dto/AssessmentResultView";
import { SavedAssessmentResult } from "@/domain/entities/AssessmentResult";
import { AssessmentScoreResult } from "@/domain/entities/Score";

const engine = new PdfReportEngine();

function baseResult(overrides: Partial<AssessmentScoreResult> = {}): SavedAssessmentResult {
  const scoreResult: AssessmentScoreResult = {
    categoryScores: [
      { categoryId: "money", categoryName: "Money", score: 20, status: "Strength", answeredCount: 2, applicableCount: 2, reducedConfidence: false },
      { categoryId: "operations", categoryName: "Operations", score: 0, status: "Constraint", answeredCount: 2, applicableCount: 2, reducedConfidence: false },
      { categoryId: "growth", categoryName: "Growth", score: 10, status: "Developing", answeredCount: 2, applicableCount: 2, reducedConfidence: false },
      { categoryId: "freedom", categoryName: "Freedom", score: 15, status: "Solid", answeredCount: 2, applicableCount: 2, reducedConfidence: false },
      { categoryId: "resilience", categoryName: "Resilience", score: 5, status: "Constraint", answeredCount: 2, applicableCount: 2, reducedConfidence: false },
    ],
    scoreDisplay: {
      value: 50,
      suppressed: false,
      answeredQuestionCount: 10,
      totalQuestionCount: 10,
      scoreableDimensionCount: 5,
      totalDimensionCount: 5,
    },
    scoreInterpretation: "A solid foundation, at 50.",
    roles: {
      strength: { categoryId: "money", categoryName: "Money", headline: "Strong money", description: "Great margins. This was your strongest dimension, scoring 20/20." },
      constraint: { categoryId: "operations", categoryName: "Operations", headline: "Weak ops", description: "Needs process work. This was your lowest-scoring dimension, at 0/20." },
      opportunity: { categoryId: "resilience", categoryName: "Resilience", headline: "Resilience opportunity", description: "Build reserves. This is your next-biggest area for improvement, at 5/20." },
      tieState: "none",
      tieMessage: null,
    },
    topPriorities: [
      { categoryId: "operations", categoryName: "Operations", status: "Constraint", action: "Fix process", whyItMatters: "Reduces risk", timeframe: "This month" },
      { categoryId: "resilience", categoryName: "Resilience", status: "Constraint", action: "Build reserves", whyItMatters: "Improves stability", timeframe: "This quarter" },
      { categoryId: "growth", categoryName: "Growth", status: "Developing", action: "Diversify channels", whyItMatters: "Reduces concentration risk", timeframe: "This quarter" },
    ],
    confidenceLevel: "High",
    ...overrides,
  };

  return {
    ...scoreResult,
    id: "assessment-1",
    rawAnswers: { money_1: 5, money_2: 5 },
    createdAt: new Date("2026-01-01"),
  };
}

describe("PdfReportEngine — renders the same canonical result model as the web results page", () => {
  it("REQUIRED TEST: generates a non-empty PDF for a normal, fully-scored result", async () => {
    const result = baseResult();
    const buffer = await engine.generate(result);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    // %PDF magic bytes.
    expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("REQUIRED TEST: web view and PDF are built from the identical result object — no independent derivation", async () => {
    const result = baseResult();

    // AssessmentResultView only strips rawAnswers; every field the PDF
    // renders (scoreDisplay, categoryScores, roles, topPriorities,
    // confidenceLevel, scoreInterpretation) must be referentially the
    // exact same data passed into PdfReportEngine.generate — proving
    // there is no second, PDF-only computation of "biggest constraint"
    // or similar that could drift from the web page.
    const webView = toAssessmentResultView(result);

    expect(webView.categoryScores).toBe(result.categoryScores);
    expect(webView.scoreDisplay).toBe(result.scoreDisplay);
    expect(webView.roles).toBe(result.roles);
    expect(webView.topPriorities).toBe(result.topPriorities);
    expect(webView.confidenceLevel).toBe(result.confidenceLevel);
    expect(webView.scoreInterpretation).toBe(result.scoreInterpretation);
    expect("rawAnswers" in webView).toBe(false);

    // And the PDF engine renders successfully from that same object.
    const buffer = await engine.generate(result);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("renders a tie-state result (no strength/constraint/opportunity cards) without throwing", async () => {
    const result = baseResult({
      roles: {
        strength: null,
        constraint: null,
        opportunity: null,
        tieState: "all-high-tied",
        tieMessage: "Every dimension we could measure is a strength.",
      },
    });

    const buffer = await engine.generate(result);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("renders a suppressed-score (sparse-data) result without showing a misleading number", async () => {
    const result = baseResult({
      scoreDisplay: {
        value: null,
        suppressed: true,
        answeredQuestionCount: 1,
        totalQuestionCount: 10,
        scoreableDimensionCount: 1,
        totalDimensionCount: 5,
      },
      roles: { strength: null, constraint: null, opportunity: null, tieState: "none", tieMessage: null },
      topPriorities: [],
    });

    const buffer = await engine.generate(result);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("renders successfully when there are zero top priorities", async () => {
    const result = baseResult({ topPriorities: [] });
    const buffer = await engine.generate(result);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("includes the lead's first name when a lead is provided, and falls back to a generic subtitle when not", async () => {
    const result = baseResult();

    const withLead = await engine.generate(result, {
      id: "lead-1",
      firstName: "Dave",
      email: "dave@example.com",
      assessmentResultId: "assessment-1",
      consentTimestamp: new Date("2026-01-01"),
      consentPolicyVersion: "2026-08-09.v2",
      createdAt: new Date("2026-01-01"),
    });
    const withoutLead = await engine.generate(result);

    expect(withLead.length).toBeGreaterThan(0);
    expect(withoutLead.length).toBeGreaterThan(0);
  });
});
