// This is a bounded risk acceptance, not a fix. See docs/security-checklist.md.
export const BRACES_EXCEPTION = Object.freeze({
  id: "GHSA-vfj7-8cjw-p6xm",
  url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
  module: "braces",
  version: "3.0.3",
  path: ".>eslint-config-next>@next/eslint-plugin-next>fast-glob>micromatch>braces",
  expiresAt: "2026-10-17T00:00:00.000Z",
});

const severities = ["info", "low", "moderate", "high", "critical"];
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isString = (value) => typeof value === "string" && value.length > 0;

function requireShape(condition, message) {
  if (!condition) throw new Error(`Unrecognized dependency audit data: ${message}`);
}

export function validateAuditReport(report, label) {
  requireShape(isObject(report), `${label} report is not an object`);
  requireShape(Object.keys(report).every((key) => ["actions", "advisories", "muted", "metadata"].includes(key)), `${label} report has unexpected fields or a registry error`);
  requireShape(Array.isArray(report.actions) && Array.isArray(report.muted), `${label} actions/muted are missing`);
  requireShape(report.muted.length === 0, `${label} report has muted advisories`);
  requireShape(isObject(report.advisories) && isObject(report.metadata), `${label} advisories/metadata are missing`);
  const counts = report.metadata.vulnerabilities;
  requireShape(isObject(counts) && Object.keys(counts).length === severities.length, `${label} severity counts are missing or changed`);
  for (const severity of severities) {
    requireShape(Number.isSafeInteger(counts[severity]) && counts[severity] >= 0, `${label} invalid ${severity} count`);
  }
  const advisories = Object.values(report.advisories);
  const observed = Object.fromEntries(severities.map((severity) => [severity, 0]));
  for (const advisory of advisories) {
    requireShape(isObject(advisory), `${label} advisory is not an object`);
    requireShape(severities.includes(advisory.severity), `${label} unknown severity`);
    requireShape(isString(advisory.module_name) && isString(advisory.github_advisory_id) && isString(advisory.url) && isString(advisory.patched_versions), `${label} advisory identity/patch fields are missing`);
    requireShape(Array.isArray(advisory.findings) && advisory.findings.length > 0, `${label} advisory has no findings`);
    for (const finding of advisory.findings) {
      requireShape(isObject(finding) && isString(finding.version) && Array.isArray(finding.paths) && finding.paths.length > 0 && finding.paths.every(isString), `${label} finding version/paths are missing`);
    }
    observed[advisory.severity] += 1;
  }
  for (const severity of severities) {
    requireShape(observed[severity] === counts[severity], `${label} ${severity} findings do not match metadata`);
  }
  return advisories;
}

export function evaluateDependencyAudit({ fullReport, productionReport, productionBraces, manifest, now = new Date() }) {
  const full = validateAuditReport(fullReport, "full");
  const production = validateAuditReport(productionReport, "production");
  requireShape(Array.isArray(productionBraces), "production dependency graph is not an array");
  requireShape(isObject(manifest) && isObject(manifest.devDependencies), "package manifest is missing devDependencies");
  requireShape(now instanceof Date && Number.isFinite(now.getTime()), "invalid evaluation time");
  const failures = [];
  const waived = [];
  const isBlocking = (advisory) => advisory.severity === "high" || advisory.severity === "critical";
  const describe = (advisory) => `${advisory.severity}: ${advisory.module_name} ${advisory.github_advisory_id} (${advisory.url})`;

  // The second audit is additional evidence, never a replacement for the full audit.
  for (const advisory of production.filter(isBlocking)) {
    failures.push(`Production dependency ${describe(advisory)}`);
  }
  for (const advisory of full.filter(isBlocking)) {
    if (advisory.github_advisory_id !== BRACES_EXCEPTION.id) {
      failures.push(describe(advisory));
      continue;
    }
    const reasons = [];
    if (now.getTime() >= Date.parse(BRACES_EXCEPTION.expiresAt)) reasons.push("exception expired");
    if (advisory.module_name !== BRACES_EXCEPTION.module || advisory.url !== BRACES_EXCEPTION.url || advisory.severity !== "high") reasons.push("advisory identity or severity changed");
    // pnpm's exact no-fixed-version sentinel. Any new range requires an upgrade/review.
    if (advisory.patched_versions !== "<0.0.0") reasons.push("a patched range is available or its status changed");
    if (!advisory.findings.every((finding) => finding.version === BRACES_EXCEPTION.version && finding.paths.every((path) => path === BRACES_EXCEPTION.path))) reasons.push("version or dependency path changed");
    if (production.some((entry) => entry.github_advisory_id === BRACES_EXCEPTION.id) || productionBraces.length > 0) reasons.push("braces is present in the production audit/dependency graph");
    if (!isString(manifest.devDependencies["eslint-config-next"]) || manifest.dependencies?.["eslint-config-next"] || manifest.optionalDependencies?.["eslint-config-next"]) reasons.push("eslint-config-next is no longer exclusively a development dependency");
    if (reasons.length > 0) failures.push(`${describe(advisory)} — exception rejected: ${reasons.join("; ")}`);
    else waived.push(`${describe(advisory)} — temporary development-only exception until ${BRACES_EXCEPTION.expiresAt}; ${BRACES_EXCEPTION.path}`);
  }
  return { failures, waived, counts: fullReport.metadata.vulnerabilities };
}
