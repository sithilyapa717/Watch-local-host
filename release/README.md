# Watch releases (local copies)

Git does **not** store `.exe` / `.apk` files. After you build, attach them to a **GitHub Release**.

If you keep copies on disk:

```
release/
  desktop/
    latest/          # current Windows installer + portable
    archive/         # old versions (keep off git)
  android/
    phone/           # Watch-phone.apk
    tv/              # Watch-tv.apk
```

## Desktop

From `desktop/`: `npm run tauri build`  
Then copy from `desktop/src-tauri/target/release/bundle/` into a GitHub Release.

## Android

From `mobile/`:

```bat
gradlew copyPhoneReleaseToDist
gradlew copyTvReleaseToDist
```

See [`android/phone/README.md`](android/phone/README.md) and [`android/tv/README.md`](android/tv/README.md) for sideload notes.
