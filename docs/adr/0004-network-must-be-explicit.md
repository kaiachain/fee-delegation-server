# NETWORK must be explicit mainnet or testnet

The process must fail fast at startup if `NETWORK` is unset or not exactly `mainnet` or `testnet`. Missing/`undefined` must never be treated as testnet open relay. Only an explicit `NETWORK=testnet` enables open relay; only `NETWORK=mainnet` enables the mainnet gate (auth, balance, settlement).
