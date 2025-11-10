-- Restore API usage count and portfolio stats
-- Run this in phpMyAdmin to restore all data

USE crypto_portfolio;

-- Step 1: Restore API usage count (164 calls used = 9,836 remaining)
-- (Column api_usage_data should already exist - if you get an error, run the migration script first)
-- Format: JavaScript Date.toString() format like "Mon Jan 15 2024"
SET @today_str = DATE_FORMAT(CURDATE(), '%a %b %d %Y');
SET @api_usage = JSON_OBJECT(@today_str, 164);

-- Step 2: Restore portfolio stats from backup with timestamps
-- highestValue: 153853.05260000002 (recorded on 6.11.2025)
-- lowestValue: 127345.27840000001 (recorded on 4.11.2025)
SET @stats_data = JSON_OBJECT(
    'highestValue', 153853.05260000002,
    'lowestValue', 127345.27840000001,
    'highestValueTimestamp', '2025-11-06T00:00:00.000Z',
    'lowestValueTimestamp', '2025-11-04T00:00:00.000Z'
);

-- Step 3: Update the portfolio
UPDATE portfolios 
SET 
    api_usage_data = @api_usage,
    stats_data = @stats_data
WHERE user_id = (SELECT id FROM users WHERE email = 'admin@portfolio.com' LIMIT 1);

-- Verify the update
SELECT 
    id,
    user_id,
    JSON_PRETTY(api_usage_data) as api_usage_data,
    JSON_PRETTY(stats_data) as stats_data
FROM portfolios
WHERE user_id = (SELECT id FROM users WHERE email = 'admin@portfolio.com' LIMIT 1);

