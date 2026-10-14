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

export function evaluateDependencyAudit({ fullReport, productionReport }) {
  const full = validateAuditReport(fullReport, "full");
  const production = validateAuditReport(productionReport, "production");
  const failures = [];
  const isBlocking = (advisory) => advisory.severity === "high" || advisory.severity === "critical";
  const describe = (advisory) => `${advisory.severity}: ${advisory.module_name} ${advisory.github_advisory_id} (${advisory.url})`;

  // The second audit is additional evidence, never a replacement for the full audit.
  for (const advisory of production.filter(isBlocking)) {
    failures.push(`Production dependency ${describe(advisory)}`);
  }
  for (const advisory of full.filter(isBlocking)) {
    failures.push(describe(advisory));
  }
  return { failures, counts: fullReport.metadata.vulnerabilities };
}
