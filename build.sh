#!/bin/bash
# Build script — creates distributable ZIP from src/
# Usage: bash build.sh
set -e

VERSION=$(grep '"version"' src/manifest.json | grep -o '[0-9.]*')
OUTPUT="flow-extension-app/flow-auto-generator-v${VERSION}.zip"

echo "Building v${VERSION}..."
mkdir -p flow-extension-app
rm -f "$OUTPUT"

if command -v zip >/dev/null 2>&1; then
  (cd src && zip -r "../$OUTPUT" .)
elif command -v powershell.exe >/dev/null 2>&1; then
  # Git Bash on Windows ships no zip — fall back to PowerShell.
  echo "zip not found, using PowerShell Compress-Archive..."
  powershell.exe -NoProfile -Command \
    "Compress-Archive -Path 'src\*' -DestinationPath '${OUTPUT//\//\\}' -CompressionLevel Optimal"
else
  echo "❌ Neither zip nor powershell.exe available — cannot build." >&2
  exit 1
fi

[ -f "$OUTPUT" ] || { echo "❌ Build failed: $OUTPUT was not created." >&2; exit 1; }

echo "✅ Built: $OUTPUT"
ls -lh "$OUTPUT"
