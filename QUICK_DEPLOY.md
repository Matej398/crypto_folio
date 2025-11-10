# Quick Deployment Checklist

## What's Already Done ✅
- [x] Code pushed to GitHub
- [x] All files ready
- [x] .gitignore configured (config.php won't be committed)

## What You Need to Do on Hostinger

### Step 1: Create Database (2 minutes)
1. Log into Hostinger → Databases → MySQL Databases
2. Create database: `crypto_portfolio`
3. Create user (or use existing)
4. **Save these credentials:**
   - DB Name: _______________
   - DB User: _______________
   - DB Password: _______________

### Step 2: Upload Files (5 minutes)
**Option A: File Manager**
1. Hostinger → File Manager → `public_html`
2. Upload all folders: `api/`, `css/`, `js/`
3. Upload `index.html`

**Option B: Git Pull (if you have SSH access)**
```bash
cd public_html
git clone https://github.com/Matej398/crypto_folio.git .
```

### Step 3: Configure Database (1 minute)
1. In File Manager, edit `api/config.php`
2. Update with your server database credentials
3. Save

### Step 4: Import Database Schema (1 minute)
1. Hostinger → phpMyAdmin
2. Select your database
3. Import → Choose `api/database.sql` → Go

### Step 5: Test (1 minute)
1. Visit: `https://yourdomain.com`
2. Login: `admin@portfolio.com` / `portfolio123`
3. Should work!

### Step 6: Change Password (1 minute)
1. Visit: `https://yourdomain.com/api/change_password.php`
2. Enter new password
3. Delete `change_password.php` after

---

**Total time: ~10 minutes**

