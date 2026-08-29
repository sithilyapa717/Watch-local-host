# Watch

Windows desktop library + player for local movies, TV, and anime, with Android phone and TV companion apps.

This repo is **source only**. Your video files (`Movies`, `TV`) are not part of the project and should not be committed.

## What’s in this repo

| Folder | Upload? | What it is |
|--------|---------|------------|
| `desktop/` | **Yes** (source) | Windows app: React + Tauri + Rust |
| `mobile/` | **Yes** (source) | Android phone + TV flavors |
| `release/` | **READMEs only** | Notes for installers/APKs. Built files stay off git |

## Do not commit

These are ignored by `.gitignore` and must stay off GitHub:

- `node_modules/` — run `npm install` after clone
- `desktop/src-tauri/target/` — Rust build
- `desktop/dist/` — Vite output
- `mobile/app/build/`, `mobile/.gradle/` — Android build
- `mobile/local.properties` — your Android SDK path
- `*.exe`, `*.msi`, `*.apk` — attach them to a **GitHub Release** instead
- TMDB API key, PINs, keystores — never put these in the repo
- Cursor plans, prompts, and `.cursor/` — local only, not in git

## Desktop (Windows)

See [`desktop/README.md`](desktop/README.md).

```bash
cd desktop
npm install
npm run tauri dev
```

Needs Node 20+, Rust, VS C++ Build Tools, and [mpv](https://mpv.io). Add a TMDB API key in Settings.

## Mobile (Android)

See [`mobile/README.md`](mobile/README.md).

Open `mobile/` in Android Studio. The phone app talks to the PC on port **8742**.

## Releases

Built installers and APKs belong in GitHub **Releases**, not in git. Layout if you keep copies on disk: [`release/README.md`](release/README.md).

## License

Personal / private unless you add a license file.
