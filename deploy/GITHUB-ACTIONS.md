# One-time setup: GitHub Actions auto-deploy after push to main
# Repo: https://github.com/Psheno24/RusGame/settings/secrets/actions

Add four **Repository secrets**:

| Name | Value |
|------|--------|
| `SSH_HOST` | IP or domain of VPS (e.g. `185.x.x.x`) |
| `SSH_USER` | SSH user (`root` or `ubuntu`) |
| `SSH_PRIVATE_KEY` | Full private key file (`id_ed25519`), including `-----BEGIN` / `-----END` |
| `DEPLOY_PATH` | `/opt/rusgame` |

## SSH key (once)

On your PC (PowerShell):

```powershell
ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\rusgame_deploy -N '""'
```

Copy public key to server:

```powershell
type $env:USERPROFILE\.ssh\rusgame_deploy.pub
```

On VPS:

```bash
mkdir -p ~/.ssh
echo "PASTE_PUBLIC_KEY" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Put **private** key contents into GitHub secret `SSH_PRIVATE_KEY`.

Test from PC:

```powershell
ssh -i $env:USERPROFILE\.ssh\rusgame_deploy root@YOUR_VPS_IP "cd /opt/rusgame && docker compose ps"
```

## Flow after setup

1. Local: `npm run dev` -> http://localhost:5173
2. GitHub Desktop: Commit -> **Push origin**
3. GitHub Actions: build + test -> SSH -> `deploy/update.sh` on VPS (~2-3 min)
4. Site updated at `https://YOUR_DOMAIN`

If Actions is red on **Deploy**: check Secrets. If red on **Build**: fix TypeScript/tests before push.
