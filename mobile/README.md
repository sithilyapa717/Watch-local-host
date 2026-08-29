# Watch mobile (Android)

Companion apps for the Watch desktop library. The PC holds the files and streams them; the device is a native player.

| Flavor | Device | Player |
|--------|--------|--------|
| **phone** | Phone | ExoPlayer |
| **tv** | Android TV | LibVLC |

Package IDs: `com.example.watchmobile` (phone) and `com.example.watchmobile.tv` (TV). Both can be installed at once.

## Open in Android Studio

1. Open the `mobile/` folder.
2. Wait for Gradle to sync.
3. Select **phoneDebug** / **phoneRelease** or **tvRelease**.
4. Run on a device or emulator.

## Connect to the PC

1. Start Watch on the PC (`npm run tauri dev` in `desktop/`).
2. Open **Settings** and copy the PIN. Port is **8742**.

**Wi‑Fi** (same network): enter the PC LAN address shown in Settings.

**USB:**

```bat
adb reverse tcp:8742 tcp:8742
```

Then on the phone: host `127.0.0.1`, port `8742`, paste the PIN.

## Playback notes

Phone: MP4 is the most reliable. Many MKV/HEVC rips may fail in ExoPlayer.

TV: see [../release/android/tv/README.md](../release/android/tv/README.md) for controller and codec notes.
