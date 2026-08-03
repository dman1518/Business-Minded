import { SavedAssessmentResult } from "../entities/AssessmentResult";
import { SavedLead } from "../entities/Lead";

/**
 * Port: renders a scored assessment result into a downloadable report.
 * Sprint 1 implementation produces a PDF.
 */
export interface ReportEngine {
  generate(result: SavedAssessmentResult, lead?: SavedLead): Promise<Buffer>;
}
