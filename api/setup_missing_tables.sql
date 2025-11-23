USE crypto_portfolio;

-- Portfolio history snapshots (if it doesn't exist)
CREATE TABLE IF NOT EXISTS portfolio_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    snapshot_date DATE NOT NULL,
    total_value DECIMAL(18,2) NOT NULL,
    change_24h DECIMAL(10,4) DEFAULT NULL,
    daily_high DECIMAL(18,2) DEFAULT NULL,
    daily_low DECIMAL(18,2) DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    fear_greed_index INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_user_snapshot (user_id, snapshot_date),
    INDEX idx_snapshot_user (user_id, snapshot_date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add notes column to portfolio_history if it doesn't exist
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'crypto_portfolio' 
    AND TABLE_NAME = 'portfolio_history' 
    AND COLUMN_NAME = 'notes');
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE portfolio_history ADD COLUMN notes TEXT DEFAULT NULL AFTER daily_low', 
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add fear_greed_index column to portfolio_history if it doesn't exist
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'crypto_portfolio' 
    AND TABLE_NAME = 'portfolio_history' 
    AND COLUMN_NAME = 'fear_greed_index');
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE portfolio_history ADD COLUMN fear_greed_index INT DEFAULT NULL AFTER notes', 
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Portfolio history coins table
CREATE TABLE IF NOT EXISTS portfolio_history_coins (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    history_id BIGINT NOT NULL,
    coin_id VARCHAR(128) NOT NULL,
    symbol VARCHAR(32) NOT NULL,
    name VARCHAR(128) NOT NULL,
    quantity DECIMAL(32,10) NOT NULL,
    price_usd DECIMAL(18,8) NOT NULL,
    value_usd DECIMAL(18,8) NOT NULL,
    change_24h DECIMAL(10,4) DEFAULT NULL,
    image_url VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_history (history_id),
    FOREIGN KEY (history_id) REFERENCES portfolio_history(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Portfolio history notes table (for multiple notes per history entry)
CREATE TABLE IF NOT EXISTS portfolio_history_notes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    history_id BIGINT NOT NULL,
    note_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_history (history_id),
    FOREIGN KEY (history_id) REFERENCES portfolio_history(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add api_usage_data to portfolios if it doesn't exist
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'crypto_portfolio' 
    AND TABLE_NAME = 'portfolios' 
    AND COLUMN_NAME = 'api_usage_data');
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE portfolios ADD COLUMN api_usage_data JSON DEFAULT NULL', 
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;



