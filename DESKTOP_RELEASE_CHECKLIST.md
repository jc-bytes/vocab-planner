# Technology 6A Desktop Release Checklist

## Local macOS Build

1. Run `npm install`.
2. Run `npm run desktop:build`.
3. Open `src-tauri/target/release/bundle/macos/Technology 6A.app`.
4. Confirm Student and Teacher pages load.
5. Confirm first login works online.
6. Reopen without internet and confirm the cached session still opens until manual logout.

## macOS Installer

1. Run `npm run desktop:build:mac-dmg`.
2. If DMG bundling fails locally, use the generated `.app` bundle or rerun on a clean macOS build machine.
3. Before regular student distribution, add Apple Developer signing and notarization.

## Windows Installer

1. Build on Windows or a Windows CI runner.
2. Run `npm install`.
3. Run `npm run desktop:build:windows`.
4. Test the generated NSIS installer on a fresh Windows user profile.
5. Before regular student distribution, add code signing.

## Manual Update Flow

1. Increase the version in `package.json` and `src-tauri/tauri.conf.json`.
2. Build the app again.
3. Upload the installer or app bundle to the school download location.
4. Tell students to install the new version over the old one.
