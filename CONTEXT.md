# Fee Delegation Server

Kaia gas fee-delegation service: registered DApps submit user-signed transactions; the service co-signs as fee payer, broadcasts, and accounts usage against each DApp’s allocated balance on mainnet.

## Language

**Mainnet gate**:
The production operating mode in which fee delegation requires DApp authorization (API key and/or address whitelist), an active DApp with sufficient allocated balance, and post-broadcast settlement against that balance.
_Avoid_: “strict mode”, “prod checks”

**Testnet open relay**:
An intentional development mode that signs and broadcasts fee-delegated transactions without authorization, balance, or settlement checks. Allowed only when `NETWORK` is set exactly to `testnet`. Unset or invalid `NETWORK` is a startup failure, not open relay.
_Avoid_: “disabled security”, “no auth”

**DApp balance**:
Off-chain allocated KAIA budget for a DApp, reserved atomically before mainnet fee-payer signing and finalized (or released) on settlement after broadcast outcome.
_Avoid_: pool balance, wallet balance, ACCOUNT_ADDRESS balance

**Pool balance**:
On-chain KAIA held by the fee-payer account used to pay gas.
_Avoid_: DApp balance

**Production secret gate**:
Startup rule that rejects known placeholder values for `EMAIL_AUTH_JWT_SECRET` and `NEXTAUTH_SECRET` whenever `NODE_ENV=production`.
_Avoid_: “secret rotation” (different concern)

**API key**:
Bearer credential scoped to one DApp that authorizes fee-delegation and balance reads for that DApp. The full secret is returned only at creation; later list/management views expose a redacted form (e.g. prefix), not the full value.
_Avoid_: admin token, JWT

**Address whitelist**:
Contract and/or sender addresses bound to a DApp that authorize fee delegation when the request matches those addresses.
_Avoid_: allowlist (unless speaking generically), ACL

**API-key open relay**:
A DApp authenticated only by API key with an empty address whitelist. On mainnet this is intentional: the key authorizes any `to`/`from` against that DApp’s balance. Adding contracts or senders tightens the DApp to those addresses.
_Avoid_: misconfiguration, unrestricted relay (unless describing testnet open relay)

**Editor**:
An operator role that may manage DApp configuration. Until further hardening, Editors are treated as globally trusted for API key creation across all DApps (not limited to `UserDappAccess`), and may list users and trigger password resets (identity-admin tightening deferred). Effective role and active status for email users are always taken from the User record on each request, not solely from the JWT payload.
_Avoid_: scoped editor (except when describing the future intended model), admin (prefer Super Admin when that role is meant)
