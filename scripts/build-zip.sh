#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
ZIP_FILE="$DIST_DIR/lambda.zip"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

cp "$ROOT_DIR/src/handler.js" "$DIST_DIR/"

cd "$DIST_DIR"
zip -r lambda.zip handler.js >/dev/null
mv lambda.zip "$ZIP_FILE"

echo "Created deployment package: $ZIP_FILE"
echo "Upload this zip when creating or updating your Lambda function in the AWS Console."
