# Crypto Portfolio - Portofino

A password-protected cryptocurrency portfolio tracker with server-side data storage.

## Features

- ✅ Password-protected access
- ✅ Server-side data storage (MySQL)
- ✅ Automatic data migration from localStorage
- ✅ Change password feature in UI
- ✅ Real-time price updates
- ✅ Portfolio statistics tracking
- ✅ Daily history snapshots (cron + backend API)

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

4. **Access:**
   - Open: `http://localhost:8000`
   - Login with your credentials

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

## Security

- Change the default password immediately after first login
- Use "Change Password" button in the UI to update your password
- Never share your login credentials

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
│   ├── history.php      # Portfolio history API
│   ├── snapshot.php     # Daily snapshot script (cron)
│   ├── config.example.php # Config template
│   ├── database.sql     # Database schema
│   ├── migration_add_api_usage.sql # Migration script (if needed)
│   ├── migration_add_portfolio_history.sql # Adds history tables
│   └── restore_all_data.sql # Restore script (for data recovery)
├── README.md
└── .gitignore
```

## Important Notes

- `api/config.php` is in `.gitignore` - it won't be committed to git
- Each environment (local/server) needs its own `config.php`
- Never commit `config.php` with real credentials

## Daily History Snapshots

1. **Run the migration**  
   - Import `api/migration_add_portfolio_history.sql` once on your database.

2. **Update config**  
   - Copy `SNAPSHOT_TIMEZONE` and `CRON_SECRET` from `api/config.example.php` into your `config.php`.
   - Set `CRON_SECRET` to a long random string.

3. **Schedule the cron job**  
   - CLI example (Hostinger cron):  
     `0 0 * * * /usr/bin/php /home/user/crypto_folio/api/snapshot.php`
   - HTTP example (if CLI not available):  
     `0 0 * * * curl "https://yourdomain/api/snapshot.php?token=YOUR_SECRET"`
   - Cron runs once per day at midnight (server timezone) and stores the snapshot in the new tables.

4. **History API**  
   - Frontend calls `api/history.php` (authenticated) to fetch stored snapshots.
   - Supports `page` and `per_page` query params (defaults to 10 per page).

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
