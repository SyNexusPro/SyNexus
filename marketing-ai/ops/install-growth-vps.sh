#!/usr/bin/env bash
# Install Synexus growth systemd service on Ubuntu VPS.
# Usage: sudo bash marketing-ai/ops/install-growth-vps.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/synexus/app}"
SERVICE_NAME="synexus-growth"
UNIT_SRC="${APP_DIR}/marketing-ai/ops/synexus-growth.service"
UNIT_DEST="/etc/systemd/system/${SERVICE_NAME}.service"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

if [[ ! -d "${APP_DIR}" ]]; then
  echo "App not found at ${APP_DIR}. Clone the repo first."
  exit 1
fi

if [[ ! -f "${APP_DIR}/marketing-ai/.env" ]]; then
  echo "Warning: ${APP_DIR}/marketing-ai/.env missing — create it before starting."
fi

echo "Installing dependencies…"
sudo -u synexus bash -lc "cd '${APP_DIR}' && npm install && npm install --prefix marketing-ai"

cp "${UNIT_SRC}" "${UNIT_DEST}"
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"

echo ""
echo "✓ ${SERVICE_NAME} installed"
systemctl status "${SERVICE_NAME}" --no-pager || true
echo ""
echo "Logs: journalctl -u ${SERVICE_NAME} -f"
