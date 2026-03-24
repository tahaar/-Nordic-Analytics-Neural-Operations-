import express from "express";
import cors from "cors";
import type { Request, Response } from "express";
import { loadCacheFromDisk, saveCacheToDisk, getFromCache, setToCache } from "./cache";
import { DB } from "./db";
import { reviewMatchAI } from "./ai";
import type { MatchView } from "./types";
import {
  approvePairSuggestion,
  getPairSuggestions,
  scrapeCombinedMatches,
  scrapeForebetMatchDeepDetails,
  scrapeForebetMatchDetails,
  scrapeForebetToday,
  scrapeOlbgToday,
  scrapeVitibetToday,
} from "./scrapers";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const CHAT_HISTORY_TTL_MS = 1000 * 60 * 60 * 24;

loadCacheFromDisk();

type ChatRole = "user" | "assistant";
type ChatHistoryEntry = {
  role: ChatRole;
  text: string;
  bot: string;
  createdAt: string;
};
type ChatHistory = {
  sessionId: string;
  provider: string;
  messages: ChatHistoryEntry[];
  updatedAt: string;
};

async function callAffiliatePlus(message: string, botName: string): Promise<string> {
  const url = `https://api.affiliateplus.xyz/api/chatbot?message=${encodeURIComponent(message)}&botname=${encodeURIComponent(botName)}&ownername=NordicAnalytics`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`AffiliatePlus request failed: ${response.status}`);
  }

  const payload = (await response.json()) as { message?: string };
  const text = payload.message?.trim();
  if (!text) {
    throw new Error("AffiliatePlus returned empty message");
  }
  return text;
}

async function callGemini(message: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: message }] }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join(" ").trim();
  if (!text) {
    throw new Error("Gemini returned empty text");
  }
  return text;
}

async function resolveBotReply(message: string, botName: string): Promise<{ provider: string; reply: string }> {
  const provider = (process.env.BOT_PROVIDER || "affiliateplus").toLowerCase();

  if (provider === "gemini") {
    try {
      const reply = await callGemini(message);
      return { provider: "gemini", reply };
    } catch {
      const reply = await callAffiliatePlus(message, botName);
      return { provider: "affiliateplus", reply };
    }
  }

  try {
    const reply = await callAffiliatePlus(message, botName);
    return { provider: "affiliateplus", reply };
  } catch {
    const reply = await callGemini(message);
    return { provider: "gemini", reply };
  }
}

function getChatHistory(sessionId: string): ChatHistory {
  const key = `chat:history:${sessionId}`;
  const cached = getFromCache<ChatHistory>(key);
  if (cached) return cached;
  return {
    sessionId,
    provider: "unknown",
    messages: [],
    updatedAt: new Date().toISOString(),
  };
}

function storeChatHistory(history: ChatHistory) {
  const key = `chat:history:${history.sessionId}`;
  const trimmed = history.messages.slice(-60);
  setToCache(key, { ...history, messages: trimmed }, CHAT_HISTORY_TTL_MS);
}

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

app.post("/api/bot/chat", async (req: Request, res: Response) => {
  const body = req.body as { sessionId?: string; bot?: string; message?: string };
  const message = body.message?.trim();
  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  const sessionId = body.sessionId?.trim() || "default";
  const bot = body.bot?.trim() || "general";

  try {
    const { provider, reply } = await resolveBotReply(message, bot);
    const history = getChatHistory(sessionId);
    const now = new Date().toISOString();

    const nextHistory: ChatHistory = {
      sessionId,
      provider,
      updatedAt: now,
      messages: [
        ...history.messages,
        { role: "user", text: message, bot, createdAt: now },
        { role: "assistant", text: reply, bot, createdAt: now },
      ],
    };

    storeChatHistory(nextHistory);

    return res.json({
      sessionId,
      provider,
      reply,
      storedMessages: nextHistory.messages.length,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown bot error";
    return res.status(502).json({ error: "Bot provider failed", details });
  }
});

app.get("/api/bot/chat/:sessionId", (req: Request, res: Response) => {
  const sessionId = decodeURIComponent(req.params.sessionId || "default");
  const history = getChatHistory(sessionId);
  res.json(history);
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

app.get("/api/forebet/details/:matchKey", async (req: Request, res: Response) => {
  const matchKey = decodeURIComponent(req.params.matchKey);
  const cacheKey = `forebet:details:${matchKey}`;

  const cached = getFromCache(cacheKey);
  if (cached) return res.json(cached);

  const all = await scrapeCombinedMatches();
  const match = all.find((m) => toMatchKey(m) === matchKey)?.forebet;

  if (!match || !match.matchUrl) {
    return res.status(404).json({ error: "Match not found or no link" });
  }

  const details = await scrapeForebetMatchDeepDetails(match.matchUrl);
  setToCache(cacheKey, details, 1000 * 60 * 20);
  return res.json(details);
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

app.get("/api/matches/pair-suggestions", async (_req: Request, res: Response) => {
  await scrapeCombinedMatches();
  res.json(getPairSuggestions());
});

app.post("/api/matches/pair-suggestions/approve", async (req: Request, res: Response) => {
  const body = req.body as { source?: "olbg" | "vitibet"; candidateId?: string; targetId?: string };
  const source = body.source;
  const candidateId = body.candidateId?.trim();
  const targetId = body.targetId?.trim();

  if (!source || !candidateId || !targetId) {
    return res.status(400).json({ error: "source, candidateId and targetId are required" });
  }

  approvePairSuggestion(source, candidateId, targetId);
  await scrapeCombinedMatches();

  return res.json({ ok: true });
});

process.on("SIGTERM", () => {
  saveCacheToDisk();
  process.exit(0);
});

app.listen(PORT, () => console.log(`Backend running on ${PORT}`));
