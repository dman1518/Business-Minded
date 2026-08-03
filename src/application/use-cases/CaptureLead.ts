import { Lead, SavedLead } from "@/domain/entities/Lead";
import { LeadRepository } from "@/domain/repositories/LeadRepository";
import { AssessmentResultRepository } from "@/domain/repositories/AssessmentResultRepository";

/**
 * Use case: capture a lead against a previously scored assessment result.
 */
export class CaptureLead {
  constructor(
    private readonly leadRepository: LeadRepository,
    private readonly assessmentResultRepository: AssessmentResultRepository
  ) {}

  async execute(lead: Lead): Promise<SavedLead> {
    const existingResult = await this.assessmentResultRepository.findById(
      lead.assessmentResultId
    );
    if (!existingResult) {
      throw new Error(
        `No assessment result found for id "${lead.assessmentResultId}".`
      );
    }

    return this.leadRepository.save(lead);
  }
}
