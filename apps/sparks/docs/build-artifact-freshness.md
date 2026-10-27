# Build artifact freshness

`npm run desktop:build:web` calls `scripts/build-web.mjs`. It preserves the existing Vite, asset copy, catalog validation, game validation, lazy graph validation, worker generation and final size gate in that order.

Before Vite starts, the wrapper fingerprints application HTML, JavaScript, CSS, public configuration, images, the catalog manifest and its referenced JSON, package/lock files and the build implementation. It compares those inputs again after worker generation. A separate process fingerprints effective public Vite configuration, including dotenv expansion and environment precedence; no environment values or private env-file contents are stored in the artifact.

The wrapper records input digests and hashes of every emitted regular file in `dist-desktop/.vite/artifact-identity.json`. This includes copied game assets, vocabulary JSON, the Vite manifest and generated worker. The metadata itself is included in the unchanged size gate. A failed build removes its usable identity.

Owned Vite preview checks and the worker-lifecycle baseline reject missing identities, changed/deleted/added inputs, changed public build configuration and altered/missing/additional output files. The worker check verifies the original build before making intentional variants in its temporary directory. Source-mode servers and explicitly managed external URLs remain separate cases; an external URL does not prove the identity of the local build.

Use the official build again when a freshness check fails. Documentation and tests do not invalidate application output. Catalog files deliberately absent from the manifest do not participate. Ordinary runtime source names such as `credentials.js` or a `test/` subdirectory do participate. Source/output symbolic links and hard-linked identity files are rejected before cleanup or writing can affect another file.

Freshness establishes which local inputs and files were checked. It does not establish that release tests passed, that installed dependency contents match the lock file, that output was deployed, or that a hosted service or physical device works. CI still installs dependencies and runs the complete release gates. The identity is not a security attestation against someone who can rewrite both the artifact and its metadata.
