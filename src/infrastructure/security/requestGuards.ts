import { NextRequest } from "next/server";

export type JsonBodyResult =
  | { ok: true; data: unknown }
  | { ok: false; reason: "too_large" | "invalid_json" };

/**
 * Reads and parses a JSON request body while enforcing a byte-size
 * cap, so a public unauthenticated endpoint can't be trivially abused
 * with oversized payloads. Checks the `Content-Length` header first
 * (cheap, fails fast) and then re-checks the actual body size, since
 * `Content-Length` can be absent or spoofed.
 */
export async function readJsonBodyWithLimit(
  request: NextRequest,
  maxBytes: number
): Promise<JsonBodyResult> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > maxBytes) {
    return { ok: false, reason: "too_large" };
  }

  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    return { ok: false, reason: "too_large" };
  }

  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}
