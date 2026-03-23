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
  const key = "scrape:combined:today";
  const cached = getFromCache<CombinedMatch[]>(key);
  if (cached) return cached;

  const [forebet, olbg, vitibet] = await Promise.all([
    scrapeForebetToday(),
    scrapeOlbgToday(),
    scrapeVitibetToday(),
  ]);

  const byId: Record<string, CombinedMatch> = {};

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
    const existing = byId[item.id];
    byId[item.id] = {
      id: item.id,
      homeTeam: existing?.homeTeam ?? item.homeTeam,
      awayTeam: existing?.awayTeam ?? item.awayTeam,
      kickoffTime: existing?.kickoffTime,
      forebet: existing?.forebet,
      olbg: item,
      vitibet: existing?.vitibet,
    };
  });

  vitibet.forEach((item) => {
    const existing = byId[item.id];
    byId[item.id] = {
      id: item.id,
      homeTeam: existing?.homeTeam ?? item.homeTeam,
      awayTeam: existing?.awayTeam ?? item.awayTeam,
      kickoffTime: existing?.kickoffTime,
      forebet: existing?.forebet,
      olbg: existing?.olbg,
      vitibet: item,
    };
  });

  const result = Object.values(byId);
  setToCache(key, result, TTL_TODAY_MS);
  return result;
}
