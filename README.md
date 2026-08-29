# Watch

Watch is a Windows app for a **local** movie, TV, and anime library. It scans folders on your PC, loads posters and titles from TMDB, and plays files in [mpv](https://mpv.io).

Android **phone** and **TV** apps can browse the same library over your network. The PC keeps the files and streams them; the phone or TV is only a player.

## Features

- Scan library folders
- TMDB metadata and posters (cached on the PC)
- Movies, TV series, anime, and unmatched files
- Show → season → episode (owned vs missing)
- Search, filters, Continue Watching
- Resume playback in mpv
- Phone/TV companion on port **8742**

## Desktop (Windows)

### Requirements

- Node.js 20+
- Rust ([rustup](https://rustup.rs))
- Visual Studio Build Tools (C++ workload)
- mpv (`winget install mpv`)
- A free [TMDB API key](https://www.themoviedb.org/settings/api)

### Run from source

```bash
cd desktop
npm install
npm run tauri dev
```

In **Settings**, set your library folder(s) and paste the TMDB key. The key stays on your computer; it is not stored in this repo.

### Build an installer

```bash
cd desktop
npm run tauri build
```

The installer is written under `desktop/src-tauri/target/release/bundle/`.

### Library folders

Watch uses folder names (not a drive letter). Typical layout:

```
<library>\
  Movies\
    Not Anime\
  TV\
    Anime\
    Not Anime\
```

## Android

Open the `mobile/` folder in Android Studio.

| Build | Device | Notes |
|--------|--------|--------|
| phone | Phone | ExoPlayer |
| tv | Android TV | Sideload; D-pad friendly |

The phone/TV app needs **Watch running on the PC** (same Wi‑Fi, or USB with `adb reverse`).

1. Start Watch on the PC. Open **Settings** and copy the PIN. Port is **8742**.
2. **Wi‑Fi:** on the phone, enter the PC’s LAN IP from Settings.
3. **USB:** `adb reverse tcp:8742 tcp:8742`, then host `127.0.0.1`.
4. Paste the PIN and connect.

More detail: [desktop/README.md](desktop/README.md) and [mobile/README.md](mobile/README.md).

## Repo layout

- `desktop/` — Windows app
- `mobile/` — Android phone and TV
