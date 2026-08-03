import { Answer } from "@/domain/entities/Answer";
import { QuestionSet } from "@/domain/entities/Question";

/**
 * Thrown when submitted answers fail validation against the canonical
 * question set. `issues` is a server-side-only diagnostic list — API
 * routes must log it and return a single generic message to the client,
 * never these details (see route.ts).
 */
export class InvalidAnswersError extends Error {
  public readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid answers submitted (${issues.length} issue(s)).`);
    this.name = "InvalidAnswersError";
    this.issues = issues;
  }
}

/**
 * Validates raw submitted answers against the canonical question set
 * loaded server-side. This is the single point that decides whether a
 * submission's answers are trustworthy enough to score — the API route
 * only performs shape validation (is this JSON shaped like answers?),
 * never semantic validation (do these answers correspond to real
 * questions and real option values?).
 *
 * The API must not rely on client-side validation. A caller cannot
 * silently drop or coalesce bad input here: any unknown question id,
 * duplicate answer for the same question, or out-of-range value makes
 * the whole submission invalid. This guarantees the Scoring Engine
 * (and its completeness-based confidence calculation) only ever sees
 * answers that are unique, known, and in-range — a malformed or
 * malicious payload can never inflate completeness/confidence or skew
 * category scores by smuggling in extra or bogus answers.
 */
export function validateAnswers(answers: Answer[], questionSet: QuestionSet): Answer[] {
  const questionsById = new Map(questionSet.questions.map((q) => [q.id, q]));
  const seenQuestionIds = new Set<string>();
  const issues: string[] = [];

  for (const answer of answers) {
    const question = questionsById.get(answer.questionId);

    if (!question) {
      issues.push(`Unknown question id: "${answer.questionId}".`);
      continue;
    }

    if (seenQuestionIds.has(answer.questionId)) {
      issues.push(`Duplicate answer submitted for question "${answer.questionId}".`);
      continue;
    }
    seenQuestionIds.add(answer.questionId);

    const validValues = new Set(question.options.map((o) => o.value));
    if (!validValues.has(answer.value)) {
      issues.push(
        `Invalid value ${JSON.stringify(answer.value)} for question "${answer.questionId}".`
      );
    }
  }

  if (issues.length > 0) {
    throw new InvalidAnswersError(issues);
  }

  return answers;
}
