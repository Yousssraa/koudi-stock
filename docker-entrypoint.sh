#!/usr/bin/env bash
# Point d'entrée conteneur (Koyeb et autres PaaS Docker).
# Applique les migrations, rassemble les statics puis démarre gunicorn
# sur 0.0.0.0:$PORT (fourni par la plateforme).
set -o errexit

python backend/manage.py migrate --no-input
python backend/manage.py collectstatic --no-input

exec gunicorn --chdir backend koudi_backend.wsgi:application \
    --workers 1 --threads 8 --timeout 120 \
    --bind "0.0.0.0:${PORT:-8000}"
