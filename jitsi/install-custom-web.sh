#!/usr/bin/env bash
# Install WisdomLinked Jitsi custom web scripts into docker-jitsi-meet's `web/custom` directory.
#
# Usage:
#   export JITSI_WEB_CUSTOM="$HOME/.jitsi-meet-cfg/web/custom"
#   ./jitsi/install-custom-web.sh
#
# Then restart the `web` container. If `index.html` does not yet load these scripts, this script
# appends two <script defer> tags before </body> (idempotent: skips if already present).
#
# docker-jitsi-meet: the `web/custom` tree is mounted at `/config/custom` in the container, not
# under `/usr/share/jitsi-meet/`, so URLs like `/custom/*.js` are not static files (SPA fallback).
# Mirror each script into the app root the same way as `index.html`, e.g. in `docker-compose.yml`:
#   - ${HOME}/.jitsi-meet-cfg/web/custom/wisdomlinked-copy-meeting-id.js:/usr/share/jitsi-meet/wisdomlinked-copy-meeting-id.js:ro
#   - ${HOME}/.jitsi-meet-cfg/web/custom/wisdomlinked-meeting-chat-sync.js:/usr/share/jitsi-meet/wisdomlinked-meeting-chat-sync.js:ro

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
cp -f "$ROOT/wisdomlinked-whiteboard-initials.js" "$DEST/"
cp -f "$ROOT/wisdomlinked-meeting-end-on-hangup.js" "$DEST/"

INDEX="$DEST/index.html"
MARKER="wisdomlinked-meeting-chat-sync.js"
if [[ -f "$INDEX" ]] && ! grep -q "$MARKER" "$INDEX"; then
  if grep -q '</body>' "$INDEX"; then
    # macOS/BSD and GNU sed compatible: use perl
    perl -0pi -e 's#</body>#<script src="wisdomlinked-copy-meeting-id.js" defer></script>\n<script src="wisdomlinked-meeting-chat-sync.js" defer></script>\n<script src="wisdomlinked-whiteboard-initials.js" defer></script>\n<script src="wisdomlinked-meeting-end-on-hangup.js" defer></script>\n</body>#' "$INDEX"
  else
    echo "Warning: $INDEX has no </body>; add script tags manually (see jitsi/MEETING_CHAT_HOOKS.md)." >&2
  fi
fi

echo "Installed WisdomLinked Jitsi custom scripts into $DEST"
echo "If you use docker-jitsi-meet with bind-mounted index.html, add ro volume binds for the two"
echo "  .js files into /usr/share/jitsi-meet/ (see header comments in this script), then recreate web."
