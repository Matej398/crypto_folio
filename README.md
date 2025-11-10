# Crypto Portfolio - Portofino

A password-protected cryptocurrency portfolio tracker with server-side data storage.

## Features

- ✅ Password-protected access
- ✅ Server-side data storage (MySQL)
- ✅ Automatic data migration from localStorage
- ✅ Change password feature in UI
- ✅ Real-time price updates
- ✅ Portfolio statistics tracking

## Quick Start

### Local Development

1. **Set up database:**
   - Create MySQL database: `crypto_portfolio`
   - Import schema: `api/database.sql`

2. **Configure database:**
   - Copy `api/config.example.php` to `api/config.php`
   - Update with your local MySQL credentials

3. **Start server:**
   ```bash
   php -S localhost:8000
   ```
   Or double-click `START_SERVER.bat` (Windows)

4. **Access:**
   - Open: `http://localhost:8000`
   - Login: `admin@portfolio.com` / `portfolio123`

### Server Deployment

1. **Database setup:**
   - Create database and user in Hostinger
   - Import `api/database.sql` via phpMyAdmin

2. **Deploy code:**
   - Pull from git or upload files
   - **IMPORTANT:** Create `api/config.php` on server with your database credentials

3. **Create config.php on server:**
   ```bash
   cd /path/to/crypto_folio/api
   # Create config.php with your server database credentials
   ```

## Default Login

- **Email:** `admin@portfolio.com`
- **Password:** `portfolio123`

Change password via "Change Password" button in the UI after logging in.

## File Structure

```
crypto_folio/
├── index.html          # Main HTML
├── css/
│   └── styles.css      # Styles
├── js/
│   └── app.js          # Frontend JavaScript
├── api/
│   ├── auth.php         # Authentication API
│   ├── portfolio.php    # Portfolio CRUD API
│   ├── config.example.php # Config template
│   └── database.sql     # Database schema
├── README.md
└── .gitignore
```

## Important Notes

- `api/config.php` is in `.gitignore` - it won't be committed to git
- Each environment (local/server) needs its own `config.php`
- Never commit `config.php` with real credentials

## Troubleshooting

### "Database connection failed"
- Check `api/config.php` has correct credentials
- Verify database user has permissions

### "Failed to fetch"
- Make sure you're using `http://` or `https://`, not `file://`
- Check PHP server is running

### Sign in button doesn't work
- Check browser console (F12) for errors
- Verify API endpoints are accessible
