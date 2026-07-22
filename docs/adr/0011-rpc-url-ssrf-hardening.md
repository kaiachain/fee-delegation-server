# RPC URL SSRF hardening

When creating, pinging, or loading RPC URLs into the provider pool, reject non-`http`/`https` schemes and destinations that resolve to private, loopback, link-local, or cloud metadata address ranges (including IPv4-mapped IPv6 forms). Outbound health checks do not follow HTTP redirects. Super Admin trust does not remove this check (stolen session / insider). `RPC_URL` env fallback is filtered the same way (unsafe entries skipped). A stricter hostname allowlist remains a follow-up.
