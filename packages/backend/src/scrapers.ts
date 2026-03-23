import {
  CombinedMatch,
  ForebetMatchDetails,
  ForebetTodayMatch,
  OlbgTodayTip,
  VitibetTodayTip,
} from "./types";
import { getFromCache, setToCache } from "./cache";

const FOREBET_URL = "https://www.forebet.com/en/football-tips-and-predictions-for-today";
const OLBG_URL = "https://www.olbg.com/betting-tips/Football/1";
const VITIBET_URL = "https://www.vitibet.com/index.php?clanek=quicktips&sekce=fotbal&lang=en";

const TTL_TODAY_MS = 1000 * 60 * 20;
const TTL_MATCH_DETAILS_MS = 1000 * 60 * 10;
const PAIR_SUGGESTIONS_KEY = "scrape:combined:pair-suggestions";
const PAIR_OVERRIDES_KEY = "scrape:combined:pair-overrides";
const MATCH_HIGH_CONFIDENCE = 0.72;
const MATCH_SUGGESTION_MIN = 0.55;

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

type PairOverride = {
  source: "olbg" | "vitibet";
  candidateId: string;
  targetId: string;
  approvedAt: string;
};

function normalizeMatchId(homeTeam: string, awayTeam: string) {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${norm(homeTeam)}-vs-${norm(awayTeam)}`;
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractNumber(value: string, fallback = 0) {
  const match = value.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : fallback;
}

function parsePercentTriplet(value: string) {
  const matches = value.match(/\d{1,3}/g) ?? [];
  return {
    home: Number(matches[0] ?? 0),
    draw: Number(matches[1] ?? 0),
    away: Number(matches[2] ?? 0),
  };
}

function extractKickoffTime(value: string): string | undefined {
  return value.match(/\b\d{1,2}:\d{2}\b/)?.[0];
}

function extractLeagueHint(value: string): string | undefined {
  const knownLeagues = [
    "Premier League",
    "La Liga",
    "Serie A",
    "Bundesliga",
    "Ligue 1",
    "Championship",
    "Eredivisie",
    "Veikkausliiga",
    "MLS",
  ];

  const found = knownLeagues.find((league) => new RegExp(`\\b${league}\\b`, "i").test(value));
  return found;
}

// MATCH PAIRING HELPER:
// Attempts to join source rows to the same real-world game even when team IDs differ.
// Uses weighted similarity over team names, kickoff time proximity and league hint.
function normalizeTeamLabel(value: string) {
  const withoutDiacritics = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ");

  return withoutDiacritics
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !["fc", "cf", "ac", "sc", "fk", "afc", "club", "the"].includes(token));
}

function tokenSimilarity(a: string, b: string) {
  if (!a || !b) return 0;
  const aNorm = normalizeTeamLabel(a);
  const bNorm = normalizeTeamLabel(b);
  if (!aNorm.length || !bNorm.length) return 0;

  const aJoined = aNorm.join(" ");
  const bJoined = bNorm.join(" ");
  if (aJoined === bJoined) return 1;
  if (aJoined.includes(bJoined) || bJoined.includes(aJoined)) return 0.85;

  const aSet = new Set(aNorm);
  const bSet = new Set(bNorm);
  const intersection = [...aSet].filter((v) => bSet.has(v)).length;
  const union = new Set([...aSet, ...bSet]).size;
  return union > 0 ? intersection / union : 0;
}

function parseKickoffMinutes(value?: string) {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function kickoffSimilarity(a?: string, b?: string) {
  const aMin = parseKickoffMinutes(a);
  const bMin = parseKickoffMinutes(b);
  if (aMin === null || bMin === null) return 0.1;

  const diff = Math.abs(aMin - bMin);
  if (diff <= 10) return 1;
  if (diff <= 30) return 0.8;
  if (diff <= 60) return 0.6;
  if (diff <= 120) return 0.3;
  return 0;
}

function leagueSimilarity(a?: string, b?: string) {
  if (!a || !b) return 0.05;
  const aNorm = a.toLowerCase();
  const bNorm = b.toLowerCase();
  if (aNorm === bNorm) return 1;
  if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) return 0.7;
  return 0;
}

function matchPairScore(
  left: { homeTeam: string; awayTeam: string; kickoffTime?: string; league?: string },
  right: { homeTeam: string; awayTeam: string; kickoffTime?: string; league?: string },
) {
  const directTeamScore =
    (tokenSimilarity(left.homeTeam, right.homeTeam) + tokenSimilarity(left.awayTeam, right.awayTeam)) / 2;
  const swappedTeamScore =
    (tokenSimilarity(left.homeTeam, right.awayTeam) + tokenSimilarity(left.awayTeam, right.homeTeam)) / 2 - 0.15;

  const teamScore = Math.max(directTeamScore, swappedTeamScore);
  const timeScore = kickoffSimilarity(left.kickoffTime, right.kickoffTime);
  const leagueScore = leagueSimilarity(left.league, right.league);

  return teamScore * 0.78 + timeScore * 0.17 + leagueScore * 0.05;
}

function findBestCombinedCandidate(
  byId: Record<string, CombinedMatch>,
  incoming: { homeTeam: string; awayTeam: string; kickoffTime?: string; league?: string },
) {
  let bestKey: string | null = null;
  let bestScore = 0;

  Object.entries(byId).forEach(([key, existing]) => {
    const score = matchPairScore(existing, incoming);
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  });

  return { key: bestKey, score: bestScore };
}

function getPairOverrides() {
  return getFromCache<PairOverride[]>(PAIR_OVERRIDES_KEY) ?? [];
}

function setPairSuggestions(suggestions: PairSuggestion[]) {
  setToCache(PAIR_SUGGESTIONS_KEY, suggestions, TTL_TODAY_MS);
}

function applyPairOverride(
  source: "olbg" | "vitibet",
  candidateId: string,
  fallbackId: string,
  overridesMap: Map<string, string>,
) {
  return overridesMap.get(`${source}:${candidateId}`) ?? fallbackId;
}

export function getPairSuggestions(): PairSuggestion[] {
  return getFromCache<PairSuggestion[]>(PAIR_SUGGESTIONS_KEY) ?? [];
}

export function approvePairSuggestion(source: "olbg" | "vitibet", candidateId: string, targetId: string) {
  const current = getPairOverrides();
  const key = `${source}:${candidateId}`;
  const next = [
    ...current.filter((item) => `${item.source}:${item.candidateId}` !== key),
    {
      source,
      candidateId,
      targetId,
      approvedAt: new Date().toISOString(),
    },
  ];
  setToCache(PAIR_OVERRIDES_KEY, next, 1000 * 60 * 60 * 24 * 30);
}

function fallbackForebetToday(): ForebetTodayMatch[] {
  const scrapedAt = new Date().toISOString();
  return [
    {
      id: "arsenal-vs-chelsea",
      homeTeam: "Arsenal",
      awayTeam: "Chelsea",
      kickoffTime: "19:30",
      percentages: { home: 51, draw: 27, away: 22 },
      prediction1x2: "1",
      btts: "Yes",
      overUnder: "Over 2.5",
      forebetScore: "2-1",
      ranking: "A",
      matchUrl: `${FOREBET_URL}#arsenal-vs-chelsea`,
      source: "forebet",
      scrapedAt,
    },
  ];
}

function fallbackOlbgToday(): OlbgTodayTip[] {
  const scrapedAt = new Date().toISOString();
  return [
    {
      id: "arsenal-vs-chelsea",
      homeTeam: "Arsenal",
      awayTeam: "Chelsea",
      stars: 4,
      bettorCount: 327,
      popularPick: "Home win",
      confidencePct: 68,
      source: "olbg",
      scrapedAt,
    },
  ];
}

function fallbackVitibetToday(): VitibetTodayTip[] {
  const scrapedAt = new Date().toISOString();
  return [
    {
      id: "arsenal-vs-chelsea",
      homeTeam: "Arsenal",
      awayTeam: "Chelsea",
      percentages: { home: 49, draw: 25, away: 26 },
      recommendation: "1",
      riskLevel: "medium",
      possibleScore: "2-1",
      source: "vitibet",
      scrapedAt,
    },
  ];
}

export async function scrapeForebetToday(): Promise<ForebetTodayMatch[]> {
  const key = "scrape:forebet:today";
  const cached = getFromCache<ForebetTodayMatch[]>(key);
  if (cached) return cached;

  try {
    const response = await fetch(FOREBET_URL, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; NordicAnalyticsBot/1.0)" },
    });
    if (!response.ok) throw new Error(`Forebet request failed: ${response.status}`);

    const html = await response.text();
    const rowCandidates = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
    const rows = rowCandidates.slice(0, 40);
    const scrapedAt = new Date().toISOString();

    const parsed = rows
      .map((row, index): ForebetTodayMatch | null => {
        const plain = cleanText(row.replace(/<[^>]+>/g, " "));
        const teams = plain.match(/([A-Za-z0-9 .'-]{2,})\s+vs\s+([A-Za-z0-9 .'-]{2,})/i);
        if (!teams) return null;

        const homeTeam = cleanText(teams[1]);
        const awayTeam = cleanText(teams[2]);
        const id = normalizeMatchId(homeTeam, awayTeam);
        const percentages = parsePercentTriplet(plain);
        const prediction = plain.match(/\b(1X|X2|12|1|X|2)\b/)?.[0] ?? "1";
        const score = plain.match(/\b\d-\d\b/)?.[0];
        const kickoffTime = plain.match(/\b\d{1,2}:\d{2}\b/)?.[0];
        const btts = /btts\s*yes/i.test(plain) ? "Yes" : /btts\s*no/i.test(plain) ? "No" : undefined;
        const overUnder = /over\s*2\.5/i.test(plain)
          ? "Over 2.5"
          : /under\s*2\.5/i.test(plain)
            ? "Under 2.5"
            : undefined;
        const forebetScore = score;
        const ranking = plain.match(/\b[A-C]\b/)?.[0];
        const href = row.match(/href=["']([^"']+)["']/i)?.[1];
        const matchUrl = href?.startsWith("http") ? href : `https://www.forebet.com${href ?? ""}`;

        return {
          id: id || `forebet-${index}`,
          homeTeam,
          awayTeam,
          percentages,
          prediction1x2: prediction,
          matchUrl: matchUrl || FOREBET_URL,
          source: "forebet" as const,
          scrapedAt,
          ...(kickoffTime ? { kickoffTime } : {}),
          ...(btts ? { btts } : {}),
          ...(overUnder ? { overUnder } : {}),
          ...(forebetScore ? { forebetScore } : {}),
          ...(ranking ? { ranking } : {}),
        };
      })
      .filter((item): item is ForebetTodayMatch => Boolean(item));

    const result = parsed.length ? parsed : fallbackForebetToday();
    setToCache(key, result, TTL_TODAY_MS);
    return result;
  } catch {
    const fallback = fallbackForebetToday();
    setToCache(key, fallback, TTL_TODAY_MS);
    return fallback;
  }
}

export async function scrapeForebetMatchDetails(matchId: string, matchUrl?: string): Promise<ForebetMatchDetails> {
  const key = `scrape:forebet:match:${matchId}`;
  const cached = getFromCache<ForebetMatchDetails>(key);
  if (cached) return cached;

  const empty: ForebetMatchDetails = {
    id: matchId,
    trends: [],
    form: [],
    headToHead: [],
    source: "forebet",
    scrapedAt: new Date().toISOString(),
  };

  try {
    if (!matchUrl) {
      const today = await scrapeForebetToday();
      matchUrl = today.find((m) => m.id === matchId)?.matchUrl;
    }
    if (!matchUrl) {
      setToCache(key, empty, TTL_MATCH_DETAILS_MS);
      return empty;
    }

    const response = await fetch(matchUrl, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; NordicAnalyticsBot/1.0)" },
    });
    if (!response.ok) throw new Error(`Forebet match request failed: ${response.status}`);

    const html = await response.text();
    const plain = cleanText(html.replace(/<[^>]+>/g, " "));

    const details: ForebetMatchDetails = {
      id: matchId,
      xg: /xg/i.test(plain)
        ? {
            home: extractNumber(plain.split(/xg/i)[1] ?? "0"),
            away: extractNumber(plain.split(/xg/i)[2] ?? "0"),
          }
        : undefined,
      shots: /shots/i.test(plain)
        ? {
            home: extractNumber(plain.split(/shots/i)[1] ?? "0"),
            away: extractNumber(plain.split(/shots/i)[2] ?? "0"),
          }
        : undefined,
      possession: /possession/i.test(plain)
        ? {
            home: extractNumber(plain.split(/possession/i)[1] ?? "0"),
            away: extractNumber(plain.split(/possession/i)[2] ?? "0"),
          }
        : undefined,
      trends: (plain.match(/trend[^.]{0,80}/gi) ?? []).slice(0, 6).map(cleanText),
      form: (plain.match(/form[^.]{0,80}/gi) ?? []).slice(0, 6).map(cleanText),
      headToHead: (plain.match(/head to head[^.]{0,90}/gi) ?? []).slice(0, 6).map(cleanText),
      source: "forebet",
      scrapedAt: new Date().toISOString(),
    };

    setToCache(key, details, TTL_MATCH_DETAILS_MS);
    return details;
  } catch {
    setToCache(key, empty, TTL_MATCH_DETAILS_MS);
    return empty;
  }
}

export async function scrapeOlbgToday(): Promise<OlbgTodayTip[]> {
  const key = "scrape:olbg:today";
  const cached = getFromCache<OlbgTodayTip[]>(key);
  if (cached) return cached;

  try {
    const response = await fetch(OLBG_URL, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; NordicAnalyticsBot/1.0)" },
    });
    if (!response.ok) throw new Error(`OLBG request failed: ${response.status}`);

    const html = await response.text();
    const rows = (html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []).slice(0, 40);
    const scrapedAt = new Date().toISOString();

    const parsed = rows
      .map((row, index) => {
        const plain = cleanText(row.replace(/<[^>]+>/g, " "));
        const teams = plain.match(/([A-Za-z0-9 .'-]{2,})\s+v\s+([A-Za-z0-9 .'-]{2,})/i);
        if (!teams) return null;

        const homeTeam = cleanText(teams[1]);
        const awayTeam = cleanText(teams[2]);
        const id = normalizeMatchId(homeTeam, awayTeam);
        const kickoffTime = extractKickoffTime(plain);
        const league = extractLeagueHint(plain);
        const stars = Math.min(5, Math.max(0, extractNumber(plain.match(/\d\s*stars?/i)?.[0] ?? "0")));
        const bettorCount = extractNumber(plain.match(/\d+\s*(users|bettors|tips)/i)?.[0] ?? "0");
        const confidencePct = Math.min(100, extractNumber(plain.match(/\d{1,3}%/)?.[0] ?? "0"));

        return {
          id: id || `olbg-${index}`,
          homeTeam,
          awayTeam,
          stars,
          bettorCount,
          popularPick: plain.match(/(home win|away win|draw|over 2\.5|under 2\.5|btts)/i)?.[0] ?? "home win",
          confidencePct,
          source: "olbg" as const,
          scrapedAt,
          ...(kickoffTime ? { kickoffTime } : {}),
          ...(league ? { league } : {}),
        };
      })
      .filter((item): item is OlbgTodayTip => Boolean(item));

    const result = parsed.length ? parsed : fallbackOlbgToday();
    setToCache(key, result, TTL_TODAY_MS);
    return result;
  } catch {
    const fallback = fallbackOlbgToday();
    setToCache(key, fallback, TTL_TODAY_MS);
    return fallback;
  }
}

export async function scrapeVitibetToday(): Promise<VitibetTodayTip[]> {
  const key = "scrape:vitibet:today";
  const cached = getFromCache<VitibetTodayTip[]>(key);
  if (cached) return cached;

  try {
    const response = await fetch(VITIBET_URL, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; NordicAnalyticsBot/1.0)" },
    });
    if (!response.ok) throw new Error(`Vitibet request failed: ${response.status}`);

    const html = await response.text();
    const rows = (html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []).slice(0, 40);
    const scrapedAt = new Date().toISOString();

    const parsed = rows
      .map((row, index): VitibetTodayTip | null => {
        const plain = cleanText(row.replace(/<[^>]+>/g, " "));
        const teams = plain.match(/([A-Za-z0-9 .'-]{2,})\s+-\s+([A-Za-z0-9 .'-]{2,})/i);
        if (!teams) return null;

        const homeTeam = cleanText(teams[1]);
        const awayTeam = cleanText(teams[2]);
        const id = normalizeMatchId(homeTeam, awayTeam);
        const kickoffTime = extractKickoffTime(plain);
        const league = extractLeagueHint(plain);
        const percentages = parsePercentTriplet(plain);
        const riskLevel: VitibetTodayTip["riskLevel"] = /low/i.test(plain)
          ? "low"
          : /high/i.test(plain)
            ? "high"
            : /medium/i.test(plain)
              ? "medium"
              : "unknown";
        const possibleScore = plain.match(/\b\d-\d\b/)?.[0];

        return {
          id: id || `vitibet-${index}`,
          homeTeam,
          awayTeam,
          percentages,
          recommendation: plain.match(/\b(1X|X2|12|1|X|2)\b/)?.[0] ?? "1",
          riskLevel,
          source: "vitibet" as const,
          scrapedAt,
          ...(kickoffTime ? { kickoffTime } : {}),
          ...(league ? { league } : {}),
          ...(possibleScore ? { possibleScore } : {}),
        };
      })
      .filter((item): item is VitibetTodayTip => Boolean(item));

    const result = parsed.length ? parsed : fallbackVitibetToday();
    setToCache(key, result, TTL_TODAY_MS);
    return result;
  } catch {
    const fallback = fallbackVitibetToday();
    setToCache(key, fallback, TTL_TODAY_MS);
    return fallback;
  }
}

export async function scrapeCombinedMatches(): Promise<CombinedMatch[]> {
  const overrides = getPairOverrides();
  const overridesMap = new Map(overrides.map((item) => [`${item.source}:${item.candidateId}`, item.targetId]));
  const overrideVersion =
    overrides
      .map((item) => `${item.source}:${item.candidateId}->${item.targetId}`)
      .sort()
      .join("|") || "none";
  const key = `scrape:combined:today:${overrideVersion}`;
  const cached = getFromCache<CombinedMatch[]>(key);
  if (cached) return cached;

  const [forebet, olbg, vitibet] = await Promise.all([
    scrapeForebetToday(),
    scrapeOlbgToday(),
    scrapeVitibetToday(),
  ]);

  const byId: Record<string, CombinedMatch> = {};
  const suggestions: PairSuggestion[] = [];

  forebet.forEach((item) => {
    byId[item.id] = {
      id: item.id,
      homeTeam: item.homeTeam,
      awayTeam: item.awayTeam,
      kickoffTime: item.kickoffTime,
      forebet: item,
    };
  });

  olbg.forEach((item) => {
    const overriddenId = applyPairOverride("olbg", item.id, item.id, overridesMap);
    const candidate = findBestCombinedCandidate(byId, item);
    const matchedId =
      byId[overriddenId] || overriddenId !== item.id
        ? overriddenId
        : candidate.key && candidate.score >= MATCH_HIGH_CONFIDENCE
          ? candidate.key
          : item.id;

    if (!byId[overriddenId] && overriddenId === item.id && candidate.key && candidate.score >= MATCH_SUGGESTION_MIN) {
      suggestions.push({
        source: "olbg",
        candidateId: item.id,
        candidateHomeTeam: item.homeTeam,
        candidateAwayTeam: item.awayTeam,
        candidateKickoffTime: item.kickoffTime,
        targetId: candidate.key,
        targetHomeTeam: byId[candidate.key].homeTeam,
        targetAwayTeam: byId[candidate.key].awayTeam,
        targetKickoffTime: byId[candidate.key].kickoffTime,
        score: Number(candidate.score.toFixed(3)),
      });
    }

    const existing = byId[matchedId];
    byId[matchedId] = {
      id: matchedId,
      homeTeam: existing?.homeTeam ?? item.homeTeam,
      awayTeam: existing?.awayTeam ?? item.awayTeam,
      kickoffTime: existing?.kickoffTime ?? item.kickoffTime,
      forebet: existing?.forebet,
      olbg: item,
      vitibet: existing?.vitibet,
    };
  });

  vitibet.forEach((item) => {
    const overriddenId = applyPairOverride("vitibet", item.id, item.id, overridesMap);
    const candidate = findBestCombinedCandidate(byId, item);
    const matchedId =
      byId[overriddenId] || overriddenId !== item.id
        ? overriddenId
        : candidate.key && candidate.score >= MATCH_HIGH_CONFIDENCE
          ? candidate.key
          : item.id;

    if (!byId[overriddenId] && overriddenId === item.id && candidate.key && candidate.score >= MATCH_SUGGESTION_MIN) {
      suggestions.push({
        source: "vitibet",
        candidateId: item.id,
        candidateHomeTeam: item.homeTeam,
        candidateAwayTeam: item.awayTeam,
        candidateKickoffTime: item.kickoffTime,
        targetId: candidate.key,
        targetHomeTeam: byId[candidate.key].homeTeam,
        targetAwayTeam: byId[candidate.key].awayTeam,
        targetKickoffTime: byId[candidate.key].kickoffTime,
        score: Number(candidate.score.toFixed(3)),
      });
    }

    const existing = byId[matchedId];
    byId[matchedId] = {
      id: matchedId,
      homeTeam: existing?.homeTeam ?? item.homeTeam,
      awayTeam: existing?.awayTeam ?? item.awayTeam,
      kickoffTime: existing?.kickoffTime ?? item.kickoffTime,
      forebet: existing?.forebet,
      olbg: existing?.olbg,
      vitibet: item,
    };
  });

  const result = Object.values(byId);
  setPairSuggestions(suggestions);
  setToCache(key, result, TTL_TODAY_MS);
  return result;
}
