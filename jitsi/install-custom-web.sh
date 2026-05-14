#!/usr/bin/env bash
# Install WisdomLinked Jitsi custom web scripts into docker-jitsi-meet's `web/custom` directory.
#
# Usage:
#   export JITSI_WEB_CUSTOM="$HOME/.jitsi-meet-cfg/web/custom"
#   ./jitsi/install-custom-web.sh
#
# Then restart the `web` container. If `index.html` does not yet load these scripts, this script
# appends two <script defer> tags before </body> (idempotent: skips if already present).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
DEST="${JITSI_WEB_CUSTOM:-}"

if [[ -z "$DEST" ]]; then
  echo "Error: set JITSI_WEB_CUSTOM to your Jitsi web custom directory (e.g. ~/.jitsi-meet-cfg/web/custom)." >&2
  exit 1
fi

mkdir -p "$DEST"
cp -f "$ROOT/wisdomlinked-copy-meeting-id.js" "$DEST/"
cp -f "$ROOT/wisdomlinked-meeting-chat-sync.js" "$DEST/"

INDEX="$DEST/index.html"
MARKER="wisdomlinked-meeting-chat-sync.js"
if [[ -f "$INDEX" ]] && ! grep -q "$MARKER" "$INDEX"; then
  if grep -q '</body>' "$INDEX"; then
    # macOS/BSD and GNU sed compatible: use perl
    perl -0pi -e 's#</body>#<script src="custom/wisdomlinked-copy-meeting-id.js" defer></script>\n<script src="custom/wisdomlinked-meeting-chat-sync.js" defer></script>\n</body>#' "$INDEX"
  else
    echo "Warning: $INDEX has no </body>; add script tags manually (see jitsi/MEETING_CHAT_HOOKS.md)." >&2
  fi
fi

echo "Installed WisdomLinked Jitsi custom scripts into $DEST"
