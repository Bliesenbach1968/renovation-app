#!/bin/bash
# Dauerhaftes Frontend-Deploy: Image neu bauen + Container neu starten
# Kein docker cp mehr – vermeidet Mismatch zwischen index.html und Assets
set -e
cd "$(dirname "$0")"
echo "🔨 Baue Frontend-Image..."
docker compose build --no-cache frontend
echo "🚀 Starte Container neu..."
docker compose up -d --force-recreate frontend
echo "✅ Deploy abgeschlossen. App: http://localhost"
