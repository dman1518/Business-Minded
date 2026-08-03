import { JsonQuestionRepository } from "@/infrastructure/repositories/JsonQuestionRepository";
import { JsonScoringConfigRepository } from "@/infrastructure/repositories/JsonScoringConfigRepository";
import { PrismaAssessmentResultRepository } from "@/infrastructure/repositories/PrismaAssessmentResultRepository";
import { PrismaLeadRepository } from "@/infrastructure/repositories/PrismaLeadRepository";
import { ConfigurableScoringEngine } from "@/infrastructure/scoring-engine/ConfigurableScoringEngine";
import { PdfReportEngine } from "@/infrastructure/report-engine/PdfReportEngine";

import { GetQuestionSet } from "@/application/use-cases/GetQuestionSet";
import { SubmitAssessment } from "@/application/use-cases/SubmitAssessment";
import { CaptureLead } from "@/application/use-cases/CaptureLead";
import { GenerateReport } from "@/application/use-cases/GenerateReport";

/**
 * Composition root.
 *
 * This is the ONLY place in the app that knows about concrete
 * Infrastructure classes. API routes (UI layer) depend on the use
 * cases returned here, never on JsonQuestionRepository, Prisma, etc.
 * directly. Swapping an adapter (e.g. JSON questions -> CMS questions)
 * means changing one line in this file.
 */
const questionRepository = new JsonQuestionRepository();
const scoringConfigRepository = new JsonScoringConfigRepository();
const assessmentResultRepository = new PrismaAssessmentResultRepository();
const leadRepository = new PrismaLeadRepository();
const scoringEngine = new ConfigurableScoringEngine();
const reportEngine = new PdfReportEngine();

export const container = {
  getQuestionSet: () => new GetQuestionSet(questionRepository),
  submitAssessment: () =>
    new SubmitAssessment(
      questionRepository,
      scoringConfigRepository,
      scoringEngine,
      assessmentResultRepository
    ),
  captureLead: () => new CaptureLead(leadRepository, assessmentResultRepository),
  generateReport: () => new GenerateReport(assessmentResultRepository, reportEngine),
  assessmentResultRepository,
};
