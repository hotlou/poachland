import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Linter } from "eslint";

const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("eslint-config-next"));
const pluginRequire = createRequire(nextRequire.resolve("@next/eslint-plugin-next"));
const { getRootDirs } = pluginRequire("./utils/get-root-dirs.js");
const nextPlugin = nextRequire("@next/eslint-plugin-next");

test("the installed lint matcher is tinyglobby and the removed vulnerable packages do not reappear", () => {
  const matcher = pluginRequire("fast-glob/package.json");
  assert.equal(matcher.name, "tinyglobby");
  assert.equal(matcher.version, "0.2.17");
  for (const dependency of ["braces", "tinypool"]) {
    const graph = JSON.parse(execFileSync("pnpm", ["why", dependency, "--json"], { encoding: "utf8" }));
    assert.deepEqual(graph, [], `${dependency} must not return without a security review`);
  }
});

test("Next root discovery preserves exact directories, globs, arrays and Windows separators", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "poachland-lint-roots-"));
  try {
    const web = path.join(fixture, "apps", "web");
    const docs = path.join(fixture, "apps", "docs");
    mkdirSync(path.join(web, "app"), { recursive: true });
    mkdirSync(path.join(docs, "pages"), { recursive: true });
    writeFileSync(path.join(fixture, "apps", "README.md"), "fixture");
    // The consumer joins these with app/pages and reads them from process.cwd().
    // tinyglobby may return an equivalent relative path with a trailing slash.
    const roots = (rootDir) => getRootDirs({ cwd: fixture, settings: { next: { rootDir } } })
      .map((dir) => path.resolve(dir)).sort();
    assert.deepEqual(getRootDirs({ cwd: fixture, settings: {} }), [fixture]);
    assert.deepEqual(roots(web), [web]); // Must not expand this into web/app.
    assert.deepEqual(roots(`${fixture}/apps/*`), [docs, web]);
    assert.deepEqual(roots(`${fixture}/apps/{docs,web}`), [docs, web]);
    assert.deepEqual(roots([docs, web, null]), [docs, web]);
    assert.deepEqual(roots(web.replaceAll("/", "\\")), [web]);
    assert.deepEqual(roots(`${fixture}/missing/*`), []);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("Next link validation still detects internal anchors when rootDir is explicitly configured", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "poachland-lint-links-"));
  try {
    mkdirSync(path.join(fixture, "pages"));
    writeFileSync(path.join(fixture, "pages", "index.jsx"), "export default function Page() { return null; }");
    const linter = new Linter();
    const config = [{
      files: ["**/*.jsx"],
      languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: { "@next/next": nextPlugin },
      settings: { next: { rootDir: fixture } },
      rules: { "@next/next/no-html-link-for-pages": "error" },
    }];
    const messages = linter.verify('const link = <a href="/">Home</a>;', config, "link.jsx");
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, "@next/next/no-html-link-for-pages");
    assert.deepEqual(linter.verify('const link = <a href="https://example.com/">External</a>;', config, "link.jsx"), []);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
