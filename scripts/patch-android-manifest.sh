#!/usr/bin/env bash
# Post-sync script: Ensure Android permissions are correct for Hexanime
# Run this AFTER `npx cap sync android`

set -euo pipefail

MANIFEST="android/app/src/main/AndroidManifest.xml"

if [ ! -f "$MANIFEST" ]; then
  echo "❌ AndroidManifest.xml not found. Run 'npx cap add android' first."
  exit 1
fi

echo "🔧 Patching Android permissions..."

# Add INTERNET if missing
if ! grep -q 'android.permission.INTERNET' "$MANIFEST"; then
  sed -i '/<manifest/a\    <uses-permission android:name="android.permission.INTERNET" />' "$MANIFEST"
  echo "  ✅ Added INTERNET"
fi

# Add READ_MEDIA_VIDEO for Android 13+ (API 33)
if ! grep -q 'android.permission.READ_MEDIA_VIDEO' "$MANIFEST"; then
  sed -i '/<manifest/a\    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />' "$MANIFEST"
  echo "  ✅ Added READ_MEDIA_VIDEO"
fi

# Add READ_EXTERNAL_STORAGE for Android 12 and below
if ! grep -q 'android.permission.READ_EXTERNAL_STORAGE' "$MANIFEST"; then
  sed -i '/<manifest/a\    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />' "$MANIFEST"
  echo "  ✅ Added READ_EXTERNAL_STORAGE (maxSdkVersion=32)"
fi

echo "✅ Android permissions patched."
