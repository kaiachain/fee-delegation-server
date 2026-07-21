# Never re-list full API key secrets

Management and list APIs must not return full `kaia_*` values after creation. Full secrets are shown only in the create response; subsequent reads expose a prefix (or redacted form) only. Editor global create rights (ADR 0002) do not justify re-listing secrets — access control and secret hygiene are separate controls.
