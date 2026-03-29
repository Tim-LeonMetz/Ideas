#!/bin/bash
set -euo pipefail

cd /home/tim/Ideas

git fetch --all
git reset --hard origin/main
/home/tim/Ideas/.venv/bin/pip install -r requirements.txt
sudo systemctl restart ideas-web.service
