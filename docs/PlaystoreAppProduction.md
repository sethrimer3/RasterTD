# Equatoria Idle — Google Play Store Production Checklist

Last updated: 2026-08-08

This is the end-to-end list of what must happen before Equatoria Idle can be published on the Google Play Store. It covers the account, the build, the store listing, and the compliance forms.

For the mechanics of *building* the Android bundle (JDK, SDK, keystore, gradle commands), see [ANDROID_RELEASE.md](ANDROID_RELEASE.md). This document is the release checklist that sits on top of it.

## Current state

| Item | Status |
|---|---|
| Capacitor Android project (`android/`) | Exists, builds |
| Package ID `com.sethrimer.equatoriaidle` | Locked in — **cannot be changed after first publish** |
| Target/compile SDK 36, min SDK 24 | Meets Play's `targetSdk >= 35` requirement |
| Release signing config in `app/build.gradle` | Wired to `android/keystore.properties` |
| Upload keystore | **Not generated yet** |
| `versionCode` / `versionName` | Still `1` / `"1.0"` — must increment per upload |
| Launcher icon | Capacitor placeholder — **must be replaced** |
| Splash screen | Not configured |
| Play Console account | **Not created yet** |
| Privacy policy URL | **Does not exist yet** |
| Store listing assets (screenshots, feature graphic) | **Not produced yet** |
| Runtime network calls | None. `supabase/leaderboard.sql` exists but no client code references it — keep it that way, or the Data Safety form changes |

---

## 1. Account and legal prerequisites

1. **Google Play Developer account** — one-time US$25 registration at [play.google.com/console](https://play.google.com/console).
2. **Identity verification** — Google requires a government ID and, for individual accounts, a verified phone/address. Allow several days.
3. **Developer name and contact email** — shown publicly on the store listing. Pick a name you're comfortable publishing.
4. **New personal-developer testing requirement** — accounts registered as *individuals* (not organizations) must run a closed test with at least 12 testers opted in continuously for 14 days before production access is unlocked. Plan the calendar around this; it is the single longest lead-time item.
5. **Payments profile** — only needed if the app will ever be paid or carry in-app purchases. Equatoria Idle currently has neither.

## 2. Privacy policy (blocking)

Play requires a hosted, publicly reachable privacy policy URL for every app, even one that stores nothing off-device.

- Host it on GitHub Pages alongside the existing web build (e.g. `https://sethrimer3.github.io/Equatoria_Idle/privacy.html`).
- Content must state: save data is stored locally via `localStorage` on the device, is not transmitted anywhere, is not shared with third parties, and is deleted when the app is uninstalled or app data is cleared. Include a contact email.
- Add the file to the repo (`public/privacy.html` or equivalent) so it deploys with the Pages build and cannot rot.

## 3. Build readiness

### 3.1 Generate and back up the upload keystore
Follow the keystore section of [ANDROID_RELEASE.md](ANDROID_RELEASE.md). Losing this file means you can never update the app under the same listing.

- Store `android/release.keystore` plus both passwords in a password manager **and** an offline backup.
- Confirm `android/keystore.properties`, `*.keystore`, and `*.jks` are gitignored, and that `git status` is clean before every push.
- Enroll in **Play App Signing** during the first upload — Google then holds the app signing key, and the keystore above becomes only the *upload* key (recoverable via support if lost).

### 3.2 Version numbering
Set a real scheme in `android/app/build.gradle` before the first upload:

- `versionCode` — a monotonically increasing integer. Every upload to Play, including internal-test builds, needs a higher value than any previously uploaded bundle.
- `versionName` — the human-readable string shown in the listing (e.g. `"1.0.0"`). Keep it in sync with `package.json` `version`.

### 3.3 Launcher icon (blocking for production quality)
Replace the Capacitor placeholder in `android/app/src/main/res/mipmap-*/`:

- Source art already exists: `ASSETS/icon/EquatoriaIdle_Icon.png`.
- Use Android Studio → **New → Image Asset → Launcher Icons (Adaptive and Legacy)** to regenerate all densities plus the adaptive `mipmap-anydpi-v26` foreground/background layers.
- Verify the icon is legible when masked to a circle and a squircle.

### 3.4 Splash screen (recommended)
Add `@capacitor/splash-screen` and a branded splash so the app doesn't show a white flash while the WebView boots. Not blocking, but noticeable on cold start.

### 3.5 Build and self-test the release bundle
```bash
npm run android:build
```
Output: `android/app/build/outputs/bundle/release/app-release.aab`

Before uploading, install the exact release build on a physical device via bundletool or an internal-test track and confirm:

- Cold start works with no network connection (airplane mode) — the game must be fully offline-capable.
- Audio starts only after first tap and does not break on app backgrounding.
- Orientation changes (portrait ↔ landscape) do not restart or corrupt the run.
- Android back button behaves per the handler in `src/capacitor-android.ts`: secondary tab → equation tab, equation tab → exit confirmation.
- Save data survives force-stop and reboot.
- Performance on a low-end device (2–3 year old midrange phone), not just a flagship.

## 4. Store listing assets

All of these must be produced before the listing can be submitted. Sizes are Play's current requirements.

| Asset | Requirement |
|---|---|
| App name | ≤ 30 characters — "Equatoria Idle" fits |
| Short description | ≤ 80 characters |
| Full description | ≤ 4000 characters |
| App icon | 512 × 512 PNG, 32-bit, no alpha transparency |
| Feature graphic | 1024 × 500 PNG or JPG — shown at the top of the listing |
| Phone screenshots | 2–8 required, 16:9 or 9:16, min 320 px on the short edge |
| Tablet screenshots | Optional, but required to be eligible for tablet/Chromebook surfacing |
| Promo video | Optional YouTube URL |

Existing art in `ASSETS/` (icon, sprites, `mockup.png`) is a starting point but the feature graphic and screenshots need to be composed fresh from actual gameplay.

## 5. Play Console compliance forms

Every one of these must be completed or the release cannot be rolled out.

1. **App access** — declare that all content is available without login (true today; no accounts exist).
2. **Ads** — declare **no ads**. Adding an ad SDK later changes this and the Data Safety form.
3. **Content rating questionnaire** (IARC) — answer honestly. An idle math game with no violence, no user communication, and no purchases should land at Everyone / PEGI 3.
4. **Target audience and content** — if you declare the app targets children under 13, Families Policy and stricter data rules apply. Declaring 13+ is simpler; only choose child-targeted if that's genuinely the audience.
5. **Data safety** — with the current build: no data collected, no data shared, data stored on-device only (`localStorage`), no data deletion request mechanism required. **This declaration becomes false the moment the Supabase leaderboard is wired up** — see §7.
6. **Government apps / financial features / health** — all N/A.
7. **News app** — N/A.
8. **COVID-19 contact tracing** — N/A.
9. **Advertising ID** — the app does not use it; confirm no dependency pulls in Play Services ads. Declare accordingly in the manifest and the form.

## 6. Release rollout sequence

1. **Internal testing** — up to 100 testers by email, available within minutes of upload. Use this for the first real device validation.
2. **Closed testing** — required for the 12-tester / 14-day individual-account rule (§1.4). Recruit testers early.
3. **Open testing** (optional) — public opt-in beta.
4. **Production** — submit for review. First-time reviews commonly take a few days and can take longer; subsequent updates are usually faster.
5. **Staged rollout** — release production at 10–20% and watch the Play Console vitals dashboard (ANR rate, crash rate) before going to 100%.

## 7. If the leaderboard ships

`supabase/leaderboard.sql` exists but no client code calls it. If online leaderboards are enabled before launch, the following change:

- **Data safety form** must declare collection of whatever is submitted (player name / score) and its transmission to a third party (Supabase).
- **Privacy policy** must name Supabase as a processor and describe retention and deletion.
- **Account deletion** — if any user-identifiable value is stored, Play requires an in-app and web-accessible deletion path.
- **Content moderation** — user-chosen display names are user-generated content; Play expects a reporting/moderation story.

Recommendation: launch without the leaderboard, then add it in a later update so the initial review is as simple as possible.

## 8. Post-launch obligations

- **Target API level** — Google raises the minimum `targetSdk` for updates roughly annually. Existing apps must keep pace or lose the ability to ship updates.
- **Vitals thresholds** — excessive crash/ANR rates can suppress the listing.
- **Annual account reverification** — Play periodically re-requests identity confirmation; ignoring it can suspend the account.
- **Every update** needs a higher `versionCode` and a fresh release-notes entry.

## Ordered blocking list

1. Create and verify the Play Developer account
2. Write and host the privacy policy
3. Generate and back up the upload keystore
4. Replace the launcher icon
5. Set a real `versionCode` / `versionName` scheme
6. Build and device-test the signed AAB
7. Produce icon, feature graphic, and screenshots
8. Complete all Play Console compliance forms
9. Run internal → closed testing (14-day / 12-tester rule)
10. Submit to production with a staged rollout
