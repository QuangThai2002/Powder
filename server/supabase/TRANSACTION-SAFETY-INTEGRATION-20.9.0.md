# Powder 20.9.0 — Transaction Safety Integration Contract

`transaction_receipts_v2090` is service-role only. Player clients send a `txKey`, but the server remains authoritative.

For every Economy / Inventory / Mail / Reward mutation:

1. Parse and validate the authenticated `user.id`, operation payload and `txKey`.
2. Call `beginTransaction()` from `functions/_shared/transaction-safety-v2090.ts`.
3. If the receipt is already `committed`, return its stored result without running the business mutation again.
4. If another lease is still active, return `409` / retry-after instead of running concurrently.
5. Run the canonical database mutation.
6. Only after the mutation succeeds, call `commitTransaction()` with the canonical server result.
7. On failure call `failTransaction()`. Network/5xx failures stay retryable; validation/business-rule failures become failed.

Never grant, debit, purchase, equip or claim from the browser. Never automatically replay a stale recovery item. Recovery must first verify the canonical economy/inventory/reward tables and only then mark the receipt committed or not committed.

The current artifact contains player integration for `powder-economy`, `powder-inventory`, `powder-liveops` and `powder-learning-events`. Their remote Edge Function source is not present in this repository, so those deployed functions must adopt this shared server contract for end-to-end 20.9 guarantees.
