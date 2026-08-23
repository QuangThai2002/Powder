# powder-admin-transactions · 20.9.0

Admin-only diagnostics for `transaction_receipts_v2090` and recovery queue.

- `state`: owner/admin/support can inspect posture and recent receipts.
- `scan`: owner/admin can enqueue stale pending receipts for investigation. It never replays a resource mutation automatically.
- `resolve`: owner only. Marks an investigated receipt as committed/not committed/cancelled; it does not directly credit or debit resources.

The service-role key is required in the Edge Function environment and must never be exposed to the browser.
