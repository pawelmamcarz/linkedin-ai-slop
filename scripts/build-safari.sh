#!/bin/bash
# Jedna komenda na Macu: buduje aplikację z osadzonym Safari Web Extension.
# Na Linuxie kończy się komunikatem, bo nie ma Xcode.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="${ROOT}/safari/LinkedInAISlop.xcodeproj"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Budowa Safari wymaga macOS i Xcode. Projekt jest w safari/LinkedInAISlop.xcodeproj." >&2
  echo "Na Macu: bash scripts/build-safari.sh" >&2
  exit 1
fi

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "Brak xcodebuild. Zainstaluj Xcode i uruchom: sudo xcode-select -s /Applications/Xcode.app" >&2
  exit 1
fi

VERSION="$(python3 -c "import json; print(json.load(open('${ROOT}/extension/manifest.json'))['version'])")"

xcodebuild \
  -project "${PROJECT}" \
  -scheme LinkedInAISlop \
  -configuration Debug \
  -destination "platform=macOS" \
  CODE_SIGN_IDENTITY="-" \
  CODE_SIGNING_REQUIRED=NO \
  MARKETING_VERSION="${VERSION}" \
  build

echo "Aplikacja jest w DerivedData (Debug). Uruchom ją z Xcode albo otwórz produkt buildu."
echo "W Safari: Develop → Allow Unsigned Extensions, potem Ustawienia → Rozszerzenia."
