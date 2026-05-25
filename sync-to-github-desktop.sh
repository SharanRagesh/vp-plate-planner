#!/bin/bash
# Copy this project into your GitHub Desktop folder, then commit & push from Desktop.
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="${1:-$HOME/Documents/GitHub/vp-plate-planner}"

if [[ ! -d "$(dirname "$DEST")" ]]; then
  echo "Create your GitHub folder first, e.g. ~/Documents/GitHub"
  exit 1
fi

mkdir -p "$DEST"
rsync -av --delete \
  --exclude '.git' \
  --exclude '.DS_Store' \
  "$SRC/" "$DEST/"

echo ""
echo "Synced to: $DEST"
echo "Open in GitHub Desktop → commit → push to update Pages."
