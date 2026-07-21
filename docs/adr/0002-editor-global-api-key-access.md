# Editors may create API keys for any DApp (deferred scoping)

Email Editors are not DApp-scoped for API key creation today: any Editor may mint a key for any DApp. We considered enforcing `UserDappAccess` on create/list/mutate and rejected changing it for now; global Editor access remains acceptable until a future hardening pass. Super Admin / Google whitelist global access is unchanged.
