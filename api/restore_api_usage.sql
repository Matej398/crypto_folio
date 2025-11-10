-- Restore API usage count to 9,836 calls used (164 remaining)
-- Run this in phpMyAdmin to restore the correct API usage count

USE crypto_portfolio;

-- Calculate the date range for current month
-- This will set up API usage data for the current month with 9,836 total calls
-- We'll distribute it across the month proportionally

-- Get current month dates
SET @current_month = DATE_FORMAT(NOW(), '%Y-%m');
SET @first_day = DATE_FORMAT(NOW(), '%Y-%m-01');
SET @today = CURDATE();

-- Calculate days in month and days passed
SET @days_in_month = DAY(LAST_DAY(@first_day));
SET @days_passed = DAY(@today);

-- Approximate distribution: 9,836 calls across @days_passed days
-- Roughly 9,836 / @days_passed calls per day on average
-- But let's put most calls on recent days

-- Create JSON structure with calls distributed across the month
-- This is an approximation - we'll put more calls on recent days
SET @api_usage_json = JSON_OBJECT();

-- Simple approach: put all 9,836 calls on today's date
-- Format date as JavaScript Date.toString() format: "Mon Jan 15 2024"
SET @today_str = DATE_FORMAT(@today, '%a %b %d %Y');
SET @api_usage_json = CONCAT('{"', @today_str, '": 9836}');

-- Update the portfolio with restored API usage
UPDATE portfolios 
SET api_usage_data = CAST(@api_usage_json AS JSON)
WHERE user_id = (SELECT id FROM users WHERE email = 'admin@portfolio.com' LIMIT 1);

-- Alternative: If you want to distribute across multiple days, you can manually set it:
-- UPDATE portfolios 
-- SET api_usage_data = '{"Mon Jan 15 2024": 2000, "Tue Jan 16 2024": 2500, "Wed Jan 17 2024": 3000, "Thu Jan 18 2024": 2336}'
-- WHERE user_id = (SELECT id FROM users WHERE email = 'admin@portfolio.com' LIMIT 1);

-- Verify the update
SELECT 
    id,
    user_id,
    JSON_PRETTY(api_usage_data) as api_usage_data
FROM portfolios
WHERE user_id = (SELECT id FROM users WHERE email = 'admin@portfolio.com' LIMIT 1);

