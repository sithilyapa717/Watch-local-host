# Watch desktop

Windows app (Tauri 2 + React + Rust). Scans your library folders, pulls TMDB metadata, and plays files in mpv.

## Prerequisites

1. **Node.js 20+**
2. **Rust** — https://rustup.rs
3. **Visual Studio Build Tools** (C++ workload)
4. **mpv** — `winget install mpv`
5. **TMDB API key** — https://www.themoviedb.org/settings/api

## Setup

```bash
cd desktop
npm install
```

In the app: **Settings** → library folder(s) + TMDB API key.

Do not commit the API key. It is stored in app data on your machine.

## Development

```bash
npm run tauri dev
```

## Production build

```bash
npm run tauri build
```

Installer output: `src-tauri/target/release/bundle/` (this folder is not for git). Copy the installer to a GitHub Release if you want to share it.

## Library layout

Watch infers type from folder names (case-insensitive), not from a drive letter:

```
<library folder>\
  Movies\
    Not Anime\
      Title.2024.1080p.mkv
  TV\
    Anime\
      Show Folder\
    Not Anime\
      Show Name\
```

`Movies\…` is never treated as anime.

## Features

- Recursive library scan
- TMDB posters/metadata (cached offline)
- Movies, TV, Anime, Not Organized
- Show → season → episode (owned vs missing)
- Search (Ctrl+K), filters (Ctrl+Shift+F)
- Continue Watching / incomplete series
- mpv playback with resume
- LAN API on port **8742** for the phone/TV apps

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| Ctrl+K | Search |
| Ctrl+Shift+F | Toggle filters |
| Space / F / M | Player controls (in mpv) |

Phone/TV setup: [`../mobile/README.md`](../mobile/README.md).
