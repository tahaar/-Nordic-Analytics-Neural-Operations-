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
  Psychology,
  RocketLaunch,
  Search,
  Send,
  SmartToy,
  TravelExplore,
} from "@mui/icons-material";
import { MatchRow } from "./components/MatchRow";
import { useBetslips } from "./hooks/useBetslips";
import { usePinned } from "./hooks/usePinned";
import type { ApiCombinedMatch, CombinedMatchRow, ForebetMatchStats, Tip } from "./types";

type BotChoice = "general-free" | "football-analyst" | "sharp-scout";
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  bot: BotChoice;
  createdAt: string;
};

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

export function App() {
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
  const { pinned, toggle } = usePinned();
  const { slips, addSlip, duplicateSlip, addSelectionToSlip, moveSelection, removeSelection } = useBetslips();

  useEffect(() => {
    const load = async () => {
      setError(null);
      try {
        const r = await fetch("/api/matches/combined");
        if (!r.ok) throw new Error("Failed to load matches");
        const data = (await r.json()) as ApiCombinedMatch[];
        setMatches(normalizeCombined(data));
      } catch {
        setError("Could not load combined matches");
      }
    };

    void load();
  }, []);

  const sortedMatches = useMemo(() => {
    const pinnedRows = matches.filter((m) => pinned.includes(m.matchKey));
    const normalRows = matches.filter((m) => !pinned.includes(m.matchKey));
    return [...pinnedRows, ...normalRows];
  }, [matches, pinned]);

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
      const r = await fetch(`/api/forebet/match/${encodeURIComponent(row.matchKey)}`);
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

  const visibleMatches = tab === 0 ? sortedMatches : sortedMatches.filter((m) => pinned.includes(m.matchKey));

  const sendBotMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatSending) return;

    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: `${Date.now()}-u`,
      role: "user",
      text,
      bot: botChoice,
      createdAt: now,
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setChatSending(true);

    try {
      const r = await fetch("/api/bot/chat", {
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
        id: `${Date.now()}-a`,
        role: "assistant",
        text: payload.reply?.trim() || "Bot did not return a response.",
        bot: botChoice,
        createdAt: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-a`,
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
        fetch("/api/forebet/today"),
        fetch("/api/olbg/today"),
        fetch("/api/vitibet/today"),
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

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Today" />
        <Tab label="Pinned" />
      </Tabs>

      {visibleMatches.map((row) => (
        <MatchRow
          key={row.matchKey}
          row={row}
          pinned={pinned.includes(row.matchKey)}
          loadingStats={Boolean(loadingStatsByKey[row.matchKey])}
          onTogglePin={() => toggle(row.matchKey)}
          onExpandAndLoad={() => loadForebetStats(row)}
          onAddToSlip={() => ensureFirstSlipAndAdd(row)}
        />
      ))}

      <Divider sx={{ my: 4 }} />

      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Typography variant="h5">Betslips</Typography>
        <Button variant="contained" onClick={() => addSlip()}>
          New slip
        </Button>
      </Stack>

      <Stack spacing={2}>
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
      </Stack>
    </Container>
  );
}
