# RPC URL SSRF light hardening

When creating or pinging RPC URLs, reject non-`http`/`https` schemes and destinations that resolve to private, loopback, link-local, or cloud metadata address ranges. Super Admin trust does not remove this check (stolen session / insider). A stricter hostname allowlist remains a follow-up.
