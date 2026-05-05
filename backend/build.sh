#!/usr/bin/env bash
# Render build script — runs inside the backend/ directory
set -e

echo "→ Installing dependencies..."
pip install -r requirements.txt

echo "→ Collecting static files..."
python manage.py collectstatic --noinput

echo "→ Running database migrations..."
python manage.py migrate --noinput

echo "✅ Build complete"
