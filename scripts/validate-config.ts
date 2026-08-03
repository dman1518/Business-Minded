/**
 * Build/CI gate: fails the build clearly if the bundled question set or
 * scoring config violates the locked Business Minded Framework v1.
 * Wired as the `prebuild` script (runs automatically before `npm run
 * build`) and also run as an explicit CI step for a clear log line.
 */
import { validateStartupConfig } from "../src/infrastructure/config/validateStartupConfig";
import { QuestionSet } from "../src/domain/entities/Question";
import { ScoringConfig } from "../src/domain/repositories/ScoringConfigRepository";
import questionsData from "../src/infrastructure/config/questions.json";
import scoringRulesData from "../src/infrastructure/config/scoring-rules.json";

try {
  validateStartupConfig(
    questionsData as unknown as QuestionSet,
    scoringRulesData as unknown as ScoringConfig
  );
  console.log("✓ Business Minded configuration is valid.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
