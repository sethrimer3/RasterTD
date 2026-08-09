# Equatoria Idle — Steam Production Checklist

Last updated: 2026-08-08

This is the end-to-end list of what must happen before Equatoria Idle can be published on Steam. The desktop build already runs under Electron; the gap is packaging, Steamworks integration, and the store/business paperwork.

For how the desktop build works today (Electron shell, CSP, build modes, batch launchers), see [../ELECTRON.md](../ELECTRON.md).

## Current state

| Item | Status |
|---|---|
| Electron shell (`electron/main.cjs`) | Working — `contextIsolation: true`, `sandbox: true`, `webSecurity: true`, no preload API |
| Desktop build (`npm run build:desktop`) | Working — Vite base `./`, assets copied by `scripts/copy-assets.mjs` |
| Custom `equatoria://app/` protocol + production CSP | Implemented |
| Save persistence | Chromium `localStorage` under `.electron-user-data` |
| Packaging into a distributable `.exe` | **Not set up** — no electron-builder / electron-forge / Squirrel config |
| Code signing certificate | **Not obtained** |
| Steamworks partner account | **Not created** |
| Steam App ID | **Not assigned** |
| Steam integration (overlay, Cloud, achievements) | **Not integrated** |
| Icon | `ASSETS/icon/EquatoriaIdle_Icon.ico` exists — ready to wire into the packager |
| Store page assets (capsules, trailer, screenshots) | **Not produced** |

---

## 1. Steamworks account and fee

1. **Create a Steamworks partner account** at [partner.steamgames.com](https://partner.steamgames.com).
2. **Pay the Steam Direct fee** — US$100 per app. It is recoupable against the first US$1,000 of adjusted gross revenue.
3. **Complete the tax and banking paperwork** — a tax interview (W-9 for US individuals, W-8BEN otherwise) and payout bank details. **Nothing can launch until tax info is verified**, and verification can take several business days.
4. **Identity verification** — Valve verifies the paying individual/company.
5. **30-day waiting period** — after the Steam Direct fee is paid for an app, Valve enforces a minimum wait before that app can release. Budget for it.

## 2. Packaging the Electron app (the biggest engineering gap)

Steam expects a self-contained folder of files it can copy to the user's disk and launch. Today `npm run desktop` runs Electron from `node_modules`, which is not shippable.

### 2.1 Add a packager
Adopt **electron-builder** (recommended — best Windows target support and NSIS/portable output) or electron-forge. Required configuration:

- `appId`, `productName` ("Equatoria Idle"), and `copyright`.
- `win.icon` → `ASSETS/icon/EquatoriaIdle_Icon.ico`.
- Target `dir` output for Steam. Steam handles installation itself, so **do not ship an NSIS installer as the Steam depot** — upload the unpacked application directory. Keep an NSIS/portable target around only if you also want a direct-download build.
- `files` glob must include `dist/` (built by `build:desktop`) and exclude source, tests, and dev dependencies.
- Verify `asar` packing does not break the `equatoria://app/` protocol handler or the copied `ASSETS` folder — test the packaged build, not just `npm run desktop`.

### 2.2 Decide platforms
- **Windows x64** — the primary target; the existing `.bat` launchers and `.ico` assume it.
- **Linux** — cheap to add with electron-builder and gets Steam Deck / Proton users a native path. Optional for v1.
- **macOS** — requires an Apple Developer account (US$99/yr), notarization, and a hardened-runtime signing setup. Skip for v1 unless there's demand.

### 2.3 Code signing (Windows)
Unsigned Electron executables trigger SmartScreen warnings. Steam's client mitigates but does not eliminate this.

- Obtain an **OV or EV code signing certificate**. Since June 2023, all new certs require hardware/HSM key storage (cloud signing services like Azure Trusted Signing or SSL.com eSigner are the practical route).
- Wire signing into the electron-builder `win.sign` config.
- Not strictly blocking for a Steam release, but strongly recommended.

### 2.4 Startup hardening
Before shipping, confirm on a clean machine with no dev tooling:

- The game launches from a double-clicked `.exe` with no Node/npm installed.
- `electron-runtime.log` and `.electron-user-data` are written to a **user-writable location** (`app.getPath('userData')`), not the install directory — Steam installs under Program Files, which is read-only for non-admin users. **Verify this in `electron/main.cjs`; a hardcoded relative path will break saves for real users.**
- The GPU/sandbox startup flags currently disabled for Windows compatibility are still appropriate for a packaged build.
- No dev-server fallback path is reachable in production (`EQUATORIA_ELECTRON_DEV_SERVER` must be unset/ignored in release builds).

## 3. Steamworks integration

### 3.1 Minimum viable (required)
- **App ID** — assigned when the Steam Direct fee is paid.
- **Launch options** — configure the executable path, arguments, and OS per depot in the Steamworks app admin.
- **Depots** — one per platform. Upload with SteamPipe (`steamcmd` + a `app_build.vdf` / `depot_build.vdf` pair). Script this so releases are repeatable.
- **Steam overlay** — an Electron/Chromium app does not get the overlay for free. It requires the Steam overlay hooking the process; verify it works and, if not, either fix it or note in the store page that the overlay is unsupported.

### 3.2 Recommended integration
Adding these requires the Steamworks SDK via a Node binding such as `steamworks.js`, which pulls native modules into the Electron build:

- **Steam Cloud** — sync saves. Since saves live in Chromium `localStorage`, either point Cloud at the `Local Storage` leveldb directory (fragile) or **refactor saves to a plain JSON file in `userData`** and sync that. The refactor is the right call and should happen before launch, not after — changing the save format post-launch risks breaking players' progress.
- **Achievements** — the game already has an achievements system (`docs/ACHIEVEMENTS.md`); mapping it onto Steam achievements is high value and low risk. Requires defining each achievement with icons in the Steamworks admin.
- **Steam Input / controller support** — optional; declare accurately on the store page.
- **Trading cards, leaderboards, rich presence** — optional post-launch.

### 3.3 Steam Deck
- Deck verification is optional but valuable. Requirements include full controller support, readable text at 1280×800, and no external launcher.
- If you ship a Linux depot, test under Proton and native. If Windows-only, Proton compatibility should still be verified.

## 4. Store page

Valve requires the store page to be complete and reviewed before release. Assets and their current specs:

| Asset | Size |
|---|---|
| Header capsule | 920 × 430 |
| Small capsule | 462 × 174 |
| Main capsule | 1232 × 706 |
| Vertical capsule | 748 × 896 |
| Library capsule | 600 × 900 |
| Library header | 920 × 430 |
| Library hero | 3840 × 1240 |
| Library logo | transparent PNG, up to 1280 × 720 |
| Screenshots | minimum 5, 1920 × 1080 preferred |
| Trailer | strongly recommended; must be uploaded and processed by Valve |

Also required:
- Short description (≤ 300 characters) and full "About This Game" description.
- Genre and tags.
- System requirements — minimum and recommended. Be realistic for an Electron app (~200 MB+ install, 4 GB RAM minimum, Windows 10 64-bit).
- Content survey / maturity declaration — the game has no mature content; answer accordingly.
- Pricing across all currencies, or "Free to Play".
- Release date. **The store page must be public for at least two weeks before launch** so it can accumulate wishlists — this is a hard Valve requirement, not a marketing suggestion.

## 5. Valve review gates

1. **Build review** — Valve runs the game briefly to check it launches and matches the store page. Turnaround is typically a few business days.
2. **Store page review** — separate from build review; checks assets, description accuracy, and content declarations.
3. Both must pass, the 30-day post-payment period must elapse, and the store page must have been public for 2 weeks, before you can set a release date and go live.

## 6. Release sequence

1. Pay Steam Direct fee, complete tax/banking → App ID assigned
2. Package the Electron app; test on a clean Windows machine
3. Upload the first build to a depot on a private branch via SteamPipe
4. Build the store page and submit it for review
5. Pass build review
6. Publish the coming-soon store page (starts the 2-week clock and wishlist accumulation)
7. Run a private/beta branch with a password for external playtesters
8. Set the release date and launch

## 7. Post-launch obligations

- **Patching** — every update is a SteamPipe upload; script it so a patch is one command.
- **Community and reviews** — Steam discussions and reviews are public and visible on the store page; plan to monitor them.
- **Crash reporting** — Electron gives you nothing by default. Add at minimum a local crash log the user can send, or an opt-in reporter. Note that adding a network reporter changes the privacy story.
- **Refunds** — Steam's standard policy (under 2 hours played, within 14 days) applies automatically. Idle games get long sessions fast, which in practice limits refund exposure.

## Ordered blocking list

1. Create Steamworks account, pay Steam Direct, complete tax/banking verification
2. Add electron-builder and produce a real packaged Windows build
3. Fix save/log paths to `userData` so the game works when installed under Program Files
4. Test the packaged build on a clean machine with no dev tooling
5. Refactor saves to a JSON file so Steam Cloud can sync them
6. Set up depots and a scripted SteamPipe upload
7. Produce all capsule art, screenshots, and a trailer
8. Complete and publish the store page (2-week minimum before launch)
9. Pass Valve build and store review
10. Map existing achievements onto Steam achievements (recommended before launch)
11. Set release date after the 30-day period elapses
