# Releases

Installers and APKs are published on the GitHub **Releases** page when available. They are not stored in this git repo.

## Desktop

From `desktop/`:

```bash
npm run tauri build
```

Then use the files under `desktop/src-tauri/target/release/bundle/`.

## Android

Build **phoneRelease** or **tvRelease** in Android Studio, or from `mobile/`:

```bat
gradlew assemblePhoneRelease
gradlew assembleTvRelease
```

Sideload notes: [android/phone/README.md](android/phone/README.md) and [android/tv/README.md](android/tv/README.md).
