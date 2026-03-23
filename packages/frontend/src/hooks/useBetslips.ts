import { useEffect, useState } from "react";
import type { BetSelection, BetSlip } from "../types";

const BETSLIPS_STORAGE_KEY = "betslips";

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `slip-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readSlips(): BetSlip[] {
  try {
    const raw = localStorage.getItem(BETSLIPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is { id: string; name: string; selections: BetSelection[] } => {
        return (
          typeof item === "object" &&
          item !== null &&
          typeof (item as { id?: unknown }).id === "string" &&
          typeof (item as { name?: unknown }).name === "string" &&
          Array.isArray((item as { selections?: unknown }).selections)
        );
      })
      .map((item) => ({
        id: item.id,
        name: item.name,
        selections: item.selections.filter(
          (s): s is BetSelection =>
            typeof s === "object" &&
            s !== null &&
            typeof (s as { matchKey?: unknown }).matchKey === "string" &&
            typeof (s as { label?: unknown }).label === "string",
        ),
      }));
  } catch {
    return [];
  }
}

export function useBetslips() {
  const [slips, setSlips] = useState<BetSlip[]>([]);

  useEffect(() => {
    setSlips(readSlips());
  }, []);

  const save = (next: BetSlip[]) => {
    setSlips(next);
    localStorage.setItem(BETSLIPS_STORAGE_KEY, JSON.stringify(next));
  };

  const addSlip = () => {
    const next = [...slips, { id: createId(), name: `Slip ${slips.length + 1}`, selections: [] }];
    save(next);
    return next[next.length - 1];
  };

  const duplicateSlip = (id: string) => {
    const source = slips.find((s) => s.id === id);
    if (!source) return;

    save([
      ...slips,
      {
        id: createId(),
        name: `${source.name} Copy`,
        selections: [...source.selections],
      },
    ]);
  };

  const addSelectionToSlip = (slipId: string, selection: BetSelection) => {
    const next = slips.map((s) => {
      if (s.id !== slipId) return s;
      if (s.selections.some((x) => x.matchKey === selection.matchKey)) return s;
      return { ...s, selections: [...s.selections, selection] };
    });
    save(next);
  };

  const moveSelection = (fromSlipId: string, toSlipId: string, selection: BetSelection) => {
    if (fromSlipId === toSlipId) return;

    const withoutSource = slips.map((s) =>
      s.id === fromSlipId
        ? { ...s, selections: s.selections.filter((x) => x.matchKey !== selection.matchKey) }
        : s,
    );

    const withTarget = withoutSource.map((s) => {
      if (s.id !== toSlipId) return s;
      if (s.selections.some((x) => x.matchKey === selection.matchKey)) return s;
      return { ...s, selections: [...s.selections, selection] };
    });

    save(withTarget);
  };

  const removeSelection = (slipId: string, matchKey: string) => {
    const next = slips.map((s) =>
      s.id === slipId
        ? { ...s, selections: s.selections.filter((x) => x.matchKey !== matchKey) }
        : s,
    );
    save(next);
  };

  return {
    slips,
    addSlip,
    duplicateSlip,
    addSelectionToSlip,
    moveSelection,
    removeSelection,
  };
}
