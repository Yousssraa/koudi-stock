#!/usr/bin/env bash
# Build command for Render.com (repo root = working directory).
set -o errexit

pip install -r backend/requirements.txt

npm ci --prefix frontend
npm run build --prefix frontend

python backend/manage.py migrate --no-input
python backend/manage.py collectstatic --no-input
