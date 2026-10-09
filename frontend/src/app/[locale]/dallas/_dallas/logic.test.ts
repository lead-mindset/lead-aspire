import { DEFAULT_STRATEGY, type RecKey } from "./data";
import {
  baseStrategy,
  blockReason,
  countChanges,
  firstOpenPhase,
  INITIAL_STATE,
  nextScreen,
  projectImpact,
  reviseAt,
  toggleLimited,
} from "./logic";

describe("toggleLimited", () => {
  it("adds, removes, and stops adding at the limit", () => {
    expect(toggleLimited(["a"], "b", 3)).toEqual(["a", "b"]);
    expect(toggleLimited(["a", "b"], "a", 3)).toEqual(["b"]);
    expect(toggleLimited(["a", "b", "c"], "d", 3)).toEqual(["a", "b", "c"]);
    expect(toggleLimited(["a", "b", "c"], "c", 3)).toEqual(["a", "b"]);
  });
});

describe("projectImpact", () => {
  it("is empty with no recommendations", () => {
    expect(projectImpact([])).toEqual({ fx: [0, 0, 0, 0], time: null });
  });

  it("sums effects and sizes time by the slowest recommendation", () => {
    expect(projectImpact(["hr"])).toEqual({ fx: [5, 2, 1, 3], time: "short" });
    expect(projectImpact(["mon", "gov"])).toEqual({
      fx: [5, 4, 0, 17],
      time: "medium",
    });
    expect(projectImpact(["opt", "exp"]).time).toBe("long");
  });
});

describe("Respond revisions", () => {
  const base: RecKey[] = ["mon", "opt", "exp"];

  it("falls back to the default strategy when Advise was skipped", () => {
    expect(baseStrategy({ strategy: [] })).toEqual(DEFAULT_STRATEGY);
    expect(baseStrategy({ strategy: base })).toEqual(base);
  });

  it("counts changed positions", () => {
    expect(countChanges(base, base)).toBe(0);
    expect(countChanges(base, ["mon", "gov", ""])).toBe(2);
  });

  it("allows up to two changes", () => {
    const one = reviseAt(base, base, 0, "gov");
    expect(one).toEqual(["gov", "opt", "exp"]);
    const two = reviseAt(base, one!, 2, "");
    expect(two).toEqual(["gov", "opt", ""]);
    expect(reviseAt(base, two!, 1, "trn")).toBeNull();
    // Reverting a slot frees a change.
    expect(reviseAt(base, two!, 0, "mon")).toEqual(["mon", "opt", ""]);
  });
});

describe("blockReason", () => {
  it("requires each phase's inputs before continuing", () => {
    expect(blockReason("team", INITIAL_STATE)).toBe("team");
    // The team needs a name and at least one role.
    expect(
      blockReason("team", { ...INITIAL_STATE, members: { ae: "u1" } }),
    ).toBe("team");
    expect(
      blockReason("team", {
        ...INITIAL_STATE,
        teamName: "  ",
        members: { ae: "u1" },
      }),
    ).toBe("team");
    expect(
      blockReason("team", {
        ...INITIAL_STATE,
        teamName: "Lone Star",
        members: { ae: "u1" },
      }),
    ).toBeNull();
    expect(blockReason("brief", { ...INITIAL_STATE, briefAnswer: "   " })).toBe(
      "brief",
    );
    expect(blockReason("discover", INITIAL_STATE)).toBeNull();
    expect(
      blockReason("diagnose", { ...INITIAL_STATE, causes: ["a", "b"] }),
    ).toBe("diagnose");
    expect(
      blockReason("diagnose", { ...INITIAL_STATE, causes: ["a", "b", "c"] }),
    ).toBeNull();
    expect(blockReason("advise", INITIAL_STATE)).toBe("advise");
    expect(blockReason("respond", INITIAL_STATE)).toBeNull();
    expect(
      blockReason("deliver", { ...INITIAL_STATE, situation: "x", msRec: "y" }),
    ).toBe("deliver");
    expect(
      blockReason("deliver", {
        ...INITIAL_STATE,
        situation: "x",
        msRec: "y",
        statement: "z",
      }),
    ).toBeNull();
  });
});

describe("firstOpenPhase", () => {
  it("is the first phase not completed, or null when all are", () => {
    expect(firstOpenPhase([])).toBe("team");
    expect(firstOpenPhase(["team", "brief"])).toBe("discover");
    expect(firstOpenPhase(["team", "discover"])).toBe("brief");
    expect(
      firstOpenPhase([
        "team",
        "brief",
        "discover",
        "diagnose",
        "advise",
        "respond",
        "deliver",
      ]),
    ).toBeNull();
  });
});

describe("nextScreen", () => {
  it("walks the phases and ends on the results", () => {
    expect(nextScreen("team")).toBe("brief");
    expect(nextScreen("respond")).toBe("deliver");
    expect(nextScreen("deliver")).toBe("results");
  });
});
