import { describe, expect, it } from "vitest";
import { GenerateReport } from "@/application/use-cases/GenerateReport";
import { AssessmentResultRepository } from "@/domain/repositories/AssessmentResultRepository";
import { ReportEngine } from "@/domain/repositories/ReportEngine";
import { SavedAssessmentResult } from "@/domain/entities/AssessmentResult";
import { SavedLead } from "@/domain/entities/Lead";

function fakeSavedAssessmentResult(): SavedAssessmentResult {
  return {
    id: "assessment-1",
    overallScore: 70,
    categoryScores: [],
    biggestOpportunity: { categoryId: "money", categoryName: "Money", headline: "h", description: "d" },
    biggestConstraint: { categoryId: "money", categoryName: "Money", headline: "h", description: "d" },
    topPriorities: [],
    confidenceLevel: "High",
    rawAnswers: {},
    createdAt: new Date("2026-01-01"),
  };
}

function fakeSavedLead(): SavedLead {
  return {
    id: "lead-1",
    firstName: "Dave",
    email: "dave@example.com",
    assessmentResultId: "assessment-1",
    consentTimestamp: new Date("2026-01-01"),
    consentPolicyVersion: "2026-08-02.v1",
    createdAt: new Date("2026-01-01"),
  };
}

function buildFakeAssessmentResultRepository(
  existing: SavedAssessmentResult | null
): AssessmentResultRepository {
  return {
    save: async () => {
      throw new Error("not used in this test");
    },
    findById: async () => existing,
  };
}

function buildSpyingReportEngine(): ReportEngine & { lastLead: SavedLead | undefined; callCount: number } {
  const state: { lastLead: SavedLead | undefined; callCount: number } = {
    lastLead: undefined,
    callCount: 0,
  };
  return {
    get lastLead() {
      return state.lastLead;
    },
    get callCount() {
      return state.callCount;
    },
    async generate(_result, lead) {
      state.callCount += 1;
      state.lastLead = lead;
      return Buffer.from("pdf-bytes");
    },
  };
}

describe("GenerateReport", () => {
  it("renders a report buffer when the assessment result exists", async () => {
    const assessmentResultRepository = buildFakeAssessmentResultRepository(fakeSavedAssessmentResult());
    const reportEngine = buildSpyingReportEngine();
    const useCase = new GenerateReport(assessmentResultRepository, reportEngine);

    const buffer = await useCase.execute("assessment-1");

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(reportEngine.callCount).toBe(1);
  });

  it("passes the optional lead through to the report engine when provided", async () => {
    const assessmentResultRepository = buildFakeAssessmentResultRepository(fakeSavedAssessmentResult());
    const reportEngine = buildSpyingReportEngine();
    const useCase = new GenerateReport(assessmentResultRepository, reportEngine);
    const lead = fakeSavedLead();

    await useCase.execute("assessment-1", lead);

    expect(reportEngine.lastLead).toEqual(lead);
  });

  it("generates without a lead when none is provided", async () => {
    const assessmentResultRepository = buildFakeAssessmentResultRepository(fakeSavedAssessmentResult());
    const reportEngine = buildSpyingReportEngine();
    const useCase = new GenerateReport(assessmentResultRepository, reportEngine);

    await useCase.execute("assessment-1");

    expect(reportEngine.lastLead).toBeUndefined();
  });

  it("rejects when the assessment result does not exist and never calls the report engine", async () => {
    const assessmentResultRepository = buildFakeAssessmentResultRepository(null);
    const reportEngine = buildSpyingReportEngine();
    const useCase = new GenerateReport(assessmentResultRepository, reportEngine);

    await expect(useCase.execute("does-not-exist")).rejects.toThrow(/No assessment result found/);
    expect(reportEngine.callCount).toBe(0);
  });
});
