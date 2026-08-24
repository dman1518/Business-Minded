import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isAdminAuthConfigured, isValidAdminSecret } from "@/infrastructure/security/adminAuth";

const ORIGINAL_SECRET = process.env.CLARITY_ADMIN_SHARED_SECRET;

describe("adminAuth", () => {
  afterEach(() => {
    process.env.CLARITY_ADMIN_SHARED_SECRET = ORIGINAL_SECRET;
  });

  describe("isAdminAuthConfigured", () => {
    it("is false when the env var is unset", () => {
      delete process.env.CLARITY_ADMIN_SHARED_SECRET;
      expect(isAdminAuthConfigured()).toBe(false);
    });

    it("is true once a secret is set", () => {
      process.env.CLARITY_ADMIN_SHARED_SECRET = "a-long-random-secret-value";
      expect(isAdminAuthConfigured()).toBe(true);
    });
  });

  describe("isValidAdminSecret", () => {
    beforeEach(() => {
      process.env.CLARITY_ADMIN_SHARED_SECRET = "correct-horse-battery-staple";
    });

    it("accepts the exact configured secret", () => {
      expect(isValidAdminSecret("correct-horse-battery-staple")).toBe(true);
    });

    it("REQUIRED TEST: rejects a wrong secret without throwing", () => {
      expect(isValidAdminSecret("wrong-guess")).toBe(false);
    });

    it("rejects a near-miss of different length without throwing (would otherwise crash timingSafeEqual)", () => {
      expect(isValidAdminSecret("correct-horse-battery-staple-extra")).toBe(false);
    });

    it("rejects null / missing input", () => {
      expect(isValidAdminSecret(null)).toBe(false);
    });

    it("rejects any input when no secret is configured, even an empty string", () => {
      delete process.env.CLARITY_ADMIN_SHARED_SECRET;
      expect(isValidAdminSecret("")).toBe(false);
      expect(isValidAdminSecret("anything")).toBe(false);
    });
  });
});
