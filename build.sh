#!/bin/bash
# Build script — creates distributable ZIP from src/
# Usage: bash build.sh

VERSION=$(grep '"version"' src/manifest.json | grep -o '[0-9.]*')
OUTPUT="flow-extension-app/flow-auto-generator-v${VERSION}.zip"

echo "Building v${VERSION}..."
mkdir -p flow-extension-app
rm -f "$OUTPUT"
cd src && zip -r "../$OUTPUT" . && cd ..

echo "✅ Built: $OUTPUT"
ls -lh "$OUTPUT"
