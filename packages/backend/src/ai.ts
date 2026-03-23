import { MatchView, AIReview } from "./types";

export async function reviewMatchAI(match: MatchView): Promise<AIReview> {
  return {
    analysis: `Analyysi ottelusta ${match.homeTeam} vs ${match.awayTeam} (stub).`,
    missingData: ["xG", "injuries"],
    suggestedGeminiQuestion:
      "Mikä joukkue hallitsee hyökkäyskolmannetta ja miksi?",
  };
}
