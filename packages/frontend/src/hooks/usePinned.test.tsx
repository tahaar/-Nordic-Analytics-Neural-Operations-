import { act, renderHook } from "@testing-library/react";
import { usePinned } from "./usePinned";

describe("usePinned", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("toggles pinned matches and persists value", () => {
    const { result } = renderHook(() => usePinned());

    act(() => {
      result.current.toggle("match-1");
    });

    expect(result.current.pinned).toContain("match-1");
    expect(localStorage.getItem("pinnedMatches")).toContain("match-1");

    act(() => {
      result.current.toggle("match-1");
    });

    expect(result.current.pinned).not.toContain("match-1");
  });
});
