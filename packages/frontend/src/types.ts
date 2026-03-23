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
