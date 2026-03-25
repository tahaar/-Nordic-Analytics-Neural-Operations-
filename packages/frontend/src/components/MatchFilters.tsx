import React from "react";
import {
  Box,
  Typography,
  Slider,
  Checkbox,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormGroup,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

type ProbFilter = { homeMin: number; drawMin: number; awayMin: number };

export type MatchFilterState = {
  vitibet: ProbFilter;
  forebet: ProbFilter;
  leagues: string[];
  onlyVitibet: boolean;
  onlyOLBG: boolean;
};

type Props = {
  filter: MatchFilterState;
  setFilter: React.Dispatch<React.SetStateAction<MatchFilterState>>;
  leagues: Record<string, string[]>;
};

export function MatchFilters({ filter, setFilter, leagues }: Props) {
  const updateProb = (source: "vitibet" | "forebet", field: keyof ProbFilter, value: number) => {
    setFilter((prev) => ({
      ...prev,
      [source]: { ...prev[source], [field]: value },
    }));
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Filters
      </Typography>

      {/* Vitibet */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Vitibet probabilities</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography gutterBottom>Home &ge; {filter.vitibet.homeMin}%</Typography>
          <Slider
            value={filter.vitibet.homeMin}
            onChange={(_e, v) => updateProb("vitibet", "homeMin", v as number)}
            min={0}
            max={100}
          />

          <Typography gutterBottom>Draw &ge; {filter.vitibet.drawMin}%</Typography>
          <Slider
            value={filter.vitibet.drawMin}
            onChange={(_e, v) => updateProb("vitibet", "drawMin", v as number)}
            min={0}
            max={100}
          />

          <Typography gutterBottom>Away &ge; {filter.vitibet.awayMin}%</Typography>
          <Slider
            value={filter.vitibet.awayMin}
            onChange={(_e, v) => updateProb("vitibet", "awayMin", v as number)}
            min={0}
            max={100}
          />
        </AccordionDetails>
      </Accordion>

      {/* Forebet */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Forebet probabilities</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography gutterBottom>Home &ge; {filter.forebet.homeMin}%</Typography>
          <Slider
            value={filter.forebet.homeMin}
            onChange={(_e, v) => updateProb("forebet", "homeMin", v as number)}
            min={0}
            max={100}
          />

          <Typography gutterBottom>Draw &ge; {filter.forebet.drawMin}%</Typography>
          <Slider
            value={filter.forebet.drawMin}
            onChange={(_e, v) => updateProb("forebet", "drawMin", v as number)}
            min={0}
            max={100}
          />

          <Typography gutterBottom>Away &ge; {filter.forebet.awayMin}%</Typography>
          <Slider
            value={filter.forebet.awayMin}
            onChange={(_e, v) => updateProb("forebet", "awayMin", v as number)}
            min={0}
            max={100}
          />
        </AccordionDetails>
      </Accordion>

      {/* Source + league filters */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Leagues &amp; source filters</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FormGroup sx={{ mb: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={filter.onlyVitibet}
                  onChange={(e) =>
                    setFilter((prev) => ({ ...prev, onlyVitibet: e.target.checked }))
                  }
                />
              }
              label="Only matches with Vitibet tips"
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={filter.onlyOLBG}
                  onChange={(e) =>
                    setFilter((prev) => ({ ...prev, onlyOLBG: e.target.checked }))
                  }
                />
              }
              label="Only matches with OLBG tips"
            />
          </FormGroup>

          {Object.keys(leagues).map((country) => (
            <Accordion key={country} disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="body2">{country}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {(leagues[country] ?? []).map((lg) => (
                  <FormControlLabel
                    key={lg}
                    control={
                      <Checkbox
                        size="small"
                        checked={filter.leagues.includes(lg)}
                        onChange={(e) => {
                          setFilter((prev) => ({
                            ...prev,
                            leagues: e.target.checked
                              ? [...prev.leagues, lg]
                              : prev.leagues.filter((x) => x !== lg),
                          }));
                        }}
                      />
                    }
                    label={lg}
                  />
                ))}
              </AccordionDetails>
            </Accordion>
          ))}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
