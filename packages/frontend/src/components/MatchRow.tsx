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
import type { CombinedMatchRow } from "../types";

type MatchRowProps = {
  row: CombinedMatchRow;
  pinned: boolean;
  loadingStats: boolean;
  onTogglePin: () => void;
  onExpandAndLoad: () => Promise<void>;
  onAddToSlip: () => void;
};

function pctLabel(v?: number) {
  return typeof v === "number" ? `${v}%` : "-";
}

export function MatchRow({
  row,
  pinned,
  loadingStats,
  onTogglePin,
  onExpandAndLoad,
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
        </Collapse>
      </CardContent>
    </Card>
  );
}
