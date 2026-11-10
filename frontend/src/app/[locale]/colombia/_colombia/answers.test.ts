import {
  emptyAnswers,
  fromAnswers,
  overlay,
  toPatches,
  type SharedState,
} from "./answers";

const EMPTY = fromAnswers(emptyAnswers());

function edit(changes: Partial<SharedState>, before: SharedState = EMPTY) {
  return toPatches(before, { ...before, ...changes });
}

describe("toPatches", () => {
  it("sends nothing when nothing changed", () => {
    expect(toPatches(EMPTY, { ...EMPTY })).toEqual({});
  });

  it("stores each role and the team name as their own keys", () => {
    expect(edit({ members: { ae: "u1" }, teamName: "Lone Star" })).toEqual({
      team: { role_ae: "u1", display_name: "Lone Star" },
    });
    // Clearing a role or the name removes the key.
    const before = {
      ...EMPTY,
      members: { ae: "u1", csa: "u2" },
      teamName: "X",
    };
    expect(
      edit({ members: { csa: "u2", ae: "" }, teamName: "" }, before),
    ).toEqual({
      team: { role_ae: null, display_name: null },
    });
  });
});

describe("toPatches for Strategize", () => {
  it("stores classes, causes and recommendations as their own keys", () => {
    expect(
      toPatches(
        EMPTY,
        {
          ...EMPTY,
          diag: { hr: "retire" },
          causes: ["models"],
          strategy: ["mon", "gov"],
        },
        100,
      ),
    ).toEqual({
      strategize: {
        class_hr: "retire",
        cause_models: true,
        rec_mon: 100,
        rec_gov: 101,
      },
    });
  });

  it("removes deselected options", () => {
    const before = { ...EMPTY, causes: ["models"], strategy: ["mon" as const] };
    expect(edit({ causes: [], strategy: [] }, before)).toEqual({
      strategize: { cause_models: null, rec_mon: null },
    });
  });
});

describe("fromAnswers", () => {
  it("reads the team name and roles", () => {
    const state = fromAnswers({
      ...emptyAnswers(),
      team: { display_name: "Lone Star", role_ae: "u1", role_se: "u2" },
    });

    expect(state).toEqual({
      teamName: "Lone Star",
      members: { ae: "u1", se: "u2" },
      diag: {},
      causes: [],
      strategy: [],
    });
  });

  it("reads Diagnose and Advise from the Strategize answers", () => {
    const state = fromAnswers({
      ...emptyAnswers(),
      strategize: {
        class_support: "protect",
        cause_models: true,
        cause_adoption: true,
        rec_gov: 20,
        rec_mon: 10,
      },
    });

    expect(state.diag).toEqual({ support: "protect" });
    expect(state.causes).toEqual(["adoption", "models"]);
    // In the order they were added.
    expect(state.strategy).toEqual(["mon", "gov"]);
  });

  it("round-trips an edit", () => {
    const after = { ...EMPTY, teamName: "Lone Star", members: { ae: "u1" } };
    const patches = toPatches(EMPTY, after);
    const saved = emptyAnswers();
    for (const [phase, patch] of Object.entries(patches)) {
      saved[phase as keyof typeof saved] = overlay({}, patch);
    }
    expect(fromAnswers(saved)).toEqual(after);
  });
});

describe("overlay", () => {
  it("puts unsaved edits on top and drops removed keys", () => {
    expect(overlay({ a: 1, b: 2 }, { b: null, c: 3 })).toEqual({ a: 1, c: 3 });
    expect(overlay({ a: 1 }, undefined)).toEqual({ a: 1 });
  });
});
