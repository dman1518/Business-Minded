import { describe, expect, it } from "vitest";
import { CaptureLeadSchema } from "@/application/dto/CaptureLeadDto";

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Dave",
    email: "dave@example.com",
    assessmentResultId: "abc123",
    reportConsent: true,
    ...overrides,
  };
}

describe("CaptureLeadSchema", () => {
  it("accepts a minimal valid payload with only the required fields", () => {
    const result = CaptureLeadSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.company).toBeUndefined();
      expect(result.data.website).toBeUndefined();
      expect(result.data.marketingConsent).toBe(false);
    }
  });

  it("requires firstName", () => {
    const result = CaptureLeadSchema.safeParse(validPayload({ firstName: "" }));
    expect(result.success).toBe(false);
  });

  it("requires a valid email", () => {
    const result = CaptureLeadSchema.safeParse(validPayload({ email: "not-an-email" }));
    expect(result.success).toBe(false);
  });

  it("requires reportConsent to be exactly true", () => {
    const missing = CaptureLeadSchema.safeParse(validPayload({ reportConsent: false }));
    expect(missing.success).toBe(false);

    const omitted = { ...validPayload() };
    delete (omitted as Record<string, unknown>).reportConsent;
    const result = CaptureLeadSchema.safeParse(omitted);
    expect(result.success).toBe(false);
  });

  it("treats company and website as optional and independent of consent", () => {
    const result = CaptureLeadSchema.safeParse(
      validPayload({ company: "Acme Co", website: "acme.com" })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.company).toBe("Acme Co");
      expect(result.data.website).toBe("acme.com");
    }
  });

  it("normalizes blank optional strings to undefined instead of saving empty strings", () => {
    const result = CaptureLeadSchema.safeParse(validPayload({ company: "   ", website: "" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.company).toBeUndefined();
      expect(result.data.website).toBeUndefined();
    }
  });

  it("accepts marketingConsent as a separate, optional opt-in that does not require reportConsent to change", () => {
    const optedIn = CaptureLeadSchema.safeParse(validPayload({ marketingConsent: true }));
    expect(optedIn.success).toBe(true);
    if (optedIn.success) {
      expect(optedIn.data.marketingConsent).toBe(true);
      expect(optedIn.data.reportConsent).toBe(true);
    }

    const optedOutButStillValid = CaptureLeadSchema.safeParse(
      validPayload({ marketingConsent: false })
    );
    expect(optedOutButStillValid.success).toBe(true);
  });

  it("accepts the honeypot field being present but empty (real submissions)", () => {
    const result = CaptureLeadSchema.safeParse(validPayload({ hp: "" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hp).toBe("");
    }
  });

  it("still parses successfully when the honeypot field is filled in (rejection happens in the route, not the schema)", () => {
    const result = CaptureLeadSchema.safeParse(validPayload({ hp: "http://spam.example" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hp).toBe("http://spam.example");
    }
  });
});
