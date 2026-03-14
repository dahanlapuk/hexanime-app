#!/usr/bin/env bash
# ──────────────────────────────────────────────────────
# Post-sync: Patch Android permissions for Hexanime v1.3
# Run AFTER `npx cap sync android`
# ──────────────────────────────────────────────────────
set -euo pipefail

MANIFEST="android/app/src/main/AndroidManifest.xml"

if [ ! -f "$MANIFEST" ]; then
  echo "❌ AndroidManifest.xml not found. Run 'npx cap add android' first."
  exit 1
fi

echo "🔧 Patching AndroidManifest.xml for Hexanime v1.3..."

# ── INTERNET ──
if ! grep -q 'android.permission.INTERNET' "$MANIFEST"; then
  sed -i '/<manifest/a\    <uses-permission android:name="android.permission.INTERNET" />' "$MANIFEST"
  echo "  ✅ INTERNET"
else
  echo "  ⬜ INTERNET (exists)"
fi

# ── READ_MEDIA_VIDEO — Android 13+ (API 33) ──
if ! grep -q 'android.permission.READ_MEDIA_VIDEO' "$MANIFEST"; then
  sed -i '/<manifest/a\    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />' "$MANIFEST"
  echo "  ✅ READ_MEDIA_VIDEO (API 33+)"
else
  echo "  ⬜ READ_MEDIA_VIDEO (exists)"
fi

# ── READ_EXTERNAL_STORAGE — Android ≤12 ──
if ! grep -q 'android.permission.READ_EXTERNAL_STORAGE' "$MANIFEST"; then
  sed -i '/<manifest/a\    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />' "$MANIFEST"
  echo "  ✅ READ_EXTERNAL_STORAGE (maxSdk=32)"
else
  echo "  ⬜ READ_EXTERNAL_STORAGE (exists)"
fi

# ── WRITE_EXTERNAL_STORAGE — Android ≤12 ──
if ! grep -q 'android.permission.WRITE_EXTERNAL_STORAGE' "$MANIFEST"; then
  sed -i '/<manifest/a\    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="32" />' "$MANIFEST"
  echo "  ✅ WRITE_EXTERNAL_STORAGE (maxSdk=32)"
else
  echo "  ⬜ WRITE_EXTERNAL_STORAGE (exists)"
fi

# ── requestLegacyExternalStorage (Android 10 compat) ──
if ! grep -q 'requestLegacyExternalStorage' "$MANIFEST"; then
  sed -i 's/<application/<application android:requestLegacyExternalStorage="true"/' "$MANIFEST"
  echo "  ✅ requestLegacyExternalStorage"
else
  echo "  ⬜ requestLegacyExternalStorage (exists)"
fi

# ── usesCleartextTraffic ──
if ! grep -q 'usesCleartextTraffic' "$MANIFEST"; then
  sed -i 's/<application/<application android:usesCleartextTraffic="true"/' "$MANIFEST"
  echo "  ✅ usesCleartextTraffic"
else
  echo "  ⬜ usesCleartextTraffic (exists)"
fi

echo ""
echo "✅ Patched for v1.3"
echo "   INTERNET, READ_MEDIA_VIDEO, READ/WRITE_EXTERNAL_STORAGE"
echo "   requestLegacyExternalStorage, usesCleartextTraffic"
