#!/usr/bin/env bash
# Downloads the curated Piper voices once (≈60 MB each) into ./data/voice.
# After this, speech works fully offline.
set -euo pipefail
DIR="${1:-./data/voice}"
mkdir -p "$DIR"
BASE="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en"
for v in en_US/amy/medium/en_US-amy-medium en_US/lessac/medium/en_US-lessac-medium en_US/ryan/medium/en_US-ryan-medium \
         en_US/joe/medium/en_US-joe-medium en_GB/alba/medium/en_GB-alba-medium \
         en_GB/northern_english_male/medium/en_GB-northern_english_male-medium; do
  name="$(basename "$v")"
  for ext in onnx onnx.json; do
    [ -f "$DIR/$name.$ext" ] || curl -fL --retry 3 -o "$DIR/$name.$ext" "$BASE/$v.$ext"
  done
  echo "✓ $name"
done
