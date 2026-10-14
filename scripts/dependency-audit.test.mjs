import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateDependencyAudit } from "../lib/dependency-audit-policy.mjs";

function advisory(overrides = {}) {
  return {
    module_name: "braces",
    severity: "high",
    github_advisory_id: "GHSA-vfj7-8cjw-p6xm",
    url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
    patched_versions: "<0.0.0",
    findings: [{ version: "3.0.3", paths: [".>eslint-config-next>@next/eslint-plugin-next>fast-glob>micromatch>braces"] }],
    ...overrides,
  };
}

function report(advisories = []) {
  const vulnerabilities = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
  for (const entry of advisories) vulnerabilities[entry.severity] += 1;
  return { actions: [], muted: [], advisories: Object.fromEntries(advisories.map((entry, i) => [i, entry])), metadata: { vulnerabilities } };
}

function evaluate(overrides = {}) {
  return evaluateDependencyAudit({ fullReport: report(), productionReport: report(), ...overrides });
}

test("the former braces exception is rejected even on its previously accepted development path", () => {
  const result = evaluate({ fullReport: report([advisory()]) });
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], /braces GHSA-vfj7-8cjw-p6xm/);
});

test("every high and critical finding blocks regardless of development or production placement", () => {
  for (const severity of ["high", "critical"]) {
    const finding = advisory({ github_advisory_id: "GHSA-other-advisory", severity });
    assert.equal(evaluate({ fullReport: report([finding]) }).failures.length, 1);
    assert.equal(evaluate({ productionReport: report([finding]) }).failures.length, 1);
  }
});

test("clean reports pass and lower-severity findings remain visible in the counts", () => {
  assert.deepEqual(evaluate().failures, []);
  const result = evaluate({ fullReport: report([advisory({ severity: "moderate" })]) });
  assert.deepEqual(result.failures, []);
  assert.equal(result.counts.moderate, 1);
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
});
