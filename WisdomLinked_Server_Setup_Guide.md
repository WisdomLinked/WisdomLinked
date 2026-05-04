# WisdomLinked — DigitalOcean Server Setup Guide
## Rocket.Chat + Jitsi Meet (Self-Hosted)

**Date:** March 27, 2026  
**Purpose:** Set up a dedicated DigitalOcean droplet running Rocket.Chat (chat) and Jitsi Meet (video calling) for WisdomLinked

---

## 1. Architecture Overview

```
┌───────────────────────────────────────────────────────────┐
│              DigitalOcean Droplet                          │
│              8 GB RAM / 4 vCPU / 160 GB SSD               │
│              Ubuntu 22.04 LTS                              │
│                                                            │
│   ┌─────────────┐    ┌──────────────────────────────────┐  │
│   │   Nginx     │    │        Docker Compose             │  │
│   │  (Reverse   │    │                                    │  │
│   │   Proxy +   │    │  ┌─────────────┐ ┌─────────────┐  │  │
│   │   SSL)      │───▶│  │ Rocket.Chat │ │  Jitsi Meet  │  │  │
│   │             │    │  │  :3000      │ │  :8000/8443  │  │  │
│   │  :80/:443   │    │  └──────┬──────┘ └─────────────┘  │  │
│   └─────────────┘    │         │                          │  │
│                      │  ┌──────┴──────┐                   │  │
│                      │  │  MongoDB    │                   │  │
│                      │  │  :27017     │                   │  │
│                      │  └─────────────┘                   │  │
│                      └──────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘

DNS Records:
  chat.wisdomlinked.com   → Droplet IP  (Rocket.Chat)
  meet.wisdomlinked.com   → Droplet IP  (Jitsi Meet)
```

### Domains Required

| Subdomain | Service | Purpose |
|---|---|---|
| `chat.wisdomlinked.com` | Rocket.Chat | Chat interface and API |
| `meet.wisdomlinked.com` | Jitsi Meet | Video meeting rooms |

> **Action Required:** Create these DNS A records pointing to the droplet's IP address before proceeding with SSL setup.

---

## 2. Droplet Provisioning

### 2.1 Create the Droplet

1. Log in to [DigitalOcean](https://cloud.digitalocean.com)
2. Click **Create → Droplets**
3. Configure:

| Setting | Value |
|---|---|
| **Region** | New York (NYC1) — closest to your existing infrastructure |
| **Image** | Ubuntu 22.04 (LTS) x64 |
| **Size** | **8 GB RAM / 4 vCPU / 160 GB SSD** ($48/mo) |
| **Authentication** | SSH Key (recommended) or Password |
| **Hostname** | `wisdomlinked-comms` |
| **Backups** | Enable ($9.60/mo extra — recommended for prod) |

4. Click **Create Droplet**
5. Note the **public IP address** once created

### 2.2 DNS Setup

In your domain registrar (or DO's networking panel), add these A records:

```
chat.wisdomlinked.com  →  <DROPLET_IP>
meet.wisdomlinked.com  →  <DROPLET_IP>
```

Allow 5-15 minutes for DNS propagation.

---

## 3. Initial Server Setup

SSH into the new droplet:

```bash
ssh root@<DROPLET_IP>
```

### 3.1 System Updates & Essentials

```bash
apt update && apt upgrade -y
apt install -y curl wget git ufw apt-transport-https ca-certificates software-properties-common
```

### 3.2 Create a Non-Root User

```bash
adduser wisdomlinked
usermod -aG sudo wisdomlinked

# Copy SSH keys to the new user
rsync --archive --chown=wisdomlinked:wisdomlinked ~/.ssh /home/wisdomlinked

# Switch to the new user
su - wisdomlinked
```

### 3.3 Configure Firewall (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp      # HTTP (for Let's Encrypt + redirect)
sudo ufw allow 443/tcp     # HTTPS
sudo ufw allow 10000/udp   # Jitsi video bridge (RTP media)
sudo ufw enable
sudo ufw status
```

Expected output:
```
Status: active
To                         Action      From
--                         ------      ----
OpenSSH                    ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
10000/udp                  ALLOW       Anywhere
```

### 3.4 Install Docker & Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group (avoids needing sudo)
sudo usermod -aG docker wisdomlinked

# Log out and back in for group changes to take effect
exit
su - wisdomlinked

# Verify installation
docker --version
docker compose version
```

---

## 4. Rocket.Chat Setup

### 4.1 Create Project Directory

```bash
mkdir -p ~/wisdomlinked-comms/rocketchat
cd ~/wisdomlinked-comms/rocketchat
```

### 4.2 Docker Compose File

Create `docker-compose.yml`:

```bash
nano docker-compose.yml
```

Paste the following:

```yaml
version: "3.8"

services:
  rocketchat:
    image: registry.rocket.chat/rocketchat/rocket.chat:latest
    container_name: rocketchat
    restart: always
    environment:
      - ROOT_URL=https://chat.wisdomlinked.com
      - PORT=3000
      - MONGO_URL=mongodb://mongodb:27017/rocketchat?replicaSet=rs0
      - MONGO_OPLOG_URL=mongodb://mongodb:27017/local?replicaSet=rs0
      - DEPLOY_METHOD=docker
      - REG_TOKEN=${REG_TOKEN:-}
    ports:
      - "3000:3000"
    depends_on:
      - mongodb
    volumes:
      - rocketchat_uploads:/app/uploads
    networks:
      - rocketchat_net

  mongodb:
    image: docker.io/bitnami/mongodb:5.0
    container_name: rocketchat_mongo
    restart: always
    environment:
      - MONGODB_REPLICA_SET_MODE=primary
      - MONGODB_REPLICA_SET_NAME=rs0
      - MONGODB_PORT_NUMBER=27017
      - ALLOW_EMPTY_PASSWORD=yes
      - MONGODB_INITIAL_PRIMARY_HOST=mongodb
      - MONGODB_ADVERTISED_HOSTNAME=mongodb
    volumes:
      - mongodb_data:/bitnami/mongodb
    networks:
      - rocketchat_net

volumes:
  mongodb_data:
    driver: local
  rocketchat_uploads:
    driver: local

networks:
  rocketchat_net:
    driver: bridge
```

### 4.3 Start Rocket.Chat

```bash
docker compose up -d
```

Verify containers are running:
```bash
docker compose ps
```

Expected output:
```
NAME               STATUS       PORTS
rocketchat         Up           0.0.0.0:3000->3000/tcp
rocketchat_mongo   Up           27017/tcp
```

Check logs for any errors:
```bash
docker compose logs -f rocketchat
```

Wait for the line: `SERVER RUNNING` (may take 1-2 minutes on first start).

### 4.4 Initial Rocket.Chat Configuration

Once Rocket.Chat is running, you'll configure it via the web interface after Nginx + SSL are set up (Section 6). The first user to access it becomes the admin.

---

## 5. Jitsi Meet Setup

### 5.1 Create Jitsi Directory

```bash
mkdir -p ~/wisdomlinked-comms/jitsi
cd ~/wisdomlinked-comms/jitsi
```

### 5.2 Download Jitsi Docker Setup

```bash
# Download the official Jitsi Docker setup
wget https://github.com/jitsi/docker-jitsi-meet/archive/refs/tags/stable-9823.tar.gz
tar xzf stable-9823.tar.gz
cd docker-jitsi-meet-stable-9823

# Copy the example env file
cp env.example .env
```

### 5.3 Configure Jitsi Environment

Edit the `.env` file:

```bash
nano .env
```

Update the following values:

```bash
# Public URL
PUBLIC_URL=https://meet.wisdomlinked.com

# System
TZ=America/Chicago

# HTTP port (Nginx will proxy to this)
HTTP_PORT=8000
HTTPS_PORT=8443

# Disable built-in HTTPS (Nginx handles SSL)
DISABLE_HTTPS=1
ENABLE_HTTP_REDIRECT=0

# Security — generate strong passwords
# Run this to generate random secrets:
# ./gen-passwords.sh
JICOFO_AUTH_PASSWORD=<generated>
JVB_AUTH_PASSWORD=<generated>
JIGASI_XMPP_PASSWORD=<generated>
JIBRI_RECORDER_PASSWORD=<generated>
JIBRI_XMPP_PASSWORD=<generated>

# JWT auth — required for signed meet links (must match WisdomLinked backend JITSI_* env)
ENABLE_AUTH=1
AUTH_TYPE=jwt
JWT_APP_ID=wisdomlinked
JWT_APP_SECRET=<same secret as BE JITSI_JWT_SECRET>
JWT_ACCEPTED_ISSUERS=wisdomlinked
JWT_ACCEPTED_AUDIENCES=jitsi

# Moderator from JWT only (not “every JWT user is moderator”, not “first joiner wins”)
WAIT_FOR_HOST_DISABLE_AUTO_OWNERS=1
JICOFO_ENABLE_AUTH=0
ENABLE_MODERATOR_CHECKS=1
ENABLE_AUTO_OWNER=0
# Map `context.user.moderator` in the token to MUC owner (Prosody ships this under prosody-plugins-contrib)
XMPP_MUC_MODULES=token_affiliation

# Performance
JVB_PORT=10000
JVB_TCP_PORT=4443
```

### 5.4 Generate Passwords

```bash
./gen-passwords.sh
```

This auto-fills the password fields in `.env`.

### 5.5 Create Required Directories

```bash
mkdir -p ~/.jitsi-meet-cfg/{web,transcripts,prosody/config,prosody/prosody-plugins-custom,jicofo,jvb,jigasi,jibri}
```

### 5.6 Start Jitsi

```bash
docker compose up -d
```

Verify:
```bash
docker compose ps
```

Expected output (4 containers):
```
NAME              STATUS       PORTS
jitsi-web         Up           0.0.0.0:8000->80/tcp
jitsi-prosody     Up           5222/tcp, 5280/tcp
jitsi-jicofo      Up 
jitsi-jvb         Up           0.0.0.0:10000->10000/udp
```

---

## 6. Nginx Reverse Proxy + SSL

### 6.1 Install Nginx & Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 6.2 Obtain SSL Certificates

```bash
sudo certbot --nginx -d chat.wisdomlinked.com -d meet.wisdomlinked.com \
  --non-interactive --agree-tos -m admin@wisdomlinked.com
```

### 6.3 Nginx Configuration for Rocket.Chat

Create `/etc/nginx/sites-available/rocketchat`:

```bash
sudo nano /etc/nginx/sites-available/rocketchat
```

```nginx
upstream rocketchat {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name chat.wisdomlinked.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name chat.wisdomlinked.com;

    ssl_certificate /etc/letsencrypt/live/chat.wisdomlinked.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chat.wisdomlinked.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 200M;

    location / {
        proxy_pass http://rocketchat;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Nginx-Proxy true;
        proxy_redirect off;
    }
}
```

### 6.4 Nginx Configuration for Jitsi

Create `/etc/nginx/sites-available/jitsi`:

```bash
sudo nano /etc/nginx/sites-available/jitsi
```

```nginx
server {
    listen 80;
    server_name meet.wisdomlinked.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name meet.wisdomlinked.com;

    ssl_certificate /etc/letsencrypt/live/meet.wisdomlinked.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/meet.wisdomlinked.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

### 6.5 Enable Sites & Restart Nginx

```bash
sudo ln -s /etc/nginx/sites-available/rocketchat /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/jitsi /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 6.6 Auto-Renew SSL

Certbot sets up auto-renewal by default. Verify:

```bash
sudo certbot renew --dry-run
```

---

## 7. Rocket.Chat Admin Setup

### 7.1 First-Time Configuration

1. Open `https://chat.wisdomlinked.com` in your browser
2. The setup wizard will guide you through:

| Step | Setting | Value |
|---|---|---|
| Admin Account | Username | `wisdomlinked-admin` |
| | Email | `admin@wisdomlinked.com` |
| | Password | (use a strong password) |
| Organization | Name | `WisdomLinked` |
| | Type | `Commercial` |
| Registration | Server Registration | Skip / Don't register |

### 7.2 Recommended Admin Settings

Navigate to **Administration → Settings** and configure:

| Setting Path | Value | Why |
|---|---|---|
| General → Notifications | Enable | Push/email alerts |
| General → UTF8 | Enable | Emoji support |
| Accounts → Registration → Registration Form | Disabled | Users created via API only |
| Accounts → Registration → Password Reset | Enabled | Allow password resets |
| File Upload → Maximum File Upload Size | 50MB | Match WisdomLinked limits |
| File Upload → Storage Type | FileSystem or S3 | S3 if using DO Spaces |
| Message → Allow Editing | Enabled | Let users edit messages |
| Message → Allow Deleting | Enabled | Let users delete messages |
| Message → Maximum Message Length | 5000 | Reasonable limit |
| E2E Encryption → Enable | Enabled | Per-channel E2EE |

### 7.3 Connect Jitsi to Rocket.Chat

Navigate to **Administration → Settings → Video Conference → Jitsi**:

| Setting | Value |
|---|---|
| Enabled | `True` |
| Domain | `meet.wisdomlinked.com` |
| URL Room Prefix | `WisdomLinked` |
| Enable SSL | `True` |
| Open in New Window | `True` |
| Enable for Channels | `True` |
| Enable for Direct Messages | `True` |

Now users can start Jitsi video calls directly from any Rocket.Chat conversation.

---

## 8. WisdomLinked Integration

### 8.1 Integration Approaches

There are two ways to integrate Rocket.Chat into WisdomLinked:

#### Option A — iframe Embed (Fastest, ~1-2 days)

Embed Rocket.Chat's UI directly into WisdomLinked pages:

```jsx
// React component example
const Chat = () => {
  const rocketChatUrl = "https://chat.wisdomlinked.com";
  
  return (
    <iframe
      src={`${rocketChatUrl}/channel/general`}
      style={{ width: '100%', height: '600px', border: 'none' }}
      allow="camera; microphone"
    />
  );
};
```

Enable iframe embedding in Rocket.Chat Admin:
- **Administration → Settings → General → Iframe Integration → Enable**

#### Option B — REST API (Custom UI, ~1-2 weeks)

Build a custom React chat UI using Rocket.Chat's REST API:

```
Base URL: https://chat.wisdomlinked.com/api/v1/
```

Key API endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v1/login` | POST | Authenticate user |
| `/api/v1/users.create` | POST | Create user (when they register on WisdomLinked) |
| `/api/v1/chat.sendMessage` | POST | Send a message |
| `/api/v1/channels.history` | GET | Fetch message history |
| `/api/v1/channels.create` | POST | Create a group channel |
| `/api/v1/dm.create` | POST | Start a 1:1 conversation |
| `/api/v1/im.history` | GET | Fetch DM history |
| `/api/v1/subscriptions.read` | POST | Mark messages as read |

Full API docs: https://developer.rocket.chat/reference/api/rest-api

### 8.2 User Sync

When a user registers on WisdomLinked, create a corresponding Rocket.Chat user:

```typescript
// In your auth.controller.ts, after user creation:
const createRocketChatUser = async (user) => {
  const adminLogin = await fetch('https://chat.wisdomlinked.com/api/v1/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: process.env.ROCKETCHAT_ADMIN_USER,
      password: process.env.ROCKETCHAT_ADMIN_PASSWORD
    })
  });
  const { data } = await adminLogin.json();

  await fetch('https://chat.wisdomlinked.com/api/v1/users.create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': data.authToken,
      'X-User-Id': data.userId
    },
    body: JSON.stringify({
      name: user.username,
      email: user.email,
      password: user.password, // or generate a random one
      username: user.email.split('@')[0],
      roles: ['user']
    })
  });
};
```

### 8.3 Environment Variables to Add

Add to your WisdomLinked backend `.env`:

```bash
# Rocket.Chat Integration
ROCKETCHAT_URL=https://chat.wisdomlinked.com
ROCKETCHAT_ADMIN_USER=wisdomlinked-admin
ROCKETCHAT_ADMIN_PASSWORD=<your-admin-password>

# Jitsi (update from public instance to self-hosted)
JITSI_DOMAIN=meet.wisdomlinked.com
```

---

## 9. Backup & Monitoring

### 9.1 Automated MongoDB Backups

Create a backup script at `~/wisdomlinked-comms/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/home/wisdomlinked/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Dump Rocket.Chat MongoDB
docker exec rocketchat_mongo mongodump \
  --archive=/tmp/rocketchat_$DATE.gz \
  --gzip \
  --db=rocketchat

# Copy dump from container to host
docker cp rocketchat_mongo:/tmp/rocketchat_$DATE.gz $BACKUP_DIR/

# Delete backups older than 30 days
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup completed: rocketchat_$DATE.gz"
```

Make it executable and schedule via cron:

```bash
chmod +x ~/wisdomlinked-comms/backup.sh

# Run daily at 2 AM
crontab -e
# Add this line:
0 2 * * * /home/wisdomlinked/wisdomlinked-comms/backup.sh >> /home/wisdomlinked/backups/backup.log 2>&1
```

### 9.2 Monitoring

Check service health:

```bash
# Container status
docker ps

# Rocket.Chat logs
docker logs --tail 100 rocketchat

# Jitsi logs
docker logs --tail 100 jitsi-web
docker logs --tail 100 jitsi-jvb

# Nginx logs
sudo tail -f /var/log/nginx/error.log

# Disk usage
df -h

# Memory usage
free -h
```

### 9.3 Auto-Restart on Reboot

Docker containers are set to `restart: always` in the compose files, so they auto-start when the server reboots. Verify:

```bash
sudo systemctl enable docker
```

---

## 10. Update & Maintenance

### Update Rocket.Chat

```bash
cd ~/wisdomlinked-comms/rocketchat
docker compose pull
docker compose up -d
```

### Update Jitsi

```bash
cd ~/wisdomlinked-comms/jitsi/docker-jitsi-meet-stable-*
docker compose pull
docker compose up -d
```

### System Updates

```bash
sudo apt update && sudo apt upgrade -y
```

Run system updates monthly. Reboot if kernel updates are installed.

---

## 11. Cost Summary

| Item | Monthly Cost |
|---|---|
| DigitalOcean Droplet (8GB/4vCPU) | $48 |
| Automated Backups | $9.60 |
| SSL Certificates (Let's Encrypt) | $0 |
| Rocket.Chat License | $0 |
| Jitsi License | $0 |
| **Total** | **~$58/mo** |

Compare to paid alternatives:
- CometChat alone: $299–$1,249/mo (chat only, no video)
- Stream: $499–$1,299/mo (chat only)
- Jitsi cloud (8x8): ~$100+/mo

**Savings: $240–$1,200+/mo**

---

## 12. Troubleshooting

| Issue | Solution |
|---|---|
| Rocket.Chat won't start | Check logs: `docker logs rocketchat`. Usually MongoDB connection issue — ensure mongo container is running first |
| Jitsi video not connecting | Ensure port `10000/udp` is open in UFW. Check JVB logs: `docker logs jitsi-jvb` |
| SSL certificate errors | Re-run `sudo certbot --nginx -d chat.wisdomlinked.com`. Check DNS is pointing to server |
| High memory usage | Check `docker stats`. Consider increasing droplet size |
| MongoDB disk full | Check `df -h`. Delete old backups or increase disk size in DO panel |
| Can't send files | Check `client_max_body_size` in Nginx config. Default is too low |
