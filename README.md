# Ubuntu Server Deployment

Die Python-Startdateien liegen in:

- `Webserver/Python/server.py`
- `Webserver/Python/wsgi.py`
- `Webserver/Python/start_server.bat`
- `Webserver/Python/start_server.ps1`

Die mathematische Logik liegt in:

- `Webserver/Mathe/kurvendiskussion_sympy.py`

## 1. Pakete installieren

```bash
sudo apt update
sudo apt install -y git python3 python3-venv nginx
```

## 2. Projekt holen

```bash
cd /home/tim
git clone <DEIN-REPO-URL> Ideas
cd /home/tim/Ideas
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 3. systemd-Dateien kopieren

```bash
sudo cp deploy/ideas-web.service /etc/systemd/system/
sudo cp deploy/ideas-update.service /etc/systemd/system/
sudo cp deploy/ideas-update.timer /etc/systemd/system/
sudo chmod +x deploy/update.sh
```

## 4. nginx aktivieren

```bash
sudo cp deploy/nginx-ideas.conf /etc/nginx/sites-available/ideas
sudo ln -sf /etc/nginx/sites-available/ideas /etc/nginx/sites-enabled/ideas
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## 5. Kurzbefehl fuer Updates aktivieren

```bash
sudo cp deploy/update /usr/local/bin/update
sudo chmod +x /usr/local/bin/update
```

Danach funktioniert:

```bash
update repo
```

## 6. Webserver aktivieren

```bash
sudo systemctl daemon-reload
sudo systemctl enable ideas-web.service
sudo systemctl start ideas-web.service
sudo systemctl enable ideas-update.timer
sudo systemctl start ideas-update.timer
```

## 7. Status pruefen

```bash
systemctl status ideas-web.service
systemctl status ideas-update.timer
systemctl status nginx
```

## Hinweise

- `deploy/update.sh` setzt aktuell hart auf `origin/main` zurueck. Das ist gut fuer einen reinen Deploy-Server, aber lokale Aenderungen auf dem Server wuerden dabei verloren gehen.
- Wenn dein Standard-Branch nicht `main` heisst, aendere `origin/main` in `deploy/update.sh`.
- `gunicorn` laeuft lokal auf `127.0.0.1:8000`, `nginx` nimmt Anfragen auf Port `80` an und leitet sie dorthin weiter.
- Die Dateien sind bereits fuer einen Ubuntu-Server-Benutzer `tim` vorbereitet.
- Der `gunicorn`-Startpfad im Service ist aktuell `Webserver.Python.wsgi:app`.
