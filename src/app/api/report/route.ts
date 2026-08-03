import { NextRequest, NextResponse } from "next/server";
import { container } from "@/infrastructure/container";

export async function GET(request: NextRequest) {
  const assessmentResultId = request.nextUrl.searchParams.get("assessmentResultId");

  if (!assessmentResultId) {
    return NextResponse.json(
      { error: "assessmentResultId is required." },
      { status: 400 }
    );
  }

  try {
    const pdfBuffer = await container.generateReport().execute(assessmentResultId);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="business-minded-report.pdf"',
      },
    });
  } catch (error) {
    console.error("Failed to generate report", error);
    return NextResponse.json({ error: "Unable to generate report." }, { status: 404 });
  }
}
