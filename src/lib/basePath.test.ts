function loadBasePathModule(basePath: string | undefined) {
  const original = process.env.BASE_PATH;
  if (basePath === undefined) delete process.env.BASE_PATH;
  else process.env.BASE_PATH = basePath;

  let mod!: typeof import("./basePath");
  jest.isolateModules(() => {
    mod = jest.requireActual<typeof import("./basePath")>("./basePath");
  });

  if (original === undefined) delete process.env.BASE_PATH;
  else process.env.BASE_PATH = original;
  return mod;
}

describe("withBasePath", () => {
  describe("without a base path", () => {
    const { BASE_PATH, withBasePath } = loadBasePathModule("");

    it("exposes an empty BASE_PATH", () => {
      expect(BASE_PATH).toBe("");
    });

    it("returns root-relative paths unchanged", () => {
      expect(withBasePath("/lead-logo.png")).toBe("/lead-logo.png");
      expect(withBasePath("/")).toBe("/");
    });

    it("adds a leading slash when missing", () => {
      expect(withBasePath("api/health")).toBe("/api/health");
    });
  });

  describe("with a base path", () => {
    const { BASE_PATH, withBasePath } = loadBasePathModule("/demo");

    it("exposes the base path", () => {
      expect(BASE_PATH).toBe("/demo");
    });

    it("prefixes root-relative paths", () => {
      expect(withBasePath("/lead-logo.png")).toBe("/demo/lead-logo.png");
      expect(withBasePath("auth/callback")).toBe("/demo/auth/callback");
      expect(withBasePath("/es?x=1")).toBe("/demo/es?x=1");
    });

    it("maps the root to the base path itself", () => {
      expect(withBasePath("/")).toBe("/demo");
    });

    it("does not double-prefix", () => {
      expect(withBasePath("/demo/es")).toBe("/demo/es");
      expect(withBasePath("/demo")).toBe("/demo");
    });

    it("does not treat similar prefixes as the base path", () => {
      expect(withBasePath("/demonstration")).toBe("/demo/demonstration");
    });

    it("leaves absolute URLs untouched", () => {
      expect(withBasePath("https://example.com/a")).toBe(
        "https://example.com/a",
      );
      expect(withBasePath("//cdn.example.com/a.png")).toBe(
        "//cdn.example.com/a.png",
      );
    });
  });

  it("normalizes the env value", () => {
    expect(loadBasePathModule("talent/").BASE_PATH).toBe("/talent");
    expect(loadBasePathModule("/").BASE_PATH).toBe("");
    expect(loadBasePathModule(undefined).BASE_PATH).toBe("");
  });
});
