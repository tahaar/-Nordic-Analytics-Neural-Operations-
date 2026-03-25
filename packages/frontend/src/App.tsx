import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  TextField,
  Tabs,
  Typography,
} from "@mui/material";
import {
  AutoAwesome,
  Hub,
  Psychology,
  Refresh,
  RocketLaunch,
  Search,
  Send,
  SmartToy,
  TaskAlt,
  TravelExplore,
} from "@mui/icons-material";
import { MatchRow } from "./components/MatchRow";
import { MatchFilters } from "./components/MatchFilters";
import type { MatchFilterState } from "./components/MatchFilters";
import { LogoutButton } from "./components/LogoutButton";
import { AdminMemoryPanel } from "./components/AdminMemoryPanel";
import { useBetslips } from "./hooks/useBetslips";
import { usePinned } from "./hooks/usePinned";
import { hasRole } from "./auth/authService";
import { apiFetch } from "./services/apiFetch";
import type {
  ApiCombinedMatch,
  CombinedMatchRow,
  ForebetDeepDetails,
  ForebetMatchStats,
  PairSuggestion,
  Tip,
} from "./types";

type BotChoice = "general-free" | "football-analyst" | "sharp-scout";
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  bot: BotChoice;
  createdAt: string;
};

type MatchFilterMode = "all" | "with-vitibet" | "only-olbg" | "only-forebet";
type MatchSortMode = "pinned-first" | "kickoff-asc" | "home-team-asc" | "olbg-stars-desc" | "sources-desc";

const BOT_LABELS: Record<BotChoice, string> = {
  "general-free": "General Free Bot",
  "football-analyst": "Football Analyst",
  "sharp-scout": "Sharp Scout",
};

function botIcon(choice: BotChoice) {
  if (choice === "football-analyst") return <Psychology fontSize="small" />;
  if (choice === "sharp-scout") return <AutoAwesome fontSize="small" />;
  return <SmartToy fontSize="small" />;
}

function buildTipsFromRow(matchKey: string, row: ApiCombinedMatch): Tip[] {
  const now = new Date().toISOString();
  const tips: Tip[] = [];

  if (row.forebet) {
    const p = row.forebet.percentages;
    tips.push({
      id: `forebet:${matchKey}`,
      matchKey,
      source: "forebet",
      tipType: "1X2",
      tipValue: row.forebet.predictedScore ?? "",
      percentHome: row.forebet.percentHome ?? p?.home,
      percentDraw: row.forebet.percentDraw ?? p?.draw,
      percentAway: row.forebet.percentAway ?? p?.away,
      scrapedAt: now,
    });
  }

  if (row.olbg) {
    tips.push({
      id: `olbg:${matchKey}`,
      matchKey,
      source: "olbg",
      tipType: "main",
      tipValue: row.olbg.mainTip ?? row.olbg.popularPick ?? "",
      confidence: row.olbg.stars,
      scrapedAt: now,
    });
  }

  if (row.vitibet) {
    const p = row.vitibet.percentages;
    tips.push({
      id: `vitibet:${matchKey}`,
      matchKey,
      source: "vitibet",
      tipType: "1X2",
      tipValue: row.vitibet.tip ?? row.vitibet.recommendation ?? "",
      percentHome: row.vitibet.percentHome ?? p?.home,
      percentDraw: row.vitibet.percentDraw ?? p?.draw,
      percentAway: row.vitibet.percentAway ?? p?.away,
      scrapedAt: now,
    });
  }

  return tips;
}

function normalizeCombined(rows: ApiCombinedMatch[]): CombinedMatchRow[] {
  return rows.map((row) => {
    const matchKey = row.matchKey ?? row.id ?? `${row.homeTeam}-${row.awayTeam}`;
    return {
      matchKey,
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      league: row.league ?? "Unknown League",
      kickoff: row.kickoff ?? row.kickoffTime ?? "TBD",
      forebet: {
        predictedScore: row.forebet?.predictedScore,
        percentHome: row.forebet?.percentHome ?? row.forebet?.percentages?.home,
        percentDraw: row.forebet?.percentDraw ?? row.forebet?.percentages?.draw,
        percentAway: row.forebet?.percentAway ?? row.forebet?.percentages?.away,
        matchUrl: row.forebet?.matchUrl,
      },
      olbg: {
        stars: row.olbg?.stars,
        tipCount: row.olbg?.tipCount,
        mainTip: row.olbg?.mainTip ?? row.olbg?.popularPick,
        popularPick: row.olbg?.popularPick,
        confidencePct: row.olbg?.confidencePct,
        bettorCount: row.olbg?.bettorCount,
      },
      vitibet: {
        tip: row.vitibet?.tip ?? row.vitibet?.recommendation,
        recommendation: row.vitibet?.recommendation,
        percentHome: row.vitibet?.percentHome ?? row.vitibet?.percentages?.home,
        percentDraw: row.vitibet?.percentDraw ?? row.vitibet?.percentages?.draw,
        percentAway: row.vitibet?.percentAway ?? row.vitibet?.percentages?.away,
      },
      tips: row.tips && row.tips.length ? row.tips : buildTipsFromRow(matchKey, row),
    };
  });
}

function kickoffToMinutes(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return Number.MAX_SAFE_INTEGER;
  return hours * 60 + minutes;
}

function sourceCount(row: CombinedMatchRow) {
  let count = 0;
  if (row.forebet) count += 1;
  if (row.olbg) count += 1;
  if (row.vitibet) count += 1;
  return count;
}

export function App() {
  const isAdmin = hasRole("Admin");
  const [matches, setMatches] = useState<CombinedMatchRow[]>([]);
  const [tab, setTab] = useState(0);
  const [loadingStatsByKey, setLoadingStatsByKey] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [botOpen, setBotOpen] = useState(false);
  const [botChoice, setBotChoice] = useState<BotChoice>("general-free");
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [siteSearchLoading, setSiteSearchLoading] = useState(false);
  const [siteSearchSummary, setSiteSearchSummary] = useState<string | null>(null);
  const [siteSearchError, setSiteSearchError] = useState<string | null>(null);
  const [pairReviewOpen, setPairReviewOpen] = useState(false);
  const [pairSuggestions, setPairSuggestions] = useState<PairSuggestion[]>([]);
  const [pairLoading, setPairLoading] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [approvingPairs, setApprovingPairs] = useState<Record<string, boolean>>({});
  const [matchFilter, setMatchFilter] = useState<MatchFilterMode>("all");
  const [matchSort, setMatchSort] = useState<MatchSortMode>("pinned-first");
  const [filter, setFilter] = useState<MatchFilterState>({
    vitibet: { homeMin: 0, drawMin: 0, awayMin: 0 },
    forebet: { homeMin: 0, drawMin: 0, awayMin: 0 },
    leagues: [],
    onlyVitibet: false,
    onlyOLBG: false,
  });
  const [leagues, setLeagues] = useState<Record<string, string[]>>({});
  const [details, setDetails] = useState<Record<string, ForebetDeepDetails | null>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({});
  const { pinned, toggle } = usePinned();
  const { slips, addSlip, duplicateSlip, addSelectionToSlip, moveSelection, removeSelection } = useBetslips();

  useEffect(() => {
    const load = async () => {
      setError(null);
      try {
        const r = await apiFetch("/api/matches/combined");
        if (!r.ok) throw new Error("Failed to load matches");
        const data = (await r.json()) as ApiCombinedMatch[];
        setMatches(normalizeCombined(data));
      } catch {
        setError("Could not load combined matches");
      }
    };

    void load();
  }, []);

  useEffect(() => {
    apiFetch("/api/leagues")
      .then((r) => r.json())
      .then((data: Record<string, string[]>) => setLeagues(data))
      .catch(() => undefined);
  }, []);

  const arrangedMatches = useMemo(() => {
    const filtered = matches.filter((m) => {
      if (matchFilter === "with-vitibet") return Boolean(m.vitibet);
      if (matchFilter === "only-olbg") return Boolean(m.olbg) && !m.forebet && !m.vitibet;
      if (matchFilter === "only-forebet") return Boolean(m.forebet) && !m.olbg && !m.vitibet;
      return true;
    });

    const rows = [...filtered];

    rows.sort((a, b) => {
      if (matchSort === "kickoff-asc") {
        return kickoffToMinutes(a.kickoff) - kickoffToMinutes(b.kickoff);
      }

      if (matchSort === "home-team-asc") {
        return a.homeTeam.localeCompare(b.homeTeam);
      }

      if (matchSort === "olbg-stars-desc") {
        return (b.olbg?.stars ?? -1) - (a.olbg?.stars ?? -1);
      }

      if (matchSort === "sources-desc") {
        return sourceCount(b) - sourceCount(a);
      }

      const aPinned = pinned.includes(a.matchKey) ? 1 : 0;
      const bPinned = pinned.includes(b.matchKey) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return a.homeTeam.localeCompare(b.homeTeam);
    });

    return rows;
  }, [matches, pinned, matchFilter, matchSort]);

  const ensureFirstSlipAndAdd = (row: CombinedMatchRow) => {
    if (slips.length === 0) {
      const created = addSlip();
      if (!created) return;
      addSelectionToSlip(created.id, {
        matchKey: row.matchKey,
        label: `${row.homeTeam} vs ${row.awayTeam}`,
      });
      return;
    }

    const firstSlip = slips[0];
    if (!firstSlip) return;

    addSelectionToSlip(firstSlip.id, {
      matchKey: row.matchKey,
      label: `${row.homeTeam} vs ${row.awayTeam}`,
    });
  };

  const loadForebetStats = async (row: CombinedMatchRow) => {
    if (row.forebetStats) return;

    setLoadingStatsByKey((prev) => ({ ...prev, [row.matchKey]: true }));
    try {
      const r = await apiFetch(`/api/forebet/match/${encodeURIComponent(row.matchKey)}`);
      if (!r.ok) return;
      const stats = (await r.json()) as ForebetMatchStats;
      const { matchKey: _ignoredMatchKey, ...restStats } = stats;

      setMatches((prev) =>
        prev.map((m) =>
          m.matchKey === row.matchKey
            ? {
                ...m,
                forebetStats: {
                  matchKey: m.matchKey,
                  ...restStats,
                },
              }
            : m,
        ),
      );
    } catch {
      // Ignore detail fetch errors to keep list usable.
    } finally {
      setLoadingStatsByKey((prev) => ({ ...prev, [row.matchKey]: false }));
    }
  };

  const loadDetails = async (matchKey: string) => {
    if (details[matchKey] || loadingDetails[matchKey]) return;

    setLoadingDetails((prev) => ({ ...prev, [matchKey]: true }));
    try {
      const r = await apiFetch(`/api/forebet/details/${encodeURIComponent(matchKey)}`);
      const data = r.ok ? ((await r.json()) as ForebetDeepDetails) : null;
      setDetails((prev) => ({ ...prev, [matchKey]: data }));
    } catch {
      setDetails((prev) => ({ ...prev, [matchKey]: null }));
    } finally {
      setLoadingDetails((prev) => ({ ...prev, [matchKey]: false }));
    }
  };

  const visibleMatches =
    tab === 0 ? arrangedMatches : arrangedMatches.filter((m) => pinned.includes(m.matchKey));

  const filteredMatches = visibleMatches.filter((m) => {
    if (filter.onlyVitibet && !m.vitibet) return false;
    if (filter.onlyOLBG && !m.olbg) return false;

    if (filter.leagues.length > 0) {
      const leagueName = m.league.split(" - ")[1] ?? m.league;
      if (!filter.leagues.includes(leagueName)) return false;
    }

    if (m.vitibet) {
      if ((m.vitibet.percentHome ?? 0) < filter.vitibet.homeMin) return false;
      if ((m.vitibet.percentDraw ?? 0) < filter.vitibet.drawMin) return false;
      if ((m.vitibet.percentAway ?? 0) < filter.vitibet.awayMin) return false;
    }

    if (m.forebet) {
      if ((m.forebet.percentHome ?? 0) < filter.forebet.homeMin) return false;
      if ((m.forebet.percentDraw ?? 0) < filter.forebet.drawMin) return false;
      if ((m.forebet.percentAway ?? 0) < filter.forebet.awayMin) return false;
    }

    return true;
  });

  const sendBotMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatSending) return;

    const now = new Date().toISOString();
      const userMessage: ChatMessage = {
        id: `${crypto.randomUUID()}`,
      role: "user",
      text,
      bot: botChoice,
      createdAt: now,
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setChatSending(true);

    try {
      const r = await apiFetch("/api/bot/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: "main-ui",
          bot: botChoice,
          message: text,
        }),
      });

      if (!r.ok) {
        throw new Error("Bot API request failed");
      }

      const payload = (await r.json()) as { reply?: string };
      const assistantMessage: ChatMessage = {
        id: `${crypto.randomUUID()}`,
        role: "assistant",
        text: payload.reply?.trim() || "Bot did not return a response.",
        bot: botChoice,
        createdAt: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const assistantMessage: ChatMessage = {
        id: `${crypto.randomUUID()}`,
        role: "assistant",
        text: "Bot request failed. Please verify backend and provider settings.",
        bot: botChoice,
        createdAt: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setChatSending(false);
    }
  };

  const runSiteSearches = async () => {
    setSiteSearchError(null);
    setSiteSearchSummary(null);
    setSiteSearchLoading(true);

    try {
      const [forebetRes, olbgRes, vitibetRes] = await Promise.all([
        apiFetch("/api/forebet/today"),
        apiFetch("/api/olbg/today"),
        apiFetch("/api/vitibet/today"),
      ]);

      if (!forebetRes.ok || !olbgRes.ok || !vitibetRes.ok) {
        throw new Error("Failed to run one or more source searches");
      }

      const [forebetRows, olbgRows, vitibetRows] = (await Promise.all([
        forebetRes.json(),
        olbgRes.json(),
        vitibetRes.json(),
      ])) as [Array<unknown>, Array<unknown>, Array<unknown>];

      setSiteSearchSummary(
        `Search complete: Forebet ${forebetRows.length}, OLBG ${olbgRows.length}, Vitibet ${vitibetRows.length}`,
      );
    } catch {
      setSiteSearchError("Site search failed. Check backend connection and try again.");
    } finally {
      setSiteSearchLoading(false);
    }
  };

  const loadPairSuggestions = async () => {
    setPairError(null);
    setPairLoading(true);

    try {
      const r = await apiFetch("/api/matches/pair-suggestions");
      if (!r.ok) throw new Error("Failed to load pair suggestions");
      const data = (await r.json()) as PairSuggestion[];
      setPairSuggestions(data);
    } catch {
      setPairError("Could not load pair suggestions.");
    } finally {
      setPairLoading(false);
    }
  };

  const approvePair = async (item: PairSuggestion) => {
    const key = `${item.source}:${item.candidateId}`;
    setApprovingPairs((prev) => ({ ...prev, [key]: true }));

    try {
      const r = await apiFetch("/api/matches/pair-suggestions/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: item.source,
          candidateId: item.candidateId,
          targetId: item.targetId,
        }),
      });
      if (!r.ok) throw new Error("approve failed");

      setPairSuggestions((prev) => prev.filter((s) => !(s.source === item.source && s.candidateId === item.candidateId)));

      const combinedRes = await apiFetch("/api/matches/combined");
      if (combinedRes.ok) {
        const refreshed = (await combinedRes.json()) as ApiCombinedMatch[];
        setMatches(normalizeCombined(refreshed));
      }
    } catch {
      setPairError("Could not approve pair. Try again.");
    } finally {
      setApprovingPairs((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 4,
          background: "linear-gradient(135deg, #f8fafb 0%, #eef3f7 55%, #edf1f5 100%)",
          border: "1px solid #d8e1e8",
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="h4" gutterBottom>
              Nordic Match Center
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
              Combined daily picks from Forebet, OLBG and Vitibet. Pin key matches and build your betslips.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip icon={<TravelExplore />} label="Source aggregation" size="small" />
              <Chip icon={<RocketLaunch />} label="Fast slip building" size="small" />
              <Chip icon={<SmartToy />} label="Bot mode" size="small" />
            </Stack>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
            <Button
              variant="outlined"
              startIcon={<Search />}
              disabled={siteSearchLoading}
              onClick={() => {
                void runSiteSearches();
              }}
            >
              {siteSearchLoading ? "Running searches..." : "Run site searches"}
            </Button>
            <Button
              variant={botOpen ? "contained" : "outlined"}
              startIcon={<SmartToy />}
              onClick={() => setBotOpen((v) => !v)}
            >
              {botOpen ? "Hide bot" : "Open bot"}
            </Button>
            <Button
              variant={pairReviewOpen ? "contained" : "outlined"}
              startIcon={<Hub />}
              onClick={() => {
                const next = !pairReviewOpen;
                setPairReviewOpen(next);
                if (next) {
                  void loadPairSuggestions();
                }
              }}
            >
              {pairReviewOpen ? "Hide pair review" : "Review pairs"}
            </Button>
            <LogoutButton />
          </Stack>
        </Stack>

        {siteSearchSummary && (
          <Alert sx={{ mt: 2 }} severity="success">
            {siteSearchSummary}
          </Alert>
        )}
        {siteSearchError && (
          <Alert sx={{ mt: 2 }} severity="error">
            {siteSearchError}
          </Alert>
        )}
      </Paper>

      {pairReviewOpen && (
        <Paper sx={{ p: 2, mb: 3, borderRadius: 4, border: "1px solid #d8e1e8" }}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Hub fontSize="small" />
              <Typography variant="h6">Pair Review</Typography>
              <Chip size="small" label={`Suggestions: ${pairSuggestions.length}`} variant="outlined" />
            </Stack>

            <Button
              variant="text"
              startIcon={<Refresh />}
              disabled={pairLoading}
              onClick={() => {
                void loadPairSuggestions();
              }}
            >
              Refresh suggestions
            </Button>
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Approve uncertain source matches when two rows likely represent the same game.
          </Typography>

          {pairError && <Alert severity="error" sx={{ mb: 2 }}>{pairError}</Alert>}

          {pairLoading ? (
            <Typography variant="body2" color="text.secondary">Loading suggestions...</Typography>
          ) : pairSuggestions.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No uncertain pairs right now.</Typography>
          ) : (
            <Stack spacing={1.5}>
              {pairSuggestions.map((item) => {
                const key = `${item.source}:${item.candidateId}`;
                const approving = Boolean(approvingPairs[key]);

                return (
                  <Paper key={key} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} justifyContent="space-between">
                      <Box>
                        <Typography variant="body2">
                          <strong>{item.candidateHomeTeam} vs {item.candidateAwayTeam}</strong> ({item.source.toUpperCase()})
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Candidate time: {item.candidateKickoffTime ?? "N/A"} {"->"} Suggested match: {item.targetHomeTeam} vs {item.targetAwayTeam} ({item.targetKickoffTime ?? "N/A"})
                        </Typography>
                      </Box>

                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip size="small" label={`Score ${item.score.toFixed(2)}`} variant="outlined" />
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<TaskAlt />}
                          disabled={approving}
                          onClick={() => {
                            void approvePair(item);
                          }}
                        >
                          {approving ? "Approving..." : "Approve merge"}
                        </Button>
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Paper>
      )}

      {botOpen && (
        <Paper sx={{ p: 2, mb: 3, borderRadius: 4, border: "1px solid #d8e1e8" }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 240 }}>
              {botIcon(botChoice)}
              <Typography variant="h6">Bot Console</Typography>
            </Stack>

            <Select
              size="small"
              value={botChoice}
              onChange={(e) => setBotChoice(e.target.value as BotChoice)}
              sx={{ minWidth: 210 }}
            >
              <MenuItem value="general-free">General Free Bot</MenuItem>
              <MenuItem value="football-analyst">Football Analyst</MenuItem>
              <MenuItem value="sharp-scout">Sharp Scout</MenuItem>
            </Select>
          </Stack>

          <Paper
            variant="outlined"
            sx={{
              mt: 2,
              p: 1.5,
              borderRadius: 3,
              maxHeight: 280,
              overflowY: "auto",
              bgcolor: "#f7fafc",
            }}
          >
            {chatMessages.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Choose a bot, write a message, and you will see responses in this same panel.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {chatMessages.map((m) => (
                  <Box
                    key={m.id}
                    sx={{
                      alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                      maxWidth: "88%",
                      px: 1.2,
                      py: 0.8,
                      borderRadius: 2,
                      bgcolor: m.role === "user" ? "#dbe8f2" : "#ecf1f5",
                      border: "1px solid #d2dce5",
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {m.role === "user" ? "You" : BOT_LABELS[m.bot]}
                    </Typography>
                    <Typography variant="body2">{m.text}</Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Type a message to the selected bot"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void sendBotMessage();
                }
              }}
            />
            <Button
              variant="contained"
              startIcon={<Send />}
              disabled={!chatInput.trim() || chatSending}
              onClick={() => {
                void sendBotMessage();
              }}
            >
              Send
            </Button>
          </Stack>
        </Paper>
      )}

      {error && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: "#fff4e5" }}>
          <Typography color="error">{error}</Typography>
        </Paper>
      )}

      <MatchFilters filter={filter} setFilter={setFilter} leagues={leagues} />

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Today" />
        <Tab label="Pinned" />
        {isAdmin && <Tab label="Admin Memory" />}
      </Tabs>

      {isAdmin && tab === 2 && <AdminMemoryPanel />}

      <Paper sx={{ p: 2, mb: 2, borderRadius: 3, border: "1px solid #d8e1e8" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ flex: 1 }}>
            <Select
              size="small"
              value={matchFilter}
              onChange={(e) => setMatchFilter(e.target.value as MatchFilterMode)}
              sx={{ minWidth: 240 }}
            >
              <MenuItem value="all">All games</MenuItem>
              <MenuItem value="with-vitibet">Only games available in Vitibet</MenuItem>
              <MenuItem value="only-olbg">Only games that exist only in OLBG</MenuItem>
              <MenuItem value="only-forebet">Only games that exist only in Forebet</MenuItem>
            </Select>

            <Select
              size="small"
              value={matchSort}
              onChange={(e) => setMatchSort(e.target.value as MatchSortMode)}
              sx={{ minWidth: 240 }}
            >
              <MenuItem value="pinned-first">Sort: pinned first</MenuItem>
              <MenuItem value="kickoff-asc">Sort: kickoff time (ascending)</MenuItem>
              <MenuItem value="home-team-asc">Sort: home team A-Z</MenuItem>
              <MenuItem value="olbg-stars-desc">Sort: OLBG stars (high to low)</MenuItem>
              <MenuItem value="sources-desc">Sort: source coverage (most sources first)</MenuItem>
            </Select>
          </Stack>

          <Chip
            icon={<TravelExplore />}
            label={`Visible games: ${filteredMatches.length}`}
            variant="outlined"
          />
        </Stack>
      </Paper>

      {tab !== 2 && filteredMatches.map((row) => (
        <MatchRow
          key={row.matchKey}
          row={row}
          pinned={pinned.includes(row.matchKey)}
          loadingStats={Boolean(loadingStatsByKey[row.matchKey])}
          details={details[row.matchKey]}
          loadingDetails={Boolean(loadingDetails[row.matchKey])}
          onTogglePin={() => toggle(row.matchKey)}
          onExpandAndLoad={() => loadForebetStats(row)}
          onLoadDetails={loadDetails}
          onAddToSlip={() => ensureFirstSlipAndAdd(row)}
        />
      ))}

      {tab !== 2 && <Divider sx={{ my: 4 }} />}

      {tab !== 2 && <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Typography variant="h5">Betslips</Typography>
        <Button variant="contained" onClick={() => addSlip()}>
          New slip
        </Button>
      </Stack>}

      {tab !== 2 && <Stack spacing={2}>
        {slips.map((slip) => (
          <Paper
            key={slip.id}
            sx={{ p: 2, borderRadius: 3 }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const raw = e.dataTransfer.getData("application/json");
              if (!raw) return;
              const parsed = JSON.parse(raw) as {
                fromSlipId: string;
                selection: { matchKey: string; label: string };
              };
              moveSelection(parsed.fromSlipId, slip.id, parsed.selection);
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h6">{slip.name}</Typography>
              <Button size="small" onClick={() => duplicateSlip(slip.id)}>
                Duplicate
              </Button>
            </Stack>

            <Stack spacing={1}>
              {slip.selections.map((selection) => (
                <Box
                  key={selection.matchKey}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "application/json",
                      JSON.stringify({ fromSlipId: slip.id, selection }),
                    );
                  }}
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    p: 1,
                    borderRadius: 2,
                    bgcolor: "#f5f8ff",
                    border: "1px solid #d9e2ff",
                  }}
                >
                  <Typography variant="body2">{selection.label}</Typography>
                  <Button size="small" color="error" onClick={() => removeSelection(slip.id, selection.matchKey)}>
                    Remove
                  </Button>
                </Box>
              ))}
              {slip.selections.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Drop matches here from another slip or add from list.
                </Typography>
              )}
            </Stack>
          </Paper>
        ))}
      </Stack>}
    </Container>
  );
}
