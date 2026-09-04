# Android hotspot support — current state

## What works right now
The app is wrapped with Capacitor and runs as a real Android app
(`android/` is a genuine native project — build it in Android Studio like
normal). On Android, hotspot mode uses the **same WebRTC transport as web**
(see `src/lib/hotspotTransport.ts`). This works today: Capacitor's Android
WebView (Chromium-based) supports WebRTC data channels fine. Two phones on
the same WiFi network, or with one phone's hotspot manually turned on via
Android Settings and the other connected to it, can create/join a room
exactly like they would in a browser.

## What's NOT implemented: the app creating the hotspot itself
What you asked about — the app using **Android's built-in hotspot APIs**
directly (so the host phone becomes the access point without anyone
touching WiFi settings) — isn't built. That's a materially different,
larger piece of work:

- It requires a **custom native Capacitor plugin** written in Kotlin —
  there's no official Capacitor plugin for this.
- The relevant Android APIs are `WifiP2pManager` (WiFi Direct — pairs
  devices without an access point) or `LocalOnlyHotspot` (turns the phone
  into a real AP, but is transient, requires location permission, and the
  SSID/password reset every time it's created).
- Once the connection exists at the OS level, you still need to run actual
  sockets (or WebRTC) over it to move game data — the plugin has to expose
  that back to the JS side.
- This kind of native networking code genuinely needs testing on physical
  devices to trust — it's not something to ship untested.

## If you want to build this next
Realistic path: write a Capacitor plugin (`android/app/src/main/java/...`)
exposing `startHotspot()` / `connectToHotspot()` / `discoverPeers()` methods
backed by `WifiP2pManager`, call it from a new
`src/lib/androidHotspot.ts` implementing the same shape as
`useHotspotHost`/`useHotspotGuest` in `webrtcHotspot.ts`, and swap the
branch in `src/lib/hotspotTransport.ts` to use it when
`isNativeAndroid()` is true. Nothing else in the app needs to change —
that's the whole reason that file exists.
