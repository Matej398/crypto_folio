-- Crypto Portfolio Database Schema
-- Run this SQL in phpMyAdmin or your MySQL client to create the database and tables

-- Create database (if it doesn't exist)
CREATE DATABASE IF NOT EXISTS crypto_portfolio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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


-- Portfolio history snapshots
CREATE TABLE IF NOT EXISTS portfolio_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    snapshot_date DATE NOT NULL,
    total_value DECIMAL(18,2) NOT NULL,
    change_24h DECIMAL(10,4) DEFAULT NULL,
    daily_high DECIMAL(18,2) DEFAULT NULL,
    daily_low DECIMAL(18,2) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_user_snapshot (user_id, snapshot_date),
    INDEX idx_snapshot_user (user_id, snapshot_date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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


