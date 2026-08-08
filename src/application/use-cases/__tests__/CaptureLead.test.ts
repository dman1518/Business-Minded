import { describe, expect, it } from "vitest";
import { CaptureLead } from "@/application/use-cases/CaptureLead";
import { LeadRepository } from "@/domain/repositories/LeadRepository";
import { AssessmentResultRepository } from "@/domain/repositories/AssessmentResultRepository";
import { Lead, SavedLead } from "@/domain/entities/Lead";
import { SavedAssessmentResult } from "@/domain/entities/AssessmentResult";
import { AssessmentScoreResult } from "@/domain/entities/Score";

function fakeAssessmentScoreResult(): AssessmentScoreResult {
  return {
    overallScore: 70,
    categoryScores: [],
    biggestOpportunity: { categoryId: "money", categoryName: "Money", headline: "h", description: "d" },
    biggestConstraint: { categoryId: "money", categoryName: "Money", headline: "h", description: "d" },
    topPriorities: [],
    confidenceLevel: "High",
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

function buildSpyingLeadRepository(): LeadRepository & { saveCallCount: number; lastLead?: Lead } {
  const state: { saveCallCount: number; lastLead?: Lead } = { saveCallCount: 0 };
  return {
    get saveCallCount() {
      return state.saveCallCount;
    },
    get lastLead() {
      return state.lastLead;
    },
    async save(lead: Lead): Promise<SavedLead> {
      state.saveCallCount += 1;
      state.lastLead = lead;
      return { ...lead, id: "lead-1", createdAt: new Date("2026-01-01") };
    },
  };
}

function buildLead(overrides: Partial<Lead> = {}): Lead {
  return {
    firstName: "Dave",
    email: "dave@example.com",
    assessmentResultId: "assessment-1",
    consentTimestamp: new Date("2026-01-01"),
    consentPolicyVersion: "2026-08-02.v1",
    ...overrides,
  };
}

describe("CaptureLead", () => {
  it("saves the lead when the referenced assessment result exists", async () => {
    const assessmentResultRepository = buildFakeAssessmentResultRepository({
      ...fakeAssessmentScoreResult(),
      id: "assessment-1",
      rawAnswers: {},
      createdAt: new Date("2026-01-01"),
    });
    const leadRepository = buildSpyingLeadRepository();
    const useCase = new CaptureLead(leadRepository, assessmentResultRepository);

    const saved = await useCase.execute(buildLead());

    expect(saved.id).toBe("lead-1");
    expect(leadRepository.saveCallCount).toBe(1);
  });

  it("rejects a lead referencing a non-existent assessment result and never saves it", async () => {
    const assessmentResultRepository = buildFakeAssessmentResultRepository(null);
    const leadRepository = buildSpyingLeadRepository();
    const useCase = new CaptureLead(leadRepository, assessmentResultRepository);

    await expect(useCase.execute(buildLead({ assessmentResultId: "does-not-exist" }))).rejects.toThrow(
      /No assessment result found/
    );
    expect(leadRepository.saveCallCount).toBe(0);
  });
});
