-- Restore API usage count to 9,836 calls used (164 remaining)
-- Run this in phpMyAdmin to restore the correct API usage count

USE crypto_portfolio;

-- Simple approach: put all 9,836 calls on today's date
-- Format date as JavaScript Date.toString() format: "Mon Jan 15 2024"
SET @today_str = DATE_FORMAT(CURDATE(), '%a %b %d %Y');

-- Update the portfolio with restored API usage (9836 calls used)
UPDATE portfolios 
SET api_usage_data = JSON_OBJECT(@today_str, 9836)
WHERE user_id = (SELECT id FROM users WHERE email = 'admin@portfolio.com' LIMIT 1);

-- Verify the update
SELECT 
    id,
    user_id,
    JSON_PRETTY(api_usage_data) as api_usage_data
FROM portfolios
WHERE user_id = (SELECT id FROM users WHERE email = 'admin@portfolio.com' LIMIT 1);
