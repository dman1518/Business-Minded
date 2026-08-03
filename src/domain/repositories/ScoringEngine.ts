import { Answer } from "../entities/Answer";
import { QuestionSet } from "../entities/Question";
import { AssessmentScoreResult } from "../entities/Score";
import { ScoringConfig } from "./ScoringConfigRepository";

/**
 * Port: turns raw answers into a scored result.
 * All business rules (weights, thresholds, insight copy) come from
 * ScoringConfig — this port has no hardcoded logic in its signature,
 * and implementations must not hardcode it either.
 */
export interface ScoringEngine {
  score(
    answers: Answer[],
    questionSet: QuestionSet,
    config: ScoringConfig
  ): AssessmentScoreResult;
}
