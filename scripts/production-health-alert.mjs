#!/usr/bin/env node

const {
  GITHUB_REPOSITORY: repository,
  GITHUB_RUN_ID: runId,
  GITHUB_SERVER_URL: serverUrl = "https://github.com",
  GITHUB_SHA: sha,
  GITHUB_TOKEN: token,
  PROBE_OUTCOME: outcome,
} = process.env;

if (!repository || !runId || !sha || !token || !["success", "failure"].includes(outcome ?? "")) {
  console.error("Production alert reporter requires the GitHub Actions environment and a success/failure PROBE_OUTCOME.");
  process.exit(1);
}

const apiBase = `https://api.github.com/repos/${repository}`;
const title = "[production-health] Poachland production probe failing";
const runUrl = `${serverUrl}/${repository}/actions/runs/${runId}`;

async function api(path, init = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API ${init.method ?? "GET"} ${path} returned ${response.status}`);
  }
  return response.status === 204 ? null : response.json();
}

const issues = await api("/issues?state=open&per_page=100");
const openAlert = issues.find((issue) => !issue.pull_request && issue.title === title);

if (outcome === "failure") {
  const runs = await api("/actions/workflows/production-health.yml/runs?status=completed&per_page=10");
  const previousCompleted = runs.workflow_runs.find((run) => String(run.id) !== runId);
  if (previousCompleted?.conclusion !== "failure") {
    console.log("First consecutive production probe failure; deferring the durable alert until confirmation.");
    process.exit(0);
  }
  if (openAlert) {
    await api(`/issues/${openAlert.number}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: `Production is still failing its external probe: ${runUrl}` }),
    });
    console.log(`Updated production alert issue #${openAlert.number}.`);
    process.exit(0);
  }
  const issue = await api("/issues", {
    method: "POST",
    body: JSON.stringify({
      title,
      body: [
        "The external Poachland production probe failed twice consecutively.",
        "",
        `- Confirming run: ${runUrl}`,
        `- Revision: \`${sha}\``,
        "- Runbook: `docs/operations.md`",
        "",
        "Treat this issue as an active production alert until a successful probe closes it automatically.",
      ].join("\n"),
    }),
  });
  console.log(`Opened production alert issue #${issue.number}.`);
  process.exit(0);
}

if (!openAlert) {
  console.log("Production probe passed; no open production alert exists.");
  process.exit(0);
}
await api(`/issues/${openAlert.number}/comments`, {
  method: "POST",
  body: JSON.stringify({ body: `Production recovered and the external probe passed: ${runUrl}` }),
});
await api(`/issues/${openAlert.number}`, {
  method: "PATCH",
  body: JSON.stringify({ state: "closed", state_reason: "completed" }),
});
console.log(`Closed recovered production alert issue #${openAlert.number}.`);
