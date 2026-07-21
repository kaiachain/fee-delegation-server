# Auth secrets must be non-default in production

When `NODE_ENV=production`, the process must refuse to start if `EMAIL_AUTH_JWT_SECRET` or `NEXTAUTH_SECRET` is unset or still a known placeholder (`change-me-in-env`, `fallback-secret-for-development`). Local/development may keep defaults or an explicit escape hatch. Placeholder secrets must never be treated as valid in production.
