# Marketplace performance targets

The representative load gate seeds an isolated PostgreSQL-compatible PGlite database with 100 users and 2,000 active listings, then executes 60 indexed browse/search queries at concurrency 20.

The release threshold is p95 query latency at or below 1,000 ms and a maximum serialized page payload of 100 KB for 24 listings. CI runs `pnpm test:load` through the all-in-one `pnpm check` command. Production alert targets are stricter after network overhead is included: API p95 below 1,500 ms, 5xx below 1%, and database pool utilization below 80% over five minutes.

This gate detects query or payload regressions; it is not a substitute for a staging soak test against the production database provider. Before broad beta expansion, repeat the workload against staging at 10× expected peak traffic and retain the result with the release evidence.
