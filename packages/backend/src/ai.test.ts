import { describe, expect, it } from "vitest";

import { reviewMatchAI } from "./ai";
import type { MatchView } from "./types";

describe("reviewMatchAI", () => {
  it("returns a stable AI review payload for a match", async () => {
    const match: MatchView = {
      matchId: "m-1",
      leagueId: "league-1",
      homeTeam: "HJK",
      awayTeam: "KuPS",
      tips: [],
      stats: null,
    };

    const review = await reviewMatchAI(match);

    expect(review.analysis).toContain("HJK");
    expect(review.analysis).toContain("KuPS");
    expect(review.missingData).toContain("xG");
    expect(review.suggestedGeminiQuestion.length).toBeGreaterThan(10);
  });
});
