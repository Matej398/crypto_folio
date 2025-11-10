-- Restore API usage count: 164 calls used = 9,836 remaining
-- Run this in phpMyAdmin to restore the correct API usage count

USE crypto_portfolio;

-- Format date as JavaScript Date.toString() format: "Mon Jan 15 2024"
-- JavaScript Date.toString() format: "Day Mon DD YYYY" (e.g., "Mon Jan 15 2024")
-- MySQL DATE_FORMAT: %a = abbreviated weekday, %b = abbreviated month, %d = day, %Y = year
SET @today_str = DATE_FORMAT(CURDATE(), '%a %b %d %Y');

-- Update the portfolio with restored API usage (164 calls used, so 9,836 remaining)
UPDATE portfolios 
SET api_usage_data = JSON_OBJECT(@today_str, 164)
WHERE user_id = (SELECT id FROM users WHERE email = 'admin@portfolio.com' LIMIT 1);

-- Verify the update
SELECT 
    id,
    user_id,
    JSON_PRETTY(api_usage_data) as api_usage_data
FROM portfolios
WHERE user_id = (SELECT id FROM users WHERE email = 'admin@portfolio.com' LIMIT 1);
