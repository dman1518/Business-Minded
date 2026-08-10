import { describe, expect, it } from "vitest";
import { CaptureLead } from "@/application/use-cases/CaptureLead";
import { LeadRepository } from "@/domain/repositories/LeadRepository";
import { AssessmentResultRepository } from "@/domain/repositories/AssessmentResultRepository";
import { Lead, SavedLead } from "@/domain/entities/Lead";
import { SavedAssessmentResult } from "@/domain/entities/AssessmentResult";
import { AssessmentScoreResult } from "@/domain/entities/Score";

function fakeAssessmentScoreResult(): AssessmentScoreResult {
  return {
    categoryScores: [],
    scoreDisplay: {
      value: 70,
      suppressed: false,
      answeredQuestionCount: 10,
      totalQuestionCount: 10,
      scoreableDimensionCount: 5,
      totalDimensionCount: 5,
    },
    scoreInterpretation: "Solid foundation.",
    roles: {
      strength: { categoryId: "money", categoryName: "Money", headline: "h", description: "d" },
      constraint: { categoryId: "operations", categoryName: "Operations", headline: "h", description: "d" },
      opportunity: { categoryId: "growth", categoryName: "Growth", headline: "h", description: "d" },
      tieState: "none",
      tieMessage: null,
    },
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
  const state: { saveCallCount: number; lastLead?: Lead; saved?: SavedLead } = { saveCallCount: 0 };
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
      state.saved = { ...lead, id: "lead-1", createdAt: new Date("2026-01-01") };
      return state.saved;
    },
    async findByAssessmentResultId(assessmentResultId: string): Promise<SavedLead | null> {
      return state.saved && state.saved.assessmentResultId === assessmentResultId ? state.saved : null;
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

  it("REQUIRED TEST: submitting a lead twice for the same assessment result is idempotent — no duplicate lead", async () => {
    // A repository fake that mirrors the real Prisma adapter's
    // idempotent-on-unique-constraint behavior: a second save() for an
    // assessmentResultId that already has a lead returns the EXISTING
    // lead rather than creating a second one.
    const bySavedAssessmentId = new Map<string, SavedLead>();
    let createCount = 0;
    const idempotentLeadRepository: LeadRepository = {
      async save(lead: Lead): Promise<SavedLead> {
        const existing = bySavedAssessmentId.get(lead.assessmentResultId);
        if (existing) return existing;
        createCount += 1;
        const saved: SavedLead = { ...lead, id: `lead-${createCount}`, createdAt: new Date("2026-01-01") };
        bySavedAssessmentId.set(lead.assessmentResultId, saved);
        return saved;
      },
      async findByAssessmentResultId(assessmentResultId: string): Promise<SavedLead | null> {
        return bySavedAssessmentId.get(assessmentResultId) ?? null;
      },
    };

    const assessmentResultRepository = buildFakeAssessmentResultRepository(fakeAssessmentScoreResultAsSaved());
    const useCase = new CaptureLead(idempotentLeadRepository, assessmentResultRepository);

    const first = await useCase.execute(buildLead());
    const second = await useCase.execute(buildLead({ email: "different-email@example.com" }));

    expect(createCount).toBe(1);
    expect(second.id).toBe(first.id);
    expect(second.email).toBe(first.email); // the original record wins, not the retry's payload
  });
});

function fakeAssessmentScoreResultAsSaved(): SavedAssessmentResult {
  return {
    ...fakeAssessmentScoreResult(),
    id: "assessment-1",
    rawAnswers: {},
    createdAt: new Date("2026-01-01"),
  };
}
