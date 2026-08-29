# Watch desktop

Windows app (Tauri 2 + React + Rust). Scans your library folders, pulls TMDB metadata, and plays files in mpv.

## Requirements

1. **Node.js 20+**
2. **Rust** — https://rustup.rs
3. **Visual Studio Build Tools** (C++ workload)
4. **mpv** — `winget install mpv`
5. **TMDB API key** — https://www.themoviedb.org/settings/api

## Setup

```bash
cd desktop
npm install
npm run tauri dev
```

In **Settings**, add your library folder(s) and TMDB API key.

## Build

```bash
npm run tauri build
```

Installer output: `src-tauri/target/release/bundle/`.

## Library layout

Watch infers type from folder names (case-insensitive):

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

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| Ctrl+K | Search |
| Ctrl+Shift+F | Toggle filters |
| Space / F / M | Player controls (in mpv) |

Phone and TV apps: [../mobile/README.md](../mobile/README.md).
