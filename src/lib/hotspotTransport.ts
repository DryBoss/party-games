import {
  useHotspotHost as useWebRtcHotspotHost,
  useHotspotGuest as useWebRtcHotspotGuest,
} from './webrtcHotspot';

/**
 * This is the one place that decides which hotspot transport to use.
 *
 * Today, both web and Android use WebRTC data channels — Capacitor's Android
 * WebView supports WebRTC fine, so this already works in the packaged app as
 * long as both devices join the same WiFi/hotspot network manually (via
 * Android's WiFi settings) before connecting in-app.
 *
 * What this ISN'T yet: Android has APIs (WifiP2pManager, LocalOnlyHotspot)
 * that would let the host device BECOME the access point, so guests don't
 * need a pre-existing shared network. Wiring that up means writing a native
 * Capacitor plugin (Kotlin) — real device/socket handling that has to be
 * built and tested on physical hardware, which isn't something that can be
 * responsibly done sight-unseen. See /ANDROID_HOTSPOT.md for what that
 * would involve.
 *
 * When that plugin exists, this file is the only place that needs to change:
 * branch on isNativeAndroid() from ./platform and return the native hook
 * instead. Every screen already imports from here, not from webrtcHotspot
 * directly, so nothing else has to move.
 */
export function useHotspotHost() {
  return useWebRtcHotspotHost();
}

export function useHotspotGuest() {
  return useWebRtcHotspotGuest();
}
