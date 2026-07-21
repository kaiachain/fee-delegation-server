# API-key open relay is intentional on mainnet

When a DApp authenticates with an API key and has no contracts or senders configured, mainnet fee delegation allows any `to`/`from` and settles against that DApp’s balance. We rejected requiring a non-empty whitelist (or an explicit open-relay flag) because operators use “API key alone” as the intended open-relay shape for a DApp; adding whitelist entries is how they tighten scope later.
