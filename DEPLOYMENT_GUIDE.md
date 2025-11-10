# Step-by-Step Deployment Guide to Hostinger VPS

**⚠️ SAFE DEPLOYMENT - We'll backup everything first!**

## Phase 1: Backup & Preparation (DO THIS FIRST!)

### Step 1.1: Backup Your Current Local Data
1. **Open your browser** where you have the portfolio
2. **Open Developer Tools** (F12 or Right-click → Inspect)
3. **Go to Console tab**
4. **Run this command** to export your data:
   ```javascript
   console.log(JSON.stringify({
     portfolio: JSON.parse(localStorage.getItem('cryptoPortfolio') || '[]'),
     stats: JSON.parse(localStorage.getItem('portfolioStats') || '{}')
   }))
   ```
5. **Copy the output** and save it to a file called `backup_data.json` in your project folder
6. **Also check** if you have any coins - take a screenshot or write them down

### Step 1.2: Verify Local Setup Works
1. Make sure your local database is set up
2. Test login locally with: `admin@portfolio.com` / `portfolio123`
3. Make sure everything works before deploying

### Step 1.3: Prepare Files for Upload
1. **Create a list** of files to upload:
   - `index.html`
   - `css/` folder (all files)
   - `js/` folder (all files)
   - `api/` folder (all files)
   - `README.md` (optional)

2. **DO NOT upload yet** - we'll do it step by step

---

## Phase 2: Server Preparation

### Step 2.1: Access Your Hostinger Control Panel
1. Log into Hostinger
2. Go to **hPanel** or **VPS Control Panel**
3. Note your:
   - **Domain name** (e.g., `yourdomain.com`)
   - **FTP/SFTP credentials** (or use File Manager)
   - **Database credentials** (MySQL)

### Step 2.2: Create Database on Server
1. In Hostinger, go to **Databases** → **MySQL Databases**
2. **Create a new database:**
   - Database name: `crypto_portfolio` (or similar)
   - Note the full name (might be `username_crypto_portfolio`)
3. **Create a database user:**
   - Username: (create new or use existing)
   - Password: (create strong password, save it!)
4. **Grant privileges:** Give the user full access to the database
5. **Note down:**
   - Database name: `_________________`
   - Database user: `_________________`
   - Database password: `_________________`
   - Database host: Usually `localhost` (check in Hostinger)

### Step 2.3: Access phpMyAdmin on Server
1. In Hostinger, find **phpMyAdmin** link
2. Click to open phpMyAdmin
3. **Select your database** from the left sidebar
4. **Keep this open** - we'll import the schema here

---

## Phase 3: Upload Files (CAREFULLY!)

### Step 3.1: Access Server Files
**Option A: File Manager (Easiest)**
1. In Hostinger, go to **File Manager**
2. Navigate to `public_html` (or `www` or your domain folder)

**Option B: FTP/SFTP**
1. Use FileZilla or similar
2. Connect with your FTP credentials
3. Navigate to `public_html`

### Step 3.2: Create Backup of Existing Files (If Any)
1. If you have existing files in `public_html`:
   - **Create a folder** called `backup_old_website` (or similar)
   - **Move existing files** there (don't delete yet!)

### Step 3.3: Upload Project Files
1. **Create folder structure:**
   - In `public_html`, create: `crypto_folio` (or upload directly to root)
   
2. **Upload files in this order:**
   - First: `api/` folder (all PHP files)
   - Then: `css/` folder
   - Then: `js/` folder
   - Finally: `index.html`

3. **Verify upload:**
   - Check that all files are there
   - Check file permissions (should be 644 for files, 755 for folders)

---

## Phase 4: Configure Database Connection

### Step 4.1: Edit config.php on Server
1. In File Manager, open `api/config.php`
2. **Update with your SERVER database credentials:**
   ```php
   define('DB_HOST', 'localhost');           // Usually 'localhost'
   define('DB_NAME', 'your_db_name');        // Your Hostinger database name
   define('DB_USER', 'your_db_user');        // Your Hostinger database user
   define('DB_PASS', 'your_db_password');    // Your Hostinger database password
   ```
3. **Save the file**

### Step 4.2: Import Database Schema
1. In phpMyAdmin (from Step 2.3)
2. **Select your database** (left sidebar)
3. Click **"Import"** tab
4. **Choose file:** Upload `api/database.sql` from your local computer
5. Click **"Go"**
6. **Verify:** You should see `users` and `portfolios` tables created

---

## Phase 5: Test on Server

### Step 5.1: Test Database Connection
1. Visit: `https://yourdomain.com/api/auth.php?action=check`
2. Should see JSON response (even if error - means PHP is working)

### Step 5.2: Test Login
1. Visit: `https://yourdomain.com` (or `https://yourdomain.com/crypto_folio` if in subfolder)
2. You should see the login modal
3. **Try logging in:**
   - Email: `admin@portfolio.com`
   - Password: `portfolio123`
4. **If it works:** Great! Skip to Step 6
5. **If it fails:** Check error messages, see Troubleshooting below

### Step 5.3: Create User (If Needed)
1. If login fails with "user not found":
2. Visit: `https://yourdomain.com/api/create_test_user.php` (if you uploaded it)
3. Or manually create user in phpMyAdmin (see below)

---

## Phase 6: Restore Your Data

### Step 6.1: Login to Your Account
1. Make sure you're logged in on the server

### Step 6.2: Import Your Backup Data
1. **Option A: Manual Entry**
   - Add your coins back manually (they're in your backup_data.json)

2. **Option B: Database Import (Advanced)**
   - Open phpMyAdmin
   - Select your database
   - Go to `portfolios` table
   - Click "Insert" or "Edit"
   - Paste your portfolio JSON data
   - Save

3. **Option C: Use Migration (Automatic)**
   - If you still have localStorage data in your browser
   - Login to the server
   - The app should automatically migrate it (if you have the old data in browser)

---

## Phase 7: Security & Cleanup

### Step 7.1: Change Default Password
1. Visit: `https://yourdomain.com/api/change_password.php`
2. Enter your new strong password
3. **IMPORTANT:** Delete `change_password.php` after changing password!

### Step 7.2: Delete Test/Create Files
1. Delete from server:
   - `api/create_test_user.php` (if uploaded)
   - `api/change_password.php` (after changing password)

### Step 7.3: Set File Permissions
1. Make sure sensitive files have correct permissions:
   - `api/config.php` should be 644 (readable, not executable)
   - PHP files should be 644
   - Folders should be 755

### Step 7.4: Enable HTTPS (If Not Already)
1. Make sure your domain has SSL certificate enabled
2. In Hostinger, check SSL/TLS settings
3. Force HTTPS redirect if possible

---

## Troubleshooting

### "Database connection failed"
- Check `api/config.php` credentials
- Verify database exists in phpMyAdmin
- Check database user has permissions

### "Failed to fetch" on server
- Make sure you're accessing via `https://` not `file://`
- Check PHP is enabled on server
- Check file paths are correct

### "User not found" / Login fails
- User might not exist yet
- Visit `api/create_test_user.php` to create it
- Or create manually in database

### Can't access phpMyAdmin
- Use Hostinger's phpMyAdmin link
- Or access via: `https://yourdomain.com/phpmyadmin` (if installed)

### Files not uploading
- Check file permissions
- Check disk space on server
- Try FTP instead of File Manager

---

## Rollback Plan (If Something Goes Wrong)

### If You Need to Start Over:
1. **Your data is safe** - you have `backup_data.json`
2. **Delete uploaded files** from server
3. **Fix issues** locally first
4. **Re-upload** when ready

### If Database Gets Corrupted:
1. **Drop the database** in phpMyAdmin
2. **Re-import** `api/database.sql`
3. **Re-enter your data** from backup

### If You Lose Access:
1. **Contact Hostinger support**
2. **Use FTP** to access files
3. **Check error logs** in Hostinger control panel

---

## Quick Checklist

Before going live, verify:
- [ ] Database created and schema imported
- [ ] `api/config.php` has correct server credentials
- [ ] All files uploaded to correct location
- [ ] Can access website via HTTPS
- [ ] Login works with default password
- [ ] Portfolio data restored (or ready to restore)
- [ ] Default password changed
- [ ] Test files deleted (`create_test_user.php`, etc.)
- [ ] SSL/HTTPS enabled

---

## Need Help?

If you get stuck at any step:
1. **Don't panic** - your local data is backed up
2. **Check the error message** carefully
3. **Verify each step** was completed
4. **Test locally first** if possible
5. **Check Hostinger documentation** for server-specific issues

**Remember:** You can always roll back and try again. Your data is safe in the backup!

