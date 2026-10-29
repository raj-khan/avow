#!/usr/bin/env bash
# Renders icons/src/icon<N>.svg to icons/icon<N>.png with headless Chrome, so
# neither the repo nor CI needs an image tool. Run by hand after editing an SVG
# and commit the PNGs.
set -euo pipefail
cd "$(dirname "$0")"
chrome=${CHROME:-google-chrome}
for svg in icon*.svg; do
  n=${svg//[!0-9]/}
  "$chrome" --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 \
    --window-size="$n,$n" --screenshot="$PWD/../icon$n.png" "file://$PWD/$svg" >/dev/null 2>&1
  echo "icon$n.png"
done
