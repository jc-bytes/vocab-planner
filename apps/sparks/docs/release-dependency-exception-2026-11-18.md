# Temporary release dependency exception — November 18, 2026

The user authorized this exception on November 18, 2026 to allow the teacher Home refresh release to continue. It expires at **November 25, 2026, 00:00 UTC**. It is a release risk acceptance, not a vulnerability fix.

The exception covers only GHSA-fc5q-39xc-vjpf in the locked development dependency `picomatch@4.0.5`, plus npm's findings inherited solely from that advisory. The advisory describes excessive regular expression work for crafted repeated extglob patterns. The registry and advisory had no patched release when checked. The production dependency audit reported no vulnerabilities.

The release audit still requests the full npm audit report including build and test tools. It fails for any other high or critical advisory, any affected production dependency, a changed lockfile, a different picomatch version, incomplete audit data, registry failure or an expired exception. The exception is tied to the SHA256 of the complete package lock in `scripts/security-audit-exception.json`.

Build patterns are controlled by repository code. The service worker generator uses an explicit file list and empty `globPatterns`; classroom answers do not supply build globs. This reduces exposure but does not remove the vulnerable package or eliminate build risk.

Before expiry, check for an upstream patched version, update the dependency lock, remove the exception and rerun release validation. The audit automatically blocks continued use of this exception after expiry; an already published site keeps working.

Validation covers the allowed advisory and inherited findings, expiry, changed lock or package version, production scope, unrelated advisories, critical findings, missing causes, dependency cycles and registry errors. The release workflow uses the same audit command as the local release command.
