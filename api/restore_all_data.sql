-- Restore API usage count and portfolio stats
-- Run this in phpMyAdmin to restore all data

USE crypto_portfolio;

-- Step 1: Add api_usage_data column if it doesn't exist (ignore error if exists)
ALTER TABLE portfolios ADD COLUMN api_usage_data JSON DEFAULT NULL;

-- Step 2: Restore API usage count (164 calls used = 9,836 remaining)
-- Format: JavaScript Date.toString() format like "Mon Jan 15 2024"
SET @today_str = DATE_FORMAT(CURDATE(), '%a %b %d %Y');
SET @api_usage = JSON_OBJECT(@today_str, 164);

-- Step 3: Restore portfolio stats from backup
-- highestValue: 153853.05260000002
-- lowestValue: 127345.27840000001
SET @stats_data = JSON_OBJECT('highestValue', 153853.05260000002, 'lowestValue', 127345.27840000001);

-- Step 4: Update the portfolio
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

