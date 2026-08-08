import { describe, expect, it } from "vitest";
import { readJsonBodyWithLimit } from "@/infrastructure/security/requestGuards";
import { NextRequest } from "next/server";

function fakeRequest(body: string, headers: Record<string, string> = {}): NextRequest {
  return {
    headers: new Headers(headers),
    text: async () => body,
  } as unknown as NextRequest;
}

describe("readJsonBodyWithLimit", () => {
  it("parses a well-formed JSON body under the byte limit", async () => {
    const request = fakeRequest(JSON.stringify({ hello: "world" }));

    const result = await readJsonBodyWithLimit(request, 1_000);

    expect(result).toEqual({ ok: true, data: { hello: "world" } });
  });

  it("rejects as too_large based on a spoofed/declared Content-Length header alone", async () => {
    const request = fakeRequest("{}", { "content-length": "999999" });

    const result = await readJsonBodyWithLimit(request, 1_000);

    expect(result).toEqual({ ok: false, reason: "too_large" });
  });

  it("rejects as too_large based on actual body size even with no Content-Length header", async () => {
    const bigBody = JSON.stringify({ value: "x".repeat(2_000) });
    const request = fakeRequest(bigBody);

    const result = await readJsonBodyWithLimit(request, 1_000);

    expect(result).toEqual({ ok: false, reason: "too_large" });
  });

  it("rejects malformed JSON as invalid_json", async () => {
    const request = fakeRequest("{not valid json");

    const result = await readJsonBodyWithLimit(request, 1_000);

    expect(result).toEqual({ ok: false, reason: "invalid_json" });
  });
});
