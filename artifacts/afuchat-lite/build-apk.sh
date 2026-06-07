#!/bin/bash
set -e
export EXPO_TOKEN=D0ZX0j9_3ko_Rv9ubaB3-9ymgQgQuEE9lJ1jkBZR
cd "$(dirname "$0")"
echo "=== Starting EAS APK build ==="
echo "Account: amkaweesi1 | Profile: preview | Platform: android"
npx eas build --platform android --profile preview --non-interactive
echo "=== Build queued! Check https://expo.dev for progress ==="
