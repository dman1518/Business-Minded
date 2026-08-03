import { NextRequest, NextResponse } from "next/server";
import { container } from "@/infrastructure/container";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = await container.assessmentResultRepository.findById(params.id);

  if (!result) {
    return NextResponse.json({ error: "Assessment result not found." }, { status: 404 });
  }

  return NextResponse.json(result);
}
