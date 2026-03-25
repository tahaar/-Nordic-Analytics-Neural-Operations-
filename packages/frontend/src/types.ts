export type SourceName = "forebet" | "olbg" | "vitibet";

export type Tip = {
  id: string;
  matchKey: string;
  source: SourceName;
  tipType: string;
  tipValue: string;
  confidence?: number;
  percentHome?: number;
  percentDraw?: number;
  percentAway?: number;
  scrapedAt: string;
};

export type ForebetMatchStats = {
  matchKey: string;
  xgHome?: number;
  xgAway?: number;
  shotsHome?: number;
  shotsAway?: number;
  possessionHome?: number;
  possessionAway?: number;
  formHome?: string;
  formAway?: string;
};

export type ForebetDeepDetails = {
  leaguePositionHome: number | null;
  leaguePositionAway: number | null;
  last10Home: string[];
  last10Away: string[];
  xgHome: number | null;
  xgAway: number | null;
  shotsHome: number | null;
  shotsAway: number | null;
  shotsOnTargetHome: number | null;
  shotsOnTargetAway: number | null;
  possessionHome: number | null;
  possessionAway: number | null;
  dangerousHome: number | null;
  dangerousAway: number | null;
  formHome: string | null;
  formAway: string | null;
  h2h: string[];
};

export type ForebetRow = {
  predictedScore?: string;
  percentHome?: number;
  percentDraw?: number;
  percentAway?: number;
  matchUrl?: string;
};

export type OlbgRow = {
  stars?: number;
  tipCount?: number;
  mainTip?: string;
  popularPick?: string;
  confidencePct?: number;
  bettorCount?: number;
};

export type VitibetRow = {
  tip?: string;
  recommendation?: string;
  percentHome?: number;
  percentDraw?: number;
  percentAway?: number;
};

export type CombinedMatchRow = {
  matchKey: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  kickoff: string;
  forebet?: ForebetRow;
  forebetStats?: ForebetMatchStats;
  olbg?: OlbgRow;
  vitibet?: VitibetRow;
  tips: Tip[];
};

export type ApiCombinedMatch = {
  id?: string;
  matchKey?: string;
  homeTeam: string;
  awayTeam: string;
  league?: string;
  kickoff?: string;
  kickoffTime?: string;
  forebet?: {
    predictedScore?: string;
    percentHome?: number;
    percentDraw?: number;
    percentAway?: number;
    percentages?: {
      home: number;
      draw: number;
      away: number;
    };
    matchUrl?: string;
    source?: SourceName;
  };
  olbg?: {
    stars?: number;
    tipCount?: number;
    mainTip?: string;
    popularPick?: string;
    confidencePct?: number;
    bettorCount?: number;
    source?: SourceName;
  };
  vitibet?: {
    tip?: string;
    recommendation?: string;
    percentHome?: number;
    percentDraw?: number;
    percentAway?: number;
    percentages?: {
      home: number;
      draw: number;
      away: number;
    };
    source?: SourceName;
  };
  tips?: Tip[];
};

export type AIReview = {
  analysis: string;
  missingData: string[];
  suggestedGeminiQuestion: string;
};

export type BetSelection = {
  matchKey: string;
  label: string;
};

export type BetSlip = {
  id: string;
  name: string;
  selections: BetSelection[];
};

export type PairSuggestion = {
  source: "olbg" | "vitibet";
  candidateId: string;
  candidateHomeTeam: string;
  candidateAwayTeam: string;
  candidateKickoffTime?: string;
  targetId: string;
  targetHomeTeam: string;
  targetAwayTeam: string;
  targetKickoffTime?: string;
  score: number;
};

export type AdminMemoryMetrics = {
  process: {
    rssBytes: number;
    heapTotalBytes: number;
    heapUsedBytes: number;
    externalBytes: number;
    arrayBuffersBytes: number;
    uptimeSeconds: number;
    pid: number;
  };
  cache: {
    entries: number;
    expiredEntries: number;
    approximateBytes: number;
    filePath: string;
    loadedFromDiskAt: string | null;
    lastSaveAt: string | null;
  };
  user: {
    sub: string;
    email: string | null;
    roles: string[];
  };
  generatedAt: string;
};
