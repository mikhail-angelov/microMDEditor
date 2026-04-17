import packageJson from "../package.json";

describe("Preact package entry", () => {
  it("exposes a dedicated Preact subpath with Preact as an optional peer", () => {
    const pkg = packageJson as {
      exports?: Record<string, unknown>;
      peerDependencies?: Record<string, string>;
      peerDependenciesMeta?: Record<string, { optional: boolean }>;
    };

    expect(pkg.exports?.["./preact"]).toEqual({
      import: "./dist/preact.esm.js",
      types: "./dist/preact.d.ts",
    });
    expect(pkg.peerDependencies?.preact).toBeDefined();
    expect(pkg.peerDependenciesMeta?.preact).toEqual({ optional: true });
  });
});
