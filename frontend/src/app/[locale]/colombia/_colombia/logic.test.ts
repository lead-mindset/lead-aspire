import { stepNumber } from "./data";
import {
  blockReason,
  firstOpenPhase,
  INITIAL_STATE,
  nextScreen,
} from "./logic";

describe("blockReason", () => {
  it("needs a team name and at least one role to leave Team Setup", () => {
    expect(blockReason("team", INITIAL_STATE)).toBe("team");
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
  });

  it("does not block the other phases yet", () => {
    for (const phase of ["discover", "strategize", "design", "pitch"] as const)
      expect(blockReason(phase, INITIAL_STATE)).toBeNull();
  });
});

describe("firstOpenPhase", () => {
  it("is the first phase not completed, or null when all are", () => {
    expect(firstOpenPhase([])).toBe("team");
    expect(firstOpenPhase(["team"])).toBe("discover");
    expect(firstOpenPhase(["team", "strategize"])).toBe("discover");
    expect(
      firstOpenPhase(["team", "discover", "strategize", "design", "pitch"]),
    ).toBeNull();
  });
});

describe("nextScreen", () => {
  it("walks the phases and ends on Home", () => {
    expect(nextScreen("team")).toBe("discover");
    expect(nextScreen("design")).toBe("pitch");
    expect(nextScreen("pitch")).toBe("home");
  });
});

describe("stepNumber", () => {
  it("starts at Discover; Team Setup has no number", () => {
    expect(stepNumber("team")).toBeNull();
    expect(stepNumber("discover")).toBe(1);
    expect(stepNumber("pitch")).toBe(4);
  });
});
