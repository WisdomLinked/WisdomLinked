# Create production MongoDB (app server)

`appuser` only has access to `WisdomLinked` and `WisdomLinked_Staging`. Creating `WisdomLinked_Production` requires a **MongoDB admin** user.

## On 64.225.13.232

```bash
ssh -i ~/.ssh/github_actions_do_key root@64.225.13.232

# As mongo admin (replace with your admin URI or mongosh admin auth):
mongosh "mongodb://ADMIN_USER:ADMIN_PASS@127.0.0.1:27017/admin" --eval '
  db.getSiblingDB("WisdomLinked_Production").createCollection("_init");
  db.grantRolesToUser("appuser", [
    { role: "readWrite", db: "WisdomLinked_Production" }
  ]);
'
```

## GitHub production `MONGO_URI`

Match staging pattern, swap database name:

```
mongodb://appuser:***@172.18.0.1:27017/WisdomLinked_Production?authSource=WisdomLinked
```

(Current prod container still uses `WisdomLinked` — update after DB + redeploy.)

## Verify

```bash
URI='...production MONGO_URI...'
mongosh "$URI" --eval 'db.getName()'
```
