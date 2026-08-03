import { NextResponse } from "next/server";
import { container } from "@/infrastructure/container";

export async function GET() {
  const questionSet = await container.getQuestionSet().execute();
  return NextResponse.json(questionSet);
}
