# Build artifact freshness

`npm run desktop:build:web` calls `scripts/build-web.mjs`. It preserves the existing Vite, asset copy, catalog validation, game validation, lazy graph validation, worker generation and final size gate in that order.

Before Vite starts, the wrapper fingerprints application HTML, JavaScript, CSS, public configuration, images, the catalog manifest and its referenced JSON, package/lock files and the build implementation. It compares those inputs again after worker generation. A separate process fingerprints effective public Vite configuration, including dotenv expansion and environment precedence; no environment values or private env-file contents are stored in the artifact.

The wrapper records input digests and hashes of every emitted regular file in `dist-desktop/.vite/artifact-identity.json`. This includes copied game assets, vocabulary JSON, the Vite manifest and generated worker. The metadata itself is included in the unchanged size gate. A failed build removes its usable identity.

Owned Vite preview checks and the worker-lifecycle baseline reject missing identities, changed/deleted/added inputs, changed public build configuration and altered/missing/additional output files. The worker check verifies the original build before making intentional variants in its temporary directory. Source-mode servers and explicitly managed external URLs remain separate cases; an external URL does not prove the identity of the local build.

Use the official build again when a freshness check fails. Documentation and tests do not invalidate application output. Catalog files deliberately absent from the manifest do not participate. Ordinary runtime source names such as `credentials.js` or a `test/` subdirectory do participate. Source/output symbolic links and hard-linked identity files are rejected before cleanup or writing can affect another file.

CI keeps the same production public configuration from its final application build
through all compiled acceptance checks. Its later Pages packaging deliberately adds
the sibling Grade 9 sites and assets retained for already-open student tabs. The
application build identity describes the checked output before those additions;
it is not a receipt for the final Pages package. Downloaded packaged output with
these additions will fail the strict application-only preview identity check.
Promotion can also change the retained-asset set. Neither path currently records
a separate complete-package identity. Do not restamp those outputs as though
application acceptance had checked the additional files.

Freshness establishes which local inputs and files were checked. It does not establish that release tests passed, that installed dependency contents match the lock file, that output was deployed, or that a hosted service or physical device works. CI still installs dependencies and runs the complete release gates. The identity is not a security attestation against someone who can rewrite both the artifact and its metadata.
