export type Tip = {
  id: string;
  matchId: string;
  source: "olbg" | "forebet" | "vitibet";
  tipType: string;
  tipValue: string;
  confidence?: number;
  scrapedAt: string;
  validFrom: string;
};

export type Stats = {
  matchId: string;
  leagueId: string;
  homeTeam: string;
  awayTeam: string;
  possession: {
    home: number;
    away: number;
    homeFinalThird?: number;
    awayFinalThird?: number;
    homeDefThird?: number;
    awayDefThird?: number;
  };
  shots: {
    totalHome: number;
    totalAway: number;
    onTargetHome: number;
    onTargetAway: number;
    dangerousHome?: number;
    dangerousAway?: number;
  };
  xg?: { home: number; away: number };
  updatedAt: string;
};

export type MatchView = {
  matchId: string;
  leagueId: string;
  homeTeam: string;
  awayTeam: string;
  tips: Tip[];
  stats: Stats | null;
};

export type AIReview = {
  analysis: string;
  missingData: string[];
  suggestedGeminiQuestion: string;
};

export type ForebetTodayMatch = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime?: string;
  percentages: {
    home: number;
    draw: number;
    away: number;
  };
  prediction1x2: string;
  btts?: string;
  overUnder?: string;
  forebetScore?: string;
  ranking?: string;
  matchUrl: string;
  source: "forebet";
  scrapedAt: string;
};

export type ForebetMatchDetails = {
  id: string;
  xg?: {
    home: number;
    away: number;
  };
  shots?: {
    home: number;
    away: number;
  };
  possession?: {
    home: number;
    away: number;
  };
  trends: string[];
  form: string[];
  headToHead: string[];
  source: "forebet";
  scrapedAt: string;
};

export type OlbgTodayTip = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  stars: number;
  bettorCount: number;
  popularPick: string;
  confidencePct: number;
  source: "olbg";
  scrapedAt: string;
};

export type VitibetTodayTip = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  percentages: {
    home: number;
    draw: number;
    away: number;
  };
  recommendation: string;
  riskLevel: "low" | "medium" | "high" | "unknown";
  possibleScore?: string;
  source: "vitibet";
  scrapedAt: string;
};

export type CombinedMatch = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime?: string;
  forebet?: ForebetTodayMatch;
  olbg?: OlbgTodayTip;
  vitibet?: VitibetTodayTip;
};
