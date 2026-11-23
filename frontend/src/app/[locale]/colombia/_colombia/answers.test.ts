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
          diag: { farm: "urgent" },
          causes: ["geolocation"],
          strategy: ["polygons", "compliance"],
        },
        100,
      ),
    ).toEqual({
      strategize: {
        class_farm: "urgent",
        cause_geolocation: true,
        rec_polygons: 100,
        rec_compliance: 101,
      },
    });
  });

  it("removes deselected options", () => {
    const before = {
      ...EMPTY,
      causes: ["geolocation"],
      strategy: ["polygons" as const],
    };
    expect(edit({ causes: [], strategy: [] }, before)).toEqual({
      strategize: { cause_geolocation: null, rec_polygons: null },
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
        class_mill: "digitize",
        cause_geolocation: true,
        cause_cash: true,
        rec_compliance: 20,
        rec_polygons: 10,
      },
    });

    expect(state.diag).toEqual({ mill: "digitize" });
    expect(state.causes).toEqual(["cash", "geolocation"]);
    // In the order they were added.
    expect(state.strategy).toEqual(["polygons", "compliance"]);
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
