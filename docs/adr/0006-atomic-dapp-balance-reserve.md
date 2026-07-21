# Atomic DApp balance reserve before fee-payer sign

On mainnet, fee delegation must reserve (debit or lock) DApp balance atomically before signing/broadcasting—via row lock or optimistic versioning on `DApp.balance`—and release/refund if the transaction fails to confirm. Checking balance then settling after broadcast is insufficient under concurrency and can overspend the DApp allocation against the shared fee-payer wallet.
