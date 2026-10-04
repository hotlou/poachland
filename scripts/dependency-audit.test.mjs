import assert from "node:assert/strict";
import { test } from "node:test";
import { BRACES_EXCEPTION, evaluateDependencyAudit } from "../lib/dependency-audit-policy.mjs";

function advisory(overrides = {}) {
  return {
    module_name: "braces",
    severity: "high",
    github_advisory_id: BRACES_EXCEPTION.id,
    url: BRACES_EXCEPTION.url,
    patched_versions: "<0.0.0",
    findings: [{ version: "3.0.3", paths: [BRACES_EXCEPTION.path] }],
    ...overrides,
  };
}

function report(advisories = []) {
  const vulnerabilities = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
  for (const entry of advisories) vulnerabilities[entry.severity] += 1;
  return { actions: [], muted: [], advisories: Object.fromEntries(advisories.map((entry, i) => [i, entry])), metadata: { vulnerabilities } };
}

function evaluate(overrides = {}) {
  return evaluateDependencyAudit({
    fullReport: report([advisory()]),
    productionReport: report(),
    productionBraces: [],
    manifest: { devDependencies: { "eslint-config-next": "16.3.6" } },
    now: new Date("2026-10-03T12:00:00Z"),
    ...overrides,
  });
}

test("permits only the reviewed development chain before its deadline", () => {
  const result = evaluate();
  assert.equal(result.failures.length, 0);
  assert.equal(result.waived.length, 1);
  assert.match(result.waived[0], /2026-10-17/);
});

test("expires at the exact UTC deadline", () => {
  assert.equal(evaluate({ now: new Date("2026-10-16T23:59:59.999Z") }).failures.length, 0);
  assert.match(evaluate({ now: new Date(BRACES_EXCEPTION.expiresAt) }).failures[0], /expired/);
});

test("a published patch, changed version, extra path or raised severity blocks the exception", () => {
  for (const change of [
    { patched_versions: ">=3.0.4" },
    { patched_versions: "unknown" },
    { findings: [{ version: "3.0.2", paths: [BRACES_EXCEPTION.path] }] },
    { findings: [{ version: "3.0.3", paths: [BRACES_EXCEPTION.path, ".>some-runtime-package>braces"] }] },
    { findings: [{ version: "3.0.3", paths: [BRACES_EXCEPTION.path] }, { version: "3.0.3", paths: [".>braces"] }] },
    { severity: "critical" },
    { module_name: "another-package" },
    { url: "https://example.com/a-different-advisory" },
  ]) {
    const result = evaluate({ fullReport: report([advisory(change)]) });
    assert.equal(result.waived.length, 0);
    assert.equal(result.failures.length, 1);
  }
});

test("production report or production dependency graph independently reject the exception", () => {
  assert.equal(evaluate({ productionReport: report([advisory()]) }).waived.length, 0);
  assert.equal(evaluate({ productionReport: report([advisory({ severity: "moderate" })]) }).waived.length, 0);
  assert.equal(evaluate({ productionBraces: [{ name: "braces" }] }).waived.length, 0);
  assert.equal(evaluate({ manifest: { devDependencies: {}, dependencies: { "eslint-config-next": "16.3.6" } } }).waived.length, 0);
});

test("other high/critical findings block regardless of development or production placement", () => {
  for (const severity of ["high", "critical"]) {
    const other = advisory({ github_advisory_id: "GHSA-other-advisory", severity });
    assert.equal(evaluate({ fullReport: report([advisory(), other]) }).failures.length, 1);
    assert.equal(evaluate({ fullReport: report(), productionReport: report([other]) }).failures.length, 1);
  }
  assert.equal(evaluate({ fullReport: report([advisory({ severity: "moderate", github_advisory_id: "GHSA-moderate" })]) }).failures.length, 0);
});

test("no advisory means no exception is needed, even after its expiry", () => {
  assert.deepEqual(evaluate({ fullReport: report(), now: new Date("2026-11-01") }).waived, []);
});

test("registry errors, unknown schema, muted findings and incomplete evidence fail closed", () => {
  for (const fullReport of [
    null,
    {},
    { error: { code: "ECONNRESET" } },
    { ...report(), error: "registry unavailable" },
    { ...report(), vulnerabilities: {} },
    { ...report(), muted: ["ignored-advisory"] },
    { ...report(), advisories: { 1: advisory() } },
    report([advisory({ findings: [] })]),
    report([advisory({ findings: [{ version: "3.0.3", paths: [] }] })]),
    report([advisory({ patched_versions: undefined })]),
  ]) assert.throws(() => evaluate({ fullReport }), /Unrecognized dependency audit data/);
  assert.throws(() => evaluate({ productionReport: {} }), /Unrecognized/);
  assert.throws(() => evaluate({ productionBraces: {} }), /Unrecognized/);
  assert.throws(() => evaluate({ now: new Date("invalid") }), /Unrecognized/);
});
