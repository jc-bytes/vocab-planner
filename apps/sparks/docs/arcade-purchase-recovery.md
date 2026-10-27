# Arcade purchase recovery

Authenticated purchases retain one owner-scoped event ID, game ID and original client ID until the paid minute is durably credited. A timeout or lost response leaves an unresolved intent; it does not prove the server charged it. The purchase controller first uses the owned, replay-only lookup. A paid receipt is credited once, including when current required work blocks new spending. Only a confirmed missing receipt permits an eligibility check followed by retrying the original intent. Invalid responses and transport failures never fall back to spending.

`studentArcadePurchase.js` owns the bounded purchase operation. The game-only `studentArcadeSessionStorage.js` stores pending receipt, remaining seconds and last-applied event in one `student_arcade_session_v2:<owner>` JSON record. Crediting the minute and clearing the pending receipt are one storage write. Timer writes preserve receipt metadata. The v2 key migrates v1 time once and retains a zero-time tombstone, preventing older open releases from replacing receipts or resurrecting spent time.

Browsers with Web Locks serialize receipt operations across tabs. Normal clock persistence uses the same owner lock with `ifAvailable`, skips a held purchase and adopts a newer receipt marker. Lock acquisition and transport share a 30-second deadline. Browsers without Web Locks retain the single-tab path and preserve known pending receipts; cross-tab serialization is not guaranteed there. Corrupt receipt data or a failed strict storage write blocks a new debit.

Only the two explicit post-receipt-lookup business rejections, insufficient coins and insufficient formative time, clear a rejected intent. Authentication failures, receipt conflicts, unknown failures and transport failures retain the original receipt.

## Release order

Apply `20261025032134_arcade_purchase_receipt_recovery.sql` before publishing the new frontend. It adds authenticated-only `start_student_arcade_minute_owned_v1`, which checks the expected browser owner against `auth.uid()` before calling the existing implementation. The client has no fallback to the older unowned endpoint. This check prevents an SDK token selected after an account switch from charging the replacement user.

The matching client also requires `20261025145937_recover_paid_arcade_minute_without_purchase.sql`. Its lookup cannot create a receipt or debit. See [the replay-only contract](arcade-receipt-lookup.md) for its response validation, ownership checks and rollout requirements.

The original three-argument endpoint and its permissions remain compatible with older releases. Replaying its existing receipts uses the original server-recorded price and returns fresh wallet fields. Global server pricing, 60-second duration, formative allowances and revoked teacher gift permissions remain unchanged.

The migration has been tested in a disposable local database and applied as SQL to the default local development stack without adding migration history. Hosted databases and the public deployment have not changed. Reconcile the reviewed migration history through the project's normal release procedure before deployment.

## Verification

`npm run test:arcade-purchase:database` clones only the local schema with its owners and ACL. It checks price changes, receipt replay, fresh balances, request conflicts, ownership, anonymous denial and unchanged gift restrictions. An isolated PostgREST gateway also exercises the real SDK's delayed-token path and verifies that a replacement token receives 403/42501 without changing either wallet.

`npm run test:ui:arcade-purchase-recovery` uses dedicated local audit fixtures, real authentication/transport/SQL and real purchase/lifecycle controllers. It temporarily completes only the known audit student's exact fixture publication, checks the real class readiness and required-work gate, and restores its normalized progress afterward. Material, teacher, school, class, title and publication-key checks reject arbitrary assignments. Scenarios cover lost responses and reload, two-tab clock interaction, Stop/concurrent actions, sign-out recovery and storage quota failures. Paid recovery must make one spend call, one replay-only lookup and one ledger debit. It restores audit balances and removes only its own event receipts and ledgers. Set `UI_ARCADE_PURCHASE_DIST=1` to test the built frontend after building it.
