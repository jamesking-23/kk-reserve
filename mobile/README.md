# kkingg reserves for Android

A thin Android shell (Capacitor) that opens the hosted web app at https://kk-reserve-kkingg.vercel.app.
Because it loads the live site, web updates appear in the app without reinstalling.

The APK is built by GitHub Actions (`.github/workflows/android-apk.yml`) and published at
Releases > "kkingg reserves for Android" > `kkingg-reserves.apk`.

It is signed with a fixed sideload key (`android/app/debug.keystore`), so new builds install over old ones.
It is not a Play Store release build.
