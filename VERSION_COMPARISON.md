# Version Comparison: Git vs Live Site (poorty.com)

## Features Present in Git Repository (Latest Version)

### ✅ Core Features (Likely on Live Site)
- Password-protected access
- Change Password functionality
- Sign Out
- Add/Edit/Remove coins
- Portfolio statistics (Total Value, 24h Change, Highest/Lowest)
- Holdings History tab
- API usage tracking (This Month: X/10,000)
- BTC/ETH price display in footer
- Avatar upload functionality
- Fear & Greed Index display

### ⚠️ Features That May Be Missing on Live Site

#### 1. **Timestamp Icons for Portfolio Records**
- **Location**: Highest/Lowest Portfolio Value displays
- **Feature**: Shows when the highest/lowest values were recorded
- **Files**: 
  - `index.html` lines 90-100 (timestamp icon elements)
  - `js/app.js` (timestamp display logic)
  - `css/styles.css` (timestamp styling)
- **Visual**: Small icon next to highest/lowest values that shows tooltip with date/time

#### 2. **Mobile Menu (Hamburger Menu)**
- **Location**: Header on mobile devices
- **Feature**: Responsive hamburger menu for mobile navigation
- **Files**:
  - `index.html` lines 41-48, 75 (mobile menu toggle)
  - `css/styles.css` (mobile menu styles)
  - `js/app.js` (mobile menu functionality)
- **Visual**: Three-line hamburger icon that expands menu on mobile

#### 3. **History Notes System**
- **Location**: History tab - each history entry can have multiple notes
- **Feature**: Add, edit, and delete notes for each history snapshot
- **Files**:
  - `api/history.php` (notes CRUD API)
  - `api/migration_add_history_notes_table.sql` (database migration)
  - `js/app.js` (notes UI and functionality)
- **Database**: Requires `portfolio_history_notes` table
- **Visual**: Notes section in each history entry with add/edit/delete buttons

#### 4. **Enhanced History Display**
- **Feature**: History entries show Fear & Greed Index values
- **Files**: 
  - `api/history.php` (includes fear_greed_index in response)
  - `api/snapshot.php` (captures fear_greed_index during snapshots)
  - `js/app.js` (displays fear & greed in history)
- **Database**: Requires `fear_greed_index` column in `portfolio_history` table

## Database Migrations Needed

If the live site is missing features, you may need to run these migrations:

1. **Timestamp Support** (if stats don't have timestamps):
   - `api/add_timestamps_to_stats.sql`

2. **Fear & Greed Index**:
   - `api/migration_add_fear_greed_index.sql`

3. **History Notes Table**:
   - `api/migration_add_history_notes_table.sql`

4. **Complete Setup** (if starting fresh):
   - `api/complete_database_setup.sql` or
   - `api/complete_database_setup_safe.sql` (safer, checks before adding)

## Quick Check Commands

To verify what's on your live server, check:

1. **Database tables**:
   ```sql
   SHOW TABLES LIKE 'portfolio_history%';
   DESCRIBE portfolio_history;
   ```

2. **Check for fear_greed_index column**:
   ```sql
   SHOW COLUMNS FROM portfolio_history LIKE 'fear_greed_index';
   ```

3. **Check for notes table**:
   ```sql
   SHOW TABLES LIKE 'portfolio_history_notes';
   ```

4. **Check stats_data structure**:
   ```sql
   SELECT JSON_EXTRACT(stats_data, '$.highestValueTimestamp') FROM portfolios LIMIT 1;
   ```

## Recommendations

1. **Backup your live database** before making any changes
2. **Compare file versions** - check if `index.html`, `js/app.js`, and `css/styles.css` match git versions
3. **Run missing migrations** if database structure is outdated
4. **Test features** after deployment to ensure everything works

## Files to Update on Live Site

If deploying from git, ensure these files are updated:
- `index.html` (has timestamp icons, mobile menu)
- `js/app.js` (has all feature logic)
- `css/styles.css` (has all styling)
- `api/history.php` (has notes support)
- `api/avatar.php` (avatar upload)
- `api/snapshot.php` (captures fear & greed index)

