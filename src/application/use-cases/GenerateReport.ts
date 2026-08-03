import { AssessmentResultRepository } from "@/domain/repositories/AssessmentResultRepository";
import { ReportEngine } from "@/domain/repositories/ReportEngine";
import { SavedLead } from "@/domain/entities/Lead";

/**
 * Use case: render the PDF report for a scored assessment result.
 * The lead is optional (a user may download without emailing, per the
 * Results-page "Download Report" button), but is included when present
 * so the report can be personalized.
 */
export class GenerateReport {
  constructor(
    private readonly assessmentResultRepository: AssessmentResultRepository,
    private readonly reportEngine: ReportEngine
  ) {}

  async execute(assessmentResultId: string, lead?: SavedLead): Promise<Buffer> {
    const result = await this.assessmentResultRepository.findById(
      assessmentResultId
    );
    if (!result) {
      throw new Error(
        `No assessment result found for id "${assessmentResultId}".`
      );
    }

    return this.reportEngine.generate(result, lead);
  }
}
