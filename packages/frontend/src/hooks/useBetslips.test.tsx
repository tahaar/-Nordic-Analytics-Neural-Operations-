import { act, renderHook } from "@testing-library/react";
import { useBetslips } from "./useBetslips";

describe("useBetslips", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates and duplicates slips", () => {
    const { result } = renderHook(() => useBetslips());

    act(() => {
      result.current.addSlip();
    });

    expect(result.current.slips).toHaveLength(1);

    const id = result.current.slips[0]?.id;
    expect(id).toBeDefined();

    act(() => {
      result.current.duplicateSlip(id!);
    });

    expect(result.current.slips).toHaveLength(2);
  });

  it("adds and removes selection", () => {
    const { result } = renderHook(() => useBetslips());

    let slipId = "";
    act(() => {
      const slip = result.current.addSlip();
      slipId = slip?.id ?? "";
    });

    act(() => {
      result.current.addSelectionToSlip(slipId, { matchKey: "m1", label: "A vs B" });
    });

    expect(result.current.slips[0]?.selections).toHaveLength(1);

    act(() => {
      result.current.removeSelection(slipId, "m1");
    });

    expect(result.current.slips[0]?.selections).toHaveLength(0);
  });
});
