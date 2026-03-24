import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { ExpandMore, Star, StarBorder } from "@mui/icons-material";
import type { CombinedMatchRow, ForebetDeepDetails } from "../types";

type MatchRowProps = {
  row: CombinedMatchRow;
  pinned: boolean;
  loadingStats: boolean;
  details?: ForebetDeepDetails | null;
  loadingDetails: boolean;
  onTogglePin: () => void;
  onExpandAndLoad: () => Promise<void>;
  onLoadDetails: (matchKey: string) => Promise<void>;
  onAddToSlip: () => void;
};

function pctLabel(v?: number) {
  return typeof v === "number" ? `${v}%` : "-";
}

export function MatchRow({
  row,
  pinned,
  loadingStats,
  details,
  loadingDetails,
  onTogglePin,
  onExpandAndLoad,
  onLoadDetails,
  onAddToSlip,
}: MatchRowProps) {
  const [open, setOpen] = useState(false);

  const handleExpand = async () => {
    const next = !open;
    setOpen(next);
    if (next) await onExpandAndLoad();
  };

  return (
    <Card sx={{ mb: 2, borderRadius: 3 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
          <Box>
            <Typography variant="h6">
              {row.homeTeam} vs {row.awayTeam}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {row.league} | {row.kickoff}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <IconButton aria-label="pin" onClick={onTogglePin}>
              {pinned ? <Star color="warning" /> : <StarBorder />}
            </IconButton>
            <IconButton aria-label="expand" onClick={handleExpand}>
              <ExpandMore />
            </IconButton>
          </Stack>
        </Stack>

        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 2 }}>
          <Chip size="small" label={`Forebet ${pctLabel(row.forebet?.percentHome)}-${pctLabel(row.forebet?.percentDraw)}-${pctLabel(row.forebet?.percentAway)}`} />
          <Chip size="small" label={`OLBG stars ${row.olbg?.stars ?? "-"}`} />
          <Chip size="small" label={`Vitibet ${pctLabel(row.vitibet?.percentHome)}-${pctLabel(row.vitibet?.percentDraw)}-${pctLabel(row.vitibet?.percentAway)}`} />
          {row.tips.map((tip) => (
            <Chip key={tip.id} size="small" color="primary" variant="outlined" label={`${tip.source.toUpperCase()}: ${tip.tipValue || tip.tipType}`} />
          ))}
        </Stack>

        <Collapse in={open}>
          <Divider sx={{ my: 2 }} />

          {loadingStats && <Typography variant="body2">Loading detailed stats...</Typography>}

          {row.forebetStats ? (
            <Stack spacing={1} sx={{ mb: 2 }}>
              <Typography variant="subtitle1">Forebet match stats</Typography>
              <Typography variant="body2">
                xG: {row.forebetStats.xgHome ?? "-"} - {row.forebetStats.xgAway ?? "-"}
              </Typography>
              <Typography variant="body2">
                Shots: {row.forebetStats.shotsHome ?? "-"} - {row.forebetStats.shotsAway ?? "-"}
              </Typography>
              <Typography variant="body2">
                Possession: {pctLabel(row.forebetStats.possessionHome)} - {pctLabel(row.forebetStats.possessionAway)}
              </Typography>
              <Typography variant="body2">
                Form: {row.forebetStats.formHome ?? "-"} | {row.forebetStats.formAway ?? "-"}
              </Typography>
            </Stack>
          ) : (
            !loadingStats && <Typography variant="body2">No detailed stats loaded.</Typography>
          )}

          <Button variant="contained" onClick={onAddToSlip}>
            Add to betslip
          </Button>
          <Button
            size="small"
            variant="outlined"
            sx={{ ml: 1 }}
            onClick={() => {
              void onLoadDetails(row.matchKey);
            }}
          >
            Nayta tarkemmat statsit
          </Button>

          {details && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1">Tarkemmat Forebet-statsit</Typography>

              <Typography variant="body2">
                Sarjasijoitus: {details.leaguePositionHome ?? "-"} / {details.leaguePositionAway ?? "-"}
              </Typography>

              <Typography variant="body2">
                xG: {details.xgHome ?? "-"} / {details.xgAway ?? "-"}
              </Typography>

              <Typography variant="body2">
                Laukaukset: {details.shotsHome ?? "-"} / {details.shotsAway ?? "-"}
              </Typography>

              <Typography variant="body2">
                Laukaukset maalia kohti: {details.shotsOnTargetHome ?? "-"} / {details.shotsOnTargetAway ?? "-"}
              </Typography>

              <Typography variant="body2">
                Pallonhallinta: {details.possessionHome ?? "-"} / {details.possessionAway ?? "-"}
              </Typography>

              <Typography variant="body2">
                Vaaralliset hyokkaykset: {details.dangerousHome ?? "-"} / {details.dangerousAway ?? "-"}
              </Typography>

              <Typography variant="body2" sx={{ mt: 1 }}>
                Form: {details.formHome ?? "-"} vs {details.formAway ?? "-"}
              </Typography>

              <Typography variant="body2" sx={{ mt: 1 }}>
                Keskinaiset:
              </Typography>
              <ul>
                {details.h2h.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </Box>
          )}

          {loadingDetails && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Ladataan tarkempia tietoja...
            </Typography>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
}
