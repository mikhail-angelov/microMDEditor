# Preact Entry Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated `micro-md-editor/preact` package entry that emits a Preact-compatible ESM build.

**Architecture:** Keep the existing React entry unchanged. Build a second ESM artifact from the same source, with Rollup aliasing React runtime imports to Preact runtime imports and package metadata exposing the new subpath.

**Tech Stack:** TypeScript, Rollup, Jest, React-compatible JSX runtime, Preact compatibility runtime.

---

### Task 1: Preact Package Entry

**Files:**
- Create: `src/preact-build.test.ts`
- Modify: `package.json`
- Modify: `rollup.config.js`
- Modify: `src/types.ts`

- [ ] **Step 1: Write the failing test**

Create `src/preact-build.test.ts`:

```ts
import packageJson from "../package.json";

describe("Preact package entry", () => {
  it("exposes a dedicated Preact subpath with Preact as an optional peer", () => {
    expect(packageJson.exports["./preact"]).toEqual({
      import: "./dist/preact.esm.js",
      types: "./dist/preact.d.ts",
    });
    expect(packageJson.peerDependencies?.preact).toBeDefined();
    expect(packageJson.peerDependenciesMeta?.preact).toEqual({ optional: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath src/preact-build.test.ts`
Expected: FAIL because `packageJson.exports` and the Preact peer metadata do not exist.

- [ ] **Step 3: Add Preact build metadata and Rollup output**

Update `package.json` to expose `"./preact"` with `dist/preact.esm.js` and `dist/preact.d.ts`, add `preact` as an optional peer dependency, and add `preact` as a dev dependency for local build resolution.

Update `rollup.config.js` to emit the current React CJS/ESM build plus a Preact ESM build from `src/preact.ts`. Add a small Rollup plugin that maps `react` to `preact/compat` and `react/jsx-runtime` to `preact/jsx-runtime` for the Preact build only.

Update exported style prop types in `src/types.ts` so public declarations do not require the React namespace.

- [ ] **Step 4: Run focused verification**

Run: `npm test -- --runTestsByPath src/preact-build.test.ts`
Expected: PASS.

Run: `npm run build`
Expected: PASS and `dist/preact.esm.js` / `dist/preact.d.ts` exist.

- [ ] **Step 5: Run broader verification**

Run: `npm test`
Expected: Existing test suite status is recorded accurately. If unrelated pre-existing failures appear, report them without hiding the Preact change result.
