import { ScoringConfigRepository, ScoringConfig } from "@/domain/repositories/ScoringConfigRepository";
import scoringRulesData from "@/infrastructure/config/scoring-rules.json";

/**
 * Adapter: loads scoring rules from the bundled JSON config.
 * Sprint 1 requirement: "The scoring engine must also load scoring
 * rules from configuration." Category weights, insight copy, and
 * confidence thresholds all live here — never in UI components.
 */
export class JsonScoringConfigRepository implements ScoringConfigRepository {
  async getConfig(): Promise<ScoringConfig> {
    return scoringRulesData as unknown as ScoringConfig;
  }
}
