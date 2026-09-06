# Staging security acceptance checklist

The release owner dates and signs each item. A release does not proceed with an unexplained failure.

- [ ] Canonical `NEXT_PUBLIC_APP_URL` is HTTPS and matches the deployed origin.
- [ ] `AUTH_SECRET` and `CRON_SECRET` are unique random values of at least 32 characters; production has no development defaults.
- [ ] CSP, HSTS, frame denial, content-type, referrer, and permissions headers are present on HTML and API responses.
- [ ] Magic links are single-use, expire, and are rate-limited by email and source IP.
- [ ] Session cookies are HTTP-only, secure in production, same-site constrained, and rotate/expire as documented.
- [ ] Cross-origin state-changing requests are rejected; forwarded host/IP headers are trusted only from the hosting platform.
- [ ] Non-admin users cannot call any admin mutation. Admin impersonation cannot target another admin and produces start/stop audit events.
- [ ] Every moderation mutation produces an append-only database audit event with actor, action, target, and time.
- [ ] User-uploaded content is validated for type and size and served from the designated object-storage/CDN origin.
- [ ] Dependency review and secret scanning pass for the release commit.
- [ ] Email worker rejects missing/invalid bearer tokens, leases rows once, retries failures, and exposes dead letters operationally.
- [ ] External health monitoring, structured error logs, alert routing, database backups, and point-in-time recovery are enabled.
- [ ] The latest isolated restore and staging rollback exercises met RPO/RTO and have linked evidence.
- [ ] Account export/deletion, blocking, reporting, disputes, and moderator enforcement were exercised in staging.
