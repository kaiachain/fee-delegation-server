# Hygiene pass: whitelist trim only; other medium/low deferred

In this remediation pass, fix `GOOGLE_WHITELIST` parsing to trim entries after split. Defer for later: production RLP/tx log redaction, password obfuscation / plaintext-acceptance behavior, CORS `*` on public APIs, unauthenticated Swagger `/api/docs`, and client-side decimal-input ReDoS hardening.
