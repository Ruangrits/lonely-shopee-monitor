#!/bin/bash
set -e

# Initialize pre-saved cookies from image if not already in volume
mkdir -p /app/data
for cookies_file in /app/cookies-init/cookies-*.json; do
    [ -f "$cookies_file" ] || continue
    target="/app/data/$(basename "$cookies_file")"
    if [ ! -f "$target" ]; then
        cp "$cookies_file" "$target"
        echo "Initialized cookies: $(basename "$cookies_file")"
    fi
done

# Start virtual display
Xvfb :99 -screen 0 1280x800x24 &
sleep 1

# Start lightweight window manager
fluxbox &

# Start VNC server (no password, accessible via noVNC)
x11vnc -display :99 -forever -nopw -shared -rfbport 5900 &

# Start noVNC web client on port 6080
websockify --web=/usr/share/novnc/ 6080 localhost:5900 &

echo "noVNC available at http://localhost:6080/vnc.html"
echo "Starting backend..."

# Run the app with HEADLESS=false so browser is visible via VNC
export HEADLESS=false

exec node dist/index.js
