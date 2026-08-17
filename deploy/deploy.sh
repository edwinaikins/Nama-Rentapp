#!/usr/bin/env bash
# Idempotent provision + deploy script for the NAMA Rent App.
# Run on the target VM (piped over SSH by the GitHub Actions "deploy" job).
# Safe to re-run: it installs anything missing, then pulls + rebuilds + restarts.

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/rentapp}"
REPO_URL="${REPO_URL:-https://github.com/edwinaikins/Nama-Rentapp.git}"
SERVICE_NAME="rentapp"
DEPLOY_USER="$(whoami)"

echo "==> Ensuring system packages (Node.js, nginx, git)"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
if ! command -v nginx >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y nginx
fi
if ! command -v git >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y git
fi

echo "==> Syncing code into ${APP_DIR}"
sudo mkdir -p "${APP_DIR}"
sudo chown "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}"
cd "${APP_DIR}"
if [ ! -d "${APP_DIR}/.git" ]; then
  # Directory may already exist with a hand-created .env in it (expected on
  # first deploy) or be genuinely empty — either way, init in place rather
  # than `git clone`, which refuses to write into a non-empty directory.
  git init -b main
  git remote add origin "${REPO_URL}"
fi
git fetch origin main
git reset --hard origin/main

if [ ! -f "${APP_DIR}/.env" ]; then
  echo "ERROR: ${APP_DIR}/.env is missing." >&2
  echo "Create it first with the app's real secrets (VITE_FIREBASE_API_KEY, WIGAL_API_KEY," >&2
  echo "WIGAL_USERNAME, WIGAL_SENDER_ID, APP_URL) before deploying. See .env.example." >&2
  exit 1
fi

echo "==> Installing dependencies"
npm ci

echo "==> Building (Vite auto-loads VITE_* vars from .env)"
npm run build

echo "==> Installing systemd service"
sed "s/__USER__/${DEPLOY_USER}/; s#__APP_DIR__#${APP_DIR}#" deploy/rentapp.service | sudo tee /etc/systemd/system/${SERVICE_NAME}.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable ${SERVICE_NAME}

echo "==> Installing nginx config"
sudo cp deploy/nginx.conf /etc/nginx/sites-available/${SERVICE_NAME}
sudo ln -sf /etc/nginx/sites-available/${SERVICE_NAME} /etc/nginx/sites-enabled/${SERVICE_NAME}
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

echo "==> Restarting app"
sudo systemctl restart ${SERVICE_NAME}
sleep 2
sudo systemctl --no-pager --full status ${SERVICE_NAME} | head -12

echo "==> Health check"
curl -fsS http://127.0.0.1:3000/api/health && echo || (echo "Health check FAILED"; exit 1)

echo "==> Deploy complete"
