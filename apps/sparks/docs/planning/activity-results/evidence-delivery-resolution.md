# Evidence-delivery resolution

Date: 2026-11-16  
Finding: R2, Major, from the [single-agent review](review_report.md)  
Classification: PROPOSE FIX, applied under the user's instruction to fix the next finding.  
Status: Resolved in design. Implementation and runtime acceptance remain pending.  
Method: Direct resolution by the same agent, without subagents or an independent Goldfish review. The EGM resolution process is applied to the existing single-agent report.

## Discrepancy and rationale

The reviewed design permitted 8 MiB attempts and 256 KiB chunks while asking finalization to contain complete evidence. It did not define assembly, sequence/hash boundaries, acknowledgements or interrupted delivery. That could make a valid attempt impossible to submit or allow incompatible browser/server implementations.

## Applied contract

Section 4 of the [design](activity-results.md) now selects sequential validated append through the existing checkpoint operation. Each atomic batch extends an accepted sequence/hash and returns its revision, state hash, byte count and receipt. Event rows form the assembled evidence; no upload-staging service or table is added. A rolling hash over length-framed canonical event bytes stays the same across different batch boundaries.

The shared canonical representation specifies UTF-8, key ordering, integer and string rules. New mutation payloads travel as canonical JSON text so the validator can inspect duplicate keys before JSONB conversion. Request limits include the outer RPC envelope and text escaping. Events and saved state have individual bounds, and metadata-only finalization has a 16 KiB cap. The server recomputes all hashes and byte counts.

Terminal submission references the exact accepted sequence, prefix hash and state hash, plus writing and finish references. It sends no event array. Validation uses the accepted server stream; score lock, required corrections and later full confirmation preserve the existing product rules and R1's transaction/reward protections.

The response table defines identical-operation replay, changed-operation conflicts, stale revisions, missing/overlapping/divergent prefixes, invalid events and limit failures. The outbox distinguishes durable local intents from materialized immutable requests. It freezes an operation before sending, replays it after a lost response and materializes a valid suffix only after reconciling the accepted head. Pending local work survives errors. Evidence recovery reads are paged and bounded. Replacement computers remain unrestricted.

The final design and retained draft agree. Their RPC/schema contracts, implementation manifest and verification matrix now require matching JavaScript/SQL canonical vectors, bounded append packing, receipt replay and reference-only finalization. R3–R5 remain open.

## Verification and limits

Documentation verification checks final/draft identity, relative links, Markdown structure, the original review baseline digest, removal of the old cumulative-replay/full-evidence-submit contract and coverage of required protocol fields/errors.

A standalone Python transport model exercises canonical key/escape handling, batch-independent hash chaining, request packing near the 8 MiB event bound, lost-acknowledgement replay both before and after later batches, rejection of out-of-order delivery without model mutation, and complete accepted-head reconstruction. The example contained 3,948 synthetic events totaling 8,387,286 framed bytes, delivered in 33 requests. The largest canonical request was 261,693 bytes and the reference-only terminal request was 505 bytes. The 262,144-byte request and 8,388,608-byte evidence caps both held. The model uses synthetic events and receipts. It is not the future browser implementation, SQL validator, gateway integration, score calculator or reward ledger.

Actual acceptance must upload a multi-chunk attempt through the browser and real SQL operations, interrupt delivery, lose acknowledgements, replay and finalize, then compare confirmed results and rewards with uninterrupted delivery. Cover byte/count boundaries, state-only revisions, incorrect/overlapping/missing events, changed payloads, invalid hashes, required writing dependencies and rollback with retained local work. Shared JavaScript/SQL fixtures and measured capacity gates remain pending; this resolution reports no feature-test, hosted or deployment pass.
