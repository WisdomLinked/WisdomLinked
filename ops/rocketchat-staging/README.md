# Staging Rocket.Chat stack (comms server)

Deploy to `165.227.89.246` at `/root/wisdomlinked-comms/rocketchat-staging/`.

**Prerequisite:** DNS `chat-staging.wisdomlinked.com` → comms server IP.

## 1. Copy compose to server

```bash
scp -r ops/rocketchat-staging root@165.227.89.246:/root/wisdomlinked-comms/
```

## 2. Set secrets on server (not in git)

Create `/root/wisdomlinked-comms/rocketchat-staging/.env`:

```bash
cd /root/wisdomlinked-comms/rocketchat-staging
echo "CREATE_TOKENS_FOR_USERS_SECRET=$(openssl rand -hex 32)" > .env
# copy the value into GitHub staging ROCKETCHAT_CREATE_TOKENS_SECRET
```

Docker Compose loads `.env` from the project directory automatically — no need to edit `docker-compose.yml` for the secret.

## 3. HTTP nginx (before TLS)

Install `ops/rocketchat-staging/nginx-chat-staging.conf` as sites-available, enable the site, and reload nginx. Rocket.Chat is not running yet; certbot only needs port 80 reachable.

## 4. TLS (certbot)

After DNS propagates:

```bash
certbot --nginx -d chat-staging.wisdomlinked.com
```

## 5. Start stack

`docker-compose.yml` sets `ROOT_URL=https://chat-staging.wisdomlinked.com`. Start only **after** step 4 so RC redirects use HTTPS (not before certbot).

```bash
ssh wisdomlinked-comms
cd /root/wisdomlinked-comms/rocketchat-staging
docker compose up -d
docker exec rocketchat_staging_mongo mongosh --eval 'rs.initiate({_id:"rs1", members:[{_id:0, host:"mongodb:27017"}]})'
```

## 6. GitHub staging secrets

- `ROCKETCHAT_URL=https://chat-staging.wisdomlinked.com`
- `ROCKETCHAT_CREATE_TOKENS_SECRET` = same as compose
- Create RC admin bot; set `ROCKETCHAT_ADMIN_USER` / `ROCKETCHAT_ADMIN_PASS`
