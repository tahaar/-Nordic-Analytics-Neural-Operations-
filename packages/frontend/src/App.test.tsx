import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App } from "./App";

const fetchMock = vi.fn();

const combinedPayload = [
  {
    id: "arsenal-vs-chelsea",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    kickoffTime: "19:30",
    forebet: {
      predictedScore: "2-1",
      percentages: { home: 51, draw: 27, away: 22 },
    },
    olbg: { stars: 4, popularPick: "Home win" },
    vitibet: { recommendation: "1", percentages: { home: 49, draw: 25, away: 26 } },
  },
  {
    id: "inter-vs-milan",
    homeTeam: "Inter",
    awayTeam: "Milan",
    kickoffTime: "21:00",
    forebet: {
      predictedScore: "1-1",
      percentages: { home: 33, draw: 34, away: 33 },
    },
    olbg: { stars: 3, popularPick: "Draw" },
    vitibet: { recommendation: "X", percentages: { home: 34, draw: 35, away: 31 } },
  },
];

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads combined matches", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => combinedPayload,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Arsenal vs Chelsea")).toBeInTheDocument();
    });
  });

  it("shows pinned matches in pinned tab", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => combinedPayload,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Arsenal vs Chelsea")).toBeInTheDocument();
      expect(screen.getByText("Inter vs Milan")).toBeInTheDocument();
    });

    const pinButtons = screen.getAllByLabelText("pin");
    const secondPin = pinButtons[1];
    expect(secondPin).toBeDefined();
    if (!secondPin) throw new Error("Second pin button not found");
    fireEvent.click(secondPin);
    fireEvent.click(screen.getByRole("tab", { name: "Pinned" }));

    expect(screen.getByText("Inter vs Milan")).toBeInTheDocument();
    expect(screen.queryByText("Arsenal vs Chelsea")).not.toBeInTheDocument();
  });

  it("moves selection between slips by drop", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => combinedPayload,
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          matchKey: "arsenal-vs-chelsea",
          xgHome: 1.4,
          xgAway: 1.1,
        }),
      });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Arsenal vs Chelsea")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "New slip" }));
    await waitFor(() => {
      expect(screen.getByText("Slip 1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "New slip" }));
    await waitFor(() => {
      expect(screen.getByText("Slip 2")).toBeInTheDocument();
    });

    const expandButtons = screen.getAllByLabelText("expand");
    const firstExpand = expandButtons[0];
    expect(firstExpand).toBeDefined();
    if (!firstExpand) throw new Error("Expand button not found");
    fireEvent.click(firstExpand);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add to betslip" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Add to betslip" }));

    const slip1Paper = screen.getByText("Slip 1").closest(".MuiPaper-root") as HTMLElement;
    const slip2Paper = screen.getByText("Slip 2").closest(".MuiPaper-root") as HTMLElement;

    const selectionNode = within(slip1Paper).getByText("Arsenal vs Chelsea");
    const draggableNode = selectionNode.closest("[draggable='true']") as HTMLElement;

    const dataTransfer = {
      data: "",
      setData: (_type: string, value: string) => {
        dataTransfer.data = value;
      },
      getData: (_type: string) => dataTransfer.data,
    };

    fireEvent.dragStart(draggableNode, { dataTransfer });
    fireEvent.drop(slip2Paper, { dataTransfer });

    await waitFor(() => {
      expect(within(slip2Paper).getByText("Arsenal vs Chelsea")).toBeInTheDocument();
      expect(within(slip1Paper).queryByText("Arsenal vs Chelsea")).not.toBeInTheDocument();
    });
  });
});
