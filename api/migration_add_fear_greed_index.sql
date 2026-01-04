USE crypto_portfolio;

ALTER TABLE portfolio_history 
ADD COLUMN fear_greed_index INT DEFAULT NULL AFTER notes;
