# Crypto Portfolio - Setup Guide

This application now supports password-protected accounts with server-side data storage using PHP and MySQL.

## Local Setup

### Prerequisites
- PHP 7.4 or higher
- MySQL/MariaDB
- Web server (Apache/Nginx) or PHP built-in server
- phpMyAdmin (optional, for database management)

### Step 1: Database Setup

1. **Open phpMyAdmin** (or your MySQL client)

2. **Create the database:**
   - Click "New" to create a new database
   - Name it: `crypto_portfolio`
   - Collation: `utf8mb4_unicode_ci`
   - Click "Create"

3. **Import the schema:**
   - Select the `crypto_portfolio` database
   - Go to "Import" tab
   - Choose file: `api/database.sql`
   - Click "Go"

   **OR** manually run the SQL from `api/database.sql` in the SQL tab

### Step 2: Configure Database Connection

1. **Edit `api/config.php`:**
   ```php
   define('DB_HOST', 'localhost');      // Usually 'localhost'
   define('DB_NAME', 'crypto_portfolio'); // Database name
   define('DB_USER', 'root');           // Your MySQL username
   define('DB_PASS', '');               // Your MySQL password
   ```

2. **Update with your MySQL credentials:**
   - If using XAMPP/WAMP: Usually `root` with empty password
   - If using MAMP: Usually `root` with password `root`
   - Check your local MySQL setup

### Step 3: Start Local Server

**⚠️ IMPORTANT: You MUST run a PHP server - don't just open the HTML file!**

**Option A: PHP Built-in Server (Easiest)**
```bash
# Navigate to project directory
cd crypto_folio

# Start server
php -S localhost:8000
```

Then open: `http://localhost:8000` (NOT file://)

**Option B: Use the provided script**
- **Windows:** Double-click `START_SERVER.bat`
- **Mac/Linux:** Run `chmod +x START_SERVER.sh && ./START_SERVER.sh`

**Option B: XAMPP/WAMP/MAMP**
1. Place project in `htdocs` (XAMPP) or `www` (WAMP/MAMP)
2. Start Apache and MySQL from control panel
3. Open: `http://localhost/crypto_folio`

### Step 4: Test the Application

1. Open the application in your browser
2. You should see a sign-in modal (with solid black background)
3. **Default login credentials:**
   - **Email:** `admin@portfolio.com` (pre-filled)
   - **Password:** `portfolio123`
4. Log in and your portfolio data will be saved to the database

### Step 5: Change Password (Optional)

1. **Via web interface:**
   - Visit: `http://localhost:8000/api/change_password.php`
   - Enter your new password
   - Click "Change Password"
   - **IMPORTANT:** Delete `api/change_password.php` after changing password for security!

2. **Via database (phpMyAdmin):**
   - Open phpMyAdmin
   - Select `crypto_portfolio` database
   - Go to `users` table
   - Edit the `password_hash` field
   - Generate new hash using PHP: `<?php echo password_hash('your_new_password', PASSWORD_DEFAULT); ?>`
   - Save the hash value

## Server Deployment (Hostinger VPS)

**⚠️ IMPORTANT: Read `DEPLOYMENT_GUIDE.md` for detailed step-by-step instructions!**

This is a quick reference. For safe deployment with backups, see the full guide.

### Step 1: Upload Files

1. **Upload all files** to your server via FTP/SFTP:
   - `index.html`
   - `css/` folder
   - `js/` folder
   - `api/` folder

2. **Recommended structure:**
   ```
   public_html/
   ├── index.html
   ├── css/
   ├── js/
   └── api/
   ```

### Step 2: Configure Database on Server

1. **Update `api/config.php`** with your server database credentials:
   ```php
   define('DB_HOST', 'localhost');           // Usually 'localhost'
   define('DB_NAME', 'your_db_name');        // Your Hostinger database name
   define('DB_USER', 'your_db_user');        // Your Hostinger database user
   define('DB_PASS', 'your_db_password');    // Your Hostinger database password
   ```

2. **Create database in Hostinger:**
   - Log into Hostinger control panel
   - Go to "Databases" → "MySQL Databases"
   - Create a new database: `crypto_portfolio`
   - Create a database user (or use existing)
   - Note the credentials

3. **Import schema:**
   - Open phpMyAdmin from Hostinger control panel
   - Select your database
   - Import `api/database.sql` or run the SQL manually

### Step 3: Set Permissions

Make sure the `api/` folder is accessible:
```bash
chmod 755 api/
chmod 644 api/*.php
```

### Step 4: Test

1. Visit your domain: `https://yourdomain.com`
2. Create an account
3. Test portfolio functionality

## Security Notes

- ✅ Passwords are hashed using PHP's `password_hash()` (bcrypt)
- ✅ SQL injection protection via PDO prepared statements
- ✅ Session-based authentication
- ✅ User data is isolated (users can only access their own data)
- ⚠️ **Important:** Use HTTPS in production (SSL certificate)

## Troubleshooting

### "Database connection failed"
- Check `api/config.php` credentials
- Verify MySQL is running
- Check database name exists

### "Authentication required" errors
- Check PHP sessions are working
- Verify `api/` folder permissions
- Check PHP error logs

### CORS errors (if API is on different domain)
- Update CORS headers in `api/config.php` if needed
- Or configure server to allow your domain

### Session not persisting
- Check PHP `session.save_path` is writable
- Verify cookies are enabled in browser

## File Structure

```
crypto_folio/
├── index.html          # Main HTML file
├── css/
│   └── styles.css      # Styles
├── js/
│   └── app.js          # Frontend JavaScript
├── api/
│   ├── config.php      # Database configuration
│   ├── auth.php         # Authentication endpoints
│   ├── portfolio.php    # Portfolio CRUD endpoints
│   └── database.sql    # Database schema
└── README.md           # This file
```

## API Endpoints

- `POST api/auth.php?action=signup` - Create account
- `POST api/auth.php?action=login` - Sign in
- `POST api/auth.php?action=logout` - Sign out
- `GET api/auth.php?action=check` - Check auth status
- `GET api/portfolio.php` - Get portfolio
- `POST api/portfolio.php` - Save portfolio

## Next Steps

1. ✅ Set up database locally
2. ✅ Test authentication
3. ✅ Test portfolio save/load
4. ✅ Push to git
5. ✅ Deploy to Hostinger
6. ✅ Configure production database
7. ✅ Enable HTTPS/SSL

