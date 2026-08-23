import { JsonQuestionRepository } from "@/infrastructure/repositories/JsonQuestionRepository";
import { JsonScoringConfigRepository } from "@/infrastructure/repositories/JsonScoringConfigRepository";
import { PrismaAssessmentResultRepository } from "@/infrastructure/repositories/PrismaAssessmentResultRepository";
import { PrismaLeadRepository } from "@/infrastructure/repositories/PrismaLeadRepository";
import { PrismaClarityPurchaseRepository } from "@/infrastructure/repositories/PrismaClarityPurchaseRepository";
import { PrismaClarityWebhookEventRepository } from "@/infrastructure/repositories/PrismaClarityWebhookEventRepository";
import { PrismaClarityIntakeRepository } from "@/infrastructure/repositories/PrismaClarityIntakeRepository";
import { StripeCheckoutGateway } from "@/infrastructure/payments/StripeCheckoutGateway";
import { ConfigurableScoringEngine } from "@/infrastructure/scoring-engine/ConfigurableScoringEngine";
import { PdfReportEngine } from "@/infrastructure/report-engine/PdfReportEngine";
import { validateStartupConfig } from "@/infrastructure/config/validateStartupConfig";
import { QuestionSet } from "@/domain/entities/Question";
import { ScoringConfig } from "@/domain/repositories/ScoringConfigRepository";
import questionsData from "@/infrastructure/config/questions.json";
import scoringRulesData from "@/infrastructure/config/scoring-rules.json";

import { GetQuestionSet } from "@/application/use-cases/GetQuestionSet";
import { SubmitAssessment } from "@/application/use-cases/SubmitAssessment";
import { CaptureLead } from "@/application/use-cases/CaptureLead";
import { GenerateReport } from "@/application/use-cases/GenerateReport";
import { CreateClarityCheckoutSession } from "@/application/use-cases/CreateClarityCheckoutSession";
import { SubmitClarityIntake } from "@/application/use-cases/SubmitClarityIntake";

/**
 * Composition root.
 *
 * This is the ONLY place in the app that knows about concrete
 * Infrastructure classes. API routes (UI layer) depend on the use
 * cases returned here, never on JsonQuestionRepository, Prisma, etc.
 * directly. Swapping an adapter (e.g. JSON questions -> CMS questions)
 * means changing one line in this file.
 *
 * Eager, fail-loud safety net: `npm run build` already runs
 * `validate:config` (see prebuild script), but this call also
 * validates at server startup / first import so a bad config can never
 * silently serve wrong scores in any environment.
 */
validateStartupConfig(questionsData as unknown as QuestionSet, scoringRulesData as unknown as ScoringConfig);

const questionRepository = new JsonQuestionRepository();
const scoringConfigRepository = new JsonScoringConfigRepository();
const scoringEngine = new ConfigurableScoringEngine();
const assessmentResultRepository = new PrismaAssessmentResultRepository(
  questionRepository,
  scoringConfigRepository,
  scoringEngine
);
const leadRepository = new PrismaLeadRepository();
const reportEngine = new PdfReportEngine();
const clarityPurchaseRepository = new PrismaClarityPurchaseRepository();
const clarityWebhookEventRepository = new PrismaClarityWebhookEventRepository();
const clarityIntakeRepository = new PrismaClarityIntakeRepository();
const clarityCheckoutGateway = new StripeCheckoutGateway();

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
  createClarityCheckoutSession: () =>
    new CreateClarityCheckoutSession(
      clarityPurchaseRepository,
      clarityCheckoutGateway,
      assessmentResultRepository,
      leadRepository
    ),
  submitClarityIntake: () => new SubmitClarityIntake(clarityPurchaseRepository, clarityIntakeRepository),
  clarityPurchaseRepository,
  clarityWebhookEventRepository,
  clarityIntakeRepository,
  clarityCheckoutGateway,
  assessmentResultRepository,
  scoringConfigRepository,
};
