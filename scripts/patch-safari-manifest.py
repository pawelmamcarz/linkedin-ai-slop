#!/usr/bin/env python3
"""Dopisuje klucz Safari do skopiowanego manifestu. Nie rusza źródła w extension/."""

import json
import sys

HOSTS = [
    "https://www.linkedin.com/*",
    "https://*.linkedin.com/*",
    "https://proxy-production-ebcc.up.railway.app/*",
    "http://127.0.0.1/*",
    "http://localhost/*",
]


def patch(manifest: dict) -> dict:
    hosts = list(manifest.get("host_permissions") or [])
    for host in HOSTS:
        if host not in hosts:
            hosts.append(host)
    manifest["host_permissions"] = hosts
    manifest["browser_specific_settings"] = {
        "safari": {"strict_min_version": "16.4"},
    }
    return manifest


def main() -> None:
    if len(sys.argv) != 2:
        print("użycie: patch-safari-manifest.py <manifest.json>", file=sys.stderr)
        sys.exit(2)
    path = sys.argv[1]
    with open(path, encoding="utf-8") as handle:
        manifest = json.load(handle)
    patch(manifest)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


if __name__ == "__main__":
    main()
