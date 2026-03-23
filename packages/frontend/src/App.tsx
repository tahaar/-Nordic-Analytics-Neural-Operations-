import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Container,
  Divider,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { MatchRow } from "./components/MatchRow";
import { useBetslips } from "./hooks/useBetslips";
import { usePinned } from "./hooks/usePinned";
import type { ApiCombinedMatch, CombinedMatchRow, ForebetMatchStats, Tip } from "./types";

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

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Nordic Match Center
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Combined daily picks from Forebet, OLBG and Vitibet. Pin key matches and build your betslips.
      </Typography>

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
