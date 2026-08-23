import { describe, expect, it } from "vitest";
import { selectVisibleInsights } from "@/domain/policies/VisibleInsights";
import { ResultRoles } from "@/domain/entities/Score";
import { Insight } from "@/domain/value-objects/Insight";

function insight(categoryName: string): Insight {
  return {
    categoryId: categoryName.toLowerCase(),
    categoryName,
    headline: `${categoryName} headline`,
    description: `${categoryName} description`,
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

describe("selectVisibleInsights — omits empty role placeholders", () => {
  it("REQUIRED: a one-dimension sparse result (only constraint filled) returns exactly one entry, not three", () => {
    const entries = selectVisibleInsights(
      roles({ constraint: insight("Resilience"), strength: null, opportunity: null })
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].role).toBe("constraint");
    expect(entries[0].insight.categoryName).toBe("Resilience");
  });

  it("a one-dimension sparse result where the sole role is 'strength' still returns exactly one entry", () => {
    const entries = selectVisibleInsights(
      roles({ strength: insight("Money"), constraint: null, opportunity: null })
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].role).toBe("strength");
  });

  it("two eligible dimensions (strength + constraint, no opportunity) returns exactly two entries, omitting opportunity", () => {
    const entries = selectVisibleInsights(
      roles({ strength: insight("Money"), constraint: insight("Operations"), opportunity: null })
    );

    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.role)).toEqual(["strength", "constraint"]);
  });

  it("a full result with all three roles filled returns all three, in strength/constraint/opportunity order", () => {
    const entries = selectVisibleInsights(
      roles({
        strength: insight("Money"),
        constraint: insight("Operations"),
        opportunity: insight("Growth"),
      })
    );

    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.role)).toEqual(["strength", "constraint", "opportunity"]);
  });

  it("a tied result (all roles null) returns zero entries", () => {
    const entries = selectVisibleInsights(roles({ tieState: "all-low-tied" }));

    expect(entries).toHaveLength(0);
  });

  it("REQUIRED INVARIANT: no entry in the returned list ever has a null insight", () => {
    const entries = selectVisibleInsights(
      roles({ strength: insight("Money"), constraint: null, opportunity: insight("Growth") })
    );

    for (const entry of entries) {
      expect(entry.insight).not.toBeNull();
    }
    expect(entries.map((e) => e.role)).toEqual(["strength", "opportunity"]);
  });

  it("assigns the correct tone to each role regardless of which roles are present", () => {
    const entries = selectVisibleInsights(
      roles({ constraint: insight("Operations"), opportunity: insight("Growth") })
    );

    const byRole = Object.fromEntries(entries.map((e) => [e.role, e.tone]));
    expect(byRole.constraint).toBe("negative");
    expect(byRole.opportunity).toBe("positive");
  });
});
