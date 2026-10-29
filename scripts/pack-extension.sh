#!/usr/bin/env bash
# Builds the Chrome Web Store upload from committed files only, with
# manifest.json at the zip root. An allowlist, not an exclude list: anything
# new under extension/ stays out until it is named here.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain -- extension)" ]; then
  echo "extension/ has uncommitted changes; commit them so the zip matches a revision." >&2
  exit 1
fi

version=$(node -p 'require("./extension/manifest.json").version')
out="dist/avow-extension-$version.zip"
mkdir -p dist
rm -f "$out"
git archive --format=zip -o "$out" HEAD:extension \
  manifest.json src ':(glob)icons/icon*.png'
echo "$out ($(git rev-parse --short HEAD))"
unzip -l "$out"
