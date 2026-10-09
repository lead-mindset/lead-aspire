import {
  emptyAnswers,
  fromAnswers,
  overlay,
  toPatches,
  type SharedState,
} from "./answers";

const EMPTY = fromAnswers(emptyAnswers());

function edit(changes: Partial<SharedState>, before: SharedState = EMPTY) {
  return toPatches(before, { ...before, ...changes }, 1000);
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

  it("sends only the toggled options of a multi-select", () => {
    const before = { ...EMPTY, causes: ["governance", "models"] };
    expect(edit({ causes: ["models", "training"] }, before)).toEqual({
      diagnose: { cause_training: true, cause_governance: null },
    });
  });

  it("orders the strategy by when each recommendation was added", () => {
    const patch = edit({ strategy: ["mon", "gov"] });
    expect(patch).toEqual({ advise: { rec_mon: 1000, rec_gov: 1001 } });
    const saved = {
      ...emptyAnswers(),
      advise: { rec_gov: 5, rec_mon: 2, rec_opt: 9 },
    };
    expect(fromAnswers(saved).strategy).toEqual(["mon", "gov", "opt"]);
    expect(edit({ strategy: ["gov"] }, fromAnswers(saved))).toEqual({
      advise: { rec_mon: null, rec_opt: null },
    });
  });

  it("keeps Respond's slots, including an emptied one, and clears them on reset", () => {
    expect(edit({ revised: ["mon", "", "gov"] })).toEqual({
      respond: { slot_1: "mon", slot_2: "", slot_3: "gov" },
    });
    const before = {
      ...EMPTY,
      revised: ["mon", "opt"] as SharedState["revised"],
    };
    expect(edit({ revised: ["mon", "trn"] }, before)).toEqual({
      respond: { slot_2: "trn" },
    });
    expect(edit({ revised: null }, before)).toEqual({
      respond: { slot_1: null, slot_2: null },
    });
  });

  it("keeps a ticked outcome without a target", () => {
    expect(edit({ outcomes: { cost: "" } })).toEqual({
      deliver: { outcome_cost: "" },
    });
    const before = { ...EMPTY, outcomes: { cost: "20" } };
    expect(edit({ outcomes: {} }, before)).toEqual({
      deliver: { outcome_cost: null },
    });
  });

  it("groups text fields under their phase", () => {
    expect(
      edit({ briefAnswer: "Usage limits", rootCause: "No monitoring" }),
    ).toEqual({
      brief: { q1: "Usage limits" },
      deliver: { root_cause: "No monitoring" },
    });
  });
});

describe("fromAnswers", () => {
  it("reads every phase back into the views' shapes", () => {
    const state = fromAnswers({
      ...emptyAnswers(),
      team: { display_name: "Lone Star", role_ae: "u1", role_sg: "u2" },
      brief: { q1: "Why?", missing_cost: true, missing_roi: true },
      diagnose: { class_support: "protect", cause_models: true },
      respond: { slot_1: "mon", slot_2: "", slot_4: "gov" },
      deliver: { situation: "s", outcome_cost: "20", metric_csat: true },
    });

    expect(state.teamName).toBe("Lone Star");
    expect(state.members).toEqual({ ae: "u1", sg: "u2" });
    expect(state.missing).toEqual(["cost", "roi"]);
    expect(state.diag).toEqual({ support: "protect" });
    expect(state.causes).toEqual(["models"]);
    // Slots stop at the first gap.
    expect(state.revised).toEqual(["mon", ""]);
    expect(state.outcomes).toEqual({ cost: "20" });
    expect(state.metrics).toEqual(["csat"]);
  });

  it("round-trips an edit", () => {
    const after = {
      ...EMPTY,
      teamName: "Lone Star",
      members: { ae: "u1" },
      missing: ["cost"],
      causes: ["a", "b", "c"],
      outcomes: { cost: "" },
    };
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
