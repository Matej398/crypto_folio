-- Add timestamps to existing portfolio stats
-- Run this in phpMyAdmin to add timestamps to stats that have values but no timestamps

USE crypto_portfolio;

-- Get current stats and add timestamps if missing
UPDATE portfolios 
SET stats_data = JSON_SET(
    stats_data,
    '$.highestValueTimestamp', 
    COALESCE(
        JSON_UNQUOTE(JSON_EXTRACT(stats_data, '$.highestValueTimestamp')),
        '2025-11-06T00:00:00.000Z'
    ),
    '$.lowestValueTimestamp',
    COALESCE(
        JSON_UNQUOTE(JSON_EXTRACT(stats_data, '$.lowestValueTimestamp')),
        '2025-11-04T00:00:00.000Z'
    )
)
WHERE user_id = (SELECT id FROM users WHERE email = 'admin@portfolio.com' LIMIT 1)
  AND JSON_EXTRACT(stats_data, '$.highestValue') IS NOT NULL
  AND JSON_EXTRACT(stats_data, '$.lowestValue') IS NOT NULL;

-- Verify the update
SELECT 
    id,
    user_id,
    JSON_PRETTY(stats_data) as stats_data
FROM portfolios
WHERE user_id = (SELECT id FROM users WHERE email = 'admin@portfolio.com' LIMIT 1);
