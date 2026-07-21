# Rate-limit public fee-delegation writes (in-process first)

Apply in-process rate limiting (same style as `/api/email-auth/*`) to public write endpoints that spend fee-payer resources—at minimum `/api/signAsFeePayer` and `/api/gasFreeSwapKaia`—keyed by IP and by API key when present. Redis-backed (or equivalent) shared limiting across replicas is a follow-up, not a blocker for this pass.
