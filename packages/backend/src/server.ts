import express from "express";
import cors from "cors";
import type { Request, Response } from "express";
import { loadCacheFromDisk, saveCacheToDisk, getFromCache, setToCache } from "./cache";
import { DB } from "./db";
import { reviewMatchAI } from "./ai";
import type { MatchView } from "./types";
import {
  scrapeCombinedMatches,
  scrapeForebetMatchDetails,
  scrapeForebetToday,
  scrapeOlbgToday,
  scrapeVitibetToday,
} from "./scrapers";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

loadCacheFromDisk();

function toMatchKey(value: { id?: string; homeTeam: string; awayTeam: string }) {
  if (value.id) return value.id;
  return `${value.homeTeam}-${value.awayTeam}`.toLowerCase().replace(/\s+/g, "-");
}

function buildTipsFromCombined(row: {
  matchKey: string;
  forebet?: {
    predictedScore?: string;
    percentages?: { home: number; draw: number; away: number };
  };
  olbg?: {
    popularPick?: string;
    stars?: number;
  };
  vitibet?: {
    recommendation?: string;
    percentages?: { home: number; draw: number; away: number };
  };
}) {
  const now = new Date().toISOString();
  const tips = [] as Array<Record<string, unknown>>;

  if (row.forebet) {
    tips.push({
      id: `forebet:${row.matchKey}`,
      matchKey: row.matchKey,
      source: "forebet",
      tipType: "1X2",
      tipValue: row.forebet.predictedScore ?? "",
      percentHome: row.forebet.percentages?.home,
      percentDraw: row.forebet.percentages?.draw,
      percentAway: row.forebet.percentages?.away,
      scrapedAt: now,
    });
  }

  if (row.olbg) {
    tips.push({
      id: `olbg:${row.matchKey}`,
      matchKey: row.matchKey,
      source: "olbg",
      tipType: "main",
      tipValue: row.olbg.popularPick ?? "",
      confidence: row.olbg.stars,
      scrapedAt: now,
    });
  }

  if (row.vitibet) {
    tips.push({
      id: `vitibet:${row.matchKey}`,
      matchKey: row.matchKey,
      source: "vitibet",
      tipType: "1X2",
      tipValue: row.vitibet.recommendation ?? "",
      percentHome: row.vitibet.percentages?.home,
      percentDraw: row.vitibet.percentages?.draw,
      percentAway: row.vitibet.percentages?.away,
      scrapedAt: now,
    });
  }

  return tips;
}

async function getMatchView(matchId: string): Promise<MatchView | null> {
  const cacheKey = `match:${matchId}`;
  const cached = getFromCache<MatchView>(cacheKey);
  if (cached) return cached;

  const tips = DB.getTipsByMatch(matchId);
  const stats = DB.getStatsByMatch(matchId);

  if (!tips.length && !stats) return null;

  const view: MatchView = {
    matchId,
    leagueId: stats?.leagueId || "unknown",
    homeTeam: stats?.homeTeam || "Home",
    awayTeam: stats?.awayTeam || "Away",
    tips,
    stats,
  };

  setToCache(cacheKey, view);
  return view;
}

app.get("/api/matches/:id", async (req: Request, res: Response) => {
  const view = await getMatchView(req.params.id);
  if (!view) return res.status(404).json({ error: "Not found" });
  res.json(view);
});

app.post("/api/matches/:id/review", async (req: Request, res: Response) => {
  const view = await getMatchView(req.params.id);
  if (!view) return res.status(404).json({ error: "Not found" });
  res.json(await reviewMatchAI(view));
});

app.get("/api/forebet/today", async (_req: Request, res: Response) => {
  const data = await scrapeForebetToday();
  res.json(data);
});

app.get("/api/forebet/match/:id", async (req: Request, res: Response) => {
  const incoming = decodeURIComponent(req.params.id);
  const today = await scrapeForebetToday();
  const match = today.find((m) => m.id === incoming || toMatchKey(m) === incoming);
  if (!match) return res.status(404).json({ error: "Match not found" });

  const details = await scrapeForebetMatchDetails(match.id, match.matchUrl);
  res.json({
    matchKey: toMatchKey(match),
    xgHome: details.xg?.home,
    xgAway: details.xg?.away,
    shotsHome: details.shots?.home,
    shotsAway: details.shots?.away,
    possessionHome: details.possession?.home,
    possessionAway: details.possession?.away,
    formHome: details.form?.[0],
    formAway: details.form?.[1],
  });
});

app.get("/api/olbg/today", async (_req: Request, res: Response) => {
  const data = await scrapeOlbgToday();
  res.json(data);
});

app.get("/api/vitibet/today", async (_req: Request, res: Response) => {
  const data = await scrapeVitibetToday();
  res.json(data);
});

app.get("/api/matches/combined", async (_req: Request, res: Response) => {
  const data = await scrapeCombinedMatches();
  const normalized = data.map((row) => {
    const matchKey = toMatchKey(row);
    return {
      matchKey,
      id: row.id,
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      league: "unknown",
      kickoff: row.kickoffTime ?? "TBD",
      kickoffTime: row.kickoffTime,
      forebet: row.forebet,
      olbg: row.olbg,
      vitibet: row.vitibet,
      tips: buildTipsFromCombined({
        matchKey,
        forebet: row.forebet,
        olbg: row.olbg,
        vitibet: row.vitibet,
      }),
    };
  });
  res.json(normalized);
});

process.on("SIGTERM", () => {
  saveCacheToDisk();
  process.exit(0);
});

app.listen(PORT, () => console.log(`Backend running on ${PORT}`));
