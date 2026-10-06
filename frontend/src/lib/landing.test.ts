/**
 * @jest-environment node
 */
import { cityHome } from "./cityRoutes";
import { resolveLanding } from "./landing";

const getSession = jest.fn();

jest.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: () => true }));
jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getSession } }),
}));

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

function signedIn() {
  getSession.mockResolvedValue({ data: { session: { access_token: "token-1" } } });
}

function backendReturns(status: number, body: unknown) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

const me = (city_code: string, access_role = "student", group_code: string | null = "NYC-G07") => ({
  ok: true,
  access_role,
  city_code,
  group_code,
});

beforeEach(() => {
  getSession.mockReset();
  fetchMock.mockReset();
});

describe("cityHome", () => {
  it("maps the backend city codes to their pages", () => {
    expect(cityHome("NYC")).toBe("/new-york");
    expect(cityHome("DFW")).toBe("/dallas");
  });

  it("returns null for an unknown or missing city", () => {
    expect(cityHome("LAX")).toBeNull();
    expect(cityHome("")).toBeNull();
    expect(cityHome(undefined)).toBeNull();
  });
});

describe("resolveLanding", () => {
  it("does not call the backend without a session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    await expect(resolveLanding()).resolves.toEqual({ kind: "signedOut" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks /api/auth/me with the session token", async () => {
    signedIn();
    backendReturns(200, me("NYC"));

    await resolveLanding();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8000/api/auth/me");
    expect(init.headers).toEqual({ Authorization: "Bearer token-1" });
  });

  it.each([
    ["a New York student", me("NYC"), "/new-york"],
    ["a Dallas student", me("DFW", "student", "DFW-G01"), "/dallas"],
    ["an admin with no city or group", me("NYC", "admin", null), "/new-york"],
    ["a user with a city but no group", me("NYC", "student", null), "/new-york"],
  ])("sends %s to their city", async (_, body, href) => {
    signedIn();
    backendReturns(200, body);

    await expect(resolveLanding()).resolves.toEqual({ kind: "redirect", href });
  });

  it("keeps a user with an unknown city on login with a notice", async () => {
    signedIn();
    backendReturns(200, me("LAX"));

    await expect(resolveLanding()).resolves.toEqual({ kind: "notice", notice: "unknownCity" });
  });

  it.each([
    ["inactive_account", "inactiveAccount"],
    ["access_denied", "noAccess"],
  ])("keeps a %s user on login with a notice", async (code, notice) => {
    signedIn();
    backendReturns(403, { detail: { code, message: "..." } });

    await expect(resolveLanding()).resolves.toEqual({ kind: "notice", notice });
  });

  it("shows the form without a notice when the backend rejects the session", async () => {
    signedIn();
    backendReturns(401, { detail: "Invalid session token" });

    await expect(resolveLanding()).resolves.toEqual({ kind: "signedOut" });
  });

  it("keeps the user on login when the backend fails", async () => {
    signedIn();
    backendReturns(500, { detail: "boom" });

    await expect(resolveLanding()).resolves.toEqual({ kind: "notice", notice: "unavailable" });
  });

  it("keeps the user on login when the backend is unreachable or times out", async () => {
    signedIn();
    fetchMock.mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError"));

    await expect(resolveLanding()).resolves.toEqual({ kind: "notice", notice: "unavailable" });
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("keeps the user on login when the backend answers something that is not JSON", async () => {
    signedIn();
    fetchMock.mockResolvedValue(new Response("<html>", { status: 200 }));

    await expect(resolveLanding()).resolves.toEqual({ kind: "notice", notice: "unavailable" });
  });
});
