USE crypto_portfolio;

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add avatar_url if missing (ignore error if it already exists)
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255) DEFAULT NULL AFTER password_hash;

-- Portfolios table to store user portfolio data
CREATE TABLE IF NOT EXISTS portfolios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    portfolio_data JSON NOT NULL,
    stats_data JSON DEFAULT NULL,
    api_usage_data JSON DEFAULT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_portfolio (user_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add api_usage_data if missing (ignore error if it already exists)
ALTER TABLE portfolios ADD COLUMN api_usage_data JSON DEFAULT NULL;

-- Portfolio history snapshots
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

-- Add notes column if missing (ignore error if it already exists)
ALTER TABLE portfolio_history ADD COLUMN notes TEXT DEFAULT NULL AFTER daily_low;

-- Add fear_greed_index column if missing (ignore error if it already exists)
ALTER TABLE portfolio_history ADD COLUMN fear_greed_index INT DEFAULT NULL AFTER notes;

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

