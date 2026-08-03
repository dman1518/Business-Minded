import { NextRequest, NextResponse } from "next/server";
import { container } from "@/infrastructure/container";
import { SubmitAssessmentSchema } from "@/application/dto/SubmitAssessmentDto";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = SubmitAssessmentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid submission", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await container.submitAssessment().execute(parsed.data.answers);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Failed to submit assessment", error);
    return NextResponse.json(
      { error: "Unable to score assessment. Please try again." },
      { status: 500 }
    );
  }
}
