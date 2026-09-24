#!/bin/bash
# Archiwum Release do App Store Connect. Nie buduje ścieżki Debug ad-hoc.
# Na Linuxie kończy się komunikatem, bo nie ma Xcode.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="${ROOT}/safari/LinkedInAISlop.xcodeproj"
ARCHIVE="${ROOT}/build/LinkedInAISlop.xcarchive"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Archiwum Safari wymaga macOS i Xcode." >&2
  echo "Na Macu: DEVELOPMENT_TEAM=TWOJE_TEAM_ID npm run safari:archive" >&2
  exit 1
fi

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "Brak xcodebuild. Zainstaluj Xcode i uruchom: sudo xcode-select -s /Applications/Xcode.app" >&2
  exit 1
fi

if [[ -z "${DEVELOPMENT_TEAM:-}" ]]; then
  echo "Ustaw DEVELOPMENT_TEAM (Team ID z konta Apple Developer). Nie commituj go." >&2
  echo "Przykład: DEVELOPMENT_TEAM=TWOJE_TEAM_ID npm run safari:archive" >&2
  echo "Albo wpisz Team w Xcode i użyj Product → Archive (konfiguracja Release)." >&2
  exit 1
fi

VERSION="$(python3 -c "import json; print(json.load(open('${ROOT}/extension/manifest.json'))['version'])")"
mkdir -p "${ROOT}/build"

xcodebuild \
  -project "${PROJECT}" \
  -scheme LinkedInAISlop \
  -configuration Release \
  -destination "generic/platform=macOS" \
  -archivePath "${ARCHIVE}" \
  DEVELOPMENT_TEAM="${DEVELOPMENT_TEAM}" \
  MARKETING_VERSION="${VERSION}" \
  archive

echo "Archiwum: ${ARCHIVE}"
echo "Xcode → Window → Organizer → Distribute App → App Store Connect."
echo "Nie wysyłaj buildu Debug (CODE_SIGN_IDENTITY = -)."
