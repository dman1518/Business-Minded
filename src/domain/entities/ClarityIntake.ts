/**
 * The 13 intake questions from the paid-offer spec. Kept as a single
 * structured object (persisted as JSON) rather than one DB column per
 * question, validated server-side against this exact shape via Zod
 * before being written (see application/dto/ClarityIntakeDto.ts).
 */
export interface ClarityIntakeAnswers {
  businessDescription: string;
  primaryCustomer: string;
  approxAnnualRevenue: string;
  teamSize: string;
  mostUrgentProblem: string;
  ninetyDayOutcome: string;
  whatYouveAlreadyTried: string;
  metricsCurrentlyTracked: string;
  implementationBlockers: string;
  approvalNeededFromOthers: boolean;
  isOwnerOrDecisionMaker: boolean;
  readyToActWithinThirtyDays: boolean;
  otherAttendees: string | null;
}

export interface ClarityIntake {
  id: string;
  purchaseId: string;
  answers: ClarityIntakeAnswers;
  status: "draft" | "submitted";
  submittedAt: Date | null;
  consentTimestamp: Date | null;
  consentPolicyVersion: string | null;
  createdAt: Date;
  updatedAt: Date;
}
