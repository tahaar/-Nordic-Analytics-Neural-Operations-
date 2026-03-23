import { Tip, Stats } from "./types";

export const DB = {
  tips: [] as Tip[],
  stats: [] as Stats[],

  getTipsByMatch(matchId: string) {
    return this.tips.filter((t) => t.matchId === matchId);
  },

  getStatsByMatch(matchId: string) {
    return this.stats.find((s) => s.matchId === matchId) || null;
  },
};
