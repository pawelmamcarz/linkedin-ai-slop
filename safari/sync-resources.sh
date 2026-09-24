#!/bin/bash
# Kopiuje wspólne extension/ do bundla Safari Web Extension w trakcie buildu Xcode.
set -euo pipefail

if [[ -z "${TARGET_BUILD_DIR:-}" || -z "${UNLOCALIZED_RESOURCES_FOLDER_PATH:-}" ]]; then
  echo "Ten skrypt uruchamia faza buildu Xcode (brak TARGET_BUILD_DIR)." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}"
mkdir -p "${DEST}"
cp -R "${ROOT}/extension/." "${DEST}/"
rm -f "${DEST}/.DS_Store"
python3 "${ROOT}/scripts/patch-safari-manifest.py" "${DEST}/manifest.json"
MANIFEST_VERSION="$(python3 -c "import json; print(json.load(open('${ROOT}/extension/manifest.json'))['version'])")"
if [[ -n "${MARKETING_VERSION:-}" && "${MARKETING_VERSION}" != "${MANIFEST_VERSION}" ]]; then
  echo "Uwaga: MARKETING_VERSION (${MARKETING_VERSION}) != extension/manifest.json (${MANIFEST_VERSION})." >&2
fi
echo "Safari resources: ${DEST}"
