#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo "Care Guide BD — VPS Docker Deployment & Seeder Automation"
echo "=========================================================="

if [ ! -f .env ]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env
fi

echo "1. Building and starting containers via Docker Compose..."
docker compose down || true
docker compose up -d --build

echo "2. Waiting for backend service to become healthy..."
sleep 5

echo "3. Running deterministic demo seeder inside the container..."
docker compose exec backend /app/seed

echo "4. Checking container status..."
docker compose ps

echo "=========================================================="
echo "Deployment complete! Backend listening on http://localhost:${PORT:-3000}"
echo "=========================================================="
