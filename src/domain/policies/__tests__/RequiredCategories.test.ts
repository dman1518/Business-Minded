import { describe, expect, it } from "vitest";
import {
  REQUIRED_CATEGORY_IDS,
  REQUIRED_CATEGORY_WEIGHT,
  isRequiredCategoryId,
} from "@/domain/policies/RequiredCategories";

describe("RequiredCategories", () => {
  it("locks the framework to exactly the five required categories", () => {
    expect(REQUIRED_CATEGORY_IDS).toEqual(["money", "operations", "growth", "freedom", "resilience"]);
    expect(REQUIRED_CATEGORY_IDS).toHaveLength(5);
  });

  it("weights every required category equally at 20%", () => {
    expect(REQUIRED_CATEGORY_WEIGHT).toBe(0.2);
    expect(REQUIRED_CATEGORY_IDS.length * REQUIRED_CATEGORY_WEIGHT).toBe(1);
  });

  it("isRequiredCategoryId recognizes every locked category id", () => {
    for (const id of REQUIRED_CATEGORY_IDS) {
      expect(isRequiredCategoryId(id)).toBe(true);
    }
  });

  it("isRequiredCategoryId rejects ids outside the locked framework", () => {
    expect(isRequiredCategoryId("freedom_extra")).toBe(false);
    expect(isRequiredCategoryId("")).toBe(false);
    expect(isRequiredCategoryId("marketing")).toBe(false);
  });
});
