# Watch phone

Sideload **Watch-phone.apk** (not the TV APK). App id: `com.example.watchmobile`.

1. Run Watch on the PC.
2. Settings → PIN. Port **8742**.
3. USB: `adb reverse tcp:8742 tcp:8742`, host `127.0.0.1`. Wi-Fi: PC LAN IP from Settings.
