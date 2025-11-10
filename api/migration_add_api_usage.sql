-- Migration: Add api_usage_data column to existing portfolios table
-- Run this SQL in phpMyAdmin if you already have the database set up

USE crypto_portfolio;

-- Check if column exists before adding (MySQL doesn't support IF NOT EXISTS for ALTER TABLE)
-- If you get an error that the column already exists, that's fine - just ignore it
ALTER TABLE portfolios ADD COLUMN api_usage_data JSON DEFAULT NULL;

