import { describe, expect, it } from "vitest";
import { buildScoreInterpretation } from "@/domain/scoring/buildScoreInterpretation";
import { ResultRoles, ScoreDisplay } from "@/domain/entities/Score";
import { buildValidScoringConfig } from "@/infrastructure/scoring-engine/__tests__/fixtures";
import { Insight } from "@/domain/value-objects/Insight";

const config = buildValidScoringConfig();

function scoreDisplay(overrides: Partial<ScoreDisplay> = {}): ScoreDisplay {
  return {
    value: 50,
    suppressed: false,
    answeredQuestionCount: 10,
    totalQuestionCount: 10,
    scoreableDimensionCount: 5,
    totalDimensionCount: 5,
    ...overrides,
  };
}

function roles(overrides: Partial<ResultRoles> = {}): ResultRoles {
  return {
    strength: null,
    constraint: null,
    opportunity: null,
    tieState: "none",
    tieMessage: null,
    ...overrides,
  };
}

function insight(categoryName: string): Insight {
  return {
    categoryId: categoryName.toLowerCase(),
    categoryName,
    headline: `${categoryName} headline`,
    description: `${categoryName} description`,
  };
}

describe("buildScoreInterpretation — canonical result-state matrix", () => {
  it("REQUIRED STATE: balanced foundational-risk tie (all-low-tied) never claims a single constraint below", () => {
    const text = buildScoreInterpretation(
      scoreDisplay({ value: 0 }),
      roles({ tieState: "all-low-tied", tieMessage: "irrelevant to this function's output" }),
      "High",
      config
    );

    expect(text).not.toMatch(/single (biggest )?constraint/i);
    expect(text).toMatch(/broad exposure/i);
  });

  it("REQUIRED STATE: balanced developing tie reads distinctly from a balanced solid tie", () => {
    const developingText = buildScoreInterpretation(
      scoreDisplay({ value: 50 }),
      roles({ tieState: "developing-tied" }),
      "High",
      config
    );
    const solidText = buildScoreInterpretation(
      scoreDisplay({ value: 75 }),
      roles({ tieState: "solid-tied" }),
      "High",
      config
    );

    expect(developingText).toMatch(/developing level/i);
    expect(solidText).toMatch(/solid level/i);
    expect(developingText).not.toBe(solidText);
  });

  it("REQUIRED STATE: balanced strength tie (all-high-tied) never claims a dimension with room to grow", () => {
    const text = buildScoreInterpretation(
      scoreDisplay({ value: 100 }),
      roles({ tieState: "all-high-tied" }),
      "High",
      config
    );

    expect(text).not.toMatch(/single dimension with the most room to grow/i);
    expect(text).not.toMatch(/constraint/i);
    expect(text).toMatch(/consistently strong profile/i);
  });

  it("REQUIRED STATE: unique constraint (with an opportunity) references the constraint below", () => {
    const text = buildScoreInterpretation(
      scoreDisplay({ value: 45 }),
      roles({ tieState: "none", constraint: insight("Operations"), opportunity: insight("Growth") }),
      "High",
      config
    );

    expect(text).toMatch(/constraint identified below/i);
  });

  it("REQUIRED STATE: unique opportunity without a qualifying constraint never invents a constraint", () => {
    const text = buildScoreInterpretation(
      scoreDisplay({ value: 70 }),
      roles({ tieState: "none", constraint: null, opportunity: insight("Growth"), strength: insight("Money") }),
      "High",
      config
    );

    expect(text).not.toMatch(/constraint identified below/i);
    expect(text).toMatch(/opportunity identified below/i);
  });

  it("REQUIRED STATE: a unique strength with no constraint or opportunity never fabricates either", () => {
    const text = buildScoreInterpretation(
      scoreDisplay({ value: 72 }),
      roles({ tieState: "none", strength: insight("Money"), constraint: null, opportunity: null }),
      "High",
      config
    );

    expect(text).not.toMatch(/constraint identified below/i);
    expect(text).not.toMatch(/opportunity identified below/i);
    expect(text).toMatch(/Money/);
    expect(text).toMatch(/strongest measured area/i);
  });

  it("REQUIRED STATE: insufficient score data (suppressed headline) never cites a numeric score or a specific dimension", () => {
    const text = buildScoreInterpretation(
      scoreDisplay({ value: null, suppressed: true, answeredQuestionCount: 1, scoreableDimensionCount: 1 }),
      roles({ tieState: "none", constraint: insight("Resilience") }),
      "Low",
      config
    );

    expect(text).toMatch(/don't have enough answers/i);
    expect(text).not.toMatch(/Resilience/);
    expect(text).not.toMatch(/\d+\/100/);
  });

  it("REQUIRED STATE: sparse or low-confidence result (score shown, confidence not High) appends a hedge without contradicting the structure", () => {
    const text = buildScoreInterpretation(
      scoreDisplay({ value: 60 }),
      roles({ tieState: "none", constraint: insight("Operations"), opportunity: insight("Growth") }),
      "Medium",
      config
    );

    expect(text).toMatch(/partial set of answers/i);
    expect(text).toMatch(/constraint identified below/i);
  });

  it("a fully-confident result never includes the low-confidence hedge", () => {
    const text = buildScoreInterpretation(
      scoreDisplay({ value: 60 }),
      roles({ tieState: "none", constraint: insight("Operations"), opportunity: insight("Growth") }),
      "High",
      config
    );

    expect(text).not.toMatch(/partial set of answers/i);
  });

  it("does not special-case exactly 0 or 100 — every score bucket composes the same way with the structural clause", () => {
    // Every bucket boundary (0, 20, 40, 60, 80, 100) must correctly
    // compose with a tie state, proving the tie/role logic isn't
    // secretly gated on the raw score value.
    for (const value of [0, 20, 40, 60, 80, 100]) {
      const text = buildScoreInterpretation(
        scoreDisplay({ value }),
        roles({ tieState: "all-high-tied" }),
        "High",
        config
      );
      expect(text).toMatch(/consistently strong profile/i);
      expect(text).not.toMatch(/single (biggest )?constraint/i);
    }
  });
});

describe("buildScoreInterpretation — REQUIRED INVARIANT: never contradicts the structured result", () => {
  it("never claims a unique constraint when no unique constraint was selected (any tie state)", () => {
    const tieStates: Array<ResultRoles["tieState"]> = [
      "all-low-tied",
      "developing-tied",
      "solid-tied",
      "all-high-tied",
    ];
    for (const tieState of tieStates) {
      const text = buildScoreInterpretation(scoreDisplay(), roles({ tieState }), "High", config);
      expect(text).not.toMatch(/the constraint identified below/i);
      expect(text).not.toMatch(/single (biggest )?constraint/i);
    }
  });

  it("never claims a unique opportunity when no unique opportunity was selected", () => {
    const text = buildScoreInterpretation(
      scoreDisplay(),
      roles({ tieState: "none", constraint: insight("Operations"), opportunity: null }),
      "High",
      config
    );
    expect(text).not.toMatch(/opportunity identified below/i);
  });

  it("never claims a weakness in a balanced-strength (all-high-tied) result", () => {
    const text = buildScoreInterpretation(scoreDisplay({ value: 100 }), roles({ tieState: "all-high-tied" }), "High", config);
    // "rather than correcting a specific weakness" (negating that
    // there IS one) is fine and matches the product's own suggested
    // copy — what must never appear is an affirmative claim that a
    // constraint/weak spot/risk exists.
    expect(text).not.toMatch(/\bconstraint identified below\b/i);
    expect(text).not.toMatch(/\bweak spot\b/i);
    expect(text).not.toMatch(/carrying real risk\b/i);
  });

  it("never claims a strength in a balanced-constraint (all-low-tied) result", () => {
    const text = buildScoreInterpretation(scoreDisplay({ value: 0 }), roles({ tieState: "all-low-tied" }), "High", config);
    // "strengthening the foundation" (a forward-looking action) is
    // fine — what must never appear is a claim that a strength or
    // strong profile currently exists, which is why these use word
    // boundaries rather than a bare substring match.
    expect(text).not.toMatch(/\bstrength\b/i);
    expect(text).not.toMatch(/\bstrong\b/i);
    expect(text).not.toMatch(/working well/i);
  });
});
