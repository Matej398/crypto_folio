# Deploy via Git to Hostinger VPS

## Prerequisites
- SSH access to your Hostinger VPS
- Git installed on server (we'll install if needed)

## Step 1: Get SSH Access

1. **In Hostinger control panel:**
   - Go to **Advanced** → **SSH Access**
   - Enable SSH if not already enabled
   - Note your SSH credentials:
     - Host: `_________________`
     - Port: Usually `22`
     - Username: `_________________`
     - Password/Key: `_________________`

## Step 2: Connect via SSH

**Windows (PowerShell or Git Bash):**
```bash
ssh username@your-server-ip
```

**Or use PuTTY:**
- Download PuTTY
- Enter your server IP
- Port: 22
- Connect

## Step 3: Navigate to Your Web Directory

Once connected via SSH:
```bash
# Find your public_html directory
cd ~
ls -la

# Usually it's one of these:
cd domains/yourdomain.com/public_html
# OR
cd public_html
# OR
cd www
```

## Step 4: Clone/Pull from Git

```bash
# If directory is empty, clone:
git clone https://github.com/Matej398/crypto_folio.git .

# If you already cloned before, just pull:
git pull origin main
```

## Step 5: Create config.php

```bash
# Copy server config
cp api/config.server.php api/config.php

# Edit if needed (or we'll do it via commands)
nano api/config.php
```

The config should have:
- DB_HOST: localhost
- DB_NAME: crypto_portfolio
- DB_USER: root
- DB_PASS: PxBeoY5Ei#xB

## Step 6: Set Permissions

```bash
chmod 644 api/config.php
chmod 755 api/
chmod 644 api/*.php
```

## Step 7: Test

Visit: `https://yourdomain.com/api/auth.php?action=check`

Should see JSON response!

---

## Quick One-Liner (if you know your path)

```bash
cd /path/to/public_html && git clone https://github.com/Matej398/crypto_folio.git . && cp api/config.server.php api/config.php && chmod 644 api/config.php
```

