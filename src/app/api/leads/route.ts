import { NextRequest, NextResponse } from "next/server";
import { container } from "@/infrastructure/container";
import { CaptureLeadSchema } from "@/application/dto/CaptureLeadDto";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = CaptureLeadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid lead details", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const lead = await container.captureLead().execute(parsed.data);
    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    console.error("Failed to capture lead", error);
    const message = error instanceof Error ? error.message : "Unable to save your details.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
