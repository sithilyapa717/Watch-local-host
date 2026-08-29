# Watch mobile (Android)

Companion apps for the Watch desktop library. The PC holds the files and streams them; the device is a native player.

| Flavor | What | Player |
|--------|------|--------|
| **phone** | Touch UI | ExoPlayer |
| **tv** | Android TV / leanback | LibVLC on TV builds |

Package IDs: `com.example.watchmobile` (phone) and `com.example.watchmobile.tv` (TV). They can both be installed.

## Do not commit

- `local.properties` (SDK path)
- `app/build/`, `.gradle/`
- Signed keystores

## Open in Android Studio

1. Open the `mobile/` folder (this Gradle project).
2. Let Gradle sync. First sync downloads dependencies.
3. Select **phoneDebug** / **phoneRelease** or **tvRelease**.
4. Run on a device or emulator.

## USB (phone on the same PC)

1. Start Watch desktop (`npm run tauri dev` in `desktop/`).
2. Settings → copy the PIN. Server port is **8742**.
3. Tunnel:

```bat
adb reverse tcp:8742 tcp:8742
```

4. On the phone: host `127.0.0.1`, port `8742`, paste the PIN.

Wi-Fi: use the PC LAN address from desktop Settings (same network). No `adb reverse` needed.

## Copy APKs for GitHub Releases

```bat
gradlew copyPhoneReleaseToDist
gradlew copyTvReleaseToDist
```

That writes `Watch-phone.apk` and `Watch-tv.apk` under `../release/android/`. Attach those files to a GitHub Release. Do not git-add the APKs.

## Sideload notes

Phone: ExoPlayer. MP4 is reliable; many MKV/HEVC rips may fail.

TV: see [`../release/android/tv/README.md`](../release/android/tv/README.md) for controller and codec notes.
