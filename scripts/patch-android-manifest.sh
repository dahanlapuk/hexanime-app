#!/usr/bin/env bash
# ──────────────────────────────────────────────────────
# Post-sync script: Patch Android permissions for Hexanime v1.2b
# Run AFTER `npx cap sync android`
# ──────────────────────────────────────────────────────
set -euo pipefail

MANIFEST="android/app/src/main/AndroidManifest.xml"

if [ ! -f "$MANIFEST" ]; then
  echo "❌ AndroidManifest.xml not found. Run 'npx cap add android' first."
  exit 1
fi

echo "🔧 Patching AndroidManifest.xml for Hexanime v1.2b..."

# ── Task 3: Add INTERNET ──
if ! grep -q 'android.permission.INTERNET' "$MANIFEST"; then
  sed -i '/<manifest/a\    <uses-permission android:name="android.permission.INTERNET" />' "$MANIFEST"
  echo "  ✅ Added INTERNET"
else
  echo "  ⬜ INTERNET already present"
fi

# ── Task 3: Add READ_MEDIA_VIDEO for Android 13+ (API 33) ──
if ! grep -q 'android.permission.READ_MEDIA_VIDEO' "$MANIFEST"; then
  sed -i '/<manifest/a\    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />' "$MANIFEST"
  echo "  ✅ Added READ_MEDIA_VIDEO (API 33+)"
else
  echo "  ⬜ READ_MEDIA_VIDEO already present"
fi

# ── Add READ_EXTERNAL_STORAGE for Android ≤12 (maxSdkVersion=32) ──
if ! grep -q 'android.permission.READ_EXTERNAL_STORAGE' "$MANIFEST"; then
  sed -i '/<manifest/a\    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />' "$MANIFEST"
  echo "  ✅ Added READ_EXTERNAL_STORAGE (maxSdkVersion=32)"
else
  echo "  ⬜ READ_EXTERNAL_STORAGE already present"
fi

# ── Add WRITE_EXTERNAL_STORAGE for Android ≤12 ──
if ! grep -q 'android.permission.WRITE_EXTERNAL_STORAGE' "$MANIFEST"; then
  sed -i '/<manifest/a\    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="32" />' "$MANIFEST"
  echo "  ✅ Added WRITE_EXTERNAL_STORAGE (maxSdkVersion=32)"
else
  echo "  ⬜ WRITE_EXTERNAL_STORAGE already present"
fi

# ── Task 3: Add requestLegacyExternalStorage to <application> ──
if ! grep -q 'requestLegacyExternalStorage' "$MANIFEST"; then
  sed -i 's/<application/<application android:requestLegacyExternalStorage="true"/' "$MANIFEST"
  echo "  ✅ Added requestLegacyExternalStorage=\"true\""
else
  echo "  ⬜ requestLegacyExternalStorage already present"
fi

# ── Add usesCleartextTraffic for GDrive downloads ──
if ! grep -q 'usesCleartextTraffic' "$MANIFEST"; then
  sed -i 's/<application/<application android:usesCleartextTraffic="true"/' "$MANIFEST"
  echo "  ✅ Added usesCleartextTraffic=\"true\""
else
  echo "  ⬜ usesCleartextTraffic already present"
fi

echo ""
echo "✅ AndroidManifest.xml patched for Hexanime v1.2b"
echo "   Permissions: INTERNET, READ_MEDIA_VIDEO, READ/WRITE_EXTERNAL_STORAGE"
echo "   Application: requestLegacyExternalStorage, usesCleartextTraffic"
